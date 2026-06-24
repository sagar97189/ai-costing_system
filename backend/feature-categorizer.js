/**
 * feature-categorizer.js
 * ──────────────────────
 * Takes the standardED JSON output from the AI and produces:
 *
 *  {
 *    features       : [ { name, value, unit, tolerance, category, subCategory } ]
 *    partFamily     : "SHAFT" | "FLANGE" | "GEAR" | "HOUSING" | "PLATE" | "BRACKET" | "ASSEMBLY" | "UNKNOWN"
 *    manufacturingCategories : [ "Turning", "Threading", ... ]
 *    processes      : [ "CNC Turning", "Thread Rolling", ... ]
 *    routingSuggestion : [ { seq, operation, process } ]
 *    summary        : "plain English explanation"
 *  }
 */

"use strict";

// ── Category Master ───────────────────────────────────────────────
const CATEGORIES = {
  GEOMETRY:        "Geometry",
  MATERIAL:        "Material",
  THREAD:          "Thread",
  HOLE:            "Hole Feature",
  TOLERANCE:       "Precision Requirement",
  SURFACE_FINISH:  "Surface Finish",
  GDT:             "GD&T",
  HEAT_TREATMENT:  "Heat Treatment",
  ASSEMBLY:        "Assembly Feature",
  GREASE:          "Lubrication",
};

// ── Manufacturing Category → Process mapping ──────────────────────
const MFG_TO_PROCESS = {
  "Turning":            "CNC Turning",
  "Threading":          "Thread Rolling / Tapping",
  "Drilling":           "Drilling / Boring",
  "Milling":            "CNC Milling",
  "Grinding":           "Cylindrical / Surface Grinding",
  "Precision Machining":"Precision Machining + CMM Inspection",
  "Heat Treatment":     "Heat Treatment (Case Hardening / Quench & Temper)",
  "Assembly":           "Assembly & Sub-Assembly",
  "Inspection":         "Quality Inspection",
  "Cutting":            "Raw Material Cutting",
  "Welding":            "Welding / Fabrication",
  "Sheet Metal":        "Sheet Metal Forming",
};

// ── Process → Routing Sequence ────────────────────────────────────
const ROUTING_ORDER = [
  "Cutting",
  "Heat Treatment",
  "Turning",
  "Milling",
  "Drilling",
  "Threading",
  "Grinding",
  "Precision Machining",
  "Assembly",
  "Inspection",
];

// ── Helper: parse numeric value from strings like "Ø50", "50.0", "~45" ──
function parseNum(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[Øø~≈°]/g, "").replace(/\s/g, "");
  // handle ranges like "50-55" — take lower bound
  const rangeMatch = cleaned.match(/^([\d.]+)[-–]([\d.]+)$/);
  if (rangeMatch) return parseFloat(rangeMatch[1]);
  const match = cleaned.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

// ── Helper: check if string matches thread pattern ────────────────
function isThread(str) {
  return /M\d|UNC|UNF|BSW|BSF|NPT|BSPT/i.test(String(str || ""));
}

// ── Helper: check if string is a surface finish callout ──────────
function isSurfaceFinish(str) {
  return /Ra|Rz|N\d|▽/i.test(String(str || ""));
}

// ── Helper: parse Ra value ────────────────────────────────────────
function parseRa(str) {
  const m = String(str || "").match(/Ra\s*([\d.]+)/i);
  return m ? parseFloat(m[1]) : null;
}

// ── Helper: parse tolerance tightness ────────────────────────────
function parseTolerance(str) {
  const m = String(str || "").match(/([\d.]+)/);
  return m ? parseFloat(m[0]) : null;
}

