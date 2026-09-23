export type ChateauWeapon = 'sword' | 'spear' | 'axe' | 'mace';

export interface ChateauEncounter {
  phase: 'ready' | 'duel' | 'landing' | 'cleared' | 'failed';
  wave: 1 | 2;
  weapon?: 'sword' | 'spear';
  parries: number;
  disarms: number;
  attempts: number;
  wounded: boolean;
  volleyAt?: number;
}

export const CHATEAU = {
  racks: { sword: { x: -29, z: 17 }, spear: { x: 29, z: 17 } },
  landing: { x: 0, z: -35 },
  waves: [
    [{ x: -9, z: -7, weapon: 'sword' }, { x: 9, z: -7, weapon: 'mace' }],
    [{ x: -8, z: -35, weapon: 'spear' }, { x: 8, z: -35, weapon: 'axe' }],
  ],
} as const;
