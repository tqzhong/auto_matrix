import type { Vector3 } from '../types/agent.js';
import { LOBBY_COLUMNS } from './lobby.js';
import { OFFICE_OBSTACLES, OFFICE_LADDER, OFFICE_LEDGE_OFFSET } from './office.js';
import { OFFICE_MANAGER_WALLS, OFFICE_MANAGER_FURNITURE } from './office-workday.js';
import { APARTMENT_FURNITURE } from './apartment.js';
import { PILL_ROOM } from './pills.js';
import { INTERROGATION_ROOM } from './interrogation.js';
import { POD_WATER_DROP, RECOVERY_BED } from './awakening.js';
import { AMBUSH_WALLS } from './ambush.js';
import { MEETING_CAR, MEETING_DESTINATION, meetingCarPose, meetingRoadContains } from './meeting.js';
import { LAFAYETTE, hotelContains, hotelBlocked, hotelFloor } from './lafayette.js';

export type FilmArchitecture = 'hotel' | 'apartment' | 'club' | 'office' | 'interrogation' | 'bridge' | 'car' | 'lafayette' | 'pods' | 'ship' | 'construct' | 'desert' | 'dojo' | 'rooftop' | 'plaza' | 'restaurant' | 'oracle' | 'tenement' | 'lobby' | 'subway' | 'street' | 'zion' | 'temple' | 'engineering' | 'teahouse' | 'backdoors' | 'courtyard' | 'chateau' | 'workshop' | 'garage' | 'freeway' | 'power' | 'architect' | 'mobil' | 'hel' | 'machine' | 'rain' | 'garden';
export interface FilmSet {
  id: string; name: string; film: (1 | 2 | 3)[]; architecture: FilmArchitecture;
  world: 'matrix' | 'real'; width: number; depth: number; height: number;
  light: 'day' | 'night' | 'warm' | 'cold' | 'white' | 'storm' | 'sunrise';
  detail: string; center: Vector3;
}

