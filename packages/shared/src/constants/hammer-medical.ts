export const HAMMER_MEDICAL = { mattressTop: 1.9, width: 3.2, length: 5.7 } as const;
export const HAMMER_MEDICAL_BEDS = [
  { role: 'neo', x: -10, z: -23, yaw: 0 },
  { role: 'bane', x: 10, z: -23, yaw: Math.PI },
] as const;
export const HAMMER_MEDICAL_SUPPLIES = [
  { x: -19, z: -46, width: 6, depth: 1.5, height: 4 },
  { x: 19, z: -46, width: 6, depth: 1.5, height: 4 },
] as const;
