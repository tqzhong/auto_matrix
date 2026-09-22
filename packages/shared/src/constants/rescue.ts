import type { FilmJourney } from './film-story.js';

export type RescueLoadout = 'compact' | 'breacher' | 'rifle';
export type RescuePhase = 'briefing_ready' | 'briefing' | 'briefing_done' | 'racks_ready' | 'racks_arriving' | 'selecting' | 'equipping' | 'equipped';
export type RescueRole = 'neo' | 'trinity' | 'tank';
export interface RescuePreparation {
  phase: RescuePhase;
  elapsed: number;
  loadout?: RescueLoadout;
}
export type RescueGesture = RescuePreparation & { role: RescueRole };

export const RESCUE = {
  briefing: 8.6,
  racksArrival: 4.8,
  equip: 5.2,
  briefingRoots: {
    neo: { x: 0, z: 3.4, yaw: Math.PI },
    trinity: { x: -4.2, z: -.4, yaw: Math.PI / 2 },
    tank: { x: 4.2, z: -.4, yaw: -Math.PI / 2 },
  },
  loadoutRoots: {
    compact: { x: -8, z: -12, yaw: 0 },
    breacher: { x: 0, z: -12, yaw: 0 },
    rifle: { x: 8, z: -12, yaw: 0 },
  },
  racksRoots: {
    neo: { x: 0, z: -3.8, yaw: Math.PI },
    trinity: { x: -4.2, z: -2.5, yaw: Math.PI * .9 },
  },
  equipRoots: {
    neo: { x: 0, z: -12, yaw: Math.PI },
    trinity: { x: -4.2, z: -8.8, yaw: Math.PI * .84 },
  },
} as const;

export interface RescueLoadoutSpec {
  id: RescueLoadout;
  name: string;
  detail: string;
  magazine: number;
  damage: number;
  reloadTicks: number;
  fireInterval: number;
  aimDot: number;
}

export const RESCUE_LOADOUTS: Record<RescueLoadout, RescueLoadoutSpec> = {
  compact: { id: 'compact', name: '双持紧凑型冲锋枪', detail: '近距离压制 · 大弹匣 · 低单发伤害', magazine: 24, damage: 18, reloadTicks: 3, fireInterval: .16, aimDot: .978 },
  breacher: { id: 'breacher', name: '泵动式霰弹枪', detail: '近距离重击 · 小弹仓 · 慢速射击', magazine: 8, damage: 42, reloadTicks: 6, fireInterval: .68, aimDot: .955 },
  rifle: { id: 'rifle', name: '突击步枪', detail: '均衡射程 · 稳定伤害 · 标准换弹', magazine: 16, damage: 24, reloadTicks: 4, fireInterval: .24, aimDot: .986 },
};

export function rescueLoadout(value?: FilmJourney | RescuePreparation): RescueLoadoutSpec {
  const selected = value && 'phase' in value ? value.loadout : value?.rescue?.loadout;
  return RESCUE_LOADOUTS[selected ?? 'rifle'];
}

export function rescueLocked(journey: FilmJourney): boolean {
  if (!journey.rescue || journey.visiting) return false;
  return ['briefing', 'racks_arriving', 'equipping'].includes(journey.rescue.phase);
}

export function rescueDuration(preparation: RescuePreparation): number {
  if (preparation.phase === 'briefing') return RESCUE.briefing;
  if (preparation.phase === 'racks_arriving') return RESCUE.racksArrival;
  if (preparation.phase === 'equipping') return RESCUE.equip;
  return 0;
}

export function rescueRoot(preparation: RescuePreparation, role: RescueRole) {
  if (preparation.phase === 'briefing' || preparation.phase === 'briefing_ready' || preparation.phase === 'briefing_done') return RESCUE.briefingRoots[role];
  if (preparation.phase === 'racks_arriving' && !preparation.loadout && role !== 'tank') return RESCUE.racksRoots[role];
  if (role === 'neo') {
    const selected = RESCUE.loadoutRoots[preparation.loadout ?? 'breacher'];
    return { x: selected.x, z: selected.z + 1.7, yaw: Math.PI };
  }
  return RESCUE.equipRoots[role as 'trinity'] ?? RESCUE.equipRoots.neo;
}

export function rescueText(preparation: RescuePreparation): string {
  if (preparation.phase === 'briefing_ready') return 'Tank 已调出政府大楼结构。走到核心投影旁，按 G 把营救决定变成可执行方案。';
  if (preparation.phase === 'briefing') return preparation.elapsed < 2.8
    ? 'Tank 标出大堂安检、柱列和电梯；Morpheus 的生命信号仍在审讯楼层。'
    : preparation.elapsed < 5.8
      ? 'Neo 核对入口与撤离线。Trinity 明确表示同行，并负责左侧掩护。'
      : '三人确认：从正门制造突破，经后方电梯上楼，再从屋顶空中撤离。';
  if (preparation.phase === 'briefing_done') return '入口、掩体、电梯和屋顶撤离线已确认。进入构造体选择实际携带的武器。';
  if (preparation.phase === 'racks_ready') return '站在装载标记旁按 G。Tank 会把武器架送入白色构造体。';
  if (preparation.phase === 'racks_arriving') return preparation.elapsed < 2.4
    ? '第一排武器架从白场尽头高速接近。'
    : '其余武器架依次锁定。三套可携带配置已经就位。';
  if (preparation.phase === 'selecting') return '走近一套武器并按 G：左侧双持冲锋枪，中间霰弹枪，右侧突击步枪。';
  if (preparation.phase === 'equipping') {
    const loadout = rescueLoadout(preparation);
    return preparation.elapsed < 2.4 ? `Neo 取下${loadout.name}，检查枪机和弹匣。` : `Trinity 完成侧翼装备检查。${loadout.detail}。`;
  }
  const loadout = rescueLoadout(preparation);
  return `${loadout.name}已经装配并写入检查点。前方入口将直接载入政府大楼。`;
}

export function rescuePose(gesture: RescueGesture) {
  const t = gesture.elapsed;
  const pointWindow = gesture.role === 'tank' ? [.4, 3.1] : gesture.role === 'trinity' ? [3.2, 6.2] : undefined;
  const briefingPoint = gesture.phase === 'briefing' && pointWindow
    ? Math.max(0, Math.min(1, (t - pointWindow[0]) / .55, (pointWindow[1] - t) / .55)) : 0;
  const briefingLean = gesture.phase === 'briefing' ? Math.sin(Math.min(1, t / RESCUE.briefing) * Math.PI) : 0;
  const equip = gesture.phase === 'equipping' ? Math.sin(Math.min(1, t / 2.3) * Math.PI / 2) : gesture.phase === 'equipped' ? 1 : 0;
  const inspect = gesture.phase === 'equipping' ? Math.sin(Math.max(0, Math.min(1, (t - 1.7) / 2.2)) * Math.PI) : 0;
  return { briefingPoint, briefingLean, equip, inspect };
}