// Narrative interiors and remote destinations occupy separate streamed areas.
// The city remains available; these coordinates are shared by physics and rendering.
const definitions: Omit<FilmSet, 'id' | 'center'>[] = [
  { name: '城市之心旅馆 · 303', film: [1], architecture: 'hotel', world: 'matrix', width: 34, depth: 52, height: 12, light: 'night', detail: '303 / 烧旧墙纸、窄走廊、电话与电脑' },
  { name: '旅馆屋顶与消防梯', film: [1], architecture: 'rooftop', world: 'matrix', width: 54, depth: 100, height: 24, light: 'night', detail: '烟囱、砖墙、相邻屋顶与消防通道' },
  { name: 'Wells & Lake · 电话亭', film: [1], architecture: 'street', world: 'matrix', width: 48, depth: 94, height: 24, light: 'night', detail: '桥下路口、卡车车灯、玻璃电话亭' },
  { name: 'Anderson 公寓 · 101', film: [1], architecture: 'apartment', world: 'matrix', width: 34, depth: 40, height: 11, light: 'night', detail: 'CRT 屏幕、线缆、唱片、101 门牌' },
  { name: '地下夜店 · 白兔', film: [1], architecture: 'club', world: 'matrix', width: 42, depth: 56, height: 14, light: 'night', detail: '人群剪影、工业柱网、低照度舞池' },
  { name: 'Metacortex · 办公层', film: [1], architecture: 'office', world: 'matrix', width: 54, depth: 66, height: 13, light: 'day', detail: '隔间、百叶窗、快递、玻璃主管办公室' },
  { name: 'Metacortex · 窗外窄台', film: [1], architecture: 'rooftop', world: 'matrix', width: 32, depth: 76, height: 28, light: 'day', detail: '玻璃幕墙、脚手架与高空落差' },
  { name: '特工审讯室', film: [1], architecture: 'interrogation', world: 'matrix', width: INTERROGATION_ROOM.width, depth: INTERROGATION_ROOM.depth, height: INTERROGATION_ROOM.height, light: 'cold', detail: '灰绿板墙、不锈钢桌、档案、观察窗与顶灯' },
  { name: 'Adams Street · 桥下', film: [1], architecture: 'bridge', world: 'matrix', width: 48, depth: 76, height: 22, light: 'night', detail: '湿路、拱桥、轿车和雨水' },
  { name: '接头轿车 · 赴约', film: [1], architecture: 'car', world: 'matrix', width: 24, depth: 34, height: 10, light: 'night', detail: '黑色轿车、皮革后座、扫描装置与雨夜街道' },
  { name: 'Lafayette · 药丸与镜面', film: [1], architecture: 'lafayette', world: 'matrix', width: 42, depth: 50, height: 14, light: 'warm', detail: '两把红褐色皮椅、壁炉、药丸盒、裂镜' },
  { name: '培养舱与收割塔', film: [1], architecture: 'pods', world: 'real', width: 56, depth: 78, height: 45, light: 'cold', detail: '半透明培养舱、脐带、密集塔阵、机械臂' },
  { name: '尼布甲尼撒号 · 核心与医疗舱', film: [1, 2], architecture: 'ship', world: 'real', width: 44, depth: 90, height: 17, light: 'cold', detail: '连接椅、CRT 控制台、医疗床、餐桌与管线' },
  { name: '构造体 · 白色空间', film: [1], architecture: 'construct', world: 'matrix', width: 80, depth: 96, height: 30, light: 'white', detail: '无边白场、红色皮椅、电视与武器架' },
  { name: '真实世界的废墟', film: [1], architecture: 'desert', world: 'real', width: 88, depth: 108, height: 40, light: 'cold', detail: '焦黑城市、坍塌高楼、遮蔽的天空' },
  { name: '武术训练道场', film: [1], architecture: 'dojo', world: 'matrix', width: 50, depth: 62, height: 17, light: 'day', detail: '榻榻米、木柱、纸门、庭院和瓦檐' },
  { name: '跳跃程序 · 双子屋顶', film: [1], architecture: 'rooftop', world: 'matrix', width: 50, depth: 94, height: 28, light: 'day', detail: '对向屋顶、栏杆、断开的楼间距离' },
  { name: '红衣女子 · 喷泉广场', film: [1], architecture: 'plaza', world: 'matrix', width: 62, depth: 82, height: 24, light: 'day', detail: '圆形喷泉、石阶、成排立柱与行人' },
  { name: 'Cypher 与 Smith · 牛排餐厅', film: [1], architecture: 'restaurant', world: 'matrix', width: 40, depth: 50, height: 13, light: 'warm', detail: '夜景落地窗、白桌布、红酒与牛排' },
  { name: '先知公寓 · 候诊室与厨房', film: [1, 3], architecture: 'oracle', world: 'matrix', width: 42, depth: 60, height: 12, light: 'warm', detail: '绿色厨房、烤箱、饼干、花纹墙纸与勺子' },
  { name: '旧楼 · 黑猫与伏击', film: [1], architecture: 'tenement', world: 'matrix', width: 44, depth: 68, height: 18, light: 'day', detail: '封死的窗、楼梯、浴室、墙内通道' },
  { name: '政府大楼 · 大堂', film: [1], architecture: 'lobby', world: 'matrix', width: 38, depth: 82, height: 16, light: 'day', detail: '绿灰石材、对称柱廊、安检门、顶光与电梯' },
  { name: '政府大楼 · 审讯层', film: [1], architecture: 'office', world: 'matrix', width: 48, depth: 54, height: 14, light: 'day', detail: '整面玻璃窗、审讯椅与破裂玻璃' },
  { name: '政府大楼 · 屋顶与直升机', film: [1], architecture: 'rooftop', world: 'matrix', width: 62, depth: 90, height: 28, light: 'day', detail: '通风井、直升机、绳索与密集天际线' },
  { name: '地铁站 · Neo 与 Smith', film: [1, 3], architecture: 'subway', world: 'matrix', width: 46, depth: 104, height: 16, light: 'cold', detail: '拱顶、铆钉柱、轨道、出口电话与列车' },
  { name: '城市街巷 · 接线员撤离路线', film: [1], architecture: 'street', world: 'matrix', width: 48, depth: 112, height: 26, light: 'day', detail: '市场、窄巷、住户门窗、电话线路' },
  { name: '城市电话亭 · 第一部尾声', film: [1], architecture: 'street', world: 'matrix', width: 54, depth: 86, height: 28, light: 'day', detail: '街角电话亭、上班人流与城市天空' },
  { name: '反抗军船长 · 秘密会议', film: [2], architecture: 'tenement', world: 'matrix', width: 46, depth: 58, height: 16, light: 'night', detail: '废弃楼层、长桌、出口楼梯与特工围堵' },
  { name: '锡安 · 船坞', film: [2, 3], architecture: 'zion', world: 'real', width: 108, depth: 138, height: 65, light: 'warm', detail: '巨大圆形船坞、钢桁架、悬桥、APU 与闸门' },
  { name: '锡安 · 指挥所与议事厅', film: [2, 3], architecture: 'engineering', world: 'real', width: 54, depth: 76, height: 20, light: 'warm', detail: '石壁、环形会议席、战术台与维修灯' },
  { name: '锡安 · 居住层', film: [2, 3], architecture: 'zion', world: 'real', width: 64, depth: 82, height: 36, light: 'warm', detail: '岩壁住宅、曲面阳台、升降梯与生活用品' },
  { name: '锡安 · 神庙洞窟', film: [2, 3], architecture: 'temple', world: 'real', width: 96, depth: 116, height: 55, light: 'warm', detail: '洞窟石柱、祭台、火盆与集会人群' },
  { name: '锡安 · Neo 与 Trinity 的房间', film: [2], architecture: 'apartment', world: 'real', width: 32, depth: 42, height: 12, light: 'warm', detail: '石墙、粗布床铺、暖色壁灯与狭窗' },
  { name: '锡安 · 工程层', film: [2], architecture: 'engineering', world: 'real', width: 56, depth: 90, height: 24, light: 'warm', detail: '生命维持机器、管道、阀门与金属栈桥' },
  { name: '后门通道 · 白色走廊', film: [2, 3], architecture: 'backdoors', world: 'matrix', width: 28, depth: 112, height: 12, light: 'white', detail: '重复门框、无窗白墙与不可能的连接' },
  { name: '赛拉夫 · 茶馆', film: [2], architecture: 'teahouse', world: 'matrix', width: 50, depth: 58, height: 17, light: 'day', detail: '木格窗、圆桌、茶具、灯笼与金色光线' },
  { name: '先知长椅与 Smith 庭院', film: [2], architecture: 'courtyard', world: 'matrix', width: 76, depth: 96, height: 34, light: 'day', detail: '砖墙住宅、长椅、篮球架、消防梯与铁栏' },
  { name: 'Le Vrai · 餐厅与盥洗室', film: [2], architecture: 'restaurant', world: 'matrix', width: 58, depth: 78, height: 20, light: 'day', detail: '高挑落地窗、金色柱列、白桌布与石材盥洗室' },
  { name: '梅罗文加城堡 · 大厅', film: [2], architecture: 'chateau', world: 'matrix', width: 70, depth: 84, height: 25, light: 'day', detail: '大理石双楼梯、雕花栏杆、壁画与古兵器' },
  { name: '城堡 · 图书室与钥匙匠工坊', film: [2], architecture: 'workshop', world: 'matrix', width: 44, depth: 68, height: 17, light: 'warm', detail: '书墙、暗门、密集钥匙架与工作台' },
  { name: '城堡 · 地下车库', film: [2], architecture: 'garage', world: 'matrix', width: 60, depth: 90, height: 15, light: 'cold', detail: '弧形出口、混凝土柱网、轿车与摩托车' },
  { name: '101 高速公路', film: [2], architecture: 'freeway', world: 'matrix', width: 64, depth: 1600, height: 24, light: 'day', detail: '多车道、中间护栏、匝道、摩托车与重型卡车' },
  { name: '发电厂 · 电网行动', film: [2], architecture: 'power', world: 'matrix', width: 64, depth: 90, height: 26, light: 'night', detail: '红砖厂房、变压器、绝缘子与断路器' },
  { name: '备用电站 · Trinity 的路线', film: [2], architecture: 'power', world: 'matrix', width: 48, depth: 74, height: 20, light: 'night', detail: '配电柜、维护通道、玻璃机房与紧急出口' },
  { name: '建筑师 · 监视器房间', film: [2], architecture: 'architect', world: 'matrix', width: 54, depth: 62, height: 18, light: 'white', detail: '环形监视器墙、白色座椅、两扇门' },
  { name: 'Trinity 坠落 · 城市高空', film: [2], architecture: 'rooftop', world: 'matrix', width: 58, depth: 86, height: 30, light: 'night', detail: '玻璃摩天楼、破窗、下方街道与接应屋顶' },
  { name: '地下隧道 · 舰船撤离', film: [1, 2, 3], architecture: 'engineering', world: 'real', width: 56, depth: 146, height: 34, light: 'cold', detail: '弧形岩壁、废弃管网、哨兵和悬浮引擎' },
  { name: 'Hammer · 医疗舱与舰桥', film: [2, 3], architecture: 'ship', world: 'real', width: 48, depth: 104, height: 19, light: 'cold', detail: '双医疗床、诊断屏幕、导航台与 EMP 控制器' },
  { name: 'Mobil Ave · 中间世界', film: [3], architecture: 'mobil', world: 'matrix', width: 44, depth: 104, height: 17, light: 'white', detail: '白色瓷砖、黑色站名、长椅、轨道与循环隧道' },
  { name: 'Club Hel · 地下俱乐部', film: [3], architecture: 'hel', world: 'matrix', width: 62, depth: 90, height: 23, light: 'night', detail: '红黑配色、石柱、楼梯、衣帽间与 VIP 高台' },
  { name: 'Logos · 驾驶舱与货舱', film: [3], architecture: 'ship', world: 'real', width: 38, depth: 94, height: 17, light: 'cold', detail: '狭长货舱、线缆、双人驾驶位与受损舷窗' },
  { name: '机器城 · 防线与乌云', film: [3], architecture: 'machine', world: 'real', width: 90, depth: 132, height: 60, light: 'cold', detail: '机械尖塔、浮动炸弹、黑云与飞船航路' },
  { name: '云层之上 · 最后的阳光', film: [3], architecture: 'machine', world: 'real', width: 66, depth: 90, height: 40, light: 'sunrise', detail: '云海、蓝色天空、金色日光与受损 Logos' },
  { name: '机器城 · 撞毁的 Logos', film: [3], architecture: 'ship', world: 'real', width: 44, depth: 70, height: 20, light: 'warm', detail: '破碎驾驶舱、钢梁、火光与静止的控制台' },
  { name: '机器核心 · Deus Ex Machina', film: [3], architecture: 'machine', world: 'real', width: 90, depth: 110, height: 55, light: 'warm', detail: '机械面孔、连接平台、无数金色光点' },
  { name: 'Smith 大道 · 暴雨决战', film: [3], architecture: 'rain', world: 'matrix', width: 72, depth: 150, height: 40, light: 'storm', detail: '两侧复制体、闪电、积水、破碎路面与深坑' },
  { name: '公园 · 新的日出', film: [3], architecture: 'garden', world: 'matrix', width: 90, depth: 110, height: 30, light: 'sunrise', detail: '湖边长椅、树木、草地与暖色城市天际线' },
];
const ids = ['heart_hotel', 'hotel_roofs', 'wells_phone', 'anderson_flat', 'white_rabbit_club', 'metacortex_floor', 'office_ledge', 'agent_interrogation', 'adams_bridge', 'extraction_car', 'lafayette', 'power_plant_pods', 'neb_deck', 'white_construct', 'real_desert', 'kungfu_dojo', 'jump_roofs', 'red_dress_plaza', 'cypher_restaurant', 'oracle_home', 'ambush_house', 'government_lobby', 'government_office', 'government_roof', 'subway_platform', 'escape_streets', 'final_phone', 'captains_meeting', 'zion_hangar', 'zion_council', 'zion_residences', 'zion_temple', 'zion_bedroom', 'zion_engineering', 'backdoor_hall', 'seraph_teahouse', 'oracle_courtyard', 'le_vrai', 'chateau_hall', 'keymaker_workshop', 'chateau_garage', 'freeway_101', 'power_station', 'backup_station', 'architect_room', 'trinity_roof', 'service_tunnels', 'hammer_deck', 'mobil_station', 'club_hel', 'logos_deck', 'machine_defense', 'above_clouds', 'logos_wreck', 'machine_core', 'smith_avenue', 'sunrise_garden'];

