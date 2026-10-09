export const HEL_ELEVATOR = {
  doorZ: 24.6, doorWidth: 8.8, doorHeight: 8.8, seconds: 7.6,
  upper: 12, press: 1.1, opening: 1.65,
  button: { x: -3.45, y: 2.45, z: 26.48 },
  approach: { x: -2.6, z: 26.95, yaw: Math.PI },
  gate: { x: .3, z: 25.7, yaw: Math.PI },
  passengers: { morpheus: { x: -1.9, z: 33.5 }, seraph: { x: 1.9, z: 32.8 } },
} as const;

export interface HelElevatorEncounter {
  phase: 'ready' | 'descending' | 'arrived' | 'opening' | 'open'; elapsed: number; lastTick: number;
  physical?: boolean; gateElapsed?: number; approach?: { x: number; z: number; yaw: number };
  paused?: string; unavailable?: string;
}
export interface HelElevatorGesture {
  role: 'trinity' | 'morpheus' | 'seraph'; phase: HelElevatorEncounter['phase']; elapsed: number; gateElapsed: number;
}
const smooth = (t: number): number => { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p); };

/** The upper landing and the coat check are physically different levels. */
export function helElevatorFloor(lift?: HelElevatorEncounter): number {
  if (!lift?.physical) return 0;
  if (lift.phase === 'ready') return HEL_ELEVATOR.upper;
  if (lift.phase !== 'descending') return 0;
  return HEL_ELEVATOR.upper * (1 - smooth((lift.elapsed - HEL_ELEVATOR.press) / (HEL_ELEVATOR.seconds - HEL_ELEVATOR.press)));
}
export function helElevatorGate(lift?: HelElevatorEncounter): number {
  if (lift?.phase === 'open') return 1;
  return lift?.phase === 'opening' ? smooth((lift.gateElapsed ?? 0) / HEL_ELEVATOR.opening) : 0;
}
export function helElevatorHandle(lift?: HelElevatorEncounter): { x: number; y: number; z: number } {
  return { x: .15 - helElevatorGate(lift) * 9, y: 2.95, z: HEL_ELEVATOR.doorZ + .3 };
}
export function helElevatorTrinityRoot(lift: HelElevatorEncounter): { x: number; z: number; yaw: number } {
  const start = lift.approach ?? (lift.phase === 'opening' ? HEL_ELEVATOR.gate : HEL_ELEVATOR.approach);
  if (lift.phase === 'opening') {
    const t = Math.min(1, (lift.gateElapsed ?? 0) / .35);
    return { x: start.x + (HEL_ELEVATOR.gate.x - start.x) * t - Math.min(1, (lift.gateElapsed ?? 0) / .6) * 1.5,
      z: start.z + (HEL_ELEVATOR.gate.z - start.z) * t, yaw: Math.PI };
  }
  const press = Math.min(1, lift.elapsed / .35), retreat = Math.max(0, Math.min(1, (lift.elapsed - .85) / 1.25));
  const x = start.x + (HEL_ELEVATOR.approach.x - start.x) * press, z = start.z + (HEL_ELEVATOR.approach.z - start.z) * press;
  return { x: x + (-.65 - x) * retreat, z: z + (30.5 - z) * retreat, yaw: Math.PI };
}
export function helElevatorText(lift?: HelElevatorEncounter): string {
  if (lift?.paused) return `${lift.paused} 正由另一位玩家控制，电梯与当前动作已停在原处。`;
  if (lift?.unavailable) return `${lift.unavailable} 无法同行，电梯停在当前检查点。`;
  if (lift?.phase === 'arrived') return '电梯已经到层。走近铁门把手，按 G 亲自拉开，再走进衣帽间。';
  if (lift?.phase === 'opening') return 'Trinity 拉动铁门，左手随把手滑动，松手后门继续沿轨道滑开。';
  if (lift?.phase === 'descending') return lift.elapsed < 1.1 ? 'Trinity 伸手按下红色 HEL 按钮。'
    : lift.elapsed < 3.8 ? 'Seraph 提醒两人：俱乐部会检查武器；如果顺利，只会遇到一名看守。'
      : lift.elapsed < 5.6 ? 'Trinity 追问：如果不顺利呢？' : 'Seraph 回答：那就会遇到更多人。铁笼继续下降。';
  return '走近红色 HEL 按钮，按 G 开始下降。';
}
