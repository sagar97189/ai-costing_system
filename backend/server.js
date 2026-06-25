const http = require("http");
process.on('uncaughtException', (err) => {
  if (["EOF", "ECONNRESET", "EPIPE"].includes(err.code)) {
    console.warn('[SERVER] Client disconnected (uncaught):', err.code);
    return;
  }
  console.error('UNCAUGHT', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED', err);
  process.exit(1);
});
const { Buffer } = require("buffer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const jwt = require("jsonwebtoken");
const { buildProfessionalPdf } = require("./pdf-generator");
const { categorize } = require("./feature-categorizer");
const { assignMachines, getAllMachines } = require("./machine-master");
const { generateOTP } = require("./src/utils/otpGenerator");
const otpCache = require("./src/cache/otpCache");
const { sendOTPEmail } = require("./src/services/emailService");
const { checkRateLimit } = require("./src/middleware/rateLimiter");
const { authenticateRequest: authMiddleware } = require("./middleware/authMiddleware");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Always overwrite — ensures .env changes are picked up on restart
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const port = process.env.BACKEND_PORT || 8000;
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const aiApiKey = geminiApiKey || openAiApiKey || "";
const openAiModel = process.env.OPENAI_MODEL || "gemini-2.0-flash";
const geminiModels = [openAiModel, "gemini-2.5-flash", "gemini-2.0-flash-001"].filter((v, i, a) => a.indexOf(v) === i);
const getPostgresUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_HOST && process.env.DB_PORT && process.env.DB_NAME) {
    return `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  }
  return "";
};

// ── In-memory result cache (keyed by file content hash) ───────────
// Avoids burning Gemini quota re-analyzing the same drawing.
// Entries expire after 30 minutes.
const _analysisCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(buffer) {
  const step = Math.max(1, Math.floor(buffer.length / 64));
  let h = buffer.length;
  for (let i = 0; i < buffer.length; i += step) {
    h = (Math.imul(h, 31) + buffer[i]) >>> 0;
  }
  return h.toString(16) + "_" + buffer.length;
}

function getCached(buffer) {
  const key = cacheKey(buffer);
  const entry = _analysisCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _analysisCache.delete(key); return null; }
  console.log(`[CACHE] Hit — returning cached result (key ${key})`);
  return JSON.parse(JSON.stringify(entry.result)); // deep clone
}

function setCache(buffer, result) {
  const key = cacheKey(buffer);
  _analysisCache.set(key, { result: JSON.parse(JSON.stringify(result)), ts: Date.now() });
  if (_analysisCache.size > 50) {
    const oldest = [..._analysisCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    _analysisCache.delete(oldest[0]);
  }
}

// ── Converts confidence label to numeric score for DB storage ──
function confidenceToScore(confidence) {
  const map = { HIGH: 0.9, MEDIUM: 0.6, LOW: 0.3 };
  if (typeof confidence === "number") return confidence;
  return map[String(confidence).toUpperCase()] ?? 0.3;
}

let PgPool = null;
try {
  ({ Pool: PgPool } = require("pg"));
} catch {
  PgPool = null;
}

let postgresPool = null;
let dbConnected = false;
let dbError = null;
let dbConfigInfo = { host: null, database: null, port: null };

function getPool() {
  const url = getPostgresUrl();
  if (!postgresPool && PgPool && url) {
    postgresPool = new PgPool({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true
    });
    postgresPool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client:', err.message);
    });
  }
  return postgresPool;
}

async function testConnection() {
  if (!postgresPool) return false;
  try {
    await postgresPool.query("SELECT NOW();");
    return true;
  } catch (e) {
    return false;
  }
}

async function connectDatabase(attempt = 1) {
  const url = getPostgresUrl();
  if (!url) {
    console.log("❌ DATABASE_URL not configured.");
    return false;
  }
  if (!PgPool) return false;

  const pool = getPool();
  try {
    await postgresPool.query("SELECT NOW();");

    // Ensure users table exists
    await postgresPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure last_otp_verified column exists for the 24-hour bypass feature
    await postgresPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_otp_verified TIMESTAMP`);

    dbConnected = true;
    dbError = null;

    try {
      const urlObj = new URL(url);
      dbConfigInfo.host = urlObj.hostname;
      dbConfigInfo.database = urlObj.pathname.slice(1);
      dbConfigInfo.port = urlObj.port || 5432;
    } catch (e) { }

    console.log(`[DB] Connected to ${dbConfigInfo.database || 'unknown'} at ${dbConfigInfo.host || 'unknown'}:${dbConfigInfo.port || 'unknown'}`);
    return true;
  } catch (err) {
    dbConnected = false;
    dbError = err.message;
    console.log(`❌ PostgreSQL Connection Failed\n\nReason:\n${err.message}\n\nDatabase:\n${url.replace(/:[^:@]+@/, ":***@")}`);

    if (attempt < 5) {
      console.log(`[DB] Retrying connection in 5 seconds (Attempt ${attempt + 1}/5)...`);
      await new Promise(r => setTimeout(r, 5000));
      return connectDatabase(attempt + 1);
    }
    return false;
  }
}

async function disconnectDatabase() {
  if (postgresPool) {
    console.log("Closing PostgreSQL...");
    try {
      console.log("[DB] Disconnected");
      await postgresPool.end();
    } catch (e) { }
  }
}

function getPostgresPool() {
  return getPool();
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function getBodyLength(body) {
  if (Buffer.isBuffer(body)) return body.length;
  if (typeof body === "number" && Number.isFinite(body)) return body;
  return 0;
}

async function extractPdfTextFromBuffer(buffer) {
  const python = process.env.PYTHON || process.env.PYTHON_EXE || "python";
  const script = `
import io
import json
import sys
from pypdf import PdfReader

data = sys.stdin.buffer.read()
reader = PdfReader(io.BytesIO(data))
pages = []
for page in reader.pages:
    text = (page.extract_text() or "").strip()
    pages.append(text)

print(json.dumps({
    "pageCount": len(reader.pages),
    "pages": pages,
    "text": "\\n\\n".join([page for page in pages if page]).strip(),
}))
`.trim();

  try {
    const stdoutChunks = [];
    const stderrChunks = [];
    await new Promise((resolve, reject) => {
      const child = spawn(python, ["-c", script], { stdio: ["pipe", "pipe", "pipe"] });

      child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          const stderrText = Buffer.concat(stderrChunks).toString("utf8");
          reject(new Error(stderrText || `Python exited with code ${code}`));
        }
      });

      child.stdin.on("error", (err) => {
        console.warn("[PYTHON] stdin error (broken pipe/EOF):", err.message);
      });
      child.stdin.end(buffer);
    });

    return JSON.parse(Buffer.concat(stdoutChunks).toString("utf8"));
  } catch (error) {
    return null;
  }
}

