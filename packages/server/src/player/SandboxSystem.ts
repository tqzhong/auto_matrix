import { FILM_SETS, ITEMS, RECIPES, SKILLS, MISSIONS, NEO_MISSIONS, LOCATIONS, MELEE_COMBO, meleeReach, combatDisplace, distance, locationEntrance, missionPosition, nearTransit, playerBlocked, groundHeight, skillPoints,
  type AgentState, type ItemId, type SkillId, type SandboxState, type SandboxCommand, type SandboxThreat, type Vector3, type MissionDef, type CombatImpact, type CombatSkillId } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import type { WorldDynamics } from '../story/WorldDynamics.js';
import { NeoLifeSystem } from '../story/NeoLifeSystem.js';

export class SandboxSystem {
  state: SandboxState;
  readonly life: NeoLifeSystem;
  onImpact?: (impact: CombatImpact, tick: number) => void;

  constructor(private world: WorldState, private dynamics: WorldDynamics, seed = Date.now() >>> 0) {
    this.life = new NeoLifeSystem(world, dynamics, () => this.state);
    this.life.film.onImpact = (impact, tick) => this.onImpact?.(impact, tick);
    this.life.film.lobby.onImpact = (impact, tick) => this.onImpact?.(impact, tick);
    this.life.film.lobby.onHit = (actor, target, damage, tick) => { this.enterIfNeeded(actor); this.hit(actor, target, damage, tick); };
    this.state = { version: 1, seed, serial: 0, weather: 'clear', weatherUntil: world.simulationTick + 600,
      nextIncidentAt: world.simulationTick + 20, security: 25, corruption: 10, zion: 80, ending: 'open',
      profiles: {}, nodes: [], structures: [], threats: [], incidents: [], missions: {} };
    for (const location of Object.values(LOCATIONS).filter(l => l.id !== 'downtown' && !FILM_SETS[l.id])) {
      const entry = locationEntrance(location.id);
      for (const [kind, offset, name] of [['cache', 9, '物资箱'], ['terminal', -22, '数据终端'], ['phone', 18, '接入电话']] as const) {
        const position = { ...entry, x: entry.x + offset, z: entry.z + 8 };
        while (playerBlocked(position, location.world === 'matrix')) position.z += 5;
        this.state.nodes.push({ id: `${kind}:${location.id}`, kind, name: `${location.nameCn} · ${name}`, location: location.id,
          position, matrix: location.world === 'matrix', availableAt: 0 });
      }
    }
    for (const mission of NEO_MISSIONS) {
      this.state.missions[mission.id] = { status: mission.requires ? 'locked' : 'available', stage: 'ready', progress: 0, startedAt: 0 };
      this.state.nodes.push({ id: `mission:${mission.id}`, kind: 'mission', name: mission.name, location: mission.location,
        position: missionPosition(mission.id), matrix: LOCATIONS[mission.location].world === 'matrix', availableAt: 0 });
    }
  }

  restore(saved: SandboxState): void {
    if (saved.version !== 1 || !Array.isArray(saved.nodes) || !saved.profiles || !saved.missions) throw new Error('Unsupported sandbox save');
    const defaults = this.state;
    this.state = structuredClone(saved);
    for (const node of defaults.nodes) if (!this.state.nodes.some(n => n.id === node.id)) this.state.nodes.push(node);
    for (const [id, progress] of Object.entries(defaults.missions)) this.state.missions[id] ??= progress;
    this.life.film.restoreOfficeSpace();
    this.life.film.restoreHotelSpace();
    this.life.film.restoreAwakeningSpace();
    this.life.film.reconcileCast();
    this.life.film.restoreTrainingSpace();
    const journey = this.life.film.state;
    if (journey) this.life.film.apartmentFrame(this.world.agents.get(journey.actor)!, 0, this.world.simulationTick);
    if (journey) this.life.film.clubFrame(this.world.agents.get(journey.actor)!, 0, this.world.simulationTick);
    if (journey?.scene === 'm1_boss') {
      delete journey.started;
      this.life.film.workdayFrame(this.world.agents.get(journey.actor)!, 0, this.world.simulationTick);
    }
    if (journey) this.life.film.betrayalFrame(this.world.agents.get(journey.actor)!, 0, this.world.simulationTick);
    if (journey) this.life.film.rescueFrame(this.world.agents.get(journey.actor)!, 0, this.world.simulationTick);
    if (journey) this.life.film.governmentFrame(this.world.agents.get(journey.actor)!, false, 0, this.world.simulationTick);
    if (journey) this.life.film.airRescueFrame(this.world.agents.get(journey.actor)!, false, 0, this.world.simulationTick);
    if (journey) this.life.film.matrixEscapeFrame(this.world.agents.get(journey.actor)!, { movement: 0, sprint: false }, 0, this.world.simulationTick);
    if (journey) this.life.film.lobby.frame(this.world.agents.get(journey.actor)!, 0, this.world.simulationTick);
  }
  missionsFor(agent: AgentState) { return agent.id === 'neo' && this.state.neoLife ? this.state.neoLife.missions : this.state.missions; }
  private random(): number {
    this.state.seed = (Math.imul(1664525, this.state.seed) + 1013904223) >>> 0;
    return this.state.seed / 4294967296;
  }
  private id(prefix: string): string { return `${prefix}:${++this.state.serial}`; }
  enter(agent: AgentState): void {
    if (!this.state.profiles[agent.id]) this.state.profiles[agent.id] = {
      inventory: { code: 4, scrap: 4, medkit: 2, decoder: 0, emp: 0, beacon: 1, barricade: 1 },
      xp: 0, skills: { combat: 0, hacking: 0, survival: 0 }, trace: 0,
      trackedMission: MISSIONS.find(m => this.state.missions[m.id].status !== 'complete')?.id ?? '',
      visited: [...new Set([agent.currentLocation, 'metacortex_office', 'nightclub', 'subway_station', 'nebuchadnezzar'])], lastAttack: -10, lastUse: -10,
    };
    delete this.state.profiles[agent.id].job;
  }
  private record(agent: AgentState | undefined, title: string, consequence: string, tick: number): void {
    this.dynamics.record({ type: 'discovery', title, description: consequence, consequence,
      cause: agent ? `${agent.name} 的行动` : '世界自然演变', involvedAgents: agent ? [agent.id] : [],
      location: agent?.currentLocation ?? 'times_square', position: agent ? { ...agent.position } : undefined, tick, importance: 7 });
  }
  private canPay(agent: AgentState, cost: Partial<Record<ItemId, number>>): boolean {
    return Object.entries(cost).every(([id, count]) => this.state.profiles[agent.id].inventory[id as ItemId] >= count!);
  }
  private pay(agent: AgentState, cost: Partial<Record<ItemId, number>>): void {
    for (const [id, count] of Object.entries(cost)) this.state.profiles[agent.id].inventory[id as ItemId] -= count!;
  }

