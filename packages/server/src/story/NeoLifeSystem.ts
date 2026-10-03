import { LIFE_ACTIONS, LIFE_DESTINATIONS, NEO_ANOMALIES, NEO_CAST, NEO_CHAPTERS, NEO_MISSIONS, LOCATIONS,
  distance, insideLifeRoom, lifeActionPosition, lifeRoomCenter, locationEntrance, missionPosition,
  type AgentState, type NeoLifeState, type SandboxState, type Vector3, type Philosophy } from '@auto_matrix/shared';
import { FilmStorySystem } from './FilmStorySystem.js';
import { updateMetacortexDoors } from './MetacortexDoors.js';
import { METACORTEX, metacortexFloor, metacortexLiftPose, metacortexLiftLocked, nearMetacortexLift } from '@auto_matrix/shared';
import { APARTMENT_NETWORK, APARTMENT_ROOM, computerCheckLocked } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import type { WorldDynamics } from './WorldDynamics.js';

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

export class NeoLifeSystem {
  readonly film: FilmStorySystem;
  constructor(private world: WorldState, private dynamics: WorldDynamics, private sandbox: () => SandboxState) {
    this.film = new FilmStorySystem(world, sandbox, tick => this.bluePill(tick), (minutes, tick) => this.elapse(minutes, tick));
  }
  get state(): NeoLifeState | undefined { return this.sandbox().neoLife; }
  get chapter() { return this.state ? NEO_CHAPTERS[this.state.chapter] : undefined; }
  private get now(): number { return (this.world.day - 1) * 1440 + this.world.timeOfDay * .06; }

  begin(agent: AgentState, tick: number, next = false): void {
    if (agent.id !== 'neo' || this.state && !next) return;
    const previous = this.state;
    if (previous?.journey) this.film.releaseCast(true);
    this.world.timeOfDay = 7500;
    this.sandbox().neoLife = {
      version: 1, cycle: (previous?.cycle ?? 0) + 1, startedDay: this.world.day, day: 1, lastMinute: this.now,
      seed: ((previous?.seed ?? this.sandbox().seed) + 0x9e3779b9) >>> 0,
      chapter: 0, money: 140, energy: 85, satiety: 48, social: 55, career: 50, doubt: previous ? 8 : 0, friends: 15,
      philosophy: { agency: 0, care: 0, trust: 0 }, done: {}, evidence: [], clues: [], quietActions: 0,
      lastAnomalyDay: 0, contactAfterDay: 2, nextStreetAt: tick + 100, lastStreetPosition: lifeRoomCenter('neo_apartment')!,
      choices: {}, journal: [], cycles: previous?.cycles ?? [],
      missions: Object.fromEntries(NEO_MISSIONS.map(m => [m.id, { status: 'locked', stage: 'ready', progress: 0, startedAt: 0 }])),
    };
    agent.isAwakened = false; agent.status = 'alive'; agent.health = agent.maxHealth;
    agent.activeEffects = []; agent.combatCooldowns = {};
    this.move(agent, 'neo_apartment', lifeRoomCenter('neo_apartment'));
    agent.rotation = Math.PI;
    if (agent.mind) { agent.mind.home = 'neo_apartment'; agent.mind.suspicion = this.state!.doubt; agent.mind.energy = 85; agent.mind.stress = 0; }
    const profile = this.sandbox().profiles.neo;
    if (profile) { profile.trace = 0; profile.trackedMission = ''; delete profile.job; }
    this.sandbox().threats = this.sandbox().threats.filter(t => t.target !== 'neo');
    this.sandbox().weather = 'clear'; this.sandbox().weatherUntil = tick + 600;
    for (const actor of this.world.agents.values()) {
      if (!actor.controller && actor.currentAction?.type === 'attack') {
        actor.currentAction = null; actor.targetPosition = null; actor.currentPath = []; actor.velocity = { x: 0, y: 0, z: 0 };
      }
      if (!NEO_CAST.includes(actor.id) || actor.id === 'neo' || actor.controller) continue;
      actor.status = 'alive'; actor.health = actor.maxHealth;
      this.move(actor, ['trinity', 'morpheus'].includes(actor.id) ? 'nebuchadnezzar'
        : actor.id === 'oracle' ? 'oracles_apartment' : actor.id === 'sati' ? 'mobil_ave' : actor.id === 'smith' ? 'architects_chamber' : actor.currentLocation);
    }
    this.note(previous ? '上一轮的回声' : '星期一，07:30', previous ? '你完成了一轮。协议与选择保存在手记的「循环记忆」中。这次仍从一个普通人的早晨开始。' : '今天可以去公司上班，也可以改变计划。早餐、钱、朋友与睡眠，暂时就是生活的全部。', tick);
  }