// ── PDF PREPARATION FOR VISION (implements all 6 extraction improvements) ──
//
// Returns:
//   { fullPage, crops, vectorText, isVector }
//   fullPage  : { data: Buffer, contentType: "image/jpeg" }  — 2x full page
//   crops     : [ { label, data: Buffer, contentType } ]      — 4-6x high-res crops of dense regions
//   vectorText: string   — ground-truth text from vector PDF (empty if scanned)
//   isVector  : boolean  — true if PDF has extractable vector text
//
async function preparePdfForVision(buffer) {
  const python = process.env.PYTHON || process.env.PYTHON_EXE || "python";

  const script = `
import sys, io, json, base64
import fitz

data = sys.stdin.buffer.read()
doc = fitz.open(stream=data, filetype="pdf")
page_count = len(doc)

# ── Collect text from ALL pages ────────────────────────────────────
all_vector_text_parts = []
for pi in range(page_count):
    pg = doc[pi]
    t = pg.get_text("text").strip()
    if t:
        all_vector_text_parts.append(f"--- PAGE {pi+1} ---\\n{t}")

full_vector_text = "\\n\\n".join(all_vector_text_parts)
is_vector = len(full_vector_text) > 50

result = {}
result["isVector"] = is_vector
result["vectorText"] = full_vector_text if is_vector else ""
result["pageCount"] = page_count

# ── Per-page images ────────────────────────────────────────────────
# Page 0: full crops for detailed extraction
# Additional pages: full-page at 2x only (context)
pages_out = []

def crop_region(pg, label, x0_frac, y0_frac, x1_frac, y1_frac, scale=4.0):
    pw2, ph2 = pg.rect.width, pg.rect.height
    rect = fitz.Rect(pw2*x0_frac, ph2*y0_frac, pw2*x1_frac, ph2*y1_frac)
    mat = fitz.Matrix(scale, scale)
    clip_pix = pg.get_pixmap(matrix=mat, clip=rect)
    return {"label": label, "data": base64.b64encode(clip_pix.tobytes("jpeg")).decode()}

for pi in range(page_count):
    pg = doc[pi]
    mat2x = fitz.Matrix(2.0, 2.0)
    pix2x = pg.get_pixmap(matrix=mat2x)
    page_entry = {
        "pageIndex": pi,
        "fullPage": base64.b64encode(pix2x.tobytes("jpeg")).decode(),
        "crops": []
    }
    # Detailed crops only for pages with meaningful content (all pages if <=4, else first 4)
    if pi < 4:
        page_entry["crops"] = [
            crop_region(pg, f"p{pi}_title_block",         0.55, 0.75, 1.00, 1.00, scale=5.0),
            crop_region(pg, f"p{pi}_bom_table",           0.40, 0.60, 1.00, 0.85, scale=4.5),
            crop_region(pg, f"p{pi}_notes_block",         0.00, 0.75, 0.55, 1.00, scale=4.5),
            crop_region(pg, f"p{pi}_spec_table_top_right",0.60, 0.00, 1.00, 0.55, scale=5.0),
            crop_region(pg, f"p{pi}_dim_view_main",       0.00, 0.00, 0.65, 0.75, scale=3.5),
        ]
    pages_out.append(page_entry)

result["pages"] = pages_out
# Legacy: fullPage = first page (keeps existing callers working)
result["fullPage"] = pages_out[0]["fullPage"] if pages_out else None
result["crops"]    = pages_out[0]["crops"] if pages_out else []

print(json.dumps(result))
`.trim();

  try {
    const stdoutChunks = [];
    const stderrChunks = [];
    await new Promise((resolve, reject) => {
      const child = spawn(python, ["-c", script], { stdio: ["pipe", "pipe", "pipe"] });
      child.stdout.on("data", c => stdoutChunks.push(c));
      child.stderr.on("data", c => stderrChunks.push(c));
      child.on("error", reject);
      child.on("close", code => {
        if (code === 0) resolve();
        else reject(new Error(Buffer.concat(stderrChunks).toString("utf8")));
      });
      child.stdin.on("error", (err) => {
        console.warn("[PYTHON] stdin error (broken pipe/EOF):", err.message);
      });
      child.stdin.end(buffer);
    });

    const rawOutput = Buffer.concat(stdoutChunks).toString("utf8").trim();
    if (!rawOutput) {
      console.error("[PDF->VISION] Python produced no output — stderr was empty too");
      return { fullPage: null, crops: [], vectorText: "", isVector: false };
    }

    let result;
    try {
      result = JSON.parse(rawOutput);
    } catch (parseErr) {
      console.error(`[PDF->VISION] JSON parse failed (output was ${rawOutput.length} chars): ${parseErr.message}`);
      return { fullPage: null, crops: [], vectorText: "", isVector: false };
    }

    console.log(`[PDF->VISION] Python OK — pages:${result.pageCount}, isVector:${result.isVector}, fullPage:${!!result.fullPage}, crops:${(result.crops || []).length}, vectorText:${(result.vectorText || "").length} chars`);

    // Build per-page entries (multi-page support)
    const pages = (result.pages || []).map(p => ({
      pageIndex: p.pageIndex,
      fullPage: p.fullPage ? { data: Buffer.from(p.fullPage, "base64"), contentType: "image/jpeg" } : null,
      crops: (p.crops || []).map(c => ({
        label: c.label,
        data: Buffer.from(c.data, "base64"),
        contentType: "image/jpeg",
      })),
    }));

    return {
      // Legacy single-page accessors (still used by analyzeWithOpenAi for page 0)
      fullPage: result.fullPage
        ? { data: Buffer.from(result.fullPage, "base64"), contentType: "image/jpeg" }
        : null,
      crops: (result.crops || []).map(c => ({
        label: c.label,
        data: Buffer.from(c.data, "base64"),
        contentType: "image/jpeg",
      })),
      vectorText: result.vectorText || "",
      isVector: result.isVector || false,
      pageCount: result.pageCount || 1,
      pages,   // full multi-page data
    };
  } catch (e) {
    console.error("[PDF->VISION] preparation failed — full error:\n" + e.message);
    return { fullPage: null, crops: [], vectorText: "", isVector: false };
  }
}

// ── Startup self-test: confirm Python + fitz work before first request ──
(async () => {
  const python = process.env.PYTHON || process.env.PYTHON_EXE || "python";
  try {
    const out = await new Promise((resolve, reject) => {
      const { spawn } = require("child_process");
      const chunks = [];
      const errChunks = [];
      const child = spawn(python, ["-c", "import fitz, sys; print('fitz ' + fitz.__version__ + ' py ' + sys.version.split()[0])"], { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", d => chunks.push(d));
      child.stderr.on("data", d => errChunks.push(d));
      child.on("close", code => {
        if (code === 0) resolve(Buffer.concat(chunks).toString("utf8").trim());
        else reject(new Error(Buffer.concat(errChunks).toString("utf8").trim()));
      });
      child.on("error", reject);
    });
    console.log(`[PYTHON] Vision deps OK — ${out}`);
  } catch (err) {
    console.error(`[STARTUP] WARNING — fitz not available on ${python}`);
    console.error(`[STARTUP] Fix: run   "${python}" -m pip install pymupdf pypdf`);
    console.error(`[STARTUP] Detail: ${err.message.split("\n")[0]}`);
  }
})();

// Legacy single-image conversion (kept for non-PDF image uploads)
async function convertPdfToImage(buffer) {
  const result = await preparePdfForVision(buffer);
  return result.fullPage;
}


function parseMultipartBody(buffer, contentType) {
  const match = /boundary=([^;]+)/i.exec(contentType || "");
  if (!match) {
    return { fields: {}, file: null, files: [] };
  }

  const boundary = `--${match[1].replace(/^"|"$/g, "")}`;
  const raw = buffer.toString("latin1");
  const parts = raw.split(boundary).slice(1, -1);
  const fields = {};
  const files = [];

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = trimmed.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerText = trimmed.slice(0, headerEnd);
    const bodyText = trimmed.slice(headerEnd + 4);
    const headers = Object.fromEntries(
      headerText.split("\r\n").map((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return [line.toLowerCase(), ""];
        return [line.slice(0, idx).toLowerCase(), line.slice(idx + 1).trim()];
      })
    );

    const disposition = headers["content-disposition"] || "";
    const nameMatch = /name="([^"]+)"/i.exec(disposition);
    const filenameMatch = /filename="([^"]*)"/i.exec(disposition);
    const name = nameMatch?.[1] || "";
    const bodyBuffer = Buffer.from(bodyText.replace(/\r\n$/, ""), "latin1");

    if (filenameMatch) {
      const file = {
        fieldName: name,
        filename: filenameMatch[1],
        contentType: headers["content-type"] || "application/octet-stream",
        data: bodyBuffer,
      };
      files.push(file);
    } else if (name) {
      fields[name] = bodyText.replace(/\r\n$/, "");
    }
  }

  return { fields, file: files[0] || null, files };
}

function isImageMimeType(mimeType) {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

function guessUnit(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("mm")) return "mm";
  if (text.includes("deg") || text.includes("°")) return "deg";
  return null;
}

function normalizeFeature(feature) {
  if (!feature || typeof feature !== "object") return null;
  const name = feature.name || feature.type || "Unknown feature";
  const value = feature.value || feature.text || "To be extracted from drawing";
  const unit = feature.unit || guessUnit(value);
  return {
    name,
    value,
    unit,
    status: feature.status || "pending OCR",
    explanation: feature.explanation || feature.note || "",
    appliesTo: feature.appliesTo || feature.part || "",
  };
}

function normalizeDimension(dimension) {
  if (!dimension || typeof dimension !== "object") return null;
  const rawValue = dimension.value || dimension.text || "To be extracted from drawing";
  return {
    name: dimension.name || dimension.label || "Unnamed dimension",
    value: rawValue,
    unit: dimension.unit || guessUnit(rawValue) || null,
    tolerance: dimension.tolerance || dimension.plusMinus || dimension.limit || null,
    appliesTo: dimension.appliesTo || dimension.subpart || dimension.feature || "",
    explanation: dimension.explanation || dimension.reason || dimension.note || "",
    status: dimension.status || "pending OCR",
  };
}

function normalizeSubpart(subpart) {
  if (!subpart || typeof subpart !== "object") return null;
  const dimensions = Array.isArray(subpart.dimensions)
    ? subpart.dimensions.map(normalizeDimension).filter(Boolean)
    : [];
  const notes = Array.isArray(subpart.notes)
    ? subpart.notes.filter(Boolean)
    : subpart.note
      ? [subpart.note]
      : [];

  return {
    name: subpart.name || subpart.label || "Unnamed subpart",
    quantity: Number.isFinite(Number(subpart.quantity)) ? Number(subpart.quantity) : 1,
    description: subpart.description || subpart.purpose || "",
    function: subpart.function || subpart.role || "",
    dimensions,
    notes,
    confidence: subpart.confidence || "medium",
  };
}

