import type { BaneEncounter, FilmJourney } from './film-story.js';

/** Dialogue is paraphrased; floor dimensions are a playable reconstruction. */
export const LOGOS_BANE = {
  entry: { x: 0, z: -31 }, approach: { x: 0, z: -5.5 }, neo: { x: 0, y: 0, z: -4, yaw: 0 },
  hostage: { x: -2.5, y: 0, z: 5.1, yaw: Math.PI }, holder: { x: -2.5, y: 0, z: 6.3, yaw: Math.PI },
  pushEnd: { x: -.9, y: 0, z: 6.5, yaw: -Math.PI / 2 }, returned: { x: -.9, y: 0, z: 8.95, yaw: Math.PI },
  gunman: { x: 1, y: 0, z: .6, yaw: Math.PI }, grapple: { x: 1, y: 0, z: -2, yaw: Math.PI },
  hatch: { x: -3.2, z: 7.8, width: 3.4, depth: 3.8, lower: -4.2, seconds: 2.2 },
  rescue: { x: -.9, z: 7.8 }, pipe: { x: 4.6, z: -.8, y: 1.6 },
  lineSeconds: 4.2, lowerSeconds: 2.4, dropSeconds: 2.8, takeSeconds: 5.4, walkSeconds: 4.4, dodgeSeconds: .65,
  punchSeconds: .7, punchImpact: .36, pipeSeconds: .9, pipeImpact: .48, climbSeconds: 4.6,
  burnDistance: 1.8,
  hostageLines: [
    { role: 'bane', text: 'Bane 叫他“安德森先生”，像是早已预料到他会下来。Neo 不明白这个称呼为什么如此熟悉。' },
    { role: 'trinity', text: 'Trinity 要 Neo 开枪，别让 Bane 得逞。Bane 把她挡在身前，威胁电枪会把两人一起烧死。' },
    { role: 'bane', text: 'Bane 要他把带来的电枪放在甲板上，然后退开。Neo 仍在寻找救出 Trinity 的机会。' },
  ],
  recognitionLines: [
    { role: 'neo', text: 'Neo 要他放人，追问他究竟是谁。那些熟悉的语气，无法与眼前这张脸相合。' },
    { role: 'bane', text: 'Bane 说，这具脆弱的肉身让他感到窒息，但他们之间的事从未结束。' },
    { role: 'neo', text: 'Neo 终于认出藏在 Bane 身体里的意识：Smith 已经来到了现实世界。' },
    { role: 'bane', text: 'Bane 否认这有什么不可能。他一步步逼近，举起电枪；Trinity 在下层寻找断路器。' },
  ],
  rescueLines: [
    { role: 'trinity', text: 'Trinity 爬回甲板，看到 Neo 的双眼已经被烧伤。她靠近他，确认他仍能听见自己。' },
    { role: 'neo', text: 'Neo 说自己还能继续，但需要 Trinity 来驾驶。对机器信号的感知，不能让双眼恢复。' },
  ],
  walls: [
    { x: -6.1, z: -6, width: .5, depth: 57, height: 7 }, { x: 6.1, z: -6, width: .5, depth: 57, height: 7 },
    { x: 0, z: 22.5, width: 12.7, depth: .5, height: 7 }, { x: 0, z: -34.5, width: 12.7, depth: .5, height: 7 },
  ],
} as const;
export type LogosBaneRole = 'neo' | 'bane' | 'trinity';
export interface LogosBaneRoot { x: number; y: number; z: number; yaw: number }
export interface LogosBaneStaging {
  version: 1;
  intro: 'waiting' | 'hostage' | 'lower_ready' | 'lowering' | 'dropping' | 'taking' | 'recognition_ready' | 'recognition' | 'done';
  elapsed: number; known: boolean; gunOnDeck: boolean;
  rescue: 'waiting' | 'opening' | 'climbing' | 'checking' | 'done'; rescueElapsed: number;
  gunHealth: number; blindHealth: number; baneHealth: number; fall: number;
  player: LogosBaneRoot;
  gunPoint?: { x: number; y: number; z: number };
  strike?: { kind: 'punch' | 'pipe'; elapsed: number; landed: boolean; from: LogosBaneRoot; to: LogosBaneRoot };
  dodge?: { kind: 'gun' | 'pipe'; elapsed: number; from: LogosBaneRoot };
  burnFrom?: LogosBaneRoot; burnTo?: LogosBaneRoot;
  paused?: string; unavailable?: string; legacy?: boolean;
}
export interface LogosBaneGesture { encounter: BaneEncounter; role: LogosBaneRole; contact?: { x: number; y: number; z: number } }
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const mix = (a: LogosBaneRoot, b: LogosBaneRoot, t: number): LogosBaneRoot => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, yaw: a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * t });
export function logosBaneActive(journey?: FilmJourney): boolean { return journey?.scene === 'm3_bane' && !journey.visiting; }
export function logosBaneBeat(encounter?: BaneEncounter): string {
  const state = encounter?.physical;
  if (state && state.intro !== 'done') return state.intro;
  if (state?.dodge) return `dodge_${state.dodge.kind}`;
  if (state?.strike) return state.strike.kind === 'punch' ? 'punch' : encounter?.counters === 2 ? 'finishing' : 'pipe_strike';
  if (state && state.rescue !== 'waiting') return state.rescue;
  return encounter?.phase ?? 'ready';
}
export function logosBaneLocked(encounter?: BaneEncounter): boolean {
  const state = encounter?.physical, beat = logosBaneBeat(encounter);
  return Boolean(state?.paused || state?.unavailable || ['hostage', 'lowering', 'dropping', 'taking', 'recognition', 'dodge_gun', 'dodge_pipe', 'punch', 'pipe_strike', 'finishing', 'opening', 'climbing', 'checking', 'gun_warning', 'gun_window', 'burning', 'pipe_window', 'failed'].includes(beat));
}
export function logosBaneLines(encounter: BaneEncounter) {
  const beat = logosBaneBeat(encounter);
  return beat === 'hostage' ? LOGOS_BANE.hostageLines : beat === 'recognition' ? LOGOS_BANE.recognitionLines : beat === 'checking' ? LOGOS_BANE.rescueLines : undefined;
}
export function logosBaneSpeaker(encounter: BaneEncounter): LogosBaneRole | undefined {
  const lines = logosBaneLines(encounter), state = encounter.physical;
  const clock = state?.rescue === 'checking' ? state.rescueElapsed : state?.elapsed ?? 0;
  return lines?.[Math.min(lines.length - 1, Math.floor(clock / LOGOS_BANE.lineSeconds))].role;
}
export function logosBaneRoot(encounter: BaneEncounter, role: LogosBaneRole): LogosBaneRoot {
  const state = encounter.physical, intro = state?.intro, player = state?.player ?? LOGOS_BANE.neo;
  if (role === 'neo') {
    if (state?.gunPoint && intro && ['lowering', 'dropping', 'taking'].includes(intro)) {
      const from = { ...player, x: state.gunPoint.x - .34, z: state.gunPoint.z - .8 };
      const amount = intro === 'lowering' ? smooth(((state.elapsed ?? 0) - 1.65) / (LOGOS_BANE.lowerSeconds - 1.65)) : 1;
      return { ...from, x: from.x - Math.sin(from.yaw) * 2.1 * amount, z: from.z - Math.cos(from.yaw) * 2.1 * amount };
    }
    if (state?.dodge) {
      const from = state.dodge.from, t = smooth(state.dodge.elapsed / LOGOS_BANE.dodgeSeconds);
      return { ...from, x: from.x - Math.cos(from.yaw) * .95 * t, z: from.z + Math.sin(from.yaw) * .95 * t };
    }
    if (state?.strike) return mix(state.strike.from, state.strike.to, smooth(state.strike.elapsed / .3));
    if (encounter.phase === 'burning' && state?.burnFrom && state.burnTo) return mix(state.burnFrom, state.burnTo, smooth(encounter.elapsed / .45));
    return player;
  }
  if (role === 'trinity') {
    const { hatch } = LOGOS_BANE;
    const lower = { x: hatch.x, y: hatch.lower, z: hatch.z, yaw: 0 };
    if (intro && ['waiting', 'hostage', 'lower_ready', 'lowering'].includes(intro)) return { ...LOGOS_BANE.hostage };
    if (intro === 'dropping') {
      const elapsed = state?.elapsed ?? 0, edge = { ...lower, y: 0 };
      return elapsed < 1 ? mix(LOGOS_BANE.hostage, edge, smooth(elapsed)) : mix(edge, lower, smooth((elapsed - 1) / 1.1));
    }
    if (state?.rescue === 'climbing') {
      const vertical = LOGOS_BANE.climbSeconds - 1, elapsed = state.rescueElapsed;
      return elapsed < vertical ? { ...lower, y: hatch.lower * (1 - smooth(elapsed / vertical)) }
        : mix({ ...lower, y: 0 }, LOGOS_BANE.returned, smooth(elapsed - vertical));
    }
    if (state?.rescue === 'checking' || state?.rescue === 'done') return { ...LOGOS_BANE.returned };
    return lower;
  }
  if (intro === 'dropping') return mix(LOGOS_BANE.holder, LOGOS_BANE.pushEnd, smooth((state?.elapsed ?? 0) / .8));
  if (intro && ['waiting', 'hostage', 'lower_ready', 'lowering'].includes(intro)) return { ...LOGOS_BANE.holder };
  const gun = state?.gunPoint ?? { x: player.x + .34, y: .26, z: player.z + .8 };
  const taking = { x: gun.x - .55, y: 0, z: gun.z + .7, yaw: Math.PI };
  const gunman = state?.gunPoint ? { ...LOGOS_BANE.gunman, x: gun.x + .6, z: gun.z - .8 } : { ...LOGOS_BANE.gunman };
  gunman.yaw = Math.atan2(player.x - gunman.x, player.z - gunman.z);
  const grapple = state?.gunPoint ? { ...gunman, z: gunman.z - 2.6 } : { ...LOGOS_BANE.grapple };
  grapple.yaw = Math.atan2(player.x - grapple.x, player.z - grapple.z);
  if (intro === 'taking') return mix(LOGOS_BANE.pushEnd, taking, smooth((state?.elapsed ?? 0) / (LOGOS_BANE.takeSeconds - 1.2)));
  if (intro === 'recognition_ready') return taking;
  if (intro === 'recognition') return mix(taking, gunman, smooth((state?.elapsed ?? 0) / LOGOS_BANE.walkSeconds));
  if (state?.dodge?.kind === 'gun') return mix(gunman, grapple, smooth(state.dodge.elapsed / LOGOS_BANE.dodgeSeconds));
  const root = encounter.phase === 'grapple' || encounter.phase === 'burning' ? grapple
    : ['pipe_window', 'counter', 'defeated'].includes(encounter.phase) ? { x: encounter.pipeX ?? LOGOS_BANE.pipe.x - .5, y: 0, z: encounter.pipeZ ?? LOGOS_BANE.pipe.z, yaw: Math.PI }
      : encounter.phase === 'blind' ? mix(grapple, { x: LOGOS_BANE.pipe.x - .5, y: 0, z: LOGOS_BANE.pipe.z, yaw: Math.PI }, smooth(encounter.elapsed / 1.4)) : gunman;
  return { ...root, yaw: Math.atan2(player.x - root.x, player.z - root.z) };
}
export function logosBaneHatch(encounter?: BaneEncounter): number {
  const state = encounter?.physical;
  if (state?.intro === 'dropping') return smooth(state.elapsed / .35) * (1 - smooth((state.elapsed - 2.1) / .7));
  return !state || state.rescue === 'waiting' ? 0 : state.rescue === 'opening' ? smooth((state.rescueElapsed - .8) / (LOGOS_BANE.hatch.seconds - .8)) : 1;
}
export function logosBaneHandle(encounter?: BaneEncounter): { x: number; y: number; z: number } {
  const h = LOGOS_BANE.hatch, angle = logosBaneHatch(encounter) * 1.43;
  return { x: h.x - h.width / 2 + Math.cos(angle) * (h.width - .2) - Math.sin(angle) * .36,
    y: .08 + Math.sin(angle) * (h.width - .2) + Math.cos(angle) * .36, z: h.z };
}
export function logosBaneInjured(encounter?: BaneEncounter): boolean { return Boolean(encounter && (encounter.checkpoint === 'blind' || ['blind', 'pipe_window', 'counter', 'defeated'].includes(encounter.phase))); }
export function logosBaneText(encounter?: BaneEncounter): string {
  const state = encounter?.physical, beat = logosBaneBeat(encounter);
  if (state?.paused) return `${state.paused} 正由另一位玩家控制，交锋停在保存的进度。`;
  if (state?.unavailable) return `${state.unavailable} 无法参加这段交锋。不会复活人物或补回伤势与物品。`;
  const lines = encounter && logosBaneLines(encounter);
  if (lines) return lines[Math.min(lines.length - 1, Math.floor((beat === 'checking' ? state!.rescueElapsed : state!.elapsed) / LOGOS_BANE.lineSeconds))].text;
  if (beat === 'waiting' || beat === 'ready') return '电力故障。Trinity 的呼喊从货舱传来，沿通道走近她。Neo 尚不知道袭击者的真实身份。';
  if (beat === 'lower_ready') return 'Trinity 被挟持。G 让 Neo 缓缓放下带来的电枪，寻找让她脱身的机会。';
  if (beat === 'lowering') return 'Neo 降低枪口，屈膝把电枪放在甲板上，然后退开。';
  if (beat === 'dropping') return 'Bane 把 Trinity 推入下层，伸手关上舱口。Neo 放下的电枪仍在甲板上。';
  if (beat === 'taking') return 'Bane 把下层舱口关上，走到 Neo 放下的电枪旁，屈身拿起它。';
  if (beat === 'recognition_ready') return 'G 追问 Bane 的身份。熟悉的称呼与语气，仍与眼前的肉身不符。';
  if (beat === 'opening') return 'Neo 摸到舱口把手，转动并抬起舱盖。';
  if (beat === 'climbing') return 'Trinity 抓住梯档爬回甲板。舱盖保持打开，Neo 在旁等待她。';
  if (beat === 'done') return 'Trinity 已回到甲板。眼伤与 Bane 的死亡保留，接下来由她驾驶 Logos。';
  return '';
}
