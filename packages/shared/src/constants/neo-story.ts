import type { Philosophy, NeoLifeState } from '../types/neo-life.js';
import { MISSIONS, NEO_ENCOUNTERS } from './sandbox.js';

export interface NeoChoice {
  id: string; label: string; response: string; effect?: Partial<Record<Philosophy, number>>;
}
export interface NeoChapter {
  id: string; film: 0 | 1 | 2 | 3; title: string; location: string; speaker: string;
  theme: string; text: string; objective: string; mission?: string; choices?: NeoChoice[];
}
// Original, interactive dialogue inspired by the trilogy; not a transcript.
export const NEO_CHAPTERS: NeoChapter[] = [
  { id: 'ordinary', film: 0, title: 'Thomas Anderson 的普通一天', location: 'neo_apartment', speaker: 'neo', theme: '什么使一天值得度过？',
    text: '闹钟、账单、工作，还有下班后的几个小时。现在你只是一个住在城市里的软件工程师。', objective: '吃早餐，去公司上班；晚上可以回家、散步或约朋友。留意生活里不合常理的小事。' },
  { id: 'contact', film: 1, title: '噪声中的一个名字', location: 'nightclub', speaker: 'trinity', theme: '怀疑需要别人许可吗？',
    text: '一个短发女人在音乐声中叫出了你的网名。她没有替那些异常给出答案，只说有人也在寻找同一个问题。她知道你从未告诉同事的事。', objective: '18:00 后去酒吧，与崔尼蒂见面。', choices: [
      { id: 'evidence', label: '先交换彼此的证据', response: '崔尼蒂给出一条可核对的日志时间。你同意明天接听电话，但还没有交出自己的判断。', effect: { agency: 1 } },
      { id: 'trust', label: '相信她，留下联系方式', response: '她收起纸条：明天照常上班，留意那通电话。信任成为你迈出的第一步。', effect: { trust: 1 } },
    ] },
  { id: 'office_call', film: 1, title: '办公室的电话', location: 'metacortex_office', speaker: 'morpheus', theme: '恐惧会替你决定吗？',
    text: '陌生的包裹里有一部手机。电话那头的人知道走廊里即将出现谁。窗外没有绿色代码，只有再普通不过的办公楼。你第一次怀疑“普通”本身。', objective: '回到公司，接听墨菲斯的电话。', choices: [
      { id: 'follow', label: '按他的提示避开检查', response: '你绕过走廊，保存了手机里的接头地点。今晚，答案可能不再隔着屏幕。', effect: { trust: 1 } },
      { id: 'verify', label: '先核实，再决定见面', response: '来人准确重复了电话里的细节。你记下证据，决定亲自见那个知道得太多的人。', effect: { agency: 1 } },
    ] },
  { id: 'pill', film: 1, title: '红色与蓝色', location: 'nightclub', speaker: 'morpheus', theme: '真实比舒适更重要吗？', text: '墨菲斯让你自己决定。你可以继续过日子，也可以追查到无法回头的地方。', objective: '靠近接头终端，决定是否继续追查。蓝色药丸会真的让生活继续。', mission: 'rabbit' },
  { id: 'construct', film: 1, title: '醒来的身体', location: 'nebuchadnezzar', speaker: 'morpheus', theme: '感官可以证明真实吗？',
    text: '你在飞船上睁开眼。肌肉虚弱，插口仍痛。墨菲斯解释了培养舱、被机器管理的人类，以及构造体里的感官信号。你熟悉的生活并未因此失去全部意义。', objective: '在飞船上听取解释，决定如何面对过去的生活。', choices: [
      { id: 'people', label: '那些关系和感受仍然真实', response: '你记得同事、朋友和一杯咖啡。墨菲斯同意：需要解放的是人，而不只是一组数字。', effect: { care: 2 } },
      { id: 'test', label: '先学习怎样验证这个新世界', response: '你要求训练和可重复的证据。接线员准备好构造体，能力必须从实践中学会。', effect: { agency: 2 } },
    ] },
  { id: 'training', film: 1, title: '身体与规则', location: 'training_dojo', speaker: 'morpheus', theme: '限制来自哪里？', text: '动作需要练习，即便知识可以下载。墨菲斯让你在对抗中理解身体、恐惧与规则的关系。', objective: '完成训练战斗。F 连击，X 闪避；此后解锁子弹时间。', mission: 'dojo' },
  { id: 'oracle_first', film: 1, title: '先知的厨房', location: 'oracles_apartment', speaker: 'oracle', theme: '预言会制造它所预言的结果吗？',
    text: '厨房里有饼干的香味。先知没有颁发“救世主”证书。她让你想一想：如果没有人告诉你应该是谁，你仍会冒险救另一个人吗？', objective: '进入先知的公寓，回答关于选择与责任的问题。', choices: [
      { id: 'rescue', label: '我会救他，因为他值得活着', response: '她把饼干递给你。日后营救墨菲斯时，同伴会因你的承诺提前准备医疗补给。', effect: { care: 2, trust: 1 } },
      { id: 'doubt', label: '我不让预言代替我的判断', response: '她点点头。你记下自己的疑问，准备在行动中判断；后续破解行动得到额外代码补给。', effect: { agency: 2 } },
    ] },
  { id: 'betrayal', film: 1, title: '熟悉的黑猫', location: 'subway_station', speaker: 'trinity', theme: '如果无知更幸福呢？',
    text: '同一只黑猫走过两次，出口已被改写。Cypher 用同伴换取遗忘，墨菲斯被捕。过去生活里的细小重复，如今变成生死攸关的证据。', objective: '和崔尼蒂拟定营救方案。', choices: [
      { id: 'together', label: '一起去，把同伴带回来', response: '你们准备进入大堂。崔尼蒂留下一条撤离线路；信任转化为额外医疗包。', effect: { care: 1, trust: 1 } },
      { id: 'plan', label: '先分析封锁，避免更多牺牲', response: '你发现守卫换班的规律。行动前多获得一个 EMP，代价是必须自己承担最后的决定。', effect: { agency: 1 } },
    ] },
  { id: 'rescue', film: 1, title: '大堂营救', location: 'lobby', speaker: 'trinity', theme: '选择先于身份', text: '你还不知道自己是不是救世主，但已经选择去救墨菲斯。', objective: '穿过大堂封锁，击退特工并营救墨菲斯。', mission: 'lobby_rescue' },
  { id: 'subway', film: 1, title: '站台上的抉择', location: 'subway_station', speaker: 'smith', theme: '人可以超出自己的定义吗？', text: '同伴已经撤出。Smith 拦住出口，称呼你为 Anderson 先生。你转身面对他。', objective: '击退站台上的 Smith，守住出口。', mission: 'subway_duel' },
  { id: 'the_one', film: 1, title: '重新看见世界', location: 'neo_apartment', speaker: 'trinity', theme: '名字、信念与行动',
    text: '濒死的连接里，崔尼蒂的声音把你拉了回来。城市仍有墙、门和人，但你开始看见它们背后的规则。救世主不再只是别人给你的称谓。', objective: '确认自己的道路，解锁代码震荡，进入第二部。', choices: [
      { id: 'freedom', label: '让人有机会自己选择', response: '你拨通电话，宣告一条新的可能。下一次回到矩阵时，保护普通人会是你的责任。', effect: { agency: 1, care: 1 } },
      { id: 'connection', label: '先守护把我带回来的人', response: '你回到同伴身边。力量不再意味着独自承担一切，信任会在之后的战斗中提供补给。', effect: { trust: 2 } },
    ] },
  { id: 'zion', film: 2, title: '锡安也有日常', location: 'zion_command', speaker: 'morpheus', theme: '希望与责任',
    text: '锡安有祈祷，也有维修、舞会和等待归来的人。机器正在逼近。议员问你：人依赖机器生存，与机器依赖人有什么不同？', objective: '讨论锡安的准备，决定优先支援什么。', choices: [
      { id: 'defense', label: '先把资源送给防守者', response: '锡安防御增加；船员把两枚 EMP 装入你的行囊。', effect: { care: 1 } },
      { id: 'source', label: '寻找停战的根本办法', response: '接线员把资源投入信号追踪，你获得破解所需的解码器。', effect: { agency: 1 } },
    ] },
  { id: 'oracle_second', film: 2, title: '先知也是程序', location: 'oracles_apartment', speaker: 'oracle', theme: '一个程序能够值得信任吗？',
    text: '先知承认自己也是矩阵的一部分。她谈起选择、理解选择，以及负责打开门的钥匙匠。她的来源并不能替你决定是否相信她。', objective: '再次拜访先知，讨论人格与信任。', choices: [
      { id: 'deeds', label: '我根据你的行动判断你', response: '先知告诉你如何寻找钥匙匠；她也提醒你，Smith 正在变成系统无法控制的东西。', effect: { trust: 1, care: 1 } },
      { id: 'inspect', label: '我会帮助你，也会核对你的目的', response: '你保留疑问，得到路线与解码器。合作不要求放弃判断。', effect: { agency: 2 } },
    ] },
  { id: 'copies', film: 2, title: '越来越多的 Smith', location: 'central_park', speaker: 'smith', theme: '失去目的之后还剩什么？', text: 'Smith 不再服从原来的命令。他把其他人变成自己，把自由理解为无限复制。', objective: '击退复制体，保护先知留下的线索。', mission: 'burly_brawl' },
  { id: 'keymaker', film: 2, title: '因果与钥匙', location: 'merovingians_restaurant', speaker: 'merovingian', theme: '知道原因等于拥有控制吗？', text: '梅罗文加坚持一切都由因果支配。钥匙匠被当作工具囚禁，你选择把他当作一个同伴带走。', objective: '破解餐厅节点，找到钥匙匠。', mission: 'keymaker' },
  { id: 'freeway', film: 2, title: '通向源头的路', location: 'freeway', speaker: 'morpheus', theme: '合作打开孤身无法打开的门', text: '钥匙匠知道门在哪里，却需要你们护送他活着抵达。', objective: '护送钥匙匠穿过高速路，击退追兵。', mission: 'freeway' },
  { id: 'architect', film: 2, title: '建筑师与第六次选择', location: 'architects_chamber', speaker: 'architect', theme: '被预测的选择仍然自由吗？', text: '建筑师解释了异常、控制和一次次重载。你曾相信自己终结了系统，却发现自己的出现也在它的计算之内。崔尼蒂仍在危险中。', objective: '面对系统稳定与具体生命之间的冲突，作出自己的选择。', mission: 'architect' },
  { id: 'trinity_choice', film: 2, title: '无法化约的一个人', location: 'rooftop_A', speaker: 'trinity', theme: '爱与普遍责任是否冲突？',
    text: '建筑师给出的两个选项并未穷尽现实。你救下崔尼蒂，机器的威胁仍然存在。决定有代价，也仍有后续行动的空间。', objective: '与崔尼蒂面对选择的代价。', choices: [
      { id: 'both', label: '救一个人，也继续为所有人寻找出路', response: '你们离开矩阵。拦截哨兵时，你的意识触到了陌生的连接，随后陷入昏迷。', effect: { care: 2 } },
      { id: 'refuse', label: '追查是谁限定了这两个选项', response: '你开始怀疑系统对“必然”的定义。现实中的哨兵停下，你的意识却落入了连接之间。', effect: { agency: 2 } },
    ] },
  { id: 'mobil', film: 3, title: '连接之间', location: 'mobil_ave', speaker: 'neo', theme: '没有出口的站台', text: '你醒在 Mobil Ave。它既不在矩阵里，也不属于熟悉的真实世界。', objective: '解析车站循环，找到通往外部的信号。', mission: 'mobil' },
  { id: 'sati', film: 3, title: '没有用途的孩子', location: 'mobil_ave', speaker: 'sati', theme: '生命必须有用途才值得存在吗？',
    text: 'Sati 的父母也是程序。他们为女儿寻找生存的地方，并不因为她有系统认可的用途，而是因为他们爱她。崔尼蒂正在另一边争取把你带回来。', objective: '与 Sati 的家人交谈，重新理解程序。', choices: [
      { id: 'person', label: '她不需要证明自己有用', response: '你承认程序也可能有值得保护的关系。这个判断将在机器城的谈判中被记住。', effect: { care: 2, trust: 1 } },
      { id: 'question', label: '系统为什么必须给每个人规定用途？', response: '你把问题指向了制定规则的人。车站的门终于打开，同伴带你回去。', effect: { agency: 2 } },
    ] },
  { id: 'oracle_last', film: 3, title: '先知不知道的未来', location: 'oracles_apartment', speaker: 'oracle', theme: '没有保证，还愿意行动吗？',
    text: '先知无法替你看见所有选择之后的结果。Smith 已威胁到人类和机器。她把希望交给你，也承认这是一次没有保证的冒险。', objective: '接受不确定性，决定最后一段路的信念。', choices: [
      { id: 'hope', label: '没有保证，也值得尝试共存', response: '先知提供最后的资源。你会带着合作的可能性走向机器城。', effect: { trust: 2, care: 1 } },
      { id: 'responsibility', label: '结果未知，责任依然是我的', response: '你把不可预测当作行动的空间，而不把它当作逃避责任的借口。', effect: { agency: 2 } },
    ] },
  { id: 'siege', film: 3, title: '锡安的防线', location: 'zion_dock', speaker: 'morpheus', theme: '每个普通人都在承担代价', text: '哨兵涌入船坞。留守者为争取谈判的时间守住最后防线。', objective: '支援锡安船坞，击退哨兵。', mission: 'zion_siege' },
  { id: 'bane', film: 3, title: '真实世界的感染', location: 'nebuchadnezzar', speaker: 'smith', theme: '边界并不像想象中牢固', text: 'Smith 借 Bane 的身体抵达真实世界。伤痛证明你的肉身仍然脆弱，反抗必须付出真实的代价。', objective: '在飞船上击退 Bane。真实世界无法使用矩阵超能力。', mission: 'bane_encounter' },
  { id: 'last_sky', film: 3, title: '云层之上的天空', location: 'machine_city', speaker: 'trinity', theme: '有限的生命如何留下意义？',
    text: '飞船短暂穿出乌云，你们第一次看见真实的阳光。坠落之后，崔尼蒂身受重伤。她把最后一段路交给你，你记住的不是一个程序中的指标。', objective: '与崔尼蒂告别，独自面对机器城。', choices: [
      { id: 'remember', label: '记住她，让这段关系继续影响行动', response: '你带着失去继续向前，决定争取一个不再重复牺牲的明天。', effect: { care: 2 } },
      { id: 'promise', label: '把未完成的承诺带到谈判桌上', response: '承诺无法抹去伤痛，却能指引接下来的一步。机器的核心在面前亮起。', effect: { trust: 1, agency: 1 } },
    ] },
  { id: 'pact', film: 3, title: '共同的威胁', location: 'machine_city', speaker: 'deus_ex_machina', theme: '敌人能否成为对话者？', text: '你向机器核心指出 Smith 已超出双方控制。机器可以把你接回矩阵，你则提出结束战争的可能。', objective: '与机器核心建立临时协议。', mission: 'machine_pact' },
  { id: 'final', film: 3, title: '雨中的最后一战', location: 'times_square', speaker: 'smith', theme: '胜利一定是压倒对方吗？', text: '此刻才是漫天暴雨。整个街区都是 Smith，先知也已被他同化。你必须走到这场冲突的尽头。', objective: '击败 Smith 核心与复制体，然后在终端确认最后的行动。', mission: 'smith_final' },
  { id: 'source', film: 3, title: '与矩阵本体对话 · 游戏延伸', location: 'machine_city', speaker: 'deus_ex_machina', theme: '相互依赖是否排除自由？',
    text: '你允许连接抵达 Smith 的内部，机器清除了失控的复制。矩阵本体问：若人类与机器依然彼此依赖，新的和平应当以什么为基础？战斗的结果不能代替这个回答。', objective: '回到机器核心，讨论和平的基础。', choices: [
      { id: 'consent', label: '依赖可以存在，留下必须出于知情选择', response: '核心同意继续讨论退出机制，但要求你说明怎样保护选择留下的人与程序。', effect: { agency: 2, care: 1 } },
      { id: 'reciprocity', label: '承认彼此的生存，建立互相约束的协议', response: '核心承认消灭对方并不能解决依赖。它等待你提出可持续的规则。', effect: { trust: 2, care: 1 } },
    ] },
  { id: 'terms', film: 3, title: '谁有权选择醒来 · 游戏延伸', location: 'machine_city', speaker: 'deus_ex_machina', theme: '自由不是替所有人作同一个选择',
    text: '机器核心把规则交到你面前。你要面对工作过的城市、尚在其中的朋友，以及那些拥有关系与愿望的程序。你之前对先知、Sati 和同伴的回答，也成为这次谈判的一部分。', objective: '确认完整协议。此处决定本轮结局。', choices: [
      { id: 'peace', label: '停战；让知情的人自由选择留下或离开', response: '机器撤出锡安。退出权和程序的生存边界被写入协议，和平需要双方继续维护。', effect: { care: 1, trust: 1 } },
      { id: 'reboot', label: '分阶段重载，以稳定换取受监督的开放', response: '系统重载并保留退出试点。秩序较稳，但尚未获得退出机会的人仍在等待。', effect: { trust: 1 } },
      { id: 'liberation', label: '公开真相，同时保护居民与程序的选择权', response: '真相被公开。前面累积的自主与关怀，让你提出了逐步迁移、禁止强制拔出的规则。', effect: { agency: 1, care: 1 } },
    ] },
  { id: 'dawn', film: 3, title: '一座城市的清晨', location: 'central_park', speaker: 'oracle', theme: '下一轮，你会怎样生活？',
    text: 'Sati 为城市带来新的晨光。先知没有宣告从此再无问题：协议需要实践，自由需要理解。完整的一轮已经结束，而普通人的明天仍值得认真度过。', objective: '查看本轮选择，然后带着记忆进入下一轮生活。', choices: [
      { id: 'remember', label: '带着这些记忆，开始下一轮', response: '闹钟重新响起。你仍是 Thomas Anderson，但这一轮的选择留下了微弱的回声。' },
    ] },
];

