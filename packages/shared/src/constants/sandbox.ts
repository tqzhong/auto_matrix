import { locationEntrance } from './city.js';
import type { AgentState, Vector3 } from '../types/agent.js';
import type { ItemId, SandboxState } from '../types/sandbox.js';

export const ITEMS: Record<ItemId, { name: string; symbol: string; description: string }> = {
  code: { name: '代码碎片', symbol: '01', description: '破解终端、制作程序工具的原料。' },
  scrap: { name: '机械零件', symbol: '▧', description: '搜索补给箱获得，用于装备与建造。' },
  medkit: { name: '医疗包', symbol: '+', description: '恢复 40 点生命；生存技能提高恢复量。' },
  decoder: { name: '解码器', symbol: '⌘', description: '解开钥匙匠的牢门；消耗品。' },
  emp: { name: 'EMP', symbol: 'ϟ', description: '对 35 米内敌对程序造成 45 点伤害并瘫痪 6 秒。' },
  beacon: { name: '安全屋信标', symbol: '⌂', description: '在脚前搭建安全屋：恢复生命、降低追踪、接入电话网络。' },
  barricade: { name: '路障', symbol: '▰', description: '阻挡追兵；可以跳过、拆回，也会被敌人摧毁。' },
};
export const RECIPES: Partial<Record<ItemId, Partial<Record<ItemId, number>>>> = {
  medkit: { code: 2, scrap: 2 }, decoder: { code: 6, scrap: 2 }, emp: { code: 5, scrap: 4 },
  beacon: { code: 8, scrap: 6 }, barricade: { scrap: 3 },
};
export const SKILLS = {
  combat: { name: '武术下载', description: '每级增加 6 点对敌对程序的近战伤害。' },
  hacking: { name: '代码解析', description: '每级缩短终端破解时间，增加代码收获。' },
  survival: { name: '锡安生存', description: '每级增加 10 点医疗恢复，提升安全屋疗效。' },
};
export const FILMS = [
  { number: 1, title: '黑客帝国', subtitle: 'THE MATRIX', theme: '觉醒 · 训练 · 营救' },
  { number: 2, title: '重装上阵', subtitle: 'RELOADED', theme: '钥匙匠 · 高速公路 · 两扇门' },
  { number: 3, title: '矩阵革命', subtitle: 'REVOLUTIONS', theme: '迷失 · 锡安 · 机器城 · 决战' },
];
export interface MissionDef {
  id: string;
  film: number;
  name: string;
  location: string;
  description: string;
  objective: string;
  mode: 'choice' | 'combat' | 'escort' | 'hack';
  reward: number;
  requires?: string;
  cost?: Partial<Record<ItemId, number>>;
  choices?: { id: string; label: string; consequence: string }[];
}
export const MISSIONS: MissionDef[] = [
  { id: 'rabbit', film: 1, name: '追随白兔', location: 'nightclub', mode: 'choice', reward: 30,
    description: '有人在 Goa 留下一条通往真相的线路。任何身份都可以选择揭开自己的世界。',
    objective: '到夜店的白兔终端按 G，再决定是否接过红色药丸。',
    choices: [{ id: 'red', label: '红色药丸 · 看见真相', consequence: '当前角色觉醒，追踪上升，解锁训练与电话接入。' }, { id: 'blue', label: '蓝色药丸 · 暂时回归生活', consequence: '降低追踪，保留以后重新选择的机会。' }] },
  { id: 'dojo', film: 1, name: '我会功夫', location: 'training_dojo', mode: 'combat', reward: 40, requires: 'rabbit',
    description: '接线员装载了武术训练程序。学会闪避、跳跃与反击，再去面对真正的特工。', objective: '前往训练场按 G 启动，使用 F 击败两名训练程序。' },
  { id: 'lobby_rescue', film: 1, name: '营救墨菲斯', location: 'lobby', mode: 'combat', reward: 60, requires: 'dojo',
    description: '政府大楼的审讯节点即将泄露锡安的接入密钥。突破守卫并销毁审讯记录。', objective: '抵达政府大楼终端，按 G 启动营救，击败三名守卫。' },
  { id: 'keymaker', film: 2, name: '钥匙匠', location: 'merovingians_restaurant', mode: 'hack', reward: 50, requires: 'lobby_rescue', cost: { decoder: 1 },
    description: '梅罗文加将钥匙匠的出口权限锁在 Le Vrai 的后台。解码器能破解这道门。', objective: '制作一个解码器，带到 Le Vrai 的任务终端并按 G 破解。' },
  { id: 'freeway', film: 2, name: '高速公路逃亡', location: 'freeway', mode: 'escort', reward: 70, requires: 'keymaker',
    description: '钥匙匠已脱困，但追踪程序沿公路赶来。留在他身边，保护他抵达出口。', objective: '前往高速公路按 G 开始，护送钥匙匠 240 米并清除追兵；F 攻击、2 使用 EMP。' },
  { id: 'architect', film: 2, name: '架构师的两扇门', location: 'architects_chamber', mode: 'choice', reward: 60, requires: 'freeway',
    description: '系统希望你按它的答案作答。你可以维护秩序，也可以冒险救下一个人。', objective: '抵达架构师终端，选择你的答案。',
    choices: [{ id: 'trinity', label: '救下 Trinity', consequence: 'Trinity 恢复生命，锡安士气 +15；安全等级 +15。' }, { id: 'stability', label: '稳定系统', consequence: '安全等级 -20，Smith 趁机扩散，感染 +12。' }] },
  { id: 'mobil', film: 3, name: '移动大道', location: 'mobil_ave', mode: 'hack', reward: 55, requires: 'architect', cost: { code: 8 },
    description: '火车人的边界站隔断了真实世界的通信。重写站台协议，重新连接 Logos 与机器城。', objective: '携带 8 个代码碎片，前往移动大道终端按 G 解除封锁。' },
  { id: 'zion_siege', film: 3, name: '守住锡安', location: 'zion_dock', mode: 'combat', reward: 90, requires: 'mobil', cost: { emp: 1 },
    description: '乌贼正在钻入码头。用备好的 EMP 启动防御，路障与安全屋能支撑你的战斗。', objective: '带一个 EMP 到锡安码头按 G 启动防线，消灭四只乌贼。' },
  { id: 'machine_pact', film: 3, name: '与机器谈判', location: 'machine_city', mode: 'choice', reward: 50, requires: 'zion_siege',
    description: 'Smith 已成为双方共同的威胁。机器要求一份能够兑现的协议。', objective: '经电话网络抵达机器城，与主机提出解决方案。',
    choices: [{ id: 'pact', label: '以清除 Smith 换取停战', consequence: '机器暂缓进攻，锡安防御 +20，最终战获得两个 EMP。' }, { id: 'independent', label: '依靠自己的力量终结病毒', consequence: '获得更多代码与经验；最终战不获得机器支援。' }] },
  { id: 'smith_final', film: 3, name: '雨中的最后一战', location: 'times_square', mode: 'combat', reward: 120, requires: 'machine_pact',
    description: 'Smith 的复制体淹没了城市。击败病毒核心后，由你决定下一段世界历史。', objective: '在时代广场启动最终战，击败 Smith 核心与复制体，再选择结局。',
    choices: [{ id: 'peace', label: '停战 · 自由选择', consequence: '清除感染、降低安全等级，世界进入可继续游玩的和平时期。' }, { id: 'reboot', label: '重载矩阵', consequence: '刷新资源与随机种子，保留人物、建筑和全部记忆。' }, { id: 'liberation', label: '公开真相', consequence: '唤醒城市居民，安全等级升高，继续自由反抗。' }] },
];

