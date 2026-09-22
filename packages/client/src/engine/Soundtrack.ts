import { FILM_SCENE_BY_ID, NEO_CHAPTERS, NEO_MISSIONS, distance, type AgentState, type SandboxState } from '@auto_matrix/shared';

export const MUSIC = {
  ordinary: { mood: '日常生活 · 让城市和生活保持轻松', level: .55 },
  office: { mood: '办公室 · 工作时轻声伴奏', level: .35 },
  cafe: { mood: '咖啡与朋友 · 轻松交谈', level: .5 },
  club: { mood: '酒吧与夜店 · 聚会交谈的背景音乐', level: .6 },
  restaurant: { mood: '梅罗文加的餐厅 · 优雅表象下的博弈', level: .55 },
  night: { mood: '深夜与休息 · 孤独与悬念', level: .4 },
  anomaly: { mood: '现实的裂缝 · 异常出现时的不安', level: .65 },
  contact: { mood: '初见崔尼蒂 · 神秘访客带来线索', level: .6 },
  awakening: { mood: '红蓝药丸与觉醒 · 镜面崩解，认识真实', level: .7 },
  matrix: { mood: '矩阵探索 · 潜藏的追踪与危险', level: .65 },
  training: { mood: '道场 · 学会面对规则', level: .8 },
  combat: { mood: '营救与地铁决斗 · 正面对抗特工', level: .95 },
  chateau: { mood: '餐厅与城堡交锋 · 钥匙匠营救战', level: .95 },
  infiltration: { mood: '潜入与封锁 · 威胁正在逼近', level: .65 },
  chase: { mood: '高速公路 · 护送与追兵', level: .9 },
  swarm: { mood: 'Smith 围攻 · 不断增加的复制体', level: .95 },
  oracle: { mood: '先知与哲学选择 · 对话与沉思', level: .45 },
  zion: { mood: '锡安与飞船 · 战争阴影下的生活', level: .5 },
  mobil: { mood: 'Mobil 车站 · 迷失在连接之间', level: .55 },
  siege: { mood: '锡安防线 · 守住船坞', level: .9 },
  bane: { mood: '贝恩遭遇 · 真实世界里的 Smith', level: .95 },
  farewell: { mood: '崔尼蒂告别 · 天空、失去与承诺', level: .6 },
  source: { mood: '建筑师与机器核心 · 对话与停战', level: .65 },
  final: { mood: '最终决战 · 雨中的最后一战', level: 1 },
  the_one: { mood: '救世主觉醒 · 重新看见世界的可能', level: .85 },
  dawn: { mood: '循环的终点 · 战争之后的清晨', level: .65 },
} as const;
export type MusicCue = keyof typeof MUSIC;
export interface MusicScene {
  player?: AgentState;
  sandbox?: SandboxState;
  time: number;
  matrix: boolean;
  running: boolean;
}

// Ordinary life remains driven by place and time; later scenes only score their destination.
const CHAPTER_MUSIC: Record<string, MusicCue> = {
  contact: 'contact', office_call: 'anomaly', pill: 'awakening', construct: 'awakening', training: 'training',
  oracle_first: 'oracle', betrayal: 'infiltration', rescue: 'combat', subway: 'combat', the_one: 'the_one',
  zion: 'zion', oracle_second: 'oracle', copies: 'swarm', keymaker: 'restaurant', freeway: 'chase',
  architect: 'source', trinity_choice: 'oracle', mobil: 'mobil', sati: 'oracle', oracle_last: 'oracle',
  siege: 'siege', bane: 'bane', last_sky: 'farewell', pact: 'source', final: 'final', source: 'source', terms: 'source', dawn: 'dawn',
};
const MISSION_MUSIC: Record<string, MusicCue> = {
  rabbit: 'awakening', dojo: 'training', lobby_rescue: 'combat', subway_duel: 'combat', keymaker: 'restaurant',
  burly_brawl: 'swarm', freeway: 'chase', architect: 'source', mobil: 'mobil', zion_siege: 'siege',
  bane_encounter: 'bane', machine_pact: 'source', smith_final: 'final',
};
export function isActionMusic(cue: MusicCue): boolean {
  return ['combat', 'training', 'chateau', 'chase', 'swarm', 'siege', 'bane', 'final'].includes(cue);
}