  command(agent: AgentState, command: SandboxCommand, tick: number): string {
    if (agent.controller && command.kind === 'life' && command.target === 'film:retry') return this.life.film.command(agent, 'retry', tick);
    if (agent.status !== 'alive' || !agent.controller) return '先接入一个存活角色。';
    this.enterIfNeeded(agent);
    const profile = this.state.profiles[agent.id];
    const target = command.target ?? '';
    if (command.kind === 'life') return this.life.command(agent, target, tick);
    if (agent.id === 'neo' && this.state.neoLife && !agent.isAwakened && !['interact', 'choose', 'track'].includes(command.kind)) return '日常生活阶段使用 J 手记安排通勤和活动；程序工具会在觉醒后开放。';
    if (agent.id === 'neo' && this.state.neoLife?.activity) return '正在进行日常活动；移动可以中断。';
    if (command.kind === 'craft') {
      if (!Object.hasOwn(RECIPES, target)) return '没有这个配方。';
      const recipe = RECIPES[target as ItemId]!;
      if (!this.canPay(agent, recipe)) return '材料不足，探索补给箱与数据终端来收集原料。';
      this.pay(agent, recipe); profile.inventory[target as ItemId]++;
      return `已制作${ITEMS[target as ItemId].name}。`;
    }
    if (command.kind === 'upgrade') {
      if (!Object.hasOwn(SKILLS, target) || skillPoints(profile) < 1 || profile.skills[target as SkillId] >= 3) return '需要技能点；每获得 50 经验提供一点，每项最多三级。';
      profile.skills[target as SkillId]++;
      return `${SKILLS[target as SkillId].name}已提升。`;
    }
    if (command.kind === 'track') {
      if (!NEO_MISSIONS.some(m => m.id === target) || this.missionsFor(agent)[target].status === 'locked') return '这条线索尚未解锁。';
      profile.trackedMission = target; return '已标记目的地。M 打开地图，靠近接入电话可以旅行。';
    }
    if (command.kind === 'use') {
      if (!['medkit', 'emp'].includes(target)) return '这个物品需要制作、建造或在任务地点使用。';
      if (profile.lastUse + 2 > tick || profile.inventory[target as ItemId] < 1) return '物品不足或正在使用中。';
      if (target === 'medkit' && agent.health >= agent.maxHealth) return '生命已满，医疗包已保留。';
      profile.inventory[target as ItemId]--; profile.lastUse = tick;
      if (target === 'medkit') agent.health = Math.min(agent.maxHealth, agent.health + 40 + profile.skills.survival * 10);
      else for (const threat of [...this.state.threats]) {
        if (threat.matrix !== agent.isInMatrix || distance(threat.position, agent.position) > 35) continue;
        threat.stunUntil = tick + 12; this.hit(agent, threat, 45, tick);
      }
      agent.activeEffects.push({ abilityId: target, visualEffect: target === 'emp' ? 'code_overlay' : 'healing', remainingTicks: 6 });
      return target === 'medkit' ? '医疗包已使用。' : 'EMP 已释放：附近敌对程序受损并短暂瘫痪。';
    }
    if (command.kind === 'build') {
      if (!['beacon', 'barricade'].includes(target) || profile.inventory[target as ItemId] < 1) return '先在背包中制作这件设施。';
      if (this.state.structures.length >= 64) return '世界设施已达 64 个，请先拆回旧设施。';
      const position = { x: agent.position.x + Math.sin(agent.rotation) * 9, y: agent.position.y, z: agent.position.z + Math.cos(agent.rotation) * 9 };
      if (Math.abs(agent.position.y - groundHeight(agent.position, agent.isInMatrix)) > .2) return '请落地后建造。';
      if (playerBlocked(position, agent.isInMatrix, 5) || this.state.structures.some(s => s.matrix === agent.isInMatrix && distance(s.position, position) < 12)
        || this.state.nodes.some(n => n.matrix === agent.isInMatrix && distance(n.position, position) < 8)) return '前方空间不足，请朝向空旷街道建造。';
      profile.inventory[target as ItemId]--;
      this.state.structures.push({ id: this.id('structure'), kind: target as 'beacon' | 'barricade', owner: agent.id, position, matrix: agent.isInMatrix, health: target === 'beacon' ? 120 : 90 });
      this.record(agent, `${agent.name} 搭建了${ITEMS[target as ItemId].name}`, '设施留在世界里，切换角色后仍可使用。', tick);
      return '建造完成。安全屋可恢复生命、消除追踪并接入电话网络。';
    }
    if (command.kind === 'dismantle') {
      const index = this.state.structures.findIndex(s => s.id === target && s.owner === agent.id && s.matrix === agent.isInMatrix && distance(s.position, agent.position) < 16);
      if (index < 0) return '需要靠近自己建造的设施才能拆回。';
      const [structure] = this.state.structures.splice(index, 1); profile.inventory[structure.kind]++;
      return '设施已拆回背包。';
    }
    if (command.kind === 'transit') {
      if (!nearTransit(agent, this.state)) return '需要靠近接入电话或安全屋（18 米内）。';
      const location = Object.hasOwn(LOCATIONS, target) ? LOCATIONS[target] : undefined;
      const unlocked = profile.visited.includes(target) || NEO_MISSIONS.some(m => m.location === target && this.missionsFor(agent)[m.id].status !== 'locked');
      if (!location || !unlocked) return '先发现这个地点，或解锁相关任务。';
      if (!agent.isAwakened && agent.faction !== 'machines' && location.world === 'real' && agent.isInMatrix) return '先选择红色药丸觉醒，才能离开矩阵。';
      agent.isInMatrix = location.world === 'matrix'; agent.currentLocation = target; agent.position = locationEntrance(target);
      agent.velocity = { x: 0, y: 0, z: 0 }; agent.targetPosition = null; agent.currentPath = []; agent.currentAction = null;
      delete profile.job;
      if (!profile.visited.includes(target)) profile.visited.push(target);
      this.record(agent, `${agent.name} 接入${location.nameCn}`, '通过已建立的电话网络旅行，人物与世界时间继续推进。', tick);
      return `已到达${location.nameCn}。`;
    }
    if (command.kind === 'choose') {
      const [id, choice] = target.split(':');
      return this.choose(agent, id, choice, tick);
    }
    if (command.kind !== 'interact') return '未知操作。';
    if (profile.job) return '正在破解。留在原地等待，移动会中断。';
    const interactables = [...this.state.nodes, ...this.state.incidents].filter(n => n.matrix === agent.isInMatrix && distance(n.position, agent.position) < 14);
    const node = target ? interactables.find(n => n.id === target) : interactables.sort((a, b) => distance(a.position, agent.position) - distance(b.position, agent.position))[0];
    if (!node) return '走近物资箱、终端或事件信号，再按 G。';
    if (node.kind === 'mission') return this.startMission(agent, node.id.slice(8), tick);
    if (agent.id === 'neo' && this.state.neoLife && !agent.isAwakened) return '这是普通生活中的物件。J 打开生活手记，选择附近的日常活动。';
    if (node.kind === 'phone') return '线路已接通。按 M 打开地图，选择已发现或任务解锁的目的地。';
    if ('availableAt' in node && node.availableAt > tick) return `资源恢复中，还需 ${Math.ceil((node.availableAt - tick) / 2)} 秒。`;
    if (node.kind === 'cache' && 'availableAt' in node) {
      const code = 2 + Math.floor(this.random() * 4); const scrap = 2 + Math.floor(this.random() * 4);
      profile.inventory.code += code; profile.inventory.scrap += scrap; profile.xp += 5; node.availableAt = tick + 360;
      return `找到代码 ×${code}、零件 ×${scrap}，获得 5 经验。`;
    }
    if (node.kind === 'raid' && this.state.threats.some(threat => threat.incident === node.id)) return '先用 F 或 EMP 清除周围追兵，再处理这次事件。';
    profile.job = { target: node.id, startedAt: tick, endsAt: tick + Math.max(3, 10 - profile.skills.hacking * 2), position: { ...agent.position } };
    return '开始解析信号，留在原地；移动会中断。';
  }

