import type { FilmJourney } from './film-story.js';
import { FILM_SETS } from './film-sets.js';
import { SERAPH_ORACLE } from './seraph-oracle.js';

export type SeraphDoorScene = 'm2_seraph' | 'm2_backdoors';
export type SeraphDoorPhase = 'following' | 'ready' | 'approaching' | 'retrieving' | 'inserting' | 'unlocking' | 'withdrawing' | 'grasping' | 'opening' | 'done';
export interface SeraphDoorBody { x: number; z: number; yaw: number }
export interface SeraphDoorEncounter {
  scene: SeraphDoorScene; phase: SeraphDoorPhase; elapsed: number; door: number;
  neo: SeraphDoorBody; seraph: SeraphDoorBody; route: { x: number; z: number }[]; cursor: number;
}
export type SeraphDoorGesture = Pick<SeraphDoorEncounter, 'scene' | 'phase' | 'elapsed' | 'door' | 'seraph'> & { role: 'neo' | 'seraph' };
export const SERAPH_DOOR = { hingeX: -2.6, width: 5.2, depth: .28, height: 7.55, openAngle: -Math.PI / 2, radius: 1.2, speed: 3.1, waitRange: 8,
  retrieving: .65, inserting: .8, unlocking: .7, withdrawing: .65, grasping: .55, opening: 2.4,
  handle: { x: 4.4, y: 3.65, z: .26, radius: .17 }, lock: { x: 4.4, y: 3.36, z: .14 }, keyTip: .27 } as const;
export const SERAPH_DOOR_ROLES = ['neo', 'seraph'] as const;
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function seraphDoorSet(scene: SeraphDoorScene): string { return scene === 'm2_seraph' ? 'film_seraph_teahouse' : 'film_backdoor_hall'; }
export function seraphDoorZ(scene: SeraphDoorScene): number { return -FILM_SETS[seraphDoorSet(scene)].depth / 2 + 1.63; }
export function seraphDoorAnchor(scene: SeraphDoorScene) { return scene === 'm2_seraph' ? SERAPH_ORACLE.tea.door : SERAPH_ORACLE.hall.door; }
export function seraphDoorActive(journey?: FilmJourney): boolean { return Boolean(journey && !journey.visiting && (journey.scene === 'm2_seraph' && journey.step >= 1 || journey.scene === 'm2_backdoors')); }
export function seraphDoorLocked(state?: Pick<SeraphDoorEncounter, 'phase'>): boolean { return Boolean(state && !['following','ready','done'].includes(state.phase)); }
export function seraphDoorAngle(door: number): number { return door === 0 ? 0 : door * SERAPH_DOOR.openAngle; }
export function seraphDoorStance(scene: SeraphDoorScene, door: number): SeraphDoorBody {
  const angle = seraphDoorAngle(door), c = Math.cos(angle), s = Math.sin(angle);
  return { x: SERAPH_DOOR.hingeX + 4.1 * c + 1.25 * s, z: seraphDoorZ(scene) - 4.1 * s + 1.25 * c, yaw: Math.PI + angle };
}
export function seraphDoorHandle(state: Pick<SeraphDoorEncounter, 'scene' | 'door'>) {
  const h = SERAPH_DOOR.handle, angle = seraphDoorAngle(state.door), z = h.z + h.radius;
  return { x: SERAPH_DOOR.hingeX + h.x * Math.cos(angle) + z * Math.sin(angle), y: h.y,
    z: seraphDoorZ(state.scene) - h.x * Math.sin(angle) + z * Math.cos(angle) };
}
function mix(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }; }
export function seraphDoorKey(state: SeraphDoorGesture) {
  const b = state.seraph, neck = { x: b.x + .38 * Math.sin(b.yaw), y: 3.45, z: b.z + .38 * Math.cos(b.yaw) }, lock = SERAPH_DOOR.lock;
  const inserted = { x: SERAPH_DOOR.hingeX + lock.x, y: lock.y, z: seraphDoorZ(state.scene) + lock.z + SERAPH_DOOR.keyTip };
  const blend = state.phase === 'inserting' ? smooth(state.elapsed / SERAPH_DOOR.inserting) : state.phase === 'unlocking' ? 1 : state.phase === 'withdrawing' ? 1 - smooth(state.elapsed / SERAPH_DOOR.withdrawing) : 0;
  const turn = state.phase === 'unlocking' ? smooth(state.elapsed / SERAPH_DOOR.unlocking) : state.phase === 'withdrawing' ? 1 - smooth(state.elapsed / SERAPH_DOOR.withdrawing) : 0;
  return { ...mix(neck, inserted, blend), yaw: b.yaw * (1 - blend), tilt: Math.PI / 2 * blend, turn: Math.PI / 2 * turn };
}
export function seraphDoorPalm(state: SeraphDoorGesture) {
  const key = seraphDoorKey(state), hold = { x: key.x, y: key.y, z: key.z + .06 }, handle = seraphDoorHandle(state);
  if (state.phase === 'opening') return { ...handle, weight: 1 };
  if (state.phase === 'grasping') return { ...mix(hold, handle, smooth(state.elapsed / SERAPH_DOOR.grasping)), weight: 1 };
  return { ...hold, weight: state.phase === 'retrieving' ? smooth(state.elapsed / SERAPH_DOOR.retrieving) : ['inserting','unlocking','withdrawing'].includes(state.phase) ? 1 : 0 };
}
export function seraphDoorProgress(journey: FilmJourney | undefined, scene: SeraphDoorScene): number {
  return journey?.scene === scene && journey.seraphDoor?.scene === scene ? journey.seraphDoor.door
    : journey?.completed.includes(scene) || journey?.scene === scene && journey.step >= 2 ? 1 : 0;
}
export function seraphDoorText(state: SeraphDoorEncounter): string {
  if (state.phase === 'following') return '跟上 Seraph 穿过白色走廊；他会在前方等你。';
  if (state.phase === 'ready') return '跟 Seraph 到门旁，按 G 让他用钥匙开门。';
  if (state.phase === 'approaching') return 'Seraph 正沿走道走到锁边，Neo 让出门扇转动的位置。';
  if (state.phase === 'retrieving') return 'Seraph 从领口取下钥匙。';
  if (state.phase === 'inserting') return 'Seraph 把钥匙插进实际锁孔。';
  if (state.phase === 'unlocking') return 'Seraph 正转动钥匙开锁。';
  if (state.phase === 'withdrawing') return '锁已打开，Seraph 抽回并收好钥匙。';
  if (state.phase === 'done') return '门已打开，走到敞开的门道，再按 G 跟 Seraph 进入另一侧。';
  return 'Seraph 握住门把，沿着门扇实际推开这道门。';
}
