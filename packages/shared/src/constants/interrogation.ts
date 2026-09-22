import type { FilmJourney } from './film-story.js';

export interface InterrogationEncounter {
  phase: 'file' | 'response' | 'coercion' | 'done';
  elapsed: number;
  approach: { x: number; z: number; yaw: number };
}
export type InterrogationRole = 'neo' | 'smith' | 'agent_jones' | 'agent_brown';
export type InterrogationGesture = Pick<InterrogationEncounter, 'phase' | 'elapsed'> & { role: InterrogationRole };
export const INTERROGATION_CAST = ['smith', 'agent_jones', 'agent_brown'] as const;
export const INTERROGATION_ROOM = { width: 16, depth: 22, height: 8.4, seat: 4.1, table: { x: 0, z: 0, width: 6.4, depth: 2.2, height: 2.25 }, approach: { x: 5.9, z: 0 } } as const;
export const INTERROGATION_TIMING = { file: 6, coercion: 24, implanted: 21.5 } as const;
const ease = (time: number, from: number, to: number) => { const t = Math.max(0, Math.min(1, (time - from) / (to - from))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function interrogationLocked(journey: FilmJourney): boolean {
  return journey.scene === 'm1_interrogation' && !journey.visiting && !!journey.interrogation;
}

export function interrogationPose(gesture: InterrogationGesture) {
  const t = gesture.phase === 'done' ? INTERROGATION_TIMING.coercion : gesture.elapsed;
  const action = gesture.phase === 'coercion' || gesture.phase === 'done';
  const rise = action ? ease(t, 5.1, 6.6) : 0;
  const pinned = action ? ease(t, 10.4, 12.7) : 0;
  const seated = gesture.role === 'neo' ? gesture.phase === 'file' ? ease(t, .4, 1.8) : (1 - rise) : gesture.role === 'smith' ? action ? 1 - ease(t, 7, 8.5) : 1 : 0;
  return { seated, pinned, rise,
    seal: action ? ease(t, 2.4, 4.8) : 0,
    touch: action ? ease(t, 3.1, 4.2) * (1 - ease(t, 6.3, 7.2)) : 0,
    restrain: action ? ease(t, 8.6, 9.8) : 0,
    device: action ? ease(t, 13.8, 15.3) : 0,
    release: action && t >= 17.6,
    implant: action ? ease(t, 17.6, INTERROGATION_TIMING.implanted) : 0,
    file: gesture.phase === 'file' ? ease(t, 2, 4.5) : 1,
    gait: action && t > 6.6 && t < 10.4 ? Math.sin(t * 8) : 0,
    fade: action ? ease(t, 22.5, 24) : 0,
  };
}

// Characters share one saved clock. The agents go around the ends of the table.
export function interrogationRoot(encounter: InterrogationEncounter, role: InterrogationRole) {
  const t = encounter.phase === 'done' ? INTERROGATION_TIMING.coercion : encounter.elapsed;
  const action = encounter.phase === 'coercion' || encounter.phase === 'done';
  const seat = INTERROGATION_ROOM.seat;
  if (role === 'neo') {
    if (encounter.phase === 'file') {
      const blend = ease(t, 0, 1.8);
      const turn = Math.atan2(Math.sin(-Math.PI / 2 - encounter.approach.yaw), Math.cos(-Math.PI / 2 - encounter.approach.yaw));
      return { x: mix(encounter.approach.x, seat, blend), z: mix(encounter.approach.z, 0, blend), yaw: encounter.approach.yaw + turn * blend };
    }
    return { x: action ? mix(mix(seat, 5.35, ease(t, 6.2, 7.8)), -1.05, ease(t, 9.8, 12.7)) : seat, z: 0, yaw: -Math.PI / 2 };
  }
  const bedside = INTERROGATION_ROOM.table.depth / 2 + .55;
  if (role === 'smith') return { x: action ? mix(-seat, -.05, ease(t, 9.5, 11)) : -seat, z: action ? mix(0, -bedside, ease(t, 8.5, 9.5)) : 0,
    yaw: action ? Math.PI / 2 + ease(t, 8.2, 8.6) * Math.PI / 2 - ease(t, 9.3, 9.7) * Math.PI / 2 - ease(t, 10.8, 11.5) * Math.PI / 2 : Math.PI / 2 };
  const side = role === 'agent_jones' ? -1 : 1;
  if (!action) return { x: -5.6, z: side * 4.3, yaw: Math.PI / 2 };
  const cross = ease(t, 6.4, 8.6); const close = ease(t, 8.6, 9.6); const pin = ease(t, 9.8, 12.7);
  return { x: mix(mix(-5.6, 5.35, cross), 1.2, pin), z: side * mix(4.3, bedside, close), yaw: mix(Math.PI / 2, side === 1 ? Math.PI : 0, ease(t, 8.4, 9.6)) };
}
