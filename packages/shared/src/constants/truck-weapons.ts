import type { TruckRoad, TruckRoot } from './trucks.js';

export const TRUCK_WEAPONS = { rounds: 8, fireInterval: .22, gunRush: .8, gunDisarm: .9, slash: .65,
  counter: 1, guardStart: .2, guardEnd: .65, counterContact: .7, swordDisarm: 1.2, release: .55, pairDistance: 1.85 } as const;
export type TruckWeaponPhase = 'gun' | 'gun_rush' | 'gun_disarm' | 'blade' | 'slash' | 'counter' | 'sword_disarm' | 'unarmed';
export interface TruckWeaponDrop {
  at: number;
  root: TruckRoot;
  pitch: number;
}
export interface TruckWeapons {
  phase: TruckWeaponPhase;
  elapsed: number;
  total: number;
  rounds: number;
  shots: number;
  aimed: number;
  slashes: number;
  parries: number;
  johnson: TruckRoot;
  guarded?: boolean;
  contact?: boolean;
  shotAt?: number;
  shotYaw?: number;
  shotPitch?: number;
  pair?: { morpheus: TruckRoot; agent_johnson: TruckRoot };
  gun?: TruckWeaponDrop;
  sword?: TruckWeaponDrop;
}
export interface TruckWeaponGesture extends TruckWeapons {
  role: 'morpheus' | 'agent_johnson';
  bodies: { morpheus: TruckRoot; agent_johnson: TruckRoot };
  truck: TruckRoad['truck'];
}

export function newTruckWeapons(): TruckWeapons {
  return { phase: 'gun', elapsed: 0, total: 0, rounds: TRUCK_WEAPONS.rounds, shots: 0, aimed: 0, slashes: 0, parries: 0,
    johnson: { x: 0, y: 6.6, z: -7.5, yaw: 0 } };
}
export const truckWeaponsLocked = (state: TruckWeapons | undefined) => Boolean(state && !['gun', 'blade', 'unarmed'].includes(state.phase));
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export function truckWeaponPairRoot(state: TruckWeapons, role: TruckWeaponGesture['role']): TruckRoot | undefined {
  if (!state.pair) return;
  const root = { ...state.pair[role] };
  if (role === 'agent_johnson' && (state.phase === 'gun_rush' || state.phase === 'counter')) {
    const target = state.pair.morpheus, dx = root.x - target.x, dz = root.z - target.z, length = Math.hypot(dx, dz);
    const t = smooth(state.elapsed / (state.phase === 'gun_rush' ? TRUCK_WEAPONS.gunRush : .25)), distance = Math.max(0, length - TRUCK_WEAPONS.pairDistance);
    if (length > .01) { root.x -= dx / length * distance * t; root.z -= dz / length * distance * t; }
  }
  if (role === 'agent_johnson' && state.phase === 'slash') {
    const target = state.pair.morpheus, dodge = smooth(state.elapsed / .12) * (1 - .8 * smooth((state.elapsed - .5) / .15));
    root.x += Math.cos(target.yaw) * .85 * dodge; root.z -= Math.sin(target.yaw) * .85 * dodge;
    root.x += Math.sin(target.yaw) * .7 * dodge; root.z += Math.cos(target.yaw) * .7 * dodge;
    root.yaw -= .35 * dodge;
  }
  return root;
}

/** Palm centres and weapon orientation are shared by the authoritative release and the rendered grip. */
export function truckWeaponGrip(state: TruckWeapons, body: TruckRoot, weapon: 'gun' | 'sword'): TruckRoot & { pitch: number } {
  const swing = state.phase === 'slash' ? Math.sin(Math.PI * smooth(state.elapsed / TRUCK_WEAPONS.slash)) : 0;
  const disarm = state.phase === (weapon === 'gun' ? 'gun_disarm' : 'sword_disarm') ? smooth(state.elapsed / TRUCK_WEAPONS.release) : 0;
  const x = weapon === 'gun' ? -.62 - disarm * .12 : .62 - swing * .35;
  const y = weapon === 'gun' ? 2.6 + disarm * .1 : 2.4 + swing * .45;
  const z = weapon === 'gun' ? .95 : .65 + swing * .4;
  const recoil = weapon === 'gun' && state.shotAt !== undefined ? Math.sin(Math.PI * Math.max(0, Math.min(1, (state.total - state.shotAt) / .16))) * .07 : 0;
  return { x: body.x + Math.cos(body.yaw) * x + Math.sin(body.yaw) * z, y: body.y + y + recoil,
    z: body.z - Math.sin(body.yaw) * x + Math.cos(body.yaw) * z,
    yaw: body.yaw + (weapon === 'sword' ? .25 - swing * 1.2 : 0), pitch: weapon === 'sword' ? -.82 + swing * .7 : state.shotPitch ?? 0 };
}

export function truckWeaponDropPose(drop: TruckWeaponDrop, total: number, weapon: 'gun' | 'sword'): TruckRoot & { pitch: number; roll: number; landed: boolean } {
  const t = Math.max(0, total - drop.at), floor = 6.6 + (weapon === 'gun' ? .085 : .155);
  const height = drop.root.y - floor, velocity = weapon === 'gun' ? 1.4 : 2;
  const landing = (velocity + Math.sqrt(velocity * velocity + 19.6 * Math.max(0, height))) / 9.8;
  const age = Math.min(t, landing), settle = smooth(age / Math.min(.6, landing));
  return { x: drop.root.x + (weapon === 'gun' ? .65 : -.35) * age, y: Math.max(floor, drop.root.y + velocity * age - 4.9 * age * age),
    z: drop.root.z + .35 * age, yaw: drop.root.yaw + .6 * settle, pitch: drop.pitch * (1 - settle),
    roll: (weapon === 'gun' ? Math.PI / 2 : 0) * settle, landed: t >= landing };
}

export function truckWeaponsText(state: TruckWeapons): string {
  if (state.phase === 'gun') return `Johnson 正避开枪口。鼠标瞄准，左键 / T 射击。弹药 ${state.rounds} / ${TRUCK_WEAPONS.rounds}。`;
  if (state.phase === 'gun_rush') return 'Johnson 突然逼近。观察他的起手，准备 X 格挡。';
  if (state.phase === 'gun_disarm') return state.gun ? '手枪被打落到车顶，左手的刀还在。' : state.guarded ? '你护住手腕，Johnson 仍在夺枪。左手的刀还在。' : 'Johnson 扣住手腕，准备打落手枪。X 可以减轻这次冲击。';
  if (state.phase === 'blade') return `枪已落在车顶。靠近并面对 Johnson，F 挥刀；他反击起手时按 X 格挡。有效格挡 ${state.parries} / 2。`;
  if (state.phase === 'slash') return '刀锋划过。Johnson 转身避开，观察接下来的反击。';
  if (state.phase === 'counter') return state.guarded ? '格挡成功，保持立足点。' : state.elapsed < TRUCK_WEAPONS.guardStart ? 'Johnson 抬臂起手，等待接触前的时机。'
    : state.elapsed <= TRUCK_WEAPONS.guardEnd ? '现在按 X，用刀护住上身！' : '反击落下，重新稳定重心。';
  if (state.phase === 'sword_disarm') return 'Johnson 拨开刀锋、撞开手腕。刀落到车顶，转入徒手迎战。';
  return '武器已脱手。F 连击，X 闪避；站稳车顶，继续徒手交锋。';
}
