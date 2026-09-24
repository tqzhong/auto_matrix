import type { FilmJourney } from './film-story.js';

export type FilmFate = 'dead' | 'assimilated' | 'missing' | 'alive';
// Ordered by the released films. Deriving from completed scenes also upgrades old saves.
export const FILM_CONSEQUENCES: Record<string, Record<string, FilmFate>> = {
  m1_dejavu: { mouse: 'dead' },
  m1_unplugged: { cypher: 'dead', dozer: 'dead', apoc: 'dead', switch: 'dead' },
  m2_bane_copy: { bane: 'assimilated' },
  m2_vigilant: { soren: 'dead', axel: 'dead' },
  m2_key_door: { keymaker: 'dead' },
  m3_maggie_discovery: { maggie: 'dead' },
  m3_oracle_absorbed: { oracle: 'assimilated', sati: 'assimilated', seraph: 'assimilated' },
  m3_bane: { bane: 'dead' },
  m3_dock_battle: { charra: 'dead' },
  m3_gate: { mifune: 'dead' },
  m3_farewell: { trinity: 'dead' },
  m3_surrender: { oracle: 'alive', sati: 'alive', seraph: 'alive' },
  m3_neo_carried: { neo: 'missing' },
};

export function filmCharacterFates(journey: FilmJourney): Record<string, FilmFate> {
  const fates: Record<string, FilmFate> = {};
  for (const [scene, changes] of Object.entries(FILM_CONSEQUENCES)) {
    if (journey.completed.includes(scene)) Object.assign(fates, changes);
  }
  // Saves from before the shipboard discovery still reached the Logos fight.
  if (journey.completed.includes('m3_bane') && !journey.completed.includes('m3_maggie_discovery')) fates.maggie = 'dead';
  return fates;
}
