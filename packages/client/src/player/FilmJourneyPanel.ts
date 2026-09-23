import { reloadedText } from '@auto_matrix/shared';
import { FILM_SCENES, FILM_SCENE_BY_ID, FILM_SETS, FILM_NAMES, ARCHITECT_DOOR_SECONDS, filmReflections, CHARACTERS, filmStepPosition, distance, AWAKENING_SECONDS, oracleActing, interrogationLocked, pillLocked, lafayetteWelcomeLocked, phoneLocked, windowOpening, windowCrossing, awakeningWaiting, trainingLocked, trainingWaiting, theOneLocked, type AgentState, type SandboxState } from '@auto_matrix/shared';
import './film-journey.css';
import { meetingLocked } from '@auto_matrix/shared';
import { filmPosition, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';
import { workdayLocked } from '@auto_matrix/shared';
import { apartmentLocked } from '@auto_matrix/shared';
import { wakeCallLocked } from '@auto_matrix/shared';
import { clubLocked } from '@auto_matrix/shared';
import { sentinelDanger, sentinelLocked } from '@auto_matrix/shared';
import { interludeDuration, interludeLocked } from '@auto_matrix/shared';
import { oracleVisitDuration, oracleVisitLocked } from '@auto_matrix/shared';
import { BETRAYAL, betrayalDuration, betrayalLocked } from '@auto_matrix/shared';
import { RESCUE, rescueDuration, rescueLoadout, rescueLocked } from '@auto_matrix/shared';

const button = (target: string, label: string, disabled = false) => `<button data-action="life" data-target="film:${target}" ${disabled ? 'disabled' : ''}>${label}</button>`;
export function renderFilmJourney(player: AgentState, sandbox: SandboxState): string {
  const life = sandbox.neoLife!; const journey = life.journey!; const scene = FILM_SCENE_BY_ID[journey.scene];
  if (!journey.visiting && scene.id === 'm2_architect' && journey.architect) {
    const encounter = journey.architect; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const action = !current ? button('resume', '接回 Neo 的视角')
      : encounter.phase === 'failed' ? button('retry', '从抉择检查点重试')
        : !step ? button('next', '赶往 Trinity 坠落处 →')
          : step.kind === 'reach' ? '<p>合上手记，走到建筑师面前。</p>'
            : step.kind === 'reflect' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close || Boolean(journey.reflections['m2_architect:4'] && journey.reflections['m2_architect:4'] !== choice.id))).join('')
              : button('act', `${step.label} · G`, !close || journey.started !== undefined);
    const clock = `${Math.floor(Math.ceil(encounter.remaining) / 60)}:${String(Math.ceil(encounter.remaining) % 60).padStart(2, '0')}`;
    const costs = encounter.trinityReviewed ? '<p>右门：源头重启、二十三名幸存者重建锡安。左门：返回矩阵营救 Trinity；锡安的风险仍在。</p>'
      : encounter.sourceReviewed ? '<p>右门通向源头重启。另一边的代价还需要从屏幕中确认。</p>' : '';
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX RELOADED / 02</span><h3>建筑师 · 第六次异常</h3><p>Neo 视角 · 环形屏幕、两扇门与回应自动保存</p></header><article class="film-now"><div><h3>${step?.label ?? '左门已经打开'}</h3><p>${journey.lastText}</p>${costs}${journey.step >= 5 && encounter.phase !== 'done' ? `<p>Trinity 信号窗口 · ${clock}${encounter.phase === 'failed' ? ' · 已中断' : ''}</p><div class="film-progress"><i style="width:${encounter.remaining / ARCHITECT_DOOR_SECONDS * 100}%"></i></div>` : ''}<div class="film-controls">${action}<small>${encounter.trinityReviewed ? '电影路线由 Neo 亲自打开左门。右门可检查，暂不进入另一条结局。' : '先亲自查看两扇门及其代价；等待不会替你作出回应。'}</small></div><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></div></article></div>`;
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
    return `<div class="film-journal film-contact"><header class="film-heading"><span>THE MATRIX / 01</span><h3>在人群中低声交谈</h3></header><article class="film-now"><div><h3>${step?.label ?? '明天仍然要上班'}</h3><p>${journey.lastText}</p><div class="film-controls">${!current ? button('resume', '继续 Neo 的剧情视角') : phase === 'question' ? filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('') : active ? button('act', phase === 'ready' ? '回应 Trinity · G' : '追问她为什么来找我 · G', !close) : !step ? button('next', '离开夜店，继续第二天 · G') : clubLocked(journey) ? '<p>合上手记观看。V 可以切换视角，暂停和重新载入会保留交谈进度。</p>' : '<p>合上手记，用 WASD 穿过人群。你可以停留观察，走到目标旁再继续。</p>'}</div><details><summary>查看这次相遇的进度</summary><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></details></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_wake_up' && journey.contact) {
    const phase = journey.contact.phase; const step = scene.steps[journey.step];
    const ready = !apartmentLocked(journey) || phase === 'reply';
    const close = player.id === journey.actor && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const label = phase === 'reply' ? '尝试退出窗口' : step?.label ?? '随他们去夜店';
    return `<div class="film-journal film-contact"><header class="film-heading"><span>THE MATRIX / 01</span><h3>101 · 白兔来敲门</h3></header><article class="film-now"><div><h3>${label}</h3><p>${journey.lastText}</p><div class="film-controls">${phase === 'noticed' ? `${button('contact:follow', '接受邀请，亲自核对线索', !close)}${button('contact:wait', '暂时回到日常生活', !close)}<small>暂缓不会丢失调查与交易记录。回家后仍可以继续。</small>` : button(step ? 'act' : 'next', ready ? `${label} · G` : '合上手记观看', !close || !ready)}${player.id !== journey.actor ? button('resume', '继续 Neo 的剧情视角') : ''}</div><details><summary>查看已保存的线索与交易步骤</summary><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></details></div></article></div>`;
  }
  if (!journey.visiting && journey.scene === 'm1_wake_again' && journey.wakeCall) {
    const phase = journey.wakeCall.phase; const step = scene.steps[journey.step]; const current = player.id === journey.actor;
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const watching = wakeCallLocked(journey) && phase !== 'decision';
    const action = phase === 'ringing' ? button('act', '拿起有线座机听筒 · G', !close)
      : phase === 'decision' ? button('act', '回答：我仍然要见面 · G', !current)
      : phase === 'done' ? '<p>合上手记，亲自走到 101 房门；抵达后会记录离开。</p>'
      : '<button disabled>演出进行中 · 合上手记观看</button>';
    return `<div class="film-journal film-contact"><header class="film-heading"><span>THE MATRIX / 01</span><h3>101 · 并非一场梦</h3><p>${journey.wakeCall.nightmare ? '被捕路线 · 追踪状态保留' : '成功脱身路线 · 未发现追踪器'}</p></header><article class="film-now"><div><h3>${phase === 'waking' ? '在床上惊醒' : phase === 'ringing' ? '公寓里的座机' : phase === 'decision' ? '你仍然想见面吗？' : phase === 'done' ? '前往 Adams Street' : '监听中的线路'}</h3><p>${journey.lastText}</p><div class="film-controls">${action}${!current ? button('resume', '继续 Neo 的剧情视角') : ''}${watching ? '<small>人物姿势、电话阶段和对话时钟正在自动保存。</small>' : ''}</div><details><summary>查看这次来电的进度</summary><ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : i + 1}</b><span>${goal.label}</span></li>`).join('')}</ol></details></div></article></div>`;
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
    const close = current && (!step || distance(player.position, filmStepPosition(scene, step)) <= 4);
    const bathroom = encounter.kind === 'bathroom'; const phase = encounter.phase;
    const title = bathroom ? phase === 'ready' ? '同伴进入墙内通道' : phase === 'defending' ? '守住浴室门线'
      : phase === 'sacrifice_ready' ? '最后一次主动选择' : phase === 'sacrifice' ? '撞穿隔墙' : 'Morpheus 被捕'
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
    else if (phase === 'done') action = button('next', bathroom ? '转到飞船上的背叛 →' : '继续营救抉择 →', !current);
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
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>前往十三层 · 1313</h3><p>旅馆途中自动保存</p></header><article class="film-now"><div><h3>${knocking ? '三下敲门' : '跟随 Trinity 上楼'}</h3><p>${journey.lastText}</p><p>${knocking ? '人物动作与位置正在保存；暂停或重新载入会从当前一拍继续。' : 'WASD 移动，Shift 快步。可以停留观察，再回到楼梯继续。'}</p>${journey.hotel.door !== undefined ? '<p>走过打开的房门，去见 Morpheus。</p>' : knocking ? '<button disabled>等待门内回应</button>' : button('act', '敲响 1313 房门 · G', !ready)}</div></article></div>`;
  }
  if (lafayetteWelcomeLocked(journey)) {
    const phase = journey.hotel!.welcome!.phase; const ready = phase === 'ready' && player.id === journey.actor;
    return `<div class="film-journal"><header class="film-heading"><span>THE MATRIX / 01</span><h3>1313 · 初次见面</h3><p>人物位置与动作自动保存</p></header><article class="film-now"><div><h3>${phase === 'ready' ? 'Morpheus 向你伸出手' : phase === 'handshake' ? '握手' : phase === 'departing' ? '请坐' : '窗前的人影转身'}</h3><p>${journey.lastText}</p><p>可以转动镜头观察，V 切换视角；暂停或重新载入会从当前动作继续。</p>${phase === 'ready' ? button('act', '握住 Morpheus 的手 · G', !ready) : '<button disabled>演出进行中 · 合上手记观看</button>'}</div></article></div>`;
  }
  const step = scene.steps[journey.step]; const set = FILM_SETS[scene.set];
  const meetingAction = scene.id === 'm1_bug' && (journey.meeting?.phase === 'done' && journey.step >= 2 || journey.meeting?.phase === 'parked');
  const actionLabel = meetingAction ? journey.meeting?.phase === 'parked' ? '打开车门下车' : '启程前往 Lafayette' : step?.label;
  const close = meetingAction || trainingWaiting(journey) || Boolean(step && player.isInMatrix === (set.world === 'matrix') && distance(player.position, filmStepPosition(scene, step)) <= 4);
  const current = player.id === journey.actor;
  const performing = meetingLocked(journey) && !['ready', 'done', 'parked'].includes(journey.meeting?.phase ?? 'ready') || trainingLocked(journey) || sentinelLocked(journey) || interludeLocked(journey) || rescueLocked(journey) || Boolean(journey.awakening && journey.awakening.elapsed < AWAKENING_SECONDS[journey.awakening.kind]) || oracleActing(journey) || phoneLocked(journey) || wakeCallLocked(journey) || theOneLocked(journey) || windowOpening(journey) || windowCrossing(journey) || pillLocked(journey) || lafayetteWelcomeLocked(journey) || interrogationLocked(journey) && journey.interrogation?.phase !== 'done';
  const answerPhone = phoneLocked(journey) && journey.phone?.phase === 'ready';
  const answer = answerPhone || awakeningWaiting(journey) || trainingWaiting(journey) || interrogationLocked(journey) && journey.interrogation?.phase === 'response';
  const awakeningAction = journey.awakening?.kind === 'recovery' ? '示意开始恢复肌肉 · G'
    : journey.awakening?.kind === 'construct' ? '请 Morpheus 打开电视 · G' : '请 Morpheus 继续揭示 · G';
  const trainingAction = journey.training?.kind === 'download' ? '请 Tank 开始上传 · G'
    : journey.training?.kind === 'jump' ? '请 Morpheus 示范跨楼 · G' : '开始注意力测试 · G';
  const escaped = journey.office?.outcome === 'escaped';
  const context = scene.id === 'm1_bug' && escaped ? '你成功避开了特工。接头者仍要确认车辆与乘员没有被追踪。'
    : scene.id === 'm1_wake_again' && escaped ? '安全返回之后，Morpheus 再次来电，约定桥下接头。' : scene.context;
  const decisions = scene.id === 'm1_pills' ? `<div class="film-pill-choices">${button('pill:red', '红色药丸 · 继续追查真相', !close || journey.pills?.phase === 'taking')}${button('blue', '蓝色药丸 · 回到日常生活', !close || journey.pills?.phase === 'taking')}</div><p>两种决定都会保存。蓝色药丸后仍然可以继续生活。</p>`
    : scene.id === 'm1_ledge' ? `${journey.office?.climbed !== undefined ? '<p>合上手记：W 沿梯子下降，S 向上。松开按键会抓住当前横档，到达下方维修平台才算脱身。</p>' : button('escape:climb', '抓住外侧维修梯 →', !close)}${button('escape:retreat', '退回办公室，继续被捕后的故事')}`
    : filmReflections(scene.id).map(choice => button(`reflect:${choice.id}`, choice.label, !close)).join('');
  const enemies = sandbox.threats.filter(t => t.scene === scene.id).length;
  const combatHint = scene.id === 'm1_lobby' ? '左键 / T 射击 · R 换弹 · F 近战 · X 闪避 · Q 子弹时间。警卫瞄准后及时换位，Trinity 会从侧翼掩护。' : 'F 连击 · X 闪避 · 1 治疗。';
  return `<div class="film-journal">
    <header class="film-heading"><span>THE MATRIX / 0${scene.film}</span><h3>${FILM_NAMES[scene.film]}</h3><p>${journey.completed.length} / ${FILM_SCENES.length} 段 · 第 ${life.cycle} 轮 · ${journey.finished ? '三部曲已完成' : '进度自动保存'}</p><div class="film-progress"><i style="width:${journey.completed.length / FILM_SCENES.length * 100}%"></i></div></header>
    ${journey.visiting ? `<article class="film-now"><span>回访场景</span><h3>${FILM_SETS[FILM_SCENE_BY_ID[journey.visiting].set].name}</h3><p>原来的剧情与位置已保留，可以自由走动观察。</p>${button('return', '返回正在进行的剧情 →')}</article>` : `<article class="film-now"><div class="film-scene-number">${String(FILM_SCENES.indexOf(scene) + 1).padStart(3, '0')}</div><div><span>${set.name} · ${CHARACTERS[journey.actor]?.nameCn ?? journey.actor} 视角</span><h3>${scene.id === 'm1_bug' && escaped ? '确认没有被追踪' : scene.title}</h3><p>${context}</p>
      ${!current ? button('resume', '继续保存的剧情视角 →') : ''}
      <ol class="film-objectives">${scene.steps.map((goal, i) => `<li class="${i < journey.step ? 'done' : i === journey.step ? 'current' : ''}"><b>${i < journey.step ? '✓' : String(i + 1).padStart(2, '0')}</b><span>${goal.label}</span>${i === journey.step && journey.fighting ? `<small>剩余 ${enemies} 个目标</small>` : ''}</li>`).join('')}</ol>
      ${journey.lastText ? `<p class="film-memory">${journey.lastText}</p>` : ''}
      ${journey.meeting?.phase === 'choice' ? `<div class="film-controls">${button('meeting:stay', '留在车内，接受检查')}${button('meeting:leave', '打开车门，暂时离开')}</div>` : ''}
      ${player.status !== 'alive' ? `<p>行动中断，已经完成的目标不会丢失。</p>${button('retry', '从当前目标的检查点重试')}` : ''}
      ${step && current && player.status === 'alive' ? `<div class="film-controls">${step.kind === 'reflect' ? `<p>${step.text}</p>${decisions}` : step.kind === 'reach' && !trainingLocked(journey) ? '<p>合上手记，走到金色目标标记。到达后自动记录。</p>' : scene.id === 'm1_spoon' && journey.oracle?.spoon !== undefined ? '<p>合上手记，停下脚步并按住 G。你可以看见手中的勺子逐渐弯曲；松开按键或走动会打断专注。</p>' : scene.id === 'm1_oracle' && journey.oracle?.vase !== undefined ? '<p>合上手记，留意厨房里的花瓶。事件进度已经保存。</p>' : (journey.ride?.phase === 'riding' || journey.garage?.phase === 'riding') && step.kind === 'drive' ? '<p>合上手记开始驾驶：W 加速，S 刹车，A / D 转向。护送途中会自动保存位置和车况。</p>' : journey.fighting ? `<p>${scene.id === 'm1_dojo' ? '先观察 Morpheus 的起手并按 X 闪避，再用 F 完成刺拳、直拳、正蹬。' : combatHint}</p>` : button('act', answerPhone ? '滑开手机接听 · G' : trainingWaiting(journey) ? trainingAction : awakeningWaiting(journey) ? awakeningAction : performing && !answer ? '演出进行中 · 合上手记观看' : journey.started !== undefined ? '互动进行中 · 请停留原地' : `${actionLabel} · G`, !close || performing && !answer || journey.started !== undefined)}${!close && !trainingLocked(journey) && journey.ride?.phase !== 'riding' && journey.garage?.phase !== 'riding' && journey.office?.climbed === undefined ? `<small>先走到目标旁 · ${Math.round(distance(player.position, filmStepPosition(scene, step)))} m</small>` : ''}</div>` : ''}
      ${scene.id === 'm1_ledge' && step?.kind === 'reach' && current ? button('escape:retreat', '我无法继续，退回办公室') : ''}
      ${scene.id === 'm1_office_escape' && journey.office && step ? `<p>按住 Z 潜行 · 隔间能挡住视线 · 暴露 ${Math.round(journey.office.alert)}%<br>${journey.office.guide}</p>` : ''}
      ${!step && !journey.finished ? button('next', windowCrossing(journey) ? '正在跨窗 · 合上手记观看' : FILM_SCENES.at(-1)!.id === scene.id ? '保存三部曲通关 →' : '继续下一段 →', !current || performing) : ''}
      ${journey.finished ? `<p>电影路线到这里结束。下一轮是游戏扩展：带着本轮记忆，重新过 Thomas Anderson 的生活。</p>${button('cycle', '保存记忆，开始下一轮生活 →', !current)}` : ''}
    </div></article>`}
    <section class="film-atlas"><h4>三部曲场景手记</h4><p>完成过的场景可以回访。分支未经过的场景不会冒充已经完成。</p>${([1, 2, 3] as const).map(film => `<details ${film === scene.film ? 'open' : ''}><summary>0${film} · ${FILM_NAMES[film]} <small>${FILM_SCENES.filter(s => s.film === film && journey.completed.includes(s.id)).length} / ${FILM_SCENES.filter(s => s.film === film).length}</small></summary><div class="film-atlas-grid">${FILM_SCENES.filter(s => s.film === film).map(s => `<article class="${s.id === scene.id ? 'current' : journey.completed.includes(s.id) ? 'done' : ''}"><small>${CHARACTERS[s.actor]?.nameCn ?? s.actor} · ${journey.completed.includes(s.id) ? '已经历' : s.id === scene.id ? '正在进行' : journey.skipped?.includes(s.id) ? '本轮走了另一条路线' : '尚未经历'}</small><strong>${s.title}</strong><p>${FILM_SETS[s.set].name}</p>${journey.completed.includes(s.id) ? button(`visit:${s.id}`, '回访场景 ↗', !current || Boolean(journey.fighting) || journey.ride?.phase === 'riding' || journey.garage?.phase === 'riding' || journey.office?.climbed !== undefined || performing || journey.started !== undefined) : ''}</article>`).join('')}</div></details>`).join('')}</section>
  </div>`;
}