  private enterIfNeeded(agent: AgentState): void { if (!this.state.profiles[agent.id]) this.enter(agent); }
  attack(agent: AgentState, tick: number, combo = 0): string | null {
    const strike = MELEE_COMBO[combo];
    const targets = this.state.threats.filter(t => t.matrix === agent.isInMatrix && meleeReach(agent.position, agent.rotation, t.position, strike.reach, agent.isInMatrix, this.state.structures))
      .sort((a, b) => distance(a.position, agent.position) - distance(b.position, agent.position));
    if (!targets[0]) return null;
    this.enterIfNeeded(agent);
    const profile = this.state.profiles[agent.id];
    // The socket controller enforces the real-time attack cooldown. Using world
    // ticks here would slow the player's attacks during their own bullet time.
    profile.lastAttack = tick;
    agent.currentAction = { type: 'attack', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 };
    const target = targets[0];
    const damage = strike.damage + profile.skills.combat * 6;
    const direction = { x: Math.sin(agent.rotation), y: 0, z: Math.cos(agent.rotation) };
    const position = { ...target.position, y: target.position.y + 2 };
    const health = target.health;
    const training = this.life.film.trainingHit(agent, target, combo);
    const bathroom = this.life.film.bathroomHit(agent, target);
    const matrixEscape = this.life.film.matrixEscapeHit(agent, target, combo, tick);
    if (!training && !bathroom && !matrixEscape) this.hit(agent, target, damage, tick);
    target.attackAt = undefined;
    target.stunUntil = training ? Math.max(target.stunUntil, tick + (combo === 2 ? 2 : 1)) : tick + (combo === 2 ? 2 : 1);
    target.position = combatDisplace(target.position, direction, strike.push, target.matrix, this.state.structures);
    this.onImpact?.({ source: agent.id, target: target.id, position, direction, damage: bathroom || matrixEscape ? damage : training ? target.health <= 0 ? damage : 0 : health - target.health, combo,
      matrix: agent.isInMatrix, downed: target.health <= 0 }, tick);
    if (training || bathroom || matrixEscape) return this.life.film.state?.lastText ?? '剧情动作已记录。';
    return targets[0].health <= 0 ? '敌对程序已清除。' : `命中，目标剩余 ${targets[0].health} 生命。`;
  }

