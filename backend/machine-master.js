/**
 * machine-master.js
 * ─────────────────
 * Step 7 of the OCR → Routing pipeline: Machine Selection.
 *
 * Provides a configurable machine master table and maps manufacturing
 * operations to the best available machine based on:
 *   - capability match
 *   - priority (lower = preferred)
 *
 * In a full ERP the load / OEE / cycle-time columns would be live data
 * from the shop-floor.  Here they are static defaults — replace with
 * database lookups when the machine master is in Postgres.
 *
 * Exports:
 *   assignMachines(routingSuggestion)  → updated routingSuggestion[]
 *   MACHINE_MASTER                     → raw table for editing / seeding
 */

"use strict";

// ── Machine Master Table ──────────────────────────────────────────
// Each entry describes one physical machine.
// operations: list of manufacturing categories this machine can perform
// priority  : 1 = most preferred for this operation (lower wins ties)
// costPerHr : indicative cost — used for costing layer (Phase 4)
// oee       : overall equipment effectiveness 0-1 (1 = 100 %)
const MACHINE_MASTER = [
  // ── Saws / Cutting ───────────────────────────────────────────
  { id: "SAW-01", name: "Bandsaw 01",          type: "Bandsaw",         operations: ["Cutting"],             priority: 1, costPerHr: 15,  oee: 0.90 },
  { id: "SAW-02", name: "Circular Saw 02",     type: "Circular Saw",    operations: ["Cutting"],             priority: 2, costPerHr: 12,  oee: 0.88 },

  // ── CNC Turning ──────────────────────────────────────────────
  { id: "CNC-01", name: "CNC Lathe 01",        type: "CNC Lathe",       operations: ["Turning"],             priority: 1, costPerHr: 80,  oee: 0.85 },
  { id: "CNC-02", name: "CNC Lathe 02",        type: "CNC Lathe",       operations: ["Turning"],             priority: 2, costPerHr: 80,  oee: 0.82 },
  { id: "CNC-03", name: "CNC Lathe 03 (HMC)",  type: "CNC Lathe",       operations: ["Turning","Milling"],   priority: 3, costPerHr: 120, oee: 0.80 },

  // ── CNC Milling ──────────────────────────────────────────────
  { id: "VMC-01", name: "VMC 01",              type: "Vertical MC",     operations: ["Milling","Drilling"],  priority: 1, costPerHr: 100, oee: 0.83 },
  { id: "VMC-02", name: "VMC 02",              type: "Vertical MC",     operations: ["Milling","Drilling"],  priority: 2, costPerHr: 100, oee: 0.80 },
  { id: "HMC-01", name: "HMC 01",             type: "Horizontal MC",   operations: ["Milling","Drilling","Turning"], priority: 1, costPerHr: 150, oee: 0.78 },

  // ── Drilling ─────────────────────────────────────────────────
  { id: "DRL-01", name: "Radial Drill 01",     type: "Radial Drill",    operations: ["Drilling"],            priority: 1, costPerHr: 35,  oee: 0.88 },
  { id: "DRL-02", name: "Column Drill 02",     type: "Column Drill",    operations: ["Drilling"],            priority: 2, costPerHr: 25,  oee: 0.90 },

  // ── Threading ────────────────────────────────────────────────
  { id: "THR-01", name: "Thread Rolling 01",   type: "Thread Rolling",  operations: ["Threading"],           priority: 1, costPerHr: 45,  oee: 0.92 },
  { id: "TAP-01", name: "Tapping Machine 01",  type: "Tapping",         operations: ["Threading"],           priority: 2, costPerHr: 30,  oee: 0.90 },

  // ── Grinding ─────────────────────────────────────────────────
  { id: "GRD-01", name: "Cylindrical Grinder 01", type: "Cyl Grinder",  operations: ["Grinding"],            priority: 1, costPerHr: 90,  oee: 0.80 },
  { id: "GRD-02", name: "Surface Grinder 02",  type: "Surf Grinder",    operations: ["Grinding"],            priority: 2, costPerHr: 75,  oee: 0.82 },

  // ── Precision Machining ──────────────────────────────────────
  { id: "JIG-01", name: "Jig Boring 01",       type: "Jig Borer",       operations: ["Precision Machining"], priority: 1, costPerHr: 130, oee: 0.75 },

  // ── Heat Treatment ───────────────────────────────────────────
  { id: "HT-01",  name: "Batch Furnace 01",    type: "Heat Treatment",  operations: ["Heat Treatment"],      priority: 1, costPerHr: 60,  oee: 0.88 },
  { id: "HT-02",  name: "Continuous Furnace 02",type:"Heat Treatment",  operations: ["Heat Treatment"],      priority: 2, costPerHr: 50,  oee: 0.85 },

  // ── Assembly ─────────────────────────────────────────────────
  { id: "ASM-01", name: "Assembly Station 01", type: "Assembly",        operations: ["Assembly"],            priority: 1, costPerHr: 40,  oee: 0.95 },
  { id: "ASM-02", name: "Assembly Station 02", type: "Assembly",        operations: ["Assembly"],            priority: 2, costPerHr: 40,  oee: 0.93 },

  // ── Inspection ───────────────────────────────────────────────
  { id: "CMM-01", name: "CMM 01",              type: "CMM",             operations: ["Inspection","Precision Machining"], priority: 1, costPerHr: 70, oee: 0.88 },
  { id: "INS-01", name: "Inspection Table 01", type: "Manual Inspect",  operations: ["Inspection"],          priority: 2, costPerHr: 25,  oee: 0.95 },

  // ── Welding ──────────────────────────────────────────────────
  { id: "WLD-01", name: "MIG Welder 01",       type: "MIG Welding",     operations: ["Welding"],             priority: 1, costPerHr: 55,  oee: 0.88 },

  // ── Sheet Metal ──────────────────────────────────────────────
  { id: "PRS-01", name: "Press Brake 01",      type: "Press Brake",     operations: ["Sheet Metal"],         priority: 1, costPerHr: 65,  oee: 0.85 },
];