export const FILM_SETS: Record<string, FilmSet> = Object.fromEntries(definitions.map((set, i) => {
  const id = `film_${ids[i]}`;
  return [id, { ...set, id, center: { x: id === 'film_freeway_101' ? 8192 : 4096 + i % 8 * 320, y: set.world === 'matrix' ? 1 : -100, z: 4096 + Math.floor(i / 8) * 320 } }];
}));
// The window and its exterior are one building; other film destinations remain streamed areas.
FILM_SETS.film_office_ledge.center = { ...FILM_SETS.film_metacortex_floor.center, x: FILM_SETS.film_metacortex_floor.center.x + OFFICE_LEDGE_OFFSET };
// Boarding and the examination share the same parked car, not separate rooms.
Object.assign(FILM_SETS.film_extraction_car, { center: { ...FILM_SETS.film_adams_bridge.center }, width: 48, depth: 76 });
FILM_SETS.film_lafayette.center.y += LAFAYETTE.upper;

export function filmSetAt(position: Vector3, matrix: boolean): FilmSet | undefined {
  const office = FILM_SETS.film_metacortex_floor; const ledge = FILM_SETS.film_office_ledge;
  const outside = position.x < office.center.x - 27.3;
  if (matrix && outside && Math.abs(position.x - ledge.center.x) < ledge.width / 2 + 28 && Math.abs(position.z - ledge.center.z) < ledge.depth / 2 + 28) return ledge;
  const bridge = FILM_SETS.film_adams_bridge;
  const x = position.x - bridge.center.x; const z = position.z - bridge.center.z;
  if (matrix && hotelContains(x - MEETING_DESTINATION.x, z)) return FILM_SETS.film_lafayette;
  if (matrix && meetingRoadContains(x, z) && (x < MEETING_DESTINATION.x - 23 || x > MEETING_DESTINATION.x + 23 || z >= 27 || z < -27)) return FILM_SETS.film_extraction_car;
  return Object.values(FILM_SETS).find(set => set !== ledge && !(set === office && outside) && (set.world === 'matrix') === matrix && Math.abs(position.x - set.center.x) < set.width / 2 + 28 && Math.abs(position.z - set.center.z) < set.depth / 2 + 28);
}
export function filmPosition(id: string, x = 0, z = 0): Vector3 {
  const center = FILM_SETS[id].center;
  return { x: center.x + x, y: center.y, z: center.z + z };
}