  private random(): number {
    const state = this.state!;
    state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }
  private move(agent: AgentState, location: string, position?: Vector3): void {
    agent.isInMatrix = LOCATIONS[location].world === 'matrix'; agent.currentLocation = location;
    agent.position = { ...(position ?? lifeRoomCenter(location) ?? locationEntrance(location)) };
    agent.velocity = { x: 0, y: 0, z: 0 }; agent.targetPosition = null; agent.currentPath = []; agent.currentAction = null;
  }
  private note(title: string, text: string, tick: number): void {
    const state = this.state!;
    state.journal.unshift({ day: state.day, time: this.world.timeOfDay, title, text });
    state.journal = state.journal.slice(0, 60);
    const neo = this.world.agents.get('neo')!;
    if (neo.mind) neo.mind.thought = text;
    this.dynamics.record({ type: 'discovery', title, description: text, cause: `Neo 第 ${state.cycle} 轮生活`, consequence: '记录在 Neo 的生活手记中。',
      involvedAgents: ['neo'], location: neo.currentLocation, position: { ...neo.position }, tick, importance: 6 });
  }
  private elapse(minutes: number, tick: number): void {
    this.world.advanceMinutes(minutes);
    this.updateNeeds(tick);
  }
  private updateNeeds(tick: number): void {
    const state = this.state!;
    const minutes = Math.max(0, this.now - state.lastMinute); state.lastMinute = this.now;
    state.day = this.world.day - state.startedDay + 1;
    state.energy = clamp(state.energy - minutes * .012);
    state.satiety = clamp(state.satiety - minutes * .02);
    state.social = clamp(state.social - minutes * .008);
    if (state.appointment && (state.day > state.appointment.day || this.world.timeOfDay > 20500 && state.day === state.appointment.day)) {
      state.friends = clamp(state.friends - 5); delete state.appointment;
      this.note('错过的约定', '朋友发来一条消息：今天没见到你，改天吧。关系还在，只是需要再次花时间。', tick);
    }
    if (!state.journey && state.chapter <= 1 && this.world.timeOfDay >= 18000 && state.done[`attendance:${state.day}`] !== state.day) {
      state.done[`attendance:${state.day}`] = state.day;
      if (state.done.work !== state.day) {
        state.career = clamp(state.career - 6);
        this.note('今天没有去公司', '主管留下了考勤提醒，工作评价下降。明天仍可以照常上班；生活没有因此结束。', tick);
      }
    }
    const neo = this.world.agents.get('neo');
    if (neo?.mind) { neo.mind.energy = state.energy; neo.mind.social = state.social; neo.mind.suspicion = neo.isAwakened ? 100 : state.doubt; }
  }

