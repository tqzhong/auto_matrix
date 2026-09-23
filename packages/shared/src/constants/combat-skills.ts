import type { AgentState, Vector3 } from '../types/agent.js';

export const COMBAT_SKILLS = {
  bullet_time: { name: '子弹时间', description: '4 秒内世界减速至四分之一，你保持正常行动速度。', cooldown: 16, duration: 4, effect: 'slow_motion', matrixOnly: true },
  force_push: { name: '代码震荡', description: '震退 8 米内的敌人，造成 28 伤害并打断攻击。', cooldown: 9, duration: .6, effect: 'code_ripple', matrixOnly: true },
  scorpion_dash: { name: '蝎式突袭', description: '向前突进 6 米，以踢击造成 38 伤害；墙体会阻挡突进。', cooldown: 5, duration: .3, effect: 'speed_blur', matrixOnly: false },
  system_hack: { name: '系统断路', description: '瘫痪 9 米内的敌对程序 4 秒，造成 12 伤害。', cooldown: 12, duration: .7, effect: 'code_overlay', matrixOnly: true },
  crushing_palm: { name: '破阵重掌', description: '重击前方 5 米内的敌人，造成 55 伤害、击退和硬直。', cooldown: 7, duration: .6, effect: 'combat_flash', matrixOnly: false },
  iron_guard: { name: '宗师架势', description: '3 秒内抵挡近战攻击，并以 20 伤害反击攻击者。', cooldown: 10, duration: 3, effect: 'counter_guard', matrixOnly: false },
  viral_overwrite: { name: '病毒同化', description: '感染前方一个目标；持续侵蚀生命，并将伤害的一半转为治疗。', cooldown: 10, duration: .65, effect: 'smith_infection', matrixOnly: true },
  agent_evade: { name: '特工闪避', description: '1.2 秒内闪开敌人近战攻击，同时加速移动。', cooldown: 6, duration: 1.2, effect: 'agent_dodge', matrixOnly: true },
  foresight: { name: '预见下一秒', description: '提前看穿攻击，3 秒内闪避近战伤害。', cooldown: 13, duration: 3, effect: 'vision_flash', matrixOnly: true },
  phase_shift: { name: '幽灵相位', description: '化为残影 2 秒，免疫近战并加速；不能穿越建筑。', cooldown: 9, duration: 2, effect: 'phase_shift', matrixOnly: true },
  code_snare: { name: '代码禁锢', description: '冻结前方 12 米内一个程序 5 秒，造成 18 伤害。', cooldown: 10, duration: .7, effect: 'code_overlay', matrixOnly: true },
  field_patch: { name: '应急修复', description: '恢复自身及 10 米内同阵营人物 25 生命。', cooldown: 20, duration: 1, effect: 'healing', matrixOnly: false },
  escape: { name: '紧急脱身', description: '3 秒内加速移动，并短暂打断贴身敌人的攻击。', cooldown: 8, duration: 3, effect: 'speed_blur', matrixOnly: false },
  dodge: { name: '闪身', description: '沿移动方向短距离闪避；无方向输入时后撤。', cooldown: .8, duration: .22, effect: 'dodge', matrixOnly: false },
} as const;
export type CombatSkillId = keyof typeof COMBAT_SKILLS;

const ROLE_SKILLS: Record<string, readonly [CombatSkillId, CombatSkillId]> = {
  neo: ['bullet_time', 'force_push'], trinity: ['scorpion_dash', 'system_hack'],
  morpheus: ['crushing_palm', 'iron_guard'], smith: ['viral_overwrite', 'agent_evade'],
  oracle: ['foresight', 'field_patch'], seraph: ['iron_guard', 'scorpion_dash'],
  niobe: ['scorpion_dash', 'escape'], ghost: ['foresight', 'crushing_palm'],
  tank: ['system_hack', 'field_patch'], mouse: ['code_snare', 'escape'],
  switch: ['phase_shift', 'scorpion_dash'], apoc: ['crushing_palm', 'system_hack'],
  merovingian: ['code_snare', 'viral_overwrite'], persephone: ['viral_overwrite', 'foresight'],
  twin1: ['phase_shift', 'crushing_palm'], twin2: ['phase_shift', 'scorpion_dash'],
  architect: ['code_snare', 'force_push'], keymaker: ['phase_shift', 'code_snare'],
  sati: ['force_push', 'field_patch'], trainman: ['force_push', 'escape'],
  deus_ex_machina: ['force_push', 'system_hack'],
  mifune: ['crushing_palm', 'iron_guard'], maggie: ['field_patch', 'foresight'],
  spoon_boy: ['force_push', 'foresight'], kid: ['escape', 'scorpion_dash'],
};

export function playerSkills(agent: Pick<AgentState, 'id' | 'abilities' | 'faction'>): readonly [CombatSkillId, CombatSkillId] {
  if (agent.id === 'bane') return agent.faction === 'machines' ? ['viral_overwrite', 'crushing_palm'] : ['escape', 'dodge'];
  if (ROLE_SKILLS[agent.id]) return ROLE_SKILLS[agent.id];
  const has = (id: string) => agent.abilities.some(ability => ability.id === id);
  if (has('agent_protocol')) return ['agent_evade', has('super_speed') ? 'scorpion_dash' : 'crushing_palm'];
  if (has('hacking')) return ['system_hack', has('martial_arts') ? 'crushing_palm' : 'field_patch'];
  if (has('code_manipulation')) return ['code_snare', 'force_push'];
  if (has('martial_arts')) return ['crushing_palm', 'iron_guard'];
  return ['escape', 'field_patch'];
}

export interface SkillCast {
  source: string;
  skill: CombatSkillId;
  position: Vector3;
  direction: Vector3;
  matrix: boolean;
}
