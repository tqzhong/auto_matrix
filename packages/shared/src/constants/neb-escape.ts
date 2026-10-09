import type { ShipLossEncounter } from './film-story.js';

export const NEB_ESCAPE = {
  hatch: { z: 39.2, width: 11.8, height: 8.6, depth: .35, closedY: 4.5 },
  sternZ: 44.6, routeHalfWidth: 8, routeEnd: 70, safeZ: 56, playerZ: 62,
  openingSeconds: 1.6, blastSeconds: 5.6, crewSpeed: 7,
} as const;
export const NEB_CREW = ['neo', 'morpheus', 'trinity', 'link'] as const;
export type NebCrewRole = typeof NEB_CREW[number];
export interface NebCrewRoute { points: { x: number; z: number }[]; index: number; yaw: number }

export function nebHatchHeight(loss: ShipLossEncounter): number {
  const age = loss.age ?? (loss.phase === 'briefing' ? 0 : 32 - loss.remaining);
  const t = Math.max(0, Math.min(1, age / NEB_ESCAPE.openingSeconds));
  return NEB_ESCAPE.hatch.closedY + NEB_ESCAPE.hatch.height * t * t * (3 - 2 * t);
}
export function nebEscapeLocked(loss: ShipLossEncounter | undefined): boolean {
  return loss?.phase === 'destroying' || loss?.phase === 'failed';
}