  command(agent: AgentState, target: string, tick: number): string {
    if (agent.id === 'neo' && computerCheckLocked(this.state?.computerCheck)) return 'Neo 正在操作桌边的网线，等他松手后再行动。';
    if (agent.id === 'neo' && this.state && (target === 'lift' || target === 'film:act' && this.film.state?.scene === 'm1_commute' && this.film.state.step === 1)) return this.useLift(agent, tick);
    if (agent.id === 'neo' && !this.film.custody.active(agent) && metacortexLiftLocked(this.state?.lift) && target !== 'film:retry') return '电梯正在运行。可以环顾轿厢，到站开门后再离开。';
    if (target.startsWith('film:')) {
      if (target === 'film:cycle' && this.state?.journey?.finished && this.film.controls(agent)) {
        if (agent.id !== 'neo' && !this.film.handoff?.(agent, 'neo', tick, true)) return 'Neo 正由另一位玩家控制，暂时无法开始下一轮。';
        const state = this.state;
        state.cycles.push({ cycle: state.cycle, days: state.day, ending: 'peace', philosophy: { ...state.philosophy }, choices: { ...state.choices }, evidence: [...state.evidence] });
        state.cycles = state.cycles.slice(-12);
        this.sandbox().ending = 'open';
        this.begin(this.world.agents.get('neo')!, tick, true);
        return '本轮已保存。新一天从 Neo 的公寓开始。';
      }
      return this.film.command(agent, target.slice(5), tick);
    }
    if (this.state?.journey) return 'J 打开电影故事手记，继续当前场景。';
    if (agent.id !== 'neo') return '这本生活手记属于 Neo。';
    if (!this.state) { this.begin(agent, tick); return '07:30，新的一天从家中开始。J 打开生活手记。'; }
    const state = this.state; this.updateNeeds(tick);
    if (state.activity) return '正在进行日常活动；移动离开可中断。';
    if (target.startsWith('computer:')) return this.computerCommand(agent, target.slice(9), tick);
    if (target.startsWith('go:')) return this.travel(agent, target.slice(3), tick);
    if (target.startsWith('anomaly:')) return this.investigate(agent, target.slice(8), tick);
    if (target.startsWith('choice:')) return this.choose(agent, target.slice(7), tick);
    const action = LIFE_ACTIONS.find(a => a.id === target);
    if (!action) return '没有这个日常活动。';
    if (!agent.isInMatrix) return '先回到矩阵中的日常地点。';
    if (action.location && distance(agent.position, lifeActionPosition(action)) > 10) return '先到这个地点，靠近日常活动区域。';
    if (action.window && (this.world.timeOfDay / 1000 < action.window[0] || this.world.timeOfDay / 1000 >= action.window[1])) return `这个活动的时间是 ${action.window[0]}:00–${action.window[1]}:00。`;
    if (action.once && state.done[action.id] === state.day) return '今天已经做过了。可以换个活动，明天再来。';
    if (state.money < action.cost) return '现金不足。上班可以获得薪水；散步和休息免费。';
    if (action.id === 'work' && state.energy < 18) return '精力不足，先吃饭或休息再上班。';
    if (action.id === 'meet' && state.appointment?.day !== state.day) return '先在家给朋友打电话，约好今晚见面。';
    state.activity = { id: target, startedAt: tick, endsAt: tick + (action.id === 'work' || action.id === 'sleep' ? 10 : 6), position: { ...agent.position } };
    return `${action.name}。停留片刻，完成后时间会自然推进。`;
  }

  private useLift(agent: AgentState, tick: number): string {
    const state = this.state!;
    if (metacortexLiftLocked(state.lift)) return '电梯正在运行，请等候开门。';
    if (!agent.isInMatrix || !nearMetacortexLift(agent.position)) return '先走到 Metacortex 的电梯前。';
    if (state.activity) return '先完成当前活动，再乘电梯。';
    if (state.journey && (state.journey.scene !== 'm1_commute' || state.journey.visiting)) return '先完成当前剧情，再安排下楼。';
    const lift = state.lift ??= { floor: 0, target: 0, phase: 'idle', elapsed: 0 };
    if (lift.phase !== 'idle') return '电梯正在运行，请等候开门。';
    const floor = metacortexFloor(agent.position)!;
    if (state.journey?.scene === 'm1_commute' && floor === 1) return '开发部到了，请走出电梯。';
    if (lift.floor !== floor) {
      lift.target = floor; lift.phase = 'closing'; lift.elapsed = 0; delete lift.passenger;
      this.liftFrame(agent, 0, tick); return '已呼叫电梯，请在门外等候。';
    }
    if (Math.abs(agent.position.x - METACORTEX.center.x) > 1.8 || Math.abs(agent.position.z - METACORTEX.center.z - METACORTEX.liftZ) > 1.6) return '电梯已开门。先走进轿厢，再按 G 选择楼层。';
    lift.target = floor === 0 ? 1 : 0; lift.phase = 'closing'; lift.elapsed = 0;
    lift.passenger = { x: agent.position.x, z: agent.position.z };
    this.liftFrame(agent, 0, tick); return floor === 0 ? '关门，上行到开发部。' : '关门，下行到一层大堂。';
  }