  skill(agent: AgentState, skill: CombatSkillId, tick: number): void {
    this.enterIfNeeded(agent);
    const radial = ['force_push', 'system_hack', 'escape'].includes(skill);
    const range = skill === 'system_hack' ? 9 : skill === 'force_push' ? 8 : skill === 'code_snare' ? 12 : skill === 'escape' ? 3 : 5;
    const targets = this.state.threats.filter(target => target.matrix === agent.isInMatrix && meleeReach(agent.position,
      radial ? Math.atan2(target.position.x - agent.position.x, target.position.z - agent.position.z) : agent.rotation,
      target.position, range, agent.isInMatrix, this.state.structures)).sort((a, b) => distance(a.position, agent.position) - distance(b.position, agent.position));
    for (const target of radial ? targets : targets.slice(0, 1)) {
      const damage = skill === 'force_push' ? 28 : skill === 'system_hack' ? 12 : skill === 'scorpion_dash' ? 38 : skill === 'crushing_palm' ? 55 : skill === 'code_snare' ? 18 : skill === 'viral_overwrite' ? 10 : 0;
      target.attackAt = undefined;
      target.stunUntil = tick + (skill === 'system_hack' ? 8 : skill === 'code_snare' ? 10 : 3);
      if (skill === 'viral_overwrite') target.infection = { source: agent.id, until: tick + 10, nextAt: tick + 1 };
      this.skillHit(agent, target, damage, tick, skill === 'force_push' ? 4 : skill === 'crushing_palm' ? 3 : .2);
    }
  }

