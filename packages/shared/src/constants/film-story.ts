import { FILM_SETS, filmPosition } from './film-sets.js';
import { CONSTRUCT_REVEAL, RECOVERY_BED } from './awakening.js';
import type { Vector3 } from '../types/agent.js';
import type { Philosophy } from '../types/neo-life.js';
import { FILM_CONSEQUENCES } from './film-outcomes.js';
import { OFFICE_CONTACT, OFFICE_WINDOW, OFFICE_LADDER } from './office.js';
import { INTERROGATION_ROOM } from './interrogation.js';
import { MEETING_CAR, MEETING_DESTINATION } from './meeting.js';
import { APARTMENT } from './apartment.js';
import { CLUB } from './club.js';

export type FilmCue = 'night' | 'contact' | 'office' | 'club' | 'awakening' | 'training' | 'oracle' | 'infiltration' | 'combat' | 'the_one' | 'zion' | 'swarm' | 'restaurant' | 'chateau' | 'chase' | 'source' | 'mobil' | 'siege' | 'bane' | 'farewell' | 'final' | 'dawn';
export interface FilmStep {
  kind: 'reach' | 'interact' | 'fight' | 'reflect' | 'drive'; label: string; x: number; z: number;
  text?: string; seconds?: number; enemies?: number; enemy?: 'agent' | 'smith' | 'sentinel' | 'training'; opponent?: string;
}
export interface FilmScene {
  id: string; film: 1 | 2 | 3; set: string; actor: string; title: string; chapter: string;
  music: FilmCue; context: string; cast: string[]; steps: FilmStep[];
}
export interface FilmJourney {
  version: 1; scene: string; step: number; actor: string; completed: string[];
  enteredAt: number; started?: number; fighting?: boolean; checkpoint: Vector3;
  reflections: Record<string, Philosophy>; lastText: string; finished?: boolean;
  visiting?: string; returnPosition?: Vector3;
  lobby?: import('./lobby.js').LobbyEncounter;
  office?: import('./office.js').OfficeEncounter;
  phone?: import('./office.js').OfficePhone;
  skipped?: string[];
  ride?: import('./freeway.js').FreewayRide;
  awakening?: import('./awakening.js').AwakeningBeat;
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
  hotel?: import('./lafayette.js').HotelApproach;
  ambush?: import('./ambush.js').AmbushEncounter;
  sentinel?: import('./sentinel.js').SentinelEncounter;
  interlude?: import('./interlude.js').InterludeEncounter;
  betrayal?: import('./betrayal.js').BetrayalEncounter;
}
const walk = (label: string, x = 0, z = -12): FilmStep => ({ kind: 'reach', label, x, z });
const use = (label: string, text: string, x = 0, z = -12, seconds = 3): FilmStep => ({ kind: 'interact', label, text, x, z, seconds });
const think = (label: string, text: string, x = 0, z = -10): FilmStep => ({ kind: 'reflect', label, text, x, z });
const fight = (label: string, enemies = 2, enemy: FilmStep['enemy'] = 'agent', opponent?: string): FilmStep => ({ kind: 'fight', label, x: 0, z: 0, enemies, enemy, opponent });
const scene = (id: string, film: 1 | 2 | 3, set: string, actor: string, title: string, chapter: string, music: FilmCue, context: string, steps: FilmStep[], cast: string[] = []): FilmScene => ({ id, film, set: `film_${set}`, actor, title, chapter, music, context, steps, cast });

