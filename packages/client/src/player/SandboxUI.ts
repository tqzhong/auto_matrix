import { FILM_SETS, FILM_SCENES, FILM_SCENE_BY_ID, FILM_NAMES, filmStepPosition, pillLocked, lafayetteWelcomeLocked, awakeningLocked, windowOpening, windowCrossing, ITEMS, RECIPES, SKILLS, FILMS, MISSIONS, LOCATIONS, CITY_BUILDINGS, NEO_CHAPTERS, LIFE_ACTIONS, lifeActionPosition, lifeRoomCenter, locationEntrance, distance, missionPosition, nearTransit, skillPoints,
  type AgentState, type SandboxState, type SandboxCommand, type ItemId, type SkillId, type Vector3 } from '@auto_matrix/shared';
import './sandbox.css';
import { renderNeoLife } from './NeoLifePanel.js';
import { interrogationLocked, interrogationPose } from '@auto_matrix/shared';
import { meetingLocked, MEETING_TIMING } from '@auto_matrix/shared';
import { filmPosition, HOTEL_DOOR_PROGRESS } from '@auto_matrix/shared';

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
  private waypoint: { position: Vector3; matrix: boolean; name: string } | null = null;

  constructor(private send: (command: SandboxCommand) => void, private menu: (open: boolean) => void) {
    this.root.id = 'sandbox-overlay'; this.root.className = 'hidden';
    this.root.innerHTML = `
      <div id="film-blackout" class="film-blackout" aria-hidden="true"></div>
      <div class="sandbox-clock"><span id="sandbox-clock"></span><span id="sandbox-weather"></span><span id="sandbox-trace"></span></div>
      <nav class="sandbox-nav" aria-label="沙盒玩法"><button data-panel="inventory"><kbd>B</kbd> 背包与制作</button><button data-panel="journal"><kbd>J</kbd> 三部曲日志</button><button data-panel="map"><kbd>M</kbd> 世界地图</button></nav>
      <div id="sandbox-waypoint" class="sandbox-waypoint"></div>
      <div id="film-phone" class="film-phone hidden"><span>SECURE LINE / MORPHEUS</span><p id="film-phone-line"></p><div><i id="film-alert"></i></div><small id="film-alert-label"></small></div>
      <div id="film-sequence" class="film-sequence hidden"><p id="film-sequence-line"></p><small id="film-sequence-hint">鼠标观察 · V 切换视角 · J 手记</small></div>
      <div id="film-pills" class="film-pills hidden" role="group" aria-label="选择药丸"><p>选择仍然属于你</p><div class="film-pill-choices"><button data-action="life" data-target="film:pill:red">红色 · 继续追问</button><button data-action="life" data-target="film:blue">蓝色 · 回到日常</button></div></div>
      <div id="film-meeting" class="film-pills hidden" role="group" aria-label="接头决定"><p>你仍然可以离开</p><div class="film-pill-choices"><button data-action="life" data-target="film:meeting:stay">留在车内 · 接受检查</button><button data-action="life" data-target="film:meeting:leave">打开车门 · 暂时离开</button></div></div>
      <div id="film-ride" class="film-ride hidden" role="status"><span>TRINITY / KEYMAKER</span><strong id="film-ride-speed"></strong><p id="film-ride-health"></p><small>W 加速 · S 刹车 · A / D 转向</small></div>
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
      if (journey.visiting || step?.kind === 'reflect' || journey.finished) this.open('journal');
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
    this.el('film-ride').classList.add('hidden');
    this.el('film-pills').classList.add('hidden');
    this.el('film-meeting').classList.add('hidden');
    this.el('film-blackout').style.opacity = '0';
    if (!player || !state || !profile) return;
    const life = player.id === 'neo' || player.id === state.neoLife?.journey?.actor ? state.neoLife : undefined;
    const chapter = life ? NEO_CHAPTERS[life.chapter] : undefined;
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
    const set = FILM_SETS[journey.visiting ? FILM_SCENE_BY_ID[journey.visiting].set : scene.set];
    const shown = journey.visiting ? FILM_SCENE_BY_ID[journey.visiting] : scene;
    this.el('sandbox-clock').textContent = `${FILM_NAMES[shown.film]} · 第 ${FILM_SCENES.indexOf(shown) + 1} 段`;
    this.el('sandbox-weather').textContent = set.world === 'real' ? '真实世界' : ({ day: '日间', night: '夜间', warm: '室内', cold: '室内', white: '程序空间', storm: '暴雨', sunrise: '日出' })[set.light];
    this.el('sandbox-interact').classList.remove('hidden');
    this.el('sandbox-nearby').textContent = journey.visiting ? '回访场景 · J 返回剧情' : journey.finished ? '三部曲已完成 · 查看手记' : !step ? '场景完成 · 继续下一段' : step.kind === 'reflect' ? '打开手记，记录反思' : journey.fighting ? `战斗中 · 剩余 ${state.threats.filter(t => t.scene === scene.id).length}` : step.label;
    this.el('sandbox-job').style.width = journey.started !== undefined && step ? `${Math.min(100, (this.tick - journey.started) / ((step.seconds ?? 3) * 2) * 100)}%` : '0';
    document.getElementById('game-objective')!.textContent = journey.visiting ? set.name : scene.title;
    document.getElementById('game-objective-copy')!.textContent = journey.visiting ? '自由走动，J 返回保存的剧情位置。' : journey.fighting ? 'F 连击 · X 闪避 · 1 治疗 · 击败追兵后继续' : step ? `${journey.step + 1}/${scene.steps.length} · ${step.label} · ${step.kind === 'reach' ? '走到标记旁' : step.kind === 'reflect' ? '靠近后按 J 记录反思' : '靠近后按 G'}` : 'G 继续下一段，J 查看刚刚发生的事。';
    if (journey.hotel && !journey.hotel.entered && !journey.visiting) {
      const ready = journey.hotel.progress >= HOTEL_DOOR_PROGRESS - .01 && distance(player.position, filmPosition('film_lafayette', 24, 0)) < 4;
      const knocking = journey.hotel.knock !== undefined;
      document.getElementById('game-objective')!.textContent = '前往十三层 · 1313';
      document.getElementById('game-objective-copy')!.textContent = knocking ? 'Neo 正在敲门 · 动作与位置自动保存' : journey.hotel.door !== undefined ? '门已打开 · 亲自跨过门槛' : '跟随 Trinity 上楼。可以停留观察，她会等你。';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = knocking ? '三下敲门 · 暂停或重新载入会保留动作' : 'WASD 移动 · Shift 快步 · V 切换视角 · 途中自动保存';
      this.el('sandbox-interact').classList.toggle('hidden', !ready || knocking || journey.hotel.door !== undefined);
      this.el('sandbox-nearby').textContent = knocking ? '正在敲门' : '敲响 1313 房门'; this.el('sandbox-waypoint').textContent = '';
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
    if (awakeningLocked(journey)) {
      this.el('film-sequence-hint').textContent = '鼠标观察 · V 切换视角 · J 手记';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('sandbox-waypoint').textContent = '';
      this.el('sandbox-interact').classList.add('hidden'); return;
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
      const encounter = journey.meeting; const choosing = encounter.phase === 'choice';
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = choosing ? '留下接受检查，或现在下车 · 等待不会替你决定'
        : encounter.phase === 'located' || encounter.phase === 'removing' ? '按住 G 保持稳定 · 松开暂停抽取'
        : encounter.phase === 'done' ? journey.step === 1 ? 'J 记录反思，再继续赴约' : 'G 启程前往 Lafayette'
        : encounter.phase === 'parked' ? 'G 打开车门下车 · 等待不会替你决定'
        : encounter.phase === 'driving' ? 'Apoc 正在驾驶 · V 切换车内视角后可用鼠标观察' : 'V 切换视角 · 暂停或重连会保留动作';
      this.el('film-meeting').classList.toggle('hidden', !choosing);
      if (choosing && document.pointerLockElement) document.exitPointerLock();
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
    if (!journey.visiting && scene.id === 'm1_dejavu' && journey.ambush && journey.step === 0) {
      this.el('film-sequence').classList.remove('hidden'); this.el('film-sequence-line').textContent = journey.lastText;
      this.el('film-sequence-hint').textContent = '留意前方门洞 · 走远会暂停观察';
      this.el('sandbox-interact').classList.add('hidden'); this.el('sandbox-waypoint').textContent = '';
      document.getElementById('game-objective-copy')!.textContent = '看着猫经过的地方，留意周围的变化。'; return;
    }
    if (scene.id === 'm1_lobby' && !journey.visiting) {
      const combat = journey.lobby;
      this.el('sandbox-trace').textContent = combat?.reloadAt !== undefined ? `换弹 ${Math.max(0, (combat.reloadAt - this.tick) / 2).toFixed(1)}s` : `弹匣 ${combat?.ammo ?? 16} / 16`;
      if (journey.fighting) {
        document.getElementById('game-objective-copy')!.textContent = `警戒 ${combat?.wave ?? 1}/3 · 左键 / T 射击 · R 换弹 · Q 子弹时间 · X 闪避`;
        this.el('sandbox-waypoint').textContent = '柱列能阻挡枪火 · 瞄准后换位 · Trinity 掩护侧翼';
        this.el('sandbox-interact').classList.add('hidden'); return;
      }
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
    if (scene.id === 'm2_freeway' && journey.ride?.phase === 'riding' && !journey.visiting) {
      const ride = journey.ride;
      this.el('film-ride').classList.remove('hidden');
      this.el('film-ride-speed').textContent = `${Math.round(ride.speed * 1.8)} km/h`;
      this.el('film-ride-health').textContent = `车况 ${Math.ceil(ride.hull)}% · 钥匙匠 ${Math.ceil(ride.passenger)}%`;
      this.el('sandbox-waypoint').textContent = `接应区 ↑ ${Math.max(0, Math.round((ride.z + 660) / 2))} m`;
      document.getElementById('game-objective-copy')!.textContent = '在逆向车流中护送钥匙匠 · 留意大型卡车 · 碰撞后先刹车';
      this.el('sandbox-interact').classList.add('hidden'); return;
    }
    if (scene.id === 'm1_ledge' && step?.kind === 'reflect') this.el('sandbox-nearby').textContent = '沿维修架脱身，或退回办公室';
    if (step && !journey.visiting) {
      const target = filmStepPosition(scene, step); const direction = Math.atan2(target.x - player.position.x, target.z - player.position.z) - player.rotation;
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
        <h3 class="sandbox-section-label">附近的设施</h3><div class="structure-list">${state.structures.filter(s => s.matrix === player.isInMatrix && distance(s.position, player.position) < 50).map(s => `<div>${ITEMS[s.kind].name} · 耐久 ${s.health}<button data-action="dismantle" data-target="${s.id}" ${s.owner === player.id && distance(s.position, player.position) < 16 ? '' : 'disabled'}>拆回背包</button></div>`).join('') || '<p>附近没有设施。按 3 搭建安全屋，按 4 放置路障。</p>'}</div>`;
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
      const position = filmStepPosition(scene, step);
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
    for (const structure of this.state.structures.filter(s => s.matrix === matrix)) { const [x, y] = point(structure.position); ctx.fillStyle = '#a5e8b9'; ctx.fillRect(x - 6, y - 1, 12, 2); ctx.fillRect(x - 1, y - 6, 2, 12); }
    const [x, y] = point(this.player.position); ctx.fillStyle = '#e1ffd1'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e1ffd180'; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
  }
  dispose(): void { this.close(); this.root.remove(); }
}