  private skillHit(agent: AgentState, target: SandboxThreat, damage: number, tick: number, push = 0): void {
    const position = { ...target.position, y: target.position.y + 2 };
    const dx = target.position.x - agent.position.x; const dz = target.position.z - agent.position.z; const length = Math.max(.01, Math.hypot(dx, dz));
    const direction = { x: dx / length, y: 0, z: dz / length }; const health = target.health;
    this.hit(agent, target, damage, tick);
    target.position = combatDisplace(target.position, direction, push, target.matrix, this.state.structures);
    this.onImpact?.({ source: agent.id, target: target.id, position, direction, damage: health - target.health, combo: 2,
      matrix: agent.isInMatrix, downed: target.health <= 0 }, tick);
  }
  private hit(agent: AgentState, threat: SandboxThreat, damage: number, tick: number): void {
    threat.health = Math.max(0, threat.health - damage);
    if (threat.health) return;
    this.state.threats = this.state.threats.filter(t => t.id !== threat.id);
    const profile = this.state.profiles[agent.id];
    profile.xp += threat.kind === 'smith' ? 25 : 12; profile.inventory.code += 2; profile.inventory.scrap++;
    if (threat.kind !== 'training') profile.trace = Math.min(100, profile.trace + 4);
    if (threat.mission) {
      const actor = this.world.agents.get(threat.target) ?? agent;
      const progress = this.missionsFor(actor)[threat.mission];
      progress.progress++;
      if (!this.state.threats.some(t => t.mission === threat.mission && t.campaign === threat.campaign) && progress.stage === 'combat') {
        if (threat.mission === 'smith_final') { progress.stage = 'choice'; this.record(agent, 'Smith 核心已被击败', '回到广场终端，决定世界接下来的方向。', tick); }
        else this.complete(actor, NEO_MISSIONS.find(m => m.id === threat.mission)!, tick);
      }
    }
  }
  private spawnThreat(agent: AgentState, kind: SandboxThreat['kind'], tick: number, index: number, mission?: string, incident?: string): void {
    const angle = index * 2.3 + .7;
    let position = { x: agent.position.x + Math.sin(angle) * (18 + index * 2), y: agent.position.y, z: agent.position.z + Math.cos(angle) * (18 + index * 2) };
    if (playerBlocked(position, agent.isInMatrix)) position = { ...agent.position, z: agent.position.z + 12 };
    if (playerBlocked(position, agent.isInMatrix)) position = { ...agent.position };
    const health = kind === 'smith' ? 180 : kind === 'sentinel' ? 65 : kind === 'training' ? 36 : 48;
    this.state.threats.push({ id: this.id('threat'), kind, position, matrix: agent.isInMatrix, health, maxHealth: health,
      target: agent.id, mission, incident, campaign: agent.id === 'neo' && this.state.neoLife ? 'neo' : undefined, stunUntil: tick + 3, lastStrike: tick });
  }
  private startMission(agent: AgentState, id: string, tick: number): string {
    const mission = NEO_MISSIONS.find(m => m.id === id)!;
    const progress = this.missionsFor(agent)[id];
    if (agent.id === 'neo' && this.state.neoLife && this.life.chapter?.mission !== id) return '先完成 Neo 当前的生活或对话章节。J 查看手记。';
    if (progress.status === 'locked') return '先完成前一条线索。J 查看三部曲日志。';
    if (progress.status === 'complete') return '这段故事已经成为世界的记忆。继续探索下一条线索。';
    this.state.profiles[agent.id].trackedMission = id;
    if (progress.status === 'active') {
      progress.actor = agent.id;
      for (const threat of this.state.threats.filter(t => t.mission === id && (t.campaign === 'neo') === (agent.id === 'neo' && Boolean(this.state.neoLife)))) threat.target = agent.id;
      return progress.stage === 'choice' ? '按 J 打开日志，在这个终端旁作出选择。' : '行动仍在进行，你已接手。留意追兵与任务目标。';
    }
    if (mission.cost && !this.canPay(agent, mission.cost)) return `缺少任务物品：${Object.entries(mission.cost).map(([item, n]) => `${ITEMS[item as ItemId].name} ×${n}`).join('、')}。B 打开背包制作。`;
    if (mission.mode === 'hack') {
      this.state.profiles[agent.id].job = { target: `mission:${id}`, startedAt: tick, endsAt: tick + 12, position: { ...agent.position } };
      return '正在破解任务节点，留在原地直到完成。';
    }
    if (mission.cost) this.pay(agent, mission.cost);
    Object.assign(progress, { status: 'active', stage: mission.mode === 'choice' ? 'choice' : mission.mode === 'escort' ? 'escort' : 'combat', actor: agent.id, startedAt: tick, progress: 0 });
    if (mission.mode === 'choice') return '信号接通。按 J 打开日志，在终端旁作出选择。';
    if (mission.mode === 'escort') progress.escort = { position: { ...missionPosition(id) }, health: 100 };
    const count = id === 'dojo' ? 2 : ['subway_duel', 'bane_encounter'].includes(id) ? 1 : ['zion_siege', 'burly_brawl'].includes(id) ? 4 : 3;
    for (let i = 0; i < count; i++) this.spawnThreat(agent, id === 'dojo' ? 'training' : id === 'zion_siege' ? 'sentinel' : (id === 'smith_final' || id === 'subway_duel') && i === 0 ? 'smith' : 'agent', tick, i, id);
    this.record(agent, `${mission.name}：行动开始`, mission.objective, tick);
    return '行动开始。F 近战，Q 角色能力，1 医疗包，2 EMP；可以边移动边战斗。';
  }
  private complete(agent: AgentState, mission: MissionDef, tick: number): void {
    const progress = this.missionsFor(agent)[mission.id];
    if (progress.status === 'complete') return;
    progress.status = 'complete'; delete progress.escort;
    const profile = this.state.profiles[agent.id];
    profile.xp += mission.reward; profile.inventory.code += 5; profile.inventory.scrap += 4;
    if (agent.id === 'neo' && this.state.neoLife) this.life.missionCompleted(agent, mission.id, progress.outcome, tick);
    else {
      for (const next of MISSIONS.filter(m => m.requires === mission.id)) this.state.missions[next.id].status = 'available';
      profile.trackedMission = MISSIONS.find(m => this.state.missions[m.id].status === 'available')?.id ?? '';
      for (const [id, other] of Object.entries(this.state.profiles)) if (!(id === 'neo' && this.state.neoLife) && other.trackedMission === mission.id) other.trackedMission = profile.trackedMission;
    }
    if (mission.id === 'zion_siege') this.state.zion = Math.min(100, this.state.zion + 25);
    if (mission.id === 'lobby_rescue') {
      const morpheus = this.world.agents.get('morpheus');
      if (morpheus && !morpheus.controller) { morpheus.status = 'alive'; morpheus.health = morpheus.maxHealth; }
    }
    this.record(agent, `${mission.name}：完成`, `获得 ${mission.reward} 经验、5 代码与 4 零件。下一条线索已开放，结果会保存在世界中。`, tick);
  }
  private choose(agent: AgentState, id: string, choice: string, tick: number): string {
    const mission = NEO_MISSIONS.find(m => m.id === id);
    if (!mission?.choices?.some(c => c.id === choice)) return '没有这个选择。';
    const progress = this.missionsFor(agent)[id];
    if (agent.id === 'neo' && this.state.neoLife && this.life.chapter?.mission !== id) return '这不是 Neo 当前的章节。';
    if (progress.status !== 'active' || progress.stage !== 'choice') return '先在任务地点按 G 接通这个节点。';
    if (agent.isInMatrix !== (LOCATIONS[mission.location].world === 'matrix') || distance(agent.position, missionPosition(id)) > 16) return '这个决定需要你亲自站在任务终端旁。';
    const profile = this.state.profiles[agent.id];
    if (choice === 'blue') { profile.trace = Math.max(0, profile.trace - 25); progress.status = 'available'; progress.stage = 'ready'; if (agent.id === 'neo' && this.state.neoLife) this.life.bluePill(tick); return '你暂时回归日常生活。白兔的线索仍然保留。'; }
    if (choice === 'red') { agent.isAwakened = true; if (agent.mind) agent.mind.suspicion = 100; profile.trace = Math.min(100, profile.trace + 20); }
    if (choice === 'trinity') {
      const trinity = this.world.agents.get('trinity');
      if (trinity) { trinity.health = trinity.maxHealth; trinity.status = 'alive'; }
      this.state.zion = Math.min(100, this.state.zion + 15); this.state.security = Math.min(100, this.state.security + 15);
    }
    if (choice === 'stability') { this.state.security = Math.max(0, this.state.security - 20); this.state.corruption = Math.min(100, this.state.corruption + 12); }
    if (choice === 'pact') { this.state.zion = Math.min(100, this.state.zion + 20); profile.inventory.emp += 2; }
    if (choice === 'independent') { profile.inventory.code += 12; profile.xp += 30; }
    if (id === 'smith_final' && !(agent.id === 'neo' && this.state.neoLife)) {
      this.state.ending = choice as 'peace' | 'reboot' | 'liberation';
      this.state.corruption = choice === 'peace' ? 0 : choice === 'reboot' ? 5 : 25;
      this.state.security = choice === 'peace' ? 10 : choice === 'reboot' ? 40 : 70;
      if (choice === 'reboot') { this.state.seed = (this.state.seed + 0x9e3779b9) >>> 0; this.state.nodes.forEach(node => node.availableAt = 0); }
      if (choice === 'liberation') for (const resident of this.world.agents.values()) {
        if (resident.status === 'alive' && resident.isInMatrix && resident.faction !== 'machines') { resident.isAwakened = true; if (resident.mind) resident.mind.suspicion = 100; }
      }
      if (choice === 'peace') {
        this.state.zion = Math.min(100, this.state.zion + 20);
        this.state.threats = this.state.threats.filter(t => t.mission);
        for (const resident of this.world.agents.values()) if (!resident.controller && resident.currentAction?.type === 'attack') {
          resident.currentAction = null; resident.targetPosition = null; resident.currentPath = []; resident.velocity = { x: 0, y: 0, z: 0 };
        }
      }
    }
    progress.outcome = choice;
    this.complete(agent, mission, tick);
    return `${mission.choices.find(c => c.id === choice)!.label}。你的选择已写入世界。`;
  }