// Released-film narrative beats, authored as game objectives, not screenplay quotations.
// Perspective changes follow the people actually present; the ordinary-life prologue is a game extension.
export const FILM_SCENES: FilmScene[] = [
  scene('m1_room303', 1, 'heart_hotel', 'trinity', '追踪中的房间 303', 'contact', 'infiltration', '序幕：警方包围旅馆，Trinity 必须赶在特工封锁线路前撤离。', [use('断开电脑连接', '线路已经暴露。拿起听筒，确认撤离出口。', -7, -12), fight('突破警员封锁', 2), walk('抵达走廊尽头', 0, -21)]),
  scene('m1_roofs', 1, 'hotel_roofs', 'trinity', '屋顶追逐', 'contact', 'chase', '特工紧追不舍，撤离路线穿过屋顶与消防梯。', [walk('穿过通风设施', -7, 12), walk('绕过楼梯间', 7, -14), use('沿消防梯撤向电话亭', 'Trinity 穿过对面的窗户，继续赶往 Wells 与 Lake 的出口。', 0, -38)]),
  scene('m1_phone_escape', 1, 'wells_phone', 'trinity', '卡车前的电话', 'contact', 'chase', '出口电话响起，特工驾驶的卡车正在逼近。', [walk('冲向电话亭', 0, -28), use('接起出口电话', '连接及时中断。卡车撞毁电话亭，Trinity 已返回飞船。', 0, -28, 2)]),
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
  scene('m1_bridge', 1, 'adams_bridge', 'neo', '桥下的车灯', 'pill', 'contact', '雨夜桥下，轿车的后门等着你。Apoc 开车，Switch 在前座，Trinity 留出后座的位置。', [walk('走近轿车右后门', MEETING_CAR.approach.x, MEETING_CAR.approach.z), use('打开后车门并上车', 'Switch 要求检查追踪装置。Trinity 让你重新考虑是否现在离开。', MEETING_CAR.approach.x, MEETING_CAR.approach.z)], ['trinity', 'switch', 'apoc']),
  scene('m1_bug', 1, 'extraction_car', 'neo', '取出追踪器', 'pill', 'awakening', '你坐在 Trinity 身旁。扫描发现追踪器时，按住 G 保持身体稳定，松开会暂停抽取。检查后由 Apoc 送你赴约。', [use('配合扫描与抽取', '装置从腹部取出机械追踪器，Trinity 将它扔出车外。', MEETING_CAR.seat, MEETING_CAR.z + MEETING_CAR.rear), think('重新判断昨夜的经历', '当证据与熟悉的解释冲突，下一步应当相信什么？', MEETING_CAR.seat, MEETING_CAR.z + MEETING_CAR.rear), use('乘车抵达 Lafayette，下车后走到入口', '旧楼的门在面前。Morpheus 正在楼上的房间等你。', MEETING_DESTINATION.x, MEETING_DESTINATION.z)], ['trinity', 'switch', 'apoc']),
  scene('m1_pills', 1, 'lafayette', 'neo', '两把皮椅之间', 'pill', 'awakening', 'Lafayette 的旧房间里，Morpheus 把决定交给你。走到皮椅前，按 G 坐下听他说。', [use('坐到 Morpheus 对面的皮椅上', 'Morpheus 摊开双手。一边继续追问，一边回到熟悉的生活；决定仍然属于你。', 0, -3.3), think('亲自选择红色或蓝色药丸', '电影中的 Neo 选择红色药丸。蓝色药丸是游戏的日常生活分支；选择后，Neo 会亲手拿取药丸，用水吞服。', 0, -3.3)], ['morpheus', 'trinity']),
  scene('m1_mirror', 1, 'lafayette', 'neo', '镜面与定位', 'pill', 'awakening', '房间里的设备追踪你的真实身体，裂开的镜面开始复原。', [use('触碰裂镜', '镜面附着在手臂上，接线组终于定位到培养舱。回到设备旁，让连接完成。', -7, -15.8, 8), use('坐到连接椅上', '定位信号穿过模拟世界，熟悉的房间从感官中消失。', 8, 5)], ['morpheus', 'trinity']),
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
  scene('m1_lobby', 1, 'government_lobby', 'neo', '政府大楼的大堂', 'rescue', 'combat', '与 Trinity 突破大堂警戒，抵达后方电梯。石柱能挡住枪火；敌人瞄准后，及时换位。', [walk('穿过安检入口', 0, 23), { ...fight('与 Trinity 突破三道警戒', 2), z: 19 }, use('接通后方电梯', '电梯门打开。大堂通路已打通，可以继续营救 Morpheus。', 0, -35, 1)], ['trinity']),
  scene('m1_smith_question', 1, 'government_office', 'morpheus', 'Smith 的独白', 'rescue', 'infiltration', '审讯楼层里，Smith 对人类与矩阵表达了厌恶，逼问锡安的接入信息。', [think('在强迫下守住他人的生命', '被困者无法控制审讯，却仍在承受拒绝出卖同伴的代价。'), use('留意窗外的动静', '外面的营救逐渐接近。', 0, -18)], ['smith']),
  scene('m1_bullet_dodge', 1, 'government_roof', 'neo', '屋顶上的子弹', 'rescue', 'combat', '特工堵住屋顶。Neo 尝试闪避弹道，Trinity 在近处终结对手。', [fight('击退屋顶特工', 2), use('检查屋顶直升机', 'Trinity 请求下载驾驶程序，接下来的营救从空中展开。', 7, -20)], ['trinity']),
  scene('m1_helicopter', 1, 'government_office', 'morpheus', '破窗与绳索', 'rescue', 'chase', '直升机的火力打开审讯室。Morpheus 冲向窗外的救援绳索。', [walk('冲向破损玻璃幕墙', 0, -18), use('抓住 Neo 的救援绳', 'Morpheus 脱离大楼。受损的直升机继续失去高度。', 0, -18, 4)]),
  scene('m1_rooftop_rescue', 1, 'government_roof', 'neo', '拉住 Trinity', 'rescue', 'chase', '直升机坠落前，Trinity 将自己系在绳索上。Neo 在屋顶抓紧另一端。', [walk('抵达绳索固定点', 0, -22), use('稳住绳索，接应 Trinity', '直升机撞向玻璃大楼；Trinity 被拉到安全的屋顶。', 0, -22, 6)], ['trinity', 'morpheus']),
  scene('m1_subway', 1, 'subway_platform', 'neo', '不再逃跑', 'subway', 'combat', 'Morpheus 与 Trinity 通过电话离开。Smith 打断 Neo 的撤离。', [fight('面对站台上的 Smith', 1, 'smith', 'smith'), use('穿过站台出口', 'Neo 把对手拖向列车后逃出，但 Smith 仍能占用新的身体。', 0, -38)], ['smith']),
  scene('m1_city_chase', 1, 'escape_streets', 'neo', 'Tank 指引的街巷', 'the_one', 'chase', '出口电话不断失效，Tank 指引 Neo 穿过市场、后巷和住户楼层。', [walk('穿过街巷', -7, 18), walk('绕过被封住的路口', 7, -12), use('进入旅馆楼梯', '新的出口位于序幕出现过的旅馆。', 0, -42)]),
  scene('m1_death', 1, 'heart_hotel', 'neo', '再次回到 303', 'the_one', 'awakening', 'Neo 即将接通出口，Smith 却在房门后等候。', [walk('抵达 303 房门', 0, -16), use('推开房门', '枪击中断了信号。现实中的 Trinity 仍在对 Neo 说话。', 0, -16, 5)]),
  scene('m1_return', 1, 'heart_hotel', 'neo', '看见代码', 'the_one', 'the_one', 'Neo 恢复意识。走廊、子弹与特工都呈现出新的结构。', [use('停住逼近的子弹', 'Neo 重新认识规则，Smith 的攻击失去了原来的决定性。', 0, -10), fight('穿透 Smith 的防线', 1, 'training'), use('接通出口', 'Tank 在最后关头触发 EMP，哨兵被摧毁，Neo 回到同伴身边。', 0, -20)], ['smith']),
  scene('m1_final_call', 1, 'final_phone', 'neo', '电话之后的天空', 'the_one', 'the_one', 'Neo 向系统宣告新的可能，随后飞向城市上空。第一部结束。', [think('力量将用来打开什么？', '让他人有选择的可能，比替所有人预先选择更困难。'), use('结束通话', '城市生活仍在继续，战争也没有结束。', 0, -25)]),

  scene('m2_dream', 2, 'trinity_roof', 'trinity', '关于坠落的梦', 'zion', 'chase', '第二部以 Trinity 的危险行动开场。高楼上的枪战与坠落不断出现在 Neo 的梦里。', [walk('抵达楼顶出口', 0, -16), use('穿过破窗', 'Neo 从梦中惊醒。这是预感，之后仍将面对真正的选择。', 0, -16)]),
  scene('m2_meeting', 2, 'captains_meeting', 'neo', '船长们的秘密会议', 'zion', 'infiltration', '机器大军正向锡安钻进。反抗军船长讨论防守与等待先知消息的分歧。', [use('听取船长报告', 'Lock 要求舰队返回，Morpheus 希望继续寻找通往源头的机会。', 0, -10), fight('击退升级后的特工', 3)], ['morpheus', 'trinity', 'niobe', 'ballard']),
  scene('m2_dock', 2, 'zion_hangar', 'neo', '回到锡安', 'zion', 'zion', '尼布甲尼撒号进入船坞。Kid 热切地迎接 Neo，维修人员忙着补给。', [walk('走下船坞栈桥', 0, -28), use('与 Kid 交谈', 'Kid 将自己的获救归功于 Neo；Neo 提醒他，那也是他自己的决定。', 0, -28)], ['kid', 'morpheus', 'trinity', 'link']),
  scene('m2_lock', 2, 'zion_council', 'morpheus', '信念与军令', 'zion', 'zion', 'Lock 对舰队行动表达不满。守城的责任与对预言的信任发生冲突。', [walk('进入指挥区域', 0, -12), think('如何面对共同的风险？', '信念不能取消他人必须承担的代价。')], ['lock', 'niobe']),
  scene('m2_residents', 2, 'zion_residences', 'neo', '门口的请求', 'zion', 'zion', '居民带着礼物与愿望等在 Neo 门口。他首先是一个会疲惫的人。', [walk('穿过居住层走廊', 0, -18), use('停下听取请求', '人们把战争中的焦虑与希望交给一个具体的人。', 0, -18)], ['trinity']),
  scene('m2_temple', 2, 'zion_temple', 'morpheus', '洞窟里的集会', 'zion', 'zion', 'Morpheus 向锡安居民说明威胁，并以共同的历史回应恐惧。', [walk('抵达神庙讲台', 0, -35), use('完成集会', '音乐与舞蹈开始。人们在战争到来前确认自己仍然活着。', 0, -35, 8)], ['niobe', 'lock']),
  scene('m2_room', 2, 'zion_bedroom', 'neo', '房间里的两个人', 'zion', 'oracle', 'Neo 与 Trinity 暂时远离集会。他害怕梦里的失去。', [walk('回到房间', 0, 0), think('预感是否会支配现在？', '珍惜眼前的人，与试图控制她的未来，不是同一种责任。')], ['trinity']),
  scene('m2_hamann', 2, 'zion_engineering', 'neo', '维持生命的机器', 'zion', 'oracle', 'Hamann 陪 Neo 来到工程层。锡安也依赖机器维持生命。', [walk('沿管线走到维护台', 0, -24), think('相互依赖是否排除自由？', '能够关闭机器，并不意味着可以不承担关闭之后的后果。')], ['hamann']),
  scene('m2_bane_copy', 2, 'backdoor_hall', 'bane', '被带出矩阵的感染', 'zion', 'infiltration', 'Bane 准备通过出口返回现实，Smith 却抢先接近。', [walk('赶往出口电话', 0, -35), use('接起听筒', 'Smith 同化 Bane，并借他的连接进入现实身体。此段记录感染的起点。', 0, -35)]),
  scene('m2_departure', 2, 'zion_hangar', 'neo', '离港前的消息', 'oracle_second', 'zion', '先知的讯息送到。议会允许继续寻找机会，舰队的防守安排仍有争论。', [use('接收先知的信物', 'Morpheus 继续自己的路线，Niobe 等人也承担各自的任务。', 0, -16), walk('登上飞船', 0, 30)], ['morpheus', 'trinity', 'niobe']),
  scene('m2_seraph', 2, 'seraph_teahouse', 'neo', '认识一个人的方法', 'oracle_second', 'training', '茶馆里的 Seraph 亲自交手，才肯带 Neo 前往先知身边。观察他的连续攻势，闪避后再接近。', [fight('完成 Seraph 的考验', 1, 'training', 'seraph'), use('接受前往后门的引导', 'Seraph 确认来者的身份与意图。', 0, -15)], ['seraph']),
  scene('m2_backdoors', 2, 'backdoor_hall', 'neo', '门连接的另一侧', 'oracle_second', 'oracle', '白色走廊中的门连接着通常无法相邻的地点。', [walk('跟随 Seraph 穿过走廊', 0, -30), use('打开通往庭院的门', '空间关系可以被程序重新安排。', 0, -40)], ['seraph']),
  scene('m2_bench', 2, 'oracle_courtyard', 'neo', '先知也是程序', 'oracle_second', 'oracle', '先知在庭院长椅旁谈到选择、异常程序与钥匙匠。', [walk('抵达庭院长椅', -7, -16), think('如何相信一个程序？', '判断可以依据来源，也可以依据行为；信任始终包含风险。', -7, -16)], ['oracle']),
  scene('m2_burly', 2, 'oracle_courtyard', 'neo', '越来越多的 Smith', 'copies', 'swarm', 'Smith 已脱离原来的系统职责。他把复制理解为新的存在方式。', [fight('突破复制体的围攻', 5), use('从庭院脱离包围', '对手仍在增殖。Neo 飞离庭院，这场交锋无法终结感染。', 0, -35)], ['smith']),
  scene('m2_merovingian', 2, 'le_vrai', 'neo', 'Le Vrai 的因果论', 'keymaker', 'restaurant', 'Merovingian 在餐厅拒绝交出钥匙匠，将权力解释为对原因的掌握。', [walk('靠近餐厅主桌', 0, -20), think('理解原因等于控制一切吗？', '把他人当作因果链上的工具，本身也是一种选择。')], ['morpheus', 'trinity', 'merovingian', 'persephone']),
  scene('m2_persephone', 2, 'le_vrai', 'neo', 'Persephone 的条件', 'keymaker', 'oracle', 'Persephone 在盥洗室提出交换，愿意带众人去见钥匙匠。', [walk('进入侧面的盥洗区域', 7, 8), use('听取她的交换条件', '交换涉及情感与背叛。她随后带众人穿过通往城堡的门。', 7, 8)], ['persephone', 'trinity', 'morpheus']),
  scene('m2_library', 2, 'keymaker_workshop', 'neo', '书墙后的囚徒', 'keymaker', 'chateau', 'Persephone 带众人绕过守卫，打开藏着钥匙匠的暗室。', [use('检查书墙暗门', '钥匙匠的工作台被钥匙和锁具包围。', -7, -18), use('打开工坊出口', 'Morpheus 与 Trinity 护送钥匙匠先行离开。', 0, -23)], ['keymaker', 'persephone', 'morpheus', 'trinity']),
  scene('m2_chateau', 2, 'chateau_hall', 'neo', '双楼梯与古兵器', 'keymaker', 'chateau', 'Neo 留在城堡大厅牵制 Merovingian 的守卫，追兵从柱列和楼梯两侧进入。', [fight('守住城堡大厅', 4), use('尝试追上同伴', '门后突然是遥远的山地。Neo 必须从远处赶回高速公路。', 0, -28)]),
  scene('m2_garage', 2, 'chateau_garage', 'trinity', '车库中的追兵', 'freeway', 'chase', 'Trinity 与 Morpheus 护着钥匙匠进入车库，双子紧追不舍。', [fight('为钥匙匠打开通路', 2), use('检查出口车辆', '车辆冲出地下车库，进入高速公路。', 0, -30)], ['morpheus', 'keymaker']),
  scene('m2_freeway', 2, 'freeway_101', 'trinity', '逆向的高速路', 'freeway', 'chase', 'Trinity 骑摩托车带着钥匙匠逆向穿过车流。W 加速，S 刹车，A / D 转向；碰撞会损伤车辆和乘员。', [walk('靠近接应摩托车', 14, 660), { kind: 'drive', label: '驾驶摩托车护送钥匙匠', x: 14, z: 660 }, use('把钥匙匠交给 Morpheus', '两人抵达接应区。Morpheus 接过护送任务，追逐转向重型卡车。', 14, -660)], ['keymaker', 'morpheus']),
  scene('m2_trucks', 2, 'freeway_101', 'morpheus', '两辆卡车之间', 'freeway', 'chase', 'Morpheus 在卡车上对抗特工，钥匙匠已没有更多退路。', [{ ...fight('保护钥匙匠', 2), x: 14 }, use('等待 Neo 的空中接应', '两辆卡车即将相撞，Neo 及时带走两人。', 14, -50)], ['keymaker']),
  scene('m2_plan', 2, 'neb_deck', 'neo', '钥匙匠的路线', 'architect', 'infiltration', '打开通往源头的门需要同步切断主电源与备用电源。几艘船分头行动。', [use('核对电站示意图', 'Niobe 的队伍负责发电厂，另一支队伍负责备用电源；Neo 与 Morpheus 护送钥匙匠。', 0, -16), think('合作如何改变可能的选择？', '这条路线无法靠一个人的力量完成。')], ['keymaker', 'morpheus', 'trinity']),
  scene('m2_power', 2, 'power_station', 'niobe', '主电网的倒计时', 'architect', 'infiltration', 'Niobe 的队伍进入发电设施，准备在同一时刻切断供电。', [fight('清除配电区守卫', 2), use('操作主断路器', '主电源被切断，下一组必须关闭备用系统。', 0, -29, 6)], ['ghost']),
  scene('m2_vigilant', 2, 'service_tunnels', 'trinity', '突然失去的联系', 'architect', 'siege', '执行备用电源任务的 Vigilant 被哨兵摧毁。Trinity 决定亲自补上缺口。', [use('检查中断的信号', '备用系统仍在供电。等待会让进入核心的队伍全军覆没。', 0, -20), use('接入备用电站', 'Trinity 违背 Neo 的请求进入矩阵。', 0, 0)], ['link']),
  scene('m2_backup', 2, 'backup_station', 'trinity', '最后一条供电线路', 'architect', 'combat', 'Trinity 冲进备用电站，在特工拦截前完成关停。', [fight('突破机房封锁', 2), use('关闭备用配电柜', '通向核心的路线短暂打开；Trinity 却被特工追上。', 0, -23, 4)]),
  scene('m2_key_door', 2, 'backdoor_hall', 'neo', '钥匙匠的最后一扇门', 'architect', 'infiltration', 'Smith 出现在走廊里。钥匙匠用最后的时间打开门，把任务交给 Neo。', [walk('抵达走廊尽头', 0, -35), use('接过钥匙，进入白门', '钥匙匠中枪倒下，Morpheus 留在门外。', 0, -40)], ['keymaker', 'morpheus']),
  scene('m2_architect', 2, 'architect_room', 'neo', '被计算过的救世主', 'architect', 'source', '建筑师通过环形屏幕解释异常、锡安和此前的循环。两扇门指向不同代价。', [walk('走到建筑师面前', 0, -8), think('预测能够取消自由吗？', '电影中的 Neo 选择救 Trinity；你的反思记录理解，不改写这个关键结果。'), use('走向 Trinity 所在的门', 'Neo 离开建筑师的房间，赶往城市中的坠落。', 7, -21)], ['architect']),
  scene('m2_catch', 2, 'trinity_roof', 'neo', '抓住正在坠落的人', 'trinity_choice', 'the_one', 'Trinity 中枪坠出高楼。Neo 冲入城市，在她触地之前接住她。', [walk('抵达接应平台', 0, -20), use('救回 Trinity', 'Neo 取出子弹，帮助她恢复心跳。两人返回现实，战争却仍在逼近。', 0, -20, 8)], ['trinity']),
  scene('m2_ship_lost', 2, 'neb_deck', 'morpheus', '尼布甲尼撒号的终点', 'trinity_choice', 'siege', '哨兵使用远程炸弹攻击。船员及时弃船，但尼布甲尼撒号被摧毁。', [use('发出弃船指令', '连接设备与旧船体留在身后。', 0, 0), walk('撤向隧道', 0, 31)], ['trinity', 'neo', 'link']),
  scene('m2_stop_sentinels', 2, 'service_tunnels', 'neo', '触及现实中的连接', 'trinity_choice', 'awakening', 'Neo 在现实中感到哨兵的连接并让它们停下，自己也陷入昏迷。', [walk('面对追来的哨兵', 0, -25), use('伸手触及陌生的信号', 'Hammer 救起幸存者。医疗舱里，Neo 与 Bane 躺在相邻床上。', 0, -25, 6)]),
  scene('m2_medical', 2, 'hammer_deck', 'trinity', '两个昏迷的人', 'mobil', 'mobil', 'Neo 的脑电信号仍像连接在矩阵中。Bane 是另一场灾难后仅存的幸存者。', [use('查看 Neo 的诊断屏幕', '没有插入连接，却仍有来自另一侧的活动。第二部在未解的信号中结束。', -7, -25)], ['morpheus', 'maggie']),

  scene('m3_mobil', 3, 'mobil_station', 'neo', '既不在这里，也不在那里', 'mobil', 'mobil', 'Neo 醒在 Mobil Ave。沿站台一直走入黑色隧道，试试这里的空间规则。', [walk('走进站台尽头的隧道', 0, -49), use('检查再次出现的站名', '这里属于 Trainman 管理的中间世界，通常的规则无法帮你离开。', 0, 37)]),
  scene('m3_family', 3, 'mobil_station', 'neo', '没有指定用途的孩子', 'sati', 'oracle', 'Rama-Kandra 与 Kamala 为女儿 Sati 寻找庇护。程序之间也有爱。', [walk('走到长椅旁', -7, -8), think('生命必须有用途吗？', 'Sati 的价值不能仅靠系统分配的功能来衡量。', -7, -8)], ['rama_kandra', 'kamala', 'sati']),
  scene('m3_trainman', 3, 'mobil_station', 'neo', '列车驶离', 'sati', 'mobil', 'Trainman 拒绝带走 Neo，并展示对这个空间的控制。Sati 一家乘车离开。', [use('尝试与 Trainman 沟通', '强行上车没有成功。Neo 只能等待外部的帮助。', 0, -22), walk('回到空站台', 0, 12)], ['trainman', 'sati']),
  scene('m3_oracle_request', 3, 'oracle_home', 'trinity', '另一边的营救', 'oracle_last', 'oracle', '先知告诉 Morpheus 与 Trinity：Neo 被困在 Trainman 掌管的地方。', [use('在厨房听取线索', 'Seraph 将带两人去找 Trainman；他的主人是 Merovingian。', -4, -21), walk('跟随 Seraph 离开', 0, 18)], ['oracle', 'morpheus', 'seraph']),
  scene('m3_trainman_chase', 3, 'subway_platform', 'seraph', '逃走的列车管理员', 'oracle_last', 'chase', 'Seraph 认出 Trainman，但对方逃入列车。必须直接前往 Club Hel。', [walk('追到站台另一端', 0, -34), use('查明俱乐部入口', '通往地下俱乐部的电梯成为下一条路线。', 0, -34)], ['trinity', 'morpheus']),
  scene('m3_hel_entry', 3, 'club_hel', 'trinity', '地狱的衣帽间', 'oracle_last', 'combat', '三人穿过电梯与衣帽间，守卫从墙壁和天花板方向发动攻击。', [fight('突破衣帽间守卫', 4), walk('抵达 VIP 高台', 0, -29)], ['morpheus', 'seraph']),
  scene('m3_hel_bargain', 3, 'club_hel', 'trinity', '不接受的交换', 'oracle_last', 'infiltration', 'Merovingian 索取先知的眼睛。Trinity 以直接对峙迫使他释放 Neo。', [walk('靠近 Merovingian 的座位', 0, -28), use('要求释放 Neo', 'Persephone 认出 Trinity 的决心。Merovingian 同意让 Trainman 放人。', 0, -28, 6)], ['merovingian', 'persephone', 'morpheus', 'seraph']),
  scene('m3_mobil_release', 3, 'mobil_station', 'neo', '等来同伴', 'oracle_last', 'oracle', '返回的列车终于带来 Trinity。Neo 决定先去见先知。', [walk('走向列车门', 0, -22), use('与 Trinity 一同离站', '连接重新通向矩阵。', 0, -22)], ['trinity']),
  scene('m3_oracle_last', 3, 'oracle_home', 'neo', '没有保证的未来', 'oracle_last', 'oracle', '先知解释 Neo 与源头的联系，也指出 Smith 已威胁双方的生存。', [think('不知道结果，还要行动吗？', '先知不能替你看穿所有选择。希望包含一次不能保证成功的尝试。'), use('带着线索离开公寓', 'Neo 决定去机器城，Trinity 要与他同行。', 0, 18)], ['oracle', 'sati', 'seraph']),
  scene('m3_bane_questions', 3, 'hammer_deck', 'roland', '幸存者的说法', 'bane', 'bane', 'Bane 声称不记得舰队遭遇。Maggie 检查他的伤口与精神状态。', [use('核对舰队记录', '他的解释无法完全消除疑点。', 0, -16), use('把检查交给 Maggie', 'Bane 随后袭击 Maggie，并潜入即将出发的 Logos。', -7, -25)], ['bane', 'maggie']),
  scene('m3_logos_plan', 3, 'service_tunnels', 'neo', '分开的两条航线', 'last_sky', 'zion', '众人找到 Logos。Niobe 把船交给 Neo，自己驾驶 Hammer 返回锡安。', [walk('抵达停泊的 Logos', 0, -28), think('信任来自预言还是行动？', 'Niobe 把决定建立在对人的判断上。两条航线分别承担谈判与防守。')], ['niobe', 'trinity', 'morpheus', 'roland']),
  scene('m3_oracle_absorbed', 3, 'oracle_home', 'oracle', '等待 Smith', 'final', 'infiltration', '先知让 Sati 与 Seraph 离开，自己留下等待不断扩张的 Smith。', [use('安排 Sati 撤离', 'Seraph 带着孩子穿过后门，追兵却已在矩阵中扩散。', 0, 13), think('无法看见终点的赌注', '先知没有逃走。Smith 同化她，获得了自己无法完全理解的预见。')], ['sati', 'seraph', 'smith']),
  scene('m3_zion_prepare', 3, 'zion_council', 'lock', '最后的防守部署', 'siege', 'siege', '机器接近船坞。议会组织撤离，Lock 与 Mifune 将防守集中在闸门附近。', [use('确认船坞部署', 'APU 队伍负责火力，补给人员运送弹药，居民撤向神庙。', 0, -18), walk('前往船坞防线', 0, 22)], ['mifune', 'hamann']),
  scene('m3_bane', 3, 'logos_deck', 'neo', 'Logos 上的 Bane', 'bane', 'bane', 'Smith 借 Bane 的身体袭击 Trinity 与 Neo。这里没有矩阵中的超能力。', [walk('进入货舱寻找 Trinity', 0, -24), fight('制止 Bane', 1, 'agent', 'bane'), use('带 Trinity 返回驾驶舱', 'Neo 的双眼被电缆灼伤，却开始感知机器的金色轮廓。Bane 被击倒。', 0, -31, 5)], ['trinity', 'bane']),
  scene('m3_hammer_tunnels', 3, 'service_tunnels', 'niobe', 'Hammer 的狭窄航路', 'siege', 'chase', 'Niobe 在管网中驾驶 Hammer，哨兵紧追，舰体承受着碰撞。', [use('核对主航道封锁', '必须改走狭窄的机械管线。', -7, -16), walk('抵达手动导航台', 7, -35), use('向锡安发送开门请求', 'Hammer 即将冲入船坞。', 7, -35, 6)], ['morpheus', 'roland']),
  scene('m3_dock_battle', 3, 'zion_hangar', 'mifune', '船坞的弹药与钢铁', 'siege', 'siege', '钻头突破穹顶，哨兵涌入船坞。Mifune 带队坚守。', [fight('抵挡第一批哨兵', 4, 'sentinel'), use('掩护弹药运输', 'Kid 向 APU 输送弹药，Zee 与 Charra 在地面攻击钻头。', 0, -30)], ['kid', 'zee', 'charra']),
  scene('m3_gate', 3, 'zion_hangar', 'kid', '打开三号闸门', 'siege', 'siege', 'Mifune 受致命伤，把打开闸门的任务交给 Kid。', [fight('突破闸门附近的哨兵', 2, 'sentinel'), use('操作三号闸门', 'Kid 用受损的 APU 打开入口。Hammer 冲入船坞，触发 EMP。', 0, -50, 7)], ['zee']),
  scene('m3_emp', 3, 'hammer_deck', 'niobe', '代价高昂的援军', 'siege', 'siege', 'EMP 清除附近哨兵，也摧毁了锡安自己的防御设备。', [use('关闭过载的控制台', 'Hammer 的到来挽救了眼前的船坞，新的机器仍会继续到达。', 0, -16), think('救援也会带来代价', '此刻的职责是保护剩下的人，而不是给刚才的选择寻找简单的胜负。')], ['morpheus', 'lock']),
  scene('m3_temple_defense', 3, 'zion_temple', 'zee', '神庙最后的门', 'siege', 'siege', '居民退入神庙。Zee 与 Link 重逢，留守者准备迎接最后一次冲击。', [walk('抵达居民集结处', 0, -30), use('检查最后的入口', '防线已无法再退。所有人等待着仍在另一条航线上的希望。', 0, -30)], ['link', 'hamann', 'kid']),
  scene('m3_defense', 3, 'machine_defense', 'trinity', '机器城的防线', 'last_sky', 'chase', 'Logos 接近机器城，浮动炸弹和密集机器封锁航路。', [use('沿 Neo 指引调整航线', 'Neo 感知并破坏部分来袭机器，过载却让他的身体越来越虚弱。', 0, -20, 6), walk('转向上方的云层', 0, -40)], ['neo']),
  scene('m3_sun', 3, 'above_clouds', 'trinity', '第一次看见太阳', 'last_sky', 'farewell', 'Logos 短暂穿出乌云。Trinity 看见蓝天与阳光，随后飞船失去动力。', [walk('靠近驾驶舷窗', 0, -20), use('望向云层之上的天空', '阳光只停留片刻。飞船再次坠入云层。', 0, -20, 8)], ['neo']),
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
  if (scene.id === 'm1_pod' && step.z === 12) position.y -= 18;
  return position;
}
export function filmEntry(scene: FilmScene): Vector3 {
  if (scene.id === 'm1_wake_up') return filmPosition(scene.set, 0, 1);
  if (scene.id === 'm1_wake_again') return filmPosition(scene.set, APARTMENT.bed.x, APARTMENT.bed.z);
  if (scene.id === 'm1_ledge') return filmPosition(scene.set, 0, OFFICE_WINDOW.z);
  if (scene.id === 'm1_pod') return filmPosition(scene.set, 0, -12);
  if (scene.id === 'm1_recovery') return filmPosition(scene.set, RECOVERY_BED.standingX, RECOVERY_BED.z);
  if (scene.id === 'm2_freeway') return filmPosition(scene.set, 14, 674);
  if (scene.id === 'm2_trucks') return filmPosition(scene.set, 14, 25);
  return filmPosition(scene.set, 0, scene.id === 'm1_lobby' ? 35 : FILM_SETS[scene.set].depth * .32);
}