// ── Build lookup: operation → sorted machine list ─────────────────
const _opMap = new Map();
for (const machine of MACHINE_MASTER) {
  for (const op of machine.operations) {
    if (!_opMap.has(op)) _opMap.set(op, []);
    _opMap.get(op).push(machine);
  }
}
// Sort each list by priority ascending
for (const [, list] of _opMap) {
  list.sort((a, b) => a.priority - b.priority);
}

/**
 * getBestMachine(operation)
 * Returns the highest-priority machine for the given operation,
 * or null if no machine is configured for it.
 */
function getBestMachine(operation) {
  const candidates = _opMap.get(operation);
  if (!candidates || !candidates.length) return null;
  return candidates[0];
}

/**
 * assignMachines(routingSuggestion)
 * Takes the routing suggestion array from feature-categorizer.js and
 * fills in the `machine`, `machineId`, `machineType`, and `costPerHr`
 * fields on each step.
 *
 * @param {Array<{seq, operation, process, machine}>} routing
 * @returns {Array} updated routing with machine data attached
 */
function assignMachines(routing) {
  if (!Array.isArray(routing)) return routing;
  return routing.map(step => {
    const best = getBestMachine(step.operation);
    if (!best) return { ...step, machine: "TBD", machineId: null, machineType: null, costPerHr: null };
    return {
      ...step,
      machine:      best.name,
      machineId:    best.id,
      machineType:  best.type,
      costPerHr:    best.costPerHr,
      oee:          best.oee,
    };
  });
}

/**
 * getAllMachines()
 * Returns full machine master — for the approval UI and seeding Postgres.
 */
function getAllMachines() {
  return MACHINE_MASTER;
}

module.exports = { assignMachines, getBestMachine, getAllMachines, MACHINE_MASTER };