  tick(tick: number): void {
    this.life.tick(tick);
    if (tick >= this.state.weatherUntil) {
      const roll = this.random();
      this.state.weather = this.state.neoLife ? roll < .2 ? 'rain' : 'clear' : roll < .12 + this.state.corruption / 200 ? 'code_storm' : roll < .6 ? 'rain' : 'clear';
      this.state.weatherUntil = tick + 240 + Math.floor(this.random() * 360);
    }
    if (tick >= this.state.nextIncidentAt) {
      this.spawnIncident(tick); this.state.nextIncidentAt = tick + 90 + Math.floor(this.random() * 120);
    }
    for (const incident of this.state.incidents.filter(i => tick >= i.expiresAt)) {
      if (incident.kind === 'distress') this.state.zion = Math.max(10, this.state.zion - 4);
      if (incident.kind === 'glitch' && this.state.ending !== 'peace') this.state.corruption = Math.min(100, this.state.corruption + 3);
      if (incident.kind === 'raid') this.state.security = Math.min(100, this.state.security + 3);
      this.state.threats = this.state.threats.filter(t => t.incident !== incident.id);
    }
    this.state.incidents = this.state.incidents.filter(i => i.expiresAt > tick);
    for (const agent of this.world.agents.values()) {
      const profile = this.state.profiles[agent.id];
      if (!profile || !agent.controller || agent.status !== 'alive') { if (profile) delete profile.job; continue; }
      if (!profile.visited.includes(agent.currentLocation)) profile.visited.push(agent.currentLocation);
      const shelter = this.state.structures.some(s => s.kind === 'beacon' && s.matrix === agent.isInMatrix && distance(s.position, agent.position) < 15);
      if (tick % 4 === 0) {
        profile.trace = Math.max(0, profile.trace - (shelter ? 5 : 1));
        if (shelter) { agent.health = Math.min(agent.maxHealth, agent.health + (agent.isInMatrix || this.state.zion >= 30 ? 2 : 1) + profile.skills.survival); if (agent.mind) agent.mind.energy = Math.min(100, agent.mind.energy + 3); }
      }
      if (!this.life.film.controls(agent) && !(agent.id === 'neo' && this.state.neoLife) && profile.trace >= 35 && profile.trace + this.state.security / 2 >= 80 && tick % 100 === 0 && !shelter && !this.state.threats.some(t => t.target === agent.id && !t.mission)) this.spawnThreat(agent, agent.isInMatrix ? this.state.corruption >= 65 ? 'smith' : 'agent' : 'sentinel', tick, 0);
      if (!profile.job) continue;
      if (distance(profile.job.position, agent.position) > 3) { delete profile.job; continue; }
      if (tick < profile.job.endsAt) continue;
      const target = profile.job.target; delete profile.job;
      if (target.startsWith('mission:')) {
        const mission = NEO_MISSIONS.find(m => m.id === target.slice(8))!;
        if (this.missionsFor(agent)[mission.id].status !== 'available' || !this.canPay(agent, mission.cost ?? {})) continue;
        this.pay(agent, mission.cost ?? {}); this.complete(agent, mission, tick);
        continue;
      }
      const node = this.state.nodes.find(n => n.id === target && n.availableAt <= tick);
      const incident = this.state.incidents.find(i => i.id === target);
      if (!node && !incident) continue;
      if (node) node.availableAt = tick + 240;
      if (incident) {
        this.state.incidents = this.state.incidents.filter(i => i.id !== target);
        this.state.threats = this.state.threats.filter(t => t.incident !== target);
        this.state.zion = Math.min(100, this.state.zion + (incident.kind === 'distress' ? 5 : 1));
        this.state.corruption = Math.max(0, this.state.corruption - (incident.kind === 'glitch' ? 6 : 1));
      }
      profile.inventory.code += (incident ? 8 : 4) + profile.skills.hacking;
      profile.inventory.scrap += incident ? 4 : 1; profile.xp += incident ? 20 : 8;
      profile.trace = Math.min(100, profile.trace + (incident ? 4 : 10));
      this.record(agent, incident ? `${incident.name}：已处理` : '终端破解成功', '代码与经验已放入背包。系统开始追踪这次访问。', tick);
    }
    this.updateThreats(tick);
    const campaigns = [this.state.missions, ...(this.state.neoLife ? [this.state.neoLife.missions] : [])];
    for (const campaign of campaigns) for (const mission of NEO_MISSIONS) {
      const progress = campaign[mission.id];
      const neoCampaign = campaign === this.state.neoLife?.missions;
      if (progress.status !== 'active' || progress.stage === 'choice') continue;
      const actor = progress.actor ? this.world.agents.get(progress.actor) : undefined;
      if (!actor || actor.status !== 'alive' || (progress.escort && progress.escort.health <= 0) || tick - progress.startedAt > 900) {
        progress.status = 'available'; progress.stage = 'ready'; progress.progress = 0; delete progress.escort;
        this.state.threats = this.state.threats.filter(t => t.mission !== mission.id || (t.campaign === 'neo') !== neoCampaign);
        this.record(actor, `${mission.name}：行动中断`, '已保留重试机会。补充物资后，在任务终端重新开始。', tick);
        continue;
      }
      if (!progress.escort || !actor.controller || !actor.isInMatrix) continue;
      if (distance(actor.position, progress.escort.position) < 32) {
        progress.escort.position.x = Math.min(missionPosition(mission.id).x + 240, progress.escort.position.x + 2);
        const traveled = progress.escort.position.x - missionPosition(mission.id).x;
        progress.progress = Math.min(100, Math.floor(traveled / 240 * 100));
        if (traveled >= 240 && !this.state.threats.some(t => t.mission === mission.id && (t.campaign === 'neo') === neoCampaign)) this.complete(actor, mission, tick);
      }
    }
  }

