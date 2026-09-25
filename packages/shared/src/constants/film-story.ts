import { FILM_SETS, filmPosition } from './film-sets.js';
import { CONSTRUCT_REVEAL, MIRROR_TOUCH, RECOVERY_BED } from './awakening.js';
import type { Vector3 } from '../types/agent.js';
import type { Philosophy } from '../types/neo-life.js';
import { FILM_CONSEQUENCES } from './film-outcomes.js';
import { OFFICE_CONTACT, OFFICE_WINDOW, OFFICE_LADDER } from './office.js';
import { INTERROGATION_ROOM } from './interrogation.js';
import { MEETING_CAR, MEETING_DESTINATION } from './meeting.js';
import { APARTMENT } from './apartment.js';
import { CLUB } from './club.js';
import { SERAPH_ORACLE } from './seraph-oracle.js';
import { EXILES } from './exiles.js';
import { MOUNTAIN } from './mountain.js';
import { TRUCKS } from './trucks.js';
import { distance } from '../utils/index.js';

export type FilmCue = 'night' | 'contact' | 'office' | 'club' | 'awakening' | 'training' | 'oracle' | 'infiltration' | 'combat' | 'the_one' | 'zion' | 'swarm' | 'restaurant' | 'chateau' | 'chase' | 'source' | 'mobil' | 'siege' | 'bane' | 'farewell' | 'final' | 'dawn';
export interface FilmStep {
  kind: 'reach' | 'interact' | 'fight' | 'reflect' | 'drive'; label: string; x: number; z: number;
  text?: string; seconds?: number; enemies?: number; enemy?: 'agent' | 'smith' | 'sentinel' | 'training' | 'soldier'; opponent?: string;
}
export interface FilmScene {
  id: string; film: 1 | 2 | 3; set: string; actor: string; title: string; chapter: string;
  music: FilmCue; context: string; cast: string[]; steps: FilmStep[];
}
export const GRID_WINDOW_SECONDS = 314;
export const ARCHITECT_DOOR_SECONDS = 45;
export interface ArchitectEncounter {
  phase: 'cycles' | 'source' | 'trinity' | 'reflection' | 'decision' | 'failed' | 'done';
  sourceReviewed: boolean; trinityReviewed: boolean;
  remaining: number; lastTick: number; attempts: number; door?: 'matrix';
}
export const GRID_REROUTE_SECONDS = 6;
export const GRID_HACK_SECONDS = 12;
export interface GridOperation {
  primary: 'online' | 'armed' | 'off'; emergency: 'online' | 'off';
  vigilant: 'active' | 'lost'; trinity: 'waiting' | 'connected';
  phase: 'preparing' | 'emergency' | 'window' | 'expired' | 'rerouting' | 'opened';
  remaining: number; lastTick: number; reroute: number; attempts: number; hackRemaining?: number;
}
export const RELOADED_FINALE = { evacuationSeconds: 32, sentinelSeconds: 14, signalSeconds: 2.2 } as const;
export interface ShipLossEncounter {
  phase: 'briefing' | 'evacuating' | 'failed' | 'escaped'; remaining: number; lastTick: number; attempts: number;
}
export interface TunnelEncounter {
  phase: 'running' | 'sensing' | 'failed' | 'collapsed'; remaining: number; focus: number; lastTick: number; attempts: number;
}
export interface MobilEncounter {
  phase: 'waiting' | 'approaching' | 'stopped' | 'refusing' | 'departing' | 'gone';
  elapsed: number; lastTick: number; loops: number; boarding?: number; approach?: { x: number; z: number; yaw: number };
}
export interface HelChaseEncounter {
  phase: 'sighting' | 'running' | 'escaped'; elapsed: number; lastTick: number;
}
export const HEL_ELEVATOR = { doorZ: 24.6, doorWidth: 8.8, doorHeight: 8.8, seconds: 4.2 } as const;
export interface HelElevatorEncounter {
  phase: 'ready' | 'descending' | 'open'; elapsed: number; lastTick: number;
}
export const HEL_DANCE_DOOR = { z: 1.7, width: 6, height: 9, seconds: 2.5 } as const;
export interface HelDanceDoorEncounter {
  phase: 'sealed' | 'opening' | 'open'; elapsed: number; lastTick: number; allyTick?: number;
}
export interface HelBargainEncounter {
  phase: 'armed' | 'disarmed' | 'offered' | 'ready' | 'windup' | 'evade' | 'counter' | 'airborne' | 'gunpoint' | 'released' | 'failed';
  elapsed: number; lastTick: number; attempts: number;
}
export const BANE_ENCOUNTER = { gunWarning: .8, gunWindow: 1.5, grappleWindow: 6, burnSeconds: 1.4,
  focusSeconds: 1.8, pipeWindow: 1.5, counterWindow: 5 } as const;
export interface BaneEncounter {
  phase: 'ready' | 'gun_warning' | 'gun_window' | 'grapple' | 'burning' | 'blind' | 'pipe_window' | 'counter' | 'defeated' | 'failed';
  elapsed: number; attempts: number; checkpoint: 'gun' | 'blind'; hits: number; focus: number; counters: number; lastStrike: number;
  pipeX?: number; pipeZ?: number;
}
export function baneLocked(journey: FilmJourney | undefined): boolean {
  return journey?.scene === 'm3_bane' && !journey.visiting && Boolean(journey.bane &&
    ['gun_warning', 'gun_window', 'burning', 'pipe_window'].includes(journey.bane.phase));
}
export interface FilmJourney {
  version: 1; scene: string; step: number; actor: string; completed: string[];
  enteredAt: number; started?: number; fighting?: boolean; checkpoint: Vector3;
  reflections: Record<string, Philosophy>; lastText: string; finished?: boolean;
  visiting?: string; returnPosition?: Vector3;
  openingHotel?: import('./opening-hotel.js').OpeningHotelEncounter;
  openingRoof?: import('./opening-escape.js').OpeningRoofEncounter;
  openingPhone?: import('./opening-escape.js').OpeningPhoneEncounter;
  lobby?: import('./lobby.js').LobbyEncounter;
  office?: import('./office.js').OfficeEncounter;
  phone?: import('./office.js').OfficePhone;
  skipped?: string[];
  ride?: import('./freeway.js').FreewayRide;
  garage?: import('./garage.js').GarageEscape;
  hammer?: import('./hammer-flight.js').HammerFlight;
  logos?: import('./logos-flight.js').LogosFlight;
  apu?: import('./dock-apu.js').ApuRun;
  dockGunnery?: import('./dock-gunnery.js').DockGunnery;
  emp?: { firedAt: number };
  templeSeal?: { phase: 'running' | 'failed' | 'sealed'; remaining: number; lastTick: number; attempts: number };
  trucks?: import('./trucks.js').TruckEncounter;
  awakening?: import('./awakening.js').AwakeningBeat;
  mirrorGuide?: import('./awakening.js').MirrorGuide;
  training?: import('./training.js').TrainingPerformance;
  workday?: import('./office-workday.js').OfficeWorkday;
  contact?: import('./apartment.js').ApartmentContact;
  wakeCall?: import('./apartment.js').WakeCall;
  club?: import('./club.js').ClubEncounter;
  dojo?: import('./training.js').DojoLesson;
  oracle?: { spoon?: number; vase?: number; consultation?: import('./oracle.js').OracleVisitEncounter };
  pills?: import('./pills.js').PillEncounter;
  interrogation?: import('./interrogation.js').InterrogationEncounter;
  meeting?: import('./meeting.js').MeetingEncounter;
  bridgeArrival?: import('./meeting.js').BridgeArrival;
  bridgeTail?: import('./meeting.js').BridgeTailEncounter;
  hotel?: import('./lafayette.js').HotelApproach;
  ambush?: import('./ambush.js').AmbushEncounter;
  sentinel?: import('./sentinel.js').SentinelEncounter;
  interlude?: import('./interlude.js').InterludeEncounter;
  betrayal?: import('./betrayal.js').BetrayalEncounter;
  rescue?: import('./rescue.js').RescuePreparation;
  government?: import('./government-rescue.js').GovernmentRescueEncounter;
  airRescue?: import('./air-rescue.js').AirRescueEncounter;
  matrixEscape?: import('./matrix-escape.js').MatrixEscapeEncounter;
  theOne?: import('./the-one.js').TheOneEncounter;
  reloaded?: import('./reloaded-opening.js').ReloadedOpening;
  baneCopy?: { progress: number };
  seraph?: { dodges: number; counters: number; attempts: number; counterUntil?: number };
  burly?: import('./burly.js').BurlyEncounter;
  persephone?: import('./exiles.js').PersephoneEncounter;
  keymaker?: import('./exiles.js').KeymakerEncounter;
  chateau?: import('./chateau.js').ChateauEncounter;
  mountain?: import('./mountain.js').MountainFlight;
  grid?: GridOperation;
  keyDoor?: { portalOpened: boolean; keyTaken: boolean };
  architect?: ArchitectEncounter;
  catch?: import('./reloaded-catch.js').CatchEncounter;
  shipLoss?: ShipLossEncounter;
  tunnel?: TunnelEncounter;
  mobil?: MobilEncounter;
  helChase?: HelChaseEncounter;
  helElevator?: HelElevatorEncounter;
  helDanceDoor?: HelDanceDoorEncounter;
  helCoatcheck?: import('./hel-coatcheck.js').HelCoatcheckEncounter;
  helBargain?: HelBargainEncounter;
  bane?: BaneEncounter;
}
export const TEMPLE_SEAL_SECONDS = 42;
export function dockPowerOffline(journey: FilmJourney | undefined): boolean {
  return Boolean(journey && (journey.emp?.firedAt !== undefined || journey.completed.includes('m3_emp')
    || journey.scene === 'm3_emp' && journey.step > 0));
}
export function helElevatorLocked(journey: FilmJourney | undefined): boolean {
  return journey?.scene === 'm3_hel_entry' && !journey.visiting && journey.helElevator?.phase === 'descending';
}
export function helDanceDoorLocked(journey: FilmJourney | undefined): boolean {
  return journey?.scene === 'm3_hel_entry' && !journey.visiting && journey.helDanceDoor?.phase === 'opening';
}
const walk = (label: string, x = 0, z = -12): FilmStep => ({ kind: 'reach', label, x, z });
const use = (label: string, text: string, x = 0, z = -12, seconds = 3): FilmStep => ({ kind: 'interact', label, text, x, z, seconds });
const think = (label: string, text: string, x = 0, z = -10): FilmStep => ({ kind: 'reflect', label, text, x, z });
const fight = (label: string, enemies = 2, enemy: FilmStep['enemy'] = 'agent', opponent?: string): FilmStep => ({ kind: 'fight', label, x: 0, z: 0, enemies, enemy, opponent });
const scene = (id: string, film: 1 | 2 | 3, set: string, actor: string, title: string, chapter: string, music: FilmCue, context: string, steps: FilmStep[], cast: string[] = []): FilmScene => ({ id, film, set: `film_${set}`, actor, title, chapter, music, context, steps, cast });

