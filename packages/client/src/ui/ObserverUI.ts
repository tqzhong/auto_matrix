import { CHARACTERS, LOCATIONS, type AgentState, type SimulationState, type WorldEvent, type Memory, type Relationship } from '@auto_matrix/shared';
import { FACTION_COLORS } from '../agents/AgentRenderer.js';

const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const FACTIONS: Record<string, string> = { zion: '锡安', civilians: '未觉醒者', machines: '机器', oracle: '先知', merovingian: '梅罗文加', exiles: '流亡程序', smith_virus: 'Smith 病毒' };
const ACTIONS: Record<string, string> = { idle: '休息', move_to: '移动', talk_to: '交谈', attack: '战斗', defend: '防御', observe: '观察', hide: '避险', interact_object: '救助', use_ability: '能力', train: '训练', hack: '入侵' };
const EVENTS: Record<string, [string, string]> = { anomaly: ['⌁', '异常'], awakening: ['◉', '觉醒'], conversation: ['“', '交谈'], portal_open: ['⇄', '接入'], gunfight: ['×', '冲突'], death: ['×', '死亡'], aid: ['+', '援助'], arrival: ['↗', '行踪'], ceasefire: ['◇', '干预'] };

export interface ObserverActions {
  play: () => void;
  pause: () => void;
  speed: (speed: number) => void;
  agent: (id: string) => void;
  event: (event: WorldEvent) => void;
  world: (matrix: boolean) => void;
  camera: (mode: string) => void;
  intervene: (kind: string) => void;
  sound: () => void;
}

export class ObserverUI {
  private agents: Record<string, AgentState> = {};
  private events: WorldEvent[] = [];
  private selected: string | null = null;
  private detailEvent: WorldEvent | null = null;
  private filter = 'all';
  private view = 'world';
  private matrix = true;
  private search = '';
  private connected = false;
  private contextAgent: string | null = null;
  private contextLoaded = false;
  private context: { memories: Memory[]; relationships: Relationship[] } = { memories: [], relationships: [] };
  private sim?: SimulationState;