  private updateThreats(tick: number): void {
    for (const threat of [...this.state.threats]) {
      if (threat.scene === 'm1_lobby' || threat.patrol) continue;
      if (threat.infection && tick >= threat.infection.nextAt) {
        const source = this.world.agents.get(threat.infection.source);
        if (tick > threat.infection.until || !source || source.status !== 'alive' || source.isInMatrix !== threat.matrix) delete threat.infection;
        else {
          threat.infection.nextAt = tick + 2;
          const damage = Math.min(10, threat.health);
          this.skillHit(source, threat, damage, tick);
          source.health = Math.min(source.maxHealth, source.health + damage / 2);
          if (threat.health <= 0) continue;
        }
      }
      if (tick < threat.stunUntil) { threat.attackAt = undefined; continue; }
      const actor = this.world.agents.get(threat.target);
      if (!actor?.controller || actor.status !== 'alive' || actor.isInMatrix !== threat.matrix) { threat.attackAt = undefined; continue; }
      const escort = threat.mission ? this.missionsFor(actor)[threat.mission]?.escort : undefined;
      const target = escort?.position ?? actor.position;
      const dx = target.x - threat.position.x; const dz = target.z - threat.position.z; const length = Math.hypot(dx, dz);
      if (threat.attackAt !== undefined) {
        if (tick < threat.attackAt) continue;
        threat.attackAt = undefined;
        if (!meleeReach(threat.position, Math.atan2(dx, dz), target, 3.8, threat.matrix, this.state.structures)) continue;
        const damage = threat.kind === 'training' ? threat.character ? threat.combo === 2 ? 5 : 3 : 2 : threat.kind === 'smith' ? 12 : 6;
        if (escort) escort.health = Math.max(0, escort.health - damage);
        else {
          if (actor.activeEffects.some(e => ['dodge', 'agent_dodge', 'vision_flash', 'phase_shift'].includes(e.visualEffect))) {
            this.life.film.trainingDodge(actor, threat, tick); continue;
          }
          if (actor.activeEffects.some(e => e.visualEffect === 'counter_guard')) {
            threat.stunUntil = tick + 3; this.skillHit(actor, threat, 20, tick, 1); continue;
          }
          const health = actor.health;
          const defended = actor.activeEffects.some(e => ['agent_dodge', 'slow_motion'].includes(e.visualEffect));
          actor.health = Math.max(threat.kind === 'training' ? 1 : 0, actor.health - (defended ? Math.ceil(damage / 3) : damage));
          this.onImpact?.({ source: threat.id, target: actor.id, position: { ...actor.position, y: actor.position.y + 2 },
            direction: { x: dx / Math.max(.01, length), y: 0, z: dz / Math.max(.01, length) }, damage: health - actor.health,
            combo: threat.combo ?? 0, matrix: threat.matrix, downed: actor.health <= 0 }, tick);
          delete this.state.profiles[actor.id].job;
          if (actor.health === 0) { actor.status = 'dead'; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null; this.life.film.matrixEscapeDefeated(actor); }
        }
        continue;
      }
      const step = threat.character === 'seraph' ? 3.4 : threat.kind === 'smith' ? 4.5 : threat.kind === 'training' ? 2 : 3;
      const approach = Math.min(step, Math.max(0, length - 2.7));
      const next = { ...threat.position, x: threat.position.x + dx / Math.max(1, length) * approach, z: threat.position.z + dz / Math.max(1, length) * approach };
      const barrier = this.state.structures.find(s => s.kind === 'barricade' && !s.film && s.matrix === threat.matrix && distance(s.position, next) < 8);
      if (barrier) { if (tick % 4 === 0) barrier.health -= 8; }
      else if (length > 2.7) {
        if (!playerBlocked(next, threat.matrix, 1.1, this.state.structures)) threat.position = next;
        else {
          const sideX = { ...threat.position, x: next.x }; const sideZ = { ...threat.position, z: next.z };
          if (!playerBlocked(sideX, threat.matrix, 1.1, this.state.structures)) threat.position = sideX;
          if (!playerBlocked(sideZ, threat.matrix, 1.1, this.state.structures)) threat.position = { ...threat.position, z: sideZ.z };
        }
      }
      if (distance(threat.position, target) > 3.3 || tick - threat.lastStrike < (threat.character === 'seraph' ? 4 : threat.character === 'morpheus' ? 7 : 5) || barrier) continue;
      threat.lastStrike = tick;
      threat.combo = threat.character ? ((threat.combo ?? -1) + 1) % 3 : 0;
      threat.attackAt = tick + (threat.character === 'morpheus' ? 2 : 1);
    }
    this.state.structures = this.state.structures.filter(s => s.health > 0);
    this.state.threats = this.state.threats.filter(t => t.scene || t.mission || t.incident || this.world.agents.get(t.target)?.controller && (this.state.profiles[t.target]?.trace ?? 0) > 20);
  }
  private spawnIncident(tick: number): void {
    if (this.state.neoLife?.journey || this.state.neoLife && this.world.agents.get('neo')?.controller) return;
    if (this.state.incidents.length >= 4) return;
    const living = [...this.world.agents.values()].filter(a => a.status === 'alive');
    const players = living.filter(a => a.controller);
    const pool = players.length ? players : living;
    const witness = pool[Math.floor(this.random() * pool.length)];
    if (!witness) return;
    const templates = [
      ['cache', '坠落的补给', '一段失控的装载程序留下物资。抢在系统回收前调查。'],
      ['distress', '失联的接线员', '受损的通信节点正在求救。修复它可以支援锡安。'],
      ['glitch', '似曾相识', '同一段代码在重复运行。分析裂缝可以抑制感染。'],
      ['raid', '特工封锁', '安全程序封锁了这个路口。击退追兵后清除追踪记录。'],
    ] as const;
    const roll = this.random();
    let index = roll < this.state.security / 200 ? 3 : Math.floor(this.random() * 3);
    if (this.state.ending === 'peace' && index === 3) index = 0;
    const [kind, name, description] = templates[index];
    const position = { ...witness.position, x: Math.round(witness.position.x / 80) * 80, z: Math.round(witness.position.z / 80) * 80 + 12 };
    if (playerBlocked(position, witness.isInMatrix)) Object.assign(position, witness.position);
    const incident = { id: this.id('incident'), kind, name, description, position, matrix: witness.isInMatrix, location: witness.currentLocation, expiresAt: tick + 300 + Math.floor(this.random() * 180) };
    this.state.incidents.push(incident);
    if (kind === 'raid' && witness.controller) for (let i = 0; i < 2; i++) this.spawnThreat(witness, witness.isInMatrix ? 'agent' : 'sentinel', tick, i, undefined, incident.id);
    this.dynamics.record({ type: kind === 'glitch' ? 'anomaly' : kind === 'raid' ? 'chase' : 'discovery', title: name, description,
      cause: '世界中的随机遭遇', consequence: '你可以参与，也可以继续自己的旅程；未处理的信号会到期。',
      involvedAgents: [witness.id], location: witness.currentLocation, position, tick, importance: 7 });
  }
}
