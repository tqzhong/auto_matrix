// 世界位置定义 — scaled to 2560×2560 world (NYC)
export interface LocationDef {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  faction: string | null;
  isInterior: boolean;
  storyPhase: string | null;
  world: 'matrix' | 'real'; // which world this location belongs to
}

export const LOCATIONS: Record<string, LocationDef> = {
  // === Matrix 城市 — NYC Locations ===

  // Metacortex: Midtown Manhattan, near Times Square
  metacortex_office: {
    id: 'metacortex_office',
    name: 'Metacortex Office',
    nameCn: 'Metacortex 公司',
    description: 'Neo 工作的软件公司，位于曼哈顿中城的一栋玻璃幕墙写字楼',
    bounds: { min: { x: 1100, y: 0, z: 800 }, max: { x: 1180, y: 40, z: 860 } },
    faction: 'civilians',
    isInterior: true,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },

  // Oracle's Apartment: Upper West Side
  oracles_apartment: {
    id: 'oracles_apartment',
    name: "Oracle's Apartment",
    nameCn: '先知的公寓',
    description: 'Oracle 居住的温馨公寓，位于上西区一栋褐石建筑中',
    bounds: { min: { x: 800, y: 0, z: 550 }, max: { x: 860, y: 16, z: 610 } },
    faction: 'oracle',
    isInterior: true,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },

  // Merovingian's Restaurant: Upper East Side
  merovingians_restaurant: {
    id: 'merovingians_restaurant',
    name: "Le Vrai Restaurant",
    nameCn: 'Le Vrai 餐厅',
    description: 'Merovingian 经营的高级法式餐厅，位于上东区',
    bounds: { min: { x: 1600, y: 0, z: 700 }, max: { x: 1700, y: 25, z: 780 } },
    faction: 'merovingian',
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'matrix',
  },

  // Architect's Chamber: One World Trade Center top
  architects_chamber: {
    id: 'architects_chamber',
    name: "Architect's Chamber",
    nameCn: '架构师的房间',
    description: '位于世贸中心一号楼顶部的无限白色房间',
    bounds: { min: { x: 1200, y: 80, z: 1400 }, max: { x: 1280, y: 100, z: 1480 } },
    faction: 'machines',
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'matrix',
  },

  // Government Building Lobby: Midtown
  lobby: {
    id: 'lobby',
    name: 'Government Building Lobby',
    nameCn: '政府大楼大厅',
    description: '位于第五大道的经典枪战场景发生地',
    bounds: { min: { x: 1300, y: 0, z: 900 }, max: { x: 1380, y: 20, z: 960 } },
    faction: null,
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'matrix',
  },

  // Subway Station: Times Square
  subway_station: {
    id: 'subway_station',
    name: 'Subway Station',
    nameCn: '地铁站',
    description: 'Neo 与 Smith 第一次决斗的地铁站',
    bounds: { min: { x: 1000, y: -10, z: 950 }, max: { x: 1080, y: 0, z: 1020 } },
    faction: null,
    isInterior: true,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },

  // Rooftop: Midtown skyscraper
  rooftop_A: {
    id: 'rooftop_A',
    name: 'Rooftop A',
    nameCn: '屋顶 A',
    description: 'Trinity 逃脱特工追捕的摩天大楼屋顶',
    bounds: { min: { x: 1050, y: 50, z: 850 }, max: { x: 1080, y: 55, z: 880 } },
    faction: null,
    isInterior: false,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },

  // Nightclub: Meatpacking District
  nightclub: {
    id: 'nightclub',
    name: 'Goa Nightclub',
    nameCn: '夜店',
    description: 'Neo 第一次遇见 Trinity 的夜店，位于肉库区',
    bounds: { min: { x: 900, y: 0, z: 750 }, max: { x: 960, y: 12, z: 810 } },
    faction: null,
    isInterior: true,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },

  // Times Square — new iconic location
  times_square: {
    id: 'times_square',
    name: 'Times Square',
    nameCn: '时代广场',
    description: '永不熄灭的霓虹灯海，Matrix中最华丽的虚假表象',
    bounds: { min: { x: 1050, y: 0, z: 900 }, max: { x: 1150, y: 60, z: 980 } },
    faction: null,
    isInterior: false,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },

  // Central Park
  central_park: {
    id: 'central_park',
    name: 'Central Park',
    nameCn: '中央公园',
    description: '钢筋水泥丛林中的绿色孤岛',
    bounds: { min: { x: 700, y: 0, z: 500 }, max: { x: 900, y: 5, z: 800 } },
    faction: null,
    isInterior: false,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },

  // === 锡安（真实世界）===
  zion_dock: {
    id: 'zion_dock',
    name: 'Zion Dock',
    nameCn: '锡安码头',
    description: '锡安地下城的飞船停泊码头',
    bounds: { min: { x: 2000, y: -100, z: 2300 }, max: { x: 2200, y: -80, z: 2500 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'real',
  },
  zion_council: {
    id: 'zion_council',
    name: 'Zion Council Chamber',
    nameCn: '锡安议会厅',
    description: '锡安议会开会的地方',
    bounds: { min: { x: 2060, y: -90, z: 2350 }, max: { x: 2140, y: -80, z: 2420 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'real',
  },
  zion_command: {
    id: 'zion_command',
    name: 'Zion Command Center',
    nameCn: '锡安指挥中心',
    description: '锡安军事指挥中心',
    bounds: { min: { x: 2100, y: -95, z: 2300 }, max: { x: 2180, y: -85, z: 2370 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'real',
  },

  // === 飞船 ===
  nebuchadnezzar: {
    id: 'nebuchadnezzar',
    name: 'Nebuchadnezzar',
    nameCn: '尼布甲尼撒号',
    description: 'Morpheus 的飞船',
    bounds: { min: { x: 2020, y: -95, z: 2320 }, max: { x: 2080, y: -85, z: 2380 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase1_normal_life',
    world: 'real',
  },
  logos: {
    id: 'logos',
    name: 'Logos',
    nameCn: 'Logos 号',
    description: 'Niobe 的飞船',
    bounds: { min: { x: 2090, y: -95, z: 2320 }, max: { x: 2150, y: -85, z: 2380 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'real',
  },
  mjolnir: {
    id: 'mjolnir',
    name: 'Mjolnir (Hammer)',
    nameCn: '雷神之锤号',
    description: 'Roland 的飞船',
    bounds: { min: { x: 2160, y: -95, z: 2320 }, max: { x: 2220, y: -85, z: 2380 } },
    faction: 'zion',
    isInterior: true,
    storyPhase: 'phase2_awakening',
    world: 'real',
  },

  // === 特殊地点 ===
  mobil_ave: {
    id: 'mobil_ave',
    name: 'Mobil Avenue',
    nameCn: '移动大道',
    description: '火车人控制的中间地带',
    bounds: { min: { x: 2300, y: 0, z: 2300 }, max: { x: 2400, y: 10, z: 2400 } },
    faction: 'exiles',
    isInterior: true,
    storyPhase: 'phase3_war',
    world: 'matrix',
  },
  machine_city: {
    id: 'machine_city',
    name: 'Machine City (01)',
    nameCn: '机器城',
    description: '机器的家园，巨型发电设施',
    bounds: { min: { x: 2400, y: -50, z: 2400 }, max: { x: 2560, y: 50, z: 2560 } },
    faction: 'machines',
    isInterior: false,
    storyPhase: 'phase4_resolution',
    world: 'real',
  },

  // === 城市区域 ===
  downtown: {
    id: 'downtown',
    name: 'Downtown Manhattan',
    nameCn: '曼哈顿下城',
    description: '金融区和世贸中心所在地',
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 2560, y: 100, z: 2560 } },
    faction: null,
    isInterior: false,
    storyPhase: 'phase1_normal_life',
    world: 'matrix',
  },
};