// Released-film narrative beats, authored as game objectives, not screenplay quotations.
// Perspective changes follow the people actually present; the ordinary-life prologue is a game extension.
export const FILM_SCENES: FilmScene[] = [
  scene('m1_room303', 1, 'heart_hotel', 'trinity', '追踪中的房间 303', 'contact', 'infiltration', '线路被追踪。四名警员正在 303 门外，Trinity 必须脱身、联系 Morpheus，再从走廊破窗离开。', [
    use('挂断被追踪的线路', '警员破门而入，Trinity 举手等待近身机会。', -8, 12, 0),
    fight('反击警员，夺下手枪', 4, 'soldier'),
    use('接通房间电话，询问安全出口', 'Morpheus 确认硬线已被切断；Wells 与 Lake 的电话是新的出口。', -10, 18, 0),
    walk('穿过烧焦的走廊', 0, -18),
    use('跃出破窗，登上消防梯', 'Trinity 穿过碎玻璃，落到窗外消防梯。', 0, -23, 0),
    use('沿消防梯爬上屋顶', 'Trinity 抓住钢梯往上攀，Brown 已在屋顶追来。', 0, -30, 0),
  ]),
  scene('m1_roofs', 1, 'hotel_roofs', 'trinity', '屋顶追逐', 'contact', 'chase', 'Brown 紧追不舍。穿过通风设施，助跑越过楼间空隙，抵达消防梯。', [walk('穿过通风设施', -7, 12), walk('越过楼间空隙', 7, -14), use('沿消防梯撤向电话亭', 'Trinity 穿过对面的窗户，继续赶往 Wells 与 Lake 的出口。', 0, -38)], ['agent_brown']),
  scene('m1_phone_escape', 1, 'wells_phone', 'trinity', '卡车前的电话', 'contact', 'chase', '出口电话响起。卡车已在路口掉头，必须赶在撞击前接起听筒。', [walk('冲向电话亭', 0, -28), use('接起出口电话', '连接及时中断。卡车撞毁电话亭，Trinity 已返回飞船。', 0, -28, 0)]),
  scene('m1_wake_up', 1, 'anderson_flat', 'neo', '屏幕上的来信', 'contact', 'night', '叙事回到 Thomas Anderson 的公寓。屏幕上的消息与敲门声打断了深夜。', [
    use('查看 CRT，尝试退出异常窗口', '屏幕上的线索没有发送者。', APARTMENT.computer.x, APARTMENT.computer.z),
    use('打开 101 房门', '来客是 Choi 与 Dujour。', APARTMENT.door.x, APARTMENT.door.z),
    use('取出空心书里的磁盘', '备用磁盘藏在书页内部。', APARTMENT.book.x, APARTMENT.book.z),
    use('把磁盘交给 Choi', '一次交易和一个邀请。', APARTMENT.door.x, APARTMENT.door.z),
    use('核对 Dujour 左肩的白兔', '线索与现实发生了交叉。', APARTMENT.door.x, APARTMENT.door.z),
    think('决定是否接受邀请', '你可以去夜店亲自核对，也可以保留疑问，继续生活。', APARTMENT.door.x, APARTMENT.door.z),
  ], ['choi', 'dujour']),
  scene('m1_club', 1, 'white_rabbit_club', 'neo', '白兔与 Trinity', 'contact', 'club', '人群和音乐掩住了交谈。一个陌生人知道 Neo 没有说出口的问题。', [
    walk('穿过舞池，到拱墙旁等候', CLUB.neo.x, CLUB.neo.z),
    use('回应 Trinity，听她的警告', '陌生人知道你的网名和疑问。', CLUB.neo.x, CLUB.neo.z),
    think('回应一个知道太多的陌生人', '她知道秘密，并不自动证明她值得信任。', CLUB.neo.x, CLUB.neo.z),
    walk('亲自离开夜店，迎接第二天', CLUB.exit.x, CLUB.exit.z),
  ], ['trinity']),
  scene('m1_boss', 1, 'metacortex_floor', 'neo', '迟到的员工', 'office_call', 'office', '第二天的公司仍然井然有序。主管提醒 Anderson 遵守规则。', [use('进入主管办公室', '规章要求你按时出现。平常的一天开始显露出另一种压力。', -17, 27.4), use('回隔间签收快递，再取出手机', '来电者是 Morpheus。特工已经进入办公区，接下来必须按他的指引离开工位。', OFFICE_CONTACT.x, OFFICE_CONTACT.z)], ['rhineheart', 'courier']),
  scene('m1_office_escape', 1, 'metacortex_floor', 'neo', '隔间之间', 'office_call', 'infiltration', '手机保持接通。按住 Z 降低身体、放轻脚步，借隔间挡住视线；奔跑会惊动附近特工。被捕也会继续故事。', [walk('绕到左侧隔间后', -16, 11), walk('沿隔间向北移动', -16, -13), use('打开左前方外窗', '外窗已经推开。脚下的街道远在楼底，窗外的维修窄台通向脚手架。按 G 前往窄台。', OFFICE_WINDOW.approachX, OFFICE_WINDOW.approachZ, OFFICE_WINDOW.seconds)]),
  scene('m1_ledge', 1, 'office_ledge', 'neo', '窗外的恐惧', 'office_call', 'infiltration', '脚下是真实的高空。沿窄台走到维修架，或选择退回办公室；两种结果都会继续故事。', [walk('沿幕墙走到脚手架', 0, OFFICE_LADDER.z), think('决定是否继续下降', '原片中 Neo 在这里退缩。游戏允许你完成逃脱，或者回到被捕后的路线。', 0, OFFICE_LADDER.z)]),
  scene('m1_interrogation', 1, 'agent_interrogation', 'neo', '无法开口', 'office_call', 'awakening', 'Smith 把档案放在金属桌上。按 G 坐下查看，他要求你帮助寻找 Morpheus。', [use('坐下查看 Smith 的档案', '档案把 Thomas Anderson 与 Neo 两种生活联系起来。Smith 用清除记录交换合作。', INTERROGATION_ROOM.approach.x, 0), use('拒绝合作，要求打电话', '嘴唇失去原来的形状。两名特工将你按在桌上，Smith 放下的追踪器进入腹部；眼前的房间消失。', INTERROGATION_ROOM.approach.x, 0)], ['smith', 'agent_jones', 'agent_brown']),
  scene('m1_wake_again', 1, 'anderson_flat', 'neo', '并非一场梦', 'office_call', 'night', 'Neo 在公寓醒来。响起的有线座机把办公室之后的经历与下一次见面连接起来。', [use('走到工作台，拿起座机听筒', 'Morpheus 把接头地点定在 Adams Street 桥下。', APARTMENT.phone.approachX, APARTMENT.phone.approachZ), walk('离开 101 公寓', 0, 13)]),
  scene('m1_bridge', 1, 'adams_bridge', 'neo', '桥下的车灯', 'pill', 'contact', '雨夜桥下，后方的车灯正在接近。等轿车停在桥下，再走向右后门；Apoc 开车，Switch 在前座，Trinity 留出后座的位置。', [walk('等待轿车靠边，走近右后门', MEETING_CAR.approach.x, MEETING_CAR.approach.z), use('打开后车门并上车', 'Switch 要求检查追踪装置。Trinity 让你重新考虑是否现在离开。', MEETING_CAR.approach.x, MEETING_CAR.approach.z)], ['trinity', 'switch', 'apoc']),
  scene('m1_bug', 1, 'extraction_car', 'neo', '取出追踪器', 'pill', 'awakening', '你坐在 Trinity 身旁。扫描发现追踪器时，按住 G 保持身体稳定，松开会暂停抽取。检查后由 Apoc 送你赴约。', [use('配合扫描与抽取', '装置从腹部取出机械追踪器，Trinity 将它扔出车外。', MEETING_CAR.seat, MEETING_CAR.z + MEETING_CAR.rear), think('重新判断昨夜的经历', '当证据与熟悉的解释冲突，下一步应当相信什么？', MEETING_CAR.seat, MEETING_CAR.z + MEETING_CAR.rear), use('乘车抵达 Lafayette，下车后走到入口', '旧楼的门在面前。Morpheus 正在楼上的房间等你。', MEETING_DESTINATION.x, MEETING_DESTINATION.z)], ['trinity', 'switch', 'apoc']),
  scene('m1_pills', 1, 'lafayette', 'neo', '两把皮椅之间', 'pill', 'awakening', 'Lafayette 的旧房间里，Morpheus 把决定交给你。走到皮椅前，按 G 坐下听他说。', [use('坐到 Morpheus 对面的皮椅上', 'Morpheus 摊开双手。一边继续追问，一边回到熟悉的生活；决定仍然属于你。', 0, -3.3), think('亲自选择红色或蓝色药丸', '电影中的 Neo 选择红色药丸。蓝色药丸是游戏的日常生活分支；选择后，Neo 会亲手拿取药丸，用水吞服。', 0, -3.3)], ['morpheus', 'trinity']),
  scene('m1_mirror', 1, 'lafayette', 'neo', '镜面与定位', 'pill', 'awakening', 'Morpheus 起身，带你穿过会客厅后方的门。跟随他进入追踪室，再坐到设备和裂镜旁。', [use('坐进追踪椅，触碰裂镜', '银色镜面覆盖 Neo，接线组锁定信号；眼前的房间消失，培养舱中的身体睁开眼睛。', MIRROR_TOUCH.x, MIRROR_TOUCH.z, 8)], ['morpheus', 'trinity', 'apoc', 'switch', 'cypher']),
  scene('m1_pod', 1, 'power_plant_pods', 'neo', '第一次睁眼', 'construct', 'awakening', '连接管线和无尽的培养塔取代了熟悉的城市。转动视角观察，再按 G 检查身体上的连接。', [use('查看培养舱的连接', '维护机器发现异常，拔除管线。你从排放通道坠入水中。', 0, -12, 9), use('抓住救援装置', '尼布甲尼撒号把你从废水里吊起。', 0, 12, 5)]),
  scene('m1_recovery', 1, 'neb_deck', 'neo', '从未使用的肌肉', 'construct', 'awakening', '船员修复 Neo 的身体。醒来后，他第一次看见同伴在现实中的样子。', [use('在医疗床旁检查身体', '针疗和休息逐渐恢复肌肉功能，插口却证明过去的身体认知并不完整。', -7, -22, 5), walk('走向核心连接区', 0, 0)], ['morpheus', 'trinity', 'tank', 'dozer']),
  scene('m1_construct', 1, 'white_construct', 'neo', '残余自我影像', 'construct', 'awakening', '白色构造体里，衣服、头发和电视都可以被加载。', [use('请 Morpheus 打开电视', 'Morpheus 区分感官信号与外部世界。熟悉的城市来自共享模拟。', 0, -10), think('感觉足以证明真实吗？', '程序能够生成感受，却无法替你决定该如何理解感受。', CONSTRUCT_REVEAL.neo.x, CONSTRUCT_REVEAL.neo.z)], ['morpheus']),
  scene('m1_desert', 1, 'real_desert', 'neo', '真实世界的废墟', 'construct', 'awakening', '天空被遮蔽，城市残骸延伸到远处。Morpheus 讲述人类与机器的战争。', [walk('走到废墟边缘', 0, -30), use('观察收割塔的方向', '眼前的世界让 Neo 难以承受。连接结束后，他在飞船上恢复意识。', 0, -30)], ['morpheus']),
  scene('m1_download', 1, 'neb_deck', 'neo', '训练下载', 'training', 'training', 'Tank 加载格斗程序。学习不再只靠书本，但身体仍需要实践。', [use('在连接椅上开始训练', '程序资料完成加载；Morpheus 已在道场等候。', 0, 0, 5)], ['tank']),
  scene('m1_dojo', 1, 'kungfu_dojo', 'neo', '不要只计算速度', 'training', 'training', '与 Morpheus 本人对练。F 连击，X 闪避；观察起手提示，拉开距离后再反击。对练不会致死。', [fight('完成与 Morpheus 的对练', 1, 'training', 'morpheus'), think('重新理解身体的限制', '规则可以被认识，也可以被改写；能力并非一开始就属于你。')], ['morpheus']),
  scene('m1_jump', 1, 'jump_roofs', 'neo', '第一次跳跃', 'training', 'training', '前方楼间没有地面。Shift 助跑、空格起跳；Neo 此时还无法跨越这段距离，跌落后会从训练检查点恢复。', [walk('走到起跳线', 0, -10), walk('助跑，尝试跃向另一栋楼', 0, -35)], ['morpheus']),
  scene('m1_red_dress', 1, 'red_dress_plaza', 'neo', '红衣女子', 'training', 'infiltration', '人群中的一个身影分散了注意力，身后出现的却是特工。', [walk('穿过喷泉广场', 7, -12), use('检查身后的动静', 'Morpheus 暂停训练：仍被系统控制的任何人都可能成为特工的入口。', 7, -12)], ['morpheus', 'mouse', 'citizen_1', 'citizen_2', 'smith']),
  scene('m1_sentinels', 1, 'service_tunnels', 'neo', '静默的飞船', 'oracle_first', 'infiltration', '警报响起后，尼布甲尼撒号躲进废弃管道。Neo 跟随船员进入前舱，在断电的黑暗里避开哨兵扫描。', [use('进入前舱，听取静默停机指令', 'Tank 切断非必要供电。Morpheus 示意所有人保持安静，EMP 只作为最后防线。', 0, -38), use('到舷窗旁确认哨兵离开', '红色扫描从管道另一端消失，飞船恢复必要系统并继续航行。', 0, -43, 3.5)], ['morpheus', 'trinity', 'tank', 'dozer']),
  scene('m1_cypher_console', 1, 'neb_deck', 'neo', '屏幕旁的一杯酒', 'oracle_first', 'night', 'Neo 在值班控制台旁撞见 Cypher 编写一段没有解释用途的程序。交谈暴露了他的后悔，却没有把后来那场交易提前告诉 Neo。', [use('查看滚动代码', 'Cypher 解释自己如何从字符中读出城市，又用一杯烈酒试探 Neo 对觉醒的看法。', 3.4, 7.2), think('知道真相之后还会后悔吗？', '真相无法自动使人幸福；问题在于谁为遗忘付出代价。', 3.4, 7.2)], ['cypher']),
  scene('m1_steak', 1, 'cypher_restaurant', 'smith', '舒适的代价', 'oracle_first', 'restaurant', '另一条叙事线：以 Smith 的旁观视角见证 Cypher 的交易。此段不会成为 Neo 此时拥有的角色知识。', [walk('靠近窗边餐桌', 0, -6), use('坐下见证交易条件', 'Cypher 以交出 Morpheus 换取重新接入、遗忘现实和一段富有的人生。此段为旁观既定事件。', 0, -8.7, 5)], ['cypher']),
  scene('m1_meal', 1, 'neb_deck', 'neo', '真实世界的一顿饭', 'oracle_first', 'zion', '船员吃着单细胞蛋白，谈论机器如何制造味觉，也把玩笑、欲望和下一次接入带进同一张餐桌。', [use('到餐桌亲手接过食物', '平凡的吃饭与玩笑让这艘船不只是战争机器。', -1.5, 22), walk('回到核心区，准备接入矩阵', 0, 0)], ['mouse', 'dozer', 'tank', 'apoc', 'switch']),
  scene('m1_spoon', 1, 'oracle_home', 'neo', '等候室的孩子们', 'oracle_first', 'oracle', '先知的客厅里，孩子们以不同方式试探矩阵的规则。靠近孩子拿起勺子，停下脚步，按住 G 专注；松开时它会恢复。', [use('拿起勺子，按住 G 专注', '你看见金属在手中弯曲，松开力气也不再恢复。对规则的认识开始动摇。', -7, 10), walk('走到厨房门口', 0, -8)], ['spoon_boy']),
  scene('m1_oracle', 1, 'oracle_home', 'neo', '厨房里的预言', 'oracle_first', 'oracle', '饼干和花瓶之间，先知让 Neo 面对自我认识、Morpheus 的信念和即将到来的抉择。', [use('听见提醒，回头看花瓶', '你的转身碰落了花瓶。先知留下的问题是：没有那句提醒，你还会做出同一个动作吗？', 7, -14), think('预言如何影响选择？', '你将如何行动，比得到一个称号更重要。', -5, -22)], ['oracle', 'morpheus']),
  scene('m1_dejavu', 1, 'ambush_house', 'neo', '重复经过的黑猫', 'betrayal', 'infiltration', '返回出口的旧楼里，一只黑猫从门前经过。留意它的动作，以及之后房间发生的变化。', [use('留意门前的黑猫', 'Trinity 认出系统被改动的迹象。原来的门与窗被砖墙封死，只能从左侧墙内通道撤退。', 0, -8), { ...fight('突破楼内封锁', 2), z: -8 }, walk('改走左侧墙内通道', -17, -27)], ['trinity', 'switch', 'apoc']),
  scene('m1_bathroom', 1, 'ambush_house', 'morpheus', '为同伴争取时间', 'betrayal', 'combat', 'Morpheus 在浴室门线阻挡 Smith，其他人从墙内通道撤离。他必须亲自撑住追击，再决定以被捕换取同伴离开。', [fight('在浴室门线击退 Smith 三次并撑到同伴撤离', 1, 'smith', 'smith'), use('撞向 Smith，把战斗带进浴室', '同伴越过墙内通道后，Morpheus 撞向 Smith 并被捕。争取到的时间没有改写被捕结果，却让其他人离开了旧楼。', 0, 0)], ['smith', 'neo', 'trinity', 'switch', 'apoc']),
  scene('m1_unplugged', 1, 'neb_deck', 'tank', '背叛发生在现实', 'betrayal', 'bane', 'Cypher 回到飞船袭击 Tank 与 Dozer，并逐一拔除连接。Tank 必须抓住一次短暂的反击窗口，再亲手接回仍有生命信号的 Neo 与 Trinity。', [walk('抵达备用控制台', -7, -14), use('等待枪口偏转，反击并接回两路幸存信号', 'Tank 在短暂窗口内反击，再分别接回 Neo 与 Trinity。Dozer、Apoc 与 Switch 已无法回来。', -7, -14)], ['cypher', 'dozer', 'apoc', 'switch', 'neo', 'trinity']),
  scene('m1_rescue_decision', 1, 'neb_deck', 'neo', '仍然选择去救他', 'rescue', 'oracle', 'Morpheus 面临逼供。Neo 决定返回矩阵营救他，Trinity 坚持同行。', [think('在没有保证时承担责任', '这个决定来自对具体同伴的承诺，而不是已经证明的救世主身份。'), use('请 Tank 准备接入', '两人开始营救准备。', 0, 0)], ['trinity', 'tank']),
  scene('m1_guns', 1, 'white_construct', 'neo', '加载营救装备', 'rescue', 'combat', '构造体里排列着武器架。目标是政府大楼里的 Morpheus。', [use('检查装备架', 'Tank 把大楼入口和撤离路线送入连接。', -7, -12), walk('进入营救程序', 0, -26)], ['trinity']),
  scene('m1_lobby', 1, 'government_lobby', 'neo', '政府大楼的大堂', 'rescue', 'combat', '与 Trinity 突破大堂警戒，抵达后方电梯。石柱能挡住枪火；敌人瞄准后，及时换位。', [walk('穿过安检入口', 0, 23), { ...fight('与 Trinity 突破三道警戒', 2), z: 19 }, use('接通后方电梯', '电梯门打开。大堂通路已打通，可以继续营救 Morpheus。', 0, -35, 1)], ['trinity', 'citizen_12']),
  scene('m1_smith_question', 1, 'government_office', 'morpheus', 'Smith 的独白', 'rescue', 'infiltration', '审讯楼层里，Smith 对人类与矩阵表达了厌恶，逼问锡安的接入信息。', [think('在强迫下守住他人的生命', '被困者无法控制审讯，却仍在承受拒绝出卖同伴的代价。'), use('留意窗外的动静', '外面的营救逐渐接近。', 0, -18)], ['smith', 'agent_brown', 'agent_jones']),
  scene('m1_bullet_dodge', 1, 'government_roof', 'neo', '屋顶上的子弹', 'rescue', 'combat', '特工堵住屋顶。Neo 尝试闪避弹道，Trinity 在近处终结对手。', [fight('击退屋顶特工', 2), use('检查屋顶直升机', 'Trinity 请求下载驾驶程序，接下来的营救从空中展开。', 11.5, -15.5)], ['trinity', 'agent_jones', 'citizen_11']),
  scene('m1_helicopter', 1, 'government_office', 'neo', '破窗与绳索', 'rescue', 'chase', 'Trinity 把 B-212 贴向审讯层。Neo 操作侧舱机枪打碎幕墙，再靠安全绳跃出接住 Morpheus。', [use('压制审讯层并接住 Morpheus', 'Neo 抓住下坠的 Morpheus，救援绳承受住两人的重量。', 0, -18, 4)], ['trinity', 'morpheus', 'smith', 'agent_brown', 'agent_jones']),
  scene('m1_rooftop_rescue', 1, 'government_roof', 'neo', '拉住 Trinity', 'rescue', 'chase', 'Smith 击穿油箱后，Trinity 将 Morpheus 与 Neo 放上屋顶。坠落的机体把连接绳猛然拉紧。', [use('抓紧绳索，接应 Trinity', '直升机撞向玻璃大楼；Trinity 被拉到安全的屋顶。', 0, -22, 6)], ['trinity', 'morpheus']),
  scene('m1_subway', 1, 'subway_platform', 'neo', '不再逃跑', 'subway', 'combat', 'Morpheus 与 Trinity 通过电话离开。Smith 打断 Neo 的撤离。', [fight('面对站台上的 Smith', 1, 'smith', 'smith'), use('穿过站台出口', 'Neo 把对手拖向列车后逃出，但 Smith 仍能占用新的身体。', 0, -38)], ['smith', 'citizen_13']),
  scene('m1_city_chase', 1, 'escape_streets', 'neo', 'Tank 指引的街巷', 'the_one', 'chase', '出口电话不断失效，Tank 指引 Neo 穿过市场、后巷和住户楼层。', [walk('穿过街巷', -7, 18), walk('绕过被封住的路口', 7, -12), use('进入旅馆楼梯', '新的出口位于序幕出现过的旅馆。', 0, -42)], ['smith', 'citizen_13', 'citizen_14']),
  scene('m1_death', 1, 'heart_hotel', 'neo', '再次回到 303', 'the_one', 'awakening', 'Neo 即将接通出口，Smith 却在房门后等候。', [walk('抵达 303 房门', 0, -16), use('推开房门', '枪击中断了信号。现实中的 Trinity 仍在对 Neo 说话。', 0, -16, 5)], ['smith', 'agent_brown', 'trinity', 'morpheus', 'tank']),
  scene('m1_return', 1, 'heart_hotel', 'neo', '看见代码', 'the_one', 'the_one', 'Neo 恢复意识。走廊、子弹与特工都呈现出新的结构。', [use('停住逼近的子弹', 'Neo 重新认识规则，Smith 的攻击失去了原来的决定性。', 0, -10), fight('穿透 Smith 的防线', 1, 'training'), use('接通出口', 'Neo 离线后，Morpheus 在最后关头启动 EMP，哨兵被摧毁。', 0, -20)], ['smith', 'agent_brown', 'agent_jones', 'trinity', 'morpheus', 'tank']),
  scene('m1_final_call', 1, 'final_phone', 'neo', '电话之后的天空', 'the_one', 'the_one', 'Neo 向系统宣告新的可能，随后飞向城市上空。第一部结束。', [think('力量将用来打开什么？', '让他人有选择的可能，比替所有人预先选择更困难。'), use('结束通话', '城市生活仍在继续，战争也没有结束。', 0, -25)]),

  scene('m2_dream', 2, 'trinity_roof', 'trinity', '关于坠落的梦', 'zion', 'chase', '第二部以 Trinity 的危险行动开场。高楼上的枪战与坠落不断出现在 Neo 的梦里。', [walk('穿过电网维护层', 0, -15), use('破窗后记住追击细节', '枪声留在梦里。Neo 将带着这段预感醒来。', 0, -15)]),
  scene('m2_meeting', 2, 'captains_meeting', 'neo', '船长们的秘密会议', 'zion', 'infiltration', '机器大军正向锡安钻进。反抗军船长讨论防守与等待先知消息的分歧。', [use('醒来，与 Trinity 交谈', 'Link 准备好广播，船长们正在地下交通通道等待。'), use('核对地热图与值守约定', 'Ballard 留守 36 小时，等待先知的消息。', 0, 13), use('查看 Smith 留下的耳机', 'Smith 已经脱离原来的连接。', 0, -14), use('掩护船员撤离并迎战升级特工', '三名升级特工被击退，船员抵达出口。', 0, -9), use('飞离现场，返回锡安', 'Link 确认船员安全。', 0, -24)], ['morpheus', 'trinity', 'niobe', 'ballard', 'ghost', 'soren', 'link', 'smith', 'agent_johnson', 'agent_jackson', 'agent_thompson']),
  scene('m2_dock', 2, 'zion_hangar', 'neo', '回到锡安', 'zion', 'zion', '尼布甲尼撒号从三号闸门入港。值守人员正在给飞船补电，Kid 在栈桥等你。', [walk('沿悬桥走向三号闸门', 0, -28), use('与 Kid 交谈', 'Kid 说是 Neo 救了自己。Neo 提醒他：真正决定逃出来的人是 Kid。', -4, -27), use('确认飞船补电和离港时间', 'Link 把补电进度交给维修班。舰队必须在机器抵达前重新起航。', 11, -15, 5)], ['kid', 'morpheus', 'trinity', 'link']),
  scene('m2_lock', 2, 'zion_council', 'morpheus', '信念与军令', 'zion', 'zion', 'Lock 等在金属指挥所里。72 小时的逼近情报已经摆上战术桌。', [walk('进入 Lock 的指挥室', 0, -13), use('在部署图上核对舰队与战备', '机器的钻进路线与剩余时间被标在图上。等待先知消息的船与守城兵力都必须被计入。', 0, -20), think('如何面对共同的风险？', '信念不能取消他人必须承担的代价。', 0, -13)], ['lock', 'niobe']),
  scene('m2_residents', 2, 'zion_residences', 'neo', '门口的请求', 'zion', 'zion', '居住层的人们认出 Neo。有人惦记在 Gnosis 上的 Jacob，也有人寻找 Icarus 上的女儿。', [walk('穿过居住层廊桥', 0, -17), use('记下 Jacob 与 Gnosis 的消息请求', '你记录姓名、船名和最后一次通信时间，没有许下无法保证的获救承诺。', -8, -22), use('记下 Icarus 上女儿的消息请求', '第二份请求也进入联络簿；居民需要被告知事实，而不是被一句预言打发。', 8, -22), use('把两份请求送入联络簿', '后勤人员收到两份寻人请求，承诺一有舰船回报就通知家属。', 0, -29, 4)], ['trinity', 'zion_parent', 'zion_neighbor']),
  scene('m2_temple', 2, 'zion_temple', 'morpheus', '洞窟里的集会', 'zion', 'zion', 'Hamann 召集居民。Morpheus 必须亲自说明机器正在逼近，随后鼓声才会响起。', [walk('走到神庙讲台', 0, -35), use('向居民公开三天的威胁', 'Morpheus 没有隐瞒攻击的规模。人群从沉默中开始回应，决定一起守住锡安。', 0, -35, 6), use('把讲台交还给鼓声与人群', '舞蹈开始。人们让彼此看见自己仍然活着，守城准备在另一边继续。', 0, -26, 5)], ['niobe', 'lock', 'hamann']),
  scene('m2_room', 2, 'zion_bedroom', 'neo', '房间里的两个人', 'zion', 'oracle', 'Neo 与 Trinity 离开喧闹的集会，回到岩壁中的小房间。梦中的坠落仍困扰他。', [walk('走进岩壁里的卧室', 0, 1), use('把反复出现的梦告诉 Trinity', 'Trinity 听完梦的内容，也说出自己的决定：她会参与即将到来的行动。', 0, -8), think('预感是否会支配现在？', '珍惜眼前的人，与试图控制她的未来，不是同一种责任。', 0, -8)], ['trinity']),
  scene('m2_bane_copy', 2, 'industrial_loft', 'bane', '被带出矩阵的感染', 'zion', 'infiltration', '在锡安的夜里，Bane 与受伤的 Malachi 逃进有破碎天窗的工业阁楼。出口电话已响；这是观众视角，Neo 此时不知道。', [walk('护送 Malachi 穿过碎玻璃抵达电话', 0, -23), use('把先知的磁盘交给 Malachi，让他先离线', 'Malachi 带着给 Neo 的讯息离开。Bane 独自留下，Smith 从破碎天窗的阴影里落下。', 0, -29, 3), use('面对 Smith 的复制', '黑色程序从胸口覆盖 Bane 的身体和面容。另一个 Smith 从他的眼睛里看向出口电话。', 0, -23, 5), use('以被覆盖的身份接起出口电话', 'Bane 的现实身体醒来，Smith 的意识已经越过连接。', 0, -29, 3)], ['malachi', 'smith']),
  scene('m2_hamann', 2, 'zion_engineering', 'neo', '维持生命的机器', 'zion', 'oracle', 'Hamann 带 Neo 到工业核心。风、水和热由这些人类制造的机器维持。', [walk('沿栈桥走到生命维持机旁', 0, -24), use('检查空气与回收水的读数', '空气循环、供水与照明都连在同一片设备上。关闭其中一段会立刻影响居住层。', -9, -24), use('调整备用循环阀', '维护回路恢复平衡。机器仍在运转，而人们对它的依赖变得具体可见。', 9, -24, 5), think('相互依赖是否排除自由？', '能够关闭机器，并不意味着可以不承担关闭之后的后果。', 0, -24)], ['hamann']),
  scene('m2_oracle_message', 2, 'zion_bedroom', 'neo', '先知托来的磁盘', 'oracle_second', 'oracle', 'Hamann 谈话后的清晨，Ballard 和受伤的 Malachi 来到卧室门口。Bane 没有与他们同行。', [use('回应卧室铁门的敲击', 'Trinity 打开门。Ballard 带着船员来到门口，Malachi 的伤口还未痊愈。', 0, 13, 2), use('从 Ballard 手中接过先知的磁盘', '讯息终于抵达 Neo 手里。他知道该去见先知了。', 0, 9, 3)], ['trinity', 'ballard', 'malachi']),
  scene('m2_departure', 2, 'zion_hangar', 'neo', '离港前的道别', 'oracle_second', 'zion', '尼布甲尼撒号获准离港。Link 要和 Zee 道别；Bane 隐在通往船坞的路上，Kid 带来一件出自先知等候室的礼物。', [use('见证 Link 和 Zee 的道别', 'Zee 把贴身的护身符交给 Link。他不相信预言，却答应会带着它回来。', 0, 32, 4), use('留意 Bane 的异常道别', 'Bane 的手上有伤，眼神陌生。他说只是来祝好运；Neo 只察觉到一瞬不安，并不知道感染。', 0, 20, 3), use('从 Kid 手中接过勺子', '孩子托 Kid 把勺子送给 Neo。这件小礼物让他想起矩阵的规则可以改变。', -3, 10, 3), use('核对 Hamann 的放行与 Lock 的守城异议', 'Hamann 放行了尼布甲尼撒号；Lock 仍认为守城需要每一艘船。', 0, -2, 2), walk('沿接驳桥登上尼布甲尼撒号', 11, 17)], ['morpheus', 'trinity', 'link', 'zee', 'bane', 'kid']),
  scene('m2_seraph', 2, 'seraph_teahouse', 'neo', '认识一个人的方法', 'oracle_second', 'training', '白天的茶馆里，Seraph 要求先交手。观察两次起手，用 X 避开，再靠近以 F 反击；蛮打只会被挡开。', [fight('读懂 Seraph 的两次攻势', 1, 'training', 'seraph'), use('跟 Seraph 走到茶馆后门', 'Seraph 用颈间的钥匙打开旧门。门后并不是来时的街巷。', SERAPH_ORACLE.tea.door.x, SERAPH_ORACLE.tea.door.z, 2)], ['seraph']),
  scene('m2_backdoors', 2, 'backdoor_hall', 'neo', '门连接的另一侧', 'oracle_second', 'oracle', '茶馆旧门接到一条没有窗的白色走廊。Link 暂时失去 Neo 的定位；跟随 Seraph 去尽头的另一扇门。', [walk('穿过重复的门，跟上 Seraph', SERAPH_ORACLE.hall.turn.x, SERAPH_ORACLE.hall.turn.z), use('用 Seraph 的钥匙打开庭院门', '门外忽然传来孩子玩耍和鸟群的声音：同一条走廊连接着不相邻的地方。', SERAPH_ORACLE.hall.door.x, SERAPH_ORACLE.hall.door.z, 2)], ['seraph']),
  scene('m2_bench', 2, 'oracle_courtyard', 'neo', '先知也是程序', 'oracle_second', 'oracle', '旧楼围着一块灰色庭院。先知坐在长椅旁喂鸟，愿意谈流亡程序、选择和通往源头的路线。', [walk('走到先知的长椅前', SERAPH_ORACLE.yard.bench.x, SERAPH_ORACLE.yard.bench.z), use('听先知谈流亡程序和源头', '先知承认自己和 Seraph 也是程序。被系统遗弃的程序仍会为自己的存在寻找出路；去源头需要先找到钥匙匠。', SERAPH_ORACLE.yard.bench.x, SERAPH_ORACLE.yard.bench.z, 4), think('如何在未知结果前选择信任？', '她没有替 Neo 做出选择，也没有保证下一段路安全。', SERAPH_ORACLE.yard.bench.x, SERAPH_ORACLE.yard.bench.z), use('接过写有约见地址的折纸', '纸上写着 Le Vrai 的约见地点。Neo 把钥匙匠的线索带走；先知先离开庭院。', SERAPH_ORACLE.yard.bench.x, SERAPH_ORACLE.yard.bench.z, 2)], ['oracle']),
  scene('m2_burly', 2, 'oracle_courtyard', 'neo', '越来越多的 Smith', 'copies', 'swarm', 'Smith 已脱离原来的系统职责。他把复制理解为新的存在方式。', [fight('突破复制体的围攻', 5), use('从庭院脱离包围', '对手仍在增殖。Neo 飞离庭院，这场交锋无法终结感染。', 0, -35)], ['smith']),
  scene('m2_merovingian', 2, 'le_vrai', 'neo', 'Le Vrai 的因果论', 'keymaker', 'restaurant', '白天的 Le Vrai 俯瞰城市。Merovingian 借一份被改写的甜点宣称人都受原因支配，并拒绝交出钥匙匠。', [walk('穿过餐厅，靠近高台主桌', EXILES.table.x, EXILES.table.z + 8), use('坐下观察被改写的甜点', '甜点的代码改变了客人的感受；Persephone 看见丈夫怎样把他人当成实验。', EXILES.table.x, EXILES.table.z), think('知道原因，就能拥有他人的选择吗？', '对原因的认识不能抹掉被影响者的感受与决定。', EXILES.table.x, EXILES.table.z), use('要求交出钥匙匠', 'Merovingian 拒绝交出钥匙匠，并让守卫送客。', EXILES.table.x, EXILES.table.z), walk('离开主桌，走向升降梯', 0, 17)], ['morpheus', 'trinity', 'merovingian', 'persephone', 'twin1', 'twin2']),
  scene('m2_persephone', 2, 'le_vrai', 'neo', 'Persephone 的条件', 'keymaker', 'oracle', '在餐厅出口，Persephone 主动把三人带进侧面的盥洗室。她愿意带路，但提出一个关于真情的条件。', [walk('跟随 Persephone 进入盥洗室', EXILES.washroom.x, EXILES.washroom.z), use('听清她真正想要的条件', '她想重新确认曾经感受过的爱，而不是再听一套因果论。', EXILES.washroom.x, EXILES.washroom.z), use('回应 Persephone 的条件', '回应会改变她与 Trinity 对你的态度。', EXILES.washroom.x, EXILES.washroom.z), walk('穿过后厨，找到私人办公室', EXILES.kitchen.x, EXILES.kitchen.z), use('请 Persephone 打开伪装成壁橱的门', '钥匙打开的不是壁橱，而是通往城堡的后门。', EXILES.office.x, EXILES.office.z)], ['persephone', 'trinity', 'morpheus']),
  scene('m2_library', 2, 'keymaker_workshop', 'neo', '书墙后的囚徒', 'keymaker', 'chateau', '众人经过城堡前厅来到书房。两个旧版本流亡程序守着书墙后的囚室；Persephone 的背叛让去见钥匙匠的路打开。', [walk('穿过城堡书房，观察旧程序', EXILES.library.x, EXILES.library.z), use('让 Persephone 应对看守', '一个看守倒下，另一个逃去通风报信。Merovingian 很快会赶来。', EXILES.guard.x, EXILES.guard.z), use('检查书墙后的暗门', '隐藏的书架滑开，露出后面的钥匙工坊。', EXILES.bookshelf.x, EXILES.bookshelf.z), use('亲自确认钥匙匠身份', '钥匙匠承认自己一直在等人打开这扇门。', EXILES.keymaker.x, EXILES.keymaker.z), walk('带钥匙匠到书房侧门', EXILES.escape.x, EXILES.escape.z)], ['keymaker', 'persephone', 'morpheus', 'trinity', 'cain', 'abel_mero']),
  scene('m2_chateau', 2, 'chateau_hall', 'neo', '双楼梯与古兵器', 'keymaker', 'chateau', 'Morpheus 与 Trinity 护送钥匙匠离开。Neo 留在城堡大厅，先挡住枪火，再利用墙上的古兵器对付 Merovingian 的守卫。', [fight('守住城堡大厅', 4), use('推开通向同伴的门', '门后不是车库，而是遥远的雪山。Neo 必须从远处赶回高速公路。', 0, -38.5)]),
  scene('m2_mountain', 2, 'mountain_range', 'neo', '城堡后门 · 雪山误传', 'keymaker', 'chateau', '城堡后门通向白日里的雪山。同伴已从另一扇门进入车库；Neo 必须弄清位置，亲自飞回城市。', [
    use('试着推回城堡后门', '门已锁死，车库的轮胎声隔在另一侧。', MOUNTAIN.door.x, MOUNTAIN.door.z, 1),
    use('到山崖边联系 Link', 'Link 确认 Neo 身在群山中；双子正追赶 Morpheus、Trinity 和钥匙匠。城市在正南方。', MOUNTAIN.lookout.x, MOUNTAIN.lookout.z, 1),
    use('朝南方起飞', 'Neo 冲向天空，赶赴高速公路。', MOUNTAIN.launch.x, MOUNTAIN.launch.z, 1),
  ], ['link']),
  scene('m2_garage', 2, 'chateau_garage', 'trinity', '车库中的追兵', 'freeway', 'chase', '钥匙匠已发动轿车。双子会穿透撞击，不能靠拳脚清除；Trinity 必须载上 Morpheus 与钥匙匠冲出车库。', [walk('跑向钥匙匠发动的轿车', -3, 14), { kind: 'drive', label: '驾车穿过双子的拦截', x: -3, z: 14 }], ['morpheus', 'keymaker', 'twin1', 'twin2']),
  scene('m2_freeway', 2, 'freeway_101', 'trinity', '逆向的高速路', 'freeway', 'chase', 'Trinity 骑摩托车带着钥匙匠逆向穿过车流。W 加速，S 刹车，A / D 转向；碰撞会损伤车辆和乘员。', [walk('靠近接应摩托车', 14, 660), { kind: 'drive', label: '驾驶摩托车护送钥匙匠', x: 14, z: 660 }, use('把钥匙匠交给 Morpheus', '两人抵达接应区。Morpheus 接过护送任务，追逐转向重型卡车。', 14, -660)], ['keymaker', 'morpheus']),
  scene('m2_trucks', 2, 'freeway_trucks', 'morpheus', '两辆卡车之间', 'freeway', 'chase', 'Morpheus 在疾驰的十八轮卡车车顶抵挡 Johnson。F 连击、X 闪避；把他击退后，赶到钥匙匠身边，在卡车相撞前按 G 稳住两人，等待 Neo 飞来。', [
    { ...fight('在卡车顶击退 Johnson', 1, 'agent', 'agent_johnson'), ...TRUCKS.morpheus },
    walk('赶到钥匙匠身边', TRUCKS.keymaker.x, TRUCKS.keymaker.z),
    use('抓住钥匙匠，迎接 Neo', '两辆货车正面相撞。Neo 掠过车顶，在爆炸前带走 Morpheus 与钥匙匠。', TRUCKS.keymaker.x, TRUCKS.keymaker.z, 1.5),
  ], ['keymaker', 'agent_johnson', 'niobe', 'neo']),
  scene('m2_plan', 2, 'neb_deck', 'neo', '钥匙匠的路线', 'architect', 'infiltration', '打开通往源头的门需要同步切断主电源与备用电源。几艘船分头行动。', [use('核对电站示意图', 'Niobe 的队伍负责发电厂，另一支队伍负责备用电源；Neo 与 Morpheus 护送钥匙匠。', 0, -16), think('合作如何改变可能的选择？', '这条路线无法靠一个人的力量完成。')], ['keymaker', 'morpheus', 'trinity']),
  scene('m2_power', 2, 'power_station', 'niobe', '主电网的倒计时', 'architect', 'infiltration', 'Niobe 与 Ghost 进入发电厂，在换班前安放同步爆破装置。备用系统未关闭前，主网仍受保护。', [fight('清除配电区守卫', 2), use('设定同步爆破装置', '主网装置已武装；必须等应急系统也停用，才能同时解除源头的保护。', 0, -29, 6)], ['ghost']),
  scene('m2_vigilant', 2, 'service_tunnels', 'trinity', '突然失去的联系', 'architect', 'siege', '执行应急系统任务的 Vigilant 遭到哨兵袭击。Trinity 与 Link 无法得到船员回应。', [use('检查 Vigilant 最后的信号', 'Soren 的队伍失联，应急系统仍在供电。等待会让进入核心的队伍全军覆没。', 0, -20), use('接入备用电站', 'Trinity 违背 Neo 的请求，决定亲自补上缺口。', 0, 0)], ['link']),
  scene('m2_backup', 2, 'backup_station', 'trinity', '最后一条供电线路', 'architect', 'combat', 'Trinity 冲进电网改线中心，在特工拦截前接入应急系统主机。', [fight('突破机房封锁', 2), use('接入应急系统，准备终止自动改线', 'Niobe 的主网装置起爆。应急系统随即接管，Trinity 必须在 Neo 抵达白门前完成最后的覆盖。', 0, -23, 4)]),
  scene('m2_key_door', 2, 'source_corridor', 'neo', '钥匙匠的最后一扇门', 'architect', 'infiltration', '主网已失电，应急系统却重新接管。Neo 与 Morpheus 必须保护钥匙匠穿过 Smith 复制体，等待 Trinity 切断最后一路保护。', [
    walk('抵达工业走廊的转角', 0, -20),
    { ...fight('挡住 Smith 复制体，保护钥匙匠', 3, 'smith'), z: -25 },
    use('从复制体手中救出 Morpheus', 'Neo 将 Smith 从 Morpheus 身旁推开，钥匙匠找到正确的门。', 0, -31, 2),
    use('配合钥匙匠打开第一道门', '应急保护已解除。钥匙匠推开门户；Smith 的枪声追着三人进入另一侧。', 0, -38, 3),
    use('从负伤的钥匙匠手中接过最后的钥匙', '钥匙匠把通往源头的钥匙交给 Neo，Morpheus 必须走另一条回程门。', 0, -45, 2),
    use('由 Neo 打开通往源头的门', 'Neo 用钥匙打开白门，独自面对建筑师；Morpheus 留在门外。', 0, -52, 3),
  ], ['keymaker', 'morpheus', 'smith']),
  scene('m2_architect', 2, 'architect_room', 'neo', '被计算过的救世主', 'architect', 'source', '环形屏幕记录了 Neo 的不同反应。建筑师说出此前五次循环、锡安的命运，以及两扇门各自的代价。', [
    walk('走到建筑师面前', 0, -8),
    use('听建筑师解释异常与此前五次循环', '屏幕上的 Neo 同时反驳、沉默、愤怒。建筑师说，这是第六次；先知引导的选择一直是控制异常的组成部分。', 0, -12, 5),
    use('查看右门：返回源头', '右门通向源头。按建筑师的方案，Neo 会重置矩阵、从矩阵挑选二十三人重建锡安；现有锡安将被摧毁。', 8, -26, 4),
    use('查看屏幕：Trinity 的实时影像', '画面切到城中改线设施。Trinity 已闯入危险之中；左门返回矩阵，Neo 可以去救她，但拒绝源头方案也意味着锡安前途未定。', -4, -19, 4),
    think('理解代价，再决定谁来承担', '两扇门都不是没有损失的答案。记录你的理解，然后由 Neo 亲自走向左门。', 0, -18),
    use('打开左门，返回矩阵营救 Trinity', 'Neo 走进左门，飞向城中的坠落；源头提出的循环没有在这一刻被执行。', -8, -26, 2),
  ], ['architect']),
  scene('m2_catch', 2, 'trinity_roof', 'neo', '抓住正在坠落的人', 'trinity_choice', 'the_one', 'Trinity 中枪坠出高楼。Neo 从建筑师的左门返回矩阵，必须在她触地前赶到。', [
    use('冲出大楼，追上 Trinity', 'Neo 冲破窗口，沿城市街谷飞向坠落的 Trinity。', 0, 27),
    use('在落地前接住 Trinity', 'Neo 在城市高空接住 Trinity，把她带往屋顶。', -8.5, -24),
    use('从代码中取出子弹', '子弹离开伤口，Trinity 却失去了心跳。', -.6, -18.2),
    use('让心脏重新跳动', 'Trinity 恢复意识。两人回到飞船，战争却仍在逼近。', -.6, -18.2),
  ], ['trinity', 'agent_johnson']),
  scene('m2_ship_lost', 2, 'neb_deck', 'morpheus', '尼布甲尼撒号的终点', 'trinity_choice', 'siege', 'Neo 说预言也是控制。Link 的雷达突然报告：哨兵停在 EMP 范围外，投下的炸弹正逼近旧船。', [
    use('听 Neo 说出源头的真相', 'Morpheus 听见：预言与锡安的重建也是控制的一部分。他的信念动摇，但警报打断了谈话。', 0, 20),
    use('核对雷达：炸弹在 EMP 范围外', '哨兵留在 EMP 射程外；开火不能阻止炸弹。Link 找到通往船尾货舱的逃生路线。', 0, 0),
    use('下令弃船，打开货舱出口', '连接椅、屏幕与船体都必须留在身后。炸弹已经进入最后航段。', 0, 0),
    walk('带领船员从货舱撤入隧道', 0, 35),
  ], ['neo', 'trinity', 'link']),
  scene('m2_stop_sentinels', 2, 'service_tunnels', 'neo', '触及现实中的连接', 'trinity_choice', 'awakening', '尼布甲尼撒号在身后爆炸。众人沿狭窄管道逃跑，哨兵再次追来；Neo 感到它们的信号。', [
    walk('跑到隧道窄口，回身面对哨兵', 0, -25),
    use('朝哨兵伸手，凝神切断连接', '哨兵逐一失去动力。Neo 因这次现实中的连接耗尽体力、陷入昏迷；Hammer 接走幸存者。', 0, -25),
  ], ['trinity', 'morpheus', 'link']),
  scene('m2_medical', 2, 'hammer_deck', 'trinity', '两个昏迷的人', 'mobil', 'mobil', 'Hammer 的医疗舱内，Neo 没有接入设备却仍昏迷。Maggie 在床边监测他的身体。', [
    use('与 Maggie 一起查看 Neo 的生命体征', 'Neo 的身体稳定，却没有醒来；Maggie 无法解释他与机器的连接。Trinity 留在床旁。', -7, -25),
    use('向 Roland 询问另一场灾难', '锡安舰队过早触发 EMP，计划因此瓦解；那场战斗只带回一名幸存者。', 0, -16),
    use('走到邻床，确认幸存者身份', '邻床的人是 Bane。他同样昏迷；没人知道他在那场灾难之前经历了什么。', 10, -25),
  ], ['neo', 'bane', 'maggie', 'morpheus', 'roland']),

  scene('m3_mobil', 3, 'mobil_station', 'neo', '既不在这里，也不在那里', 'mobil', 'mobil', 'Neo 在没有来路的白色站台醒来。先与迎上来的 Sati 说话，再确认站名。', [use('与 Sati 说话', 'Sati 说这里是 Mobil Ave；她没有见过通往城市的出口。', -5, 12, 2), use('辨认 MOBIL AVE 站名', '站名像一条线索：Mobil 是 Limbo 的字母重排，这里不是普通的地铁站。', -10, 5, 2)], ['sati']),
  scene('m3_family', 3, 'mobil_station', 'neo', '没有指定用途的孩子', 'sati', 'oracle', 'Rama-Kandra 与 Kamala 带着女儿等待迟到的列车。Sati 没有系统指定的用途，他们仍愿付出一切保护她。', [walk('走到 Sati 一家的长椅旁', -7, -8), think('没有指定用途的生命，仍值得被爱吗？', 'Rama-Kandra 不把爱当成程序错误；他们让 Sati 通过这列车去见先知。', -7, -8)], ['rama_kandra', 'kamala', 'sati']),
  scene('m3_trainman', 3, 'mobil_station', 'neo', '列车驶离', 'sati', 'mobil', '列车晚点抵达。帮助这一家上车，再试着面对替 Merovingian 管理边界的 Trainman。', [use('帮 Rama 提起行李', '隧道深处传来列车声。Neo 把行李递到站台边。', -6, -8, 2), walk('等列车停稳，走向车门', 6, -20), use('尝试随 Sati 一家上车', 'Trainman 拒绝 Neo，击退他，并带着一家人驶离。', 6, -20, 1), walk('沿一端隧道寻找出口', 0, -49), walk('再试另一端隧道', 0, 49)], ['trainman', 'rama_kandra', 'kamala', 'sati']),
  scene('m3_oracle_request', 3, 'oracle_home', 'trinity', '另一边的营救', 'oracle_last', 'oracle', 'Seraph 把 Trinity 与 Morpheus 带到先知的旧公寓。眼前的先知换了模样，而 Neo 的身体仍躺在 Hammer。', [use('确认眼前的人仍是先知', '她为帮助 Neo 作了选择，也付出了代价。', -4, -18, 2), use('询问 Neo 被困的位置', '他在矩阵与机器世界之间的线路上；Trainman 替 Merovingian 守着出口。', -4, -18, 2), think('知道先知也会付代价，还要信任她吗？', 'Morpheus 可以自己判断是否相信她；救回 Neo 不需要先解决所有预言。', -4, -18), walk('跟随 Seraph 出门找 Trainman', 0, 18)], ['oracle', 'morpheus', 'seraph']),
  scene('m3_trainman_chase', 3, 'subway_platform', 'seraph', '逃走的列车管理员', 'oracle_last', 'chase', 'Seraph 在地铁车厢认出 Trainman。他急停列车，穿过站台与通道逃向另一侧月台。', [use('认出车厢里的 Trainman', '他拉下紧急制动，持枪逃下列车。', 0, 15, 1), walk('穿过钢柱追到对向站台', 0, -34), use('看他借驶过的列车消失', 'Seraph、Trinity 与 Morpheus 没有抓住他；Trinity 决定直接去找他的主人。', 0, -34, 2)], ['trinity', 'morpheus', 'trainman']),
  scene('m3_hel_garage', 3, 'hel_garage', 'trinity', '通往 Hel 的车库', 'oracle_last', 'combat', '三人到达地下车库。大块头和两名流亡程序挡住通往 Club Hel 的金属门。', [{ ...fight('突破三名入口守卫', 3), z: 12 }, use('打开通往 Club Hel 的钢门', '门后只有一部向下的铁笼电梯。', 0, -29, 2)], ['morpheus', 'seraph']),
  scene('m3_hel_entry', 3, 'club_hel', 'trinity', '地狱的衣帽间', 'oracle_last', 'combat', '在标着 HEL 的电梯按钮后面，是衣帽间、武器检查柜与通往舞池的重门。', [use('按下电梯的 HEL 按钮', '铁笼下降；Seraph 提醒俱乐部不许携带武器。', 0, 31, 3), { ...fight('突破衣帽间守卫', 5), z: 19 }, use('从武器检查柜取回装备', '衣帽间的枪声被舞池音乐盖过，三人重新拿起装备。', -8, 7, 2), use('推开通往舞池的重门', '三人推开重门，震耳的舞曲和人群涌入视野。', 0, 4, HEL_DANCE_DOOR.seconds), walk('穿过舞池到 VIP 高台', 0, -28)], ['morpheus', 'seraph']),
  scene('m3_hel_bargain', 3, 'club_hel', 'trinity', '不接受的交换', 'oracle_last', 'infiltration', '舞池里的人群围住三人。Merovingian 要用先知的双眼交换 Neo；Trinity 必须亲自打破包围。', [
    use('被包围后放下武器', '舞曲戛然而止。三人放下枪，避免人群立刻开火。', 0, -28, 0),
    use('听清交换条件', 'Merovingian 要先知的双眼作为带回 Neo 的代价。', 0, -29, 0),
    think('是否牺牲先知换回 Neo？', 'Trinity 拒绝让另一个人的身体成为交换品；她选择承担自己面前的风险。', 0, -29),
    use('冲破舞池包围', '等待前排守卫挥拳，X 闪避后面向高台按 F 反击。', 0, -29, 0),
    use('接住 Seraph 踢来的枪', '守卫被击退，Seraph 把手枪踢向 Trinity。及时按 G 接住。', 0, -31, 0),
    use('近身逼迫 Merovingian 放人', 'Trinity 举枪控制 Merovingian。Persephone 看出她不会退让，他命 Trainman 带 Neo 回来。', 2, -33, 0),
  ], ['merovingian', 'persephone', 'morpheus', 'seraph', 'trainman']),
  scene('m3_mobil_release', 3, 'mobil_station', 'neo', '等来同伴', 'oracle_last', 'oracle', 'Neo 无法靠自己打破 Mobil Ave 的边界。列车再次出现，这一次 Trinity 从车门走向他。', [walk('等列车停稳，走向 Trinity', 0, -22), use('与 Trinity 一同离站', '连接重新通向矩阵。Neo 决定先去见先知。', 0, -22, 2)], ['trinity', 'trainman']),
  scene('m3_oracle_last', 3, 'oracle_home', 'neo', '没有保证的未来', 'oracle_last', 'oracle', 'Neo 从 Mobil Ave 返回，再次走进先知的厨房；他要亲自追问源头、Smith，以及先知以前没有说出的真相。', [
    walk('穿过候诊室，走进先知的厨房', 0, -10),
    use('问先知为什么没有提过建筑师与此前的救世主', '先知没有把隐瞒说成无害；她提醒 Neo 回看自己当时尚不能理解的选择。', -5, -22, 2),
    use('问现实中停止哨兵的力量与 Smith 的威胁', 'Neo 接触哨兵时感到的连接指向源头。Smith 已超出矩阵里的对抗，正威胁人类和机器。', -5, -22, 2),
    think('不知道结果，还要行动吗？', '先知也看不到自己尚未理解的选择之后。Neo 听完线索，仍须自己决定下一程。', -5, -22),
    walk('离开先知公寓，独自整理这次会面的线索', 0, 18),
  ], ['oracle', 'sati', 'seraph']),
  scene('m3_oracle_absorbed', 3, 'oracle_home', 'oracle', '等待 Smith', 'final', 'infiltration', '另一视角：Neo 已离开。先知闻到烤箱里的饼干，Seraph 警告走廊里的 Smith 正在逼近。', [
    use('把饼干交给 Sati，请 Seraph 带她离开', 'Seraph 带 Sati 走向楼梯；先知留在厨房，想为他们争取时间。', -5, -22, 1.5),
    use('听走廊灯逐盏熄灭，确认两人已经撤走', '黑暗沿走廊追上他们。先知不知道他们能走多远，仍没有离开厨房。', -5, -22, 1.5),
    think('无法看见终点的赌注', '她选择把自己留在 Smith 面前；这不是保证能救下所有人的预言。', -5, -22),
    use('留在厨房，面对走进来的 Smith', 'Smith 同化先知，也夺取了自己尚不能理解的预见。Neo 此时并不知道这里发生的一切。', -5, -22, 2),
  ], ['sati', 'seraph', 'smith']),
  scene('m3_bane_questions', 3, 'hammer_deck', 'roland', '幸存者的说法', 'bane', 'bane', 'Bane 醒来后声称记不得舰队为何提前触发 EMP。Roland 与 Maggie 要把伤口、医疗扫描和舰队记录放在一起核对。', [
    walk('走进 Hammer 的医疗舱，查看 Bane', 0, -18),
    use('检查 Bane 手臂上的旧割伤', 'Maggie 判断伤口可能由他自己造成；Bane 却说不记得缘由。', -7, -25, 1.5),
    use('对照舰队记录，追问过早触发的 EMP', '舰队的预定进攻与实际爆发不符。Bane 是唯一被救回的人，却仍坚持失忆。', 0, -18, 1.5),
    use('复核 VDT 与异常神经活动', '检测没有发现 VDT；神经扫描仍有异常放电与新近创伤。Maggie 要继续观察。', -7, -25, 1.5),
    think('疑点应怎样处理？', '证据足以继续调查，尚不足以证明他如何生还，更不能提前知道他会登上哪艘船。', 0, -18),
  ], ['bane', 'maggie']),
  scene('m3_logos_plan', 3, 'hammer_deck', 'neo', '分开的两条航线', 'last_sky', 'zion', '失踪的 Logos 已被找到。Hammer 的船员讨论返航路线，Neo 进来提出另一条路：去机器城寻找停战可能。', [
    walk('进入 Hammer 的航路会议区', 0, -12),
    use('向众人说明要去机器城，而非返回锡安', 'Roland 不肯交出 Hammer。Niobe 听完后，决定把自己的 Logos 借给 Neo。', 0, -16, 1.5),
    use('核对两船燃料、补给与船员去向', 'Hammer 携带防守补给，由 Niobe 驾驶返航锡安；Logos 留给 Neo 与自愿同行的 Trinity。', -7, -25, 1.5),
    think('信任来自预言还是行动？', 'Niobe 并非因为相信救世主预言才借船。她信任的是作出这个决定的人。', 0, -16),
    walk('穿过货舱，和 Trinity 一起登上 Logos', 0, 27),
  ], ['niobe', 'trinity', 'morpheus', 'roland']),
  scene('m3_zion_prepare', 3, 'zion_council', 'lock', '最后的防守部署', 'siege', 'siege', '机器接近船坞。议会组织撤离，Lock 与 Mifune 将防守集中在闸门附近。', [use('确认船坞部署', 'APU 队伍负责火力，补给人员运送弹药，居民撤向神庙。', 0, -18), walk('前往船坞防线', 0, 22)], ['mifune', 'hamann']),
  scene('m3_maggie_discovery', 3, 'hammer_deck', 'roland', '空出的医疗舱', 'bane', 'bane', '另一视角：Hammer 已经启航。船员呼叫 Roland；医疗舱里出了事，而 Logos 已走上另一条航线。', [
    walk('赶到医疗舱查看 Maggie', 0, -18),
    use('确认 Maggie 遇害，并核对 Bane 的床位', 'Maggie 被杀，Bane 已不在 Hammer。Roland 与 Morpheus 意识到他可能潜入了 Logos，却无法及时追回。', -7, -25, 1.5),
  ], ['morpheus']),
  scene('m3_bane', 3, 'logos_deck', 'neo', 'Logos 上的 Bane', 'bane', 'bane', '驾驶舱突然断电。Trinity 下到工程舱检查保险丝；Neo 听见她呼救，走向下层，发现占据 Bane 身体的 Smith。现实中的肉身不能使用矩阵能力。', [
    walk('从驾驶舱走进狭长下层，寻找 Trinity', 0, -6),
    use('面对持电枪的 Bane', 'Trinity 在舱口下切断电路。趁电枪失去瞄准的瞬间闪避，近身反击。', 0, -6, 0),
    use('打开工程舱舱口，带 Trinity 返回驾驶舱', 'Bane 已死。Neo 的双眼被电缆灼伤，却看见机器与 Smith 的金色轮廓；Trinity 将继续驾驶 Logos。', -6, 8, 1.6),
  ], ['trinity', 'bane']),
  scene('m3_hammer_tunnels', 3, 'hammer_route', 'niobe', 'Hammer 的狭窄航路', 'siege', 'chase', '主航道已被哨兵封死。Niobe 驾驶 Hammer 转入狭窄机械管线；Morpheus 操纵侧向推进器，Roland 与船员守住船身。', [
    use('核对主航道与机械管线', 'Hammer 无法在主航道减速转弯；Niobe 选择从侧面的机械管线返回锡安。', -5, 164, 1.5),
    use('让 Morpheus 接管侧向推进器', '船员就位。保持速度穿过弯道和横向管梁；太慢会让哨兵追上。', 0, 175, 1.5),
    { kind: 'drive', label: '驾驶 Hammer 穿过机械管线', x: 0, z: 175 },
  ], ['morpheus', 'roland']),
  scene('m3_dock_battle', 3, 'zion_hangar', 'mifune', '船坞的弹药与钢铁', 'siege', 'siege', '钻头突破穹顶，哨兵涌入船坞。Mifune 驾驶 APU 为推送弹药车的 Kid 扫清航路。', [fight('以 APU 双炮掩护 Kid 的弹药车', 4, 'sentinel'), use('让 Kid 装入卡住的弹箱', 'Kid 爬上 APU，把卡住的弹箱踢入位。更多哨兵从穹顶涌来，Mifune 把打开闸门的任务交给他。', 0, 12, 2)], ['kid', 'zee', 'charra']),
  scene('m3_gate', 3, 'zion_hangar', 'kid', '打开三号闸门', 'siege', 'siege', 'Mifune 受致命伤，把打开闸门的任务交给 Kid。', [
    fight('突破闸门附近的哨兵', 2, 'sentinel'),
    { kind: 'drive', label: '接管受损 APU，冲向三号闸门', x: 0, z: 12 },
    use('操作三号闸门，让 Hammer 冲入船坞', 'Kid 用受损的 APU 拉起闸门。Hammer 冲进船坞；在里面启动 EMP 会同时瘫痪锡安自己的防御系统。', 0, -50, 7),
  ], ['zee']),
  scene('m3_emp', 3, 'hammer_deck', 'link', '代价高昂的援军', 'siege', 'siege', 'Hammer 刚穿过打开的闸门，Link 的 EMP 已充满。哨兵涌入船坞；启动它会同时烧毁锡安自己的防御设备。', [
    use('启动 EMP，清除船坞里的哨兵', '白色电磁波席卷船坞。哨兵坠落，APU 与自动防御也全部熄灭；下一波机器仍会到来。', 0, -16, 2),
    think('救援也会带来代价', '这次救援给人们争取了时间，却夺走了原有防线。剩下的人必须用手动设施守住神庙。'),
  ], ['niobe', 'morpheus', 'roland']),
  scene('m3_temple_defense', 3, 'zion_temple', 'zee', '神庙最后的门', 'siege', 'siege', 'EMP 之后自动防御停摆。新的哨兵已进入船坞；居民退向神庙，Zee 必须在它们抵达前手动锁住入口。', [
    walk('穿过人群，抵达神庙入口', 0, -30),
    use('锁住左侧手动卡榫', '左侧卡榫落位；没有电力，另一边也必须由人亲手扳紧。', -8, -45, 2),
    use('锁住右侧手动卡榫', '两侧卡榫咬合，厚重闸门在机器群抵达前落下。Zee 与 Link 暂时守住居民。', 8, -45, 2),
  ], ['link', 'hamann', 'kid', 'zion_parent', 'zion_neighbor']),
  scene('m3_defense', 3, 'machine_defense', 'trinity', '机器城的防线', 'last_sky', 'chase', 'Logos 接近机器城，浮动炸弹和密集机器封锁航路。', [
    { kind: 'drive', label: '驾驶 Logos 穿过浮雷与机器群，爬升进入云层', x: 0, z: 42 },
  ], ['neo']),
  scene('m3_sun', 3, 'above_clouds', 'trinity', '第一次看见太阳', 'last_sky', 'farewell', 'Logos 短暂穿出乌云。Trinity 看见蓝天与阳光，随后飞船失去动力。', [
    { kind: 'drive', label: '驾驶受损的 Logos 穿出云层，见证阳光与失速坠落', x: 0, z: 29 },
  ], ['neo']),
  scene('m3_farewell', 3, 'logos_wreck', 'neo', '坠落之后', 'last_sky', 'farewell', 'Logos 撞入机器城。Trinity 身受重伤，最后的路只能由 Neo 独自走完。', [walk('回到 Trinity 身边', 0, -15), think('有限的生命如何留下意义？', '失去无法被一个更大的目标抵消。你带着共同的经历继续行动。')], ['trinity']),
  scene('m3_deus', 3, 'machine_core', 'neo', '共同的威胁', 'pact', 'source', '机器聚成巨大的面孔。Neo 提出以清除 Smith 换取和平。', [walk('抵达连接平台', 0, -25), think('敌对双方为何还能够对话？', 'Smith 的扩张使双方都面临毁灭。合作从承认共同的脆弱开始。'), use('接受机器的连接', '机器暂缓进攻锡安，并把 Neo 接入矩阵。', 0, -25, 6)], ['deus_ex_machina']),
  scene('m3_rain', 3, 'smith_avenue', 'neo', '暴雨中的大道', 'final', 'final', '大道两侧全部是 Smith。拥有先知预见的复制体走到中央。', [walk('走到大道中央', 0, -15), fight('迎战 Smith', 1, 'smith'), use('追入被摧毁的街区', '交锋从地面延伸到空中，最终砸出深坑。', 0, -38)]),
  scene('m3_surrender', 3, 'smith_avenue', 'neo', '理解最后的选择', 'final', 'final', 'Smith 说出的预见让 Neo 理解了这场冲突的出口。', [think('胜利一定意味着压倒对方吗？', 'Neo 允许 Smith 同化自己，让机器经由仍然连接的身体抵达感染。'), use('接受同化', '金色的连接贯穿复制体。Smith 的感染被清除，暴雨结束。', 0, -38, 8)]),
  scene('m3_ceasefire', 3, 'zion_temple', 'kid', '机器退去', 'source', 'dawn', '哨兵停止进攻并撤离锡安。消息在神庙和居住层之间传开。', [walk('确认入口外的动静', 0, -30), use('把停战消息带给居民', '人们走出掩体。Morpheus 与 Niobe 看到等待终于有了回应。', 0, -30)], ['morpheus', 'niobe', 'zee', 'link']),
  scene('m3_neo_carried', 3, 'machine_core', 'neo', '光中的身体', 'source', 'dawn', '机器收起连接，带走 Neo 的身体。这一段以尾声观察呈现。', [use('记录已经达成的停战', '人类与机器没有被化约成单方的胜利。矩阵开始恢复。', 0, -20, 7)]),
  scene('m3_dawn', 3, 'sunrise_garden', 'oracle', 'Sati 留下的日出', 'dawn', 'dawn', '恢复后的公园里，先知与建筑师谈到和平与离开的权利。Sati 创造了新的日出。', [walk('抵达公园长椅', -7, -20), think('和平如何成为可以实践的承诺？', '愿意离开矩阵的人会得到机会。未来仍不确定，信任也仍需要行动。', -7, -20), use('看完日出，完成三部曲', '电影的故事在新的清晨结束。游戏保留本轮记忆，下一轮将回到 Anderson 的日常生活。', 0, -30, 6)], ['architect', 'sati', 'seraph']),
];

