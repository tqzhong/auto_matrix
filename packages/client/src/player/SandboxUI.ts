import { CATCH, RELOADED, RELOADED_FINALE, HEL_COATCHECK, catchText, reloadedText } from '@auto_matrix/shared';
import { FILM_SETS, FILM_SCENES, FILM_SCENE_BY_ID, FILM_NAMES, filmReflections, GRID_HACK_SECONDS, GRID_REROUTE_SECONDS, HEL_ELEVATOR, HEL_DANCE_DOOR, filmStepPosition, filmStepActionReady, helElevatorLocked, helDanceDoorLocked, pillLocked, lafayetteWelcomeLocked, awakeningLocked, awakeningWaiting, AWAKENING_SECONDS, MIRROR_TOUCH, MIRROR_TIMING, mirrorGuidePose, PILL_ROOM, trainingLocked, trainingWaiting, TRAINING_SECONDS, DOJO_COMBO_WINDOW, windowOpening, windowCrossing, dockPowerOffline, ITEMS, RECIPES, SKILLS, FILMS, MISSIONS, LOCATIONS, CITY_BUILDINGS, NEO_CHAPTERS, LIFE_ACTIONS, lifeActionPosition, lifeRoomCenter, locationEntrance, distance, missionPosition, nearTransit, skillPoints,
  type AgentState, type SandboxState, type SandboxCommand, type ItemId, type SkillId, type Vector3 } from '@auto_matrix/shared';