export function musicForScene({ player, sandbox, time, matrix }: MusicScene): MusicCue {
  if (!player) return matrix ? 'matrix' : 'zion';
  if (player.status !== 'alive') return 'oracle';
  const journey = sandbox?.neoLife?.journey;
  if (journey?.actor === player.id) {
    const scene = FILM_SCENE_BY_ID[journey.visiting ?? journey.scene];
    if (scene?.set === player.currentLocation) return scene.music;
  }
  const life = player.id === 'neo' ? sandbox?.neoLife : undefined;
  const chapter = life && NEO_CHAPTERS[life.chapter];
  const threats = sandbox?.threats.filter(threat =>
    threat.health > 0 && threat.target === player.id && threat.matrix === player.isInMatrix && distance(threat.position, player.position) < 45) ?? [];
  const missions = life?.missions ?? sandbox?.missions;
  const mission = NEO_MISSIONS.find(item => {
    const progress = missions?.[item.id];
    return progress?.status === 'active' && progress.actor === player.id &&
      (item.location === player.currentLocation || threats.some(threat => threat.mission === item.id && (threat.campaign === 'neo') === Boolean(life)));
  });
  const setPiece = mission?.id === 'smith_final' && missions![mission.id].stage === 'choice' ? 'source'
    : chapter?.location === player.currentLocation ? CHAPTER_MUSIC[chapter.id]
    : mission ? MISSION_MUSIC[mission.id] : undefined;
  if (player.currentAction?.type === 'attack' || threats.length) return player.currentLocation === 'merovingians_restaurant' ? 'chateau'
    : setPiece && isActionMusic(setPiece) ? setPiece
    : threats.length && threats.every(threat => threat.kind === 'training') ? 'training' : 'combat';
  if (chapter?.id === 'dawn') return 'dawn';
  if (setPiece) return setPiece;
  if (!player.isInMatrix) return 'zion';
  if (life?.anomaly?.location === player.currentLocation && distance(life.anomaly.position, player.position) < 30) return 'anomaly';
  if (player.currentLocation === 'nightclub') return 'club';
  if (player.currentLocation === 'oracles_apartment') return 'oracle';
  if (player.currentLocation === 'architects_chamber') return 'source';
  if (player.currentLocation === 'training_dojo') return 'training';
  if (player.currentLocation === 'mobil_ave') return 'mobil';
  if (player.currentLocation === 'merovingians_restaurant') return 'restaurant';
  if (player.currentLocation === 'corner_cafe') return 'cafe';
  if (!player.isAwakened) {
    if (life?.activity?.id === 'sleep' || time < 6000 || time >= 20000) return 'night';
    return player.currentLocation === 'metacortex_office' ? 'office' : 'ordinary';
  }
  return 'matrix';
}

// Hold the score through brief boundary crossings and the gaps between blows.
export class MusicDirector {
  private current: MusicCue = 'matrix';
  private candidate: MusicCue = 'matrix';
  private since = 0;
  private combatUntil = 0;
  private combatCue: MusicCue = 'combat';
  private identity = '';

  impact(now: number): void {
    this.combatUntil = now + 8000;
    this.combatCue = isActionMusic(this.current) ? this.current : 'combat';
  }
  update(scene: MusicScene, now: number): MusicCue {
    const life = scene.player?.id === 'neo' ? scene.sandbox?.neoLife : undefined;
    const identity = `${scene.player?.id ?? 'observer'}:${scene.player?.isInMatrix ?? scene.matrix}:${scene.player?.status ?? ''}:${life?.cycle}:${life?.chapter}:${scene.sandbox?.neoLife?.journey?.scene}:${scene.sandbox?.neoLife?.journey?.visiting}`;
    const changed = identity !== this.identity;
    if (changed) { this.identity = identity; this.combatUntil = 0; }
    let next = musicForScene(scene);
    if (isActionMusic(next)) { this.combatUntil = now + 8000; this.combatCue = next; }
    if (['source', 'farewell', 'the_one', 'dawn'].includes(next)) this.combatUntil = 0;
    if (scene.player?.status === 'alive' && now < this.combatUntil) next = this.combatCue;
    if (next !== this.candidate) { this.candidate = next; this.since = now; }
    if (changed || isActionMusic(next) || now - this.since >= 2000) this.current = next;
    return this.current;
  }
}
