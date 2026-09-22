import { COMBAT_SKILLS, playerSkills, neoSkillUnlocked, CHARACTERS, LOCATIONS, filmSetAt, filmObstacles, distance, type AgentState, type SimulationState, type WorldEvent, type NeoLifeState } from '@auto_matrix/shared';
import { FACTION_COLORS } from '../agents/AgentRenderer.js';

const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const FACTIONS: Record<string, string> = { zion: '锡安反抗军', civilians: '城市居民', machines: '矩阵程序', oracle: '先知', merovingian: '梅罗文加', exiles: '流亡程序' };

export interface PlayerExperienceActions {
  play: (id: string) => void;
  observe: () => void;
  menu: (open: boolean) => void;
  resume: () => void;
  pause: () => void;
  inspect: (id: string) => void;
  skill: (kind: string) => void;
  sound: () => void;
}

export class PlayerExperience {
  readonly root: HTMLElement;
  private agents: Record<string, AgentState> = {};
  private chosen = 'neo';
  private lastPlayed: string | null = null;
  private controlled: string | null = null;
  private search = '';
  private menuOpen = false;
  private lastRender = 0;
  private lastEvent = '';
  private filmPlaying = false;
  private tipUntil = 0;

  constructor(private actions: PlayerExperienceActions) {
    try { this.lastPlayed = localStorage.getItem('matrix:last-character'); } catch { /* Continue without browser storage when it is unavailable. */ }
    this.chosen = this.lastPlayed ?? 'neo';
    this.root = document.createElement('div');
    this.root.id = 'play-overlay';
    document.body.appendChild(this.root);
    document.body.classList.add('landing');
    this.root.innerHTML = `
      <section class="landing-screen" id="landing-screen">
        <header class="landing-top"><a class="play-brand" href="#">Ⅲ <span>MATRIX<small>AN AUTONOMOUS OPEN WORLD</small></span></a><span class="landing-live"><i></i><span id="landing-live">正在连接世界</span></span></header>
        <div class="landing-copy"><div class="eyebrow">THE SIMULATION IS ALREADY RUNNING</div><h1>世界正在运行。<br><em>现在，进入其中。</em></h1><p>从 Neo 一个普通的早晨开始。<br>上班、回家、见朋友，也留意现实的裂缝。<br>你做的每一个选择，都会成为这个世界的记忆。</p>
          <div class="landing-roles" aria-label="选择角色">${[['neo', 'NEO', '尼奥', '寻找真相'], ['trinity', 'TRINITY', '崔妮蒂', '黑客入侵'], ['smith', 'SMITH', '史密斯', '特工协议']].map(([id, name, cn, ability]) => `<button data-choose="${id}" class="hero-role ${id === this.chosen ? 'active' : ''}"><span class="role-number">${id === 'neo' ? '01' : id === 'trinity' ? '02' : '03'}</span><strong>${name}</strong><span>${cn}</span><small>${ability}</small></button>`).join('')}</div>
          <div class="landing-actions"><button id="enter-world" class="enter-world" disabled>进入角色 <span>↗</span></button><button id="choose-any" class="choose-any">选择任意角色 <span id="roster-count">74</span> →</button></div>
          <div class="landing-secondary"><button id="inspect-character" class="observe-link">检视三维人物 ↗</button><button id="observe-from-landing" class="observe-link">先观察这个世界 ↗</button><button id="landing-sound" class="observe-link" aria-label="音乐与音效设置">♫ 声音</button></div>
        </div>
        <div class="landing-world-label"><span class="live-square"></span><span>MEGACITY / MATRIX 01</span><p>一座从不为你停下的城市</p></div>
        <footer class="landing-footer"><span>WASD 移动 <b>·</b> 鼠标视角 <b>·</b> 任意角色接入</span><span>OPEN WORLD / LIVE SIMULATION</span></footer>
      </section>
      <section id="game-hud" class="game-hud hidden">
        <header class="game-top"><div class="game-logo">Ⅲ <span>MATRIX<span class="game-session">LIVE SESSION</span></span></div><div class="game-location"><span id="game-world">MATRIX / 01</span><h2 id="game-location">中城</h2></div><div class="game-top-actions"><button id="game-pause" aria-label="暂停或继续世界">Ⅱ</button><button id="game-sound" aria-label="音乐与音效设置">♫ 声音</button><button id="game-inspect">人物检视</button><button id="game-characters">切换角色 <kbd>Tab</kbd></button><button id="game-observe">观察世界 ↗</button></div></header>
        <div class="game-crosshair"><i></i><i></i><i></i><i></i></div>
        <div class="game-objective"><span class="eyebrow">YOUR NEXT CHOICE</span><h3 id="game-objective">自由探索这个世界</h3><p id="game-objective-copy">走近人物按 E 交谈，了解他们的经历。</p></div>
        <div id="game-event" class="game-event"><span class="eyebrow">SOMEWHERE IN THE CITY</span><p>你行动的时候，其他故事也在继续。</p></div>
        <div id="game-interaction" class="game-interaction hidden"><kbd>E</kbd><span></span></div>
        <div id="game-dialogue" class="game-dialogue hidden"><span></span><p></p></div>
        <div class="game-vitals"><div class="player-name"><span id="player-initial">N</span><div><h2 id="player-name">NEO</h2><small id="player-identity">尼奥 / 尚未觉醒</small></div><span class="vital-world">CONNECTED</span></div><div class="player-health"><span>生命</span><div><i id="player-health"></i></div><b id="player-health-value">100</b></div><div class="player-energy"><span>精力</span><div><i id="player-energy"></i></div></div>${[0, 1].map(slot => `<button class="player-ability" data-skill="${slot}"><kbd>${slot ? 'C' : 'Q'}</kbd><span><b id="player-skill-${slot}">角色技能</b><em id="skill-detail-${slot}"></em></span><small id="skill-status-${slot}">就绪</small></button>`).join('')}</div>
        <div class="game-map"><div><span>LOCAL SCAN</span><span id="game-population">74 SIGNALS</span></div><canvas id="game-minimap" width="360" height="230" aria-label="角色附近地图"></canvas><p id="game-map-caption">↑ 当前朝向 <span>• 锡安　• 居民　• 特工</span></p></div>
        <div class="game-controls"><span><kbd>W A S D</kbd> 移动</span><span><kbd>Shift</kbd> 奔跑</span><span><kbd>Space</kbd> 跳跃</span><span><kbd>E</kbd> 交谈</span><span><kbd id="attack-keys">F / 左键</kbd> <span id="attack-label">连击</span></span><span><kbd>X</kbd> 闪避</span><span><kbd>Q / C</kbd> 技能</span><span><kbd>V</kbd> <span id="view-label">第一人称</span></span><span><kbd>R</kbd> <span id="r-label">出口接入</span></span></div>
        <div id="mouse-hint" class="mouse-hint">点击画面锁定鼠标 · F 连击，锁定后也可用左键 · 右键观察 · Esc 释放</div>
        <div id="player-death" class="player-death hidden"><span>SIGNAL LOST</span><h2>连接已中断。</h2><p>重建角色会恢复生命，并保留已有的记忆与关系。</p><button id="death-rebuild" class="enter-world">重建这个角色 ↗</button><button id="death-choose" class="observe-link">选择另一条故事线 ↗</button></div>
      </section>
      <section id="character-select" class="character-select hidden"><div class="character-dialog"><header><div><span class="eyebrow">CHOOSE YOUR RESIDUAL SELF-IMAGE</span><h2>你想成为谁？</h2><p>每个角色的进度都会保留。点击继续游玩，其他页面的控制权会转到这里。</p></div><button id="close-characters" aria-label="关闭角色选择">×</button></header><div class="character-search"><input id="character-search" type="search" aria-label="搜索可游玩角色" placeholder="搜索名字、阵营…"><span id="available-count">74 个角色</span></div><div id="character-grid" class="character-grid"></div><footer>WASD 移动 · Shift 奔跑 · 空格跳跃 · E 交谈 · F 连击 · X 闪避 · Q / C 角色技能 · V 切换视角</footer></div></section>
      <div id="play-tip" class="play-tip hidden" role="status"></div>`;
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('button');
      if (!button) return;
      if (button.dataset.choose) {
        this.chosen = button.dataset.choose;
        this.root.querySelectorAll<HTMLElement>('[data-choose]').forEach(role => role.classList.toggle('active', role.dataset.choose === this.chosen));
        this.updateEntry();
      }
      if (button.id === 'enter-world') this.actions.play(this.chosen);
      if (button.id === 'death-rebuild' && this.controlled) this.actions.play(this.controlled);
      if (button.dataset.play) this.actions.play(button.dataset.play);
      if (['choose-any', 'game-characters', 'death-choose'].includes(button.id)) this.openRoster();
      if (button.id === 'close-characters') this.closeRoster();
      if (button.id === 'observe-from-landing' || button.id === 'game-observe') this.observe();
      if (button.dataset.skill !== undefined) this.actions.skill(button.dataset.skill === '0' ? 'ability' : 'ability2');
      if (button.id === 'game-sound' || button.id === 'landing-sound') this.actions.sound();
      if (button.id === 'game-pause') this.actions.pause();
      if (button.id === 'inspect-character' || button.id === 'game-inspect') this.actions.inspect(this.controlled ?? this.chosen);
    });
    this.el<HTMLInputElement>('character-search').addEventListener('input', event => { this.search = (event.target as HTMLInputElement).value.toLowerCase(); this.renderRoster(); });
    document.addEventListener('pointerlockchange', () => {
      this.el('mouse-hint').classList.toggle('hidden', Boolean(document.pointerLockElement));
    });
  }
  private el<T extends HTMLElement = HTMLElement>(id: string): T { return this.root.querySelector(`#${id}`)!; }
  get isChoosingCharacter(): boolean { return this.menuOpen; }
  toggleHUD(): void { document.body.classList.toggle('hud-hidden'); }
  openRoster(): void {
    this.menuOpen = true; this.actions.menu(true);
    if (document.pointerLockElement) document.exitPointerLock();
    this.el('character-select').classList.remove('hidden'); this.renderRoster();
  }
  private closeRoster(): void {
    this.menuOpen = false; this.el('character-select').classList.add('hidden');
    this.actions.menu(false); if (this.controlled) this.actions.resume();
  }
  observe(release = true): void {
    this.controlled = null; this.menuOpen = false;
    document.body.classList.remove('landing', 'playing', 'code-vision', 'bullet-time', 'neo-daily');
    this.el('landing-screen').classList.add('hidden'); this.el('game-hud').classList.add('hidden'); this.el('character-select').classList.add('hidden');
    if (release) this.actions.observe();
  }
  enter(id: string): void {
    this.lastPlayed = id; this.chosen = id;
    try { localStorage.setItem('matrix:last-character', id); } catch { /* World progress is saved on the server. */ }
    this.controlled = id; this.menuOpen = false;
    document.body.classList.remove('landing'); document.body.classList.add('playing');
    this.el('landing-screen').classList.add('hidden'); this.el('game-hud').classList.remove('hidden'); this.el('character-select').classList.add('hidden');
    this.actions.menu(false);
    this.el('game-dialogue').classList.add('hidden');
    this.message(id === 'neo' ? 'J 生活与故事手记 · WASD 走动 · G 查看附近活动 · 先过好普通的一天' : 'F 连按：刺拳 → 直拳 → 正蹬 · X 闪避 · Q / C 角色技能 · H 隐藏界面');
  }
  viewChanged(firstPerson: boolean): void { this.el('view-label').textContent = firstPerson ? '第三人称' : '第一人称'; }
  message(text: string): void {
    this.el('play-tip').textContent = text; this.el('play-tip').classList.remove('hidden'); this.tipUntil = performance.now() + 4500;
  }
  private updateEntry(): void {
    const agent = this.agents[this.chosen];
    const button = this.el<HTMLButtonElement>('enter-world');
    button.disabled = !agent;
    button.innerHTML = `${agent && agent.status !== 'alive' ? '重建并进入角色' : agent && this.lastPlayed === agent.id ? `继续 ${escape(agent.name)} 的进度` : agent?.controller ? '在此页面继续' : '进入角色'} <span>↗</span>`;
  }
  update(agents: Record<string, AgentState>, simulation: SimulationState, neoLife?: NeoLifeState): void {
    this.agents = agents;
    this.updateEntry();
    this.el('landing-live').textContent = `${simulation.population} 个角色正在生活`;
    this.el('roster-count').textContent = String(Object.keys(agents).length);
    if (performance.now() > this.tipUntil) this.el('play-tip').classList.add('hidden');
    if (this.menuOpen && performance.now() - this.lastRender > 1000) this.renderRoster();
    const player = this.controlled ? agents[this.controlled] : undefined;
    const driving = Boolean(player?.currentAction?.parameters.riding);
    const performing = Boolean(player?.currentAction?.parameters.club || player?.currentAction?.parameters.workday || player?.currentAction?.parameters.meeting || player?.currentAction?.parameters.interrogation || player?.currentAction?.parameters.pills || player?.currentAction?.parameters.welcome || player?.currentAction?.parameters.sentinel || player?.currentAction?.parameters.interlude || player?.currentAction?.parameters.oracleVisit || player?.currentAction?.parameters.filmPose || player?.currentAction?.parameters.spoon !== undefined || player?.currentAction?.parameters.vase !== undefined);
    document.body.classList.toggle('film-driving', driving);
    document.body.classList.toggle('film-performing', performing);
    document.body.classList.toggle('film-workday-scene', Boolean(player?.currentAction?.parameters.workday));
    document.body.classList.toggle('film-club-scene', Boolean(player?.currentAction?.parameters.club));
    document.body.classList.toggle('film-pill-scene', Boolean(player?.currentAction?.parameters.pills));
    document.body.classList.toggle('film-interrogation-scene', Boolean(player?.currentAction?.parameters.interrogation));
    document.body.classList.toggle('film-meeting-scene', Boolean(player?.currentAction?.parameters.meeting));
    this.filmPlaying = Boolean(player && neoLife?.journey?.actor === player.id);
    const armed = Boolean(this.filmPlaying && neoLife?.journey?.scene === 'm1_lobby' && !neoLife.journey.visiting);
    this.el('attack-keys').textContent = armed ? '左键 / T' : 'F / 左键';
    this.el('attack-label').textContent = armed ? '射击 · F 近战' : '连击';
    this.el('r-label').textContent = armed ? '换弹' : '出口接入';
    this.el('mouse-hint').textContent = armed ? '点击锁定鼠标 · 朝向辅助瞄准 · 左键 / T 射击 · R 换弹 · 右键观察' : '点击画面锁定鼠标 · F 连击，锁定后也可用左键 · 右键观察 · Esc 释放';
    if (driving) this.el('mouse-hint').textContent = 'W 加速 · S 刹车 · A / D 转向 · V 切换视角 · J 手记';
    document.body.classList.toggle('neo-daily', Boolean(player?.id === 'neo' && neoLife && !player.isAwakened));
    if (!player) return;
    this.el('player-name').textContent = player.name.toUpperCase();
    this.el('player-initial').textContent = player.name[0];
    this.el('player-identity').textContent = `${CHARACTERS[player.id]?.nameCn ?? player.name} / ${player.faction === 'machines' ? '安全程序' : player.isAwakened ? '已觉醒' : '尚未觉醒'}`;
    this.el('player-health').style.width = `${player.health / player.maxHealth * 100}%`;
    this.el('player-health-value').textContent = String(Math.ceil(player.health));
    this.el('player-energy').style.width = `${player.mind?.energy ?? 100}%`;
    this.el('game-world').textContent = player.isInMatrix ? 'MATRIX / 01' : 'REAL WORLD / ZION';
    this.el('game-location').textContent = LOCATIONS[player.currentLocation]?.nameCn ?? '城市街道';
    this.el('game-population').textContent = `${simulation.population} SIGNALS`;
    this.el('game-pause').textContent = simulation.running ? 'Ⅱ' : '▶';
    this.el('player-death').classList.toggle('hidden', player.status !== 'dead');
    this.el('death-rebuild').textContent = this.filmPlaying ? '从剧情检查点重试 ↗' : '重建这个角色 ↗';
    this.el('player-death').querySelector('p')!.textContent = this.filmPlaying ? '恢复生命并返回当前目标，已完成的剧情会保留。' : '重建角色会恢复生命，并保留已有的记忆与关系。';
    this.el('game-event').querySelector('.eyebrow')!.textContent = this.filmPlaying ? 'SCENE MEMORY' : 'SOMEWHERE IN THE CITY';
    if (this.filmPlaying) this.el('game-event').querySelector('p')!.textContent = neoLife!.journey!.lastText;
    playerSkills(player).forEach((id, slot) => {
      const skill = COMBAT_SKILLS[id]; const cooldown = player.combatCooldowns?.[id] ?? 0;
      const locked = player.id === 'neo' && !neoSkillUnlocked(neoLife, slot);
      this.el(`player-skill-${slot}`).textContent = skill.name;
      this.el(`skill-detail-${slot}`).textContent = skill.description;
      this.el(`skill-status-${slot}`).textContent = locked ? '剧情解锁' : skill.matrixOnly && !player.isInMatrix ? '矩阵内' : cooldown > 0 ? `${Math.ceil(cooldown)}s` : '就绪';
      const button = this.root.querySelector<HTMLButtonElement>(`[data-skill="${slot}"]`)!;
      button.disabled = driving || locked || cooldown > 0 || !simulation.running || player.status !== 'alive' || skill.matrixOnly && !player.isInMatrix;
      button.title = skill.description;
      button.style.setProperty('--cooldown', `${cooldown / skill.cooldown * 100}%`);
    });
    document.body.classList.toggle('code-vision', player.activeEffects.some(e => e.visualEffect === 'code_overlay'));
    document.body.classList.toggle('bullet-time', player.activeEffects.some(e => e.visualEffect === 'slow_motion'));
    const nearby = Object.values(agents).filter(a => a.id !== player.id && a.status === 'alive' && a.isInMatrix === player.isInMatrix && distance(a.position, player.position) < 14)
      .sort((a, b) => distance(a.position, player.position) - distance(b.position, player.position));
    const sentinelScene = this.filmPlaying && neoLife?.journey?.scene === 'm1_sentinels' && !neoLife.journey.visiting;
    const interludeScene = this.filmPlaying && ['m1_cypher_console', 'm1_steak', 'm1_meal'].includes(neoLife?.journey?.scene ?? '') && !neoLife?.journey?.visiting;
    const oracleScene = this.filmPlaying && neoLife?.journey?.scene === 'm1_oracle' && Boolean(neoLife.journey.oracle?.consultation) && !neoLife.journey.visiting;
    this.el('game-interaction').classList.toggle('hidden', nearby.length === 0 || player.status === 'dead' || Boolean(player.currentAction?.parameters.riding) || sentinelScene || interludeScene || oracleScene);
    this.el('game-interaction').querySelector('span')!.textContent = nearby[0] ? `与 ${nearby[0].name} 交谈` : '';
    this.el('game-objective').textContent = player.isAwakened ? '你会怎样改变这个世界？' : '寻找现实背后的真相';
    this.el('game-objective-copy').textContent = player.isAwakened ? '结识同伴、探索城市，或前往地铁站寻找出口。' : `怀疑 ${Math.round(player.mind?.suspicion ?? 0)}% · 目击异常，与可信的觉醒者交谈。`;
    this.drawMap(player);
  }
  private renderRoster(): void {
    this.lastRender = performance.now();
    const agents = Object.values(this.agents).filter(a => `${a.name} ${CHARACTERS[a.id]?.nameCn} ${FACTIONS[a.faction]}`.toLowerCase().includes(this.search));
    this.el('available-count').textContent = `${agents.length} 个角色`;
    this.el('character-grid').innerHTML = agents.map(agent => `<button class="character-card" data-play="${escape(agent.id)}" style="--role-color:${FACTION_COLORS[agent.faction] ?? '#b1ccab'}"><div class="character-card-top"><span>${escape(agent.name[0])}</span><small>${agent.isInMatrix ? 'MATRIX' : 'REAL WORLD'}</small><b>↗</b></div><h3>${escape(agent.name)}</h3><p class="roster-skills">${playerSkills(agent).map(id => COMBAT_SKILLS[id].name).join(' / ')}</p><p>${escape(CHARACTERS[agent.id]?.nameCn ?? '')} · ${escape(FACTIONS[agent.faction] ?? agent.faction)}</p><div class="character-card-bottom"><span>${agent.status !== 'alive' ? '重建并接入' : agent.id === this.controlled ? '返回当前角色' : agent.controller ? '在此页面继续' : agent.id === this.lastPlayed ? '继续上次进度' : agent.isAwakened ? '已觉醒' : '未觉醒'}</span><span>${escape(LOCATIONS[agent.currentLocation]?.nameCn ?? '')}</span></div></button>`).join('') || '<p>没有匹配的角色。</p>';
  }
  event(event: WorldEvent): void {
    if (this.filmPlaying) return;
    if (event.id === this.lastEvent || event.importance < 7) return;
    this.lastEvent = event.id;
    this.el('game-event').querySelector('p')!.textContent = `${event.title ?? event.description} · ${LOCATIONS[event.location]?.nameCn ?? event.location}`;
  }
  private dialogueTimer = 0;
  dialogue(speaker: string, content: string): boolean {
    if (!this.controlled) return false;
    const player = this.agents[this.controlled]; const other = this.agents[speaker];
    if (!player || !other || distance(player.position, other.position) > 30 || player.isInMatrix !== other.isInMatrix) return false;
    this.el('game-dialogue').classList.remove('hidden');
    this.el('game-dialogue').querySelector('span')!.textContent = other.name;
    this.el('game-dialogue').querySelector('p')!.textContent = content;
    window.clearTimeout(this.dialogueTimer);
    this.dialogueTimer = window.setTimeout(() => this.el('game-dialogue').classList.add('hidden'), 6500);
    return true;
  }
  private drawMap(player: AgentState): void {
    const canvas = this.el<HTMLCanvasElement>('game-minimap'); const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 360, 230); ctx.strokeStyle = '#3b5c453b'; ctx.lineWidth = 1;
    const scale = 0.75;
    const set = filmSetAt(player.position, player.isInMatrix);
    if (set) {
      const x = 180 + (set.center.x - player.position.x) * scale; const z = 115 + (set.center.z - player.position.z) * scale;
      ctx.fillStyle = '#526c483b'; ctx.strokeStyle = '#a4b79a';
      ctx.fillRect(x - set.width * scale / 2, z - set.depth * scale / 2, set.width * scale, set.depth * scale);
      ctx.strokeRect(x - set.width * scale / 2, z - set.depth * scale / 2, set.width * scale, set.depth * scale);
      ctx.fillStyle = '#bbcaad'; for (const o of filmObstacles(set)) ctx.fillRect(x + (o.x - o.width / 2) * scale, z + (o.z - o.depth / 2) * scale, o.width * scale, o.depth * scale);
      ctx.strokeStyle = '#3b5c453b';
    }
    for (let n = -8; n < 8; n++) {
      const x = 180 + (Math.round(player.position.x / 80) * 80 + n * 80 - player.position.x) * scale;
      const z = 115 + (Math.round(player.position.z / 80) * 80 + n * 80 - player.position.z) * scale;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 230); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(360, z); ctx.stroke();
    }
    for (const agent of Object.values(this.agents)) {
      if (agent.id === player.id || agent.isInMatrix !== player.isInMatrix || agent.status !== 'alive') continue;
      ctx.fillStyle = FACTION_COLORS[agent.faction] ?? '#b2caa7';
      ctx.beginPath(); ctx.arc(180 + (agent.position.x - player.position.x) * scale, 115 + (agent.position.z - player.position.z) * scale, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(180, 115); ctx.rotate(-player.rotation + Math.PI);
    ctx.fillStyle = '#d6ffc5'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#a4d79355'; ctx.beginPath(); ctx.arc(180, 115, 30, 0, Math.PI * 2); ctx.stroke();
  }
}