import './sandbox.css';
import { renderNeoLife } from './NeoLifePanel.js';
import { interrogationLocked, interrogationPose } from '@auto_matrix/shared';
import { meetingBoardPoint, meetingLocked, MEETING_TIMING } from '@auto_matrix/shared';
import { filmPosition, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';
import { CHATEAU, MOUNTAIN, GARAGE, TRUCKS } from '@auto_matrix/shared';
import { workdayLocked } from '@auto_matrix/shared';
import { apartmentLocked } from '@auto_matrix/shared';
import { wakeCallLocked } from '@auto_matrix/shared';
import { clubLocked } from '@auto_matrix/shared';
import { sentinelDanger, sentinelLocked } from '@auto_matrix/shared';
import { interludeDuration, interludeLocked } from '@auto_matrix/shared';
import { oracleVisitDuration, oracleVisitLocked } from '@auto_matrix/shared';
import { BETRAYAL, betrayalDuration, betrayalLocked } from '@auto_matrix/shared';
import { RESCUE, rescueDuration, rescueLoadout, rescueLocked } from '@auto_matrix/shared';
import { LOBBY_ENTRY, lobbyLocked } from '@auto_matrix/shared';
import { GOVERNMENT_RESCUE, governmentLocked, governmentText } from '@auto_matrix/shared';
import { AIR_RESCUE, airRescueLocked, airRescueText } from '@auto_matrix/shared';
import { MATRIX_ESCAPE, matrixEscapeDuration, matrixEscapeLocked, matrixEscapeText } from '@auto_matrix/shared';
import { THE_ONE, theOneDuration, theOneLocked, theOneText } from '@auto_matrix/shared';
import { BURLY } from '@auto_matrix/shared';
import { BANE_ENCOUNTER } from '@auto_matrix/shared';

const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const WEATHER = { clear: '晴朗', rain: '雨', code_storm: '代码风暴' };
type Panel = 'inventory' | 'journal' | 'map';

export class SandboxUI {
  private root = document.createElement('div');
  private player?: AgentState;
  private state?: SandboxState;
  private tick = 0;
  private time = 7500;
  private panel: Panel | null = null;
  private signature = '';
  private selectedFilm = 1;
  private nearest = '';
  private previousFilmScene?: string;
  private waypoint: { position: Vector3; matrix: boolean; name: string } | null = null;

  constructor(private send: (command: SandboxCommand) => void, private menu: (open: boolean) => void,
    private combat: (kind: 'attack' | 'dodge', combo?: number) => void, private desertPreview: () => string | undefined) {
    this.root.id = 'sandbox-overlay'; this.root.className = 'hidden';
    this.root.innerHTML = `
      <div id="film-blackout" class="film-blackout" aria-hidden="true"></div>
      <div class="sandbox-clock"><span id="sandbox-clock"></span><span id="sandbox-weather"></span><span id="sandbox-trace"></span></div>
      <nav class="sandbox-nav" aria-label="沙盒玩法"><button data-panel="inventory"><kbd>B</kbd> 背包与制作</button><button data-panel="journal"><kbd>J</kbd> 三部曲日志</button><button data-panel="map"><kbd>M</kbd> 世界地图</button></nav>
      <div id="sandbox-waypoint" class="sandbox-waypoint"></div>
      <div id="film-phone" class="film-phone hidden"><span>SECURE LINE / MORPHEUS</span><p id="film-phone-line"></p><div><i id="film-alert"></i></div><small id="film-alert-label"></small></div>
      <div id="film-sequence" class="film-sequence hidden"><p id="film-sequence-line"></p><small id="film-sequence-hint">鼠标观察 · V 切换视角 · J 手记</small></div>
      <div id="film-training-actions" class="film-training-actions hidden"><button data-combat="dodge"><kbd>X</kbd> 现在闪避</button><button data-combat="attack"><kbd>F</kbd> <span>刺拳</span></button></div>
      <div id="film-pills" class="film-pills hidden" role="group" aria-label="选择药丸"><p>选择仍然属于你</p><div class="film-pill-choices"><button data-action="life" data-target="film:pill:red">红色 · 继续追问</button><button data-action="life" data-target="film:blue">蓝色 · 回到日常</button></div></div>
      <div id="film-meeting" class="film-pills hidden" role="group" aria-label="接头决定"><p>你仍然可以离开</p><div class="film-pill-choices"><button data-action="life" data-target="film:meeting:stay">留在车内 · 接受检查</button><button data-action="life" data-target="film:meeting:leave">推开车门 · 质疑检查</button></div></div>
      <div id="film-meeting-door" class="film-pills hidden" role="group" aria-label="车门前的选择"><p>Trinity 请你想清楚，再决定去留</p><div class="film-pill-choices"><button data-action="life" data-target="film:meeting:stay">信任她 · 关上车门</button><button data-action="life" data-target="film:meeting:depart">离开 · 返回雨中</button></div></div>
      <div id="film-construct-reflection" class="film-pills film-construct-reflection hidden" role="group" aria-label="Neo 对现实的理解"><p>感觉足以证明真实吗？</p><div class="film-pill-choices">${filmReflections('m1_construct').map(choice => `<button data-action="life" data-target="film:reflect:${choice.id}">${escape(choice.label)}</button>`).join('')}</div></div>
      <div id="film-ride" class="film-ride hidden" role="status"><span id="film-ride-title">TRINITY / KEYMAKER</span><strong id="film-ride-speed"></strong><p id="film-ride-health"></p><small id="film-ride-controls">W 加速 · S 刹车 · A / D 转向</small></div>
      <div id="sandbox-interact" class="sandbox-interact hidden"><button data-action="interact"><kbd>G</kbd> <span id="sandbox-nearby"></span></button><div id="sandbox-job"></div></div>
      <div class="sandbox-hotbar" aria-label="物品快捷栏">${(['medkit', 'emp', 'beacon', 'barricade'] as const).map((id, i) => `<button data-action="${i < 2 ? 'use' : 'build'}" data-target="${id}" title="${ITEMS[id].description}"><kbd>${i + 1}</kbd><span class="slot-symbol">${ITEMS[id].symbol}</span><span>${ITEMS[id].name}</span><b id="count-${id}">0</b></button>`).join('')}</div>
      <section id="sandbox-panel" class="sandbox-panel hidden" role="dialog" aria-modal="true" aria-label="沙盒菜单"><div class="sandbox-window">
        <header><div><span class="eyebrow">YOUR LIFE INSIDE THE MATRIX</span><h2 id="sandbox-panel-title"></h2><p>世界仍在运行。附近有追兵时，请先寻找安全位置。</p></div><button data-close aria-label="关闭沙盒菜单">×</button></header>
        <nav><button data-panel="inventory">背包与制作</button><button data-panel="journal">三部曲日志</button><button data-panel="map">世界地图</button></nav>
        <div id="sandbox-panel-body" class="sandbox-panel-body"></div>
        <footer><span id="sandbox-profile"></span><span>Esc 返回世界 · Tab 切换角色</span></footer>
      </div></section>`;
    document.body.appendChild(this.root);
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-close')) { this.close(); return; }
      if (button.dataset.panel) { this.open(button.dataset.panel as Panel); return; }
      if (button.dataset.film) { this.selectedFilm = Number(button.dataset.film); this.signature = ''; this.renderPanel(); return; }
      if (button.dataset.combat) {
        const kind = button.dataset.combat as 'attack' | 'dodge';
        this.combat(kind, kind === 'attack' ? this.state?.neoLife?.journey?.dojo?.combo : undefined); return;
      }
      if (button.dataset.waypoint) {
        const node = this.state?.nodes.find(n => n.id === button.dataset.waypoint) ?? this.state?.incidents.find(n => n.id === button.dataset.waypoint);
        if (node) this.waypoint = { position: node.position, matrix: node.matrix, name: node.name };
        this.close(); return;
      }
      if (!button.dataset.action) return;
      if (button.dataset.action === 'interact' && !button.dataset.target && (this.player?.id === 'neo' || this.player?.id === this.state?.neoLife?.journey?.actor) && this.state?.neoLife) { this.interact(); return; }
      if (button.dataset.action === 'track') this.waypoint = null;
      this.send({ kind: button.dataset.action as SandboxCommand['kind'], target: button.dataset.target ?? (button.dataset.action === 'interact' ? this.nearest : undefined) });
      if (button.dataset.action === 'life' && (button.dataset.target?.startsWith('film:') || button.dataset.target?.startsWith('go:') || LIFE_ACTIONS.some(a => a.id === button.dataset.target))) this.close();
      if (button.dataset.action === 'interact' && (this.player?.id === 'neo' || this.player?.id === this.state?.neoLife?.journey?.actor) && this.state?.neoLife) this.close();
      if (['build', 'transit', 'track'].includes(button.dataset.action)) this.close();
    });
  }
  private el(id: string): HTMLElement { return this.root.querySelector(`#${id}`)!; }
  open(panel: Panel): void {
    if (!this.player || !this.state) return;
    if (panel === 'journal' && this.panel !== 'journal') this.selectedFilm = MISSIONS.find(m => m.id === this.state!.profiles[this.player!.id].trackedMission)?.film ?? this.selectedFilm;
    this.panel = panel; this.signature = ''; this.menu(true);
    if (document.pointerLockElement) document.exitPointerLock();
    this.el('sandbox-panel').classList.remove('hidden');
    this.renderPanel();
  }
  toggle(panel: Panel): void { if (this.panel === panel) this.close(); else this.open(panel); }
  interact(): void {
    const journey = this.state?.neoLife?.journey;
    if (journey && journey.actor === this.player?.id) {
      const step = FILM_SCENE_BY_ID[journey.scene].steps[journey.step];
      if (journey.visiting || step?.kind === 'reflect' || journey.scene === 'm2_persephone' && journey.step === 2 || journey.finished) this.open('journal');
      else this.send({ kind: 'life', target: `film:${step ? 'act' : 'next'}` });
      return;
    }
    if ((this.player?.id === 'neo' || this.player?.id === this.state?.neoLife?.journey?.actor) && this.state?.neoLife) { this.open('journal'); return; }
    const node = this.state?.nodes.find(n => n.id === this.nearest);
    if (node?.kind === 'phone') { this.open('map'); return; }
    this.send({ kind: 'interact', target: this.nearest || undefined });
  }
  close(): boolean {
    if (!this.panel) return false;
    this.panel = null; this.el('sandbox-panel').classList.add('hidden'); this.menu(false); return true;
  }
  update(player: AgentState | undefined, state: SandboxState | undefined, time: number, tick: number, day?: number): void {
    if (player?.id === 'neo' && state?.neoLife) state = { ...state, missions: state.neoLife.missions };
    if (player?.id !== this.player?.id) { this.close(); this.waypoint = null; }
    this.player = player; this.state = state; this.tick = tick; this.time = time;
    const profile = player ? state?.profiles[player.id] : undefined;
    this.root.classList.toggle('hidden', !player || !state || !profile);
    this.el('film-phone').classList.add('hidden');
    this.el('film-sequence').classList.add('hidden');
    this.el('film-sequence').classList.remove('urgent');
    this.el('film-training-actions').classList.add('hidden');
    this.el('film-ride').classList.add('hidden');
    this.el('film-pills').classList.add('hidden');
    this.el('film-meeting').classList.add('hidden');
    this.el('film-meeting-door').classList.add('hidden');
    this.el('film-construct-reflection').classList.add('hidden');
    this.el('film-blackout').style.opacity = '0';
    if (!player || !state || !profile) return;
    const life = player.id === 'neo' || player.id === state.neoLife?.journey?.actor ? state.neoLife : undefined;
    const baseChapter = life ? NEO_CHAPTERS[life.chapter] : undefined;
    const chapter = life?.chapter === 1 && life.contactSignal ? { ...baseChapter!, location: 'neo_apartment',
      title: life.deferredContact ? '白兔的邀请还在' : '电脑中的陌生信号',
      objective: life.deferredContact ? '可以继续普通生活，或回家打开 J 手记，继续已保存的邀请。' : '回家核对电脑上的匿名信号。J 查看生活手记。' } : baseChapter;
    this.root.querySelectorAll<HTMLButtonElement>('[data-panel="journal"]').forEach(button => { button.innerHTML = `<kbd>J</kbd> ${life ? '生活与故事手记' : '三部曲日志'}`; });
    const hour = Math.floor(time / 1000); const minute = Math.floor(time % 1000 * .06);
    const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    this.el('sandbox-clock').textContent = `第 ${life?.day ?? day ?? Math.floor((21000 + tick * 12) / 24000) + 1} 天 · ${clock}`;
    const panelClock = this.root.querySelector('#life-panel-clock'); if (panelClock) panelClock.textContent = clock;
    this.el('sandbox-weather').textContent = WEATHER[state.weather];
    this.el('sandbox-trace').textContent = life && !player.isAwakened ? `$${life.money} · 饱腹 ${Math.round(life.satiety)}` : `追踪 ${Math.round(profile.trace)}%`;
    this.el('sandbox-trace').classList.toggle('danger', profile.trace >= 60);
    for (const id of ['medkit', 'emp', 'beacon', 'barricade'] as const) this.el(`count-${id}`).textContent = String(profile.inventory[id]);
    const nearest = [...state.nodes, ...state.incidents].filter(n => n.matrix === player.isInMatrix && distance(n.position, player.position) < 14
      && !(n.kind === 'mission' && ['locked', 'complete'].includes(state.missions[n.id.slice(8)]?.status)))
      .sort((a, b) => distance(a.position, player.position) - (a.id === `mission:${profile.trackedMission}` ? 5 : 0)
        - distance(b.position, player.position) + (b.id === `mission:${profile.trackedMission}` ? 5 : 0))[0];
    this.nearest = nearest?.id ?? '';
    this.el('sandbox-interact').classList.toggle('hidden', !nearest && !profile.job);
    this.el('sandbox-nearby').textContent = profile.job ? '正在破解 · 移动将中断' : nearest ? `${nearest.name}${'availableAt' in nearest && nearest.availableAt > tick ? ` · ${Math.ceil((nearest.availableAt - tick) / 2)} 秒后恢复` : ''}` : '';
    this.el('sandbox-job').style.width = profile.job ? `${Math.min(100, (tick - profile.job.startedAt) / (profile.job.endsAt - profile.job.startedAt) * 100)}%` : '0';
    if (life?.journey) { this.updateFilm(player, state); this.drawMinimap(); this.renderPanel(); return; }
    if (life && chapter) {
      const nearbyLife = LIFE_ACTIONS.find(a => a.location && player.isInMatrix && distance(player.position, lifeActionPosition(a)) < 10);
      const storyPosition = chapter.mission ? missionPosition(chapter.mission) : lifeRoomCenter(chapter.location) ?? locationEntrance(chapter.location);
      const nearStory = life.chapter > 0 && player.isInMatrix === (LOCATIONS[chapter.location].world === 'matrix') && distance(player.position, storyPosition) < 16;
      this.el('sandbox-interact').classList.toggle('hidden', !nearbyLife && !nearStory && !life.anomaly && !life.activity);
      this.el('sandbox-nearby').textContent = life.activity ? `${LIFE_ACTIONS.find(a => a.id === life.activity!.id)?.name} · 正在进行` : life.anomaly ? '注意到一处异常 · 打开手记' : nearStory ? `${chapter.title} · 交谈 / 行动` : '安排这里的日常活动';
      this.el('sandbox-job').style.width = life.activity ? `${Math.min(100, (tick - life.activity.startedAt) / (life.activity.endsAt - life.activity.startedAt) * 100)}%` : '0';
      const objective = document.getElementById('game-objective')!;
      objective.textContent = chapter.title;
      document.getElementById('game-objective-copy')!.textContent = life.anomaly ? '有一件事似乎不太对。J 打开手记，决定是否追查。' : chapter.objective;
    }
    const mission = MISSIONS.find(m => m.id === profile.trackedMission);
    const escort = state.missions[chapter?.mission ?? profile.trackedMission]?.escort;
    const target = escort ? { position: escort.position, matrix: true, name: '钥匙匠 · 留在 32 米内' } : this.waypoint ?? (chapter && life?.chapter ? { position: chapter.mission ? missionPosition(chapter.mission) : lifeRoomCenter(chapter.location) ?? locationEntrance(chapter.location), matrix: LOCATIONS[chapter.location].world === 'matrix', name: chapter.title } : mission ? { position: missionPosition(mission.id), matrix: LOCATIONS[mission.location].world === 'matrix', name: mission.name } : null);
    if (target) {
      const direction = Math.atan2(target.position.x - player.position.x, target.position.z - player.position.z) - player.rotation;
      this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${escape(target.name)} <b>${target.matrix === player.isInMatrix ? `${Math.round(distance(target.position, player.position))} m` : '跨世界 · 经电话接入'}</b>`;
    } else this.el('sandbox-waypoint').textContent = '自由探索 · 世界故事仍在继续';
    if (mission) {
      document.getElementById('game-objective')!.textContent = mission.name;
      const progress = state.missions[mission.id];
      document.getElementById('game-objective-copy')!.textContent = progress.escort
        ? `护送 ${progress.progress}% · 钥匙匠生命 ${progress.escort.health} · 留在 32 米内`
        : progress.stage === 'combat' ? `剩余敌人 ${state.threats.filter(t => t.mission === mission.id).length} · F 攻击 / 1 治疗 / 2 EMP` : mission.objective;
    }
    this.drawMinimap(); this.renderPanel();
  }

  private updateFilm(player: AgentState, state: SandboxState): void {
    const journey = state.neoLife!.journey!; const scene = FILM_SCENE_BY_ID[journey.scene]; const step = scene.steps[journey.step];
    const escapedScan = scene.id === 'm1_bug' && journey.office?.outcome === 'escaped';
    const stepLabel = escapedScan ? ['配合安全扫描', '重新判断今晚的接头', step?.label][journey.step] : step?.label;
    const bridgeDoor = scene.id === 'm1_bridge' && journey.step === 1 && journey.bridgeArrival?.parkedRoadTime !== undefined
      ? meetingBoardPoint(journey.bridgeArrival) : undefined;
    const stepTarget = bridgeDoor ? filmPosition(scene.set, bridgeDoor.x, bridgeDoor.z)
      : scene.id === 'm1_bug' && journey.step === 1 && journey.meeting?.phase === 'done' ? player.position
        : step ? filmStepPosition(scene, step) : undefined;
    const blackout = this.el('film-blackout');
    if (!journey.visiting) {
      if (this.previousFilmScene === 'm1_mirror' && scene.id === 'm1_pod') blackout.classList.add('pod-reveal');
      if (this.previousFilmScene === 'm1_construct' && scene.id === 'm1_desert') {
        const image = this.desertPreview();
        blackout.style.backgroundImage = image ? `url("${image}")` : '';
        blackout.classList.add('desert-reveal');
      }
      if (scene.id !== 'm1_pod') blackout.classList.remove('pod-reveal');
      if (scene.id !== 'm1_desert') { blackout.classList.remove('desert-reveal'); blackout.style.backgroundImage = ''; }
      this.previousFilmScene = scene.id;
      if (scene.id === 'm1_mirror' && journey.awakening?.kind === 'mirror')
        blackout.style.opacity = String(Math.min(.96, Math.max(0, (journey.awakening.elapsed - MIRROR_TIMING.fade) / (AWAKENING_SECONDS.mirror - MIRROR_TIMING.fade))));
    }
    const set = FILM_SETS[journey.visiting ? FILM_SCENE_BY_ID[journey.visiting].set : scene.set];
    const shown = journey.visiting ? FILM_SCENE_BY_ID[journey.visiting] : scene;
    this.el('sandbox-clock').textContent = `${FILM_NAMES[shown.film]} · 第 ${FILM_SCENES.indexOf(shown) + 1} 段`;
    this.el('sandbox-weather').textContent = set.world === 'real' ? '真实世界' : ({ day: '日间', night: '夜间', warm: '室内', cold: '室内', white: '程序空间', storm: '暴雨', sunrise: '日出' })[set.light];
    this.el('sandbox-interact').classList.toggle('hidden', Boolean(step && !journey.visiting && !journey.finished
      && !(bridgeDoor || scene.id === 'm1_bug' && journey.step === 1 && journey.meeting?.phase === 'done'
        ? player.isInMatrix && distance(player.position, stepTarget!) <= 4 : filmStepActionReady(scene, step, player.position, player.isInMatrix))));
    this.el('sandbox-nearby').textContent = journey.visiting ? '回访场景 · J 返回剧情' : journey.finished ? '三部曲已完成 · 查看手记' : !step ? '场景完成 · 继续下一段' : step.kind === 'reflect' ? '打开手记，记录反思' : journey.fighting ? `战斗中 · 剩余 ${state.threats.filter(t => t.scene === scene.id).length}` : stepLabel!;
    this.el('sandbox-job').style.width = journey.started !== undefined && step ? `${Math.min(100, (this.tick - journey.started) / ((step.seconds ?? 3) * 2) * 100)}%` : '0';
    document.getElementById('game-objective')!.textContent = journey.visiting ? set.name : escapedScan ? '确认没有被追踪'
      : scene.id === 'm1_wake_again' && journey.office?.outcome === 'escaped' ? '第二次来电' : scene.title;
    document.getElementById('game-objective-copy')!.textContent = journey.visiting ? '自由走动，J 返回保存的剧情位置。' : scene.id === 'm3_dock_battle' && journey.dockGunnery?.phase === 'failed' ? 'APU 防线失守 · 从剧情检查点重试' : journey.fighting ? 'F 连击 · X 闪避 · 1 治疗 · 击败追兵后继续' : step ? `${journey.step + 1}/${scene.steps.length} · ${stepLabel} · ${step.kind === 'reach' ? '走到标记旁' : step.kind === 'reflect' ? '靠近后按 J 记录反思' : '靠近后按 G'}` : 'G 继续下一段，J 查看刚刚发生的事。';
    if (!journey.visiting && scene.id === 'm1_bridge' && journey.bridgeTail) {
      const tail = journey.bridgeTail; const failed = tail.phase === 'failed';
      this.el('sandbox-trace').textContent = tail.phase === 'evaded' ? '已甩开尾随' : `尾随警戒 ${Math.round(tail.alert)}%`;
      this.el('sandbox-trace').classList.toggle('danger', tail.alert >= 60 || failed);
      if (tail.alert >= 35 || tail.phase !== 'tracking') {
        this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', tail.alert >= 60 || failed);
        this.el('film-sequence-line').textContent = journey.lastText;
        this.el('film-sequence-hint').textContent = failed ? 'J 手记 · 从桥下入口重试' : tail.phase === 'evaded' ? '追踪器仍在 · 到车内接受检查' : '继续靠近右后车门 · 不要停在桥下';
      }
      if (failed) {
        this.el('sandbox-interact').classList.add('hidden'); this.el('sandbox-waypoint').textContent = '';
        document.getElementById('game-objective-copy')!.textContent = '被追踪特工拦住 · J 打开手记重试'; return;
      }
    }
    if (!journey.visiting && scene.id === 'm1_room303' && journey.openingHotel) {
      const hotel = journey.openingHotel; const failed = hotel.phase === 'failed';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', failed || hotel.phase === 'combat');
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = failed ? 'J 手记 · 从破门检查点重试'
        : hotel.phase === 'combat' ? hotel.disarmed ? `四警员突围 · 弹匣 ${hotel.ammo}/8 · 左键 / T 开火 · R 换弹 · X 闪避` : hotel.fallen ? '靠近落枪位置按 G 夺枪 · F 反击 · X 闪避' : 'F 击倒近身警员 · X 闪避枪线'
          : hotel.phase === 'breach' ? '房门被撞开 · 正在进入突围' : hotel.phase === 'dive' ? '穿窗而出 · 进度自动保存' : hotel.phase === 'ladder_ready' ? '按 G 抓住消防梯' : hotel.phase === 'climbing' ? '按 W 向上攀爬 · S 可退回' : '按 G 完成当前互动';
      document.getElementById('game-objective-copy')!.textContent = failed ? '突围失败 · J 打开手记重试' : this.el('film-sequence-hint').textContent;
    }
    if (!journey.visiting && scene.id === 'm1_roofs' && journey.openingRoof) {
      const failed = journey.openingRoof.phase === 'failed';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', failed);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = failed ? 'J 手记 · 从屋顶入口重试' : journey.openingRoof.leap ? 'Brown 正跃过楼间空隙 · 继续奔跑' : 'Brown 在身后 · Shift 助跑 · 空格越过楼间空隙';
      if (failed) document.getElementById('game-objective-copy')!.textContent = '撤离失败 · J 打开手记重试';
    }
    if (!journey.visiting && scene.id === 'm1_phone_escape' && journey.openingPhone) {
      const phone = journey.openingPhone; const failed = phone.phase === 'failed';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', failed || phone.phase === 'running' && phone.remaining < 5);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phone.phase === 'running' ? `卡车撞击前 ${phone.remaining.toFixed(1)} 秒 · Shift 奔跑 · 到电话亭按 G`
        : failed ? '电话亭已毁 · J 手记重试' : phone.phase === 'connected' ? '连接成功 · 卡车正在撞击' : 'Trinity 已安全撤离 · G 继续';
      document.getElementById('game-objective-copy')!.textContent = failed ? '线路中断 · J 打开手记重试'
        : phone.phase === 'running' ? `卡车将在 ${phone.remaining.toFixed(1)} 秒后撞击电话亭` : 'Trinity 已断开连接';
    }
    if (helElevatorLocked(journey)) {
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = `井道下降中 · ${Math.round(journey.helElevator!.elapsed / HEL_ELEVATOR.seconds * 100)}% · 到站后前门打开`;
      document.getElementById('game-objective-copy')!.textContent = '铁笼下降中 · 到站后前门打开 · 当前进度自动保存';
      this.el('sandbox-waypoint').textContent = '↓ CLUB HEL';
      this.el('sandbox-interact').classList.add('hidden');
      return;
    }
    if (helDanceDoorLocked(journey)) {
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = `推开舞池重门 · ${Math.round(journey.helDanceDoor!.elapsed / HEL_DANCE_DOOR.seconds * 100)}% · 门后是人群与 VIP 高台`;
      document.getElementById('game-objective-copy')!.textContent = '正在推开重门 · 当前动作自动保存 · 可以转动视角观察';
      this.el('sandbox-waypoint').textContent = '→ CLUB HEL';
      this.el('sandbox-interact').classList.add('hidden');
      return;
    }
    if (!journey.visiting && scene.id === 'm3_hel_entry' && journey.fighting && journey.helCoatcheck?.phase === 'combat') {
      const coatcheck = journey.helCoatcheck;
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = `衣帽间 ${coatcheck.kills}/5 · 第 ${coatcheck.wave} 组 · 弹匣 ${coatcheck.ammo}/${HEL_COATCHECK.magazine}${coatcheck.reloadAt !== undefined ? ' · 换弹中' : ''}`;
      document.getElementById('game-objective-copy')!.textContent = '左键 / T 射击 · R 换弹 · X 闪避 · 柜台可挡子弹 · Morpheus / Seraph 掩护';
      this.el('sandbox-interact').classList.add('hidden');
      return;
    }
    if (!journey.visiting && scene.id === 'm3_bane' && journey.bane) {
      const bane = journey.bane; const phase = bane.phase;
      const window = phase === 'gun_window' ? BANE_ENCOUNTER.gunWindow : phase === 'pipe_window' ? BANE_ENCOUNTER.pipeWindow
        : phase === 'grapple' ? BANE_ENCOUNTER.grappleWindow : phase === 'counter' ? BANE_ENCOUNTER.counterWindow : 0;
      const hint = phase === 'ready' ? journey.step === 0 ? 'WASD 穿过驾驶舱，去找 Trinity' : '靠近 Bane 按 G；现实世界无法使用矩阵能力'
        : phase === 'gun_warning' ? '保险丝即将切断 · 等电枪闪光后按 X'
          : phase === 'gun_window' ? `电枪射线 · 现在按 X · 剩余 ${(window - bane.elapsed).toFixed(1)} 秒`
            : phase === 'grapple' ? `WASD 靠近 Bane · F 还击 ${bane.hits}/2 · 剩余 ${(window - bane.elapsed).toFixed(1)} 秒`
              : phase === 'burning' ? '电缆灼伤双眼 · 这一伤会保留到后续剧情'
                : phase === 'blind' ? `按住 G 辨认金色信号 · ${Math.round(bane.focus / BANE_ENCOUNTER.focusSeconds * 100)}%`
                  : phase === 'pipe_window' ? `金色 Smith 举起铁管 · 现在按 X · 剩余 ${(window - bane.elapsed).toFixed(1)} 秒`
                    : phase === 'counter' ? `面向金色轮廓靠近，按 F 反击 ${bane.counters}/2 · 剩余 ${(window - bane.elapsed).toFixed(1)} 秒`
                      : phase === 'failed' ? `本次失败 · J 手记从${bane.checkpoint === 'blind' ? '失明后' : '断电前'}检查点重试`
                        : journey.step === 2 ? 'Bane 已倒下 · 到舱口按 G 救出 Trinity' : '舱口已打开 · G 继续';
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', Boolean(window) || phase === 'failed');
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = hint;
      this.el('sandbox-trace').textContent = phase === 'blind' ? `金色感知 ${Math.round(bane.focus / BANE_ENCOUNTER.focusSeconds * 100)}%`
        : window ? `危险窗口 ${Math.max(0, window - bane.elapsed).toFixed(1)} 秒` : 'Logos · 工程舱';
      this.el('sandbox-trace').classList.toggle('danger', Boolean(window) || phase === 'failed');
      this.el('sandbox-interact').classList.toggle('hidden', !['ready', 'defeated'].includes(phase)
        || Boolean(step && distance(player.position, filmStepPosition(scene, step)) > 4));
      this.el('sandbox-nearby').textContent = phase === 'defeated' ? journey.step === 2 ? '打开舱口 · 救出 Trinity' : '继续航程' : step?.label ?? '继续';
      const actions = this.el('film-training-actions');
      const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!;
      const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      if (['gun_window', 'pipe_window', 'grapple', 'counter'].includes(phase)) {
        actions.classList.remove('hidden');
        dodge.classList.toggle('hidden', !['gun_window', 'pipe_window'].includes(phase)); dodge.disabled = !['gun_window', 'pipe_window'].includes(phase);
        attack.classList.toggle('hidden', !['grapple', 'counter'].includes(phase)); attack.disabled = !['grapple', 'counter'].includes(phase);
        attack.querySelector('span')!.textContent = phase === 'counter' ? '反击轮廓' : '近身还击';
      }
      this.el('sandbox-job').style.width = phase === 'blind' ? `${bane.focus / BANE_ENCOUNTER.focusSeconds * 100}%`
        : window ? `${Math.max(0, (window - bane.elapsed) / window * 100)}%` : '0';
      document.getElementById('game-objective-copy')!.textContent = hint;
      return;
    }
    if (!journey.visiting && scene.id === 'm3_hel_bargain' && journey.helBargain) {
      const bargain = journey.helBargain; const phase = bargain.phase;
      const window = phase === 'evade' ? 3 : phase === 'counter' ? 2.4 : phase === 'airborne' ? 2.8 : 0;
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', phase === 'failed' || Boolean(window));
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'windup' ? '守卫正在起手 · 看准动作后按 X'
        : phase === 'evade' ? `X 闪避 · ${(window - bargain.elapsed).toFixed(1)} 秒`
          : phase === 'counter' ? `面朝高台按 F 反击 · ${(window - bargain.elapsed).toFixed(1)} 秒`
              : phase === 'airborne' ? `盯住飞来的枪，靠近后按 G 接住 · ${(window - bargain.elapsed).toFixed(1)} 秒`
              : phase === 'failed' ? 'J 打开手记 · 从突围前重试' : '按当前目标行动 · 进度自动保存';
      this.el('sandbox-trace').textContent = window ? `包围圈 ${Math.max(0, window - bargain.elapsed).toFixed(1)} 秒` : 'Club Hel · 舞池与 VIP 高台';
      this.el('sandbox-trace').classList.toggle('danger', phase === 'failed' || Boolean(window));
      this.el('sandbox-interact').classList.toggle('hidden', ['windup', 'evade', 'counter', 'failed'].includes(phase) || step?.kind === 'reflect');
      const actions = this.el('film-training-actions');
      if (phase === 'evade' || phase === 'counter') {
        actions.classList.remove('hidden');
        const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!;
        const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
        dodge.classList.toggle('hidden', phase !== 'evade'); dodge.disabled = phase !== 'evade';
        attack.classList.toggle('hidden', phase !== 'counter'); attack.disabled = phase !== 'counter';
        attack.querySelector('span')!.textContent = '打开缺口';
      }
      document.getElementById('game-objective-copy')!.textContent = phase === 'failed' ? '包围圈已合拢 · J 打开手记重试'
        : phase === 'windup' ? '观察守卫起手 · 等拳锋逼近再按 X'
          : phase === 'evade' ? '现在按 X 闪避'
            : phase === 'counter' ? '面朝 VIP 高台按 F 反击'
              : phase === 'airborne' ? '靠近飞来的枪，按 G 接住'
                : phase === 'gunpoint' ? '靠近并面朝 Merovingian，按 G 逼他放人'
                  : step?.kind === 'reflect' ? 'J 打开手记，决定如何拒绝交换' : step ? `${step.label} · 走近按 G` : 'Mero 已让 Trainman 接回 Neo · G 继续';
      return;
    }
    if (!journey.visiting && journey.grid && ['m2_plan', 'm2_power', 'm2_vigilant', 'm2_backup', 'm2_key_door'].includes(scene.id)) {
      const grid = journey.grid;
      const clock = `${Math.floor(Math.ceil(grid.remaining) / 60)}:${String(Math.ceil(grid.remaining) % 60).padStart(2, '0')}`;
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', grid.phase === 'expired' || grid.phase === 'window' && grid.remaining < 60);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = grid.phase === 'window' ? `连接窗口 ${clock} · Neo 与钥匙匠必须赶到白门`
        : grid.phase === 'emergency' ? `应急系统已接管 · Trinity 覆盖进度 ${Math.round((1 - (grid.hackRemaining ?? GRID_HACK_SECONDS) / GRID_HACK_SECONDS) * 100)}%`
        : grid.phase === 'expired' ? '窗口关闭 · 走到白门前按 G 联系剩余队伍改线'
          : grid.phase === 'rerouting' ? `Link / Niobe / Trinity 改线 ${Math.ceil(GRID_REROUTE_SECONDS - grid.reroute)} 秒 · 等待恢复`
            : grid.phase === 'opened' ? '白门已打开 · 钥匙匠的任务已完成'
              : 'Niobe 设定主网装置 · Vigilant 负责应急系统 · Trinity 待命';
      this.el('sandbox-trace').textContent = grid.phase === 'window' ? `连接窗口 ${clock}` : `主网 ${grid.primary === 'online' ? '在线' : grid.primary === 'armed' ? '已武装' : '离线'} · 应急 ${grid.emergency === 'online' ? '在线' : '离线'}`;
      this.el('sandbox-trace').classList.toggle('danger', grid.phase === 'expired' || grid.phase === 'window' && grid.remaining < 60);
      if (scene.id === 'm2_key_door' && grid.phase === 'expired' && [3, 5].includes(journey.step)) {
        this.el('sandbox-nearby').textContent = '联系队伍改线';
        document.getElementById('game-objective-copy')!.textContent = '门户已重新受保护 · 走近当前目标，按 G 让 Link 联系 Niobe 与 Trinity';
      }
      if (grid.phase === 'rerouting') {
        this.el('sandbox-interact').classList.add('hidden');
        this.el('sandbox-job').style.width = `${grid.reroute / GRID_REROUTE_SECONDS * 100}%`;
        document.getElementById('game-objective-copy')!.textContent = 'Link 正与两队重设时序 · 完成后再拿钥匙开门';
      }
    }
    if (!journey.visiting && scene.id === 'm2_architect' && journey.architect) {
      const encounter = journey.architect;
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', encounter.phase === 'failed' || encounter.phase === 'decision' && encounter.remaining < 15);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = encounter.phase === 'failed' ? 'J 打开手记，从抉择检查点重试'
        : encounter.phase === 'decision' ? `Trinity 信号 ${Math.ceil(encounter.remaining)} 秒 · 左门返回矩阵`
          : encounter.phase === 'done' ? '左门已打开 · 赶往 Trinity 坠落处'
            : encounter.trinityReviewed ? '右门返回源头 · 左门返回矩阵 · 先记录你的理解'
              : encounter.sourceReviewed ? '源头门的代价已知 · 去查看另一块实时影像'
                : '这些屏幕为什么会同时显示 Neo？先听建筑师解释';
      this.el('sandbox-trace').textContent = encounter.phase === 'decision' || encounter.phase === 'failed'
        ? `Trinity 信号 ${Math.ceil(encounter.remaining)} 秒` : '第六次异常 · 两扇门';
      this.el('sandbox-trace').classList.toggle('danger', encounter.phase === 'failed' || encounter.phase === 'decision' && encounter.remaining < 15);
      if (encounter.phase === 'failed') {
        this.el('sandbox-interact').classList.add('hidden');
        document.getElementById('game-objective-copy')!.textContent = '信号窗口中断 · 按 J 打开手记并重试当前检查点';
      }
    }
    if (!journey.visiting && scene.id === 'm2_catch' && journey.catch) {
      const encounter = journey.catch;
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', encounter.phase === 'failed' || encounter.phase === 'flight' && CATCH.impact - encounter.elapsed < 2);
      this.el('film-sequence-line').textContent = catchText(encounter);
      this.el('film-sequence-hint').textContent = encounter.phase === 'flight' ? `落地前 ${Math.max(0, CATCH.impact - encounter.elapsed).toFixed(1)} 秒 · 距离 ${Math.hypot(encounter.x - CATCH.trinity.x, encounter.z - CATCH.trinity.z).toFixed(1)} 米`
        : encounter.phase === 'extracting' ? `代码聚焦 ${Math.round(encounter.focus / CATCH.extraction * 100)}% · 按住 G`
          : encounter.phase === 'pulse' ? `心跳 ${encounter.beats}/3 · 误按 ${encounter.misses}/3 · 光圈收拢时按 F`
            : encounter.phase === 'failed' ? 'J 打开手记重试检查点' : '跟随当前剧情提示行动';
      this.el('sandbox-trace').textContent = encounter.phase === 'flight' ? `坠落 ${Math.max(0, CATCH.impact - encounter.elapsed).toFixed(1)} 秒`
        : encounter.phase === 'pulse' || encounter.phase === 'failed' && encounter.checkpoint === 'pulse' ? `心跳 ${encounter.beats}/3 · 误按 ${encounter.misses}/3`
          : encounter.phase === 'extracting' ? `取弹 ${Math.round(encounter.focus / CATCH.extraction * 100)}%` : '坠落营救';
      this.el('sandbox-trace').classList.toggle('danger', encounter.phase === 'failed' || encounter.phase === 'flight' && CATCH.impact - encounter.elapsed < 2);
      this.el('sandbox-job').style.width = encounter.phase === 'extracting' ? `${encounter.focus / CATCH.extraction * 100}%` : encounter.phase === 'pulse' ? `${encounter.elapsed / CATCH.pulsePeriod * 100}%` : '0';
      document.getElementById('game-objective-copy')!.textContent = encounter.phase === 'flight' ? 'W 前进 · A / D 绕开中间楼体 · 靠近 Trinity 后按 G'
        : encounter.phase === 'pulse' ? '看光圈节奏：每次收拢时按 F，共三次' : catchText(encounter);
      this.el('sandbox-interact').classList.add('hidden');
    }
    if (!journey.visiting && scene.id === 'm2_ship_lost' && journey.shipLoss) {
      const loss = journey.shipLoss;
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', loss.phase === 'failed' || loss.phase === 'evacuating' && loss.remaining < 10);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = loss.phase === 'evacuating' ? `炸弹 ${Math.ceil(loss.remaining)} 秒 · 带船员从船尾货舱撤离`
        : loss.phase === 'failed' ? 'J 打开手记，从弃船命令检查点重试' : '雷达显示炸弹在 EMP 范围外';
      this.el('sandbox-trace').textContent = loss.phase === 'evacuating' ? `炸弹 ${Math.ceil(loss.remaining)} 秒` : '尼布甲尼撒号 · 最后一程';
      this.el('sandbox-trace').classList.toggle('danger', loss.phase === 'failed' || loss.phase === 'evacuating' && loss.remaining < 10);
      if (loss.phase === 'failed') this.el('sandbox-interact').classList.add('hidden');
    }
    if (!journey.visiting && scene.id === 'm2_stop_sentinels' && journey.tunnel) {
      const tunnel = journey.tunnel;
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', tunnel.phase === 'failed' || tunnel.phase === 'sensing' && tunnel.remaining < 5);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = tunnel.phase === 'sensing' ? `面向哨兵 · 按住 G · 信号 ${Math.round(tunnel.focus / RELOADED_FINALE.signalSeconds * 100)}% · 追击 ${Math.ceil(tunnel.remaining)} 秒`
        : tunnel.phase === 'failed' ? 'J 打开手记，从窄口重试' : '沿隧道向前跑；旧船已经失去';
      this.el('sandbox-trace').textContent = tunnel.phase === 'sensing' ? `信号 ${Math.round(tunnel.focus / RELOADED_FINALE.signalSeconds * 100)}%` : '现实中的连接';
      this.el('sandbox-trace').classList.toggle('danger', tunnel.phase === 'failed' || tunnel.phase === 'sensing' && tunnel.remaining < 5);
      this.el('sandbox-job').style.width = `${tunnel.focus / RELOADED_FINALE.signalSeconds * 100}%`;
      document.getElementById('game-objective-copy')!.textContent = tunnel.phase === 'sensing' ? '转身面对追兵，按住 G 让哨兵停下' : tunnel.phase === 'failed' ? '按 J 打开手记重试窄口' : 'Shift 奔跑，抵达隧道窄口';
      if (tunnel.phase === 'sensing' || tunnel.phase === 'failed') this.el('sandbox-interact').classList.add('hidden');
    }
    if (!journey.visiting && scene.id === 'm2_persephone' && journey.step === 2 && journey.persephone) {
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = journey.persephone.phase === 'enacting' ? '动作与同伴反应正在保存 · V 切换视角' : '靠近后按 J · 电影路线或基于餐桌回应的另一种说法';
      this.el('sandbox-nearby').textContent = '在手记中回应 Persephone';
      this.el('sandbox-job').style.width = `${journey.persephone.elapsed / 2.8 * 100}%`;
      document.getElementById('game-objective-copy')!.textContent = journey.persephone.phase === 'enacting' ? 'Persephone 正在判断这次回应 · 进度自动保存' : '走近 Persephone，在手记中亲自回应条件';
    }
    if (!journey.visiting && scene.id === 'm2_library' && journey.keymaker?.phase === 'following') {
      const gap = distance(player.position, filmPosition(scene.set, journey.keymaker.x, journey.keymaker.z));
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', gap > 14);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = `钥匙匠距离 ${Math.round(gap)} m · 保持在 14 m 内 · 亲自带他到侧门`;
      document.getElementById('game-objective-copy')!.textContent = `护送钥匙匠到书房侧门 · 相距 ${Math.round(gap)} m${gap > 14 ? ' · 返回接应' : ''}`;
    }
    if (!journey.visiting && scene.id === 'm2_burly' && journey.burly) {
      const encounter = journey.burly; const phase = encounter.phase;
      const staffPosition = filmPosition(scene.set, BURLY.staff.x, BURLY.staff.z);
      const destination = phase === 'staff_ready' ? staffPosition : phase === 'flight_ready' ? filmStepPosition(scene, scene.steps[1]) : undefined;
      const close = destination ? distance(player.position, destination) <= 4 : distance(player.position, filmStepPosition(scene, scene.steps[0])) <= 4;
      const ready = ['ready', 'staff_ready', 'flight_ready'].includes(phase) && close || phase === 'failed' || phase === 'done';
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', phase === 'grapple' || phase === 'failed' || encounter.assimilation >= 60);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'grapple' ? `现在按 X · 同化接触还剩 ${(BURLY.grapple - encounter.elapsed).toFixed(1)} 秒`
        : phase === 'approaching' ? '看清 Smith 的靠近 · V 切换视角 · 当前动作会保存'
        : phase === 'swarm' ? `F 连击 · X 闪避 · 击退 ${encounter.repelled}/${BURLY.staffAfterRepels} · 复制体会补位`
        : phase === 'staff_ready' ? '沿右侧跑到松动栏杆 · G 抽出长杆 · F / X 保持距离'
        : phase === 'staff' ? `F 长杆横扫 · 有效挥击 ${encounter.staffSwings}/${BURLY.escapeAfterSwings} · X 闪避同化`
        : phase === 'flight_ready' ? '冲向北侧空地 · G 起飞脱离 · Smith 不会被清空'
        : phase === 'flight' ? 'Neo 正冲出包围 · V 切换视角 · 进度自动保存'
        : phase === 'failed' ? 'G 从庭院入口重新面对 Smith · 已完成的故事线索保留'
        : phase === 'done' ? 'G 继续追查先知的线索' : '走近 Smith · G 开始对峙';
      this.el('sandbox-interact').classList.toggle('hidden', !ready);
      this.el('sandbox-nearby').textContent = phase === 'staff_ready' ? '抽出松动栏杆' : phase === 'flight_ready' ? '飞离包围' : phase === 'failed' ? '从入口重试'
        : phase === 'done' ? '继续追查钥匙匠' : '面对 Smith';
      const actions = this.el('film-training-actions'); const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!;
      const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      if (['grapple', 'swarm', 'staff_ready', 'staff', 'flight_ready'].includes(phase)) {
        actions.classList.remove('hidden'); dodge.classList.remove('hidden'); dodge.disabled = false;
        dodge.innerHTML = `<kbd>X</kbd> ${phase === 'grapple' ? '现在挣脱' : '闪避同化'}`;
        attack.classList.toggle('hidden', phase === 'grapple'); attack.disabled = false;
        attack.querySelector('span')!.textContent = phase === 'staff' ? '长杆横扫' : '反击';
      }
      this.el('sandbox-trace').textContent = phase === 'ready' || phase === 'approaching' ? '旧特工 · 身份异常'
        : phase === 'done' ? '已脱离 · 感染仍在' : `复制体 ${state.threats.filter(threat => threat.scene === scene.id).length} · 同化 ${encounter.assimilation}%`;
      this.el('sandbox-trace').classList.toggle('danger', encounter.assimilation >= 60);
      this.el('sandbox-job').style.width = phase === 'grapple' ? `${Math.min(100, encounter.elapsed / BURLY.grapple * 100)}%`
        : phase === 'flight' ? `${Math.min(100, encounter.elapsed / BURLY.flight * 100)}%` : `${encounter.assimilation}%`;
      document.getElementById('game-objective')!.textContent = '先知庭院 · Smith 增殖';
      document.getElementById('game-objective-copy')!.textContent = journey.lastText;
      if (destination) {
        const direction = Math.atan2(destination.x - player.position.x, destination.z - player.position.z) - player.rotation;
        this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${phase === 'staff_ready' ? '松动栏杆' : '起飞空地'} <b>${Math.round(distance(destination, player.position))} m</b>`;
      } else this.el('sandbox-waypoint').textContent = '';
      return;
    }
    if (!journey.visiting && scene.id === 'm2_chateau' && journey.chateau && journey.step === 0) {
      const encounter = journey.chateau; const phase = encounter.phase;
      const rack = (['sword', 'spear'] as const).find(weapon => distance(player.position, filmPosition(scene.set, CHATEAU.racks[weapon].x, CHATEAU.racks[weapon].z)) <= 4);
      const landing = filmStepPosition(scene, scene.steps[1]);
      const close = distance(player.position, filmStepPosition(scene, scene.steps[0])) <= 4;
      const windup = state.threats.some(threat => threat.scene === scene.id && threat.attackAt !== undefined && threat.weapon && distance(threat.position, player.position) <= 4.4);
      const ready = phase === 'failed' || phase === 'ready' && close || ['duel', 'landing'].includes(phase) && Boolean(rack);
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', windup || phase === 'failed');
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'ready' ? '走到大厅中央 · G 掩护同伴' : phase === 'failed' ? 'G 重试当前楼层 · 兵器保留'
        : phase === 'landing' ? '沿任一侧楼梯上二层平台 · 兵器架仍可更换'
        : `${encounter.weapon === 'sword' ? '长剑' : encounter.weapon === 'spear' ? '长矛' : '徒手'} · ${windup ? '现在按 X 格挡，再按 F 缴械' : '观察红色起手 · X 格挡 · F 反击'} · 已缴械 ${encounter.disarms}`;
      this.el('sandbox-interact').classList.toggle('hidden', !ready);
      this.el('sandbox-nearby').textContent = phase === 'failed' ? '重试当前楼层' : phase === 'ready' ? '挡住开火的守卫' : rack ? `取下${rack === 'sword' ? '长剑' : '长矛'}` : '';
      const actions = this.el('film-training-actions'); const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!;
      const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      if (phase === 'duel') {
        actions.classList.remove('hidden'); dodge.classList.remove('hidden'); dodge.disabled = false;
        dodge.innerHTML = `<kbd>X</kbd> ${windup ? '现在格挡' : '闪避 / 格挡'}`;
        attack.classList.remove('hidden'); attack.disabled = false; attack.querySelector('span')!.textContent = encounter.weapon ? '挥击' : '徒手';
      }
      this.el('sandbox-trace').textContent = `守卫 ${state.threats.filter(threat => threat.scene === scene.id).length} · 格挡 ${encounter.parries} · 缴械 ${encounter.disarms}`;
      this.el('sandbox-trace').classList.toggle('danger', windup);
      this.el('sandbox-job').style.width = `${(encounter.wave - 1) * 50 + (encounter.phase === 'landing' ? 50 : encounter.phase === 'duel' ? (2 - state.threats.filter(threat => threat.scene === scene.id).length) * 25 : 0)}%`;
      document.getElementById('game-objective')!.textContent = '城堡大厅 · 古兵器战';
      document.getElementById('game-objective-copy')!.textContent = phase === 'landing' ? '登上二层平台，迎战后方守卫' : phase === 'ready' ? '挡住火力，让同伴带钥匙匠离开' : journey.lastText;
      const destination = phase === 'landing' ? landing : !encounter.weapon ? filmPosition(scene.set, CHATEAU.racks.sword.x, CHATEAU.racks.sword.z) : undefined;
      if (destination) {
        const direction = Math.atan2(destination.x - player.position.x, destination.z - player.position.z) - player.rotation;
        this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${phase === 'landing' ? '二层平台' : '左墙长剑'} <b>${Math.round(distance(destination, player.position))} m</b>`;
      } else this.el('sandbox-waypoint').textContent = '';
      return;
    }
    if (!journey.visiting && scene.id === 'm2_mountain' && journey.mountain && journey.step === 2) {
      const flight = journey.mountain;
      const active = flight.phase === 'takeoff' || flight.phase === 'flying' || flight.phase === 'arrived';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', flight.phase === 'failed');
      this.el('film-sequence-line').textContent = flight.phase === 'failed' ? journey.lastText : active ? 'Link 正在追踪同伴的高速公路信号。' : 'Link 已确认：城市位于正南。';
      this.el('film-sequence-hint').textContent = flight.phase === 'failed' ? 'G 从山崖起飞点重试' : active
        ? `W 朝南飞 · A / D 校正 · Shift 加速 · 高度 ${Math.round(flight.altitude)} m` : '站在山崖边按 Space 起飞';
      this.el('sandbox-interact').classList.toggle('hidden', flight.phase !== 'failed');
      this.el('sandbox-nearby').textContent = flight.phase === 'failed' ? '重试飞行' : '';
      this.el('sandbox-trace').textContent = active ? `山地航线 ${Math.max(0, Math.round(MOUNTAIN.launch.z - flight.z))} / ${MOUNTAIN.launch.z - MOUNTAIN.destinationZ} m` : 'Link 已确认城市位于正南';
      this.el('sandbox-trace').classList.toggle('danger', flight.phase === 'failed');
      this.el('sandbox-job').style.width = `${Math.max(0, Math.min(100, (MOUNTAIN.launch.z - flight.z) / (MOUNTAIN.launch.z - MOUNTAIN.destinationZ) * 100))}%`;
      document.getElementById('game-objective')!.textContent = '雪山误传 · Neo 返航';
      document.getElementById('game-objective-copy')!.textContent = flight.phase === 'failed' ? '重新起飞，朝正南返回城市' : active ? '穿过山脊，赶上公路上的同伴' : '从城堡外的山崖起飞';
      this.el('sandbox-waypoint').textContent = '↓ 南方 · 城市与高速公路';
      return;
    }
    if (journey.reloaded && !journey.visiting) {
      const encounter = journey.reloaded; const phase = encounter.phase;
      const close = !step || distance(player.position, filmStepPosition(scene, step)) < 4;
      const ready = ['talk_ready', 'connect_ready', 'evacuate_ready', 'failed', 'done'].includes(phase)
        || ['window_ready', 'report_ready', 'earpiece_ready'].includes(phase) && close || phase === 'departure_ready' && encounter.evacuated;
      const firing = phase === 'falling' && RELOADED.dreamShots.some(beat => Math.abs(encounter.elapsed - beat) <= RELOADED.shotWindow && !encounter.shots.includes(beat) && !encounter.missed.includes(beat));
      const dodgeNow = phase === 'combat' && encounter.cycle >= RELOADED.strike - RELOADED.dodgeWindow && encounter.cycle < RELOADED.strike;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', firing || dodgeNow || phase === 'failed');
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'falling' ? firing ? '现在按 F 还击 · G 可减慢梦中的时间' : '等待准星收拢 · A / D 调整姿态'
        : phase === 'combat' ? `WASD 移动 · 1 治疗 · 反击 ${encounter.hits.join(' / ')} · ${encounter.evacuated ? '船员已抵达出口' : '正在掩护撤离'}`
        : phase === 'evacuate_ready' ? 'G 西侧撤离 · J 选择东侧出口' : 'WASD 移动 · G 互动 · J 手记 · V 切换视角';
      this.el('sandbox-interact').classList.toggle('hidden', !ready);
      this.el('sandbox-nearby').textContent = phase === 'failed' ? '重试入口战斗' : phase === 'done' ? '继续下一段' : phase === 'talk_ready' ? '回应 Trinity' : phase === 'connect_ready' ? '接入船长会议' : phase === 'evacuate_ready' ? '通知西侧出口撤离' : step?.label ?? '继续';
      const actions = this.el('film-training-actions'); const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!; const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      if (phase === 'falling' || phase === 'combat') {
        actions.classList.remove('hidden'); attack.classList.remove('hidden'); attack.disabled = false; attack.querySelector('span')!.textContent = phase === 'falling' ? '还击' : '反击';
        dodge.classList.toggle('hidden', phase !== 'combat'); dodge.disabled = encounter.dodgeCooldown > 0;
        dodge.innerHTML = `<kbd>X</kbd> ${dodgeNow ? '现在闪避' : '闪避'}`;
      }
      this.el('sandbox-job').style.width = `${phase === 'falling' ? encounter.elapsed / RELOADED.fall * 100 : phase === 'combat' ? encounter.cycle / (RELOADED.strike + RELOADED.recovery) * 100 : 0}%`;
      this.el('sandbox-weather').textContent = player.isInMatrix ? '矩阵 · 夜间' : '真实世界 · 飞船';
      this.el('sandbox-trace').textContent = encounter.kind === 'dream' ? `梦境细节 ${encounter.shots.length}/3` : encounter.exit ? `${encounter.exit === 'east' ? '东' : '西'}侧撤离 · ${Math.round(encounter.evacuation / RELOADED.evacuation * 100)}%` : '等待先知的消息';
      document.getElementById('game-objective-copy')!.textContent = reloadedText(encounter);
      if (['approach', 'window_ready', 'report_ready', 'earpiece_ready'].includes(phase) && step) {
        const target = filmStepPosition(scene, step); const direction = Math.atan2(target.x - player.position.x, target.z - player.position.z) - player.rotation;
        this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${step.label} <b>${Math.round(distance(target, player.position))} m</b>`;
      } else this.el('sandbox-waypoint').textContent = '';
      if (phase === 'dream_hit') this.el('film-blackout').style.opacity = String(Math.min(.94, encounter.elapsed / RELOADED.impact));
      return;
    }
    if (journey.hotel && !journey.hotel.entered && !journey.visiting) {
      const ready = journey.hotel.progress >= HOTEL_DOOR_PROGRESS - .01 && distance(player.position, filmPosition('film_lafayette', 24, 0)) < 4;
      const knocking = journey.hotel.knock !== undefined;
      const waiting = !ready && distance(player.position, filmPosition('film_lafayette', 24, 0)) < 4;
      document.getElementById('game-objective')!.textContent = '前往十三层 · 1313';
      document.getElementById('game-objective-copy')!.textContent = knocking ? 'Neo 正在敲门 · 动作与位置自动保存' : journey.hotel.door !== undefined ? '门已打开 · 亲自跨过门槛' : waiting ? '你已到 1313 门前 · 等 Trinity 赶来' : '跟随 Trinity 上楼。可以停留观察，她会等你。';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = knocking ? '三下敲门 · 暂停或重新载入会保留动作' : waiting ? 'Trinity 正从楼梯赶来 · 到场后按 G 敲门' : 'WASD 移动 · Shift 快步 · V 切换视角 · 途中自动保存';
      this.el('sandbox-interact').classList.toggle('hidden', !ready || knocking || journey.hotel.door !== undefined);
      this.el('sandbox-nearby').textContent = knocking ? '正在敲门' : waiting ? '等待 Trinity 赶来' : '敲响 1313 房门'; this.el('sandbox-waypoint').textContent = '';
      return;
    }
    if (lafayetteWelcomeLocked(journey)) {
      const welcome = journey.hotel!.welcome!; const waiting = welcome.phase === 'ready';
      document.getElementById('game-objective')!.textContent = '1313 · 初次见面';
      document.getElementById('game-objective-copy')!.textContent = waiting ? 'Morpheus 正向你伸出右手 · 按 G 回应' : welcome.phase === 'handshake' ? '握手动作与人物位置正在保存' : welcome.phase === 'departing' ? 'Trinity 离开相邻房间 · Morpheus 请你落座' : '窗前的人影转身向你走来';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = waiting ? 'G 握住 Morpheus 的手 · 等待不会替你回应' : '鼠标观察 · V 切换视角 · 暂停或重连会保留动作';
      this.el('sandbox-interact').classList.toggle('hidden', !waiting); this.el('sandbox-nearby').textContent = '握住 Morpheus 的手';
      this.el('sandbox-waypoint').textContent = '';
      return;
    }
    if (!journey.visiting && journey.scene === 'm1_club' && journey.club) {
      const phase = journey.club.phase; const active = phase === 'ready' || phase === 'listen';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'question' ? 'J 回应 Trinity · 三种问题会留下不同手记' : active ? 'G 回应 · V 切换视角' : clubLocked(journey) ? 'V 切换视角 · 暂停和重新载入会保留交谈' : 'WASD 穿过人群 · J 手记';
      this.el('sandbox-interact').classList.toggle('hidden', !active && Boolean(step));
      this.el('sandbox-nearby').textContent = phase === 'listen' ? '追问她为什么来找你' : step ? '回应 Trinity' : '继续第二天的生活';
      if (clubLocked(journey)) this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = phase === 'question' ? 'J 回应 Trinity 的警告' : step?.label ?? 'G 离开夜店，继续第二天';
      return;
    }
    if (!journey.visiting && journey.scene === 'm1_wake_up' && journey.contact) {
      const phase = journey.contact.phase; const locked = apartmentLocked(journey);
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'noticed' ? 'J 决定是否赴约 · 可以暂时回到生活' : locked && phase !== 'reply' ? 'V 切换视角 · 暂停或重连会保留当前动作' : 'WASD 移动 · 靠近后按 G · J 查看手记';
      this.el('sandbox-interact').classList.toggle('hidden', locked && phase !== 'reply');
      this.el('sandbox-nearby').textContent = phase === 'reply' ? '尝试用键盘退出' : phase === 'noticed' ? '决定是否接受邀请' : step?.label ?? '跟随白兔去夜店';
      if (locked) this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = phase === 'reply' ? 'G 尝试退出窗口' : step?.label ?? 'G 随他们出发';
      return;
    }
    if (!journey.visiting && journey.scene === 'm1_wake_again' && journey.wakeCall) {
      const phase = journey.wakeCall.phase; const close = !step || distance(player.position, filmStepPosition(scene, step)) <= 4;
      const canAct = phase === 'decision' || phase === 'ringing' && close || phase === 'done' && !step;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'ringing' ? '走到工作台旁 · G 拿起听筒 · V 切换视角' : phase === 'decision' ? 'G 明确答应 · 等待不会替你回答' : phase === 'done' ? step ? 'WASD 走到 101 房门 · 途中自动保存' : 'G 离开公寓 · 前往 Adams Street 桥下' : '鼠标观察 · V 切换视角 · 暂停或重连会保留当前动作';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = phase === 'ringing' ? '拿起有线座机听筒' : phase === 'decision' ? '回答仍然要见面' : phase === 'done' ? step ? '前往 101 房门' : '前往 Adams Street 桥下' : '来电演出进行中';
      if (wakeCallLocked(journey) || !step) this.el('sandbox-waypoint').textContent = '';
      else {
        const target = filmStepPosition(scene, step); const direction = Math.atan2(target.x - player.position.x, target.z - player.position.z) - player.rotation;
        this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${phase === 'ringing' ? '响铃的座机' : '101 房门'} <b>${Math.round(distance(target, player.position))} m</b>`;
      }
      document.getElementById('game-objective-copy')!.textContent = phase === 'waking' ? 'Neo 正在床上醒来；被捕与逃脱路线会保留各自经历。' : phase === 'ringing' ? '走到工作台旁的实体座机前，按 G 接听。' : phase === 'decision' ? 'Morpheus 等待你亲自确认是否仍要见面。' : phase === 'done' ? step ? '离开公寓，前往 Adams Street 桥下。' : '按 G 离开公寓，前往 Adams Street 桥下。' : '通话阶段与人物姿势自动保存。';
      return;
    }
    if (!journey.visiting && journey.scene === 'm1_sentinels' && journey.sentinel) {
      const encounter = journey.sentinel; const phase = encounter.phase;
      const close = !step || distance(player.position, filmStepPosition(scene, step)) <= 4;
      const canAct = phase === 'failed' || (phase === 'ready' || phase === 'verify') && close;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', phase === 'detected' || encounter.noise > .7);
      this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'sweep' ? `保持静止 · 扫描 ${Math.round(sentinelDanger(encounter.elapsed) * 100)}% · 噪声 ${Math.round(encounter.noise * 100)}%`
        : phase === 'failed' ? 'G 从停机检查点重试 · 此前剧情不会丢失'
        : phase === 'ready' ? '走进前舱 · G 开始停机 · V 切换视角'
        : phase === 'verify' ? '走到舷窗和 EMP 控制台旁 · G 确认航道'
        : phase === 'done' ? 'G 继续船上的夜班' : '鼠标观察 · V 切换视角 · 暂停或重连会保留当前一拍';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct && phase !== 'done');
      this.el('sandbox-nearby').textContent = phase === 'failed' ? '从停机检查点重试' : phase === 'verify' ? '确认哨兵已经离开' : phase === 'done' ? '继续下一段' : '执行静默停机';
      this.el('sandbox-job').style.width = `${encounter.noise * 100}%`;
      if (sentinelLocked(journey) || phase === 'sweep') this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = phase === 'sweep' ? '不要移动、奔跑或跳跃；让船内噪声保持在暴露阈值以下。'
        : phase === 'failed' ? `第 ${encounter.attempt + 1} 次静默失败。主动重试后会重新经历停机。`
        : phase === 'verify' ? '扫描已经远去；亲自走到前窗确认，再恢复航行。' : journey.lastText;
      return;
    }
    if (!journey.visiting && journey.interlude && ['m1_cypher_console', 'm1_steak', 'm1_meal'].includes(journey.scene)) {
      const encounter = journey.interlude; const phase = encounter.phase;
      const close = !step || distance(player.position, filmStepPosition(scene, step)) <= 4;
      const walking = encounter.kind === 'steak' && phase === 'ready' && journey.step === 0 || encounter.kind === 'meal' && phase === 'done' && Boolean(step);
      const canAct = phase === 'ready' && close && !walking || phase === 'done' && !step;
      const title = encounter.kind === 'console' ? '屏幕旁的一杯酒' : encounter.kind === 'steak' ? '舒适的代价' : '真实世界的一顿饭';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'choice' ? 'J 回应 Cypher 对真相与后悔的试探 · 等待不会替你选择'
        : interludeLocked(journey) ? '鼠标环顾 · V 切换主视角与场景镜头 · 暂停或重连会保留动作'
        : walking ? 'WASD 移动到金色目标 · 途中可以自由观察'
        : phase === 'ready' ? '靠近后按 G 开始 · 等待不会自动推进'
        : 'G 继续下一段 · 这段经历已经写入手记';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = phase === 'done' ? '继续下一段' : encounter.kind === 'console' ? '打断 Cypher 的夜班' : encounter.kind === 'steak' ? '落座见证交易' : '接过 Tank 递来的食物';
      this.el('sandbox-job').style.width = interludeLocked(journey) ? `${Math.min(100, encounter.elapsed / interludeDuration(encounter) * 100)}%` : '0';
      if (interludeLocked(journey)) this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective')!.textContent = title;
      document.getElementById('game-objective-copy')!.textContent = phase === 'choice' ? '打开手记，决定 Neo 如何回应；选择将影响本轮哲学倾向。'
        : encounter.kind === 'steak' ? phase === 'done' ? '这段旁观事件不会成为 Neo 此时拥有的角色知识。' : walking ? '以 Smith 视角走近窗边餐桌。' : journey.lastText
        : encounter.kind === 'meal' && phase === 'done' ? '回到核心连接区，准备下一次进入矩阵。' : journey.lastText;
      return;
    }
    if (!journey.visiting && journey.scene === 'm1_boss' && journey.workday && !journey.phone) {
      const phase = journey.workday.phase; const locked = workdayLocked(journey);
      const action = phase === 'answer' ? '回应主管，回到工位' : phase === 'signature' ? '签收 Thomas Anderson 的快递' : phase === 'delivered' ? '拆开包裹，取出手机' : '与 Rhineheart 交谈';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'briefing' || phase === 'signing' ? 'V 切换视角 · 暂停或重连会保留动作' : phase === 'delivery' ? '快递员正在走来 · 可以自由观察' : 'WASD 移动 · 靠近后按 G · J 查看手记';
      this.el('sandbox-interact').classList.toggle('hidden', !['waiting', 'answer', 'signature', 'delivered'].includes(phase));
      this.el('sandbox-nearby').textContent = action;
      if (locked) this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = phase === 'released' || phase === 'delivery' ? '回到自己的隔间，等待并签收快递。' : locked && phase !== 'answer' ? phase === 'signing' ? '正在签收与接过包裹' : '主管正在训话，听完后回应他。' : action;
      return;
    }
    if (trainingLocked(journey)) {
      const training = journey.training!; const waiting = trainingWaiting(journey);
      const name = training.kind === 'download' ? '格斗程序下载' : training.kind === 'jump' ? 'Morpheus 跨楼示范' : '红衣女子注意力测试';
      const action = training.kind === 'download' ? '请 Tank 开始上传' : training.kind === 'jump' ? '请 Morpheus 开始示范' : '开始注意力测试';
      document.getElementById('game-objective-copy')!.textContent = waiting ? `${name} · 按 G 开始，等待不会替你决定`
        : `${name} · ${Math.round(training.elapsed / TRAINING_SECONDS[training.kind] * 100)}% · 进度自动保存`;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = waiting ? `G ${action} · 鼠标观察 · V 切换视角` : '鼠标观察 · V 切换视角 · 暂停或重连会从当前动作继续';
      this.el('sandbox-job').style.width = `${training.elapsed / TRAINING_SECONDS[training.kind] * 100}%`;
      this.el('sandbox-interact').classList.toggle('hidden', !waiting); this.el('sandbox-waypoint').textContent = '';
      this.el('sandbox-nearby').textContent = action;
      return;
    }
    if (!journey.visiting && scene.id === 'm1_dojo' && journey.dojo && journey.fighting) {
      const lesson = journey.dojo;
      const windup = state.threats.some(threat => threat.scene === scene.id && threat.character === 'morpheus' && threat.attackAt !== undefined && threat.attackAt > this.tick);
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence').classList.toggle('urgent', windup && !lesson.dodged);
      const actions = this.el('film-training-actions'); const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!; const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      actions.classList.remove('hidden'); dodge.classList.toggle('hidden', lesson.dodged); dodge.disabled = !windup;
      attack.classList.toggle('hidden', !lesson.dodged); attack.querySelector('span')!.textContent = ['刺拳', '直拳', '正蹬'][lesson.combo] ?? '连击';
      this.el('film-sequence-hint').textContent = !lesson.dodged ? windup ? '现在！按 X 闪避' : '观察 Morpheus 的红色起手提示 · X 闪避' : `F 连击 · ${lesson.combo}/3 · ${DOJO_COMBO_WINDOW} 秒内接续，否则从刺拳重来`;
      this.el('sandbox-job').style.width = `${(lesson.dodged ? 25 : 0) + lesson.combo * 25}%`;
      this.el('sandbox-waypoint').textContent = !lesson.dodged ? '先读懂起手，再离开攻击线' : '刺拳 → 直拳 → 正蹬';
      this.el('sandbox-interact').classList.add('hidden');
      document.getElementById('game-objective-copy')!.textContent = !lesson.dodged ? windup ? '现在闪避 · X' : '等待 Morpheus 出手 · 看见红色提示后按 X 闪避' : `完成有顺序的三段反击 · ${lesson.combo}/3`;
      return;
    }
    if (!journey.visiting && scene.id === 'm2_seraph' && journey.seraph && journey.fighting) {
      const trial = journey.seraph;
      const warning = state.threats.some(threat => threat.scene === scene.id && threat.character === 'seraph' && threat.attackAt !== undefined && threat.attackAt > this.tick);
      const counter = (trial.counterUntil ?? 0) >= this.tick;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence').classList.toggle('urgent', warning && !counter);
      const actions = this.el('film-training-actions'); const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!; const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      actions.classList.remove('hidden'); dodge.classList.toggle('hidden', counter); dodge.disabled = !warning;
      attack.classList.toggle('hidden', !counter); attack.querySelector('span')!.textContent = '近身反击';
      this.el('film-sequence-hint').textContent = counter ? '趁 Seraph 后撤前靠近，按 F 反击' : warning ? '现在按 X 避开这次攻势' : '保持距离，观察红色起手提示；正面连打无效';
      this.el('sandbox-job').style.width = `${trial.counters * 50}%`;
      this.el('sandbox-waypoint').textContent = `读懂攻势并反击 · ${trial.counters}/2`;
      this.el('sandbox-interact').classList.add('hidden');
      document.getElementById('game-objective-copy')!.textContent = `Seraph 考验 · 两次闪避反击 ${trial.counters}/2`;
      return;
    }
    if (journey.awakening && journey.awakening.elapsed < AWAKENING_SECONDS[journey.awakening.kind] && awakeningLocked(journey)) {
      const waiting = awakeningWaiting(journey); const kind = journey.awakening!.kind;
      const action = kind === 'mirror' ? '继续追踪与触镜' : kind === 'recovery' ? '示意开始恢复肌肉' : kind === 'construct' ? '请 Morpheus 打开电视' : '请 Morpheus 继续揭示';
      const activity = ({ mirror: journey.awakening!.elapsed < MIRROR_TIMING.touch ? '追踪接线' : '镜面覆盖', connect: '定位连接', disconnect: '培养舱断线', rescue: '飞船救援', recovery: '针疗与身体恢复', construct: '电视与感官揭示', desert: '真实荒漠讲解' } as const)[kind];
      document.getElementById('game-objective-copy')!.textContent = waiting
        ? `${journey.step + 1}/${scene.steps.length} · ${action} · 按 G`
        : `${journey.step + 1}/${scene.steps.length} · ${activity}进行中 · ${Math.round(journey.awakening!.elapsed / AWAKENING_SECONDS[kind] * 100)}%`;
      this.el('film-sequence-hint').textContent = waiting ? `G ${action} · 鼠标观察 · V 切换视角` : '鼠标观察 · V 切换视角 · 暂停或重连会保留动作';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('sandbox-waypoint').textContent = '';
      this.el('sandbox-interact').classList.toggle('hidden', !waiting);
      if (waiting) this.el('sandbox-nearby').textContent = action;
      return;
    }
    if (!journey.visiting && scene.id === 'm1_construct' && step?.kind === 'reflect') {
      this.el('film-construct-reflection').classList.remove('hidden');
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence-line').textContent = step.text ?? journey.lastText;
      this.el('film-sequence-hint').textContent = '选择一种理解，随后进入电视中的真实荒漠 · J 也可在手记中选择';
      this.el('sandbox-waypoint').textContent = '';
      this.el('sandbox-interact').classList.add('hidden');
      document.getElementById('game-objective-copy')!.textContent = '2/2 · 感觉足以证明真实吗？ · 选择后继续';
      return;
    }
    if (!journey.visiting && scene.id === 'm1_spoon' && journey.oracle?.spoon !== undefined) {
      const bend = journey.oracle.spoon;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = step?.kind === 'reach' ? '把这次经验带进厨房 · WASD 移动' : '停下脚步，按住 G 专注并近看 · 松开 G 恢复观察';
      this.el('sandbox-job').style.width = `${bend * 100}%`;
      if (journey.step === 0) {
        document.getElementById('game-objective-copy')!.textContent = `握住勺子 · 专注 ${Math.round(bend * 100)}% · 按住 G，走动会中断`;
        this.el('sandbox-nearby').textContent = '按住 G 专注'; this.el('sandbox-waypoint').textContent = '这里的规则，是否一定需要服从？'; return;
      }
    }
    if (meetingLocked(journey) && journey.meeting) {
      const encounter = journey.meeting; const choosing = encounter.phase === 'choice'; const hesitating = encounter.phase === 'hesitating';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = choosing ? '接受检查，或先推开车门问清楚 · 等待不会替你决定'
        : hesitating ? encounter.elapsed < MEETING_TIMING.hesitating ? '先望向雨中，听 Trinity 把话说完' : '关门信任 Trinity，或真的离开 · 等待不会替你决定'
        : encounter.phase === 'located' || encounter.phase === 'removing' ? '按住 G 保持稳定 · 松开暂停抽取'
        : encounter.phase === 'done' ? journey.step === 1 ? 'J 记录反思，再继续赴约' : 'G 启程前往 Lafayette'
        : encounter.phase === 'parked' ? 'G 打开车门下车 · 等待不会替你决定'
        : encounter.phase === 'driving' ? 'Apoc 正在驾驶 · V 切换车内视角后可用鼠标观察' : 'V 切换视角 · 暂停或重连会保留动作';
      this.el('film-meeting').classList.toggle('hidden', !choosing);
      this.el('film-meeting-door').classList.toggle('hidden', !hesitating);
      if (hesitating) this.el('film-meeting-door').querySelectorAll('button').forEach(button => { button.disabled = encounter.elapsed < MEETING_TIMING.hesitating; });
      if ((choosing || hesitating) && document.pointerLockElement) document.exitPointerLock();
      this.el('sandbox-interact').classList.toggle('hidden', !['ready', 'located', 'removing', 'done', 'parked'].includes(encounter.phase));
      this.el('sandbox-waypoint').textContent = '';
      if (encounter.phase === 'done' && journey.step >= 2) this.el('sandbox-nearby').textContent = '启程前往 Lafayette';
      if (encounter.phase === 'parked') this.el('sandbox-nearby').textContent = '打开车门下车';
      if (encounter.phase === 'located' || encounter.phase === 'removing') {
        this.el('sandbox-nearby').textContent = '按住 G 配合抽取';
        this.el('sandbox-job').style.width = `${encounter.elapsed / MEETING_TIMING.removing * 100}%`;
      }
      return;
    }
    if (interrogationLocked(journey)) {
      const encounter = journey.interrogation!; const ready = encounter.phase === 'response' || encounter.phase === 'done';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = encounter.phase === 'response' ? 'G 拒绝合作，要求打电话 · 决定前，特工会等待' : encounter.phase === 'done' ? 'G 从公寓中醒来' : 'V 切换视角 · 暂停或重连会保留动作进度';
      this.el('sandbox-interact').classList.toggle('hidden', !ready); this.el('sandbox-waypoint').textContent = '';
      this.el('sandbox-nearby').textContent = encounter.phase === 'done' ? '醒来' : '拒绝合作，要求通话';
      this.el('film-blackout').style.opacity = String(interrogationPose({ ...encounter, role: 'neo' }).fade);
      return;
    }
    if (pillLocked(journey)) {
      const choosing = journey.pills!.phase === 'choice';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = choosing ? '红色继续追问；蓝色回到日常。你可以慢慢决定。' : journey.lastText;
      this.el('film-sequence-hint').textContent = choosing ? '两种选择都会保存 · 等待不会自动作出决定' : 'V 切换视角 · 暂停、重连会保留动作进度';
      this.el('film-pills').classList.toggle('hidden', !choosing);
      if (choosing && document.pointerLockElement) document.exitPointerLock();
      this.el('sandbox-interact').classList.add('hidden'); this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = choosing ? '看着 Morpheus 的双手，作出自己的选择。' : journey.pills!.phase === 'offering' ? '与 Morpheus 交谈' : '拿取药丸，用水吞服';
      return;
    }
    if (!journey.visiting && scene.id === 'm1_mirror' && journey.mirrorGuide) {
      const door = filmPosition(scene.set, PILL_ROOM.trackingDoor.x, PILL_ROOM.trackingDoor.z);
      const outside = player.position.z > door.z - .6;
      if (!journey.mirrorGuide.done || outside) {
        const pose = mirrorGuidePose(journey.mirrorGuide.progress);
        const target = outside ? door : filmPosition(scene.set, pose.x, pose.z);
        const direction = Math.atan2(target.x - player.position.x, target.z - player.position.z) - player.rotation;
        const label = outside ? '会客厅后门' : 'Morpheus · 追踪室';
        this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
        this.el('film-sequence-hint').textContent = 'WASD 跟随 Morpheus · 他会在前方等你';
        this.el('sandbox-interact').classList.add('hidden');
        this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${label} <b>${Math.round(distance(target, player.position))} m</b>`;
        document.getElementById('game-objective-copy')!.textContent = outside ? '穿过会客厅后门，跟随 Morpheus 进入追踪室' : '跟随 Morpheus 到追踪椅旁；抵达后按 G';
        return;
      }
    }
    if (!journey.visiting && scene.id === 'm1_boss' && journey.phone) {
      const phase = journey.phone.phase;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'ready' ? 'G 滑开手机接听' : phase === 'connected' ? 'G 按电话指引离开工位 · Z 潜行' : '留意手中的手机 · 接听进度自动保存';
      this.el('sandbox-interact').classList.toggle('hidden', phase !== 'connected');
      this.el('sandbox-nearby').textContent = phase === 'ready' ? '滑开手机接听' : '按电话指引离开工位';
      this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = phase === 'ready' ? '来电号码未知 · 按 G 接听' : phase === 'connected' ? '保持通话，准备躲避特工。' : '接听来自未知号码的电话'; return;
    }
    if (!journey.visiting && scene.id === 'm1_oracle' && journey.oracle?.vase !== undefined && journey.step === 0) {
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = '留意桌上的花瓶 · 事件进度自动保存';
      this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (!journey.visiting && scene.id === 'm1_oracle' && journey.oracle?.consultation) {
      const encounter = journey.oracle.consultation; const close = !step || distance(player.position, filmStepPosition(scene, step)) <= 4;
      const canAct = encounter.phase === 'waiting' && close || encounter.phase === 'done';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = encounter.phase === 'waiting' ? '走到先知身边 · G 开始 · 等待不会自动推进'
        : encounter.phase === 'question' ? 'J 打开手记回答 · 等待不会替你选择'
        : encounter.phase === 'done' ? 'G 离开厨房，继续返回路线'
        : '鼠标环顾 · V 切换主视角与场景镜头 · 暂停或重连会保留动作';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = encounter.phase === 'done' ? '继续返回路线' : '接受先知的检查与谈话';
      this.el('sandbox-job').style.width = oracleVisitLocked(journey) && encounter.phase !== 'question'
        ? `${Math.min(100, encounter.elapsed / oracleVisitDuration(encounter) * 100)}%` : '0';
      if (oracleVisitLocked(journey)) this.el('sandbox-waypoint').textContent = '';
      if (encounter.phase === 'question' && document.pointerLockElement) document.exitPointerLock();
      document.getElementById('game-objective-copy')!.textContent = encounter.phase === 'question' ? '先知正在等待你的回答；打开手记，决定如何面对预言与 Morpheus。'
        : encounter.phase === 'done' ? '检查与饼干交接已记下；这个回答会改变后续营救准备。' : journey.lastText;
      return;
    }
    if (!journey.visiting && journey.rescue && ['m1_rescue_decision', 'm1_guns'].includes(scene.id)) {
      const preparation = journey.rescue; const loadout = rescueLoadout(preparation);
      const nearest = Object.entries(RESCUE.loadoutRoots).map(([id, root]) => ({ id, distance: distance(player.position, filmPosition(scene.set, root.x, root.z)) }))
        .sort((a, b) => a.distance - b.distance)[0];
      const close = preparation.phase === 'selecting' ? Boolean(nearest && nearest.distance <= 4) : !step || distance(player.position, filmStepPosition(scene, step)) <= 4;
      const canAct = preparation.phase === 'briefing_ready' && journey.step === 1 && close || preparation.phase === 'racks_ready' && close
        || preparation.phase === 'selecting' && close || preparation.phase === 'briefing_done' || preparation.phase === 'equipped' && !step;
      const reflection = scene.id === 'm1_rescue_decision' && journey.step === 0;
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = reflection ? 'J 记录为什么仍然选择营救 · 等待不会替你回答'
        : preparation.phase === 'briefing_ready' ? '走到核心投影 · G 与 Tank、Trinity 核对方案'
        : preparation.phase === 'briefing' ? '鼠标环顾任务投影 · V 切换主视角 · 当前一拍自动保存'
        : preparation.phase === 'briefing_done' ? 'G 进入白色构造体'
        : preparation.phase === 'racks_ready' ? '走到装载标记 · G 请求武器架'
        : preparation.phase === 'racks_arriving' ? '武器架正在接近 · V 切换视角 · 进度自动保存'
        : preparation.phase === 'selecting' ? `走近左、中、右配置 · 最近 ${Math.round(nearest?.distance ?? 0)} m · G 选择`
        : preparation.phase === 'equipping' ? `正在装配${loadout.name} · 暂停或读档保留动作`
        : step ? '带着装备走向构造体出口' : 'G 载入政府大楼大厅';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct || reflection);
      this.el('sandbox-nearby').textContent = preparation.phase === 'briefing_ready' ? '核对营救方案' : preparation.phase === 'briefing_done' ? '进入白色构造体'
        : preparation.phase === 'racks_ready' ? '载入武器架' : preparation.phase === 'selecting' ? '选择眼前的武器配置'
        : preparation.phase === 'equipped' ? '载入政府大楼大厅' : '营救准备进行中';
      const duration = rescueDuration(preparation);
      this.el('sandbox-job').style.width = duration ? `${Math.min(100, preparation.elapsed / duration * 100)}%` : '0';
      if (rescueLocked(journey) || preparation.phase === 'selecting') this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective')!.textContent = scene.id === 'm1_rescue_decision' ? '营救 Morpheus · 任务简报' : '构造体 · 武器装载';
      document.getElementById('game-objective-copy')!.textContent = preparation.loadout
        ? `${loadout.name} · ${loadout.magazine} 发 · 单发 ${loadout.damage} · 换弹 ${loadout.reloadTicks} 拍`
        : journey.lastText;
      return;
    }
    if (!journey.visiting && journey.betrayal && ['m1_bathroom', 'm1_unplugged'].includes(scene.id)) {
      const encounter = journey.betrayal; const step = scene.steps[journey.step];
      const close = !step || distance(player.position, filmStepPosition(scene, step)) <= 4;
      const bathroom = encounter.kind === 'bathroom'; const phase = encounter.phase;
      const canAct = close && (phase === 'ready' && (bathroom || journey.step === 1) || phase === 'sacrifice_ready')
        || phase === 'window' || phase === 'reconnect' || phase === 'done';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = phase === 'defending' ? `F 近战 · X 闪避 · 有效击退 ${encounter.repels ?? 0}/${BETRAYAL.bathroom.requiredRepels} · ${Math.floor(encounter.elapsed)}/${BETRAYAL.bathroom.hold} 秒`
        : phase === 'window' ? '现在按 G 反击 · 错过会失败'
        : phase === 'reconnect' ? `按 G 接回信号 · ${encounter.rescued ?? 0}/2`
        : phase === 'failed' ? 'J 打开手记，从备用控制台重试'
        : betrayalLocked(journey) ? '鼠标环顾 · V 切换视角 · 当前动作自动保存'
        : journey.step === 0 && !bathroom ? '走到备用控制台 · 到达后自动记录' : '走近目标 · G 继续';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = phase === 'window' ? '抓起脉冲步枪反击' : phase === 'reconnect' ? (encounter.rescued ? '接回 Trinity' : '稳住 Neo 的接线')
        : phase === 'done' ? bathroom ? '转到飞船上的背叛' : '继续营救抉择' : bathroom && phase === 'sacrifice_ready' ? '撞向 Smith' : bathroom ? '开始掩护撤离' : '接通监视画面';
      const duration = phase === 'defending' ? BETRAYAL.bathroom.hold : betrayalDuration(encounter);
      this.el('sandbox-job').style.width = duration > 0 ? `${Math.min(100, encounter.elapsed / duration * 100)}%` : '0';
      if (betrayalLocked(journey)) this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = journey.lastText;
      return;
    }
    if (!journey.visiting && scene.id === 'm1_dejavu' && journey.ambush && journey.step === 0) {
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = '留意前方门洞 · 走远会暂停观察';
      this.el('sandbox-interact').classList.add('hidden'); this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = '看着猫经过的地方，留意周围的变化。'; return;
    }
    if (scene.id === 'm1_lobby' && !journey.visiting) {
      const combat = journey.lobby; const loadout = rescueLoadout(journey);
      this.el('sandbox-trace').textContent = combat?.reloadAt !== undefined ? `${loadout.name} · 换弹 ${Math.max(0, (combat.reloadAt - this.tick) / 2).toFixed(1)}s` : `${loadout.name} · 弹匣 ${combat?.ammo ?? loadout.magazine} / ${loadout.magazine}`;
      if (lobbyLocked(journey)) {
        const elapsed = combat?.elapsed ?? 0;
        this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
        this.el('film-sequence-hint').textContent = elapsed < LOBBY_ENTRY.alarmAt ? '安检入口 · 鼠标环顾 · V 切换视角 · 动作自动保存'
          : elapsed < LOBBY_ENTRY.drawAt ? '警报触发 · 保持观察' : '武器已拔出 · 大厅警戒即将启动';
        this.el('sandbox-job').style.width = `${Math.min(100, elapsed / LOBBY_ENTRY.duration * 100)}%`;
        this.el('sandbox-interact').classList.add('hidden'); this.el('sandbox-waypoint').textContent = '';
        document.getElementById('game-objective-copy')!.textContent = '与 Trinity 通过安检 · 当前动作和人物位置会保存'; return;
      }
      if (journey.fighting) {
        document.getElementById('game-objective-copy')!.textContent = `警戒 ${combat?.wave ?? 1}/3 · 左键 / T 射击 · R 换弹 · Q 子弹时间 · X 闪避`;
        this.el('sandbox-waypoint').textContent = '柱列能阻挡枪火 · 瞄准后换位 · Trinity 掩护侧翼';
        this.el('sandbox-interact').classList.add('hidden'); return;
      }
    }
    if (!journey.visiting && journey.government && ['m1_smith_question', 'm1_bullet_dodge'].includes(scene.id)) {
      const encounter = journey.government; const questioning = encounter.kind === 'questioning'; const phase = encounter.phase;
      const close = !step || distance(player.position, filmStepPosition(scene, step)) <= 4;
      const canAct = phase === 'failed' || phase === 'alarm_ready' || phase === 'ready' && !questioning || phase === 'download_ready' && close || phase === 'done';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence').classList.toggle('urgent', phase === 'bullet_time' || phase === 'failed');
      this.el('film-sequence-line').textContent = governmentText(encounter);
      this.el('film-sequence-hint').textContent = phase === 'ready' && questioning ? 'J 打开手记，选择 Morpheus 如何守住锡安密码 · 等待不会替你回答'
        : phase === 'monologue' ? `按住 G 保持清醒 · 意志 ${Math.round((encounter.resolve ?? 0) * 100)}% · 松开会持续下降`
        : phase === 'alarm_ready' ? '走到落地窗前 · G 继续 · 暂停或重连会保留审讯结果'
        : phase === 'ready' ? 'G 举枪开火 · V 切换视角 · 当前检查点自动保存'
        : phase === 'opening' ? 'Jones 正在闪过 Neo 的弹道 · 准备按 X'
        : phase === 'bullet_time' ? '弹道贴近时按 X · 可以承受一次擦伤，第二次会从屋顶检查点重试'
        : phase === 'download_ready' ? '走到 B-212 驾驶舱旁 · G 呼叫 Tank 下载驾驶程序'
        : phase === 'failed' ? 'G 从本段检查点重试 · 已完成剧情与哲学选择仍然保留'
        : governmentLocked(journey) ? '鼠标环顾 · V 切换主视角与场景镜头 · 当前一拍自动保存' : 'G 继续下一段 · J 查看手记';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = phase === 'failed' ? '从检查点重试' : phase === 'alarm_ready' ? '见证警报打断审讯'
        : phase === 'ready' ? '向屋顶飞行员开火' : phase === 'download_ready' ? '请求 B-212 驾驶程序' : '继续营救';
      if (governmentLocked(journey)) this.el('sandbox-waypoint').textContent = '';
      const duration = phase === 'monologue' ? GOVERNMENT_RESCUE.questioning.monologue : phase === 'alarm' ? GOVERNMENT_RESCUE.questioning.alarm
        : phase === 'opening' ? GOVERNMENT_RESCUE.rooftop.opening : phase === 'bullet_time' ? GOVERNMENT_RESCUE.rooftop.finish
        : phase === 'trinity' ? GOVERNMENT_RESCUE.rooftop.trinity : phase === 'downloading' ? GOVERNMENT_RESCUE.rooftop.download : 0;
      this.el('sandbox-job').style.width = duration ? `${Math.min(100, encounter.elapsed / duration * 100)}%` : '0';
      document.getElementById('game-objective')!.textContent = questioning ? '政府大楼 · Smith 的审讯' : '政府大楼 · 屋顶交火';
      document.getElementById('game-objective-copy')!.textContent = questioning ? phase === 'monologue' ? `守住接入密码 · 意志 ${Math.round((encounter.resolve ?? 0) * 100)}%` : governmentText(encounter)
        : phase === 'bullet_time' ? `躲避 ${encounter.dodges ?? 0}/3 · 擦伤 ${encounter.wounds ?? 0}/1 · X 闪避` : governmentText(encounter);
      if (!questioning) this.el('sandbox-trace').textContent = `弹道躲避 ${encounter.dodges ?? 0}/3 · 擦伤 ${encounter.wounds ?? 0}/1`;
      return;
    }
    if (!journey.visiting && journey.airRescue && ['m1_helicopter', 'm1_rooftop_rescue'].includes(scene.id)) {
      const encounter = journey.airRescue; const office = encounter.kind === 'office'; const phase = encounter.phase;
      const canAct = phase === 'ready' || phase === 'failed' || phase === 'done';
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', phase === 'leap_window' || phase === 'bracing' || phase === 'failed');
      this.el('film-sequence-line').textContent = airRescueText(encounter);
      this.el('film-sequence-hint').textContent = office
        ? phase === 'ready' ? '按住 G 开始接近 · V 切换主视角与场景镜头'
          : phase === 'approach' ? '稳住安全扣 · 等待侧舱进入射界'
            : phase === 'firing' ? `持续按住 G 压制特工 · 火力 ${Math.round((encounter.suppression ?? 0) * 100)}%`
              : phase === 'leap_window' ? '绳索经过 Morpheus 上方时按 X 跃出抓住他'
                : phase === 'catching' ? '抓紧 Morpheus · 镜头与动作进度会自动保存'
                  : phase === 'failed' ? '按 G 从 B-212 接近检查点重试' : '按 G 进入屋顶绳索接应'
        : phase === 'ready' ? '按住 G 抓紧救援绳 · V 切换主视角与场景镜头'
          : phase === 'impact' ? '持续按住 G · 准备承受绳索冲击'
            : phase === 'bracing' ? `保持 G · 绳索绷紧时按 X · 握力 ${Math.round((encounter.grip ?? 0) * 100)}%`
              : phase === 'pulling' ? '稳住屋顶边缘，把 Trinity 拉离撞击幕墙'
                : phase === 'failed' ? '按 G 从屋顶绳索检查点重试' : '按 G 继续下一段 · J 查看手记';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = phase === 'failed' ? '从本段检查点重试' : phase === 'done' ? '继续营救后的故事'
        : office ? '开始 B-212 空中接应' : '抓住连接 Trinity 的救援绳';
      if (airRescueLocked(journey)) this.el('sandbox-waypoint').textContent = '';
      const duration = office ? phase === 'approach' ? AIR_RESCUE.office.approach : phase === 'firing' ? AIR_RESCUE.office.fire
        : phase === 'leap_window' ? AIR_RESCUE.office.leapWindow : phase === 'catching' ? AIR_RESCUE.office.catching : 0
        : phase === 'impact' ? AIR_RESCUE.roof.impact : phase === 'bracing' ? AIR_RESCUE.roof.duration
          : phase === 'pulling' ? AIR_RESCUE.roof.pulling : 0;
      this.el('sandbox-job').style.width = duration ? `${Math.min(100, encounter.elapsed / duration * 100)}%` : '0';
      document.getElementById('game-objective')!.textContent = office ? '政府大楼 · 空中接应' : '政府大楼 · 屋顶绳索';
      document.getElementById('game-objective-copy')!.textContent = office && phase === 'firing'
        ? `打碎幕墙并压制三名特工 · 火力 ${Math.round((encounter.suppression ?? 0) * 100)}%`
        : !office && phase === 'bracing'
          ? `稳住 ${encounter.braces ?? 0}/3 · 失手 ${encounter.misses ?? 0}/1 · 握力 ${Math.round((encounter.grip ?? 0) * 100)}%`
          : airRescueText(encounter);
      this.el('sandbox-trace').textContent = office ? `B-212 火力 ${Math.round((encounter.suppression ?? 0) * 100)}%`
        : `绳索握力 ${Math.round((encounter.grip ?? 1) * 100)}% · 稳住 ${encounter.braces ?? 0}/3`;
      return;
    }
    if (!journey.visiting && journey.matrixEscape && ['m1_subway', 'm1_city_chase'].includes(scene.id)) {
      const encounter = journey.matrixEscape; const phase = encounter.phase; const subway = encounter.kind === 'subway';
      const windup = state.threats.some(threat => threat.scene === scene.id && threat.attackAt !== undefined && threat.attackAt > this.tick);
      const timedEvade = phase === 'train_window' || phase === 'truck_window';
      const canAct = ['ready', 'failed', 'door_ready', 'done'].includes(phase);
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', phase === 'failed' || windup || timedEvade || encounter.pursuit > .72);
      this.el('film-sequence-line').textContent = matrixEscapeText(encounter);
      this.el('film-sequence-hint').textContent = phase === 'ready' ? subway ? '走到出口电话旁 · G 接听 · V 切换视角' : 'G 接收 Tank 的路线 · V 切换视角'
        : phase === 'duel' ? windup ? '红色起手出现 · 现在按 X 闪避，再按 F 反击' : `观察 Smith 起手 · F 反击 ${encounter.hits}/${MATRIX_ESCAPE.subway.requiredHits} · X 闪避 ${encounter.dodges}/${MATRIX_ESCAPE.subway.requiredDodges}`
        : phase === 'running' ? `WASD 改变方向 · Shift 奔跑 · F 击退当前身体 · 追捕压力 ${Math.round(encounter.pursuit * 100)}%`
        : phase === 'train_window' ? `列车头灯接近第三根立柱 · ${Math.abs(encounter.elapsed - MATRIX_ESCAPE.subway.trainBeat) <= MATRIX_ESCAPE.subway.trainWindow ? '现在按 X！' : '准备按 X 翻回站台'}`
        : phase === 'truck_window' ? `垃圾车正在封巷 · ${Math.abs(encounter.elapsed - MATRIX_ESCAPE.city.truckBeat) <= MATRIX_ESCAPE.city.truckWindow ? '现在按 X！' : '盯住右侧缺口，准备按 X'}`
        : phase === 'failed' ? 'G 从最近检查点重试 · 已完成的剧情不会丢失'
        : phase === 'door_ready' ? '走到 303 楼梯门前 · G 冲进旅馆'
        : phase === 'done' ? 'G 继续下一段 · J 查看这次撤离'
        : matrixEscapeLocked(journey) ? '鼠标环顾 · V 切换主视角与场景镜头 · 当前一拍自动保存' : 'WASD 移动 · Shift 奔跑';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = phase === 'failed' ? '从检查点重试' : phase === 'door_ready' ? '进入 303 楼梯门'
        : phase === 'done' ? '继续下一段' : subway ? '接听出口电话' : '接收 Tank 的撤离路线';
      const actions = this.el('film-training-actions'); const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!; const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      if (phase === 'duel' || timedEvade) {
        actions.classList.remove('hidden'); dodge.classList.remove('hidden'); dodge.disabled = phase === 'duel' && !windup;
        attack.classList.toggle('hidden', phase !== 'duel'); attack.querySelector('span')!.textContent = '反击';
      }
      const duration = matrixEscapeDuration(encounter);
      const progress = phase === 'duel' ? (encounter.hits + encounter.dodges) / (MATRIX_ESCAPE.subway.requiredHits + MATRIX_ESCAPE.subway.requiredDodges) * 100
        : phase === 'running' ? encounter.pursuit * 100 : duration ? encounter.elapsed / duration * 100 : 0;
      this.el('sandbox-job').style.width = `${Math.min(100, progress)}%`;
      if (matrixEscapeLocked(journey) || phase === 'duel') this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective')!.textContent = subway ? '地铁站 · 不再逃跑' : 'Tank 指引的街巷';
      document.getElementById('game-objective-copy')!.textContent = phase === 'duel'
        ? `有效命中 ${encounter.hits}/${MATRIX_ESCAPE.subway.requiredHits} · 成功闪避 ${encounter.dodges}/${MATRIX_ESCAPE.subway.requiredDodges}`
        : phase === 'running' ? `路线 ${encounter.segment + 1}/3 · 追捕压力 ${Math.round(encounter.pursuit * 100)}% · 保持移动会降低增长速度` : matrixEscapeText(encounter);
      this.el('sandbox-trace').textContent = subway ? `站台交锋 ${encounter.hits}/${MATRIX_ESCAPE.subway.requiredHits} · 闪避 ${encounter.dodges}`
        : `路线 ${encounter.segment + 1}/3 · Smith 换体 ${encounter.possessions} 次`;
      return;
    }
    if (!journey.visiting && journey.theOne && ['m1_death', 'm1_return', 'm1_final_call'].includes(scene.id)) {
      const encounter = journey.theOne; const phase = encounter.phase;
      const windup = state.threats.some(threat => threat.scene === scene.id && threat.attackAt !== undefined && threat.attackAt > this.tick);
      const bulletBeat = phase === 'bullet_window' && Math.abs(encounter.elapsed - THE_ONE.return.bulletBeat) <= THE_ONE.return.bulletWindow;
      const exitRemaining = THE_ONE.return.exitDeadline - encounter.deadline;
      const close = !step || distance(player.position, filmStepPosition(scene, step)) < 4;
      const canAct = phase === 'done' || phase === 'failed' || phase === 'exit_ready' || phase === 'call_ready' && close
        || phase === 'ready' && (encounter.kind !== 'death' || journey.step === 1 && close);
      this.el('film-sequence').classList.remove('hidden');
      this.el('film-sequence').classList.toggle('urgent', phase === 'failed' || bulletBeat || windup || phase === 'exit_run' && exitRemaining <= 4);
      this.el('film-sequence-line').textContent = theOneText(encounter);
      this.el('film-sequence-hint').textContent = encounter.kind === 'death'
        ? phase === 'ready' ? journey.step === 0 ? 'WASD 前往 303 房门 · V 切换主视角与场景镜头' : 'G 推开房门 · 之后每个表演拍点都会保存'
          : phase === 'listening' ? `按住 G 追随 Trinity 的声音 · 信号 ${Math.round(encounter.signal * 100)}%`
            : phase === 'done' ? 'G 继续 · Neo 已在旅馆走廊重新站起' : '鼠标观察 · V 切换主视角与场景镜头 · 当前一拍自动保存'
        : encounter.kind === 'return'
          ? phase === 'ready' ? 'G 看穿代码 · V 切换主视角与场景镜头'
            : phase === 'bullet_window' ? bulletBeat ? '现在按 X 停住弹群！' : '盯住逼近的子弹 · 进入代码视野中心时按 X'
              : phase === 'counter' ? windup ? '红色起手出现 · 现在按 X 格挡，再按 F 反击' : `靠近 Smith · F 反击 ${encounter.hits}/${THE_ONE.return.requiredHits} · 等红色起手再按 X`
                : phase === 'exit_run' ? `WASD / Shift 冲向走廊尽头 · 剩余 ${Math.max(0, Math.ceil(exitRemaining))} 秒`
                  : phase === 'exit_ready' ? 'G 接听出口电话 · Morpheus 会等 Neo 离线后再启动 EMP'
                    : phase === 'failed' ? 'G 从最近的觉醒检查点重试' : phase === 'done' ? 'G 继续最终通话 · J 查看手记'
                      : '鼠标观察 · V 切换主视角与场景镜头 · 当前一拍自动保存'
          : phase === 'ready' ? 'G / J 打开手记，决定如何使用这份力量'
            : phase === 'call_ready' ? '走近街角电话亭 · G 接通系统线路'
              : phase === 'takeoff_ready' ? '按住空格离地 · 起飞后 WASD 改变方向，Shift 加速'
                : phase === 'takeoff' ? `WASD 调整航向 · Shift 加速 · 高度 ${Math.round(encounter.altitude)} / ${THE_ONE.flight.maxAltitude} m`
                  : phase === 'done' ? 'G 保存第一部结局并继续 · V 可在空中切换视角' : '鼠标观察 · V 切换主视角与场景镜头';
      this.el('sandbox-interact').classList.toggle('hidden', !canAct);
      this.el('sandbox-nearby').textContent = phase === 'failed' ? '从觉醒检查点重试' : phase === 'done' ? '继续下一段'
        : encounter.kind === 'death' ? '推开 303 房门' : phase === 'exit_ready' ? '接听出口电话'
          : encounter.kind === 'flight' && phase === 'ready' ? '在手记中作出选择' : encounter.kind === 'flight' ? '接通系统线路' : '看见 Matrix 代码';
      const actions = this.el('film-training-actions'); const dodge = actions.querySelector<HTMLButtonElement>('[data-combat="dodge"]')!; const attack = actions.querySelector<HTMLButtonElement>('[data-combat="attack"]')!;
      if (phase === 'bullet_window' || phase === 'counter') {
        actions.classList.remove('hidden'); dodge.classList.remove('hidden'); dodge.disabled = phase === 'bullet_window' ? !bulletBeat : !windup;
        attack.classList.toggle('hidden', phase !== 'counter'); attack.disabled = false; attack.querySelector('span')!.textContent = '反击';
      }
      const duration = theOneDuration(encounter);
      const progress = phase === 'listening' ? encounter.signal * 100 : phase === 'counter'
        ? (encounter.hits + encounter.blocks) / (THE_ONE.return.requiredHits + THE_ONE.return.requiredBlocks) * 100
        : phase === 'exit_run' ? encounter.deadline / THE_ONE.return.exitDeadline * 100
          : phase === 'takeoff' || phase === 'done' && encounter.kind === 'flight' ? encounter.altitude / THE_ONE.flight.maxAltitude * 100
            : duration ? encounter.elapsed / duration * 100 : 0;
      this.el('sandbox-job').style.width = `${Math.min(100, progress)}%`;
      document.getElementById('game-objective')!.textContent = encounter.kind === 'death' ? '303 · 死亡与声音'
        : encounter.kind === 'return' ? '看见代码 · 成为 The One' : '电话之后的天空';
      document.getElementById('game-objective-copy')!.textContent = theOneText(encounter);
      this.el('sandbox-trace').textContent = encounter.kind === 'death' ? `连接信号 ${Math.round(encounter.signal * 100)}%`
        : encounter.kind === 'return' ? phase === 'exit_run' ? `出口剩余 ${Math.max(0, Math.ceil(exitRemaining))} 秒` : `格挡 ${encounter.blocks}/${THE_ONE.return.requiredBlocks} · 反击 ${encounter.hits}/${THE_ONE.return.requiredHits}`
          : `飞行高度 ${Math.round(encounter.altitude)} / ${THE_ONE.flight.maxAltitude} m`;
      if (step && (phase === 'exit_run' || phase === 'call_ready' || encounter.kind === 'death' && phase === 'ready')) {
        const target = filmStepPosition(scene, step); const direction = Math.atan2(target.x - player.position.x, target.z - player.position.z) - player.rotation;
        this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${step.label} <b>${Math.round(distance(target, player.position))} m</b>`;
      } else if (theOneLocked(journey) || phase === 'counter' || phase === 'takeoff_ready' || phase === 'done') this.el('sandbox-waypoint').textContent = '';
      return;
    }
    if (scene.id === 'm1_office_escape' && journey.office && !journey.office.outcome && !journey.visiting) {
      if (windowCrossing(journey)) {
        this.el('film-phone').classList.remove('hidden'); this.el('film-phone-line').textContent = journey.lastText;
        this.el('film-alert').style.width = `${journey.office.alert}%`; this.el('film-alert-label').textContent = '撑稳窗沿 · 跨腿后落到外侧窄台';
        this.el('sandbox-interact').classList.add('hidden'); this.el('sandbox-waypoint').textContent = '';
        document.getElementById('game-objective-copy')!.textContent = '正在跨窗 · 动作进度自动保存'; return;
      }
      const opening = windowOpening(journey);
      this.el('sandbox-interact').classList.toggle('hidden', opening || step?.kind === 'reach' || distance(player.position, filmStepPosition(scene, step ?? scene.steps[2])) > 4);
      this.el('film-phone').classList.remove('hidden');
      this.el('film-phone-line').textContent = opening && !journey.office.spotted ? journey.lastText : journey.office.guide.replace('MORPHEUS · ', '');
      this.el('film-alert').style.width = `${journey.office.alert}%`;
      this.el('film-alert-label').textContent = `${journey.office.spotted && journey.office.alert >= 65 ? '已被认出 · 拉开距离，绕到遮挡后' : `警觉 ${Math.round(journey.office.alert)}% · ${opening ? '转动把手、推开窗扇' : '按住 Z 潜行'}`} · 特工靠近才会被捕`;
      this.el('sandbox-trace').textContent = journey.office.spotted ? '特工看到了你 · 立即换位' : journey.office.searches?.some(Boolean) ? '检查最后踪迹 · 避开原位置' : '特工巡逻中 · 留意朝向';
    }
    if (['m1_office_escape', 'm1_ledge'].includes(scene.id) && journey.office?.outcome === 'captured' && !step && !journey.visiting) {
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = 'G 继续审讯后的故事 · 已完成的生活与调查仍然保留';
      this.el('sandbox-nearby').textContent = '被特工带走 · 继续故事';
      document.getElementById('game-objective-copy')!.textContent = '你被捕了，故事仍会继续 · G 进入审讯';
    }
    if (scene.id === 'm1_pills' && step?.kind === 'reflect') this.el('sandbox-nearby').textContent = '选择红色或蓝色药丸';
    if (scene.id === 'm1_ledge' && step?.kind === 'reach' && !journey.visiting) this.el('sandbox-interact').classList.add('hidden');
    if (scene.id === 'm1_ledge' && journey.office?.climbed !== undefined && !journey.visiting) {
      this.el('film-phone').classList.remove('hidden');
      this.el('film-phone-line').textContent = '抓稳横档，慢慢往下。维修平台就在下面。';
      this.el('film-alert').style.width = `${journey.office.climbed / 32 * 100}%`;
      this.el('film-alert-label').textContent = `已下降 ${Math.round(journey.office.climbed / 2)} / 16 m · W 向下 · S 向上 · 松手停留`;
      document.getElementById('game-objective-copy')!.textContent = '沿维修梯抵达下方平台 · 可停在横档上观察';
      this.el('sandbox-waypoint').textContent = '↓ 维修平台'; this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (scene.id === 'm3_dock_battle' && journey.dockGunnery?.phase === 'firing' && !journey.visiting) {
      const gunner = journey.dockGunnery;
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'MIFUNE / APU 双炮';
      this.el('film-ride-speed').textContent = `${gunner.ammo} 发`;
      this.el('film-ride-health').textContent = `机甲 ${Math.ceil(gunner.hull)}% · Kid ${Math.ceil(gunner.kidHealth)}% · 击落 ${gunner.kills}/${gunner.targets.length}`;
      this.el('film-ride-controls').textContent = '鼠标瞄准 · 左键 / T 开炮 · 保护弹药车';
      document.getElementById('game-objective-copy')!.textContent = '瞄准迎面飞来的哨兵 · Kid 正推着弹药车接近炮位';
      this.el('sandbox-interact').classList.add('hidden'); this.el('sandbox-waypoint').textContent = ''; return;
    }
    if (scene.id === 'm3_hammer_tunnels' && journey.hammer?.phase === 'riding' && !journey.visiting) {
      const flight = journey.hammer;
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'NIOBE / HAMMER';
      this.el('film-ride-controls').textContent = 'W 推进 · S 制动 · A / D 侧向推进';
      this.el('film-ride-speed').textContent = `${Math.round(flight.speed * 3.6)} km/h`;
      this.el('film-ride-health').textContent = `船体 ${Math.ceil(flight.hull)}% · 哨兵 ${Math.ceil(flight.pursuit)}% · ${flight.antennaLost ? '通讯已断' : '通讯正常'}`;
      this.el('sandbox-waypoint').textContent = `锡安管线出口 ↑ ${Math.max(0, Math.round(flight.z + 175))} m`;
      document.getElementById('game-objective-copy')!.textContent = '沿机械管线转弯，避开横梁 · 低速会让哨兵追上';
      this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (scene.id === 'm3_gate' && journey.apu?.phase === 'riding' && !journey.visiting) {
      const run = journey.apu;
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'KID / APU 03';
      this.el('film-ride-controls').textContent = 'W 前进 · S 制动 · A / D 横向避让';
      this.el('film-ride-speed').textContent = `${Math.round(run.speed * 3.6)} km/h`;
      this.el('film-ride-health').textContent = `机甲 ${Math.ceil(run.hull)}% · 哨兵撞击 ${run.hits} 次 · 剩余 ${Math.ceil(Math.max(0, 18 - run.elapsed))} 秒`;
      this.el('sandbox-waypoint').textContent = `三号闸门 ↑ ${Math.max(0, Math.round(run.z + 50))} m`;
      document.getElementById('game-objective-copy')!.textContent = '沿船坞通道驶向闸门 · 看准哨兵俯冲位置并绕开';
      this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (scene.id === 'm3_emp' && !journey.visiting) {
      this.el('sandbox-trace').textContent = dockPowerOffline(journey) ? 'EMP 已触发 · 船坞自动防御失效' : 'EMP 已充能 · 船坞防御仍在线';
    }
    if (scene.id === 'm3_temple_defense' && journey.templeSeal?.phase === 'running' && !journey.visiting) {
      const seal = journey.templeSeal;
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'ZEE / 神庙入口';
      this.el('film-ride-speed').textContent = `${Math.ceil(seal.remaining)} 秒`;
      this.el('film-ride-health').textContent = `自动防御失效 · 手动卡榫 ${Math.max(0, journey.step - 1)} / 2`;
      this.el('film-ride-controls').textContent = 'Shift 奔跑 · 靠近左右卡榫按 G';
      document.getElementById('game-objective-copy')!.textContent = '下一波哨兵逼近 · 在倒计时结束前锁住入口';
    }
    if (scene.id === 'm2_garage' && journey.garage?.phase === 'riding' && !journey.visiting) {
      const escape = journey.garage;
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'TRINITY / KEYMAKER';
      this.el('film-ride-controls').textContent = 'W 加速 · S 刹车 · A / D 转向';
      this.el('film-ride-speed').textContent = `${Math.round(escape.speed * 3.6)} km/h`;
      this.el('film-ride-health').textContent = `车况 ${Math.ceil(escape.hull)}% · 乘员 ${Math.ceil(escape.passenger)}% · ${Math.ceil(Math.max(0, GARAGE.limit - escape.elapsed))} 秒`;
      this.el('sandbox-waypoint').textContent = `车库出口 ↑ ${Math.max(0, Math.round(escape.z - GARAGE.finish))} m`;
      document.getElementById('game-objective-copy')!.textContent = '加速穿过双子的相位 · A / D 可绕行 · 别撞混凝土护栏';
      this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (scene.id === 'm2_freeway' && journey.ride?.phase === 'riding' && !journey.visiting) {
      const ride = journey.ride;
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'TRINITY / KEYMAKER';
      this.el('film-ride-controls').textContent = 'W 加速 · S 刹车 · A / D 转向';
      this.el('film-ride-speed').textContent = `${Math.round(ride.speed * 1.8)} km/h`;
      this.el('film-ride-health').textContent = `车况 ${Math.ceil(ride.hull)}% · 钥匙匠 ${Math.ceil(ride.passenger)}%`;
      this.el('sandbox-waypoint').textContent = `接应区 ↑ ${Math.max(0, Math.round((ride.z + 660) / 2))} m`;
      document.getElementById('game-objective-copy')!.textContent = '在逆向车流中护送钥匙匠 · 留意大型卡车 · 碰撞后先刹车';
      this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (scene.id === 'm2_trucks' && journey.trucks?.phase === 'collision' && !journey.visiting) {
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'MORPHEUS / KEYMAKER';
      this.el('film-ride-speed').textContent = `${Math.ceil(Math.max(0, TRUCKS.collisionSeconds - journey.trucks.elapsed))} 秒`;
      this.el('film-ride-health').textContent = '两辆卡车迎面相撞 · 保护钥匙匠';
      this.el('film-ride-controls').textContent = 'Shift 奔跑 · G 抓住钥匙匠';
      document.getElementById('game-objective-copy')!.textContent = journey.step === 1 ? '沿车顶赶到钥匙匠身边' : '在钥匙匠身边按 G 抓紧，等待 Neo 飞来';
    }
    if (scene.id === 'm2_trucks' && journey.trucks?.phase === 'rescue' && !journey.visiting) {
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-title').textContent = 'NEO / 救援';
      this.el('film-ride-speed').textContent = `${Math.ceil(Math.max(0, TRUCKS.rescueSeconds - (journey.trucks.rescueElapsed ?? 0)))} 秒`;
      this.el('film-ride-health').textContent = '带 Morpheus 与钥匙匠离开爆炸';
      this.el('film-ride-controls').textContent = 'V 切换至第一人称观察救援';
      document.getElementById('game-objective-copy')!.textContent = 'Neo 正带两人离开相撞的卡车';
      this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (scene.id === 'm1_ledge' && step?.kind === 'reflect') this.el('sandbox-nearby').textContent = '沿维修架脱身，或退回办公室';
    if (scene.id === 'm1_mirror' && journey.step === 0 && step && !journey.visiting)
      this.el('sandbox-interact').classList.toggle('hidden', distance(player.position, filmStepPosition(scene, step)) > MIRROR_TOUCH.radius);
    if (scene.id === 'm1_interrogation' && step && !journey.interrogation && !journey.visiting)
      this.el('sandbox-interact').classList.toggle('hidden', distance(player.position, filmStepPosition(scene, step)) > 4);
    if (step && !journey.visiting) {
      const target = stepTarget!; const direction = Math.atan2(target.x - player.position.x, target.z - player.position.z) - player.rotation;
      this.el('sandbox-waypoint').innerHTML = `<span style="transform:rotate(${-direction}rad)">↑</span>${step.label} <b>${Math.round(distance(target, player.position))} m</b>`;
    } else this.el('sandbox-waypoint').textContent = journey.visiting ? '回访不会改变剧情进度' : '本场景已记录';
  }

  private renderPanel(): void {
    if (!this.panel || !this.player || !this.state) return;
    const player = this.player; const state = this.state; const profile = state.profiles[player.id];
    const life = player.id === 'neo' || player.id === state.neoLife?.journey?.actor ? state.neoLife : undefined;
    const signature = JSON.stringify([this.panel, this.selectedFilm, profile.inventory, profile.xp, profile.skills, profile.trackedMission, profile.visited, state.missions, state.structures, state.incidents, Math.round(player.position.x), Math.round(player.position.z), state.ending,
      life && [life.chapter, life.day, life.money, life.cycle, Math.floor(this.time / 500), life.anomaly, life.activity, life.journal[0], life.appointment, life.journey, player.status, state.threats.length]]);
    if (signature === this.signature) return;
    this.signature = signature;
    const body = this.el('sandbox-panel-body'); const scroll = body.scrollTop;
    const expanded = [...body.querySelectorAll('details')].map(detail => detail.open);
    const neoPanel = Boolean(life && (this.panel === 'journal' || life.journey && this.panel === 'map'));
    this.el('sandbox-panel').classList.toggle('neo-panel', neoPanel);
    this.el('sandbox-panel-title').textContent = neoPanel ? '生活与故事手记' : this.panel === 'inventory' ? '生存，是你的第一段故事。' : this.panel === 'journal' ? '三部曲，你来改变走向。' : '一座持续运转的世界。';
    this.root.querySelector('.sandbox-window > header p')!.textContent = life?.journey ? '沿电影事件前进。走到目标旁按 G，完成后继续下一段。' : neoPanel ? '生活继续，选择留下痕迹。你可以随时合上手记，走进城市。' : '世界仍在运行。附近有追兵时，请先寻找安全位置。';
    this.root.querySelectorAll<HTMLElement>('.sandbox-window [data-panel]').forEach(button => button.classList.toggle('active', button.dataset.panel === this.panel));
    this.el('sandbox-profile').textContent = neoPanel ? `${player.name} · 第 ${life!.cycle} 轮 · 自动保存生活、证据和选择` : `${player.name} · 等级 ${1 + Math.floor(profile.xp / 50)} · ${profile.xp} XP · 可用技能点 ${skillPoints(profile)}`;
    if (neoPanel) {
      body.innerHTML = renderNeoLife(player, state, this.time);
    } else if (this.panel === 'inventory') {
      body.innerHTML = `<div class="inventory-summary"><span>代码 <b>${profile.inventory.code}</b></span><span>零件 <b>${profile.inventory.scrap}</b></span><span>技能点 <b>${skillPoints(profile)}</b></span></div>
        <p class="sandbox-help">搜集物资箱和数据终端 → 制作补给 → 搭建安全屋 → 挑战任务。设施放置在面前 9 米处；靠近安全屋可恢复生命和消除追踪。</p>
        <div class="craft-grid">${Object.entries(RECIPES).map(([id, cost]) => {
          const item = ITEMS[id as ItemId]; const enough = Object.entries(cost!).every(([part, n]) => profile.inventory[part as ItemId] >= n!);
          return `<article class="craft-card"><span class="craft-icon">${item.symbol}</span><div><h3>${item.name} <small>×${profile.inventory[id as ItemId]}</small></h3><p>${item.description}</p><div class="craft-cost">${Object.entries(cost!).map(([part, n]) => `${ITEMS[part as ItemId].name} ${profile.inventory[part as ItemId]}/${n}`).join(' · ')}</div></div><button data-action="craft" data-target="${id}" ${enough ? '' : 'disabled'}>制作</button></article>`;
        }).join('')}</div><h3 class="sandbox-section-label">能力下载</h3><div class="skill-grid">${Object.entries(SKILLS).map(([id, skill]) => `<article><h3>${skill.name} <small>${profile.skills[id as SkillId]} / 3</small></h3><p>${skill.description}</p><button data-action="upgrade" data-target="${id}" ${skillPoints(profile) > 0 && profile.skills[id as SkillId] < 3 ? '' : 'disabled'}>下载 · 1 技能点</button></article>`).join('')}</div>
        <h3 class="sandbox-section-label">附近的设施</h3><div class="structure-list">${state.structures.filter(s => !s.film && s.matrix === player.isInMatrix && distance(s.position, player.position) < 50).map(s => `<div>${ITEMS[s.kind].name} · 耐久 ${s.health}<button data-action="dismantle" data-target="${s.id}" ${s.owner === player.id && distance(s.position, player.position) < 16 ? '' : 'disabled'}>拆回背包</button></div>`).join('') || '<p>附近没有设施。按 3 搭建安全屋，按 4 放置路障。</p>'}</div>`;
    } else if (this.panel === 'journal') {
      body.innerHTML = `<div class="trilogy-tabs">${FILMS.map(film => `<button data-film="${film.number}" class="${film.number === this.selectedFilm ? 'active' : ''}"><small>0${film.number} / ${film.subtitle}</small><strong>${film.title}</strong><span>${film.theme}</span></button>`).join('')}</div>
        <div class="world-stakes"><span>系统警戒 <b>${state.security}%</b></span><span>Smith 感染 <b>${state.corruption}%</b></span><span>锡安防御 <b>${state.zion}%</b></span></div>
        ${state.ending !== 'open' ? `<div class="ending-note">${state.ending === 'peace' ? '停战协议已经生效' : state.ending === 'reboot' ? '矩阵已重载，记忆依旧存在' : '真相已经公开'}。你可以继续探索、建造和改变世界。</div>` : ''}
        <div class="mission-list">${MISSIONS.filter(m => m.film === this.selectedFilm).map(mission => {
          const progress = state.missions[mission.id]; const close = player.isInMatrix === (LOCATIONS[mission.location].world === 'matrix') && distance(player.position, missionPosition(mission.id)) < 14;
          return `<article class="mission-card ${progress.status}"><div class="mission-heading"><span>${({ locked: '未解锁', available: '可参与', active: '进行中', complete: '已完成' })[progress.status]}</span><small>${LOCATIONS[mission.location].nameCn} · +${mission.reward} XP</small></div><h3>${mission.name}</h3><p>${mission.description}</p><div class="mission-objective">${mission.objective}</div>
          ${progress.outcome ? `<p class="mission-outcome">你的选择：${escape(mission.choices?.find(c => c.id === progress.outcome)?.label)}</p>` : ''}
          ${progress.escort ? `<p>护送 ${progress.progress}% · 钥匙匠生命 ${progress.escort.health} / 100</p>` : ''}
          ${progress.stage === 'combat' && progress.status === 'active' ? `<p>仍有 ${state.threats.filter(t => t.mission === mission.id).length} 个敌对程序，返回世界用 F 或 EMP 战斗。</p>` : ''}
          ${progress.status === 'locked' ? `<small>先完成「${MISSIONS.find(m => m.id === mission.requires)?.name}」</small>` : progress.status !== 'complete' ? `<div class="mission-actions"><button data-action="track" data-target="${mission.id}">${profile.trackedMission === mission.id ? '已追踪 · 返回世界' : '追踪线索 ↗'}</button><button data-action="interact" data-target="mission:${mission.id}" ${close ? '' : 'disabled'}>接通任务终端</button></div>` : ''}
          ${progress.stage === 'choice' && progress.status === 'active' ? `<div class="mission-choices">${mission.choices?.map(choice => `<button data-action="choose" data-target="${mission.id}:${choice.id}" ${close ? '' : 'disabled'}><strong>${choice.label}</strong><span>${choice.consequence}</span></button>`).join('')}</div>${close ? '' : '<small>回到任务终端旁才能决定。</small>'}` : ''}</article>`;
        }).join('')}</div>`;
    } else {
      const transit = nearTransit(player, state);
      const destinations = Object.values(LOCATIONS).filter(l => l.id !== 'downtown' && (profile.visited.includes(l.id) || MISSIONS.some(m => m.location === l.id && state.missions[m.id].status !== 'locked')));
      body.innerHTML = `<div class="world-map-wrap"><canvas id="sandbox-world-map" width="960" height="600" aria-label="世界地图：任务、电话、物资和当前位置"></canvas><span>▲ 你　◇ 任务　• 物资　✚ 安全屋　○ 随机事件</span></div>
        <p class="sandbox-help">${transit ? '电话网络已连接，可以接入下面的地点。' : '靠近接入电话或安全屋 18 米以内，可以在已发现地点与已解锁任务之间旅行。'} 未知地点可以步行探索。</p>
        <div class="destination-grid">${destinations.map(location => `<article><div><strong>${location.nameCn}</strong><small>${location.world === 'matrix' ? 'MATRIX' : '真实世界'}</small></div><button data-waypoint="phone:${location.id}">标记</button><button data-action="transit" data-target="${location.id}" ${transit ? '' : 'disabled'}>接入 ↗</button></article>`).join('')}</div>
        <h3 class="sandbox-section-label">正在发生</h3><div class="incident-list">${state.incidents.map(incident => `<article><div><h3>${incident.name}</h3><p>${incident.description}</p><small>${LOCATIONS[incident.location]?.nameCn ?? incident.location} · 信号剩余约 ${Math.max(0, Math.ceil((incident.expiresAt - this.tick) / 2))} 秒</small></div><button data-waypoint="${incident.id}">标记 ↗</button></article>`).join('') || '<p>暂时没有新信号。世界会在自然运行中产生遭遇。</p>'}</div>`;
      this.drawWorldMap();
    }
    body.querySelectorAll('details').forEach((detail, index) => { detail.open = expanded[index] ?? detail.open; });
    body.scrollTop = scroll;
  }
  private drawMinimap(): void {
    if (!this.player || !this.state) return;
    const canvas = document.getElementById('game-minimap') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!; const player = this.player;
    const journey = this.state.neoLife?.journey; const scene = journey && FILM_SCENE_BY_ID[journey.scene]; const step = scene?.steps[journey!.step];
    if (journey?.actor === player.id && !journey.visiting && scene && step) {
      const door = scene.id === 'm1_bridge' && journey.step === 1 && journey.bridgeArrival?.parkedRoadTime !== undefined
        ? meetingBoardPoint(journey.bridgeArrival) : undefined;
      const position = door ? filmPosition(scene.set, door.x, door.z)
        : scene.id === 'm1_bug' && journey.step === 1 && journey.meeting?.phase === 'done' ? player.position : filmStepPosition(scene, step);
      ctx.strokeStyle = '#eac987'; ctx.beginPath(); ctx.arc(180 + (position.x - player.position.x) * .75, 115 + (position.z - player.position.z) * .75, 4, 0, Math.PI * 2); ctx.stroke();
    }
    for (const node of [...this.state.nodes, ...this.state.incidents, ...this.state.structures]) {
      if (node.matrix !== player.isInMatrix || distance(node.position, player.position) > 230) continue;
      if (node.kind === 'mission' && ['locked', 'complete'].includes(this.state.missions[node.id.slice(8)]?.status)) continue;
      const x = 180 + (node.position.x - player.position.x) * .75; const y = 115 + (node.position.z - player.position.z) * .75;
      ctx.fillStyle = node.kind === 'mission' ? '#f6ce85' : node.kind === 'phone' || node.kind === 'beacon' ? '#a1edc5' : '#79b5c1';
      ctx.fillRect(x - 2, y - 2, node.kind === 'mission' ? 6 : 4, node.kind === 'mission' ? 6 : 4);
    }
    for (const threat of this.state.threats.filter(t => t.matrix === player.isInMatrix)) {
      ctx.fillStyle = '#fb857e'; ctx.beginPath(); ctx.arc(180 + (threat.position.x - player.position.x) * .75, 115 + (threat.position.z - player.position.z) * .75, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (player.isInMatrix) for (const mission of Object.values(this.state.missions)) if (mission.escort) {
      const x = 180 + (mission.escort.position.x - player.position.x) * .75; const y = 115 + (mission.escort.position.z - player.position.z) * .75;
      ctx.strokeStyle = '#b8f8c8'; ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#b8f8c8'; ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }
  private drawWorldMap(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>('#sandbox-world-map');
    if (!canvas || !this.player || !this.state) return;
    const ctx = canvas.getContext('2d')!; const matrix = this.player.isInMatrix;
    const minX = matrix ? 0 : 1950; const minZ = matrix ? 0 : 2260; const scale = matrix ? .22 : 1.5;
    const point = (position: Vector3) => [(position.x - minX) * scale + (matrix ? 190 : 0), (position.z - minZ) * scale];
    ctx.fillStyle = '#0b1c17'; ctx.fillRect(0, 0, 960, 600);
    ctx.strokeStyle = '#254237'; ctx.lineWidth = 1;
    for (let x = 0; x < 2560; x += 80) { const [px] = point({ x, y: 0, z: 0 }); ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, 600); ctx.stroke(); }
    for (let z = 0; z < 2800; z += 80) { const [, pz] = point({ x: 0, y: 0, z }); ctx.beginPath(); ctx.moveTo(0, pz); ctx.lineTo(960, pz); ctx.stroke(); }
    if (matrix) for (const building of CITY_BUILDINGS) { const [x, z] = point({ x: building.x, y: 0, z: building.z }); ctx.fillStyle = '#274137'; ctx.fillRect(x - building.width * scale / 2, z - building.depth * scale / 2, building.width * scale, building.depth * scale); }
    for (const node of this.state.nodes.filter(n => n.matrix === matrix && n.kind === 'phone' || n.matrix === matrix && n.kind === 'mission' && this.state!.missions[n.id.slice(8)].status !== 'locked')) {
      const [x, y] = point(node.position); ctx.fillStyle = node.kind === 'mission' ? '#ebc681' : '#75b897';
      ctx.fillRect(x - 4, y - 4, 8, 8); ctx.font = '14px "PingFang SC", sans-serif';
      if (node.kind === 'mission' && node.id === `mission:${this.state.profiles[this.player.id].trackedMission}`) ctx.fillText(node.name, x + 10, y - 7);
    }
    for (const incident of this.state.incidents.filter(n => n.matrix === matrix)) { const [x, y] = point(incident.position); ctx.strokeStyle = '#ee917a'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke(); }
    for (const structure of this.state.structures.filter(s => !s.film && s.matrix === matrix)) { const [x, y] = point(structure.position); ctx.fillStyle = '#a5e8b9'; ctx.fillRect(x - 6, y - 1, 12, 2); ctx.fillRect(x - 1, y - 6, 2, 12); }
    const [x, y] = point(this.player.position); ctx.fillStyle = '#e1ffd1'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e1ffd180'; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
  }
  dispose(): void { this.close(); this.root.remove(); }
}
