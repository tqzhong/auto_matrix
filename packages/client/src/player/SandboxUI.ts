import { ITEMS, RECIPES, SKILLS, FILMS, MISSIONS, LOCATIONS, CITY_BUILDINGS, NEO_CHAPTERS, LIFE_ACTIONS, lifeActionPosition, lifeRoomCenter, locationEntrance, distance, missionPosition, nearTransit, skillPoints,
  type AgentState, type SandboxState, type SandboxCommand, type ItemId, type SkillId, type Vector3 } from '@auto_matrix/shared';
import './sandbox.css';
import { renderNeoLife } from './NeoLifePanel.js';

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
      <div class="sandbox-clock"><span id="sandbox-clock"></span><span id="sandbox-weather"></span><span id="sandbox-trace"></span></div>
      <nav class="sandbox-nav" aria-label="沙盒玩法"><button data-panel="inventory"><kbd>B</kbd> 背包与制作</button><button data-panel="journal"><kbd>J</kbd> 三部曲日志</button><button data-panel="map"><kbd>M</kbd> 世界地图</button></nav>
      <div id="sandbox-waypoint" class="sandbox-waypoint"></div>
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
      if (button.dataset.action === 'interact' && !button.dataset.target && this.player?.id === 'neo' && this.state?.neoLife) { this.interact(); return; }
      if (button.dataset.action === 'track') this.waypoint = null;
      this.send({ kind: button.dataset.action as SandboxCommand['kind'], target: button.dataset.target ?? (button.dataset.action === 'interact' ? this.nearest : undefined) });
      if (button.dataset.action === 'life' && (button.dataset.target?.startsWith('go:') || LIFE_ACTIONS.some(a => a.id === button.dataset.target))) this.close();
      if (button.dataset.action === 'interact' && this.player?.id === 'neo' && this.state?.neoLife) this.close();
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
    if (this.player?.id === 'neo' && this.state?.neoLife) { this.open('journal'); return; }
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
    if (!player || !state || !profile) return;
    const life = player.id === 'neo' ? state.neoLife : undefined;
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

  private renderPanel(): void {
    if (!this.panel || !this.player || !this.state) return;
    const player = this.player; const state = this.state; const profile = state.profiles[player.id];
    const life = player.id === 'neo' ? state.neoLife : undefined;
    const signature = JSON.stringify([this.panel, this.selectedFilm, profile.inventory, profile.xp, profile.skills, profile.trackedMission, profile.visited, state.missions, state.structures, state.incidents, Math.round(player.position.x), Math.round(player.position.z), state.ending,
      life && [life.chapter, life.day, life.money, life.cycle, Math.floor(this.time / 500), life.anomaly, life.activity, life.journal[0], life.appointment]]);
    if (signature === this.signature) return;
    this.signature = signature;
    const body = this.el('sandbox-panel-body'); const scroll = body.scrollTop;
    const expanded = [...body.querySelectorAll('details')].map(detail => detail.open);
    const neoPanel = Boolean(life && this.panel === 'journal');
    this.el('sandbox-panel').classList.toggle('neo-panel', neoPanel);
    this.el('sandbox-panel-title').textContent = neoPanel ? '生活与故事手记' : this.panel === 'inventory' ? '生存，是你的第一段故事。' : this.panel === 'journal' ? '三部曲，你来改变走向。' : '一座持续运转的世界。';
    this.root.querySelector('.sandbox-window > header p')!.textContent = neoPanel ? '生活继续，选择留下痕迹。你可以随时合上手记，走进城市。' : '世界仍在运行。附近有追兵时，请先寻找安全位置。';
    this.root.querySelectorAll<HTMLElement>('.sandbox-window [data-panel]').forEach(button => button.classList.toggle('active', button.dataset.panel === this.panel));
    this.el('sandbox-profile').textContent = neoPanel ? `Thomas Anderson · 第 ${life!.cycle} 轮 · 自动保存生活、证据和选择` : `${player.name} · 等级 ${1 + Math.floor(profile.xp / 50)} · ${profile.xp} XP · 可用技能点 ${skillPoints(profile)}`;
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
    body.querySelectorAll('details').forEach((detail, index) => { detail.open = expanded[index] ?? false; });
    body.scrollTop = scroll;
  }
  private drawMinimap(): void {
    if (!this.player || !this.state) return;
    const canvas = document.getElementById('game-minimap') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!; const player = this.player;
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