// ═════════════════════════════════════════════════════════════════
// STEP 1: Extract flat feature list from standardED JSON
// ═════════════════════════════════════════════════════════════════
function extractFeatures(ed) {
  const features = [];
  let idCounter = 1;
  const id = () => idCounter++;

  function addFeature(name, value, unit, tolerance, category, subCategory, sourcePartName) {
    features.push({
      id: id(),
      name,
      value: value ?? null,
      unit: unit ?? null,
      tolerance: tolerance ?? null,
      category,
      subCategory: subCategory ?? null,
      sourcePart: sourcePartName ?? "Assembly",
    });
  }

  // ── Material ──────────────────────────────────────────────────
  const asmMaterial = ed.assembly?.material;
  if (asmMaterial) addFeature("Assembly Material", asmMaterial, null, null, CATEGORIES.MATERIAL, null, "Assembly");

  // ── Assembly-level dimensions ─────────────────────────────────
  const overallDims = ed.assembledProduct?.overallDimensions || [];
  for (const d of overallDims) {
    addFeature(d.name, d.value, d.unit, d.tolerance, CATEGORIES.GEOMETRY, "Envelope Dimension", "Assembly");
  }

  // ── Bore ──────────────────────────────────────────────────────
  if (ed.assembledProduct?.bore) {
    addFeature("Bore", ed.assembledProduct.bore, "mm", null, CATEGORIES.GEOMETRY, "Bore/ID", "Assembly");
  }

  // ── Spec of size ──────────────────────────────────────────────
  for (const s of (ed.assembledProduct?.specificationOfSize || [])) {
    let cat = CATEGORIES.GEOMETRY;
    let sub = null;
    if (isThread(s.value)) { cat = CATEGORIES.THREAD; sub = "Thread"; }
    else if (/seal|gasket/i.test(s.name)) { sub = "Seal Dimension"; }
    else if (/grease|grade|colour|color/i.test(s.name)) { cat = CATEGORIES.GREASE; sub = "Lubrication Spec"; }
    addFeature(s.name, s.value, s.unit, null, cat, sub, "Assembly");
  }

  // ── Hardness / heat treatment ─────────────────────────────────
  for (const h of (ed.assembledProduct?.hardnessTable || [])) {
    if (h.surfaceHRC) addFeature(`${h.part} Surface Hardness`, h.surfaceHRC, "HRC", null, CATEGORIES.HEAT_TREATMENT, "Surface Hardness", h.part);
    if (h.coreHRC)    addFeature(`${h.part} Core Hardness`,    h.coreHRC,    "HRC", null, CATEGORIES.HEAT_TREATMENT, "Core Hardness",    h.part);
    if (h.caseDepthMm) addFeature(`${h.part} Case Depth`,     h.caseDepthMm,"mm",  null, CATEGORIES.HEAT_TREATMENT, "Case Depth",       h.part);
  }

  // ── Assembly-level dimensions ─────────────────────────────────
  for (const d of (ed.assemblyDimensions || [])) {
    let cat = CATEGORIES.GEOMETRY;
    let sub = "Assembly Dimension";
    if (/hole|pcd|pitch circle/i.test(d.name)) { cat = CATEGORIES.HOLE; sub = "Hole PCD"; }
    addFeature(d.name, d.value, d.unit, d.tolerance, cat, sub, "Assembly");
  }

  // ── Per-subpart features ──────────────────────────────────────
  for (const sp of (ed.subparts || [])) {
    const partName = sp.name || "Unknown Part";

    // Material
    if (sp.material) addFeature(`${partName} Material`, sp.material, null, null, CATEGORIES.MATERIAL, null, partName);

    // Surface finish
    if (sp.surfaceFinish && isSurfaceFinish(sp.surfaceFinish)) {
      addFeature(`${partName} Surface Finish`, sp.surfaceFinish, null, null, CATEGORIES.SURFACE_FINISH, null, partName);
    }

    // Dimensions
    for (const d of (sp.dimensions || [])) {
      let cat = CATEGORIES.GEOMETRY;
      let sub = null;

      const nameLower = (d.name || "").toLowerCase();
      const valStr = String(d.value || "");

      if (isThread(valStr) || isThread(d.name)) {
        cat = CATEGORIES.THREAD; sub = "Thread";
      } else if (/hole|drill|bore|tap/i.test(nameLower)) {
        cat = CATEGORIES.HOLE; sub = "Hole Feature";
      } else if (/pcd|pitch circle/i.test(nameLower)) {
        cat = CATEGORIES.HOLE; sub = "Hole PCD";
      } else if (isSurfaceFinish(valStr)) {
        cat = CATEGORIES.SURFACE_FINISH; sub = null;
      } else if (/diameter|od|id|bore|radius/i.test(nameLower)) {
        sub = "Diameter / Radius";
      } else if (/length|height|depth|width|thickness/i.test(nameLower)) {
        sub = "Linear Dimension";
      } else if (/chamfer|fillet|radius/i.test(nameLower)) {
        sub = "Form Feature";
      } else if (/keyway|key|slot|groove/i.test(nameLower)) {
        cat = CATEGORIES.GEOMETRY; sub = "Keyway / Groove";
      }

      addFeature(d.name, d.value, d.unit, d.tolerance, cat, sub, partName);

      // Tolerance — extract as separate feature if tight
      const tol = parseTolerance(d.tolerance);
      if (tol != null && tol <= 0.05) {
        addFeature(`${d.name} (Tight Tolerance)`, d.tolerance, d.unit, null, CATEGORIES.TOLERANCE, "Precision Requirement", partName);
      }
    }

    // GD&T
    for (const g of (sp.geometricTolerances || [])) {
      addFeature(`GD&T ${g.symbol}`, g.value, null, null, CATEGORIES.GDT, g.symbol, partName);
    }

    // Manufacturing notes — detect heat treatment
    for (const note of (sp.manufacturingNotes || [])) {
      if (/HRC|hardness|case depth|carburiz|nitriding|quench|temper|anneal/i.test(note)) {
        addFeature(`${partName} Heat Treatment`, note, null, null, CATEGORIES.HEAT_TREATMENT, "Manufacturing Note", partName);
      }
    }
  }

  return features;
}