  liftFrame(agent: AgentState, dt: number, tick: number): boolean {
    if (agent.id !== 'neo' || !this.state) return false;
    if (this.film.custody.active(agent)) return false;
    const lift = this.state.lift;
    const carrying = metacortexLiftLocked(lift);
    if (lift && lift.phase !== 'idle' && agent.controller) {
      const seconds = lift.phase === 'travel' ? METACORTEX.travelSeconds : METACORTEX.doorSeconds;
      lift.elapsed = Math.min(seconds, lift.elapsed + Math.max(0, Math.min(.1, dt)));
      if (lift.elapsed >= seconds) {
        lift.phase = lift.phase === 'closing' ? 'travel' : lift.phase === 'travel' ? 'opening' : 'idle'; lift.elapsed = 0;
        if (lift.phase === 'opening' || lift.phase === 'idle') lift.floor = lift.target;
      }
    }
    const pose = metacortexLiftPose(lift);
    if (lift?.passenger) {
      agent.position = { x: lift.passenger.x, y: 1 + pose.height, z: lift.passenger.z };
      agent.velocity = { x: 0, y: 0, z: 0 }; agent.targetPosition = null; agent.currentPath = [];
      agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, metacortexLift: true }, startedAt: tick, duration: 1, progress: 0 };
      if (this.film.state?.scene === 'm1_commute') this.film.state.checkpoint = { ...agent.position };
      if (lift.phase === 'idle') { delete lift.passenger; agent.currentAction = null; }
    }
    updateMetacortexDoors(this.sandbox(), lift);
    return carrying;
  }

  private travel(agent: AgentState, destination: string, tick: number): string {
    const chapter = this.chapter!;
    const anomaly = destination === 'anomaly' ? this.state!.anomaly : undefined;
    const target = anomaly?.location ?? (destination === 'story' ? chapter.location : destination);
    const storyDestination = stateAwake(this.state!) && (target === chapter.location || target === 'nebuchadnezzar');
    if (!LIFE_DESTINATIONS.includes(target) && !storyDestination && !anomaly) return '这个地点暂时没有可用的路线。';
    if (this.sandbox().threats.some(t => t.target === agent.id && t.matrix === agent.isInMatrix && distance(t.position, agent.position) < 28)) return '附近有追兵，先摆脱战斗再出发。';
    const mission = this.state!.missions[chapter.mission ?? ''];
    if (mission?.status === 'active' && mission.stage !== 'choice') return '先完成或撤离当前行动，再安排通勤。';
    const targetPosition = anomaly?.position ?? (destination === 'story' && chapter.mission ? missionPosition(chapter.mission) : lifeRoomCenter(target) ?? locationEntrance(target));
    if (agent.currentLocation === target && distance(agent.position, targetPosition) < 3) return '已经在目的地了。';
    let minutes = target === agent.currentLocation ? 2 : Math.max(10, Math.min(40, Math.round(distance(agent.position, targetPosition) / 20)));
    // Walking remains available; public transit costs time, but cannot strand a broke player.
    const fare = stateAwake(this.state!) || this.state!.money < 2 ? 0 : 2;
    if (!fare && !stateAwake(this.state!) && agent.currentLocation !== target) minutes *= 2;
    this.state!.money -= fare; this.elapse(minutes, tick); this.move(agent, target, targetPosition);
    const profile = this.sandbox().profiles.neo;
    if (!profile.visited.includes(target)) profile.visited.push(target);
    delete profile.job;
    this.stageCast();
    return `${fare ? '乘公共交通' : stateAwake(this.state!) ? '接线员安排路线' : '步行'}抵达${LOCATIONS[target].nameCn}，经过 ${minutes} 分钟。`;
  }

  private tryAnomaly(agent: AgentState, tick: number): void {
    const state = this.state!;
    if (state.chapter !== 0 || state.anomaly || state.lastAnomalyDay === state.day) return;
    state.quietActions++;
    const pool = NEO_ANOMALIES.filter(a => a.places.includes(agent.currentLocation) && !state.clues.includes(a.id));
    if (!pool.length) return;
    const chance = .18 + Math.min(.2, state.doubt / 200) + (state.energy > 45 ? .12 : 0) + (state.friends >= 30 ? .06 : 0);
    if (this.random() > chance && state.quietActions < 5) return;
    const anomaly = pool[Math.floor(this.random() * pool.length)];
    state.anomaly = { id: anomaly.id, location: agent.currentLocation, position: { ...agent.position } };
    state.lastAnomalyDay = state.day; state.quietActions = 0;
    this.note(anomaly.title, anomaly.text, tick);
  }
  private investigate(agent: AgentState, choice: string, tick: number): string {
    const state = this.state!; const signal = state.anomaly;
    if (!signal || !['ignore', 'observe', 'test'].includes(choice)) return '眼前没有尚未处理的异常。';
    const computer = signal.id === 'screen' && signal.location === 'neo_apartment' && choice === 'test';
    if (!agent.isInMatrix || !computer && distance(agent.position, signal.position) > 18) return '回到发现异常的地方，才能核对它。';
    if (computer) {
      if (!this.nearComputer(agent, APARTMENT_NETWORK.screenApproach, .75)) return '走到电脑书桌左侧，避开椅子，亲自查看显示器。';
      if (state.computerCheck?.phase !== 'evidence') {
        if (!state.computerCheck) state.computerCheck = { phase: 'reading', elapsed: 0 };
        return '任务列表没有对应进程。走到书桌右侧的网线旁，按 G 断开网络，再看它是否仍然出现。';
      }
      state.computerCheck = { phase: 'saved', elapsed: 0 };
    } else if (signal.id === 'screen' && state.computerCheck) state.computerCheck = state.computerCheck.phase === 'reading' ? undefined : { phase: 'saved', elapsed: 0 };
    const anomaly = NEO_ANOMALIES.find(a => a.id === signal.id)!;
    delete state.anomaly;
    if (choice === 'ignore') { state.doubt = clamp(state.doubt - 2); this.note('也许只是太累', '你选择继续今天的生活。这并不关闭之后调查其他异常的机会。', tick); return '生活继续。'; }
    if (!state.evidence.includes(anomaly.id)) state.evidence.push(anomaly.id);
    if (choice === 'test' && !state.clues.includes(anomaly.id)) state.clues.push(anomaly.id);
    state.doubt = clamp(state.doubt + (choice === 'test' ? 20 : 12));
    state.philosophy.agency += choice === 'test' ? 1 : 0;
    this.elapse(choice === 'test' ? 25 : 5, tick);
    this.note(choice === 'test' ? '一条经过核对的线索' : '把不确定记下来', choice === 'test' ? anomaly.inspect : '你没有急着解释，而是保存了亲历的细节。它还需要更多证据。', tick);
    this.checkContact(tick);
    return '线索已记入手记。';
  }
  private nearComputer(agent: AgentState, point: { x: number; z: number }, radius: number): boolean {
    return agent.isInMatrix && insideLifeRoom(agent.position) === 'neo_apartment'
      && distance(agent.position, { x: APARTMENT_ROOM.center.x + point.x, y: 1, z: APARTMENT_ROOM.center.z + point.z }) < radius;
  }
  private computerCommand(agent: AgentState, choice: string, tick: number): string {
    const state = this.state!, check = state.computerCheck;
    const signal = state.anomaly?.id === 'screen' && state.anomaly.location === 'neo_apartment';
    if (choice === 'capture') {
      if (!signal || check?.phase !== 'evidence') return '先断开网络，并等待显示器里的字再次出现，才能核对证据。';
      return this.investigate(agent, 'test', tick);
    }
    if (choice === 'disconnect' && (!signal || check?.phase !== 'reading') || choice === 'reconnect' && check?.phase !== 'saved'
      || !['disconnect', 'reconnect'].includes(choice)) return '这一步电脑操作还不能进行。';
    if (!this.nearComputer(agent, APARTMENT_NETWORK.approach, .75)) return '走到书桌右侧的网线旁，再操作实际插头。';
    state.computerCheck = { phase: choice === 'disconnect' ? 'unplugging' : 'replugging', elapsed: 0 };
    this.computerFrame(agent, 0, tick);
    return choice === 'disconnect' ? 'Neo 伸手断开网络。留意电脑是否还会收到字。' : 'Neo 把网线重新接好，日常生活继续。';
  }
  computerFrame(agent: AgentState, dt: number, tick: number): boolean {
    const check = agent.id === 'neo' && !this.state?.journey ? this.state?.computerCheck : undefined;
    if (!check) return false;
    const locked = computerCheckLocked(check);
    if (agent.controller && agent.status === 'alive' && (locked || check.phase === 'offline')) {
      const duration = locked ? APARTMENT_NETWORK.seconds : APARTMENT_NETWORK.echoSeconds;
      check.elapsed = Math.min(duration, check.elapsed + Math.max(0, Math.min(.1, dt)));
      if (check.elapsed >= duration - 1e-8) {
        if (check.phase === 'replugging') delete this.state!.computerCheck;
        else { check.phase = check.phase === 'unplugging' ? 'offline' : 'evidence'; check.elapsed = 0; }
      }
    }
    if (locked) {
      agent.position = { x: APARTMENT_ROOM.center.x + APARTMENT_NETWORK.approach.x, y: 1, z: APARTMENT_ROOM.center.z + APARTMENT_NETWORK.approach.z };
      agent.rotation = APARTMENT_NETWORK.approach.yaw; agent.velocity = { x: 0, y: 0, z: 0 };
      agent.targetPosition = null; agent.currentPath = [];
      agent.currentAction = computerCheckLocked(this.state?.computerCheck) ? { type: 'idle', parameters: { player: true, resolved: true, computerCheck: { ...check } }, startedAt: tick, duration: 1, progress: 0 } : null;
    }
    return locked;
  }
  private checkContact(tick: number): void {
    const state = this.state!;
    if (state.chapter || state.day < state.contactAfterDay || state.evidence.length < 3 || state.doubt < 42) return;
    state.contactSignal = true;
    this.advance(tick);
    this.note('电脑里的陌生信号', '有人注意到你在追查同样的问题。家里的电脑留下了没有署名的连接痕迹；你可以先过完今天，再回家核对。', tick);
  }

  private choose(agent: AgentState, token: string, tick: number): string {
    const [id, value] = token.split(':'); const chapter = this.chapter!;
    if (chapter.id !== id) return '这段对话还没有发生，或你已经作出了选择。';
    const choice = chapter.choices?.find(c => c.id === value);
    if (!choice) return '当前章节没有这个回答。';
    const position = lifeRoomCenter(chapter.location) ?? locationEntrance(chapter.location);
    if (agent.isInMatrix !== (LOCATIONS[chapter.location].world === 'matrix') || distance(agent.position, position) > 16) return '请亲自到场，与对方交谈。';
    if (id === 'contact' && this.world.timeOfDay < 18000) return '崔尼蒂约在晚上见面。白天可以继续自己的生活。';
    const state = this.state!;
    if (id === 'terms' && value === 'liberation' && (state.philosophy.care < 4 || state.philosophy.agency < 4)) return '公开真相的方案需要至少 4 次自主判断与 4 次关怀生命的积累；也可以选择停战并保留退出权。';
    state.choices[id] = value;
    for (const [axis, amount] of Object.entries(choice.effect ?? {})) state.philosophy[axis as Philosophy] += amount!;
    const profile = this.sandbox().profiles.neo;
    if (id === 'oracle_first') {
      profile.inventory.medkit += value === 'rescue' ? 3 : 1; profile.inventory.code += value === 'doubt' ? 10 : 0;
      state.choices.oracle_prepared = value;
    }
    if (id === 'betrayal') profile.inventory[value === 'together' ? 'medkit' : 'emp'] += 2;
    if (id === 'zion') { profile.inventory[value === 'defense' ? 'emp' : 'decoder'] += 2; if (value === 'defense') this.sandbox().zion = clamp(this.sandbox().zion + 15); }
    if (id === 'oracle_second') profile.inventory.decoder++;
    if (id === 'oracle_last') { profile.inventory.emp += 2; profile.inventory.medkit += 3; }
    if (id === 'terms') state.ending = value as NeoLifeState['ending'];
    this.elapse(10, tick); this.note(chapter.title, `${choice.label}。${choice.response}`, tick);
    if (id === 'dawn') {
      state.cycles.push({ cycle: state.cycle, days: state.day, ending: state.ending!, philosophy: { ...state.philosophy }, choices: { ...state.choices }, evidence: [...state.evidence] });
      state.cycles = state.cycles.slice(-12);
      this.begin(agent, tick, true);
      return '本轮通关。你与矩阵的协议已保存，新一轮从晴朗的早晨开始。';
    }
    this.advance(tick); return choice.response;
  }

  missionCompleted(agent: AgentState, id: string, outcome: string | undefined, tick: number): void {
    if (agent.id !== 'neo' || this.chapter?.mission !== id) return;
    const state = this.state!;
    if (outcome) state.choices[id] = outcome;
    if (id === 'rabbit') {
      agent.isAwakened = true; this.sandbox().profiles.neo.inventory.medkit += 2;
      this.move(agent, 'nebuchadnezzar');
    }
    if (id === 'dojo') this.note('子弹时间已解锁', '训练让你学会改变对时间的感知。矩阵内按 Q 使用。', tick);
    if (id === 'architect') state.philosophy[outcome === 'trinity' ? 'care' : 'trust'] += 2;
    if (id === 'smith_final') {
      this.sandbox().threats = this.sandbox().threats.filter(t => t.target !== 'neo');
      this.sandbox().weather = 'clear'; this.sandbox().weatherUntil = tick + 600;
    }
    this.advance(tick);
  }
  bluePill(tick: number): void {
    const state = this.state!;
    state.choices.rabbit = 'blue'; state.chapter = 0; state.doubt = Math.max(12, state.doubt - 20); state.contactAfterDay = state.day + 2;
    state.missions.rabbit.status = 'locked'; this.sandbox().profiles.neo.trackedMission = '';
    this.sandbox().weather = 'clear'; this.sandbox().weatherUntil = tick + 600;
    this.move(this.world.agents.get('neo')!, 'neo_apartment');
    this.note('回到自己的生活', '你选择暂时不追查。工作、朋友和日程继续，已经写下的细节还在。至少两天后，新的怀疑才可能让那条联系重新出现。', tick);
  }
  private advance(tick: number): void {
    this.state!.chapter++;
    const chapter = this.chapter!;
    if (chapter.mission) {
      this.state!.missions[chapter.mission].status = 'available';
      this.sandbox().profiles.neo.trackedMission = chapter.mission;
    } else this.sandbox().profiles.neo.trackedMission = '';
    if (chapter.id === 'dawn') { this.world.advanceMinutes(((31000 - this.world.timeOfDay) % 24000) * .06); this.state!.day = this.world.day - this.state!.startedDay + 1; this.state!.lastMinute = this.now; this.sandbox().weather = 'clear'; this.sandbox().weatherUntil = tick + 1200; }
    if (chapter.id === 'final') { this.sandbox().weather = 'rain'; this.sandbox().weatherUntil = tick + 2000; this.world.timeOfDay = 22000; this.state!.lastMinute = this.now; }
    this.stageCast();
  }
  private stageCast(): void {
    const chapter = this.chapter!;
    if (!chapter || chapter.id === 'ordinary' || chapter.mission) return;
    if (chapter.id === 'contact' && this.state!.contactSignal) return;
    const actor = this.world.agents.get(chapter.speaker);
    if (!actor || actor.id === 'neo' || actor.controller) return;
    const center = lifeRoomCenter(chapter.location) ?? locationEntrance(chapter.location);
    this.move(actor, chapter.location, { ...center, x: center.x + 4, z: center.z - 3 });
    actor.rotation = .5; actor.health = actor.maxHealth; actor.status = 'alive';
    actor.currentGoal = chapter.theme;
  }
  tick(tick: number): void {
    const state = this.state; if (!state) return;
    this.updateNeeds(tick);
    if (state.journey) { this.film.tick(tick); return; }
    const neo = this.world.agents.get('neo')!;
    if (!neo.controller || neo.status !== 'alive') { delete state.activity; return; }
    if (state.activity) {
      const activity = state.activity;
      if (!neo.isInMatrix || distance(neo.position, activity.position) > 3) { delete state.activity; return; }
      if (tick >= activity.endsAt) {
        const action = LIFE_ACTIONS.find(a => a.id === activity.id)!; delete state.activity;
        state.done[action.id] = state.day;
        state.money -= action.cost;
        if (action.id === 'work') state.career = clamp(state.career + 4);
        if (action.id === 'invite') state.appointment = { day: state.day, hour: 19, location: 'corner_cafe' };
        if (action.id === 'meet') { state.friends = clamp(state.friends + 15); delete state.appointment; }
        const minutes = action.id === 'sleep' ? (this.world.timeOfDay < 5000 ? 7500 - this.world.timeOfDay : 31500 - this.world.timeOfDay) * .06 : action.minutes;
        this.elapse(minutes, tick);
        state.energy = clamp(state.energy + action.energy); state.satiety = clamp(state.satiety + action.satiety); state.social = clamp(state.social + action.social);
        if (action.id === 'sleep') { neo.health = neo.maxHealth; state.energy = 95; }
        this.note(action.name, action.result, tick);
        if (!['sleep', 'wait', 'rest', 'invite'].includes(action.id)) this.tryAnomaly(neo, tick);
      }
    }
    if (tick >= state.nextStreetAt) {
      state.nextStreetAt = tick + 120;
      if (!insideLifeRoom(neo.position) && neo.isInMatrix && distance(neo.position, state.lastStreetPosition) > 35) this.tryAnomaly(neo, tick);
      state.lastStreetPosition = { ...neo.position };
    }
    this.checkContact(tick);
    this.stageCast();
    if (state.appointment && this.world.timeOfDay >= 18500 && this.world.timeOfDay <= 20500) {
      const friend = this.world.agents.get('choi');
      if (friend && !friend.controller) { friend.status = 'alive'; friend.health = friend.maxHealth; this.move(friend, 'corner_cafe', { ...lifeRoomCenter('corner_cafe')!, x: lifeRoomCenter('corner_cafe')!.x - 4 }); }
    }
  }
}

function stateAwake(state: NeoLifeState): boolean { return state.chapter > NEO_CHAPTERS.findIndex(c => c.id === 'pill'); }