export const NEO_MISSIONS = [...MISSIONS, ...NEO_ENCOUNTERS];
export const NEO_CAST = ['neo', 'trinity', 'morpheus', 'oracle', 'architect', 'deus_ex_machina', 'smith', 'sati', 'seraph', 'keymaker', 'merovingian'];
export const PHILOSOPHY_NAMES: Record<Philosophy, string> = { agency: '自主判断', care: '关怀生命', trust: '相互信任' };
export const NEO_ANOMALIES = [
  { id: 'clock', title: '慢了三秒的时钟', places: ['metacortex_office', 'neo_apartment'], text: '墙上的秒针连续走过同一个位置，电脑时间却没有回退。可能只是你太累，也可能值得记下来。', inspect: '你把两只时钟放在一起。下一次回退时，桌面程序的日志也少了一行。' },
  { id: 'receipt', title: '明天的小票', places: ['times_square', 'corner_cafe'], text: '收据印着明天的日期，商品编号恰好是你的工号。收银员坚持机器从没出过错。', inspect: '另一位顾客的收据正常。你保留了自己的那一张，异常并非整台打印机的日期错误。' },
  { id: 'echo', title: '重复的一句话', places: ['metacortex_office', 'nightclub', 'corner_cafe'], text: '两位互不相识的人，用完全相同的语气说完了同一句话，连停顿都一样。', inspect: '你换了一种提问方式，对方短暂沉默，随后仍给出相同的回答。' },
  { id: 'cat', title: '又一只黑猫', places: ['central_park', 'subway_station', 'neo_apartment'], text: '黑猫消失在墙角，几秒后又从原处走过。脚边的落叶似乎也回到了原来的位置。', inspect: '你拍下墙角，注意到门框的位置发生了细微改变。重复的不只是一只猫。' },
  { id: 'screen', title: '没有发件人的字', places: ['neo_apartment', 'metacortex_office'], text: '显示器里有一行字短暂出现在窗口背后。切换回来时，任务管理器没有对应进程。', inspect: '断开网络后，字仍出现了一次。你保存的截图里有一串通向本地日志的编号。' },
  { id: 'reflection', title: '晚了一拍的倒影', places: ['nightclub', 'corner_cafe', 'times_square'], text: '玻璃中的自己似乎晚了一拍才转头。外面的车流很正常，倒影也很快恢复正常。', inspect: '你缓慢抬手，玻璃边缘出现一次断裂。旁边的人只看见自己，不明白你在做什么。' },
  { id: 'commute', title: '一样的乘客', places: ['subway_station', 'downtown', 'central_park', 'times_square'], text: '街上三位行人的步伐像是同一段动作。你停下时，他们同时看向了你。', inspect: '你改走另一条街，其中一人竟已经等在前面，继续读同一页报纸。' },
];
export function neoSkillUnlocked(life: NeoLifeState | undefined, slot: number): boolean {
  const filmTraining = slot === 0 && Boolean(life?.journey?.dojo?.complete || life?.journey?.completed.includes('m1_dojo'));
  return !life || filmTraining || life.chapter > NEO_CHAPTERS.findIndex(c => c.id === (slot ? 'the_one' : 'training'));
}