// ═════════════════════════════════════════════════════════════════
// STEP 2: Part Family Classification (scoring-based)
// ═════════════════════════════════════════════════════════════════
function classifyPartFamily(ed, features) {
  const title   = (ed.title || "").toLowerCase();
  const desc    = (ed.assembly?.description || ed.assembledProduct?.description || "").toLowerCase();
  const summary = (ed.summary || "").toLowerCase();
  const combined = title + " " + desc + " " + summary;

  // Collect all dimension values for geometry ratio checks
  const diameters = features
    .filter(f => /diameter|od|\bøø?\b/i.test(f.name || "") && f.value)
    .map(f => parseNum(f.value)).filter(v => v != null && v > 0);

  const lengths = features
    .filter(f => /length|height|depth/i.test(f.name || "") && f.value)
    .map(f => parseNum(f.value)).filter(v => v != null && v > 0);

  const hasThread   = features.some(f => f.category === CATEGORIES.THREAD);
  const hasBore     = features.some(f => /bore|id\b|inner dia/i.test(f.name || ""));
  const hasHoles    = features.some(f => f.category === CATEGORIES.HOLE);
  const hasKeyway   = features.some(f => /keyway|key slot|keyseat/i.test(f.name || ""));
  const hasTeeth    = features.some(f => /teeth|tooth|module|pressure angle|helix/i.test(f.name || ""));
  const hasWeld     = /weld|fabricat/i.test(combined);
  const hasSheet    = /sheet metal|bend|blank|punching/i.test(combined);

  const maxDia = diameters.length ? Math.max(...diameters) : 0;
  const maxLen = lengths.length   ? Math.max(...lengths)   : 0;

  // ── Scoring system ────────────────────────────────────────────
  const scores = {
    SHAFT:     0,
    FLANGE:    0,
    GEAR:      0,
    HOUSING:   0,
    PLATE:     0,
    BRACKET:   0,
    SPACER:    0,
    ASSEMBLY:  0,
  };

  // --- Name / description signals ---
  if (/\bshaft\b|spindle|axle|rod|pin\b/i.test(combined))          scores.SHAFT    += 10;
  if (/flange|hub\b/i.test(combined))                               scores.FLANGE   += 10;
  if (/\bgear\b|pinion|sprocket|helical|spur\b|bevel/i.test(combined)) scores.GEAR  += 10;
  if (/housing|casing|body\b|bearing.*support|fan.*support/i.test(combined)) scores.HOUSING += 10;
  if (/\bplate\b|panel\b|cover\b/i.test(combined))                  scores.PLATE    += 10;
  if (/bracket|clamp|arm\b|lever/i.test(combined))                  scores.BRACKET  += 10;
  if (/spacer|bush\b|sleeve|collar/i.test(combined))                scores.SPACER   += 10;
  if (/assembly|assy\b|cross.*assembly|joint/i.test(combined))      scores.ASSEMBLY += 8;

  // --- Geometry signals ---
  if (maxLen > 0 && maxDia > 0 && maxLen > maxDia * 2) {
    scores.SHAFT += 6;   // long relative to diameter → shaft-like
  }
  if (maxDia > 0 && maxLen > 0 && maxDia > maxLen) {
    scores.FLANGE  += 4; // wider than tall → disc/flange-like
    scores.SPACER  += 3;
  }

  // --- Feature signals ---
  if (hasThread && !hasBore && maxLen > maxDia * 1.5) scores.SHAFT   += 5;
  if (hasThread && hasBore)                            scores.FLANGE  += 3;
  if (hasBore && hasHoles && !hasTeeth)                scores.FLANGE  += 6;
  if (hasBore && !hasHoles && !hasTeeth)               scores.HOUSING += 5;
  if (hasTeeth)                                        scores.GEAR    += 15;
  if (hasKeyway && !hasTeeth)                          scores.SHAFT   += 5;
  if (hasKeyway && hasTeeth)                           scores.GEAR    += 5;
  if (hasHoles && !hasBore && !hasDiameterFeature(features)) scores.PLATE += 5;
  if (hasWeld)                                         scores.BRACKET += 6;
  if (hasSheet)                                        scores.PLATE   += 8;

  // BOM size signal — large BOM means assembly
  const bomSize = (ed.partslist || ed.subparts || []).length;
  if (bomSize >= 4)  scores.ASSEMBLY += 5;
  if (bomSize >= 8)  scores.ASSEMBLY += 5;

  // --- Pick winner ---
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  // Confidence: difference between top two scores
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const confidence = sorted[0][1] - (sorted[1]?.[1] || 0);

  return {
    family: winner[1] > 0 ? winner[0] : "UNKNOWN",
    scores,
    confidence: confidence >= 5 ? "HIGH" : confidence >= 2 ? "MEDIUM" : "LOW",
  };
}