function extractEngineeringSignals(text) {
  const source = String(text || "");
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const dimPatterns = [
    { name: "Outer Diameter", regex: /(?:OD|outer diameter|diameter|Ø)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(mm|inch|in|deg))?(?:\s*([±+\-]\s*[0-9]+(?:\.[0-9]+)?))?/i, unit: "mm" },
    { name: "Length", regex: /(?:length|overall length|l)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(mm|inch|in|deg))?(?:\s*([±+\-]\s*[0-9]+(?:\.[0-9]+)?))?/i, unit: "mm" },
    { name: "Thickness", regex: /(?:thickness|t)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(mm|inch|in|deg))?(?:\s*([±+\-]\s*[0-9]+(?:\.[0-9]+)?))?/i, unit: "mm" },
    { name: "Thread", regex: /(M\d+(?:\s*X\s*[0-9.]+)?)/i, unit: null },
    { name: "Tolerance", regex: /(±\s*[0-9]+(?:\.[0-9]+)?)/, unit: null },
    { name: "Material", regex: /(?:material)\s*[:=]?\s*([A-Z0-9\-+/ ]{2,})/i, unit: null },
  ];

  const dimensions = [];
  const seen = new Set();
  for (const pattern of dimPatterns) {
    const match = source.match(pattern.regex);
    if (!match) continue;
    const rawValue = match[1] || match[0];
    const unit = match[2] || pattern.unit || guessUnit(rawValue);
    const tolerance = match[3] || null;
    const key = `${pattern.name}:${rawValue}:${unit || ""}:${tolerance || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dimensions.push({
      name: pattern.name,
      value: rawValue,
      unit,
      tolerance,
      appliesTo: pattern.name === "Material" ? "entire part" : "main body",
      explanation:
        pattern.name === "Material"
          ? "Material specification extracted from the document text."
          : "Detected as a dimension or callout from the uploaded content.",
      status: "extracted",
    });
  }

  const subparts = [];
  const splitCandidates = [
    { name: "Main body", description: "Primary body mentioned or implied by the document.", function: "Carries the main geometry." },
    { name: "Hole pattern", description: "Repeated holes or circular features.", function: "Provides mounting or clearance." },
    { name: "Threaded feature", description: "Threaded region or fastener interface.", function: "Provides threaded engagement." },
    { name: "Title block", description: "Drawing metadata and document control area.", function: "Stores drawing identification." },
  ];

  for (const candidate of splitCandidates) {
    const keyword = candidate.name === "Hole pattern" ? /hole|holes|circle|circular|Ø/i
      : candidate.name === "Threaded feature" ? /thread|m\d+/i
        : candidate.name === "Title block" ? /title block|revision|scale|sheet/i
          : /part|component|body|shaft|housing|assembly/i;
    if (keyword.test(source) || candidate.name === "Title block") {
      subparts.push({
        name: candidate.name,
        quantity: candidate.name === "Hole pattern" ? Math.max((source.match(/hole/gi) || []).length, 1) : 1,
        description: candidate.description,
        function: candidate.function,
        dimensions: dimensions
          .filter((dimension) => {
            if (candidate.name === "Title block") return false;
            if (candidate.name === "Hole pattern") return /hole|Ø|diameter/i.test(dimension.name + " " + dimension.value);
            if (candidate.name === "Threaded feature") return /thread|m\d+/i.test(dimension.name + " " + dimension.value);
            return true;
          })
          .slice(0, 4),
        notes: candidate.name === "Title block"
          ? ["Document control details should be verified against the original file."]
          : ["Interpretation is heuristic and should be confirmed by an engineer."],
        confidence: "medium",
      });
    }
  }

  const title = lines[0] || "Engineering Drawing";
  const titleBlock = {
    drawingNumber: lines.find((line) => /drawing\s*no|dwg|drg/i.test(line)) || null,
    revision: lines.find((line) => /revision|rev\b/i.test(line)) || null,
    scale: lines.find((line) => /scale/i.test(line)) || null,
    units: /mm/i.test(source) ? "mm" : /inch| in\b/i.test(source) ? "inch" : "unknown",
    sheet: lines.find((line) => /sheet/i.test(line)) || null,
    customer: lines.find((line) => /customer|client/i.test(line)) || null,
    materialStandard: lines.find((line) => /iso|astm|din|jis|ansi/i.test(line)) || null,
  };

  return {
    title,
    titleBlock,
    dimensions,
    subparts,
    features: dimensions.map((dimension) => ({
      name: dimension.name,
      value: dimension.value,
      unit: dimension.unit,
      status: dimension.status,
      explanation: dimension.explanation,
      appliesTo: dimension.appliesTo,
    })),
    understanding:
      lines.length > 6
        ? "The document appears to be an engineering drawing or an engineering-drawing-related technical document with OCR-like content."
        : "The document contains limited text, so only a light interpretation was possible.",
  };
}

function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function analyzeWithOpenAi({
  file,
  notes,
  route,
  method,
  receivedBytes,
  sourceContentType,
  extractedText,
  extractedPageCount,
  crops,
  vectorText,
  extraPages,   // array of {pageIndex, fullPage, crops} for pages 1+
}) {
  try {
    if (!file) {
      return null;
    }

    const isImage = isImageMimeType(file.contentType);
    const isPdf = file.contentType === "application/pdf" || isImage; // treat rendered PDF page as image
    if (!isImage && file.contentType !== "application/pdf") {
      return null;
    }
    // ── AI prompt ────────────────────────────────────────────────────
    const userNotesEscaped = String(notes || "").replace(/"/g, '\\"');
    const fileTypeNote = "File type: engineering drawing image (rendered from PDF at high resolution). Read every visible element directly from the image.";

    const schemaExample = JSON.stringify({
      standardED: {
        standardEdId: "string",
        title: "full assembly or part name as written on the drawing",
        source: { route: "__ROUTE__", method: "__METHOD__", contentType: "__CT__", receivedBytes: 0, filename: "__FILE__" },
        titleBlock: {
          drawingNumber: "string or null", revision: "string or null",
          projection: "1st angle | 3rd angle | null",
          units: "mm | inch | mixed | unknown", sheet: "string or null",
          customer: "string or null", materialStandard: "string or null",
          generalTolerances: "e.g. ISO 2768-m or null", surfaceFinish: "default finish callout or null",
          drawnBy: "string or null", checkedBy: "string or null", approvedBy: "string or null",
          date: "string or null", scale: "string or null", totalWeight: "string or null"
        },
        assembly: {
          description: "one sentence: what this assembly does",
          material: "assembly-level material or null", finish: "assembly-level finish or null"
        },
        assembledProduct: {
          description: "describe the fully assembled product — its shape, function, and how the parts fit together",
          overallDimensions: [
            { name: "Overall Height / Length", value: "101.95", unit: "mm", tolerance: "102.00", note: "total assembled height" },
            { name: "Cross Span Width", value: "90.80", unit: "mm", tolerance: "90.95", note: "span across trunnions" },
            { name: "Overall Depth", value: "56.85", unit: "mm", tolerance: "90.96", note: "assembled depth" }
          ],
          bore: "central bore or inner cavity diameter if applicable, else null",
          hollowness: "describe any hollow sections, internal cavities, internal geometry of the assembled product, else null",
          weight: "product total weight as stated on drawing, else null",
          grease: "grease type, grade, colour if specified, else null",
          unspecifiedTolerances: [
            { range: "5-6 mm", tolerance: "±0.1" },
            { range: "6-30 mm", tolerance: "±0.2" },
            { range: "30-120 mm", tolerance: "±0.3" },
            { range: "120-315 mm", tolerance: "±0.5" },
            { range: ">315 mm", tolerance: "±0.8" }
          ],
          hardnessTable: [
            { part: "Cross", surfaceHRC: "57-62", coreHRC: "30-40", caseDepthMm: "0.8-1.20" },
            { part: "Cup", surfaceHRC: "54-60", coreHRC: null, caseDepthMm: "0.65-0.95" },
            { part: "Roller", surfaceHRC: "58-64", coreHRC: null, caseDepthMm: null },
            { part: "Circlip", surfaceHRC: "47-54", coreHRC: null, caseDepthMm: null }
          ],
          specificationOfSize: [
            { name: "Roller Diameter", value: "Ø2.5 -0.008", unit: "mm" },
            { name: "Roller Length", value: "19.80 ±0.05", unit: "mm" },
            { name: "Seal ID (Green)", value: "Ø23.60 - Ø23.70", unit: "mm" },
            { name: "Seal OD (White)", value: "Ø37.50 - Ø37.60", unit: "mm" },
            { name: "Seal Thickness (Green)", value: "4.20 - 4.25", unit: "mm" },
            { name: "Grease Nipple Thread Size", value: "M10X1", unit: null },
            { name: "Circlip Thickness", value: "2.5 ±0.05", unit: "mm" },
            { name: "Grease Grade", value: "MPG-2", unit: null },
            { name: "Grease Colour", value: "Red", unit: null }
          ]
        },
        partslist: [
          { itemNo: "1", partNumber: null, description: "Cross", quantity: 1, material: "20MnCr5 / 16MnCr5", notes: "forged billet machined" },
          { itemNo: "2", partNumber: null, description: "Bearing Bush", quantity: 4, material: "20Mn Cr5", notes: null },
          { itemNo: "3", partNumber: null, description: "Roller", quantity: "33x4=132", material: "SAE 52100", notes: null },
          { itemNo: "4", partNumber: null, description: "Oil Seal", quantity: 4, material: "NBR", notes: null },
          { itemNo: "5", partNumber: null, description: "Grease Nipple", quantity: 1, material: "STEEL-M610240", notes: null },
          { itemNo: "6", partNumber: null, description: "Circlip", quantity: 4, material: "EN42J", notes: null }
        ],
        subparts: [
          {
            name: "Cross",
            itemNo: "1", quantity: 1,
            material: "20MnCr5 / 16MnCr5", finish: "Self Finish",
            description: "Central cross body with 4 trunnions — primary structural element",
            dimensions: [
              { name: "Trunnion Diameter", value: "Ø23.83", unit: "mm", tolerance: "±0.01", note: "controls bearing bush fit" },
              { name: "Thread", value: "M10X1", unit: null, tolerance: null, note: "grease nipple thread" },
              { name: "Cross Span", value: "101.95-102.00", unit: "mm", tolerance: null, note: "overall cross length" }
            ],
            geometricTolerances: [],
            surfaceFinish: null,
            manufacturingNotes: ["Surface HRC: 57-62", "Core HRC: 30-40", "Cross ECD: 0.8-1.20mm"]
          },
          {
            name: "REPEAT — add one object per BOM row",
            itemNo: "2", quantity: 4,
            material: "20Mn Cr5", finish: null,
            description: "Bearing bush housing the needle rollers",
            dimensions: [
              { name: "Outer Diameter", value: "Ø38.045", unit: "mm", tolerance: "±0.01", note: "housing bore fit" },
              { name: "Inner Diameter", value: "Ø28.87-Ø28.92", unit: "mm", tolerance: null, note: "roller running surface" }
            ],
            geometricTolerances: [],
            surfaceFinish: null,
            manufacturingNotes: ["Surface HRC: 54-60", "Cup ECD: 0.65-0.95mm"]
          }
        ],
        assemblyDimensions: [
          { name: "Circlip Groove Diameter", value: "32.0", unit: "mm", tolerance: "±0.5", note: "circlip seating diameter" }
        ],
        generalNotes: ["IF IN DOUBT DO NOT SCALE THE DRAWING", "DIMENSIONS ARE IN MM", "TRACEABILITY DETAILS AS PER RAP STD"],
        summary: "2-3 sentences: assembled product description, total parts count, key materials, critical dimensions"
      }
    }, null, 2);

    const prompt = [
      "You are an expert mechanical engineer reading an engineering assembly drawing.",
      "Extract EVERY piece of information visible on this drawing. A machinist must be able to re-create the full assembly from your output alone.",
      "User notes: \"" + userNotesEscaped + "\"",
      fileTypeNote,
      "",
      "EXTRACTION RULES:",
      "1. assembledProduct: Extract ALL overall/envelope dimensions of the FULLY ASSEMBLED product — height, width, depth, bore, span, hollow sections, weight, grease spec, unspecified tolerance table, hardness table, specification-of-size table.",
      "2. partslist: Extract EVERY row from the BOM/parts list table — item no, part number, description, material, quantity, any notes.",
      "3. subparts: ONE object per BOM row. For EACH part extract ALL visible dimensions — OD, ID, length, width, thickness, thread, groove diameter, groove width, chamfer, radius, PCD, hole diameter, hole count, bore, etc.",
      "4. Standard parts (bearings, seals, circlips, bolts, washers): still extract their dimensions from the drawing — diameter, bore, width, thread, length.",
      "5. SPECIFICATION OF SIZE table: put each row into assembledProduct.specificationOfSize.",
      "6. HEAT TREATMENT / HARDNESS table: put each row into assembledProduct.hardnessTable AND also into the relevant subpart's manufacturingNotes.",
      "7. UNSPECIFIED TOLERANCES table: put each row into assembledProduct.unspecifiedTolerances.",
      "8. DIMENSION LINES: read value, unit (mm/inch/deg), tolerance.",
      "9. LEADER LINES / CALLOUTS: full text e.g. M10X1, R5, 2x Dia8 DRILL.",
      "10. SECTION VIEWS (A-A etc): extract dims, note the section.",
      "11. TITLE BLOCK: drawing number, revision, units, sheet, drawn by, date, scale, total weight.",
      "12. GREASE type, grade, colour if shown.",
      "13. assemblyDimensions: dims that belong to the assembly level, not a single part.",
      "14. generalNotes: every note/instruction visible on the drawing including surface finish callouts.",
      "",
      "OUTPUT RULES:",
      "- Only output what is actually visible. Do not invent values.",
      "- subparts count MUST equal BOM rows count.",
      "- Return valid JSON only. No markdown fences. No extra keys.",
      "",
      "Return exactly this JSON shape with all fields populated from the drawing:",
      schemaExample
    ].join("\n");


    // ── Build Gemini vision parts (two-step prompt + crops + vector text) ──
    const geminiParts = [];

    // STEP A: visual survey prompt (forces full visual pass before extraction)
    const stepAPrompt = [
      "You are an expert mechanical engineer reading an engineering drawing.",
      "STEP A — VISUAL SURVEY (do this before any extraction):",
      "Carefully examine the full-page image and ALL high-resolution crop images provided.",
      "List in plain language every distinct visual region you can see on this drawing:",
      "- Each orthographic/section view (name them: front view, section A-A, detail view, etc.)",
      "- Each table (BOM, specification of size, hardness/heat treatment, tolerance, revision block)",
      "- Title block location and contents",
      "- Notes block / general notes",
      "- Any GD&T feature control frames (boxed symbols)",
      "- Any surface finish symbols (checkmark/tick style with Ra value)",
      "- Any thread/fit callouts (e.g. M10x1.5-6H, H7/g6)",
      "- Any symbols or callouts that are small or hard to read — describe them anyway",
      "After your survey, proceed to STEP B extraction.",
      "",
      "STEP B — STRUCTURED EXTRACTION:",
      "Using BOTH the full-page image AND the high-resolution crops as authoritative sources,",
      "extract all information. The crops show fine detail — use them for small text, symbols, and tables.",
      "",
      "SPECIFICALLY HUNT FOR (even if no obvious section contains them):",
      "- Feature control frames: boxed GD&T symbol + tolerance value + datum letters (e.g. flatness ⊡0.05 A)",
      "- Surface finish symbols: checkmark-style tick marks with Ra/Rz values (e.g. Ra 1.6, Ra 3.2)",
      "- Thread/fit callouts: M[d]x[p]-[class] or H7/g6 style fits",
      "- Note labels followed by a table or box — extract the adjacent value, not just the label",
      "- Unspecified tolerance table (ranges like 0-10, 10-30, 30-100 with ± values)",
      "- Heat treatment / hardness table (HRC values per part)",
      "- Specification of size table",
      "If any symbol is visually present but unclear, include it with confidence: 'partially visible'",
      "",
      "CONFIDENCE TAGGING — for each extracted dimension/value add a 'confidence' field:",
      "  'clear'             — value is crisply readable",
      "  'partially visible' — value is present but blurry/cut off (prefix value with ~)",
      "  'inferred'          — value not directly readable, inferred from context",
      "",
      "User notes: \"" + userNotesEscaped + "\"",
    ].join("\n");

    // Full-page image (2x — spatial context)
    geminiParts.push({ text: stepAPrompt });
    geminiParts.push({ inline_data: { mime_type: file.contentType, data: file.data.toString("base64") } });

    // High-res crops (4-6x — detail accuracy)
    const cropsToSend = (crops || []).slice(0, 6); // cap at 6 crops to stay within token limits
    for (const crop of cropsToSend) {
      geminiParts.push({ text: `HIGH-RES CROP — ${crop.label} (use this as authoritative source for fine detail in this region):` });
      geminiParts.push({ inline_data: { mime_type: crop.contentType, data: crop.data.toString("base64") } });
    }

    // Additional pages (multi-page PDFs) — send full-page image for each extra sheet
    const extraPagesToSend = (extraPages || []).slice(0, 3); // cap at 3 extra pages
    for (const pg of extraPagesToSend) {
      if (pg.fullPage) {
        geminiParts.push({ text: `ADDITIONAL SHEET — Page ${pg.pageIndex + 1} (extract all information from this sheet too):` });
        geminiParts.push({ inline_data: { mime_type: pg.fullPage.contentType, data: pg.fullPage.data.toString("base64") } });
        // Also send crops for additional pages
        for (const crop of (pg.crops || []).slice(0, 3)) {
          geminiParts.push({ text: `CROP from page ${pg.pageIndex + 1} — ${crop.label}:` });
          geminiParts.push({ inline_data: { mime_type: crop.contentType, data: crop.data.toString("base64") } });
        }
      }
    }

    // Vector text cross-check (if available from vector PDF)
    if (vectorText) {
      geminiParts.push({ text: `VECTOR TEXT (ground-truth text extracted directly from PDF — use to cross-check your visual extraction, especially for numbers and labels):\n<<<\n${vectorText}\n>>>` });
    } else if (extractedText) {
      geminiParts.push({ text: `EXTRACTED PDF TEXT (use as supplementary reference):\n<<<\n${extractedText}\n>>>` });
    }

    // Final extraction schema instruction
    geminiParts.push({ text: "Now return the complete extraction as valid JSON matching this exact schema:\n" + schemaExample });

    // ── Try Gemini models in sequence ────────────────────────────────
    if (aiApiKey) {
      for (const geminiModel of geminiModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${aiApiKey}`;
          console.log(`[AI] Trying Gemini (${geminiModel}) with ${cropsToSend.length} crops...`);

          // Try up to 2 times per model for 503
          for (let attempt = 1; attempt <= 2; attempt++) {
            const geminiRes = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: geminiParts }],
                generationConfig: { temperature: 0, responseMimeType: "application/json" },
              }),
            });

            if (geminiRes.ok) {
              const json = await geminiRes.json();
              const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
              const parsed = extractJsonObject(content);
              if (parsed) {
                console.log(`[AI] Gemini succeeded (${geminiModel}).`);
                if (!parsed.ocrSummary) parsed.ocrSummary = "";
                if (!Array.isArray(parsed.ocrHighlights)) parsed.ocrHighlights = [];
                return parsed;
              }
              break;
            } else {
              const errText = await geminiRes.text();
              if (geminiRes.status === 503 && attempt < 2) {
                console.warn(`[AI] Gemini ${geminiModel} 503, retrying in 4s...`);
                await new Promise(r => setTimeout(r, 4000));
                continue;
              }
              if (geminiRes.status !== 429 && geminiRes.status !== 503 && geminiRes.status !== 404) {
                throw new Error(`Gemini request failed (${geminiRes.status}): ${errText}`);
              }
              console.warn(`[AI] Gemini ${geminiModel} unavailable (${geminiRes.status}), trying next...`);
              break;
            }
          }
        } catch (err) {
          if (!err.message.includes("429") && !err.message.includes("503") && !err.message.includes("quota")) throw err;
          console.warn(`[AI] Gemini ${geminiModel} error:`, err.message);
        }
      }
      console.warn("[AI] All Gemini models failed. Falling back to Ollama...");
    }

    // ── Fallback: Ollama llama3.2 (text only — llava needs too much RAM) ───
    const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
    const ollamaModel = process.env.OLLAMA_TEXT_MODEL || "llama3.2";
    console.log(`[AI] Using Ollama (${ollamaModel}) with extracted text...`);

    const extractedBlock = extractedText || "No selectable text could be extracted.";
    const userMessageContent = [
      { type: "text", text: prompt + `\n\nPDF text:\n<<<\n${extractedBlock}\n>>>` }
    ];

    try {
      const ollamaRes = await fetch(`${ollamaHost}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(120000), // 2 min — if llama3.2 takes longer it's stalled
        body: JSON.stringify({
          model: ollamaModel,
          temperature: 0,
          stream: false,
          messages: [
            { role: "system", content: "You are a precise engineering drawing extraction engine. Return valid JSON only." },
            { role: "user", content: userMessageContent },
          ],
        }),
      });

      if (!ollamaRes.ok) {
        const errorText = await ollamaRes.text();
        console.warn(`[AI] Ollama failed (${ollamaRes.status}): ${errorText.slice(0, 200)}`);
        return null;
      }

      const ollamaJson = await ollamaRes.json();
      const ollamaContent = ollamaJson?.choices?.[0]?.message?.content;
      const parsed = extractJsonObject(ollamaContent);
      if (!parsed) {
        console.warn("[AI] Ollama response did not contain valid JSON — using signal extraction fallback.");
        return null;
      }
      if (!parsed.ocrSummary) parsed.ocrSummary = "";
      if (!Array.isArray(parsed.ocrHighlights)) parsed.ocrHighlights = [];
      return parsed;
    } catch (ollamaErr) {
      const isTimeout = ollamaErr?.name === "TimeoutError" || ollamaErr?.name === "AbortError";
      console.warn(`[AI] Ollama ${isTimeout ? "timed out" : "error"}: ${ollamaErr.message?.split("\n")[0]}`);
      if (!isTimeout) console.warn("[AI] Is Ollama running? Start it with: ollama serve");
      return null; // fall through to signal-extraction fallback in caller
    }
  } catch (err) {
    console.warn("[AI] Analysis pipeline failed:", err?.message || err);
    return null;
  }
}

const routes = new Set(["/", "/docs", "/openapi.json", "/health", "/api/health", "/v1/health", "/analyze", "/upload", "/process", "/api/analyze"]);

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function truncateText(value, maxChars) {
  const text = String(value || ""); if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "...";
}
function formatTableLines(headers, rows, widths) {
  const actualWidths = headers.map((h, i) => {
    const rowMax = rows.reduce((m, r) => Math.max(m, String(r[i] ?? "").length), 0);
    return widths?.[i] || Math.min(Math.max(h.length, rowMax, 8), 28);
  });
  const renderRow = (cells) => cells.map((c, i) => truncateText(String(c ?? ""), actualWidths[i]).padEnd(actualWidths[i], " ")).join(" | ");
  const sep = actualWidths.map(w => "-".repeat(w)).join("-+-");
  return [renderRow(headers), sep, ...rows.map(renderRow)];
}

// Helper to authenticate JWT token from Authorization header.
// Returns the decoded user payload if valid, otherwise sends 401 and returns null.
function authenticateRequest(req, res) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    sendJson(res, 401, { error: "Access denied. Token missing." });
    return null;
  }

  try {
    const secret = process.env.JWT_SECRET || "super_secret_jwt_key";
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (err) {
    sendJson(res, 401, { error: "Access denied. Invalid or expired token." });
    return null;
  }
}

function compareDocuments(documents) {
  if (!Array.isArray(documents) || documents.length < 2) return null;
  const left = documents[0]; const right = documents[1];
  const leftEd = left?.standardED || {}; const rightEd = right?.standardED || {};
  const leftDims = Array.isArray(leftEd.dimensions) ? leftEd.dimensions : [];
  const rightDims = Array.isArray(rightEd.dimensions) ? rightEd.dimensions : [];
  const leftSubparts = Array.isArray(leftEd.subparts) ? leftEd.subparts : [];
  const rightSubparts = Array.isArray(rightEd.subparts) ? rightEd.subparts : [];
  const leftDimMap = new Map(leftDims.map(i => [normalizeKey(i.name), i]));
  const rightDimMap = new Map(rightDims.map(i => [normalizeKey(i.name), i]));
  const leftSubMap = new Map(leftSubparts.map(i => [normalizeKey(i.name), i]));
  const rightSubMap = new Map(rightSubparts.map(i => [normalizeKey(i.name), i]));
  const dimensionKeys = new Set([...leftDimMap.keys(), ...rightDimMap.keys()]);
  const subpartKeys = new Set([...leftSubMap.keys(), ...rightSubMap.keys()]);
  const dimensionRows = []; const onlyLeftDimensions = []; const onlyRightDimensions = [];
  for (const key of dimensionKeys) {
    const l = leftDimMap.get(key); const r = rightDimMap.get(key);
    const lv = l ? `${l.value}${l.unit ? ` ${l.unit}` : ""}${l.tolerance ? ` ${l.tolerance}` : ""}` : `-`;
    const rv = r ? `${r.value}${r.unit ? ` ${r.unit}` : ""}${r.tolerance ? ` ${r.tolerance}` : ""}` : `-`;
    const st = l && r ? (normalizeKey(l.value) === normalizeKey(r.value) ? "shared" : "different") : l ? "only left" : "only right";
    dimensionRows.push([l?.name || r?.name || key, lv, rv, st]);
    if (l && !r) onlyLeftDimensions.push(l.name);
    if (r && !l) onlyRightDimensions.push(r.name);
  }
  const subpartRows = []; const onlyLeftSubparts = []; const onlyRightSubparts = [];
  for (const key of subpartKeys) {
    const l = leftSubMap.get(key); const r = rightSubMap.get(key);
    const st = l && r ? "shared" : l ? "only left" : "only right";
    subpartRows.push([l?.name || r?.name || key, l ? `x${l.quantity || 1}` : "-", r ? `x${r.quantity || 1}` : "-", st]);
    if (l && !r) onlyLeftSubparts.push(l.name);
    if (r && !l) onlyRightSubparts.push(r.name);
  }
  const sp = [];
  if (onlyRightDimensions.length) sp.push(`Doc 2 adds ${onlyRightDimensions.join(", ")}`);
  if (onlyLeftDimensions.length) sp.push(`Doc 1 has extra ${onlyLeftDimensions.join(", ")}`);
  if (onlyRightSubparts.length) sp.push(`Doc 2 adds subparts ${onlyRightSubparts.join(", ")}`);
  if (onlyLeftSubparts.length) sp.push(`Doc 1 has subparts ${onlyLeftSubparts.join(", ")}`);
  return {
    documents: [{ fileName: left.fileName, title: leftEd.title }, { fileName: right.fileName, title: rightEd.title }],
    summary: sp.length ? sp.join(". ") : "The two files share the same visible dimensions and subparts.",
    dimensions: { headers: ["Dimension", "Doc 1", "Doc 2", "Status"], rows: dimensionRows },
    subparts: { headers: ["Subpart", "Doc 1 Qty", "Doc 2 Qty", "Status"], rows: subpartRows },
    uniqueToDoc2: { dimensions: onlyRightDimensions, subparts: onlyRightSubparts },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  const origin = req.headers.origin || "http://localhost:5173";
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true"
    });
    res.end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  const protectedPrefixes = [
    "/api/analyze",
    "/api/drawings",
    "/api/upload",
    "/api/machines",
    "/api/routing",
    "/api/bom",
    "/api/costing",
    "/api/rfq"
  ];

  const isProtected = protectedPrefixes.some(prefix => url.pathname.startsWith(prefix));
  if (isProtected) {
    let authOk = false;
    authMiddleware(req, res, () => { authOk = true; });
    if (!authOk) return; // Middleware halted the request
  }

  if (["/health", "/api/health", "/v1/health"].includes(url.pathname)) {
    let dbStatus = {};
    if (dbConnected) {
      dbStatus = {
        connected: true,
        host: dbConfigInfo.host || "localhost",
        database: dbConfigInfo.database || "rfq",
        port: parseInt(dbConfigInfo.port || 5433)
      };
    } else {
      dbStatus = {
        connected: false,
        error: dbError || "Not connected"
      };
    }

    sendJson(res, 200, {
      status: "ok",
      database: dbStatus,
      python: true,
      gemini: !!aiApiKey,
      uptime: process.uptime(),
      memory: {
        rss: process.memoryUsage().rss
      },
      timestamp: new Date().toISOString()
    });
    return;
  }

  // ── POST /api/auth/signup ──────────────────────────────────────
  if (url.pathname === "/api/auth/signup" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { name, email, password } = body;
      if (!name || !email || !password) {
        return sendJson(res, 400, { error: "Name, email, and password are required." });
      }
      const pool = getPostgresPool();
      if (!pool) return sendJson(res, 500, { error: "Database not connected." });

      const crypto = require("crypto");
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
      const passwordHash = `${salt}:${hash}`;

      await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
        [name, email, passwordHash]
      );
      sendJson(res, 201, { success: true, message: "User created successfully." });
    } catch (err) {
      if (err.code === "23505") { // unique_violation
        sendJson(res, 400, { error: "Email already in use." });
      } else {
        console.error("Signup error:", err);
        sendJson(res, 500, { error: "Internal server error." });
      }
    }
    return;
  }

  // ── POST /api/auth/login or /login ──────────────────────────────
  if ((url.pathname === "/api/auth/login" || url.pathname === "/login") && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { email, password } = body;
      if (!email || !password) {
        return sendJson(res, 400, { error: "Email and password are required." });
      }

      // IP-based Rate limiting for login
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const rateLimitKey = `login:${ip}`;
      const rateLimit = checkRateLimit(rateLimitKey, 5, 60 * 1000); // 5 attempts per minute
      if (rateLimit.limited) {
        return sendJson(res, 429, { error: "Too many login attempts. Please try again later." });
      }

      const pool = getPostgresPool();
      if (!pool) return sendJson(res, 500, { error: "Database not connected." });

      const dbRes = await pool.query("SELECT id, name, password_hash, last_otp_verified FROM users WHERE email = $1", [email]);
      if (dbRes.rows.length === 0) {
        return sendJson(res, 401, { error: "Invalid email or password." });
      }

      const user = dbRes.rows[0];
      const crypto = require("crypto");
      const [salt, hash] = user.password_hash.split(":");
      const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");

      if (hash !== verifyHash) {
        return sendJson(res, 401, { error: "Invalid email or password." });
      }

      // Check if user verified OTP within the last 24 hours
      if (user.last_otp_verified) {
        const lastVerifiedTime = new Date(user.last_otp_verified).getTime();
        const hours24 = 24 * 60 * 60 * 1000;
        if (Date.now() - lastVerifiedTime < hours24) {
          const token = jwt.sign(
            { id: user.id, email, name: user.name },
            process.env.JWT_SECRET || "super_secret_jwt_key",
            { expiresIn: "24h" }
          );
          return sendJson(res, 200, {
            success: true,
            token,
            user: { id: user.id, name: user.name, email }
          });
        }
      }

      // Generate secure 6-digit numeric OTP
      const otp = generateOTP();

      // Store in temporary cache (valid for 5 mins, resets any previous OTP and expiry timer)
      otpCache.setOTP(email, otp);

      // Send OTP to user's registered email
      try {
        await sendOTPEmail(email, otp);
      } catch (emailErr) {
        console.error("⚠️ Failed to send OTP email via SMTP:", emailErr.message);
        console.log(`🔑 [DEV MODE] OTP generated for login: ${otp}`);
      }

      sendJson(res, 200, { success: true, message: "OTP sent" });
    } catch (err) {
      console.error("Login error:", err);
      sendJson(res, 500, { error: "Internal server error.", details: err.message, stack: err.stack });
    }
    return;
  }

  // ── POST /api/auth/verify-otp or /verify-otp ───────────────────
  if ((url.pathname === "/api/auth/verify-otp" || url.pathname === "/verify-otp") && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { email, otp } = body;
      if (!email || !otp) {
        return sendJson(res, 400, { error: "Email and OTP are required." });
      }

      // IP-based Rate limiting for verification
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const rateLimitKey = `verify:${ip}`;
      const rateLimit = checkRateLimit(rateLimitKey, 10, 60 * 1000); // 10 attempts per minute
      if (rateLimit.limited) {
        return sendJson(res, 429, { error: "Too many verification attempts. Please try again later." });
      }

      const cachedEntry = otpCache.getOTP(email);
      if (!cachedEntry) {
        return sendJson(res, 400, { error: "OTP has expired or does not exist. Please request a new code." });
      }

      // Max 3 incorrect attempts verification check
      if (cachedEntry.attempts >= 3) {
        otpCache.deleteOTP(email);
        return sendJson(res, 400, { error: "Too many failed attempts. This OTP has been invalidated. Please request a new one." });
      }

      if (cachedEntry.otp !== String(otp).trim()) {
        otpCache.incrementAttempts(email);
        const remaining = 3 - (cachedEntry.attempts + 1);
        if (remaining <= 0) {
          otpCache.deleteOTP(email);
          return sendJson(res, 400, { error: "Too many failed attempts. This OTP has been invalidated. Please request a new one." });
        }
        return sendJson(res, 400, { error: `Invalid OTP. You have ${remaining} attempts remaining.` });
      }

      // OTP is valid - delete immediately
      otpCache.deleteOTP(email);

      const pool = getPostgresPool();
      if (!pool) return sendJson(res, 500, { error: "Database not connected." });

      const dbRes = await pool.query("SELECT id, name FROM users WHERE email = $1", [email]);
      if (dbRes.rows.length === 0) {
        return sendJson(res, 404, { error: "User not found." });
      }

      const user = dbRes.rows[0];

      // Record successful OTP verification
      await pool.query("UPDATE users SET last_otp_verified = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email, name: user.name },
        process.env.JWT_SECRET || "super_secret_jwt_key",
        { expiresIn: "24h" }
      );

      sendJson(res, 200, {
        success: true,
        token,
        user: { id: user.id, name: user.name, email }
      });
    } catch (err) {
      console.error("Verify OTP error:", err);
      sendJson(res, 500, { error: "Internal server error." });
    }
    return;
  }

  // ── POST /api/auth/resend-otp or /resend-otp ───────────────────
  if ((url.pathname === "/api/auth/resend-otp" || url.pathname === "/resend-otp") && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { email } = body;
      if (!email) {
        return sendJson(res, 400, { error: "Email is required." });
      }

      // Email-based rate limit for resending (max 1 request per 30 seconds)
      const rateLimitKey = `resend:${email.toLowerCase().trim()}`;
      const rateLimit = checkRateLimit(rateLimitKey, 1, 30 * 1000);
      if (rateLimit.limited) {
        return sendJson(res, 429, { error: "Please wait 30 seconds before requesting another OTP." });
      }

      const pool = getPostgresPool();
      if (!pool) return sendJson(res, 500, { error: "Database not connected." });

      const dbRes = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (dbRes.rows.length === 0) {
        return sendJson(res, 404, { error: "User not found." });
      }

      // Invalidate previous OTP and generate new one
      const otp = generateOTP();
      otpCache.setOTP(email, otp);

      // Send OTP to email
      try {
        await sendOTPEmail(email, otp);
      } catch (emailErr) {
        console.error("⚠️ Failed to resend OTP email via SMTP:", emailErr.message);
        console.log(`🔑 [DEV MODE] OTP generated for resend: ${otp}`);
      }

      sendJson(res, 200, { success: true, message: "OTP resent" });
    } catch (err) {
      console.error("Resend OTP error:", err);
      sendJson(res, 500, { error: "Internal server error." });
    }
    return;
  }

  // ── POST /api/auth/forgot-password ───────────────────
  if ((url.pathname === "/api/auth/forgot-password" || url.pathname === "/forgot-password") && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { email } = body;
      if (!email) return sendJson(res, 400, { error: "Email is required." });

      const rateLimitKey = `forgot:${email.toLowerCase().trim()}`;
      const rateLimit = checkRateLimit(rateLimitKey, 2, 60 * 1000); // 2 per minute
      if (rateLimit.limited) return sendJson(res, 429, { error: "Too many requests. Please wait." });

      const pool = getPostgresPool();
      if (!pool) return sendJson(res, 500, { error: "Database not connected." });

      const dbRes = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (dbRes.rows.length === 0) {
        // Pretend it succeeded to prevent email enumeration
        return sendJson(res, 200, { success: true, message: "If an account exists, an OTP was sent." });
      }

      const otp = generateOTP();
      otpCache.setOTP(email, otp);

      try {
        await sendOTPEmail(email, otp);
      } catch (emailErr) {
        console.error("⚠️ Failed to send forgot password OTP email via SMTP:", emailErr.message);
        console.log(`🔑 [DEV MODE] OTP generated for password reset: ${otp}`);
      }

      sendJson(res, 200, { success: true, message: "OTP sent" });
    } catch (err) {
      console.error("Forgot password error:", err);
      sendJson(res, 500, { error: "Internal server error." });
    }
    return;
  }

  // ── POST /api/auth/reset-password ───────────────────
  if ((url.pathname === "/api/auth/reset-password" || url.pathname === "/reset-password") && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { email, otp, newPassword } = body;
      if (!email || !otp || !newPassword) return sendJson(res, 400, { error: "Email, OTP, and new password are required." });

      const rateLimitKey = `reset:${email.toLowerCase().trim()}`;
      const rateLimit = checkRateLimit(rateLimitKey, 10, 60 * 1000);
      if (rateLimit.limited) return sendJson(res, 429, { error: "Too many attempts. Please try again later." });

      const cachedEntry = otpCache.getOTP(email);
      if (!cachedEntry) return sendJson(res, 400, { error: "OTP has expired or does not exist. Please request a new code." });

      if (cachedEntry.attempts >= 3) {
        otpCache.deleteOTP(email);
        return sendJson(res, 400, { error: "Too many failed attempts. OTP invalidated. Request a new one." });
      }

      if (cachedEntry.otp !== String(otp).trim()) {
        otpCache.incrementAttempts(email);
        return sendJson(res, 400, { error: "Invalid OTP." });
      }

      otpCache.deleteOTP(email);

      const crypto = require("crypto");
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.pbkdf2Sync(newPassword, salt, 1000, 64, "sha512").toString("hex");
      const passwordHash = `${salt}:${hash}`;

      const pool = getPostgresPool();
      if (!pool) return sendJson(res, 500, { error: "Database not connected." });

      const updateRes = await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id", [passwordHash, email]);

      if (updateRes.rows.length === 0) {
        return sendJson(res, 404, { error: "User not found." });
      }

      sendJson(res, 200, { success: true, message: "Password updated successfully" });
    } catch (err) {
      console.error("Reset password error:", err);
      sendJson(res, 500, { error: "Internal server error." });
    }
    return;
  }

  // ── GET /machines — return full machine master ─────────────────
  if (url.pathname === "/machines" && req.method === "GET") {
    if (!authenticateRequest(req, res)) return;
    sendJson(res, 200, { machines: getAllMachines() });
    return;
  }

  // ── GET /drawings — list recent drawings from DB ───────────────
  if (url.pathname === "/drawings" && req.method === "GET") {
    if (!authenticateRequest(req, res)) return;
    const pool = getPostgresPool();
    if (!pool) { sendJson(res, 503, { error: "Database not configured." }); return; }
    try {
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const result = await pool.query(
        `SELECT id, title, drawing_number, revision, filename, created_at
         FROM engineering_drawings ORDER BY created_at DESC LIMIT $1`, [limit]
      );
      console.log("[DB] Query Success");
      sendJson(res, 200, { drawings: result.rows });
    } catch (e) {
      console.log("[DB] Query Failed");
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // ── GET /drawings/:id/routing — get routing for a drawing ──────
  const routingMatch = url.pathname.match(/^\/drawings\/(\d+)\/routing$/);
  if (routingMatch && req.method === "GET") {
    if (!authenticateRequest(req, res)) return;
    const pool = getPostgresPool();
    if (!pool) { sendJson(res, 503, { error: "Database not configured." }); return; }
    try {
      const drawingId = routingMatch[1];
      const result = await pool.query(
        `SELECT r.*, d.title, d.drawing_number FROM routing_suggestions r
         JOIN engineering_drawings d ON d.id = r.drawing_id
         WHERE r.drawing_id = $1 ORDER BY r.seq`, [drawingId]
      );
      console.log("[DB] Query Success");
      sendJson(res, 200, { drawingId, routing: result.rows });
    } catch (e) {
      console.log("[DB] Query Failed");
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // ── POST /routing/:id/approve|reject|modify ────────────────────
  const approvalMatch = url.pathname.match(/^\/routing\/(\d+)\/(approve|reject|modify)$/);
  if (approvalMatch && req.method === "POST") {
    if (!authenticateRequest(req, res)) return;
    const pool = getPostgresPool();
    if (!pool) { sendJson(res, 503, { error: "Database not configured." }); return; }
    try {
      const routingId = approvalMatch[1];
      const action = approvalMatch[2]; // approve | reject | modify
      const bodyBuf = await readBody(req);
      const bodyJson = bodyBuf.length ? JSON.parse(bodyBuf.toString("utf8")) : {};
      const { performedBy = "engineer", machineId, machineName, notes: stepNotes } = bodyJson;

      // Fetch current state for audit
      const cur = await pool.query(`SELECT * FROM routing_suggestions WHERE id=$1`, [routingId]);
      if (!cur.rows.length) { sendJson(res, 404, { error: "Routing step not found." }); return; }
      const prev = cur.rows[0];

      const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "modified";
      const updateFields = [newStatus, performedBy, new Date()];
      let updateSql = `UPDATE routing_suggestions SET status=$1, modified_by=$2, modified_at=$3`;
      let paramIdx = 4;

      if (action === "modify" && machineId) {
        // Look up machine details
        const machineList = getAllMachines();
        const m = machineList.find(x => x.id === machineId);
        updateSql += `, machine_id=$${paramIdx++}, machine_name=$${paramIdx++}, cost_per_hr=$${paramIdx++}`;
        updateFields.push(machineId, m?.name || machineName || machineId, m?.costPerHr || null);
      }
      if (stepNotes) {
        updateSql += `, notes=$${paramIdx++}`;
        updateFields.push(stepNotes);
      }
      updateSql += ` WHERE id=$${paramIdx} RETURNING *`;
      updateFields.push(routingId);

      const updated = await pool.query(updateSql, updateFields);

      // Audit record
      await pool.query(
        `INSERT INTO routing_approvals (routing_id, drawing_id, action, previous_data, new_data, performed_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [routingId, prev.drawing_id, action, JSON.stringify(prev), JSON.stringify(updated.rows[0]), performedBy]
      );

      console.log(`[DB] ${action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Update"} Routing`);
      sendJson(res, 200, { success: true, step: updated.rows[0] });
    } catch (e) {
      console.log("[DB] Query Failed");
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  const isAnalyzeRoute = ["/analyze", "/upload", "/process", "/api/analyze"].includes(url.pathname);
  if (isAnalyzeRoute && (req.method === "POST" || req.method === "PUT")) {
    if (!authenticateRequest(req, res)) return;

    res.on("error", (err) => {
      if (["EOF", "ECONNRESET", "EPIPE"].includes(err.code)) {
        console.warn(`[ANALYZE] Client disconnected early (${err.code})`);
        return;
      }
      console.error("[ANALYZE] Response error:", err);
    });

    try {
      const bodyBuffer = await readBody(req);
      const contentType = req.headers["content-type"] || "";
      const { fields, files } = parseMultipartBody(bodyBuffer, contentType);
      const notes = fields.notes || fields.note || "";

      if (!files.length) { sendJson(res, 400, { error: "No file uploaded." }); return; }

      const results = [];
      for (const file of files) {
        let extractedText = null;
        let extractedPageCount = null;
        let visionFile = file; // default: send original file

        if (file.contentType === "application/pdf") {
          // Extract text for fallback/context
          const pdfResult = await extractPdfTextFromBuffer(file.data);
          if (pdfResult) { extractedText = pdfResult.text; extractedPageCount = pdfResult.pageCount; }

          // Full vision preparation: full-page + high-res crops + vector text detection
          const visionPrep = await preparePdfForVision(file.data);
          if (visionPrep.fullPage) {
            const allPageCrops = (visionPrep.pages || []).flatMap(p => p.crops || []);
            console.log(`[PDF->VISION] Ready — pages:${visionPrep.pageCount}, isVector:${visionPrep.isVector}, crops:${allPageCrops.length}, vectorText:${visionPrep.vectorText.length} chars`);
            visionFile = { ...file, data: visionPrep.fullPage.data, contentType: visionPrep.fullPage.contentType };
            // Pass crops and vector text for richer extraction
            file._crops = allPageCrops;
            file._vectorText = visionPrep.isVector ? visionPrep.vectorText : null;
            file._pages = visionPrep.pages;          // multi-page data
            file._pageCount = visionPrep.pageCount;
            if (visionPrep.isVector && visionPrep.vectorText) {
              extractedText = visionPrep.vectorText; // use high-quality vector text
            }
          } else {
            console.warn("[PDF->VISION] Falling back to text-only extraction");
          }
        }

        let analysisResult = getCached(file.data);

        if (!analysisResult) {
          analysisResult = await analyzeWithOpenAi({
            file: visionFile, notes,
            route: url.pathname, method: req.method,
            receivedBytes: getBodyLength(file.data),
            sourceContentType: file.contentType,
            extractedText, extractedPageCount,
            crops: file._crops || [],
            vectorText: file._vectorText || null,
            extraPages: (file._pages || []).slice(1), // pages 1+ for multi-page PDFs
          });

          if (analysisResult) {
            setCache(file.data, analysisResult);
          }
        }

        if (!analysisResult) {
          const fallback = extractEngineeringSignals(extractedText || "");
          analysisResult = {
            standardED: {
              standardEdId: "fallback-" + Date.now(),
              title: fallback.title || file.filename,
              source: { route: url.pathname, method: req.method, contentType: file.contentType, receivedBytes: getBodyLength(file.data), filename: file.filename },
              titleBlock: fallback.titleBlock,
              assembly: { description: fallback.understanding, material: null, finish: null },
              partslist: [],
              subparts: fallback.subparts.map(normalizeSubpart).filter(Boolean),
              assemblyDimensions: fallback.dimensions.map(normalizeDimension).filter(Boolean),
              generalNotes: [],
              summary: fallback.understanding,
            },
          };
        }
        console.log(`[AI] Prepared input — type:${file.contentType}, pdfPages:${file._pageCount || 0}, cropCount:${(file._crops || []).length}, vectorText:${(file._vectorText || "").length}`);
        // Patch source filename — AI returns placeholder "__FILE__"
        if (analysisResult?.standardED?.source) {
          analysisResult.standardED.source.filename = file.filename;
          analysisResult.standardED.source.route = url.pathname;
          analysisResult.standardED.source.method = req.method;
          analysisResult.standardED.source.contentType = file.contentType;
          analysisResult.standardED.source.receivedBytes = getBodyLength(file.data);
        }

        // Run feature categorization + machine assignment
        try {
          const categorization = categorize(analysisResult);
          // Assign machines to each routing step (Step 7)
          categorization.routingSuggestion = assignMachines(categorization.routingSuggestion);
          analysisResult._categorization = categorization;
          console.log(`[CAT] ${categorization.summary}`);
        } catch (catErr) {
          console.warn("[CAT] Categorization failed:", catErr.message);
        }

        results.push({ ...analysisResult, fileName: file.filename });
      }

      const comparison = results.length > 1 ? compareDocuments(results) : null;

      // Return raw JSON if requested (for debugging)
      if (url.searchParams.get("format") === "json") {
        sendJson(res, 200, { results, comparison });
        return;
      }

      const pdfBuffer = await buildProfessionalPdf(results, url.pathname, comparison);

      const pool = getPostgresPool();
      let savedIds = [];
      if (pool) {
        for (const r of results) {
          try {
            const ed = r.standardED || {};
            const cat = r._categorization || null;

            // 1. Save main drawing record
            const drawRes = await pool.query(
              `INSERT INTO engineering_drawings
                 (title, drawing_number, revision, units, material, filename, file_type,
                  file_size_bytes, route, method, notes, raw_json)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               RETURNING id`,
              [
                ed.title || null,
                ed.titleBlock?.drawingNumber || null,
                ed.titleBlock?.revision || null,
                ed.titleBlock?.units || null,
                ed.assembly?.material || null,
                r.fileName || null,
                null,          // file_type not tracked here
                null,          // file_size not tracked here
                url.pathname,
                req.method,
                fields.notes || null,
                JSON.stringify(ed),
              ]
            );
            const drawingId = drawRes.rows[0]?.id;
            if (drawingId) {
              savedIds.push(drawingId);
              console.log("[DB] Insert Drawing");
            }

            // 2. Save extracted features
            if (drawingId && cat?.features?.length) {
              for (const f of cat.features) {
                await pool.query(
                  `INSERT INTO drawing_features
                     (drawing_id, source_part, category, sub_category, name, value, unit, tolerance)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                  [drawingId, f.sourcePart || null, f.category || null, f.subCategory || null,
                    f.name || null, f.value != null ? String(f.value) : null, f.unit || null, f.tolerance != null ? String(f.tolerance) : null]
                );
              }
              console.log("[DB] Insert Features");
            }

            // 3. Save part classification
            if (drawingId && cat) {
              await pool.query(
                `INSERT INTO part_classifications
     (drawing_id, part_family, confidence, scores_json, manufacturing_cats)
   VALUES ($1,$2,$3,$4,$5)`,
                [
                  drawingId,
                  cat.partFamily || "UNKNOWN",
                  confidenceToScore(cat.partFamilyConfidence),
                  JSON.stringify(cat.partFamilyScores || {}),
                  cat.manufacturingCategories || [],
                ]
              );
              console.log("[DB] Insert Classification");
            }

            // 4. Save routing suggestions
            if (drawingId && cat?.routingSuggestion?.length) {
              for (const step of cat.routingSuggestion) {
                await pool.query(
                  `INSERT INTO routing_suggestions
                     (drawing_id, seq, operation, process, machine_id, machine_name, cost_per_hr, status)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
                  [
                    drawingId,
                    step.seq,
                    step.operation || null,
                    step.process || null,
                    step.machineId || null,
                    step.machine || null,
                    step.costPerHr || null,
                  ]
                );
              }
              console.log("[DB] Insert Routing");
            }

            console.log(`[DB] Saved drawing id=${drawingId} with ${cat?.features?.length || 0} features, ${cat?.routingSuggestion?.length || 0} routing steps`);
          } catch (dbErr) {
            console.warn("[DB] Save failed (non-fatal):", dbErr.message);
          }
        }
      }

      if (res.writableEnded || res.destroyed) {
        console.warn("[ANALYZE] Client disconnected before PDF could be sent");
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="engineering-report.pdf"`,
        "Content-Length": pdfBuffer.length,
        "X-Saved-Ids": savedIds.join(","),
      });
      res.end(pdfBuffer);
      return;
    } catch (err) {
      console.error("Analysis error:", err);
      sendJson(res, 500, { error: err.message || "Internal server error" });
      return;
    }
  }

  sendJson(res, 404, { error: "Not found", path: url.pathname });
});

async function startServer() {
  await connectDatabase();

  server.listen(port, () => {
    console.log(`[SERVER] Running at http://localhost:${port}`);
    console.log(`[SERVER] Database: ${dbConnected ? "Connected" : "Disconnected"}`);
    console.log(`[SERVER] Environment: Development`);
    console.log(`[SERVER] AI: Gemini integration ready`);
  });
}

process.on("SIGINT", async () => {
  console.log("\nClosing HTTP server...");
  server.close(async () => {
    await disconnectDatabase();
    console.log("\nShutdown complete.");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("\nClosing HTTP server...");
  server.close(async () => {
    await disconnectDatabase();
    console.log("\nShutdown complete.");
    process.exit(0);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`Port ${port} in use — killing occupying process and retrying...`);
    const { execSync } = require("child_process");
    try {
      const result = execSync(
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr ":${port} " ^| findstr LISTENING') do @echo %a`,
        { shell: "cmd.exe" }
      ).toString().trim();
      const pids = [...new Set(result.split(/\r?\n/).map(p => p.trim()).filter(Boolean))];
      for (const pid of pids) { try { execSync(`taskkill /PID ${pid} /F`, { shell: "cmd.exe" }); } catch { } }
    } catch { }
    setTimeout(() => { server.close(); startServer(); }, 500);
  } else {
    throw err;
  }
});

startServer();