  constructor(private root: HTMLElement, private actions: ObserverActions) {
    root.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#" aria-label="Matrix 世界总览"><span class="brand-mark">Ⅲ</span><span>MATRIX<span class="brand-sub">AUTONOMOUS WORLD</span></span></a>
        <nav class="main-nav" aria-label="主视图"><button class="nav-button active" data-view="world">世界总览</button><button class="nav-button" data-view="agents">人物档案 <span class="nav-count">74</span></button><button class="nav-button" data-view="timeline">事件时间线</button><button class="nav-button enter-from-observer" id="observer-play">进入角色 ↗</button></nav>
        <div class="connection"><i></i><span id="connection-label">正在建立连接</span><span class="version">SIM / 01</span></div>
      </header>
      <main class="observation">
        <section class="world-context">
          <div class="eyebrow"><span class="live-square"></span> LIVE WORLD <span class="muted">/ 自主模拟</span></div>
          <div class="chapter-index">CHAPTER <span id="chapter-number">01</span><span class="hairline"></span></div>
          <h1 id="chapter-title">表象之下</h1><p id="chapter-copy">城市照常运转。每个人都有自己的生活，<br>也有尚未说出口的疑问。</p>
          <div class="world-switch" role="group" aria-label="世界切换"><button class="active" data-world="matrix"><span>◈</span> MATRIX</button><button data-world="real"><span>◇</span> 锡安</button></div>
          <div class="metrics"><div><span class="metric-name">存活人物</span><strong id="population">—</strong><small>RESIDENTS</small></div><div><span class="metric-name">已觉醒</span><strong id="awakened">—</strong><small>AWAKENED</small></div></div>
          <div class="meter-line"><span>世界紧张度</span><strong id="tension-label">0%</strong><div class="meter"><i id="tension-bar"></i></div></div>
          <div class="meter-line"><span>集体怀疑</span><strong id="anomaly-label">0%</strong><div class="meter"><i id="anomaly-bar"></i></div></div>
          <div class="mode-label" id="mode-label">等待世界状态…</div>
        </section>
        <section class="sector-label"><span class="crosshair">＋</span><div><span id="sector-name">MIDTOWN MANHATTAN</span><small id="sector-copy">中城 · Matrix 第一区</small></div><span class="coordinate">40°45′ N / 73°59′ W</span></section>
        <aside class="right-panel"><div class="panel-heading"><div><span class="eyebrow">WORLD JOURNAL</span><h2 id="panel-title">世界正在发生</h2></div><span class="pulse-dot"></span><button id="close-inspector" class="icon-button hidden" aria-label="返回世界事件">×</button></div>
          <div class="feed-filters" id="feed-filters"><button class="active" data-filter="all">全部</button><button data-filter="anomaly">异常</button><button data-filter="conversation">交谈</button><button data-filter="gunfight">冲突</button><span id="event-count">0 EVENTS</span></div>
          <div id="feed" class="feed" aria-live="polite"></div><div id="inspector" class="inspector hidden"></div>
          <div class="journal-footer"><i></i><span>每个选择，都留下痕迹</span><span id="conversation-count">0 组交谈</span></div>
        </aside>
        <section class="minimap-panel"><div class="map-heading"><span>SECTOR MAP</span><span>01 / 02</span></div><canvas id="minimap" width="480" height="260" aria-label="城市人物分布图"></canvas><div class="faction-legend"><span><i style="--color:#90d7b1"></i>锡安</span><span><i style="--color:#d0c8a3"></i>居民</span><span><i style="--color:#ee8773"></i>机器</span></div></section>
        <div class="camera-tools" role="group" aria-label="镜头模式"><button class="active" data-camera="overview">⊞ <span>全景</span></button><button data-camera="follow">◎ <span>跟随</span></button><button data-camera="director">◉ <span>导演视角</span></button></div>
        <div class="scene-hint">拖动平移 <b>·</b> 右键旋转 <b>·</b> 滚轮缩放 <b>·</b> 点击人物观察</div>
        <div class="bottom-story"><span class="story-line"></span><div><span class="eyebrow">THE WORLD WRITES ITSELF</span><p id="latest-story">你是观察者。故事，由他们自己书写。</p></div><span id="latest-tick">T + 000000</span></div>
      </main>
      <section id="archive" class="archive hidden"><div class="archive-header"><div><span class="eyebrow" id="archive-kicker">RESIDENT ARCHIVE</span><h2 id="archive-title">每一个人，都是一条故事线。</h2></div><input id="agent-search" type="search" placeholder="搜索姓名、阵营或目标…" aria-label="搜索人物"><button id="close-archive" class="icon-button" aria-label="关闭档案">×</button></div><div id="archive-content"></div></section>
      <footer class="transport"><div class="simulation-label"><span class="status-orbit">◉</span><span id="run-state">连接中</span><span class="separator"></span><span id="sim-time">21:00:00</span><span class="day-label" id="sim-day">DAY 01</span></div><div class="playback"><button id="pause" class="pause-button" aria-label="暂停模拟" title="空格：暂停或继续">Ⅱ</button><div class="speed-buttons" role="group" aria-label="模拟速度">${[0.5, 1, 2, 4, 8].map(n => `<button data-speed="${n}" class="${n === 1 ? 'active' : ''}">${n}×</button>`).join('')}</div></div><div class="utilities"><button id="sound" title="音乐与音效" aria-label="音乐与音效设置">♫ <span>声音</span></button><button id="intervention-toggle" class="intervene-toggle">⌁ <span>干预世界</span></button><span class="fps" id="fps">— FPS</span></div></footer>
      <div id="interventions" class="interventions hidden"><span class="eyebrow">OBSERVER INTERVENTION</span><h3>改变一个条件，观察连锁反应。</h3><button data-intervene="anomaly"><strong>⌁ 注入代码异常</strong><span>让附近人物亲历现实的裂缝。</span></button><button data-intervene="ceasefire"><strong>◇ 广播停火信号</strong><span>争取 180 个模拟刻的缓冲期。</span></button><p>干预会记录在事件时间线中。</p></div>
      <div id="toast" class="toast hidden" role="status"></div>
      <div id="boot" class="boot"><span class="boot-symbol">Ⅲ</span><span>CONNECTING TO THE CONSTRUCT</span><p>正在接入自主世界…</p></div>`;
    this.bind();
    this.renderFeed();
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T { return this.root.querySelector(`#${id}`)!; }
  private bind(): void {
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('button, a');
      if (!button) return;
      if (button.matches('.brand')) { event.preventDefault(); this.setView('world'); }
      if (button.dataset.view) this.setView(button.dataset.view);
      if (button.dataset.world) this.actions.world(button.dataset.world === 'matrix');
      if (button.dataset.camera) this.actions.camera(button.dataset.camera);
      if (button.dataset.speed) this.actions.speed(Number(button.dataset.speed));
      if (button.dataset.filter) { this.filter = button.dataset.filter; this.renderFeed(); this.active('[data-filter]', 'filter', this.filter); }
      if (button.dataset.agent) { this.setView('world'); this.actions.agent(button.dataset.agent); }
      if (button.dataset.event) { const selected = this.events.find(e => e.id === button.dataset.event); if (selected) { this.setView('world'); this.actions.event(selected); } }
      if (button.dataset.intervene) {
        if (!this.connected || !this.sim?.running) { this.toast('请先连接并继续模拟。'); return; }
        this.actions.intervene(button.dataset.intervene); this.el('interventions').classList.add('hidden'); this.toast('干预已发送，等待世界响应。');
      }
      if (button.id === 'pause') this.actions.pause();
      if (button.id === 'observer-play') this.actions.play();
      if (button.id === 'close-inspector') this.clearInspector();
      if (button.id === 'close-archive') this.setView('world');
      if (button.id === 'intervention-toggle') this.el('interventions').classList.toggle('hidden');
      if (button.id === 'sound') this.actions.sound();
    });
    this.el<HTMLInputElement>('agent-search').addEventListener('input', event => { this.search = (event.target as HTMLInputElement).value.toLowerCase(); this.renderArchive(); });
    this.el<HTMLCanvasElement>('minimap').addEventListener('click', event => {
      const canvas = this.el<HTMLCanvasElement>('minimap');
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * 480;
      const y = (event.clientY - rect.top) / rect.height * 260;
      const visible = Object.values(this.agents).filter(a => a.isInMatrix === this.matrix && a.status === 'alive');
      visible.sort((a, b) => { const pa = this.mapPosition(a); const pb = this.mapPosition(b); return Math.hypot(pa[0] - x, pa[1] - y) - Math.hypot(pb[0] - x, pb[1] - y); });
      if (visible[0]) this.actions.agent(visible[0].id);
    });
  }

  private active(selector: string, key: string, value: string): void {
    this.root.querySelectorAll<HTMLElement>(selector).forEach(button => { const active = button.dataset[key] === value; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  }
  setCamera(mode: string): void { this.active('[data-camera]', 'camera', mode); }
  setWorld(matrix: boolean): void {
    this.matrix = matrix;
    this.active('[data-world]', 'world', matrix ? 'matrix' : 'real');
    this.el('sector-name').textContent = matrix ? 'MIDTOWN MANHATTAN' : 'ZION / THE REAL WORLD';
    this.el('sector-copy').textContent = matrix ? '中城 · Matrix 第一区' : '锡安 · 人类最后的城市';
    this.drawMap();
  }
  setConnection(connected: boolean): void {
    this.connected = connected;
    this.root.classList.toggle('offline', !connected);
    this.el('connection-label').textContent = connected ? '世界已连接' : '连接中断 · 正在重连';
    this.el<HTMLButtonElement>('pause').disabled = !connected;
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button => { button.disabled = !connected; });
    if (!connected) this.el('run-state').textContent = '连接中断';
  }
  update(agents: Record<string, AgentState>, sim: SimulationState, time: number): void {
    this.agents = agents; this.sim = sim;
    this.el('boot').classList.add('hidden');
    const chapters: Record<string, [string, string]> = { 'The Matrix': ['01', '表象之下'], 'The Awakening': ['02', '觉醒之声'], 'The War': ['03', '秩序失衡'], 'The Source': ['04', '新的可能'] };
    const chapter = chapters[sim.chapter] ?? ['01', '表象之下'];
    this.el('chapter-number').textContent = chapter[0]; this.el('chapter-title').textContent = chapter[1];
    this.el('chapter-copy').textContent = sim.chapterDescription;
    this.el('population').textContent = String(sim.population).padStart(2, '0');
    this.el('awakened').textContent = String(sim.awakened).padStart(2, '0');
    for (const metric of ['tension', 'anomaly'] as const) { this.el(`${metric}-label`).textContent = `${sim[metric]}%`; this.el(`${metric}-bar`).style.width = `${sim[metric]}%`; }
    this.el('mode-label').textContent = sim.llmStatus === 'ready' ? '◈ 模型增强 · 本地行为持续运行' : sim.llmStatus === 'degraded' ? '◈ 模型暂不可用 · 本地行为运行中' : '◈ 本地自主模拟 · 未连接语言模型';
    this.el('conversation-count').textContent = `${sim.conversations} 组交谈`;
    this.el('run-state').textContent = this.connected ? (sim.running ? '模拟运行中' : '模拟已暂停') : '连接中断';
    this.el('pause').textContent = sim.running ? 'Ⅱ' : '▶';
    this.el('pause').setAttribute('aria-label', sim.running ? '暂停模拟' : '继续模拟');
    this.active('[data-speed]', 'speed', String(sim.speed));
    const seconds = Math.floor(time / 24000 * 86400);
    this.el('sim-time').textContent = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.el('sim-day').textContent = `DAY ${String(1 + Math.floor((21000 + sim.tick * 12) / 24000)).padStart(2, '0')}`;
    this.el('latest-tick').textContent = `T + ${String(sim.tick).padStart(6, '0')}`;
    this.root.querySelector('.nav-count')!.textContent = String(Object.keys(agents).length);
    if (this.selected) this.renderAgent();
    if (this.view === 'agents') this.renderArchive();
    this.drawMap();
  }
  setFps(fps: number): void { this.el('fps').textContent = `${Math.round(fps)} FPS`; }
  addEvents(events: WorldEvent[], replace = false): void {
    if (replace) this.events = [];
    for (const event of events) if (!this.events.some(existing => existing.id === event.id)) this.events.push(event);
    this.events = this.events.sort((a, b) => a.tick - b.tick).slice(-100);
    this.renderFeed();
    const significant = [...this.events].reverse().find(e => e.importance >= 7);
    if (significant) this.el('latest-story').textContent = `${significant.title} — ${significant.consequence ?? significant.description}`;
    if (this.view === 'timeline') this.renderArchive();
  }
  showAgent(id: string): void {
    if (this.selected !== id) { this.context = { memories: [], relationships: [] }; this.contextLoaded = false; }
    this.selected = id; this.detailEvent = null; this.contextAgent = id;
    this.el('panel-title').textContent = '人物观察'; this.inspectorVisible(true); this.renderAgent();
  }
  setContext(id: string, context: { memories: Memory[]; relationships: Relationship[] }): void {
    if (id !== this.contextAgent) return;
    this.context = context; this.contextLoaded = true; this.renderAgent();
  }
  contextFailed(id: string): void { if (id === this.selected) this.toast('人物记忆读取失败，稍后会自动重试。'); }
  showEvent(event: WorldEvent): void {
    this.selected = null; this.detailEvent = event; this.contextAgent = null;
    this.el('panel-title').textContent = '事件因果'; this.inspectorVisible(true);
    this.el('inspector').innerHTML = `<span class="detail-kicker">${escape(EVENTS[event.type]?.[1] ?? '事件')} / T + ${event.tick}</span><h3>${escape(event.title ?? event.type)}</h3><p class="detail-description">${escape(event.description)}</p><div class="causal-step"><small>01 / 起因</small><p>${escape(event.cause ?? '来自世界中的人物互动。')}</p></div><div class="causal-step"><small>02 / 后果</small><p>${escape(event.consequence ?? '事件被写入人物记忆。')}</p></div><div class="detail-location">⌖ ${escape(LOCATIONS[event.location]?.nameCn ?? event.location)}</div><h4>相关人物</h4><div class="participant-list">${event.involvedAgents.map(id => `<button data-agent="${escape(id)}"><i style="--color:${FACTION_COLORS[this.agents[id]?.faction] ?? '#a1bdad'}"></i>${escape(this.agents[id]?.name ?? id)}<span>↗</span></button>`).join('') || '<p class="muted">世界范围事件</p>'}</div>${event.causeEventId && this.events.some(e => e.id === event.causeEventId) ? `<button class="cause-link" data-event="${escape(event.causeEventId)}">← 追溯上一个事件</button>` : ''}`;
  }
  private inspectorVisible(visible: boolean): void {
    this.el('inspector').classList.toggle('hidden', !visible); this.el('feed').classList.toggle('hidden', visible);
    this.el('feed-filters').classList.toggle('hidden', visible); this.el('close-inspector').classList.toggle('hidden', !visible);
    this.root.querySelector('.pulse-dot')!.classList.toggle('hidden', visible);
  }
  private clearInspector(): void {
    this.selected = null; this.detailEvent = null; this.contextAgent = null;
    this.inspectorVisible(false); this.el('panel-title').textContent = '世界正在发生';
  }
  private renderAgent(): void {
    const agent = this.selected ? this.agents[this.selected] : undefined;
    if (!agent) return;
    const mind = agent.mind;
    const color = FACTION_COLORS[agent.faction] ?? '#a1bdad';
    const current = this.el('inspector');
    const scroll = current.scrollTop;
    current.innerHTML = `<div class="agent-profile"><div class="agent-avatar" style="--agent-color:${color}">${escape(agent.name[0])}</div><div><h3>${escape(agent.name)}</h3><span>${escape(CHARACTERS[agent.id]?.nameCn ?? '')} · ${escape(FACTIONS[agent.faction] ?? agent.faction)}</span></div></div><div class="agent-status"><i style="--color:${color}"></i>${agent.status === 'dead' ? '信号终止' : agent.isAwakened ? '已觉醒' : '尚未觉醒'}<span>${agent.isInMatrix ? 'MATRIX' : 'REAL WORLD'}</span></div><blockquote>“${escape(mind?.thought ?? agent.currentGoal)}”<small>${mind?.source === 'llm' ? '模型生成的内心活动' : '由当前状态与经历驱动'}</small></blockquote><div class="agent-facts"><div><span>正在做</span><strong>${escape(ACTIONS[agent.currentAction?.type ?? 'idle'] ?? '观察')}</strong></div><div><span>当前位置</span><strong>${escape(LOCATIONS[agent.currentLocation]?.nameCn ?? agent.currentLocation)}</strong></div><div><span>当前目标</span><strong>${escape(agent.currentGoal)}</strong></div></div><div class="agent-vitals">${[['生命', Math.round(agent.health / agent.maxHealth * 100)], ['精力', Math.round(mind?.energy ?? 100)], ['怀疑', Math.round(mind?.suspicion ?? 0)]].map(([label, value]) => `<div><span>${label}</span><div class="meter"><i style="width:${value}%"></i></div><b>${value}</b></div>`).join('')}</div><h4>最近的记忆 <span>${mind?.memoryCount ?? 0}</span></h4><div class="memory-list">${this.context.memories.slice(-5).reverse().map(memory => `<p><i></i>${escape(memory.content)}</p>`).join('') || `<p class="muted">${this.contextLoaded ? '还没有留下新的记忆。' : '正在读取记忆…'}</p>`}</div><h4>关系网络</h4><div class="relationship-list">${this.context.relationships.slice(0, 5).map(relation => `<button data-agent="${escape(relation.toAgent)}"><span>${escape(this.agents[relation.toAgent]?.name ?? relation.toAgent)}</span><small>信任 ${relation.trust > 0 ? '+' : ''}${relation.trust}</small></button>`).join('') || '<p class="muted">尚无可显示的关系。</p>'}</div>`;
    current.scrollTop = scroll;
  }
  private eventCard(event: WorldEvent): string {
    const [symbol, kind] = EVENTS[event.type] ?? ['◇', '事件'];
    return `<button class="event-card ${['gunfight', 'death'].includes(event.type) ? 'danger' : ''}" data-event="${escape(event.id)}"><span class="event-symbol">${symbol}</span><div><div class="event-meta"><span>${kind}</span><time>T + ${String(event.tick).padStart(4, '0')}</time></div><h3>${escape(event.title ?? event.type)}</h3><p>${escape(event.description)}</p><div class="event-location">⌖ ${escape(LOCATIONS[event.location]?.nameCn ?? event.location)}<span>↗</span></div></div></button>`;
  }
  private renderFeed(): void {
    const visible = this.events.filter(e => this.filter === 'all' ? e.type !== 'arrival' : this.filter === 'anomaly' ? ['anomaly', 'awakening', 'portal_open'].includes(e.type) : this.filter === 'gunfight' ? ['gunfight', 'death', 'aid', 'ceasefire'].includes(e.type) : e.type === this.filter);
    const feed = this.el('feed');
    const scroll = feed.scrollTop;
    feed.innerHTML = visible.slice(-25).reverse().map(event => this.eventCard(event)).join('') || '<div class="empty-feed"><span>⌁</span><h3>故事正在酝酿</h3><p>人物正在观察、行动与交谈。<br>新的事件会实时出现在这里。</p><small>世界无需你的操作，也会继续。</small></div>';
    feed.scrollTop = scroll;
    this.el('event-count').textContent = `${visible.length} EVENTS`;
  }
  private setView(view: string): void {
    this.view = view; this.active('[data-view]', 'view', view);
    this.el('archive').classList.toggle('hidden', view === 'world');
    this.el('agent-search').classList.toggle('hidden', view !== 'agents');
    this.renderArchive();
  }
  private renderArchive(): void {
    if (this.view === 'world') return;
    this.el('archive-kicker').textContent = this.view === 'agents' ? 'RESIDENT ARCHIVE' : 'CAUSAL TIMELINE';
    this.el('archive-title').textContent = this.view === 'agents' ? '每一个人，都是一条故事线。' : '发生过的事，不会凭空消失。';
    const container = this.el('archive-content');
    if (this.view === 'timeline') {
      container.className = 'timeline-grid';
      container.innerHTML = this.events.slice().reverse().map(event => this.eventCard(event)).join('') || '<p class="muted">正在等待第一条世界事件。</p>';
    } else {
      container.className = 'agent-grid';
      const agents = Object.values(this.agents).filter(a => `${a.name} ${CHARACTERS[a.id]?.nameCn} ${FACTIONS[a.faction]} ${a.currentGoal}`.toLowerCase().includes(this.search));
      container.innerHTML = agents.map(a => `<button class="resident-card" data-agent="${escape(a.id)}"><div class="resident-header"><span class="resident-initial" style="--agent-color:${FACTION_COLORS[a.faction] ?? '#a1bdad'}">${escape(a.name[0])}</span><span class="resident-world">${a.isInMatrix ? 'MATRIX' : 'REAL WORLD'}</span><span>↗</span></div><h3>${escape(a.name)}</h3><small>${escape(CHARACTERS[a.id]?.nameCn ?? '')} / ${escape(FACTIONS[a.faction] ?? a.faction)}</small><p>${escape(a.mind?.thought ?? a.currentGoal)}</p><div class="resident-footer"><i style="--color:${FACTION_COLORS[a.faction] ?? '#a1bdad'}"></i>${a.status === 'dead' ? '已死亡' : ACTIONS[a.currentAction?.type ?? 'idle']}<span>${escape(LOCATIONS[a.currentLocation]?.nameCn ?? '')}</span></div></button>`).join('') || '<p class="muted">没有匹配的人物。</p>';
    }
  }
  private mapPosition(agent: AgentState): [number, number] {
    return this.matrix ? [(agent.position.x - 620) / 1150 * 480, (agent.position.z - 400) / 1150 * 260] : [(agent.position.x - 1970) / 660 * 480, (agent.position.z - 2250) / 420 * 260];
  }
  private drawMap(): void {
    const canvas = this.el<HTMLCanvasElement>('minimap'); const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 480, 260);
    ctx.strokeStyle = '#24352d'; ctx.lineWidth = 1;
    for (let x = 0; x < 480; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 260); ctx.stroke(); }
    for (let y = 0; y < 260; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(480, y); ctx.stroke(); }
    for (const agent of Object.values(this.agents)) {
      if (agent.isInMatrix !== this.matrix || agent.status !== 'alive') continue;
      const [x, y] = this.mapPosition(agent);
      ctx.fillStyle = FACTION_COLORS[agent.faction] ?? '#a1bdad';
      ctx.beginPath(); ctx.arc(x, y, agent.id === this.selected ? 5 : 2.5, 0, Math.PI * 2); ctx.fill();
      if (agent.id === this.selected) { ctx.strokeStyle = '#d1ffe0'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke(); }
    }
  }
  private toastTimer = 0;
  toast(message: string): void {
    this.el('toast').textContent = message; this.el('toast').classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.el('toast').classList.add('hidden'), 4000);
  }
  showDialogue(speaker: string, content: string): void {
    this.el('latest-story').textContent = `${this.agents[speaker]?.name ?? speaker}：「${content}」`;
  }
  showConnectionHelp(): void {
    const boot = this.el('boot');
    if (!this.sim) boot.querySelector('p')!.textContent = '还没有连接到世界。请确认已在项目目录运行 npm run dev。';
  }
}