export interface FilmObstacle { x: number; z: number; width: number; depth: number; height: number }
export const ORACLE_FURNITURE: FilmObstacle[] = [
  { x: -1.5, z: -27.5, width: 18, depth: 2.9, height: 2.5 },
  { x: 9, z: -25.5, width: 3.4, depth: 3.5, height: 4.9 },
  { x: 3, z: -17, width: 5, depth: 3, height: 2.1 },
  { x: 8, z: -11, width: 2.7, depth: 2.2, height: 1.95 },
];
export function filmObstacles(set: FilmSet): FilmObstacle[] {
  if (set.id === 'film_anderson_flat') return APARTMENT_FURNITURE;
  if (set.id === 'film_adams_bridge' || set.id === 'film_extraction_car') {
    const parked = meetingCarPose({ phase: 'parked', elapsed: 0 });
    return [MEETING_CAR, { x: parked.x, z: parked.z, width: MEETING_CAR.depth, depth: MEETING_CAR.width, height: MEETING_CAR.height },
      { x: MEETING_DESTINATION.x, z: 0, width: 46, depth: 52, height: 99 },
      { x: MEETING_DESTINATION.x, z: 65, width: 25, depth: 18, height: 39 },
      ...[-23, 23].map(x => ({ x, z: -14, width: 3.6, depth: 23, height: 16 }))];
  }
  if (set.id === 'film_agent_interrogation') return [INTERROGATION_ROOM.table, ...[-1, 1].map(side => ({ x: side * INTERROGATION_ROOM.seat, z: 0, width: 1.3, depth: 1.5, height: 2.8 }))];
  if (set.id === 'film_ambush_house') return AMBUSH_WALLS;
  if (set.id === 'film_metacortex_floor') return [...OFFICE_OBSTACLES, ...OFFICE_MANAGER_WALLS, ...OFFICE_MANAGER_FURNITURE];
  if (set.id === 'film_office_ledge') return [{ x: 4, z: 0, width: 2, depth: 76, height: 40 }];
  if (set.architecture === 'freeway') return [-28, 0, 28].map(x => ({ x, z: 0, width: 1.5, depth: set.depth, height: 2.2 }));
  if (set.id === 'film_lafayette') return [
    { x: -PILL_ROOM.seat, z: PILL_ROOM.z, width: 2, depth: 2.5, height: 3.4 }, { x: PILL_ROOM.seat, z: PILL_ROOM.z, width: 2, depth: 2.5, height: 3.4 },
    { x: 0, z: PILL_ROOM.tableZ, width: 3.2, depth: 1.8, height: 1.85 }, { x: -10, z: -18, width: 6.4, depth: .4, height: 9.8 },
    { x: 12, z: 10, width: 8, depth: 3, height: 4.8 },
  ];
  if (set.id === 'film_neb_deck') return [
    { x: RECOVERY_BED.x, z: RECOVERY_BED.z, width: 3.2, depth: 6.8, height: 2.1 },
    ...[-1, 1].flatMap(side => [-5, 6].map(z => ({ x: side * 6.5, z, width: 3.2, depth: 3.8, height: 3.2 }))),
    { x: -8, z: 22, width: 10, depth: 4.5, height: 2.4 },
  ];
  if (set.id === 'film_real_desert') return Array.from({ length: 28 }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (18 + i % 4 * 9), z: 38 - Math.floor(i / 2) * 10.5,
    width: 8 + i % 5 * 2, depth: 7 + i % 3 * 2, height: 17 + (i * 13) % 34,
  }));
  if (set.architecture === 'lobby') return LOBBY_COLUMNS;
  if (set.architecture === 'oracle') return [...ORACLE_FURNITURE, ...[-1, 1].flatMap(side => [
    { x: side * (set.width / 4 + 2.5), z: -8, width: set.width / 2 - 5, depth: .4, height: 7.8 },
    { x: side * 12, z: -19, width: .4, depth: 21.6, height: 7.8 },
  ])];
  // Keep the central route open. Columns and walls use these same footprints in Three.js.
  if (!['lobby', 'chateau', 'temple', 'hel', 'garage', 'ship', 'subway', 'mobil'].includes(set.architecture)) return [];
  const columns: FilmObstacle[] = [];
  const x = set.width * .32;
  for (let z = -set.depth / 2 + 12; z < set.depth / 2 - 10; z += 16) {
    for (const side of [-1, 1]) columns.push({ x: side * x, z, width: 1.8, depth: 1.8, height: set.height });
  }
  return columns;
}

