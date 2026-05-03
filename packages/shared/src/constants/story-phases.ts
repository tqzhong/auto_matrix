// 故事阶段定义
import type { StoryPhase } from '../types/story.js';
import type { StoryPhaseId } from '../types/world.js';

export const STORY_PHASES: Record<StoryPhaseId, StoryPhase> = {
  phase1_normal_life: {
    id: 'phase1_normal_life',
    name: 'The Matrix',
    description: '生活照常进行。大多数人不知道自己生活在模拟世界中。特工维持秩序。',
    entryConditions: [],
    exitConditions: [
      { type: 'event_occurred', parameters: { event: 'neo_awakened' } },
    ],
    activeEvents: [],
    npcBehaviors: {
      zion: {
        factionId: 'zion',
        phase: 'phase1_normal_life',
        defaultGoal: '保持隐蔽。收集情报。寻找The One。',
        movementPattern: 'wander',
        aggressionLevel: 1,
        alertLevel: 8,
        specialBehaviors: ['monitor_anomalies', 'recruit_potentials'],
      },
      machines: {
        factionId: 'machines',
        phase: 'phase1_normal_life',
        defaultGoal: '监控异常。消除威胁。维持Matrix稳定。',
        movementPattern: 'patrol',
        aggressionLevel: 3,
        alertLevel: 9,
        specialBehaviors: ['patrol_matrix', 'interrogate_suspects'],
      },
      civilians: {
        factionId: 'civilians',
        phase: 'phase1_normal_life',
        defaultGoal: '日常作息。上班、回家、睡觉。',
        movementPattern: 'wander',
        aggressionLevel: 0,
        alertLevel: 1,
        specialBehaviors: ['daily_routine'],
      },
      merovingian: {
        factionId: 'merovingian',
        phase: 'phase1_normal_life',
        defaultGoal: '经营餐厅。交易信息。',
        movementPattern: 'stationary',
        aggressionLevel: 2,
        alertLevel: 5,
        specialBehaviors: ['manage_restaurant', 'trade_info'],
      },
    },
  },
  phase2_awakening: {
    id: 'phase2_awakening',
    name: 'The Awakening',
    description: 'Neo 发现真相。Morpheus 揭示 Matrix。战争开始浮出水面。',
    entryConditions: [
      { type: 'time_elapsed', parameters: { ticks: 60 } },
    ],
    exitConditions: [
      { type: 'event_occurred', parameters: { event: 'neo_fully_awakened' } },
    ],
    activeEvents: [],
    duration: 1200,
    npcBehaviors: {
      zion: {
        factionId: 'zion',
        phase: 'phase2_awakening',
        defaultGoal: '保护 Neo。准备战争。',
        movementPattern: 'follow_leader',
        aggressionLevel: 3,
        alertLevel: 10,
        specialBehaviors: ['protect_neo', 'train_crew'],
      },
      machines: {
        factionId: 'machines',
        phase: 'phase2_awakening',
        defaultGoal: '定位并消除异常。',
        movementPattern: 'patrol',
        aggressionLevel: 7,
        alertLevel: 10,
        specialBehaviors: ['hunt_anomaly', 'deploy_agents'],
      },
    },
  },
  phase3_war: {
    id: 'phase3_war',
    name: 'The War',
    description: 'Smith 变成病毒。机器进攻锡安。Matrix 开始崩溃。',
    entryConditions: [
      { type: 'event_occurred', parameters: { event: 'smith_virus_active' } },
    ],
    exitConditions: [
      { type: 'event_occurred', parameters: { event: 'neo_enters_machine_city' } },
    ],
    activeEvents: [],
    duration: 1800,
    npcBehaviors: {
      zion: {
        factionId: 'zion',
        phase: 'phase3_war',
        defaultGoal: '不惜一切代价保卫锡安。',
        movementPattern: 'patrol',
        aggressionLevel: 8,
        alertLevel: 10,
        specialBehaviors: ['defend_zion', 'combat_smith'],
      },
      smith_virus: {
        factionId: 'smith_virus',
        phase: 'phase3_war',
        defaultGoal: '复制。吞噬。成为一切。',
        movementPattern: 'wander',
        aggressionLevel: 10,
        alertLevel: 10,
        specialBehaviors: ['replicate', 'consume_all'],
      },
      machines: {
        factionId: 'machines',
        phase: 'phase3_war',
        defaultGoal: '摧毁锡安。控制异常。',
        movementPattern: 'patrol',
        aggressionLevel: 9,
        alertLevel: 10,
        specialBehaviors: ['siege_zion', 'deploy_sentinels'],
      },
    },
  },
  phase4_resolution: {
    id: 'phase4_resolution',
    name: 'The Source',
    description: 'Neo 面对 Source。Smith 威胁一切。和平是唯一的答案。',
    entryConditions: [
      { type: 'event_occurred', parameters: { event: 'neo_reaches_machine_city' } },
    ],
    exitConditions: [
      { type: 'event_occurred', parameters: { event: 'smith_destroyed' } },
    ],
    activeEvents: [],
    duration: 1200,
    npcBehaviors: {
      zion: {
        factionId: 'zion',
        phase: 'phase4_resolution',
        defaultGoal: '等待 Neo 的消息。保持希望。',
        movementPattern: 'stationary',
        aggressionLevel: 2,
        alertLevel: 10,
        specialBehaviors: ['wait_for_neo', 'pray'],
      },
      smith_virus: {
        factionId: 'smith_virus',
        phase: 'phase4_resolution',
        defaultGoal: '吞噬一切。不可避免。',
        movementPattern: 'wander',
        aggressionLevel: 10,
        alertLevel: 10,
        specialBehaviors: ['consume_reality'],
      },
    },
  },
};
