function getAllMachines() {
  return [
    { id: 'm1', name: 'CNC Milling', costPerHr: 50 },
    { id: 'm2', name: 'Laser Cutter', costPerHr: 40 },
    { id: 'm3', name: '3D Printer', costPerHr: 20 },
    { id: 'm4', name: 'Lathe', costPerHr: 45 }
  ];
}

function assignMachines(drawings) {
  return [];
}

module.exports = {
  getAllMachines,
  assignMachines
};