export const NEO_ENCOUNTERS: MissionDef[] = [
  { id: 'subway_duel', film: 1, name: '站台决斗', location: 'subway_station', description: '与 Smith 在站台正面交锋。', objective: '击退 Smith，守住出口。', mode: 'combat', reward: 60, requires: 'lobby_rescue' },
  { id: 'burly_brawl', film: 2, name: '复制体围攻', location: 'central_park', description: '失控的 Smith 开始无限复制。', objective: '使用闪避与角色技能击退复制体。', mode: 'combat', reward: 70, requires: 'subway_duel' },
  { id: 'bane_encounter', film: 3, name: 'Bane 的袭击', location: 'nebuchadnezzar', description: '失控程序借人体越过世界边界。', objective: '在无法使用矩阵能力的情况下击退感染者。', mode: 'combat', reward: 65, requires: 'zion_siege' },
];

export function missionPosition(id: string): Vector3 {
  const mission = [...MISSIONS, ...NEO_ENCOUNTERS].find(item => item.id === id)!;
  const entry = locationEntrance(mission.location);
  return { ...entry, x: entry.x - 12, z: entry.z + 6 };
}
export function skillPoints(profile: SandboxState['profiles'][string]): number {
  return Math.max(0, Math.floor(profile.xp / 50) - Object.values(profile.skills).reduce((sum, level) => sum + level, 0));
}
export function nearTransit(agent: AgentState, state: SandboxState): boolean {
  return [...state.nodes.filter(node => node.kind === 'phone'), ...state.structures.filter(structure => structure.kind === 'beacon')]
    .some(node => node.matrix === agent.isInMatrix && Math.hypot(node.position.x - agent.position.x, node.position.y - agent.position.y, node.position.z - agent.position.z) < 18);
}