export const FILM_SCENE_BY_ID = Object.fromEntries(FILM_SCENES.map(s => [s.id, s]));
export const FILM_CAST = [...new Set([...FILM_SCENES.flatMap(s => [s.actor, ...s.cast]), ...Object.values(FILM_CONSEQUENCES).flatMap(Object.keys)])];
export const FILM_NAMES = { 1: '黑客帝国', 2: '重装上阵', 3: '矩阵革命' } as const;
export function oracleActing(journey: FilmJourney): boolean {
  return !journey.visiting && journey.scene === 'm1_oracle'
    && (journey.step === 0 && journey.oracle?.vase !== undefined && journey.oracle.vase < 4.5
      || Boolean(journey.oracle?.consultation && !['waiting', 'done'].includes(journey.oracle.consultation.phase)));
}
export function filmStepPosition(scene: FilmScene, step: FilmStep): Vector3 {
  const position = filmPosition(scene.set, step.x, step.z);
  if (scene.id === 'm2_trucks') position.y += TRUCKS.roof.height;
  if (scene.id === 'm2_chateau' && step.z < -30) position.y += 10;
  if (scene.id === 'm1_pod' && step.z === 12) position.y -= 18;
  return position;
}
export function filmStepNear(scene: FilmScene, step: FilmStep, position: Vector3, matrix: boolean): boolean {
  const radius = scene.id === 'm1_mirror' && step === scene.steps[0] ? MIRROR_TOUCH.radius : 4;
  return matrix === (FILM_SETS[scene.set].world === 'matrix') && distance(position, filmStepPosition(scene, step)) <= radius;
}
export function filmStepActionReady(scene: FilmScene, step: FilmStep, position: Vector3, matrix: boolean): boolean {
  return step.kind !== 'reach' && step.kind !== 'reflect' && filmStepNear(scene, step, position, matrix);
}
export function filmEntry(scene: FilmScene): Vector3 {
  if (scene.id === 'm3_hammer_tunnels') return filmPosition(scene.set, 0, 184);
  if (scene.id === 'm1_room303') return filmPosition(scene.set, -8, 18);
  if (scene.id === 'm3_mobil') return filmPosition(scene.set, 0, 22);
  if (scene.id === 'm3_mobil_release') return filmPosition(scene.set, 0, 20);
  if (scene.id === 'm2_backdoors') return filmPosition(scene.set, SERAPH_ORACLE.hall.entry.x, SERAPH_ORACLE.hall.entry.z);
  if (scene.id === 'm2_bench') return filmPosition(scene.set, SERAPH_ORACLE.yard.entry.x, SERAPH_ORACLE.yard.entry.z);
  if (scene.id === 'm2_room') return filmPosition(scene.set, 0, 8);
  if (scene.id === 'm2_oracle_message') return filmPosition(scene.set, 0, 0);
  if (scene.id === 'm1_wake_up') return filmPosition(scene.set, 0, 1);
  if (scene.id === 'm1_wake_again') return filmPosition(scene.set, APARTMENT.bed.x, APARTMENT.bed.z);
  if (scene.id === 'm1_ledge') return filmPosition(scene.set, 0, OFFICE_WINDOW.z);
  if (scene.id === 'm1_pod') return filmPosition(scene.set, 0, -12);
  if (scene.id === 'm1_recovery') return filmPosition(scene.set, RECOVERY_BED.standingX, RECOVERY_BED.z);
  if (scene.id === 'm2_freeway') return filmPosition(scene.set, 14, 674);
  if (scene.id === 'm2_trucks') return { ...filmPosition(scene.set, TRUCKS.morpheus.x, TRUCKS.morpheus.z), y: FILM_SETS[scene.set].center.y + TRUCKS.roof.height };
  if (scene.id === 'm2_mountain') return filmPosition(scene.set, MOUNTAIN.door.x, MOUNTAIN.door.z - 7);
  if (scene.id === 'm3_bane') return filmPosition(scene.set, 0, -31);
  return filmPosition(scene.set, 0, scene.id === 'm1_lobby' ? 35 : FILM_SETS[scene.set].depth * .32);
}
