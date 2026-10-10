import { maggieDiscoveryActive, maggieDiscoveryText } from '@auto_matrix/shared';
import { catchLaunchReady, catchDistance } from '@auto_matrix/shared';
import { filmSceneForJourney } from '@auto_matrix/shared';
import { oracleRequestActive, oracleRequestLocked, oracleRequestText } from '@auto_matrix/shared';
import { oracleLastActive, oracleLastLocked, oracleLastText } from '@auto_matrix/shared';
import { baneInquiryActive, baneInquiryText } from '@auto_matrix/shared';
import { hammerBriefingActive, hammerBriefingText } from '@auto_matrix/shared';
import { ZION_DEPLOYMENT, zionDeploymentActive, zionDeploymentText } from '@auto_matrix/shared';
import { trainmanChaseActive, trainmanChaseCanAct, trainmanChaseLocked, trainmanChaseText } from '@auto_matrix/shared';
import { helGarageActive, helGarageText } from '@auto_matrix/shared';
import { SOURCE_BRIEFING, sourceBriefingActive, sourceBriefingLocked, sourceBriefingText } from '@auto_matrix/shared';
import { PRIMARY_DEMOLITION, primaryActive, primaryLocked, primaryText } from '@auto_matrix/shared';
import { upperDiggerActive, upperDiggerText } from '@auto_matrix/shared';
import { dockBriefingActive, dockBriefingLocked, dockBriefingText } from '@auto_matrix/shared';
import { templeDefenseActive, templeDefenseLocked, templeDefenseText } from '@auto_matrix/shared';
import { DOCK_EVACUATION, dockEvacuationActive, dockEvacuationText, shaftSealActive, shaftSealText } from '@auto_matrix/shared';
import { diggersActive, diggersText } from '@auto_matrix/shared';
import { crosscutActive, crosscutAction, crosscutText } from '@auto_matrix/shared';
import { DOCK_RELOAD, dockReloadActive, dockReloadText } from '@auto_matrix/shared';
import { DOCK_GATE, dockGateActive, dockGateText } from '@auto_matrix/shared';
import { DOCK_LAST_STAND, dockLastStandActive, dockLastStandText } from '@auto_matrix/shared';
import { nearMetacortexLift, filmStepNear, awakeningDuration } from '@auto_matrix/shared';
import { CATCH, RELOADED_FINALE, HEL_COATCHECK, OPENING_ESCAPE, OPENING_HOTEL, catchText, reloadedText } from '@auto_matrix/shared';
import { FILM_SCENES, FILM_SCENE_BY_ID, FILM_SETS, FILM_NAMES, ARCHITECT_DOOR_SECONDS, ARCHITECT_ROOM, filmReflections, CHARACTERS, filmStepPosition, distance, dockPowerOffline, oracleActing, helElevatorLocked, helDanceDoorLocked, interrogationLocked, pillLocked, lafayetteWelcomeLocked, phoneLocked, windowOpening, windowCrossing, awakeningWaiting, trainingLocked, trainingWaiting, theOneLocked, type AgentState, type SandboxState } from '@auto_matrix/shared';
import './film-journey.css';
import { ambushEscapeText } from '@auto_matrix/shared';
import { BASEMENT, TV_EXIT, TV_EXIT_ROLES, basementRouteLength, basementText, tvExitText } from '@auto_matrix/shared';
import { WETWALL, wetwallText, wetwallEntry, sixthText } from '@auto_matrix/shared';
import { oracleAbsorptionActive, oracleAbsorptionLocked, oracleAbsorptionText } from '@auto_matrix/shared';
import { meetingBoardPoint, meetingLocked, MEETING_TIMING } from '@auto_matrix/shared';
import { filmPosition, HOTEL_DOOR_PROGRESS, CABIN, CABIN_ROUTE_LENGTH } from '@auto_matrix/shared';
import { workdayLocked } from '@auto_matrix/shared';
import { apartmentLocked } from '@auto_matrix/shared';
import { wakeCallLocked, morningLocked } from '@auto_matrix/shared';
import { clubLocked } from '@auto_matrix/shared';
import { sentinelDanger, sentinelLocked } from '@auto_matrix/shared';
import { interludeDuration, interludeLocked } from '@auto_matrix/shared';
import { ORACLE_RECEPTION, oracleReceptionText, spoonLessonText, oracleVisitDuration, oracleVisitLocked, oracleDepartureTarget, oracleDepartureText } from '@auto_matrix/shared';
import { ORACLE_ENTRANCE, oracleArrivalPending, oracleArrivalText } from '@auto_matrix/shared';
import { BETRAYAL, betrayalDuration, betrayalLocked } from '@auto_matrix/shared';
import { RESCUE, rescueDuration, rescueLoadout, rescueLocked } from '@auto_matrix/shared';
import { BANE_ENCOUNTER } from '@auto_matrix/shared';
import { FAREWELL, farewellLocked } from '@auto_matrix/shared';
import { DEUS_PACT, deusPactDialogue, deusPactLocked } from '@auto_matrix/shared';
import { SMITH_FINALE, smithFinaleLocked, smithFinaleDialogue, smithOracleRestored } from '@auto_matrix/shared';
import { trilogyEpilogueLocked, trilogyEpilogueProgress } from '@auto_matrix/shared';
import { truckWeaponsText, truckHoodText } from '@auto_matrix/shared';
import { MOBIL_FAMILY_QUESTIONS, MOBIL_LUGGAGE, mobilFamilyText, mobilLuggageText, mobilReunionRoot, mobilReunionText } from '@auto_matrix/shared';

