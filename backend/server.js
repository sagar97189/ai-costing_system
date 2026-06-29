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

      // Check if user verified OTP today (resets at midnight local time)
      if (user.last_otp_verified) {
        const lastVerifiedDate = new Date(user.last_otp_verified);
        const today = new Date();
        if (lastVerifiedDate.toDateString() === today.toDateString()) {
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

  const isUploadRoute = ["/api/upload"].includes(url.pathname);
  if (isUploadRoute && req.method === "POST") {
    // We disable auth check here temporarily for testing, or you can uncomment it
    // if (!authMiddleware(req, res, () => {})) return;

    const { formidable } = require("formidable");
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        return sendJson(res, 400, { success: false, error: "File upload failed", details: err.message });
      }

      const file = files.file || files.drawing;
      // Formidable v3 returns arrays for files
      const fileData = Array.isArray(file) ? file[0] : file;

      if (!fileData) {
        return sendJson(res, 400, { success: false, error: "No file uploaded" });
      }

      const inputPath = fileData.filepath;
      const pythonExe = path.join(__dirname, "vision", "venv", "Scripts", "python.exe");
      const scriptPath = path.join(__dirname, "vision", "opencv_engine.py");

      console.log(`[UPLOAD] Processing file: ${fileData.originalFilename}`);

      const { execFile } = require("child_process");
      execFile(pythonExe, [scriptPath, inputPath, "--output_dir", uploadDir], (error, stdout, stderr) => {
        if (error) {
          console.error(`[OPENCV] Error: ${stderr || error.message}`);
          return sendJson(res, 500, { success: false, error: "Image processing failed", details: stderr || error.message });
        }

        try {
          const result = JSON.parse(stdout);
          return sendJson(res, 200, result);
        } catch (parseError) {
          console.error(`[OPENCV] JSON Parse Error: ${parseError.message}`, stdout);
          return sendJson(res, 500, { success: false, error: "Invalid response from OpenCV engine", raw: stdout });
        }
      });
    });
    return;
  }

  // --- Static file serving for uploads/debug ---
  if (url.pathname.startsWith("/uploads/debug/")) {
    const filePath = path.join(__dirname, "uploads", "debug", url.pathname.replace("/uploads/debug/", ""));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".png") contentType = "image/png";
      else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      else if (ext === ".json") contentType = "application/json";

      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // --- GET Debug Route ---
  const debugMatch = url.pathname.match(/^\/api\/process-drawing\/(.+)\/debug$/);
  if (debugMatch && req.method === "GET") {
    const jobId = debugMatch[1];
    const fullJsonPath = path.join(__dirname, "uploads", "debug", `${jobId}_full.json`);

    if (!fs.existsSync(fullJsonPath)) {
      return sendJson(res, 404, { error: "Debug data not found for this job ID" });
    }

    try {
      const fullJson = JSON.parse(fs.readFileSync(fullJsonPath, "utf8"));
      const summary = {
        title_block: fullJson.features?.title_block || {},
        bom_table: fullJson.features?.bom_table || [],
        dimensions: fullJson.features?.dimensions || {},
        materials: fullJson.features?.materials || [],
        notes: fullJson.features?.notes || [],
        standard_ed_draft: fullJson.standard_ed_draft || {}
      };

      return sendJson(res, 200, {
        ocr_debug_image: `/uploads/debug/${jobId}_ocr_debug.png`,
        summary: summary
      });
    } catch (err) {
      return sendJson(res, 500, { error: "Failed to parse saved debug data" });
    }
  }

  const isProcessRoute = ["/api/process-drawing"].includes(url.pathname);
  if (isProcessRoute && req.method === "POST") {
    // We disable auth check here temporarily for testing, or you can uncomment it
    // if (!authMiddleware(req, res, () => {})) return;

    const { formidable } = require("formidable");
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    const debugDir = path.join(uploadDir, "debug");
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        return sendJson(res, 400, { success: false, error: "File upload failed", details: err.message });
      }

      const file = files.file || files.drawing;
      const fileData = Array.isArray(file) ? file[0] : file;

      if (!fileData) {
        return sendJson(res, 400, { success: false, error: "No file uploaded" });
      }

      const inputPath = fileData.filepath;
      const baseName = path.parse(fileData.originalFilename || "upload").name.replace(/[^a-zA-Z0-9_-]/g, "_");
      const timestamp = Date.now();
      const jobId = `${baseName}_${timestamp}`;

      const newPath = path.join(uploadDir, `${jobId}${path.extname(inputPath)}`);
      fs.renameSync(inputPath, newPath);

      const pythonExe = path.join(__dirname, "vision", "venv", "Scripts", "python.exe");
      const scriptPath = path.join(__dirname, "vision", "orchestrator.py");

      console.log(`[PROCESS-DRAWING] Orchestrating: ${fileData.originalFilename} (JobID: ${jobId})`);

      const { execFile } = require("child_process");
      execFile(pythonExe, [scriptPath, newPath, "--output_dir", debugDir, "--debug"], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error && !stdout) {
          console.error(`[ORCHESTRATOR] Error: ${stderr || error.message}`);
          return sendJson(res, 500, { success: false, error: "Multi-stage processing failed", details: stderr || error.message });
        }

        try {
          const jsonStart = stdout.indexOf('{');
          if (jsonStart === -1) throw new Error("No JSON response found in stdout");
          const jsonStr = stdout.substring(jsonStart);

          const result = JSON.parse(jsonStr);

          const fullJsonPath = path.join(debugDir, `${jobId}_full.json`);
          fs.writeFileSync(fullJsonPath, JSON.stringify(result, null, 2));

          const summary = {
            title_block: result.features?.title_block || {},
            bom_table: result.features?.bom_table || [],
            dimensions: result.features?.dimensions || {},
            materials: result.features?.materials || [],
            notes: result.features?.notes || []
          };

          return sendJson(res, 200, {
            success: true,
            job_id: jobId,
            summary: summary,
            debug_image_url: `/uploads/debug/${jobId}_ocr_debug.png`,
            full_json_available: true
          });
        } catch (parseError) {
          console.error(`[ORCHESTRATOR] JSON Parse Error: ${parseError.message}`, stdout);
          return sendJson(res, 500, { success: false, error: "Invalid response from Orchestrator", raw: stdout });
        }
      });
    });
    return;
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
