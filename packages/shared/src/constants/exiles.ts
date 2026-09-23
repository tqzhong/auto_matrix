export const EXILES = {
  table: { x: 0, z: -14 },
  washroom: { x: 23, z: 22 },
  kitchen: { x: 24, z: -8 },
  office: { x: 24, z: -27 },
  library: { x: 0, z: 7 },
  guard: { x: -6, z: -6 },
  bookshelf: { x: -8, z: -18 },
  keymaker: { x: 0, z: -25 },
  escape: { x: 0, z: 23 },
  exchangeSeconds: 2.8,
  followSpeed: 4.6,
  followRange: 14,
  escapeRange: 5,
} as const;

export interface PersephoneEncounter {
  phase: 'offered' | 'enacting' | 'reconsider' | 'agreed';
  elapsed: number;
  attempts: number;
  route?: 'memory' | 'appeal';
}

export interface KeymakerEncounter {
  x: number;
  z: number;
  phase: 'hidden' | 'revealed' | 'following' | 'escaped';
  separated: number;
  setbacks: number;
}
