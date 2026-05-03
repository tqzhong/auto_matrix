// 能力定义
export interface AbilityDef {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  cooldownTicks: number;
  requiredAwakened: boolean;
  powerLevel: number;
  visualEffect: string;
}

export const ABILITIES: Record<string, AbilityDef> = {
  bullet_time: {
    id: 'bullet_time',
    name: 'Bullet Time',
    nameCn: '子弹时间',
    description: '极度减缓时间感知，可躲避子弹',
    cooldownTicks: 30,
    requiredAwakened: true,
    powerLevel: 8,
    visualEffect: 'slow_motion',
  },
  flight: {
    id: 'flight',
    name: 'Flight',
    nameCn: '飞行',
    description: '以超人速度飞行',
    cooldownTicks: 20,
    requiredAwakened: true,
    powerLevel: 9,
    visualEffect: 'flight_trail',
  },
  code_sight: {
    id: 'code_sight',
    name: 'Code Sight',
    nameCn: '代码视觉',
    description: '看到Matrix底层的绿色代码',
    cooldownTicks: 10,
    requiredAwakened: true,
    powerLevel: 7,
    visualEffect: 'code_overlay',
  },
  martial_arts: {
    id: 'martial_arts',
    name: 'Martial Arts',
    nameCn: '武术精通',
    description: '瞬间掌握各种武术',
    cooldownTicks: 5,
    requiredAwakened: true,
    powerLevel: 6,
    visualEffect: 'combat_flash',
  },
  agent_protocol: {
    id: 'agent_protocol',
    name: 'Agent Protocol',
    nameCn: '特工协议',
    description: '超人速度和力量，躲避子弹',
    cooldownTicks: 15,
    requiredAwakened: false,
    powerLevel: 7,
    visualEffect: 'agent_dodge',
  },
  body_transfer: {
    id: 'body_transfer',
    name: 'Body Transfer',
    nameCn: '身体转移',
    description: '感染并复制到其他特工/人类身上',
    cooldownTicks: 60,
    requiredAwakened: false,
    powerLevel: 10,
    visualEffect: 'smith_infection',
  },
  code_manipulation: {
    id: 'code_manipulation',
    name: 'Code Manipulation',
    nameCn: '代码操控',
    description: '直接操控Matrix代码改变现实',
    cooldownTicks: 40,
    requiredAwakened: false,
    powerLevel: 9,
    visualEffect: 'code_ripple',
  },
  hacking: {
    id: 'hacking',
    name: 'Hacking',
    nameCn: '黑客入侵',
    description: '入侵Matrix系统，解锁门禁等',
    cooldownTicks: 10,
    requiredAwakened: true,
    powerLevel: 4,
    visualEffect: 'terminal_glow',
  },
  super_speed: {
    id: 'super_speed',
    name: 'Super Speed',
    nameCn: '超级速度',
    description: '超越常人的移动速度',
    cooldownTicks: 8,
    requiredAwakened: true,
    powerLevel: 6,
    visualEffect: 'speed_blur',
  },
  precognition: {
    id: 'precognition',
    name: 'Precognition',
    nameCn: '预知',
    description: '预见即将发生的事件',
    cooldownTicks: 50,
    requiredAwakened: false,
    powerLevel: 8,
    visualEffect: 'vision_flash',
  },
};