function hasDiameterFeature(features) {
  return features.some(f => /diameter|od|\bøø?\b/i.test(f.name || ""));
}

// ═════════════════════════════════════════════════════════════════
// STEP 3: Manufacturing Category Mapping
// ═════════════════════════════════════════════════════════════════
function mapManufacturingCategories(features, partFamily) {
  const cats = new Set();

  // Always start with cutting
  cats.add("Cutting");

  for (const f of features) {
    switch (f.category) {
      case CATEGORIES.GEOMETRY:
        if (/diameter|od|id|bore|radius/i.test(f.subCategory || f.name || "")) cats.add("Turning");
        if (/keyway|groove|slot|milling/i.test(f.subCategory || f.name || "")) cats.add("Milling");
        break;

      case CATEGORIES.THREAD:
        cats.add("Threading");
        cats.add("Turning"); // threads are usually on turned parts
        break;

      case CATEGORIES.HOLE:
        cats.add("Drilling");
        if (/pcd|flange/i.test(f.name || "")) cats.add("Turning");
        break;

      case CATEGORIES.SURFACE_FINISH: {
        const ra = parseRa(String(f.value || ""));
        if (ra != null && ra <= 1.6) cats.add("Grinding");
        if (ra != null && ra <= 0.8) cats.add("Precision Machining");
        break;
      }

      case CATEGORIES.TOLERANCE: {
        const tol = parseTolerance(String(f.value || ""));
        if (tol != null && tol <= 0.05) cats.add("Precision Machining");
        if (tol != null && tol <= 0.02) cats.add("Grinding");
        break;
      }

      case CATEGORIES.HEAT_TREATMENT:
        cats.add("Heat Treatment");
        break;

      case CATEGORIES.GDT:
        cats.add("Precision Machining");
        cats.add("Inspection");
        break;

      case CATEGORIES.ASSEMBLY:
        cats.add("Assembly");
        break;
    }
  }

  // Part family overrides
  switch (partFamily) {
    case "SHAFT":
      cats.add("Turning");
      break;
    case "FLANGE":
      cats.add("Turning");
      cats.add("Drilling");
      break;
    case "GEAR":
      cats.add("Turning");
      cats.add("Milling"); // hobbing/gear cutting
      cats.add("Grinding");
      cats.add("Heat Treatment");
      break;
    case "HOUSING":
      cats.add("Turning");
      cats.add("Drilling");
      break;
    case "PLATE":
      cats.add("Milling");
      cats.add("Drilling");
      break;
    case "ASSEMBLY":
      cats.add("Assembly");
      break;
  }

  // Always end with inspection
  cats.add("Inspection");

  // Return in logical order
  return ROUTING_ORDER.filter(c => cats.has(c));
}

