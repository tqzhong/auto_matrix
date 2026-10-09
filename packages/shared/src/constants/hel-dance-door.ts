export const HEL_DANCE_DOOR = { z: 1.7, width: 6, height: 9, seconds: 2.5 } as const;
export const HEL_DOOR_PUSH = { approach: .7, reach: .6, push: .8, release: .4, settle: 1.1,
  standZ: 3.05, step: .38, handX: .68, handY: 2.85, handZ: .3125, pushAngle: .2, openAngle: 1.28 } as const;

export interface HelDanceDoorEncounter {
  phase: 'sealed' | 'opening' | 'open'; elapsed: number; lastTick: number; allyTick?: number;
  physical?: boolean; approach?: { x: number; z: number; yaw: number };
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function helDanceDoorDuration(door: HelDanceDoorEncounter): number {
  return door.physical ? HEL_DOOR_PUSH.approach + HEL_DOOR_PUSH.reach + HEL_DOOR_PUSH.push + HEL_DOOR_PUSH.release + HEL_DOOR_PUSH.settle : HEL_DANCE_DOOR.seconds;
}
export function helDanceDoorAngle(door?: HelDanceDoorEncounter): number {
  if (!door || door.phase === 'sealed') return 0;
  if (door.phase === 'open') return HEL_DOOR_PUSH.openAngle;
  if (!door.physical) return smooth(door.elapsed / HEL_DANCE_DOOR.seconds) * HEL_DOOR_PUSH.openAngle;
  const contact = HEL_DOOR_PUSH.approach + HEL_DOOR_PUSH.reach, release = contact + HEL_DOOR_PUSH.push + HEL_DOOR_PUSH.release;
  return HEL_DOOR_PUSH.pushAngle * smooth((door.elapsed - contact) / HEL_DOOR_PUSH.push)
    + (HEL_DOOR_PUSH.openAngle - HEL_DOOR_PUSH.pushAngle) * smooth((door.elapsed - release) / HEL_DOOR_PUSH.settle);
}
export function helDanceDoorRoot(door: HelDanceDoorEncounter): { x: number; z: number; yaw: number } {
  const start = door.approach ?? { x: 0, z: 4, yaw: Math.PI }, enter = smooth(door.elapsed / HEL_DOOR_PUSH.approach);
  const pushing = smooth((door.elapsed - HEL_DOOR_PUSH.approach - HEL_DOOR_PUSH.reach) / HEL_DOOR_PUSH.push);
  const turn = Math.atan2(Math.sin(Math.PI - start.yaw), Math.cos(Math.PI - start.yaw));
  return { x: start.x * (1 - enter), z: start.z + (HEL_DOOR_PUSH.standZ - start.z) * enter - HEL_DOOR_PUSH.step * pushing,
    yaw: start.yaw + turn * enter };
}
export function helDanceDoorContact(door: HelDanceDoorEncounter, side: -1 | 1): { x: number; y: number; z: number; normal: { x: number; y: number; z: number } } {
  const hinge = side * HEL_DANCE_DOOR.width / 2, angle = -side * helDanceDoorAngle(door);
  const x = -hinge + side * HEL_DOOR_PUSH.handX, z = HEL_DOOR_PUSH.handZ;
  return { x: hinge + x * Math.cos(angle) + z * Math.sin(angle), y: HEL_DOOR_PUSH.handY,
    z: HEL_DANCE_DOOR.z - x * Math.sin(angle) + z * Math.cos(angle), normal: { x: Math.sin(angle), y: 0, z: Math.cos(angle) } };
}
export function helDanceDoorGrip(door: HelDanceDoorEncounter): number {
  const contact = HEL_DOOR_PUSH.approach + HEL_DOOR_PUSH.reach;
  return smooth((door.elapsed - HEL_DOOR_PUSH.approach) / HEL_DOOR_PUSH.reach)
    * (1 - smooth((door.elapsed - contact - HEL_DOOR_PUSH.push) / HEL_DOOR_PUSH.release));
}
export function helDanceDoorText(door: HelDanceDoorEncounter): string {
  if (!door.physical) return '推开舞池重门';
  const t = door.elapsed, contact = HEL_DOOR_PUSH.approach + HEL_DOOR_PUSH.reach;
  return t < HEL_DOOR_PUSH.approach ? '走近重门' : t < contact ? '双手抵住门板'
    : t < contact + HEL_DOOR_PUSH.push ? '向前推开重门' : t < contact + HEL_DOOR_PUSH.push + HEL_DOOR_PUSH.release ? '收回双手' : '重门继续向内打开';
}
