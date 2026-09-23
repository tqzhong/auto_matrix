export const TRUCKS = {
  roof: { x: 14, z: 28.5, width: 5.6, depth: 20, height: 6.6 },
  morpheus: { x: 14, z: 25 },
  johnson: { x: 14, z: 21 },
  keymaker: { x: 12.5, z: 32.5 },
  niobe: { x: 7, z: 34 },
  oncomingStart: -95,
  oncomingEnd: -3,
  collisionSeconds: 10,
  rescueSeconds: 3,
} as const;

export interface TruckEncounter {
  phase: 'duel' | 'collision' | 'rescue' | 'rescued' | 'failed';
  elapsed: number;
  lastTick: number;
  attempt: number;
  rescueElapsed?: number;
  origin?: { x: number; z: number };
}
