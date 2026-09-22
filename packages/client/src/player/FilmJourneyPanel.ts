import { FILM_SCENES, FILM_SCENE_BY_ID, FILM_SETS, FILM_NAMES, filmReflections, CHARACTERS, filmStepPosition, distance, AWAKENING_SECONDS, oracleActing, interrogationLocked, pillLocked, lafayetteWelcomeLocked, phoneLocked, windowOpening, windowCrossing, awakeningWaiting, trainingLocked, trainingWaiting, type AgentState, type SandboxState } from '@auto_matrix/shared';
import './film-journey.css';
import { meetingLocked } from '@auto_matrix/shared';
import { filmPosition, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';
import { workdayLocked } from '@auto_matrix/shared';
import { apartmentLocked } from '@auto_matrix/shared';
import { wakeCallLocked } from '@auto_matrix/shared';
import { clubLocked } from '@auto_matrix/shared';

const button = (target: string, label: string, disabled = false) => `<button data-action="life" data-target="film:${target}" ${disabled ? 'disabled' : ''}>${label}</button>`;
export function renderFilmJourney(player: AgentState, sandbox: SandboxState): string {
  const life = sandbox.neoLife!; const journey = life.journey!; const scene = FILM_SCENE_BY_ID[journey.scene];
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
  const performing = meetingLocked(journey) && !['ready', 'done', 'parked'].includes(journey.meeting?.phase ?? 'ready') || trainingLocked(journey) || Boolean(journey.awakening && journey.awakening.elapsed < AWAKENING_SECONDS[journey.awakening.kind]) || oracleActing(journey) || phoneLocked(journey) || wakeCallLocked(journey) || windowOpening(journey) || windowCrossing(journey) || pillLocked(journey) || lafayetteWelcomeLocked(journey) || interrogationLocked(journey) && journey.interrogation?.phase !== 'done';
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
      ${step && current && player.status === 'alive' ? `<div class="film-controls">${step.kind === 'reflect' ? `<p>${step.text}</p>${decisions}` : step.kind === 'reach' && !trainingLocked(journey) ? '<p>合上手记，走到金色目标标记。到达后自动记录。</p>' : scene.id === 'm1_spoon' && journey.oracle?.spoon !== undefined ? '<p>合上手记，停下脚步并按住 G。你可以看见手中的勺子逐渐弯曲；松开按键或走动会打断专注。</p>' : scene.id === 'm1_oracle' && journey.oracle?.vase !== undefined ? '<p>合上手记，留意厨房里的花瓶。事件进度已经保存。</p>' : journey.ride?.phase === 'riding' && step.kind === 'drive' ? '<p>合上手记开始驾驶：W 加速，S 刹车，A / D 转向。护送途中会自动保存位置和车况。</p>' : journey.fighting ? `<p>${scene.id === 'm1_dojo' ? '先观察 Morpheus 的起手并按 X 闪避，再用 F 完成刺拳、直拳、正蹬。' : combatHint}</p>` : button('act', answerPhone ? '滑开手机接听 · G' : trainingWaiting(journey) ? trainingAction : awakeningWaiting(journey) ? awakeningAction : performing && !answer ? '演出进行中 · 合上手记观看' : journey.started !== undefined ? '互动进行中 · 请停留原地' : `${actionLabel} · G`, !close || performing && !answer || journey.started !== undefined)}${!close && !trainingLocked(journey) && journey.ride?.phase !== 'riding' && journey.office?.climbed === undefined ? `<small>先走到目标旁 · ${Math.round(distance(player.position, filmStepPosition(scene, step)))} m</small>` : ''}</div>` : ''}
      ${scene.id === 'm1_ledge' && step?.kind === 'reach' && current ? button('escape:retreat', '我无法继续，退回办公室') : ''}
      ${scene.id === 'm1_office_escape' && journey.office && step ? `<p>按住 Z 潜行 · 隔间能挡住视线 · 暴露 ${Math.round(journey.office.alert)}%<br>${journey.office.guide}</p>` : ''}
      ${!step && !journey.finished ? button('next', windowCrossing(journey) ? '正在跨窗 · 合上手记观看' : FILM_SCENES.at(-1)!.id === scene.id ? '保存三部曲通关 →' : '继续下一段 →', !current || performing) : ''}
      ${journey.finished ? `<p>电影路线到这里结束。下一轮是游戏扩展：带着本轮记忆，重新过 Thomas Anderson 的生活。</p>${button('cycle', '保存记忆，开始下一轮生活 →', !current)}` : ''}
    </div></article>`}
    <section class="film-atlas"><h4>三部曲场景手记</h4><p>完成过的场景可以回访。分支未经过的场景不会冒充已经完成。</p>${([1, 2, 3] as const).map(film => `<details ${film === scene.film ? 'open' : ''}><summary>0${film} · ${FILM_NAMES[film]} <small>${FILM_SCENES.filter(s => s.film === film && journey.completed.includes(s.id)).length} / ${FILM_SCENES.filter(s => s.film === film).length}</small></summary><div class="film-atlas-grid">${FILM_SCENES.filter(s => s.film === film).map(s => `<article class="${s.id === scene.id ? 'current' : journey.completed.includes(s.id) ? 'done' : ''}"><small>${CHARACTERS[s.actor]?.nameCn ?? s.actor} · ${journey.completed.includes(s.id) ? '已经历' : s.id === scene.id ? '正在进行' : journey.skipped?.includes(s.id) ? '本轮走了另一条路线' : '尚未经历'}</small><strong>${s.title}</strong><p>${FILM_SETS[s.set].name}</p>${journey.completed.includes(s.id) ? button(`visit:${s.id}`, '回访场景 ↗', !current || Boolean(journey.fighting) || journey.ride?.phase === 'riding' || journey.office?.climbed !== undefined || performing || journey.started !== undefined) : ''}</article>`).join('')}</div></details>`).join('')}</section>
  </div>`;
}