export function filmBlocked(position: Vector3, set: FilmSet, radius: number): boolean {
  const x = position.x - set.center.x; const z = position.z - set.center.z;
  if (set.id === 'film_lafayette') {
    if (hotelBlocked(x, z, position.y - set.center.y + LAFAYETTE.upper, radius)) return true;
    return position.y >= set.center.y - .8 && filmObstacles(set).some(o => Math.abs(x - o.x) < o.width / 2 + radius && Math.abs(z - o.z) < o.depth / 2 + radius && position.y < set.center.y + o.height);
  }
  if (set.id === 'film_extraction_car' || set.id === 'film_adams_bridge') {
    if (!meetingRoadContains(x, z, radius)) return true;
  } else if (Math.abs(x) > set.width / 2 - radius - .6 || Math.abs(z) > set.depth / 2 - radius - .6) return true;
  if (position.y < filmGroundHeight(position, set) - .8) return true;
  return filmObstacles(set).some(o => Math.abs(x - o.x) < o.width / 2 + radius && Math.abs(z - o.z) < o.depth / 2 + radius && position.y < set.center.y + o.height);
}

export function filmGroundHeight(position: Vector3, set: FilmSet): number {
  if (set.id === 'film_lafayette') return set.center.y - LAFAYETTE.upper + (hotelFloor(position.x - set.center.x, position.z - set.center.z, position.y - set.center.y + LAFAYETTE.upper) ?? 0);
  if (set.architecture === 'pods' && position.z > set.center.z + 6) return set.center.y - POD_WATER_DROP;
  if (set.id === 'film_office_ledge') {
    const x = position.x - set.center.x; const z = position.z - set.center.z;
    if (position.y < set.center.y - 26 && x > -4.5 && x < 2.5 && Math.abs(z - OFFICE_LADDER.z) < 3) return set.center.y - OFFICE_LADDER.depth;
    return set.center.y - (Math.abs(x) > 2.4 ? 65 : 0);
  }
  if (set.id === 'film_jump_roofs') {
    const z = position.z - set.center.z;
    return set.center.y - (z < -13 && z > -30 ? 45 : 0);
  }
  if (set.architecture !== 'chateau') return set.center.y;
  const x = position.x - set.center.x; const z = position.z - set.center.z;
  if (Math.abs(x) < set.width / 2 - 2 && Math.abs(z - (-set.depth / 2 + 7)) <= 6) return set.center.y + 10;
  let floor = set.center.y;
  for (let i = 0; i < 18; i++) {
    if (Math.abs(Math.abs(x) - (14 + i * .65)) <= 5 && Math.abs(z - (-4 - i * 1.45)) <= .8) floor = Math.max(floor, set.center.y + i * .55 + .25);
  }
  return floor;
}
