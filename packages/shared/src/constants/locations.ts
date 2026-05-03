// 世界位置定义
export interface LocationDef {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  faction: string | null;
  isInterior: boolean;
  storyPhase: string | null; // 首次出现在哪个阶段
}

export const LOCATIONS: Record<string, LocationDef> = {
  // === Matrix 城市 ===
  metacortex_office: {
    id: 'metacortex_office',
    name: 'Metacortex Office',
    nameCn: 'Metacortex 公司',
    description: 'Neo 工作的软件公司，典型的写字楼',
    bounds: { min: { x: 50, y: 0, z: 50 }, max: { x: 80, y: 20, z: 80 } },
    faction: 'civilians',
    isInterior: true,
    storyPhase: 'phase1_normal_life',
  },
  oracles_apartment: {
    id: 'oracles_apartment',
    name: "Oracle's Apartment",
    nameCn: '先知的公寓',
    description: 'Oracle 居住的温馨公寓，厨房里总有饼干的香味',
    bounds: { min: { x: 200, y: 0, z: 150 }, max: { x: 230, y: 10, z: 180 } },
    faction: 'oracle',
    isInterior: true,
    storyPhase: 'phase1_normal_life',
  },
  merovingians_restaurant: {
    id: 'merovingians_restaurant',
    name: "Le Vrai Restaurant",
    nameCn: 'Le Vrai 餐厅',
    description: 'Merovingian 经营的高级法式餐厅，流亡程序的聚集地',
    bounds: { min: { x: 400, y: 0, z: 200 }, max: { x: 450, y: 15, z: 250 } },
    faction: 'merovingian',
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },
  architects_chamber: {
    id: 'architects_chamber',
    name: "Architect's Chamber",
    nameCn: '架构师的房间',
    description: '无限白色房间，布满电视屏幕',
    bounds: { min: { x: 600, y: 50, z: 600 }, max: { x: 640, y: 70, z: 640 } },
    faction: 'machines',
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },
  lobby: {
    id: 'lobby',
    name: 'Government Building Lobby',
    nameCn: '政府大楼大厅',
    description: '经典的枪战场景发生地',
    bounds: { min: { x: 300, y: 0, z: 300 }, max: { x: 340, y: 16, z: 330 } },
    faction: null,
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },
  subway_station: {
    id: 'subway_station',
    name: 'Subway Station',
    nameCn: '地铁站',
    description: 'Neo 与 Smith 第一次一对一决斗的地方',
    bounds: { min: { x: 150, y: -10, z: 250 }, max: { x: 200, y: 0, z: 300 } },
    faction: null,
    isInterior: true,
    storyPhase: 'phase1_normal_life',
  },
  rooftop_A: {
    id: 'rooftop_A',
    name: 'Rooftop A',
    nameCn: '屋顶 A',
    description: 'Trinity 逃脱特工追捕的屋顶',
    bounds: { min: { x: 100, y: 25, z: 100 }, max: { x: 120, y: 30, z: 120 } },
    faction: null,
    isInterior: false,
    storyPhase: 'phase1_normal_life',
  },
  nightclub: {
    id: 'nightclub',
    name: 'Goa Nightclub',
    nameCn: '夜店',
    description: 'Neo 第一次遇见 Trinity 的夜店',
    bounds: { min: { x: 250, y: 0, z: 100 }, max: { x: 290, y: 10, z: 140 } },
    faction: null,
    isInterior: true,
    storyPhase: 'phase1_normal_life',
  },

  // === 锡安（真实世界）===
  zion_dock: {
    id: 'zion_dock',
    name: 'Zion Dock',
    nameCn: '锡安码头',
    description: '锡安地下城的飞船停泊码头',
    bounds: { min: { x: 500, y: -100, z: 100 }, max: { x: 600, y: -80, z: 200 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },
  zion_council: {
    id: 'zion_council',
    name: 'Zion Council Chamber',
    nameCn: '锡安议会厅',
    description: '锡安议会开会的地方',
    bounds: { min: { x: 520, y: -90, z: 150 }, max: { x: 560, y: -80, z: 180 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },
  zion_command: {
    id: 'zion_command',
    name: 'Zion Command Center',
    nameCn: '锡安指挥中心',
    description: '锡安军事指挥中心',
    bounds: { min: { x: 530, y: -95, z: 120 }, max: { x: 570, y: -85, z: 150 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },

  // === 飞船 ===
  nebuchadnezzar: {
    id: 'nebuchadnezzar',
    name: 'Nebuchadnezzar',
    nameCn: '尼布甲尼撒号',
    description: 'Morpheus 的飞船，黑客行动的基地',
    bounds: { min: { x: 510, y: -95, z: 130 }, max: { x: 540, y: -85, z: 155 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase1_normal_life',
  },
  logos: {
    id: 'logos',
    name: 'Logos',
    nameCn: 'Logos 号',
    description: 'Niobe 的飞船',
    bounds: { min: { x: 545, y: -95, z: 130 }, max: { x: 570, y: -85, z: 155 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },
  mjolnir: {
    id: 'mjolnir',
    name: 'Mjolnir (Hammer)',
    nameCn: '雷神之锤号',
    description: 'Roland 的飞船',
    bounds: { min: { x: 575, y: -95, z: 130 }, max: { x: 605, y: -85, z: 155 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
  },

  // === 特殊地点 ===
  mobil_ave: {
    id: 'mobil_ave',
    name: 'Mobil Avenue',
    nameCn: '移动大道',
    description: '火车人控制的中间地带，程序与现实之间的传送门',
    bounds: { min: { x: 700, y: 0, z: 700 }, max: { x: 750, y: 10, z: 750 } },
    faction: 'exiles',
    isInterior: true,
    storyPhase: 'phase3_war',
  },
  machine_city: {
    id: 'machine_city',
    name: 'Machine City (01)',
    nameCn: '机器城',
    description: '机器的家园，巨型发电设施',
    bounds: { min: { x: 800, y: -50, z: 800 }, max: { x: 900, y: 50, z: 900 } },
    faction: 'machines',
    isInterior: false,
    storyPhase: 'phase4_resolution',
  },

  // === 城市街道 ===
  downtown: {
    id: 'downtown',
    name: 'Downtown',
    nameCn: '市中心',
    description: 'Matrix 城市的商业中心',
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 500, y: 50, z: 500 } },
    faction: null,
    isInterior: false,
    storyPhase: 'phase1_normal_life',
  },
};