const button = (target: string, label: string, disabled = false) => `<button data-action="life" data-target="film:${target}" ${disabled ? 'disabled' : ''}>${label}</button>`;
export function renderFilmJourney(player: AgentState, sandbox: SandboxState): string {
  const life = sandbox.neoLife!; const journey = life.journey!; const scene = filmSceneForJourney(journey)!;
  if (helGarageActive(journey)) {
    const state = journey.helGarage, phase = state?.phase ?? 'ready';
    const close = filmStepNear(scene, scene.steps[Math.min(journey.step, 1)], player.position, player.isInMatrix, journey);
    const action = player.id !== journey.actor ? button('resume', '接回 Trinity 的视角')
      : state?.paused || state?.unavailable ? '<p>当前进度保留，等同行者可以继续行动。</p>'
        : journey.step >= scene.steps.length ? button('next', '乘电梯，前往衣帽间 →')
          : phase === 'failed' ? button('retry', '重试当前入口交战')
            : phase === 'ready' ? button('act', '回应入口守卫 · G', !close)
              : phase === 'cleared' ? button('act', '推开钢门 · G', !close)
                : ['evade', 'counter', 'combo'].includes(phase) ? '<p>合上手记，按 X 闪避、F 缴械和反击。</p>'
                  : phase === 'exit' ? '<p>WASD 亲自跨过门槛，走进铁笼电梯。</p>' : '<p>鼠标观察 · V 切换视角 · 等当前动作完成</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Club Hel · 地下车库入口</h3><p>Trinity 视角 · Seraph 与 Morpheus 同行</p></header><article class="film-now"><div><p>${helGarageText(state)}</p><div class="film-controls">${action}</div><small>WASD 移动 · X 避开枪口 · F 缴械与反击 · G 开门 · V 切换视角</small></div></article></div>`;
  }
  if (trainmanChaseActive(journey)) {
    const state = journey.helChase?.performance, close = trainmanChaseCanAct(state, player.position, FILM_SETS[scene.set].center);
    const action = player.id !== journey.actor ? button('resume', '接回 Seraph 的追逐视角')
      : journey.step >= scene.steps.length ? button('next', '接回 Trinity，前往 Hel →')
        : state?.phase === 'failed' ? button('retry', '重试当前追逐')
          : trainmanChaseLocked(state) ? '<p>鼠标观察 · V 切换视角 · 等候当前动作完成</p>'
            : !state || state.phase === 'ready' ? button('act', '请 Trainman 帮忙 · G', !close)
              : state.phase === 'escaped' ? button('act', '与同行者商量 · G', !close)
                : state.phase === 'running' && !state.passedGate && state.routeStage >= 2 ? button('act', '翻越闸机 · G', !close)
                  : '<p>合上手记，跟上 Trainman；利用钢柱和 X 闪避枪击。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Stellma · 逃走的列车管理员</h3><p>Seraph 视角 · Trinity 与 Morpheus 同行</p></header><article class="film-now"><div><p>${trainmanChaseText(state)}</p><div class="film-controls">${action}</div><small>WASD 移动 · Shift 奔跑 · G 翻越闸机 · X 避弹 · V 切换视角</small></div></article></div>`;
  }
  if (scene.id === 'm3_mobil_release' && !journey.visiting && journey.mobil) {
    const reunion = journey.mobil.reunion, partner = reunion && mobilReunionRoot(reunion, 'trinity'), center = FILM_SETS[scene.set].center;
    const close = partner && Math.hypot(player.position.x - center.x - partner.x, player.position.z - center.z - partner.z) <= 2.8;
    const action = player.id !== journey.actor ? button('resume', '接回 Neo 的视角')
      : journey.step >= scene.steps.length ? button('next', '返回矩阵，去见先知 →')
        : journey.step === 1 && reunion?.phase === 'ready' ? button('act', '接住 Trinity 的拥抱 · G', !close)
          : reunion?.phase === 'together' ? button('act', '与 Trinity 离站 · G', !close)
            : '<p>鼠标环顾 · V 切换视角 · 等候同行者</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Mobil Ave · 终于重逢</h3><p>Neo 视角 · 回到她身边</p></header><article class="film-now"><div><p>${mobilReunionText(journey.mobil, journey.step)}</p><div class="film-controls">${action}</div></div></article></div>`;
  }
  if (scene.id === 'm3_trainman' && !journey.visiting && journey.step <= 2 && journey.mobil) {
    const state = journey.mobil, step = scene.steps[journey.step], close = filmStepNear(scene, step, player.position, player.isInMatrix, journey);
    const center = FILM_SETS[scene.set].center, gap = Math.hypot(player.position.x - center.x - MOBIL_LUGGAGE.x, player.position.z - center.z - MOBIL_LUGGAGE.z);
    const action = player.id !== journey.actor ? button('resume', '接回 Neo 的视角')
      : state.phase !== 'stopped' || state.elapsed < .65 || state.luggage?.phase === 'lifting' ? '<p>鼠标观察 · V 切换视角 · 暂停保留当前动作</p>'
        : journey.step === 0 ? button('act', '握住提手，提起箱子', !close || gap > 1.45 || gap < .72)
          : journey.step === 1 ? '<p>WASD 提着行李走到车门，鼠标观察，V 切换视角。</p>' : button('act', '尝试跟随家人登车', !close);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Mobil Ave · 迟到的列车</h3><p>Neo 视角 · 一家人的行李与出路</p></header><article class="film-now"><div><p>${mobilLuggageText(state, journey.step)}</p><div class="film-controls">${action}</div></div></article></div>`;
  }
  if (scene.id === 'm3_family' && !journey.visiting) {
    const family = journey.mobil?.family, close = filmStepNear(scene, scene.steps[1], player.position, player.isInMatrix, journey);
    const action = player.id !== journey.actor ? button('resume', '接回 Neo 的视角')
      : journey.step >= scene.steps.length ? button('next', '继续等候列车 →')
        : journey.step === 0 ? '<p>先走到长椅旁，与这一家见面。</p>'
          : family?.paused || family?.unavailable ? '<p>谈话进度已保留，等待家人的信号。</p>'
            : family?.phase === 'hearing' ? '<p>合上手记，听当前回答；鼠标环顾，V 切换视角。</p>'
              : family?.phase === 'reflection' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('')
                : MOBIL_FAMILY_QUESTIONS.map(question => button(`family:ask:${question.id}`,
                  `${family?.answered.includes(question.id) ? '✓ ' : ''}${question.label}`, !close || Boolean(family?.answered.includes(question.id)))).join('');
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Mobil Ave · 一家人的离别</h3><p>Neo 视角 · 身份、用途与爱</p></header><article class="film-now"><div><p>${mobilFamilyText(family)}</p><div class="film-controls">${action}</div><small>可以主动选择问题；暂停、断线与读档保留已听过的问题和回答进度。</small></div></article></div>`;
  }
  if (primaryActive(journey)) {
    const state = journey.primaryDemolition, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Niobe 的行动视角') : state?.paused || state?.unavailable ? '<p>等待同行者信号，装置和撤离时钟已保留。</p>'
      : state?.phase === 'failed' || player.status !== 'alive' ? button('retry', '重试当前撤离检查点')
        : state?.phase === 'done' ? button('next', '接回 Trinity，核对 Vigilant 的信号 →')
          : primaryLocked(state) ? '<p>合上手记，按住 G 固定装置；松手保留进度。</p>'
            : button('act', state?.phase === 'sync' ? '绿色窗口校准 · G' : state?.phase === 'retreat' ? '确认两人安全撤出 · G' : '安装当前同步装置 · G', !close);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>Niobe · 主电网同步行动</h3><p>发电厂 · Logos 队伍</p></header><article class="film-now"><div><p>${primaryText(state)}</p><ol class="film-objectives">${PRIMARY_DEMOLITION.sites.map(site => `<li class="${state?.installed.includes(site.id) ? 'done' : ''}"><b>${state?.installed.includes(site.id) ? '✓' : '○'}</b><span>${site.name}</span></li>`).join('')}</ol><div class="film-controls">${action}</div><small>WASD 移动 · Shift 奔跑 · G 操作 · V 切换视角。换班同步和先撤离的顺序来自电影，三个安装点、观察桥路线与失败重试为游戏改编。</small></div></article></div>`;
  }
  if (maggieDiscoveryActive(journey)) {
    const state = journey.maggieDiscovery, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Roland 的调查视角')
      : state?.paused || state?.unavailable ? '<p>等待船员信号，调查与事件进度已保留。</p>'
        : player.status !== 'alive' || player.health <= 0 ? button('retry', '接回调查检查点')
          : state?.phase === 'done' ? button('next', '转到 Logos 上 Neo 的视角 →')
            : state?.phase === 'reflection' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
              : state && ['call', 'ready', 'empty', 'report', 'return'].includes(state.phase) ? button('act', state.phase === 'call' ? '接听 AK 的紧急报告 · G'
                : state.phase === 'ready' ? '确认 Maggie，覆上床单 · G' : state.phase === 'empty' ? '核对 Bane 的空床 · G'
                  : state.phase === 'report' ? '听取 Colt 的全船搜查报告 · G' : '听完 Link 的返航请求与 EMP 风险 · G', !close)
                : state?.phase === 'approach' || state?.phase === 'leaving' || !state ? '<p>合上手记，WASD 亲自走到目标。</p>'
                  : '<p>合上手记，观察床边与船员的当前动作；V 切换视角，鼠标环顾。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Hammer · 空出的医疗舱</h3><p>Roland 的另一视角 · 援救、风险与责任</p></header><article class="film-now"><div><h3>${step?.label ?? '调查已经保存'}</h3><p>${maggieDiscoveryText(state)}</p><p>确认遗体 ${state?.evidence.includes('maggie') ? '✓' : '○'} · 核对空床 ${state?.evidence.includes('berth') ? '✓' : '○'} · 全船搜查 ${state?.evidence.includes('ship') ? '✓' : '○'}</p><div class="film-controls">${action}</div><small>G 接听与调查 · J 记录判断 · WASD 离场 · V 切换视角。床边核对与哲学判断为游戏改编；另一个 EMP 的风险来自原片。Maggie 的死亡会保存，Neo 尚未收到这里的报告。</small></div></article></div>`;
  }
  if (zionDeploymentActive(journey)) {
    const state = journey.zionDeployment, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Lock 的议会视角')
      : state?.paused || state?.unavailable ? '<p>等待议员信号，部署与问答进度已保留。</p>'
        : player.status !== 'alive' || player.health <= 0 ? button('retry', '接回议会检查点')
          : state?.phase === 'done' ? button('next', '转到 Hammer 航行中的另一视角 →')
            : state?.phase === 'reflection' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
              : state?.phase === 'allocating' ? ZION_DEPLOYMENT.allocations.map(item => `<p>${item.label}</p>` + (state.confirmed.includes(item.id)
                ? `<p>✓ ${item.answer}</p>` : button(`allocation:${item.id}:${item.correct}`, item.answer) + button(`allocation:${item.id}:incorrect`, item.wrong))).join('')
                : state && ['ready', 'question', 'review', 'hope'].includes(state.phase) ? button('act', state.phase === 'ready' ? '报告船坞防守方案 · G'
                  : state.phase === 'question' ? '主动回应兵力与居民动员质询 · G' : state.phase === 'review' ? '打开部署图核对 · G' : '回应 Hamann 的消息询问 · G', !close)
                  : state?.phase === 'approach' || state?.phase === 'leaving' || !state ? '<p>合上手记，WASD 亲自走到目标。</p>'
                    : '<p>合上手记，观察议会的当前回应；V 切换视角，鼠标环顾。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>锡安议会 · 船坞防守部署</h3><p>Lock 的另一视角 · 计划、希望与动员</p></header><article class="film-now"><div><h3>${step?.label ?? '部署决定已保存'}</h3><p>${zionDeploymentText(state)}</p><div class="film-controls">${action}</div><small>船坞尚未失守，神庙入口是备用防线。G 主动报告与回应 · J 核对部署和记录判断 · WASD 离场。部署图核对和哲学回应是游戏改编；议会不预知 Hammer 的分航安排。</small></div></article></div>`;
  }
  if (hammerBriefingActive(journey)) {
    const state = journey.hammerBriefing, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Neo 的会议视角')
      : state?.paused || state?.unavailable ? '<p>等待参与者信号，提议与借船安排已保留。</p>'
        : player.status !== 'alive' || player.health <= 0 ? button('retry', '接回分航会议检查点')
          : state?.phase === 'done' ? button('next', '查看锡安的最后防守部署 →')
            : state?.phase === 'reflection' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
              : state?.phase === 'confirmation' ? `<p>Hammer · Niobe 与船员 · 返回防守。Logos · Neo 与 Trinity · 不带弹药。</p>`
                + (!state.confirmed.includes('hammer') ? button('route:hammer:zion', 'Hammer → 锡安') + button('route:hammer:machine_city', 'Hammer → 机器城') : '<p>✓ Hammer → 锡安</p>')
                + (!state.confirmed.includes('logos') ? button('route:logos:machine_city', 'Logos → 机器城') + button('route:logos:zion', 'Logos → 锡安') : '<p>✓ Logos → 机器城</p>')
                : state && ['ready', 'objection', 'route', 'faith'].includes(state.phase) ? button('act', state.phase === 'ready' ? '提出赴机器城的请求 · G'
                  : state.phase === 'objection' ? '坚持说明自己的选择 · G' : state.phase === 'route' ? '核对两船航线 · G' : '听 Niobe 对信任的解释 · G', !close)
                  : state?.phase === 'approach' || state?.phase === 'leaving' || !state ? '<p>合上手记，WASD 亲自走到目标。</p>'
                    : '<p>合上手记，观察当前回应；鼠标环顾，V 切换视角。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Hammer · 两船分航会议</h3><p>Neo 视角 · 选择与信任</p></header><article class="film-now"><div><h3>${step?.label ?? '分航决定已保存'}</h3><p>${hammerBriefingText(state)}</p><div class="film-controls">${action}</div><small>G 主动提议与回应 · J 确认航线、记录判断 · WASD 离开 · V 切换视角。借船顺序与两船安排来自电影；航路终端核对是游戏改编。保存伤势、物品、动作与判断。</small></div></article></div>`;
  }
  if (baneInquiryActive(journey)) {
    const state = journey.baneInquiry, step = scene.steps[journey.step];
    const action = player.id !== journey.actor ? button('resume', '接回 Roland 的询问视角')
      : state?.paused || state?.unavailable ? '<p>当前问话与检查结果保留，等待参与者。</p>'
        : player.status !== 'alive' ? button('retry', '接回当前询问检查点')
          : state?.phase === 'done' ? button('next', '接回 Neo，参加航路讨论 →')
            : state?.phase === 'reflection' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
              : state?.phase === 'reviewing' ? (state.page === 'vdt'
                ? button('review:negative', 'VDT 阴性') + button('review:positive', 'VDT 阳性')
                : button('review:abnormal', '神经活动异常') + button('review:normal', '神经活动正常')) + button('act', '翻到另一页 · G')
                : state?.phase === 'ready' ? button('act', journey.step === 1 ? '坐下，询问记忆和割伤 · G' : journey.step === 2 ? '追问提前释放的 EMP · G' : '请 Maggie 说明检查结果 · G')
                  : state?.phase === 'approach' || state?.phase === 'leaving' || !state ? '<p>合上手记，WASD 亲自走到目标。</p>'
                    : '<p>合上手记，观察当前回答和动作；V 切换视角。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Hammer 餐厅 · 幸存者的说法</h3><p>Roland 的另一视角 · Neo 尚不在场</p></header><article class="film-now"><div><h3>${step?.label ?? '询问结束'}</h3><p>${baneInquiryText(state, journey.step)}</p>${state?.phase === 'reviewing' ? `<p>已核对 ${state.reviewed.length} / 2 页 · 判断与数据不符 ${state.mistakes} 次</p>` : ''}<div class="film-controls">${action}</div><small>G 主动问话与翻页 · J 核对检查单、记录判断 · V 切换视角。问话顺序与疑点取自电影；两页检查单与核对操作为游戏改编。保存动作、伤势、物品和判断。</small></div></article></div>`;
  }
  if (oracleAbsorptionActive(journey)) {
    const state = journey.oracleAbsorption, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回先知的另一视角')
      : state?.phase === 'done' ? button('next', '返回 Hammer，听幸存者的说法 →')
        : state?.paused || state?.unavailable ? '<p>保留当前动作，等待参与者信号。</p>'
          : player.status !== 'alive' ? button('retry', '接回先知的当前检查点')
            : state?.phase === 'reflection' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('')
              : oracleAbsorptionLocked(state) ? '<p>合上手记，观察当前动作；同化前按住 G 作出决定。V 切换视角。</p>'
                : button('act', journey.step === 0 ? '请 Sati 带饼干离开 · G' : journey.step === 1 ? '确认两人开始撤离 · G' : '留在厨房面对 Smith · G', !close);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>先知厨房 · 等待 Smith</h3><p>先知的另一视角 · Neo 此时不在这里</p></header><article class="film-now"><div><p>${oracleAbsorptionText(state)}</p><div class="film-controls">${action}</div><small>G 主动送别与面对来客 · J 记录自己的判断 · 同化前按住 G · V 切换视角。保存动作、物品与选择，另一视角记录不会成为 Neo 的已知经历。</small></div></article></div>`;
  }
  if (oracleLastActive(journey)) {
    const state = journey.oracleLast, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Neo 的视角')
      : state?.paused || state?.unavailable ? '<p>会面进度保留，等同行者可以继续。</p>'
        : player.status !== 'alive' ? button('retry', '接回 Neo 的会面检查点')
          : oracleLastLocked(state) ? '<p>合上手记，听当前回应；鼠标环顾，V 切换视角。</p>'
            : journey.step >= scene.steps.length ? button('next', '继续另一视角，观察先知留下后的事 →')
              : journey.step === 3 ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('')
                : journey.step === 0 || state?.phase === 'greeting' ? '<p>合上手记，走进厨房；等先知洗手、落座。</p>'
                  : journey.step === 4 ? '<p>WASD 亲自离开厨房，走回候诊室。</p>'
                    : button('act', journey.step === 1 ? '询问先知身份与此前的真相 · G' : '追问源头与 Smith · G', !close);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>先知厨房 · 没有保证的未来</h3><p>Neo 视角 · 再次面对自己的选择</p></header><article class="film-now"><div><p>${oracleLastText(state, journey.step)}</p><div class="film-controls">${action}</div><small>WASD 亲自行走 · G 主动提问 · J 记录反思 · V 切换视角。暂停、断线与读档保留动作和已听回答。</small></div></article></div>`;
  }
  if (oracleRequestActive(journey)) {
    const state = journey.oracleRequest, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Trinity 的求援视角')
      : oracleRequestLocked(state) ? '<p>合上手记，听当前回应；鼠标环顾，V 切换视角。</p>'
        : journey.step >= scene.steps.length ? button('next', '跟随 Seraph 寻找 Trainman →')
          : journey.step === 2 ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('')
            : journey.step === 3 ? '<p>WASD 跟随同行者，亲自跨过公寓门槛。</p>' : button('act', journey.step === 0 ? '确认先知身份 · G' : '询问 Neo 的下落 · G', !close);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>先知客厅 · 另一边的营救</h3><p>Trinity 视角 · 求援与信任</p></header><article class="film-now"><div><p>${oracleRequestText(state, journey.step)}</p><div class="film-controls">${action}</div><small>G 明确开始提问，听完 Morpheus 的疑问后按 J 记录理解。暂停、断线与读档保留回答和带路进度。</small></div></article></div>`;
  }
  if (sourceBriefingActive(journey)) {
    const state = journey.sourceBriefing, step = scene.steps[journey.step], close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Neo 的会议视角') : player.status !== 'alive' ? button('retry', '接回会议检查点')
      : sourceBriefingLocked(state) ? '<p>合上手记，听船长们的回应；鼠标观察，V 切换视角。</p>'
        : journey.step >= scene.steps.length ? button('next', '接入 Niobe 的发电厂路线 →')
          : step?.kind === 'reflect' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('')
            : button('act', state?.phase === 'question' ? '听取关于预言的质疑 · G' : '检查当前纸质计划 · G', !close);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>废弃公寓 · 三船行动会议</h3><p>Neo 视角 · 矩阵内</p></header><article class="film-now"><div><p>${sourceBriefingText(state)}</p><ol class="film-objectives">${SOURCE_BRIEFING.routes.map(route => `<li class="${state?.reviewed.includes(route.id) ? 'done' : state?.selected === route.id ? 'current' : ''}"><b>${state?.reviewed.includes(route.id) ? '✓' : '○'}</b><span>${route.name}</span></li>`).join('')}</ol><div class="film-controls">${action}</div><small>三份纸质计划是游戏中的检查工具。WASD 绕桌检查，G 明确开始，J 记录反思；暂停、断线和读档保留已核对路线。</small></div></article></div>`;
  }
  if (journey.scene === 'm2_trucks' && !journey.visiting && journey.step === 0 && journey.trucks?.hood && journey.trucks.hood.phase !== 'done') {
    const h = journey.trucks.hood, road = journey.trucks.road!;
    const action = player.id !== journey.actor ? button('resume', '接回 Morpheus') : player.status !== 'alive' ? button('retry', '重试车盖检查点')
      : road.paused || road.unavailable ? '<p>接应角色信号未就绪，动作和车体已暂停。</p>' : '<p>合上手记，在车盖上站稳，再借车回到卡车。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>Niobe · 车盖接应</h3></header><article class="film-now"><div><p>${truckHoodText(h)}</p><div class="film-controls">${action}</div><small>A / D 重心 · 按住 G 抓稳 · 空格起跳 · F 飞踢 · V 切换视角</small></div></article></div>`;
  }
  if (journey.scene === 'm2_trucks' && !journey.visiting && journey.step === 0 && journey.trucks?.weapons) {
    const w = journey.trucks.weapons, road = journey.trucks.road!;
    const action = player.id !== journey.actor ? button('resume', '接回 Morpheus 的车顶视角') : player.status !== 'alive' ? button('retry', '重试当前车顶检查点')
      : road.paused || road.unavailable ? '<p>等候同行者的信号；车体与攻防进度已保留。</p>' : '<p>合上手记，亲自瞄准、挥刀与格挡。</p>';
    const controls = w.phase === 'unarmed' ? 'F 连击 · X 闪避' : w.phase === 'gun' ? '鼠标瞄准 · 左键 / T 射击' : 'F 挥刀 · X 限时格挡';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>Morpheus · 车顶枪刀交锋</h3><p>保护钥匙匠 · 从武器攻防转入徒手</p></header><article class="film-now"><div><p>${truckWeaponsText(w)}</p><div class="film-controls">${action}</div><small>${controls} · V 切换视角<br>弹药 ${w.rounds} / 8 · 挥刀 ${w.slashes} · 有效格挡 ${w.parries} / 2 · 第 ${journey.trucks.attempt + 1} 次尝试</small></div></article></div>`;
  }
  if (templeDefenseActive(journey)) {
    const seal = journey.templeSeal, breach = journey.scene === 'm3_temple_breach' ? journey.templeBreach : undefined, step = scene.steps[journey.step];
    const close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回保存的神庙视角')
      : seal?.paused || seal?.unavailable || breach?.paused || breach?.unavailable ? '<p>等候同行者的信号；当前动作与时钟已保留。</p>'
        : player.status !== 'alive' ? button('retry', '从入口检查点重试 · 保留既有结果')
          : !step ? button('next', breach ? '接回机器城的 Neo →' : '转入 Logos 航线 →')
            : templeDefenseLocked(seal, breach) ? breach ? '<p>合上手记观看城市失守与人群等待；V 切换视角，鼠标环顾。</p>' : '<p>合上手记观看；固定炮架时按住 G，松手保留角度。</p>'
              : step.kind === 'interact' ? button('act', breach ? '确认最后的部署 · G' : '握住炮架手轮 · G', !close)
                : '<p>合上手记，沿目标路线亲自行走。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>${scene.title}</h3><p>${breach ? 'Lock 视角 · Trinity 告别之后' : 'Zee 视角 · 最后的入口防线'}</p></header><article class="film-now"><div><p>${templeDefenseText(seal, breach)}</p><div class="film-controls">${action}</div><small>WASD 行走 · G 固定 / 明确开始 · V 切换视角<br>炮位 ${seal?.turns?.filter(turn => turn === 1).length ?? 0}/2 · ${breach ? '暂停、断线与读档保留城市失守进度' : `准备时间 ${Math.ceil(seal?.remaining ?? 42)} 秒 · 入口保持敞开`}</small></div></article></div>`;
  }
  if (dockEvacuationActive(journey)) {
    const state = journey.dockEvacuation, phase = state?.phase ?? 'supplies', step = scene.steps[journey.step];
    const close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回 Kid 的撤离视角')
      : state?.paused || state?.unavailable ? '<p>等候同行者的信号；撤离时钟和补给进度已保留。</p>'
        : player.status !== 'alive' || phase === 'failed' ? button('retry', '从来袭检查点重试 · 保留补给与伤亡')
          : phase === 'clear' ? button('next', '人员清空，接管封井操作员 →')
            : phase === 'supplies' || phase === 'carrying' ? button('act', phase === 'supplies' ? '抬起补给箱 · G' : '放下补给箱 · G', !close)
              : phase === 'waiting' && state!.crewAge >= DOCK_EVACUATION.crewSeconds ? button('act', '关闭笼门并下降 · G', !close)
                : '<p>合上手记，按画面提示搬运、撤退或等候人员上梯。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Kid · 最后一班升降梯</h3><p>卸货 → 新波来袭 → 人员撤退</p></header><article class="film-now"><div><p>${dockEvacuationText(state)}</p><div class="film-controls">${action}</div><small>WASD 搬运 / 撤退 · Shift 空手奔跑 · G 抬起 / 放下 / 关门 · V 切换视角<br>补给${state?.delivered ? '已搬下' : '待搬运'} · 剩余 ${Math.ceil(state?.remaining ?? DOCK_EVACUATION.retreatSeconds)} 秒 · 第 ${(state?.attempts ?? 0) + 1} 次尝试 · EMP 与既有伤亡保留</small></div></article></div>`;
  }
  if (shaftSealActive(journey) && !(journey.shaftSeal?.phase === 'done' && journey.step === 2)) {
    const state = journey.shaftSeal, phase = state?.phase ?? 'ready', step = scene.steps[journey.step];
    const close = Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix, journey));
    const action = player.id !== journey.actor ? button('resume', '接回封井操作员的视角')
      : state?.paused || state?.unavailable ? '<p>等候人员清空与同行者信号；起爆杆保留当前角度。</p>'
        : player.status !== 'alive' ? button('retry', '接回保存的起爆位置')
          : phase === 'done' && !step ? button('next', '继续最后防线 →')
            : phase === 'ready' && journey.step === 1 ? button('act', '握住起爆手柄 · G', !close)
              : phase === 'armed' || phase === 'throwing' ? '<p>合上手记，按住 G 拉下起爆杆；松手停留。</p>'
                : '<p>合上手记，走到操作台或观察封井过程。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>封井操作员 · 为防线争取时间</h3><p>确认最后一班升降梯已经撤离</p></header><article class="film-now"><div><p>${shaftSealText(state)}</p><div class="film-controls">${action}</div><small>WASD 接近起爆台 · G 握住手柄 / 持续下拉 · V 切换视角<br>起爆杆 ${Math.round((state?.turn ?? 0) * 100)}% · 暂停、断线与读档保留手柄位置</small></div></article></div>`;
  }
  if (dockBriefingActive(journey) && (journey.dockBriefing?.phase !== 'reflection' || journey.dockBriefing.paused || journey.dockBriefing.unavailable)) {
    const state = journey.dockBriefing, phase = state?.phase ?? 'ready';
    const close = filmStepNear(scene, scene.steps[2], player.position, player.isInMatrix, journey);
    const action = player.id !== journey.actor ? button('resume', '接回 Niobe 的视角') : player.status !== 'alive' ? button('retry', '接回保存的简报')
      : state?.unavailable ? '<p>简报不会复活其他人物。通过角色选择明确重建缺失的信号后，再接回 Niobe。</p>'
        : state?.paused ? '<p>等候同行者释放角色；当前升降高度与对白进度已保留。</p>'
        : phase === 'ready' ? button('act', '下降到指挥层 · G') : phase === 'done' ? button('next', '继续后续路线 →')
          : phase === 'reply' || phase === 'walking' && journey.step === 2 ? button('act', phase === 'reply' ? '以 Niobe 回应 · G' : '听 Lock 的质问 · G', !close)
            : '<p>合上手记，按画面提示行走或观察。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>指挥层人员闸口 · 救援的代价</h3><p>Niobe 视角 · EMP 后的三位船长</p></header><article class="film-now"><div><p>${dockBriefingText(state)}</p><div class="film-controls">${action}</div><small>${dockBriefingLocked(state) ? 'V 切换视角 · 暂停和重接保留当前进度' : 'WASD 亲自行走 · G 明确回应 · J 记录反思'}<br>不会重置 EMP 或替同行船长治疗伤势。</small></div></article></div>`;
  }
  if (upperDiggerActive(journey)) {
    const state = journey.upperDigger, phase = state?.phase ?? 'approach';
    const action = player.id !== journey.actor ? button('resume', '接回 Zee 的视角') : phase === 'failed' ? button('retry', '从上层检查点重试')
      : ['approach', 'ready', 'hatch'].includes(phase) ? button('act', phase === 'approach' ? '抓住维修梯 · G' : phase === 'ready' ? '抓住 Charra 的腰带 · G' : '进入维修舱口 · G')
        : '<p>合上手记，按画面提示攀爬、抓稳或撤退；等待不会代替移动。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>上层管线 · 最后的两发</h3><p>Zee 视角 · 第一台钻机已倒下</p></header><article class="film-now"><div><p>${upperDiggerText(state)}</p><div class="film-controls">${action}</div><small>W / S 攀爬与爬行 · Z 压低身体 · G 抓稳 / 进入舱口 · V 切换视角<br>${state?.charraDead ? 'Charra 已遇难 · 重试保留人物结果' : 'Charra 与 Zee 协作'} · 第 ${(state?.attempts ?? 0) + 1} 次尝试</small></div></article></div>`;
  }
  if (diggersActive(journey)) {
    const drill = journey.diggers, current = player.id === journey.actor;
    const action = !current ? button('resume', '继续 Charra 的射击任务') : drill?.phase === 'failed' ? button('retry', '重试当前射击口 · 保留支腿损伤')
      : !drill || ['approach', 'relocate'].includes(drill.phase) ? button('act', '到射击口架起发射器 · G') : '<p>合上手记，按提示配合 Zee 装弹和瞄准。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Charra 与 Zee · 第一台钻机</h3><p>打断外侧关节，沿防御通道转移阵位</p></header><article class="film-now"><div><p>${diggersText(drill)}</p><div class="film-controls">${action}</div><small>G 架炮 / 持续装弹 · 鼠标瞄准 · 左键 / T 双发 · V 切换视角<br>火箭 ${drill?.rounds ?? 6} · 剩余 ${Math.ceil(drill?.remaining ?? 90)} 秒</small></div></article></div>`;
  }
  if (dockGateActive(journey) && journey.dockGate) {
    const gate = journey.dockGate, current = player.id === journey.actor;
    const action = !current ? button('resume', '接回 Kid 的炮位') : gate.phase === 'failed' ? button('retry', '从闸门炮位重试 · 保留驾驶结果')
      : gate.phase === 'ready' ? button('act', '接管机炮 · G') : gate.phase === 'done' ? button('next', '交接 Link · 准备 EMP →') : gate.phase === 'braced' ? '<p>合上手记，按住 G 抬起机炮。</p>' : gate.phase === 'aiming' ? '<p>合上手记，用鼠标瞄准并开炮。</p>' : '<p>可按 V 切换视角，救援进度自动保存。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>三号闸门 · 承重缆索</h3><p>Kid 留在受损 APU 内，切断配重让 Hammer 进入</p></header><article class="film-now"><div><p>${dockGateText(gate)}</p><div class="film-controls">${action}</div><small>有效命中 ${gate.hits}/${DOCK_GATE.hits} · 弹药 ${gate.ammo} · 剩余 ${Math.ceil(gate.remaining)} 秒<br>鼠标上下左右瞄准 · 左键 / T 开炮 · V 切换视角</small></div></article></div>`;
  }
  if (dockLastStandActive(journey)) {
    const phase = journey.dockLastStand?.phase ?? 'ready', center = FILM_SETS[scene.set].center;
    const close = Math.hypot(player.position.x - center.x - DOCK_LAST_STAND.kid.x, player.position.z - center.z - DOCK_LAST_STAND.kid.z) <= 1.2;
    const action = player.id !== journey.actor ? button('resume', '继续 Kid 的剧情视角')
      : phase === 'ready' ? button('act', '接续最后防线 · G') : phase === 'wounded' ? button('act', '蹲到 Mifune 身旁 · G', !close)
        : phase === 'response' ? button('act', '告诉他：我还没完成训练 · G') : '<p>合上手记观看，V 切换视角。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Mifune · 最后的交代</h3><p>Kid 视角</p></header><article class="film-now"><div><p>${dockLastStandText(journey.dockLastStand)}</p><div class="film-controls">${action}</div>${phase === 'wounded' && !close ? '<small>先绕过机甲，走到队长身旁。</small>' : ''}</div></article></div>`;
  }
  if (dockReloadActive(journey)) {
    const reload = journey.dockReload, current = player.id === journey.actor;
    const close = Math.hypot(player.position.x - FILM_SETS[scene.set].center.x - DOCK_RELOAD.entry.x,
      player.position.z - FILM_SETS[scene.set].center.z - DOCK_RELOAD.entry.z) <= 1.5;
    const action = !current ? button('resume', '继续保存的船坞视角') : journey.actor === 'mifune' ? button('act', '接管 Kid · 前往装填架')
      : reload?.phase === 'failed' ? button('retry', '从装填重试 · 保留炮位胜利')
        : !reload || reload.phase === 'approach' ? button('act', '握住升降手柄 · G', !close) : '<p>合上手记，按画面提示操作。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Kid · 卡住的弹箱</h3><p>已完成炮位掩护 · 装填检查点独立保存</p></header><article class="film-now"><div><p>${dockReloadText(reload)}</p><div class="film-controls">${action}</div><small>G 操作升降机 / 抓稳 · W 爬上 · F 踢入 · S 爬下 · V 切换视角<br>${reload ? `剩余 ${Math.ceil(reload.remaining)} 秒 · 未抓稳 ${reload.misses}/3 · 第 ${reload.attempts + 1} 次尝试` : '由玩家明确切换到 Kid，其他玩家占用时等候。'}</small></div></article></div>`;
  }
  if (crosscutActive(journey)) {
    const cut = journey.tvExit!.crosscut!, action = crosscutAction(journey, player.position);
    const controls = player.id !== journey.actor ? button('resume', `继续 ${journey.actor === 'tank' ? 'Tank' : 'Neo'} 的保存视角`)
      : action ? button(action.target, action.label + (action.target === 'retry' ? '' : ' · G')) : journey.tvExit!.phase === 'emerging' ? '<p>合上手记，按住 W 依次爬出；松开会抓稳当前横档。</p>' : '<p>合上手记，观察事件或走向电话；暂停不会跳过事件。</p>';
    const climb = journey.tvExit!.emerge ? Math.round(TV_EXIT_ROLES.reduce((sum, role) => sum + journey.tvExit!.emerge![role], 0) / TV_EXIT_ROLES.length * 100) : 100;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>同一条接线的两端</h3><p>${cut.view === 'ship' ? '真实飞船 · Tank 视角' : '矩阵 · Neo 视角'}</p></header><article class="film-now"><div><p>${crosscutText(journey)}</p><div class="film-controls">${controls}</div><small>W / S 沿出口井梯移动 · WASD 进入店内 / 走近硬线 · G 明确行动 · V 切换视角<br>出井 ${climb}% · Tank 保存伤势 ${Math.ceil(cut.tankHealth)} · 反击第 ${cut.attempts + 1} 次尝试</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_basement' && journey.basement) {
    const encounter = journey.basement, current = player.id === journey.actor, center = FILM_SETS[scene.set].center;
    const gap = Math.hypot(player.position.x - center.x - BASEMENT.approach.x, player.position.z - center.z - BASEMENT.approach.z);
    const crewReady = (['apoc', 'switch'] as const).every(role => encounter.company[role] >= basementRouteLength(role) - .05);
    const action = !current ? button('resume', '接回 Neo 的视角') : encounter.paused ? '<p>同行者正在被另一位玩家控制，撤离进度已保留。</p>'
      : encounter.phase === 'failed' ? button('retry', '从撤离检查点重试') : encounter.phase === 'done' ? button('next', '前往电视维修店 →')
        : encounter.phase === 'ready' ? button('act', '抓稳立管继续下行 · G') : encounter.phase === 'searching' && journey.step === 2 ? button('act', '请 Trinity 打开集水口 · G', gap > 4)
          : encounter.phase === 'hatch_ready' ? button('act', '抓住扶手进入排水道 · G', gap > 1.2 || !crewReady) : '<p>合上手记继续撤离，等待不会代替行走。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>地下机械房 · 排水道</h3><p>Neo 视角 · 烟气与同行者会影响撤离</p></header><article class="film-now"><div><p>${basementText(encounter)}</p><div class="film-controls">${action}</div><small>W / S 沿立管移动 · WASD 走动 · Z 压低身体 · G 开盖与下洞 · V 切换视角<br>呼吸余量 ${Math.ceil(encounter.air)}% · 第 ${encounter.attempts + 1} 次尝试</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_tv_exit' && journey.tvExit) {
    const encounter = journey.tvExit, current = player.id === journey.actor, center = FILM_SETS[scene.set].center;
    const close = Math.hypot(player.position.x - center.x - TV_EXIT.approach.x, player.position.z - center.z - TV_EXIT.approach.z) < 1.2;
    const action = !current ? button('resume', '接回 Neo 的视角') : encounter.paused ? '<p>同行者正在被另一位玩家控制，电话动作已保留。</p>'
      : encounter.phase === 'done' ? button('next', '切换到 Tank 的现实视角 →') : encounter.phase === 'line_dead' ? button('act', '请 Trinity 联系船上 · G')
        : encounter.phase === 'ready' && journey.step === 2 ? button('act', '取下硬线听筒 · G', !close) : '<p>合上手记，沿街走入店内，再走近后墙电话。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>Franklin 与 Erie · 电视维修店</h3><p>从街边出口井到硬线，四人保持同行</p></header><article class="film-now"><div><p>${tvExitText(encounter, journey.step)}</p><div class="film-controls">${action}</div><small>W / S 沿井梯移动 · WASD 从街道走入店门 / 穿过柜台右侧 · G 取听筒 / 联系船上 · V 切换视角</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_wetwall' && journey.wetwall) {
    const wall = journey.wetwall, current = player.id === journey.actor, center = FILM_SETS[scene.set].center;
    const near = distance(player.position, { x: center.x + WETWALL.approach.x, y: center.y + WETWALL.approach.y, z: center.z + WETWALL.approach.z }) <= .65;
    const action = !current ? button('resume', '接回 Neo 的视角') : wall.paused ? '<p>等候同行者释放角色；当前高度和队形已保留。</p>'
      : wall.phase === 'failed' ? button('retry', '从墙内检查点重试') : wall.phase === 'done' ? button('next', '继续六楼 608 室的搜查')
        : wall.phase === 'sealed' ? button('act', '破开 808 室的灰泥 · G', !near) : wall.phase === 'jammed' ? button('act', '示意 Trinity 解救 Cypher · G')
          : '<p>合上手记继续观察或控制下行。松开移动键会抓稳等待。</p>';
    const depth = Math.max(0, wall.progress.neo - wetwallEntry(wall, 'neo'));
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>墙里的退路 · 808 → 608</h3><p>破墙入内、管线下行与同伴解救</p></header><article class="film-now"><div><p>${wetwallText(wall)}</p><div class="film-controls">${action}</div><small>W 下行 · S 向上退回 · 空格松手 · G 示意 Trinity · V 切换视角<br>已下行 ${depth.toFixed(1)} / 14.8 m · 第 ${wall.attempts + 1} 次尝试</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_wall_exposed' && journey.wallExposure) {
    const encounter = journey.wallExposure, current = player.id === journey.actor;
    const action = !current ? button('resume', '接回 Neo 的视角') : encounter.paused ? '<p>等候同行者释放角色，当前进度已保留。</p>'
      : encounter.phase === 'failed' ? button('retry', '从六楼夹层重试') : encounter.phase === 'ready' ? button('act', '留意墙外的搜查 · G')
        : encounter.phase === 'done' ? button('next', '接管 Morpheus 的掩护视角') : '<p>合上手记，观察搜查并亲自还击。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>六楼 608 室 · 暴露</h3><p>墙内 Neo 视角 · 搜查、还击与破墙救援</p></header><article class="film-now"><div><p>${sixthText(encounter)}</p><div class="film-controls">${action}</div><small>Z 缩到灰泥后 · 松开 Z 探回破口 · 鼠标转向 · 左键 / T 还击 · V 切换视角<br>弹药 ${encounter.ammo}/12 · 第 ${encounter.attempts + 1} 次尝试 · 暂停与重接保留进度</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_dejavu' && journey.ambushEscape) {
    const escape = journey.ambushEscape, current = player.id === journey.actor;
    const action = !current ? button('resume', '接回 Neo 的视角') : escape.phase === 'failed' || player.status !== 'alive' ? button('retry', `从${escape.checkpoint.floor}楼重试`)
      : escape.phase === 'done' ? button('next', '继续旧楼剧情') : escape.paused ? '<p>同行者正在被另一位玩家控制，等候他释放角色。</p>'
        : ['window', 'phone'].includes(escape.phase) ? button('act', escape.phase === 'window' ? '检查封死的窗户 · G' : '冒险联系 Tank · G', distance(player.position, filmStepPosition(scene, scene.steps[journey.step], journey)) > 4)
          : '<p>合上手记，自由行走。队伍沿实体楼梯撤退；找到通道即可离开，不必清空追兵。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>旧楼 · 被改变的退路</h3><p>硬线切断 → 八楼封窗 → 手机暴露位置 → 管线墙</p></header><article class="film-now"><div><p>${ambushEscapeText(escape)}</p><div class="film-controls">${action}</div><small>最近检查点：${escape.checkpoint.floor}楼 · 第 ${escape.attempts + 1} 次尝试${escape.mouseDead ? ' · Mouse 已遇难' : ''}</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_dejavu' && journey.step === 0 && journey.ambushApproach) {
    const site = journey.ambushApproach.stairCat ? '楼梯' : '门前';
    const current = player.id === journey.actor, pending = !journey.ambushApproach.ready, observing = journey.ambush !== undefined;
    const action = !current ? button('resume', '接回 Neo 的视角') : player.status !== 'alive' ? button('retry', '继续当前楼梯进度')
      : pending ? '<p>合上手记，跟随五名同伴亲自上楼。他们会在前方等你；到平台后让出楼梯口，等队伍到齐。</p>'
        : observing ? `<p>观察${site}黑猫的两次经过，留意同伴的反应。</p>`
          : button('act', `留意${site}的黑猫 · G`, distance(player.position, filmStepPosition(scene, scene.steps[0], journey)) > 4);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>旧楼 · 同行与似曾相识</h3><p>Neo 视角 · 六人一起返回</p></header><article class="film-now"><div><p>${journey.lastText}</p><div class="film-controls">${action}</div><small>WASD 自由行走 · V 切换视角 · 暂停、断线与读档保留队伍位置和黑猫进度</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_spoon' && oracleArrivalPending(journey.oracle?.arrival)) {
    const arrival = journey.oracle!.arrival!, current = player.id === journey.actor;
    const threshold = filmPosition(scene.set, ORACLE_ENTRANCE.threshold.x, ORACLE_ENTRANCE.threshold.z);
    const action = !current ? button('resume', '接回 Neo 的视角') : player.status !== 'alive' ? button('retry', '继续公寓到访进度')
      : arrival.phase === 'waiting' ? button('act', '准备走进公寓 · G', distance(player.position, threshold) > 1.5)
        : '<p>合上手记，自由行走并跟随陪同者。接待者会为你留出进门的空间。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>先知公寓 · 门的另一边</h3><p>Neo 视角 · 亲自走进去</p></header><article class="film-now"><div><p>${journey.lastText}</p><p>${oracleArrivalText(arrival)}</p><div class="film-controls">${action}</div><small>WASD 自由移动 · V 切换视角 · 暂停、断线与读档保留门和人物的当前进度</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_spoon' && journey.oracle?.spoonLesson) {
    const lesson = journey.oracle.spoonLesson, reception = journey.oracle.reception, current = player.id === journey.actor;
    const invited = reception?.phase === 'inviting' && reception.elapsed >= ORACLE_RECEPTION.invitation;
    const action = !current ? button('resume', '接回 Neo 的视角') : player.status !== 'alive' ? button('retry', '继续当前候客厅进度')
      : lesson.phase === 'waiting' ? button('act', '坐在孩子面前 · G', distance(player.position, filmStepPosition(scene, scene.steps[0])) > 1.35)
        : lesson.phase === 'offered' ? button('act', '亲手接过勺子 · G')
          : lesson.phase === 'focus' ? '<p>合上手记，按住 G 注视勺子；松开时观察金属恢复。</p>'
            : lesson.phase === 'understood' ? invited ? button('act', '起身去见先知 · G') : '<button disabled>等候接待者的邀请</button>'
              : lesson.phase === 'done' ? '<p>合上手记，跟随白衣接待者亲自穿过厨房房门。她会等落后的你。</p>' : '<button disabled>动作正在进行</button>';
    const text = (lesson.phase === 'understood' || lesson.phase === 'done') && reception ? oracleReceptionText(reception) : spoonLessonText(lesson);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>先知的候客厅</h3><p>认识规则，或重新认识自己</p></header><article class="film-now"><div><h3>${scene.steps[journey.step]?.label ?? scene.title}</h3><p>${journey.lastText}</p><p>${text}</p><div class="film-controls">${action}</div><small>鼠标环顾 · V 切换视角 · 暂停、断线与读档保留当前动作</small></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_bridge' && journey.bridgeTail?.phase === 'failed') {
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>桥下的车灯</h3><p>Neo 视角 · 追踪器与尾随风险</p></header><article class="film-now"><div><h3>接头被追踪特工阻断</h3><p>${journey.lastText}</p><p>第 ${journey.bridgeTail.attempts + 1} 次尝试 · 追踪器仍在体内</p><div class="film-controls">${player.id === journey.actor ? button('retry', '从桥下入口重试') : button('resume', '接回 Neo 的视角')}<small>重新走近右后车门；上车检查之前，不要在桥下逗留。</small></div></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm3_bane' && journey.bane) {
    const bane = journey.bane; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const action = !current ? button('resume', '接回 Neo 的视角')
      : bane.phase === 'failed' ? button('retry', `从${bane.checkpoint === 'blind' ? '失明后' : '断电前'}重试`)
        : !step ? button('next', '继续驶向机器城 →')
          : journey.step === 0 ? '<p>合上手记，亲自穿过驾驶舱到下层。</p>'
            : journey.step === 1 && bane.phase === 'ready' ? button('act', '面对 Bane · G', !close)
              : journey.step === 2 ? button('act', '打开舱口 · G', !close || journey.started !== undefined)
                : '<p>合上手记，按场景提示闪避、还击，并在失明后按住 G 辨认金色轮廓。</p>';
    const focus = Math.round(bane.focus / BANE_ENCOUNTER.focusSeconds * 100);
    const status = bane.phase === 'blind' ? `金色感知 ${focus}% · 双眼伤势已记入存档`
      : bane.phase === 'failed' ? `失败检查点：${bane.checkpoint === 'blind' ? '失明后' : '断电前'} · 已尝试 ${bane.attempts + 1} 次`
        : `Bane 交锋 · ${bane.phase === 'grapple' ? `还击 ${bane.hits}/2` : bane.phase === 'counter' ? `反击 ${bane.counters}/2` : '警惕电枪与铁管'}`;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Logos · 失明与金色视野</h3><p>Neo 视角 · 断电、伤势、反击与营救自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? 'Trinity 已返回驾驶舱'}</h3><p>${journey.lastText}</p><p>${status}</p>${bane.phase === 'blind' ? `<div class="film-progress"><i style="width:${focus}%"></i></div>` : ''}<div class="film-controls">${action}<small>枪线亮起时 X 闪避；WASD 靠近并面向 Bane，用 F 还击；失明后按住 G，辨认金色轮廓再躲开铁管。暂停、断线和读档保留当前进度。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm3_farewell' && journey.farewell) {
    const farewell = journey.farewell; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const action = !current ? button('resume', '接回 Neo 的视角')
      : !step ? button('next', '转入锡安的最后防线 →')
        : journey.step === 0 ? '<p>合上手记，沿金色结构穿过撞毁的驾驶舱。</p>'
          : journey.step === 1 && farewell.phase === 'ready' ? button('act', '跪到 Trinity 身边 · G', !close)
            : journey.step === 2 ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
              : '<button disabled>告别进行中 · 自动保存</button>';
    const phase = farewell.phase === 'ready' ? '寻找 Trinity' : farewell.phase === 'reaching' ? '循声伸手'
      : farewell.phase === 'discovery' ? '看见伤势' : farewell.phase === 'promise' ? '听完托付'
        : farewell.phase === 'goodbye' ? '最后的话' : farewell.phase === 'kiss' ? '最后一吻' : '静默';
    const progress = Math.min(100, farewell.total / FAREWELL.minimumSeconds * 100);
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Logos 残骸 · 最后的告别</h3><p>Neo 视角 · 金色视野、人物接触与死亡结果自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '只剩前方的机器核心'}</h3><p>${journey.lastText}</p><p>${phase}${farewellLocked(farewell) ? ` · ${Math.round(progress)}%` : ''}</p>${farewellLocked(farewell) ? `<div class="film-progress"><i style="width:${progress}%"></i></div>` : ''}<div class="film-controls">${action}<small>这段没有战斗和倒计时。主动走近后让动作完成；暂停、断线与读档会保留正在进行的那一拍。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm3_deus' && journey.deus) {
    const pact = journey.deus; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const action = !current ? button('resume', '接回 Neo 的视角')
      : pact.phase === 'failed' ? button('retry', '从谈判平台重试')
        : !step ? button('next', '接入暴雨中的矩阵 →')
          : journey.step === 0 ? '<p>合上手记，沿发光通道亲自走到机器核心。</p>'
            : journey.step === 1 && pact.phase === 'ready' ? button('act', '请求机器集体听你说话 · G', !close)
              : journey.step === 1 ? pact.phase === 'swarm' ? '<button disabled>机器群正在收拢 · 按住 G 站稳</button>' : '<p>合上手记观看并聆听；V 切换视角，鼠标环顾。</p>'
                : journey.step === 2 ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
                  : pact.phase === 'pact' ? button('act', '进入连接座 · G', !close)
                    : pact.phase === 'assurance' ? '<p>合上手记聆听双方对失败风险的回应；身体已经接线，颈后探针仍在等待。</p>'
                      : pact.phase === 'consent' ? '<p>最后一条探针停在颈后。按住 G，明确同意接入。</p>'
                      : '<button disabled>物理接入进行中 · 自动保存</button>';
    const phase = pact.phase === 'approach' ? '穿过光廊' : pact.phase === 'ready' ? '等待 Neo 开口'
      : pact.phase === 'swarm' ? '在机器群中站稳' : pact.phase === 'forming' ? '集体面孔正在成形'
        : pact.phase === 'challenge' ? '机器集体的质疑' : pact.phase === 'warning' ? '说明 Smith 已失控'
          : pact.phase === 'question' ? '机器集体询问条件' : pact.phase === 'terms' ? '提出和平条件' : pact.phase === 'assurance' ? '承担失败的风险'
          : pact.phase === 'pact' ? '锡安停火' : pact.phase === 'seating' ? '连接座升起'
            : pact.phase === 'cabling' ? '身体插口接线' : pact.phase === 'consent' ? '等待颈后接入同意'
              : pact.phase === 'connecting' ? '机器能量接通' : pact.phase === 'connected' ? '连接完成' : '谈判未被听见';
    const progress = pact.phase === 'swarm' ? pact.resolve / DEUS_PACT.resolveSeconds * 100
      : pact.phase === 'consent' ? pact.consent / DEUS_PACT.consentSeconds * 100
        : pact.phase === 'forming' ? pact.elapsed / DEUS_PACT.seconds.forming * 100
          : pact.phase === 'challenge' ? pact.elapsed / DEUS_PACT.seconds.challenge * 100
            : pact.phase === 'question' ? pact.elapsed / DEUS_PACT.seconds.question * 100
              : pact.phase === 'assurance' ? pact.elapsed / DEUS_PACT.seconds.assurance * 100
          : pact.phase === 'warning' ? pact.elapsed / DEUS_PACT.seconds.warning * 100
            : pact.phase === 'seating' ? pact.elapsed / DEUS_PACT.seconds.seating * 100
              : pact.phase === 'cabling' ? pact.elapsed / DEUS_PACT.seconds.cabling * 100
                : pact.phase === 'connecting' ? pact.elapsed / DEUS_PACT.seconds.connecting * 100 : 0;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>机器核心 · 共同的威胁</h3><p>Neo 视角 · 谈判、停火与身体接入逐拍自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '暴雨中的矩阵正在等待'}</h3><p>${deusPactDialogue(pact) ?? journey.lastText}</p><p>${phase}${pact.phase === 'failed' ? ` · 第 ${pact.attempts + 1} 次尝试` : ''}</p>${deusPactLocked(pact) && !['terms', 'pact', 'connected'].includes(pact.phase) ? `<div class="film-progress"><i style="width:${Math.max(0, Math.min(100, progress))}%"></i></div>` : ''}<div class="film-controls">${action}<small>只在最初的包围阶段按住 G 站稳；面孔形成后聆听双方回应，再用 J 提出条件。停火后展开托架与身体接线，再确认失败风险；颈后接入仍由玩家明确同意。V 切换视角。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && ['m3_rain', 'm3_surrender'].includes(scene.id) && journey.smithFinale) {
    const finale = journey.smithFinale; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const rain = scene.id === 'm3_rain';
    const action = !current ? button('resume', '接回 Neo 的视角')
      : finale.phase === 'failed' ? button('retry', `从${finale.checkpoint === 'pit' ? '坑底' : finale.checkpoint === 'interior' ? '楼内' : finale.checkpoint === 'sky' ? '第二轮高空' : finale.checkpoint === 'air' ? '高空' : '大道中央'}检查点重试`)
        : !step ? button('next', rain ? '继续最后的选择 →' : '进入停战之后 →')
          : rain && journey.step === 0 ? '<p>合上手记，亲自穿过两列 Smith 复制体。</p>'
            : rain && finale.phase === 'reply' ? button('act', '回答 Smith：今晚结束这一切 · G')
              : rain && finale.phase === 'charge_ready' ? button('act', '主动迎战 · G')
            : rain && journey.step === 1 && finale.phase === 'ready' ? button('act', '开始最后交锋 · G', !close)
              : rain && journey.step === 2 && finale.phase === 'choice' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
                : !rain && journey.step === 0 && finale.phase === 'assault_ready' ? button('act', '再次迎战 · G', !close)
                  : !rain && journey.step === 1 && finale.phase === 'vision' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
                    : !rain && journey.step === 2 && finale.phase === 'understanding' ? button('act', '停止抵抗，接受同化 · G', !close)
                      : finale.phase === 'pit_dodge' ? '<p>合上手记，现在按 X 错开 Smith 的起手。</p>'
                        : finale.phase === 'pit_counter' ? '<p>合上手记，按 F 亲自打出最后的重拳。</p>'
                          : finale.phase === 'pit_recovery' ? '<p>按住 G 从坑底再次站起；松开会保留当前姿态。</p>'
                      : finale.phase === 'surrender' ? '<p>按住 G，明确接受同化并完成与机器的协议。</p>'
                        : '<button disabled>终局动作进行中 · 自动保存</button>';
    const phase = finale.phase === 'approach' ? '穿过复制体' : finale.phase === 'entrance' ? 'Smith 从队列走出'
      : finale.phase === 'greeting' ? 'Smith 的迎接' : finale.phase === 'reply' ? '等待 Neo 亲自回应'
        : finale.phase === 'prediction' ? 'Smith 的必胜预见' : finale.phase === 'charge_ready' ? '对峙 · 主动迎战'
          : finale.phase === 'charging' ? '两人冲向大道中央' : finale.phase === 'ready' ? '大道中央'
      : finale.phase === 'ground_warning' ? '地面交锋 · Smith 起手' : finale.phase === 'ground_dodge' ? '地面交锋 · 现在按 X'
        : finale.phase === 'ground_counter' ? `地面交锋 · F 反击 ${finale.hits}/${SMITH_FINALE.ground.hits}` : finale.phase === 'shockwave' ? '对拳冲击波'
          : finale.phase === 'air_warning' ? '高空交锋 · Smith 俯冲' : finale.phase === 'air_dodge' ? '高空交锋 · 现在按 X'
            : finale.phase === 'air_counter' ? '高空交锋 · 现在按 F' : finale.phase === 'building' ? '撞穿楼体'
              : finale.phase === 'interior_warning' ? '楼内追击 · Smith 起手' : finale.phase === 'interior_dodge' ? '楼内追击 · 现在按 X'
                : finale.phase === 'interior_counter' ? '楼内高踢 · 现在按 F' : finale.phase === 'interior_kick' ? '踢出破窗'
                  : finale.phase === 'relaunch' ? '穿过破窗 · 再次升空' : finale.phase === 'sky_warning' ? '第二轮空战 · 准备闪避'
                    : finale.phase === 'sky_dodge' ? '第二轮空战 · 现在按 X' : finale.phase === 'sky_counter' ? '第二轮空战 · 现在按 F'
                      : finale.phase === 'sky_grapple' ? 'Smith 近身抓握'
              : finale.phase === 'descent' ? '向街面坠落 · 按住 G' : finale.phase === 'crater' ? '从陨石坑站起 · 按住 G'
                : finale.phase === 'choice' ? '为什么继续？由你选择' : finale.phase === 'assault_ready' ? '等待最后猛攻'
                  : finale.phase === 'pit_warning' ? '坑底交锋 · Smith 起手' : finale.phase === 'pit_dodge' ? '坑底交锋 · 现在按 X'
                    : finale.phase === 'pit_evade' ? '错开拳锋' : finale.phase === 'pit_counter' ? '最后的重拳 · 现在按 F'
                      : finale.phase === 'pit_punch' ? 'Neo 的面部重拳' : finale.phase === 'pit_retaliation' ? 'Smith 再次压制'
                        : finale.phase === 'pit_recovery' ? '再次站起 · 按住 G'
                  : finale.phase === 'assault' ? '最后猛攻' : finale.phase === 'vision' ? 'Smith 的预见正在重合'
                    : finale.phase === 'understanding' ? '停手是 Neo 的选择' : finale.phase === 'surrender' ? '明确停止抵抗'
                      : finale.phase === 'assimilating' ? 'Smith 同化 Neo' : smithOracleRestored(finale) ? '先知恢复 · 雨已停' : finale.phase === 'purging' ? '机器清除感染' : '交锋失败';
    const progress = finale.phase === 'entrance' ? finale.elapsed / SMITH_FINALE.entrance.seconds * 100
      : finale.phase === 'greeting' ? finale.elapsed / SMITH_FINALE.entrance.greeting * 100
        : finale.phase === 'prediction' ? finale.elapsed / SMITH_FINALE.entrance.prediction * 100
          : finale.phase === 'charging' ? finale.elapsed / SMITH_FINALE.entrance.charge * 100
            : finale.phase === 'ground_warning' ? finale.elapsed / SMITH_FINALE.ground.warning * 100
      : finale.phase === 'ground_dodge' ? (SMITH_FINALE.ground.dodge - finale.elapsed) / SMITH_FINALE.ground.dodge * 100
        : finale.phase === 'ground_counter' ? (SMITH_FINALE.ground.counter - finale.elapsed) / SMITH_FINALE.ground.counter * 100
          : finale.phase === 'shockwave' ? finale.elapsed / SMITH_FINALE.shockwave * 100
            : finale.phase === 'air_warning' ? finale.elapsed / SMITH_FINALE.air.warning * 100
              : finale.phase === 'air_dodge' ? (SMITH_FINALE.air.dodge - finale.elapsed) / SMITH_FINALE.air.dodge * 100
                : finale.phase === 'air_counter' ? (SMITH_FINALE.air.counter - finale.elapsed) / SMITH_FINALE.air.counter * 100
                  : finale.phase === 'interior_warning' ? finale.elapsed / SMITH_FINALE.interior.warning * 100
                    : finale.phase === 'interior_dodge' ? (SMITH_FINALE.interior.dodge - finale.elapsed) / SMITH_FINALE.interior.dodge * 100
                      : finale.phase === 'interior_counter' ? (SMITH_FINALE.interior.counter - finale.elapsed) / SMITH_FINALE.interior.counter * 100
                        : finale.phase === 'sky_dodge' ? (SMITH_FINALE.air.dodge - finale.elapsed) / SMITH_FINALE.air.dodge * 100
                          : finale.phase === 'sky_counter' ? (SMITH_FINALE.air.counter - finale.elapsed) / SMITH_FINALE.air.counter * 100
                  : finale.phase === 'descent' ? finale.focus / SMITH_FINALE.descent.braceSeconds * 100
                    : finale.phase === 'crater' ? finale.focus / SMITH_FINALE.crater.riseSeconds * 100
                      : finale.phase === 'pit_dodge' ? (SMITH_FINALE.pit.dodge - finale.elapsed) / SMITH_FINALE.pit.dodge * 100
                        : finale.phase === 'pit_counter' ? (SMITH_FINALE.pit.counter - finale.elapsed) / SMITH_FINALE.pit.counter * 100
                          : finale.phase === 'pit_recovery' ? finale.focus / SMITH_FINALE.crater.riseSeconds * 100
                      : finale.phase === 'assault' ? finale.elapsed / SMITH_FINALE.assault * 100
                        : finale.phase === 'surrender' ? finale.focus / SMITH_FINALE.surrender.consentSeconds * 100
                          : finale.phase === 'assimilating' ? finale.elapsed / SMITH_FINALE.surrender.assimilationSeconds * 100
                            : finale.phase === 'purging' ? finale.elapsed / SMITH_FINALE.surrender.purgeSeconds * 100 : 0;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>${rain ? '暴雨大道 · 最后交锋' : '陨石坑 · 最后的选择'}</h3><p>Neo 视角 · 动作窗口、哲学选择与机器协议逐拍保存</p></header><article class="film-now"><div><h3>${step?.label ?? '终局已完成'}</h3><p>${smithFinaleDialogue(finale) ?? journey.lastText}</p><p>${phase}${finale.phase === 'failed' ? ` · 第 ${finale.attempts + 1} 次尝试` : ''}</p>${smithFinaleLocked(finale) && !['reply', 'charge_ready', 'choice', 'vision', 'understanding'].includes(finale.phase) ? `<div class="film-progress"><i style="width:${Math.max(0, Math.min(100, progress))}%"></i></div>` : ''}<div class="film-controls">${action}<small>地面与高空攻击窗口用 X 闪避、F 反击；坠落、站起和最后停手都要按住 G。停止抵抗是玩家明确作出的选择，不会由倒计时代替。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.finished && !journey.visiting && ['m3_ceasefire', 'm3_neo_carried', 'm3_reset', 'm3_dawn'].includes(scene.id) && journey.epilogue) {
    const epilogue = journey.epilogue; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= (scene.id === 'm3_dawn' ? 1.8 : 4));
    const ceasefire = epilogue.kind === 'ceasefire'; const carried = epilogue.kind === 'neo_carried'; const reset = epilogue.kind === 'reset';
    const action = !current ? button('resume', `接回 ${ceasefire ? 'Kid' : carried ? 'Neo' : reset ? 'Sati' : '先知'} 的视角`)
      : !step ? button('next', scene.id === 'm3_dawn' ? '确认完成本轮三部曲 →' : '继续尾声 →')
        : reset ? epilogue.phase === 'ready' ? button('act', '听见脚步，重新醒来 · G') : '<button disabled>城市正在恢复 · 自动保存</button>'
        : ceasefire && journey.step === 0 ? '<p>合上手记，亲自走到神庙入口。</p>'
          : ceasefire && journey.step === 1 && epilogue.phase === 'ready' ? button('act', '亲眼确认哨兵撤离 · G', !close)
            : ceasefire && journey.step === 2 && epilogue.phase === 'message_ready' ? button('act', '向所有人宣布战争结束 · G', !close)
              : carried && epilogue.phase === 'ready' ? button('act', '目送机器带走 Neo · G')
                : !ceasefire && !carried && journey.step === 0 ? '<p>合上手记，走到恢复后的长椅。</p>'
                  : !ceasefire && !carried && journey.step === 1 && epilogue.phase === 'ready' ? button('act', '坐下，等待建筑师 · G', !close)
                    : !ceasefire && !carried && journey.step === 2 && epilogue.phase === 'choice' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label)).join('')
                      : !ceasefire && !carried && journey.step === 3 && epilogue.phase === 'promise' ? button('act', '迎接 Sati 与 Seraph · G')
                        : '<button disabled>尾声演出进行中 · 自动保存</button>';
    const labels: Record<string, string> = { ready: '等待玩家行动', retreat: '哨兵逐批撤离', message_ready: '把消息带回人群', running: 'Kid 奔向神庙深处', announcement: '战争结束了', embrace: '幸存者重逢', disconnecting: '收回连接', lowering: '放低 Neo 的身体', transfer: '转移到机器驳船', departing: '驶入机器城', cat: '黑猫与矩阵重置', architect: '建筑师兑现协议', choice: '和平的边界', promise: '等待 Sati', sati: '为 Neo 留下天空', sunrise: '日出正在展开', belief: '先知选择相信', done: '尾声已完成' };
    const progress = trilogyEpilogueProgress(epilogue) * 100;
    Object.assign(labels, { waking: 'Sati 重新醒来', cat: '街区正在恢复', sitting: '先知落座', leaving: '建筑师离开', sati: 'Sati 与先知重逢' });
    const title = ceasefire ? '锡安神庙 · 停战消息' : carried ? '机器城 · 光中的身体' : reset ? '矩阵街道 · 重新醒来' : '矩阵公园 · 新的清晨';
    const perspective = ceasefire ? 'Kid' : carried ? 'Neo' : reset ? 'Sati' : '先知';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / EPILOGUE</span><h3>${title}</h3><p>${perspective} 视角 · 世界变化、人物表演与当前节拍自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '本段已经完成'}</h3><p>${journey.lastText}</p><p>${labels[epilogue.phase] ?? epilogue.phase}</p>${trilogyEpilogueLocked(epilogue) ? `<div class="film-progress"><i style="width:${progress}%"></i></div>` : ''}<div class="film-controls">${action}<small>撤军、报信、身体运送、矩阵重置和日出都是真实场景过程；暂停或断线会保留当前一拍，下一轮不会自动开始。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_room303' && journey.openingHotel) {
    const hotel = journey.openingHotel; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const fallen = hotel.fallen && distance(player.position, hotel.fallen) <= 4;
    const action = !current ? button('resume', '接回 Trinity 的视角')
      : hotel.phase === 'failed' ? button('retry', '从破门检查点重试')
        : !step ? button('next', '爬上屋顶 →')
          : hotel.phase === 'breach' || hotel.phase === 'dive' ? '<button disabled>演出进行中 · 自动保存</button>'
            : hotel.phase === 'climbing' ? '<p>按 W 沿消防梯上爬，S 可往下退。攀到顶端才进入屋顶追逐。</p>'
              : journey.step === 1 ? hotel.disarmed ? '<p>左键 / T 开火，F 近身还击，X 闪避枪线；清除四名警员后前往电话。</p>'
              : hotel.fallen ? button('act', '夺取警员手枪 · G', !fallen) : '<p>领头警员正在靠近。F 击倒近身警员；红色枪线亮起后按 X。</p>'
              : step.kind === 'reach' ? '<p>合上手记，亲自穿过走廊，抵达破窗。</p>' : button('act', `${step.label} · G`, !close);
    const status = hotel.phase === 'combat' ? `警员 ${sandbox.threats.filter(threat => threat.scene === scene.id).length} 人 · ${hotel.disarmed ? `弹匣 ${hotel.ammo}/8 · R 换弹` : '先夺取手枪'}`
      : hotel.phase === 'breach' ? '303 房门被撞开 · Trinity 举手应对' : hotel.phase === 'dive' ? '穿窗进入消防梯' : hotel.phase === 'ladder_ready' ? '抓住消防梯 · G 开始攀爬' : hotel.phase === 'climbing' ? `攀爬 ${Math.round((hotel.climbed ?? 0) / OPENING_HOTEL.ladderHeight * 100)}% · W 向上` : hotel.phase === 'failed' ? '突围失败 · 可以重试' : '电话、走廊与破窗都要亲自完成';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>${scene.title}</h3><p>Trinity 视角 · 303 破门、夺枪、电话和破窗自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '303 突围完成'}</h3><p>${journey.lastText}</p><p>${status}</p><div class="film-controls">${action}<small>等待不会自动击败警员；死亡后从破门检查点重试，暂停和断线保留当前节拍。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && (scene.id === 'm1_roofs' && journey.openingRoof || scene.id === 'm1_phone_escape' && journey.openingPhone)) {
    const roof = scene.id === 'm1_roofs'; const chase = journey.openingRoof; const phone = journey.openingPhone;
    const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const failed = roof ? chase?.phase === 'failed' : phone?.phase === 'failed';
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const action = !current ? button('resume', '接回 Trinity 的视角') : failed ? button('retry', roof ? '从屋顶入口重试' : '从电话街口重试')
      : !step ? phone?.phase === 'connected' ? '<button disabled>线路已断开 · 卡车正在撞击</button>' : button('next', '继续下一段 →')
        : step.kind === 'reach' ? '<p>合上手记，亲自跑到目标。到达后自动记录。</p>' : button('act', `${step.label} · G`, !close);
    const status = roof ? chase?.leap ? 'Brown 正跃过楼间空隙 · 别停下' : 'Brown 就在身后 · Shift 助跑 · 空格越过楼间空隙'
      : phone?.phase === 'running' ? `卡车撞击前 ${phone.remaining.toFixed(1)} 秒 · 到亭内立即按 G` : phone?.phase === 'failed' ? '出口已毁，等待重试' : '连接已断开，Trinity 安全撤离';
    const progress = !roof && phone?.phase === 'running' ? `<div class="film-progress"><i style="width:${Math.max(0, phone.remaining / OPENING_ESCAPE.phoneSeconds * 100)}%"></i></div>` : '';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>${scene.title}</h3><p>Trinity 视角 · 路线、追兵与倒计时自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '撤离完成'}</h3><p>${journey.lastText}</p><p>${status}</p>${progress}<div class="film-controls">${action}<small>${roof ? '穿过通风设施，到楼间空隙前加速起跳；跌落或被追上可从屋顶入口重试。' : '等待不会自动接通。暂停、断线和读档会保留卡车位置与剩余时间。'}</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm3_hel_bargain' && journey.helBargain) {
    const bargain = journey.helBargain; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const action = !current ? button('resume', '接回 Trinity 的视角')
      : bargain.phase === 'failed' ? button('retry', '从舞池突围前重试')
        : !step ? button('next', '返回 Mobil Ave，接应 Neo →')
          : step.kind === 'reflect' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('')
            : bargain.phase === 'catching' ? '<p>Trinity 正在握紧枪柄。合上手记观看，V 切换视角。</p>'
            : journey.step === 3 && bargain.phase !== 'ready' ? `<p>${bargain.phase === 'counter' ? '合上手记，面朝高台按 F 反击。' : '合上手记，等守卫挥拳后按 X 闪避。'}倒计时会自动保存。</p>`
              : button('act', `${step.label} · G`, !close);
    const window = bargain.phase === 'evade' ? 3 : bargain.phase === 'counter' ? 2.4 : bargain.phase === 'airborne' ? bargain.breakout ? 3.35 : 2.8 : 0;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX REVOLUTIONS / 03</span><h3>Club Hel · 不接受的交换</h3><p>Trinity 视角 · 缴枪、突围、接枪与拒绝自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? 'Trainman 已答应带 Neo 回来'}</h3><p>${journey.lastText}</p>${window ? `<p>剩余 ${(window - bargain.elapsed).toFixed(1)} 秒 · 第 ${bargain.attempts + 1} 次尝试</p><div class="film-progress"><i style="width:${Math.max(0, (window - bargain.elapsed) / window * 100)}%"></i></div>` : ''}<div class="film-controls">${action}<small>先放下武器，再听清 Merovingian 的条件。X 闪避、F 反击、G 接枪；失败只重试突围。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm2_architect' && journey.architect) {
    const encounter = journey.architect; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const action = !current ? button('resume', '接回 Neo 的视角')
      : encounter.phase === 'failed' ? button('retry', '从抉择检查点重试')
        : !step ? button('next', '赶往 Trinity 坠落处 →')
          : encounter.room?.exit ? encounter.room.exit.elapsed < ARCHITECT_ROOM.openingSeconds ? '<p>Neo 正在开门。合上手记观看，V 切换视角。</p>' : '<p>合上手记，用 WASD 亲自跨过左门门槛。</p>'
          : step.kind === 'reach' ? '<p>合上手记，走到建筑师面前。</p>'
            : step.kind === 'reflect' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close || Boolean(journey.reflections['m2_architect:4'] && journey.reflections['m2_architect:4'] !== choice.id))).join('')
              : button('act', `${step.label} · G`, !close || journey.started !== undefined);
    const clock = `${Math.floor(Math.ceil(encounter.remaining) / 60)}:${String(Math.ceil(encounter.remaining) % 60).padStart(2, '0')}`;
    const costs = encounter.trinityReviewed ? '<p>右门：源头重启、二十三名幸存者重建锡安。左门：返回矩阵营救 Trinity；锡安的风险仍在。</p>'
      : encounter.sourceReviewed ? '<p>右门通向源头重启。另一边的代价还需要从屏幕中确认。</p>' : '';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>建筑师 · 第六次异常</h3><p>Neo 视角 · 环形屏幕、两扇门与回应自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '左门已经打开'}</h3><p>${journey.lastText}</p>${costs}${journey.step >= 5 && encounter.phase !== 'done' ? `<p>Trinity 信号窗口 · ${clock}${encounter.phase === 'failed' ? ' · 已中断' : ''}</p><div class="film-progress"><i style="width:${encounter.remaining / ARCHITECT_DOOR_SECONDS * 100}%"></i></div>` : ''}<div class="film-controls">${action}<small>${encounter.trinityReviewed ? '电影路线由 Neo 亲自打开左门。右门可检查，暂不进入另一条结局。' : '先亲自查看两扇门及其代价；等待不会替你作出回应。'}</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm2_catch' && journey.catch) {
    const encounter = journey.catch; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const gap = catchDistance(encounter);
    const action = !current ? button('resume', '接回 Neo 的视角')
      : encounter.phase === 'failed' ? button('retry', encounter.checkpoint === 'pulse' ? '从心跳检查点重试' : '从冲出大楼处重试')
        : encounter.phase === 'done' ? button('next', '返回尼布甲尼撒号 →')
          : encounter.phase === 'launch' ? catchLaunchReady(encounter) ? button('act', '冲破窗口 · G') : '<p>合上手记，用 W 走到前方窗口。</p>'
            : encounter.phase === 'flight' ? `<p>W 飞行 · A / D 调整航线 · 距 Trinity ${gap.toFixed(1)} 米。接近后按 G 抓住她。</p>`
              : encounter.phase === 'extract_ready' ? button('act', '开始聚焦代码 · 按住 G')
                : encounter.phase === 'extracting' ? '<p>继续按住 G，直到子弹离开伤口。</p>'
                  : encounter.phase === 'pulse' ? '<p>合上手记，在每次脉冲收拢到中心时按 F。失败可从屋顶重试。</p>'
                    : '<p>Neo 正把 Trinity 带到屋顶。</p>';
    const progress = encounter.phase === 'flight' ? (1 - encounter.elapsed / CATCH.impact) * 100
      : encounter.phase === 'extracting' ? encounter.focus / CATCH.extraction * 100
        : encounter.phase === 'pulse' ? encounter.elapsed / CATCH.pulsePeriod * 100 : 0;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>坠落 · 再作一次选择</h3><p>Neo 视角 · 飞行、接应与屋顶救援自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? 'Trinity 睁开眼睛'}</h3><p>${catchText(encounter)}</p>${['flight', 'extracting', 'pulse'].includes(encounter.phase) ? `<div class="film-progress"><i style="width:${Math.max(0, progress)}%"></i></div>` : ''}<div class="film-controls">${action}<small>${encounter.phase === 'flight' ? '梦中的破窗与枪口已变成现实；这次 Neo 可以改变坠落的结果。' : '暂停、断线与读档保留当前一拍；失败不会抹去已完成的屋顶检查点。'}</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && (scene.id === 'm2_ship_lost' && journey.shipLoss || scene.id === 'm2_stop_sentinels' && journey.tunnel)) {
    const ship = scene.id === 'm2_ship_lost'; const loss = journey.shipLoss; const tunnel = journey.tunnel;
    const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const failed = ship ? loss?.phase === 'failed' : tunnel?.phase === 'failed';
    const action = !current ? button('resume', `接回 ${journey.actor === 'morpheus' ? 'Morpheus' : 'Neo'} 的视角`)
      : failed ? button('retry', ship ? '从弃船命令重试' : '从隧道窄口重试')
        : !step ? button('next', ship ? '进入隧道，继续逃亡 →' : '登上 Hammer →')
          : ship && loss?.phase === 'destroying' ? '<p>全员已经出船。可以转头观察船体毁坏；当前一拍会自动保存。</p>'
          : !ship && ['stopping', 'collapsing'].includes(tunnel?.phase ?? '') ? '<p>连接已经切断。哨兵和 Neo 的动作会连续完成；当前一拍自动保存。</p>'
          : step.kind === 'reach' ? `<p>合上手记，${ship ? '穿过船尾出口，继续走到船外安全位置；等待同伴通过' : '沿管道跑到窄口'}。</p>`
            : !ship && journey.step === 1 ? '<p>合上手记，面朝追来的哨兵，按住 G 聚焦连接。松开会失去聚焦；这会让 Neo 昏迷。</p>'
              : button('act', `${step.label} · G`, !close || journey.started !== undefined);
    const status = ship ? loss?.paused ? `${loss.paused} 的玩家尚未交还角色；当前进度保留` : loss?.unavailable ? `${loss.unavailable} 无法参与；已有伤亡保留`
      : loss?.phase === 'evacuating' ? `炸弹到达前 ${Math.ceil(loss.remaining)} 秒 · 撤离尝试 ${loss.attempts + 1}`
        : loss?.phase === 'destroying' ? '船体正在解体，先留在安全位置' : loss?.phase === 'mourning' ? '旧船已毁 · G 听 Morpheus 的回应' : 'EMP 够不到远处的哨兵；必须弃船。'
      : tunnel?.paused ? `${tunnel.paused} 的玩家尚未交还角色；当前一拍保留`
        : tunnel?.phase === 'stopping' ? '红色光学眼正在熄灭，机器失去动力'
          : tunnel?.phase === 'collapsing' ? 'Neo 失去意识，Trinity 回身赶来'
            : tunnel?.phase === 'sensing' ? `哨兵逼近 ${Math.ceil(tunnel.remaining)} 秒 · 信号 ${Math.round(tunnel.focus / RELOADED_FINALE.signalSeconds * 100)}%` : '旧船已经被摧毁；Hammer 正在搜索幸存者。';
    const progress = ship && loss?.phase === 'evacuating' ? 100 * loss.remaining / RELOADED_FINALE.evacuationSeconds
      : !ship && tunnel?.phase === 'sensing' ? 100 * tunnel.focus / RELOADED_FINALE.signalSeconds : 0;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>${scene.title}</h3><p>${ship ? `${journey.actor === 'morpheus' ? 'Morpheus' : 'Neo'} · 失去旧船` : 'Neo · 现实中的代价'} · 检查点自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '本段完成'}</h3><p>${journey.lastText}</p><p>${status}</p>${progress ? `<div class="film-progress"><i style="width:${Math.max(0, progress)}%"></i></div>` : ''}<div class="film-controls">${action}${ship && current && journey.actor === 'morpheus' && journey.step < 3 ? button('neo-view', '切回 Neo 继续这一段') : ''}</div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm2_persephone' && journey.persephone) {
    const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && Boolean(step && distance(player.position, filmStepPosition(scene, step)) <= 4);
    const condition = journey.step === 2; const acting = journey.persephone.phase === 'enacting';
    const controls = !current ? button('resume', '继续 Neo 的剧情视角') : condition
      ? acting ? '<button disabled>回应进行中 · 合上手记观看</button>'
        : `${button('persephone:memory', journey.persephone.attempts ? '认真回应她对往日感情的记忆' : '按电影路线接受她提出的条件', !close)}${button('persephone:appeal', '指出她也能亲自决定是否带路', !close)}<small>后一种回应需要先在餐桌上关注她被当成工具的处境；敷衍的尝试会被拒绝。</small>`
      : step?.kind === 'reach' ? '<p>合上手记，亲自走过餐厅、后厨与私人办公室。</p>'
        : step ? button('act', `${step.label} · G`, !close) : button('next', '穿过后门，进入城堡书房 →');
    return `<div class="film-journal film-exiles"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>Persephone · 一次由她提出的交换</h3><p>Neo 视角 · 回应、动作和同伴反应自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '钥匙已经握在她手中'}</h3><p>${journey.lastText}</p><div class="film-controls">${controls}</div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && journey.reloaded) {
    const state = journey.reloaded; const current = player.id === journey.actor; const step = scene.steps[journey.step];
    const close = !step || distance(player.position, filmStepPosition(scene, step)) < 4;
    const active = ['talk_ready', 'connect_ready', 'failed'].includes(state.phase) || ['window_ready', 'report_ready', 'earpiece_ready'].includes(state.phase) && close || state.phase === 'departure_ready' && state.evacuated;
    const actions = !current ? button('resume', '接回保存的剧情角色') : state.phase === 'evacuate_ready'
      ? `${button('exit:west', '掩护西侧出口')}${button('exit:east', '掩护东侧出口')}`
      : state.phase === 'done' ? button('next', '继续下一段') : active ? button('act', state.phase === 'failed' ? '重试入口战斗' : '继续 · G') : '<p>合上手记，继续观察或行动。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>${scene.title}</h3><p>梦境与现实分别记录 · 暂停、退出与重连会保留当前进度</p></header><article class="film-now"><div><h3>${step?.label ?? '本段完成'}</h3><p>${reloadedText(state)}</p>${state.kind === 'dream' ? '<p>F 还击 · 按住 G 放慢梦境 · A / D 调整姿态。梦中的受伤不会改变 Trinity 在现实中的状态。</p>' : '<p>会议情报：舰队返回锡安，Ballard 留守等待先知。三名升级特工会抓住正面连打，观察真实冲拳，再闪避反击。</p>'}${actions}</div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_club' && journey.club) {
    const phase = journey.club.phase; const step = scene.steps[journey.step];
    const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const active = phase === 'ready' || phase === 'listen';
    return `<div class="film-journal film-contact"><header class="film-heading"><span>THE MATRIX / 01</span><h3>在人群中低声交谈</h3></header><article class="film-now"><div><h3>${step?.label ?? '明天仍然要上班'}</h3><p>${journey.lastText}</p><div class="film-controls">${!current ? button('resume', '继续 Neo 的剧情视角') : phase === 'question' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('') : active ? button('act', phase === 'ready' ? '回应 Trinity · G' : '追问她为什么来找我 · G', !close) : !step ? button('next', '回到 101 公寓 · 20 分钟 / 免费') : clubLocked(journey) ? '<p>合上手记观看。V 可以切换视角，暂停和重新载入会保留交谈进度。</p>' : '<p>合上手记，用 WASD 穿过人群。你可以停留观察，走到目标旁再继续。</p>'}</div><details><summary>查看这次相遇的进度</summary><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></details></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_wake_up' && journey.contact) {
    const phase = journey.contact.phase; const step = scene.steps[journey.step];
    const ready = !apartmentLocked(journey) || phase === 'reply';
    const close = player.id === journey.actor && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const label = phase === 'reply' ? '尝试退出窗口' : step?.label ?? '随他们去夜店';
    return `<div class="film-journal film-contact"><header class="film-heading"><span>THE MATRIX / 01</span><h3>101 · 白兔来敲门</h3></header><article class="film-now"><div><h3>${label}</h3><p>${journey.lastText}</p><div class="film-controls">${phase === 'noticed' ? `${button('contact:follow', '接受邀请，亲自核对线索', !close)}${button('contact:wait', '暂时回到日常生活', !close)}<small>暂缓不会丢失调查与交易记录。回家后仍可以继续。</small>` : button(step ? 'act' : 'next', ready ? `${label} · G` : '合上手记观看', !close || !ready)}${!step ? '<small>白天出发会等到今晚 20:30；已到夜间则计入 20 分钟路程。</small>' : ''}${player.id !== journey.actor ? button('resume', '继续 Neo 的剧情视角') : ''}</div><details><summary>查看已保存的线索与交易步骤</summary><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></details></div></article></div>`;
  }
  if (!journey.visiting && scene.id === 'm1_commute') {
    const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const lift = life.lift; const busy = Boolean(lift && lift.phase !== 'idle');
    const action = !current ? button('resume', '继续 Neo 的通勤') : !step ? button('next', '走进办公室 · G')
      : journey.step === 1 ? button('act', busy ? '电梯运行中 · 请等候开门' : '呼叫 / 乘坐电梯 · G', busy || !nearMetacortexLift(player.position)) : '<p>合上手记，沿金色目标亲自步行。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>去公司的路</h3><p>街道 → 一层大堂 → 开发部</p></header><article class="film-now"><div><h3>${step?.label ?? '来到办公区'}</h3><p>穿过 Metacortex 正门，走进大堂后方的电梯。进入轿厢后按 G 上楼，开门后亲自走出去。</p><div class="film-controls">${action}</div><small>行走随世界时钟计时。电梯在同一栋楼内升降，暂停和读档保留当前行程。</small></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_morning' && journey.morning) {
    const phase = journey.morning.phase; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4)
      && (phase !== 'ready' || player.position.z >= FILM_SETS[scene.set].center.z + 20);
    const commute = '步行去公司 · G';
    const action = !current ? button('resume', '继续 Neo 的生活') : phase === 'home' ? button('act', '休息到早晨 · G', !close)
      : phase === 'alarm' ? button('act', '伸手关掉闹钟，起床 · G') : phase === 'ready' ? button('act', '在街边准备出发 · G', !close)
      : phase === 'done' ? button('next', commute) : '<button disabled>合上手记，观看当前动作</button>';
    return `<div class="film-journal film-contact"><header class="film-heading"><span>THE MATRIX / 01</span><h3>101 · 闹钟之后</h3><p>第 ${life.day} 天 · 现金 $${life.money} · 精力 ${Math.round(life.energy)}</p></header><article class="film-now"><div><h3>${step?.label ?? '出发去公司'}</h3><p>${journey.lastText}</p><div class="film-controls">${action}</div><small>${morningLocked(journey) ? '休息与起身进度会保存，暂停或退出后从当前动作继续。' : '休息推进到早晨；出门后亲自步行去公司，再从大堂乘电梯上楼。'}</small><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_wake_again' && journey.wakeCall) {
    const phase = journey.wakeCall.phase; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const watching = wakeCallLocked(journey) && phase !== 'decision';
    const action = phase === 'ringing' ? button('act', '拿起有线座机听筒 · G', !close)
      : phase === 'decision' ? button('act', '回答：我仍然要见面 · G', !current)
      : phase === 'done' ? !step ? button('next', '前往 Adams Street 桥下 · G', !current) : button('act', '转动门把，离开 101 · G', !close)
      : '<button disabled>演出进行中 · 合上手记观看</button>';
    return `<div class="film-journal film-contact"><header class="film-heading"><span>THE MATRIX / 01</span><h3>101 · ${journey.wakeCall.nightmare ? '并非一场梦' : '第二次来电'}</h3><p>${journey.wakeCall.nightmare ? '被捕路线 · 追踪状态保留' : '成功脱身路线 · 仍需接头检查'}</p></header><article class="film-now"><div><h3>${phase === 'waking' ? '在床上惊醒' : phase === 'ringing' ? '公寓里的座机' : phase === 'decision' ? '你仍然想见面吗？' : phase === 'done' ? '走到 101 房门' : phase === 'leaving' ? '离开公寓' : '监听中的线路'}</h3><p>${journey.lastText}</p><div class="film-controls">${action}${!current ? button('resume', '继续 Neo 的剧情视角') : ''}${watching ? '<small>人物姿势、电话阶段和对话时钟正在自动保存。</small>' : ''}</div><details><summary>查看这次来电的进度</summary><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></details></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_sentinels' && journey.sentinel) {
    const encounter = journey.sentinel; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const phase = encounter.phase; const scanning = phase === 'sweep';
    const title = phase === 'ready' ? '警报后的前舱' : phase === 'shutdown' ? '切断非必要供电' : scanning ? '哨兵正在扫描船体'
      : phase === 'detected' ? '扫描锁定' : phase === 'failed' ? '静默失败' : phase === 'clear' ? '仍然不要动'
      : phase === 'verify' ? '确认航道' : phase === 'confirming' ? 'EMP 保持待命' : '重新接通必要系统';
    const action = phase === 'ready' ? button('act', '请 Tank 执行静默停机 · G', !close)
      : phase === 'verify' ? button('act', '确认哨兵已经离开 · G', !close)
      : phase === 'failed' ? button('act', '从停机检查点重试 · G', !current)
      : phase === 'done' ? button('next', '继续船上的夜班 →', !current)
      : '<button disabled>合上手记观察当前动作</button>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>尼布甲尼撒号 · 静默潜航</h3><p>Neo 视角 · 船员位置、扫描与噪声自动保存</p></header><article class="film-now"><div><h3>${title}</h3><p>${journey.lastText}</p>${scanning ? `<p>红色扫描强度 ${Math.round(sentinelDanger(encounter.elapsed) * 100)}% · 船内噪声 ${Math.round(encounter.noise * 100)}%</p><div class="film-progress"><i style="width:${encounter.noise * 100}%"></i></div><small>松开移动键。WASD、Shift 和空格都会把振动传到船壳。</small>` : ''}<div class="film-controls">${action}${!current ? button('resume', '继续 Neo 的剧情视角') : ''}${sentinelLocked(journey) ? '<small>可以转动镜头或按 V 换视角；暂停、断线与重新载入会保留这一拍。</small>' : ''}</div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && journey.interlude && ['m1_cypher_console', 'm1_steak', 'm1_meal'].includes(journey.scene)) {
    const encounter = journey.interlude; const phase = encounter.phase; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const names = encounter.kind === 'console' ? ['尼布甲尼撒号 · 值班控制台', '屏幕旁的一杯酒', 'Neo 视角 · 你能看出 Cypher 的动摇，但不会提前知道他的交易']
      : encounter.kind === 'steak' ? ['矩阵高层餐厅 · 窗边桌', '舒适的代价', 'Smith 旁观视角 · 此段不会写入 Neo 当时的角色知识']
      : ['尼布甲尼撒号 · 船员餐桌', '真实世界的一顿饭', 'Neo 视角 · 一顿普通早餐也在讨论何为真实'];
    let action = '';
    if (phase === 'choice') action = filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !current)).join('');
    else if (phase === 'ready' && encounter.kind === 'steak' && journey.step === 0) action = `<p>合上手记，走到窗边餐桌的空座。还没落座前，交易不会自行开始。</p>${!close && step ? `<small>距离座位 ${Math.round(distance(player.position, filmStepPosition(scene, step)))} m</small>` : ''}`;
    else if (phase === 'ready') action = button('act', encounter.kind === 'console' ? '打断 Cypher 的夜班 · G' : encounter.kind === 'steak' ? '落座见证交易 · G' : '接过 Tank 递来的食物 · G', !close);
    else if (phase === 'done' && encounter.kind === 'meal' && step) action = '<p>合上手记，用 WASD 回到核心连接区；抵达目标后自动记录。</p>';
    else if (phase === 'done') action = button('next', '继续下一段 →', !current);
    else action = '<button disabled>演出进行中 · 合上手记观看</button>';
    const progress = interludeLocked(journey) ? `<div class="film-progress"><i style="width:${Math.min(100, encounter.elapsed / interludeDuration(encounter) * 100)}%"></i></div><small>鼠标可以环顾，V 可在主视角与场景镜头间切换；动作进度会自动保存。</small>` : '';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>${names[0]}</h3><p>${names[2]}</p></header><article class="film-now"><div><h3>${names[1]}</h3><p>${journey.lastText}</p>${progress}<div class="film-controls">${action}${!current ? button('resume', `继续 ${journey.actor === 'smith' ? 'Smith' : 'Neo'} 的剧情视角`) : ''}</div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_oracle' && journey.oracle?.departure) {
    const departure = journey.oracle.departure, current = player.id === journey.actor;
    const target = oracleDepartureTarget(departure, journey.oracle.reception!);
    const close = current && distance(player.position, filmPosition(scene.set, target.x, target.z)) <= (departure.phase === 'waiting' ? 2.4 : 1.5);
    const action = !current ? button('resume', '接回 Neo 的视角') : player.status !== 'alive' ? button('retry', '继续当前送别进度')
      : departure.phase === 'waiting' ? button('act', '请接待者带路 · G', !close)
        : departure.phase === 'ready' ? button('act', '听 Morpheus 说完 · G', !close || departure.rise < 3.8)
          : departure.phase === 'bite_ready' ? button('act', '吃一口饼干 · G')
            : departure.phase === 'leaving' ? button('act', '确认离开公寓 · G', !close)
              : departure.phase === 'done' ? button('next', '继续返回路线 →') : '<p>合上手记，跟随接待者或观看当前动作。</p>';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>先知公寓 · 带着疑问离开</h3><p>Neo 视角 · 预言属于你自己</p></header><article class="film-now"><div><h3>饼干、会合与离场</h3><p>${journey.lastText}</p><p>${oracleDepartureText(departure)}</p><div class="film-controls">${action}</div><small>WASD 自由移动 · 鼠标环顾 · V 切换视角 · 暂停、断线与读档保留送别进度</small></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_oracle' && journey.oracle?.consultation) {
    const encounter = journey.oracle.consultation; const current = player.id === journey.actor; const step = scene.steps[journey.step];
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const title = encounter.phase === 'waiting' ? '走近先知' : encounter.phase === 'examining' ? '认识你自己'
      : encounter.phase === 'question' ? '预言不会替你选择' : encounter.phase === 'responding' ? 'Morpheus 与具体的人' : '带着疑问离开厨房';
    const action = encounter.phase === 'waiting' ? button('act', '接受检查与谈话 · G', !close)
      : encounter.phase === 'question' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !current)).join('')
      : encounter.phase === 'done' ? button('next', '离开厨房，继续返回路线 →', !current)
      : '<button disabled>演出进行中 · 合上手记观看</button>';
    const progress = oracleVisitLocked(journey) && encounter.phase !== 'question'
      ? `<div class="film-progress"><i style="width:${Math.min(100, encounter.elapsed / oracleVisitDuration(encounter) * 100)}%"></i></div>` : '';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>先知的厨房 · 花瓶之后</h3><p>Neo 视角 · 检查、回答与饼干交接自动保存</p></header><article class="film-now"><div><h3>${title}</h3><p>${journey.lastText}</p>${progress}<div class="film-controls">${action}${!current ? button('resume', '继续 Neo 的剧情视角') : ''}<small>${encounter.phase === 'question' ? '等待不会替你回答；选择会改变后续营救准备。' : oracleVisitLocked(journey) ? '鼠标可以环顾，V 可在主视角和场景镜头间切换。' : '走到操作台旁再继续。'}</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && journey.rescue && ['m1_rescue_decision', 'm1_guns'].includes(journey.scene)) {
    const preparation = journey.rescue; const current = player.id === journey.actor; const step = scene.steps[journey.step];
    const briefing = journey.scene === 'm1_rescue_decision'; const loadout = rescueLoadout(preparation);
    const nearest = Object.entries(RESCUE.loadoutRoots).map(([id, root]) => ({ id, distance: distance(player.position, filmPosition(scene.set, root.x, root.z)) }))
      .sort((a, b) => a.distance - b.distance)[0];
    const close = current && (preparation.phase === 'selecting' ? Boolean(nearest && nearest.distance <= 4) : !step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const title = preparation.phase === 'briefing_ready' ? journey.step === 0 ? '决定为何回去' : '把选择变成营救方案'
      : preparation.phase === 'briefing' ? '入口、审讯层与屋顶撤离线' : preparation.phase === 'briefing_done' ? '方案已经确认'
      : preparation.phase === 'racks_ready' ? '空白构造体等待装载' : preparation.phase === 'racks_arriving' ? '武器架正在接近'
      : preparation.phase === 'selecting' ? '亲自选择携带配置' : preparation.phase === 'equipping' ? `装配${loadout.name}` : `${loadout.name}已写入检查点`;
    let action = '';
    if (briefing && journey.step === 0) action = `<p>${step?.text ?? ''}</p>${filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('')}`;
    else if (preparation.phase === 'briefing_ready') action = button('act', '与 Tank、Trinity 核对方案 · G', !close);
    else if (preparation.phase === 'briefing') action = '<button disabled>合上手记，观察任务投影</button>';
    else if (preparation.phase === 'briefing_done') action = button('next', '进入白色构造体 →', !current);
    else if (preparation.phase === 'racks_ready') action = button('act', '请求 Tank 载入武器架 · G', !close);
    else if (preparation.phase === 'racks_arriving') action = '<button disabled>武器架正在实体化</button>';
    else if (preparation.phase === 'selecting') action = `${button('act', nearest ? `选择${({ compact: '双持冲锋枪', breacher: '霰弹枪', rifle: '突击步枪' } as const)[nearest.id as keyof typeof RESCUE.loadoutRoots]} · G` : '选择武器 · G', !close)}<small>左：24 发快速压制 · 中：8 发近距重击 · 右：16 发均衡射击</small>`;
    else if (preparation.phase === 'equipping') action = '<button disabled>检查枪机、弹匣与侧翼分工</button>';
    else if (step) action = '<p>合上手记，带着实际选择走向构造体出口；大厅战斗会使用这套弹匣、伤害与射速。</p>';
    else action = button('next', '载入政府大楼大厅 →', !current);
    const duration = rescueDuration(preparation); const progress = duration ? `<div class="film-progress"><i style="width:${Math.min(100, preparation.elapsed / duration * 100)}%"></i></div>` : '';
    const stats = preparation.loadout ? `<p>${loadout.name} · ${loadout.magazine} 发 · 单发 ${loadout.damage} · 换弹 ${loadout.reloadTicks} 拍</p>` : '';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>${briefing ? '尼布甲尼撒号 · 营救简报' : '白色构造体 · 武器装载'}</h3><p>Neo 视角 · 方案、装备与大厅战斗规则自动保存</p></header><article class="film-now"><div><h3>${title}</h3><p>${journey.lastText}</p>${stats}${progress}<div class="film-controls">${action}${!current ? button('resume', '继续 Neo 的剧情视角') : ''}<small>${rescueLocked(journey) ? '鼠标可以环顾，V 可在主视角和场景镜头间切换；暂停、断线与读档保留当前一拍。' : preparation.phase === 'selecting' ? `最近配置距离 ${Math.round(nearest?.distance ?? 0)} m；等待不会替你选择。` : '必须亲自走近并确认，剧情不会自动完成。'}</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && journey.betrayal && ['m1_bathroom', 'm1_unplugged'].includes(journey.scene)) {
    const encounter = journey.betrayal; const current = player.id === journey.actor; const step = scene.steps[journey.step];
    if (encounter.fight) {
      const fight = encounter.fight, ready = ['ready', 'capture_ready'].includes(fight.phase);
      const action = !current ? button('resume', '继续 Morpheus 的剧情视角') : fight.phase === 'failed' ? button('retry', '从六楼地面压制重试')
        : fight.phase === 'done' ? button('next', '继续撤离后的剧情 →') : ready ? button('act', fight.phase === 'ready' ? '接续地面掩护 · G' : '继续挡住 Smith · G') : '';
      return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>六楼 608 · 近身掩护</h3><p>Morpheus 视角 · 动作、伤势与队友下行进度保存</p></header><article class="film-now"><div><h3>${fight.phase === 'pinning' || fight.phase === 'ready' ? '压制地面的 Smith' : fight.phase === 'failed' ? '掩护中断' : fight.phase === 'done' ? 'Morpheus 被捕' : '为同伴争取撤离时间'}</h3><p>${journey.lastText}</p><p>地面压制 ${fight.held.toFixed(1)} / 4 秒 · 有效反击 ${fight.counters} / 4 · 尝试 ${encounter.attempt + 1}</p><div class="film-controls">${action}<small>Z 稳住抓握 · X 在起手后半段闪避 · F 在落空窗口反击 · V 双视角。普通射击和角色技能不能跳过这一段。</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
    }
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step, journey)) <= 4);
    const bathroom = encounter.kind === 'bathroom'; const phase = encounter.phase;
    const title = bathroom ? phase === 'ready' ? '同伴进入墙内通道' : phase === 'defending' ? '守住浴室门线'
      : phase === 'sacrifice_ready' ? '最后一次主动选择' : phase === 'sacrifice' ? encounter.sixth ? '把 Smith 带离破口' : '撞穿隔墙' : 'Morpheus 被捕'
      : journey.step === 0 ? '抵达备用控制台' : phase === 'ready' ? '有人先回到了飞船' : phase === 'unplugging' ? '连接被逐一拔除'
      : phase === 'aiming' ? '等待枪口偏转' : phase === 'window' ? '反击窗口' : phase === 'failed' ? '最后两路信号熄灭'
      : phase === 'countering' ? 'Tank 的反击' : phase === 'reconnect' ? '接回幸存者' : '背叛结束';
    let action = '';
    if (!current) action = button('resume', `继续 ${bathroom ? 'Morpheus' : 'Tank'} 的剧情视角`);
    else if (!bathroom && journey.step === 0) action = '<p>合上手记，走到备用控制台；到达后自动记录。</p>';
    else if (phase === 'ready') action = button('act', bathroom ? '开始掩护撤离 · G' : '接通监视画面 · G', !close);
    else if (phase === 'sacrifice_ready') action = button('act', '撞向 Smith · G', !close);
    else if (phase === 'window') action = button('act', '抓起步枪反击 · G', !current);
    else if (phase === 'failed') action = button('retry', '从备用控制台重试', !current);
    else if (phase === 'reconnect') action = button('act', (encounter.rescued ?? 0) ? '接回 Trinity · G' : '稳住 Neo 的接线 · G', !current);
    else if (phase === 'done') action = button('next', bathroom ? encounter.sixth ? '接回 Neo · 继续地下室撤离 →' : '转到飞船上的背叛 →' : '继续营救抉择 →', !current);
    else action = '<button disabled>合上手记，观察当前动作</button>';
    const duration = phase === 'defending' ? BETRAYAL.bathroom.hold : betrayalDuration(encounter);
    const progress = duration > 0 && (phase === 'defending' || betrayalLocked(journey))
      ? `<div class="film-progress"><i style="width:${Math.min(100, encounter.elapsed / duration * 100)}%"></i></div>` : '';
    const status = phase === 'defending' ? `有效击退 ${encounter.repels ?? 0} / ${BETRAYAL.bathroom.requiredRepels} · 掩护 ${Math.floor(encounter.elapsed)} / ${BETRAYAL.bathroom.hold} 秒`
      : phase === 'reconnect' ? `已接回 ${encounter.rescued ?? 0} / 2 路信号` : `尝试 ${encounter.attempt + 1}`;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>${bathroom ? '旧楼浴室 · 撤离线' : '尼布甲尼撒号 · 备用控制台'}</h3><p>${bathroom ? 'Morpheus' : 'Tank'} 视角 · 失败与动作进度自动保存</p></header><article class="film-now"><div><h3>${title}</h3><p>${journey.lastText}</p><p>${status}</p>${progress}<div class="film-controls">${action}<small>${betrayalLocked(journey) ? '鼠标可以环顾，V 可切换主视角；暂停、断线和重新载入会保留当前动作。' : bathroom && phase === 'defending' ? 'F 近战 · X 闪避。等待不会代替三次有效击退。' : '必须亲自走近或按下操作，剧情不会自动替你完成。'}</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_boss' && journey.workday && !journey.phone) {
    const phase = journey.workday.phase; const step = scene.steps[journey.step];
    const active = ['waiting', 'answer', 'signature', 'delivered'].includes(phase);
    const label = phase === 'answer' ? '回应主管，回到工位' : phase === 'signature' ? '签收快递' : phase === 'delivered' ? '拆开包裹，取出手机' : '与 Rhineheart 交谈';
    const close = player.id === journey.actor && step && distance(player.position, filmStepPosition(scene, step)) <= 4;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>Metacortex · Anderson 的工作日</h3><p>人物动作与签收进度自动保存</p></header><article class="film-now"><div><h3>${journey.step === 0 ? '主管办公室' : '一件没有寄件人的快递'}</h3><p>${journey.lastText}</p><p>${workdayLocked(journey) ? 'V 切换视角，可以停下观察；等待不会替你作出回应。' : '合上手记，沿通道走到目标旁。主管办公室的玻璃门已经打开。'}</p>${active ? button('act', `${label} · G`, !close) : '<button disabled>合上手记观看</button>'}${player.id !== journey.actor ? button('resume', '继续 Neo 的剧情视角') : ''}</div></article></div>`;
  }
  if (journey.hotel && !journey.hotel.entered && !journey.visiting) {
    const ready = journey.hotel.progress >= HOTEL_DOOR_PROGRESS - .01 && distance(player.position, filmPosition('film_lafayette', 24, 0)) < 4;
    const knocking = journey.hotel.knock !== undefined;
    const waiting = !ready && distance(player.position, filmPosition('film_lafayette', 24, 0)) < 4;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>前往十三层 · 1313</h3><p>旅馆途中自动保存</p></header><article class="film-now"><div><h3>${knocking ? '三下敲门' : waiting ? '等待 Trinity 赶来' : '跟随 Trinity 上楼'}</h3><p>${journey.lastText}</p><p>${knocking ? '人物动作与位置正在保存；暂停或重新载入会从当前一拍继续。' : 'WASD 移动，Shift 快步。可以停留观察，再回到楼梯继续。'}</p>${journey.hotel.door !== undefined ? '<p>走过打开的房门，去见 Morpheus。</p>' : knocking ? '<button disabled>等待门内回应</button>' : waiting ? '<button disabled>等待 Trinity 赶来</button>' : button('act', '敲响 1313 房门 · G', !ready)}</div></article></div>`;
  }
  if (lafayetteWelcomeLocked(journey)) {
    const phase = journey.hotel!.welcome!.phase; const ready = phase === 'ready' && player.id === journey.actor;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>1313 · 初次见面</h3><p>人物位置与动作自动保存</p></header><article class="film-now"><div><h3>${phase === 'ready' ? 'Morpheus 向你伸出手' : phase === 'handshake' ? '握手' : phase === 'departing' ? '请坐' : '窗前的人影转身'}</h3><p>${journey.lastText}</p><p>可以转动镜头观察，V 切换视角；暂停或重新载入会从当前动作继续。</p>${phase === 'ready' ? button('act', '握住 Morpheus 的手 · G', !ready) : '<button disabled>演出进行中 · 合上手记观看</button>'}</div></article></div>`;
  }
  const step = scene.steps[journey.step]; const set = FILM_SETS[scene.set];
  const bridgeDoor = scene.id === 'm1_bridge' && journey.step === 1 && journey.bridgeArrival?.parkedRoadTime !== undefined
    ? meetingBoardPoint(journey.bridgeArrival) : undefined;
  const chairApproach = journey.downloadSetup?.phase === 'walk';
  const stepPosition = chairApproach ? filmPosition(scene.set, CABIN.approach.x, CABIN.approach.z) : bridgeDoor ? filmPosition(scene.set, bridgeDoor.x, bridgeDoor.z)
    : scene.id === 'm1_bug' && journey.step === 1 && journey.meeting?.phase === 'done' ? player.position
      : step ? filmStepPosition(scene, step, journey) : undefined;
  const waitingForMorpheus = scene.id === 'm1_mirror' && journey.mirrorGuide && !journey.mirrorGuide.done;
  const meetingAction = scene.id === 'm1_bug' && (journey.meeting?.phase === 'done' && journey.step >= 2 || journey.meeting?.phase === 'parked');
  const arrival = scene.id === 'm1_construct' ? journey.constructArrival : undefined;
  const truth = journey.truthRecovery;
  const actionLabel = scene.id === 'm3_hel_entry' && journey.step === 0 && journey.helElevator?.phase === 'arrived' ? '亲自拉开电梯铁门'
    : chairApproach ? '坐下，接入训练' : truth?.phase === 'ready' ? '请求退出程序' : arrival?.phase === 'ready' ? '检查残余自我影像' : meetingAction ? journey.meeting?.phase === 'parked' ? '打开车门下车' : '启程前往 Lafayette' : step?.label;
  const close = chairApproach ? journey.downloadSetup!.progress >= CABIN_ROUTE_LENGTH && distance(player.position, stepPosition!) <= 1.8
    : truth?.phase === 'ready' || arrival?.phase === 'ready' || (arrival ? Boolean(step && filmStepNear(scene, step, player.position, player.isInMatrix))
    : meetingAction || trainingWaiting(journey) || Boolean(stepPosition && player.isInMatrix === (set.world === 'matrix')
      && distance(player.position, stepPosition) <= (scene.id === 'm3_hel_entry' && journey.step === 0 ? 1.1 : 4)));
  const current = player.id === journey.actor;
  const windowExit = !step && !journey.visiting && scene.id === 'm1_office_escape' && Boolean(journey.office && !journey.office.outcome);
  const windowClose = !windowExit || filmStepNear(scene, scene.steps[2], player.position, player.isInMatrix);
  const performing = Boolean(journey.trucks?.road && (journey.trucks.road.phase !== 'ready' || journey.trucks.road.paused || journey.trucks.road.unavailable)) || Boolean(truth && truth.phase !== 'ready' && truth.phase !== 'question') || arrival?.phase === 'image' || helElevatorLocked(journey) || helDanceDoorLocked(journey) || meetingLocked(journey) && !['ready', 'done', 'parked'].includes(journey.meeting?.phase ?? 'ready') || trainingLocked(journey) || sentinelLocked(journey) || interludeLocked(journey) || rescueLocked(journey) || Boolean(journey.awakening && journey.awakening.elapsed < awakeningDuration(journey.awakening)) || oracleActing(journey) || phoneLocked(journey) || wakeCallLocked(journey) || theOneLocked(journey) || windowOpening(journey) || windowCrossing(journey) || pillLocked(journey) || lafayetteWelcomeLocked(journey) || interrogationLocked(journey) && journey.interrogation?.phase !== 'done';
  const answerPhone = phoneLocked(journey) && journey.phone?.phase === 'ready';
  const answer = answerPhone || awakeningWaiting(journey) || trainingWaiting(journey) || interrogationLocked(journey) && journey.interrogation?.phase === 'response';
  const awakeningAction = journey.awakening?.kind === 'breather' ? '检查后颈接口 · G' : journey.awakening?.kind === 'recovery' ? '示意开始恢复肌肉 · G'
    : journey.awakening?.kind === 'construct' ? '触摸椅背，听 Morpheus 解释 · G' : '请 Morpheus 继续揭示 · G';
  const trainingAction = journey.downloadSetup?.phase === 'greeting' ? '起身，认识 Tank · G' : journey.training?.kind === 'download' ? '请 Tank 开始上传 · G'
    : journey.training?.kind === 'jump' ? '请 Morpheus 示范跨楼 · G' : '开始注意力测试 · G';
  const escaped = journey.office?.outcome === 'escaped';
  const context = scene.id === 'm1_bug' && escaped ? '你成功避开了特工。接头者仍要确认车辆与乘员没有被追踪。'
    : scene.id === 'm1_wake_again' && escaped ? '安全返回之后，Morpheus 再次来电，约定桥下接头。' : scene.context;
  const decisions = scene.id === 'm1_pills' ? `<div class="film-pill-choices">${button('pill:red', '红色药丸 · 继续追查真相', !close || journey.pills?.phase === 'taking')}${button('blue', '蓝色药丸 · 回到日常生活', !close || journey.pills?.phase === 'taking')}</div><p>两种决定都会保存。蓝色药丸后仍然可以继续生活。</p>`
    : scene.id === 'm1_ledge' ? `${journey.office?.climbed !== undefined ? '<p>合上手记：W 沿梯子下降，S 向上。松开按键会抓住当前横档，到达下方维修平台才算脱身。</p>' : button('escape:climb', '抓住外侧维修梯 →', !close)}${button('escape:retreat', '退回办公室，继续被捕后的故事')}`
    : filmReflections(scene.id, journey.office?.outcome).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('');
  const enemies = sandbox.threats.filter(t => t.scene === scene.id).length;
  const combatHint = scene.id === 'm3_dock_battle' ? 'Mifune 已固定在 APU 炮位。鼠标转向逼近的哨兵，左键 / T 射击；弹药有限，Kid 的弹药车必须活着抵达。'
    : scene.id === 'm1_lobby' ? '左键 / T 射击 · R 换弹 · F 近战 · X 闪避 · Q 子弹时间。警卫瞄准后及时换位，Trinity 会从侧翼掩护。'
    : scene.id === 'm3_hel_entry' ? `左键 / T 射击 · R 换弹 · F 近战 · X 闪避。弹匣 ${journey.helCoatcheck?.ammo ?? 0}/${HEL_COATCHECK.magazine}；衣帽柜台能挡住射线，Morpheus 与 Seraph 会掩护。` : 'F 连击 · X 闪避 · 1 治疗。';
  return `<div class="film-journal">
    <header class="film-heading"><span>THE MATRIX / 0${scene.film}</span><h3>${FILM_NAMES[scene.film]}</h3><p>${journey.completed.length} / ${FILM_SCENES.length} 段 · 第 ${life.cycle} 轮 · ${journey.finished ? '三部曲已完成' : '进度自动保存'}</p><div class="film-progress"><i style="width:${journey.completed.length / FILM_SCENES.length * 100}%"></i></div></header>
    ${journey.visiting ? `<article class="film-now"><span>回访场景</span><h3>${FILM_SETS[FILM_SCENE_BY_ID[journey.visiting].set].name}</h3><p>原来的剧情与位置已保留，可以自由走动观察。</p>${button('return', '返回正在进行的剧情 →')}</article>` : `<article class="film-now"><div class="film-scene-number">${String(FILM_SCENES.findIndex(item => item.id === scene.id) + 1).padStart(3, '0')}</div><div><span>${set.name} · ${CHARACTERS[journey.actor]?.nameCn ?? journey.actor} 视角</span><h3>${scene.id === 'm1_bug' && escaped ? '确认没有被追踪' : scene.title}</h3><p>${context}</p>
      ${!current ? button('resume', '继续保存的剧情视角 →') : ''}
      <ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : String(i + 1).padStart(2, '0')}</b><span>${scene.id === 'm1_bug' && escaped ? ['配合安全扫描', '重新判断今晚的接头', goal.label][i] : goal.label}</span>${i === journey.step && journey.fighting ? `<small>剩余 ${enemies} 个目标</small>` : ''}</li>`).join('')}</ol>
      ${journey.finished ? '<p class="film-memory">停战与本轮反思已经保存。</p>' : journey.lastText ? `<p class="film-memory">${journey.lastText}</p>` : ''}
      ${waitingForMorpheus ? '<p>合上手记，跟随 Morpheus 穿过后门。等他抵达追踪室，再坐进椅子。</p>' : ''}
      ${scene.id === 'm3_emp' ? `<p>EMP ${dockPowerOffline(journey) ? '已触发 · 船坞防御与 APU 同时离线' : '已充能 · 等待 Link 启动'}</p>` : ''}
      ${journey.meeting?.phase === 'choice' ? `<div class="film-controls">${button('meeting:stay', '留在车内，接受检查')}${button('meeting:leave', '推开车门，质疑检查')}</div>` : ''}
      ${journey.meeting?.phase === 'hesitating' ? `<div class="film-controls">${button('meeting:stay', '信任 Trinity，关上车门', journey.meeting.elapsed < MEETING_TIMING.hesitating)}${button('meeting:depart', '离开车辆，返回雨中', journey.meeting.elapsed < MEETING_TIMING.hesitating)}</div>` : ''}
      ${player.status !== 'alive' ? `<p>行动中断，已经完成的目标不会丢失。</p>${button('retry', '从当前目标的检查点重试')}` : ''}
      ${step && current && player.status === 'alive' ? `<div class="film-controls">${step.kind === 'reflect' ? `<p>${step.text}</p>${decisions}` : step.kind === 'reach' && !trainingLocked(journey) ? '<p>合上手记，走到金色目标标记。到达后自动记录。</p>' : scene.id === 'm1_spoon' && journey.oracle?.spoon !== undefined ? '<p>合上手记，停下脚步并按住 G。你可以看见手中的勺子逐渐弯曲；松开按键或走动会打断专注。</p>' : scene.id === 'm1_oracle' && journey.oracle?.vase !== undefined ? '<p>合上手记，留意厨房里的花瓶。事件进度已经保存。</p>' : (journey.ride?.phase === 'riding' || journey.garage?.phase === 'riding' || journey.hammer?.phase === 'riding' || journey.logos?.phase === 'riding' || journey.apu?.phase === 'riding') && step.kind === 'drive' ? `<p>合上手记开始驾驶：${journey.logos ? journey.logos.mode === 'defense' ? 'W 爬升，S 俯冲，A / D 横移，按住 G 让 Neo 击碎迫近目标。' : '按住 W 爬升穿出云层，阳光与失速过程会自动保存。' : 'W 加速，S 刹车，A / D 转向。'}行程中会自动保存位置和载具状态。</p>` : journey.fighting ? `<p>${scene.id === 'm1_dojo' ? '先观察 Morpheus 的起手并按 X 闪避，再用 F 完成刺拳、直拳、正蹬。' : combatHint}</p>` : button('act', answerPhone ? '滑开手机接听 · G' : trainingWaiting(journey) ? trainingAction : awakeningWaiting(journey) ? awakeningAction : performing && !answer ? '演出进行中 · 合上手记观看' : journey.started !== undefined ? '互动进行中 · 请停留原地' : `${actionLabel} · G`, !close || waitingForMorpheus || performing && !answer || journey.started !== undefined)}${!close && !trainingLocked(journey) && journey.ride?.phase !== 'riding' && journey.garage?.phase !== 'riding' && journey.hammer?.phase !== 'riding' && journey.logos?.phase !== 'riding' && journey.apu?.phase !== 'riding' && journey.office?.climbed === undefined ? `<small>先走到目标旁 · ${Math.round(distance(player.position, stepPosition!))} m</small>` : ''}</div>` : ''}
      ${scene.id === 'm1_ledge' && step?.kind === 'reach' && current ? button('escape:retreat', '我无法继续，退回办公室') : ''}
      ${scene.id === 'm1_office_escape' && journey.office && step ? `<p>按住 Z 潜行 · 隔间能挡住视线 · 暴露 ${Math.round(journey.office.alert)}%<br>${journey.office.guide}</p>` : ''}
      ${!step && !journey.finished ? button('next', windowCrossing(journey) ? '正在跨窗 · 合上手记观看' : windowExit ? '翻过窗台，落到外侧窄台 · G' : FILM_SCENES.at(-1)!.id === scene.id ? '保存三部曲通关 →' : '继续下一段 →', !current || performing || !windowClose) : ''}
      ${windowExit && !windowClose && !windowCrossing(journey) ? '<small>先回到已打开的窗口旁，再翻到窄台。</small>' : ''}
      ${journey.finished ? `<p>电影路线到这里结束。下一轮是游戏扩展：带着本轮记忆，重新过 Thomas Anderson 的生活。</p>${button('cycle', '保存记忆，开始下一轮生活 →', !current)}` : ''}
    </div></article>`}
    <section class="film-atlas"><h4>三部曲场景手记</h4><p>完成过的场景可以回访。分支未经过的场景不会冒充已经完成。</p>${([1, 2, 3] as const).map(film => `<details ${film === scene.film ? 'open' : ''}><summary>0${film} · ${FILM_NAMES[film]} <small>${FILM_SCENES.filter(s => s.film === film && journey.completed.includes(s.id)).length} / ${FILM_SCENES.filter(s => s.film === film).length}</small></summary><div class="film-atlas-grid">${FILM_SCENES.filter(s => s.film === film).map(s => `<article class="${s.id === scene.id ? 'current' : journey.completed.includes(s.id) ? 'done' : ''}"><small>${CHARACTERS[s.actor]?.nameCn ?? s.actor} · ${journey.completed.includes(s.id) ? '已经历' : s.id === scene.id ? '正在进行' : journey.skipped?.includes(s.id) ? '本轮走了另一条路线' : '尚未经历'}</small><strong>${s.id === 'm1_bug' && escaped ? '确认没有被追踪' : s.id === 'm1_wake_again' && escaped ? '第二次来电' : s.title}</strong><p>${FILM_SETS[s.set].name}</p>${journey.completed.includes(s.id) ? button(`visit:${s.id}`, '回访场景 ↗', !current || Boolean(journey.fighting) || journey.ride?.phase === 'riding' || journey.garage?.phase === 'riding' || journey.hammer?.phase === 'riding' || journey.logos?.phase === 'riding' || journey.apu?.phase === 'riding' || journey.office?.climbed !== undefined || performing || journey.started !== undefined) : ''}</article>`).join('')}</div></details>`).join('')}</section>
  </div>`;
}