// ═════════════════════════════════════════════════════════════════
// STEP 4: Process Generation
// ═════════════════════════════════════════════════════════════════
function generateProcesses(mfgCategories) {
  return mfgCategories.map(cat => MFG_TO_PROCESS[cat] || cat);
}

// ═════════════════════════════════════════════════════════════════
// STEP 5: Routing Suggestion
// ═════════════════════════════════════════════════════════════════
function generateRouting(mfgCategories) {
  return mfgCategories.map((cat, i) => ({
    seq:       (i + 1) * 10,
    operation: cat,
    process:   MFG_TO_PROCESS[cat] || cat,
    machine:   null, // filled in Phase 4 when machine master is available
  }));
}

// ═════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════════

/**
 * categorize(standardED)
 * Takes the AI-extracted standardED object and returns full categorization.
 */
function categorize(standardED) {
  const ed = standardED?.standardED || standardED || {};

  // Step 1: extract flat feature list
  const features = extractFeatures(ed);

  // Step 2: classify part family
  const partFamilyResult = classifyPartFamily(ed, features);
  const partFamily = partFamilyResult.family;

  // Step 3: map to manufacturing categories
  const manufacturingCategories = mapManufacturingCategories(features, partFamily);

  // Step 4: generate processes
  const processes = generateProcesses(manufacturingCategories);

  // Step 5: generate routing
  const routingSuggestion = generateRouting(manufacturingCategories);

  // Summary
  const featureSummary = [
    `Part Family: ${partFamily} (${partFamilyResult.confidence} confidence)`,
    `Manufacturing Categories: ${manufacturingCategories.join(", ")}`,
    `Total features extracted: ${features.length}`,
    `Category breakdown: ${
      [...new Set(features.map(f => f.category))]
        .map(cat => `${cat}(${features.filter(f => f.category === cat).length})`)
        .join(", ")
    }`,
  ].join(" | ");

  return {
    features,
    partFamily,
    partFamilyScores: partFamilyResult.scores,
    partFamilyConfidence: partFamilyResult.confidence,
    manufacturingCategories,
    processes,
    routingSuggestion,
    summary: featureSummary,
  };
}

module.exports = { categorize, CATEGORIES };
