import { TRAINMAN_CHASE, TRAINMAN_OBSTACLES, FILM_SETS, FILM_SCENE_BY_ID, filmPosition, trainmanFloor, trainmanChaseActive,
  trainmanChaseLocked, trainmanChaseText, newTrainmanChase, trainmanCarPose, trainmanRoutePose, trainmanRouteLength, trainmanRouteProgress, trainmanVaultLift, trainmanVaultProgress,
  rayBox, distance, type AgentState, type SandboxState, type Vector3, type TrainmanChase } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

const SET = TRAINMAN_CHASE.set;
const zero = () => ({ x: 0, y: 0, z: 0 });
const position = (x: number, z: number, y = trainmanFloor(x, z)) => ({ ...filmPosition(SET, x, z), y: FILM_SETS[SET].center.y + y });

/** One saved player-frame clock owns the train, fleeing program and pursuers. */
export class TrainmanChaseSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return trainmanChaseActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => item.id !== 'film:trainman:car-door');
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.trainmanChase) member.currentAction = null;
  }
  private ensure(actor: AgentState): TrainmanChase {
    const journey = this.journey!;
    journey.helChase ??= { phase: 'sighting', elapsed: 0, lastTick: journey.enteredAt };
    if (!journey.helChase.performance) {
      const completed = journey.step >= FILM_SCENE_BY_ID.m3_trainman_chase.steps.length;
      journey.helChase.performance = newTrainmanChase();
      if (completed) Object.assign(journey.helChase.performance, { phase: 'escaped', passedGate: true, routeStage: 6, route: trainmanRouteLength() });
      else if (actor.currentLocation !== SET && actor.status === 'alive') {
        // Old six-second checkpoints used the first film's station. Migrate only
        // this unfinished scene; never change health or earlier story records.
        journey.step = 0; actor.position = position(TRAINMAN_CHASE.entry.x, TRAINMAN_CHASE.entry.z);
        actor.currentLocation = SET; actor.rotation = Math.PI; actor.velocity = zero(); journey.checkpoint = { ...actor.position };
      }
    }
    if (journey.helChase.performance.phase === 'ready') journey.helChase.performance.crew.trinity = -16;
    delete journey.started; return journey.helChase.performance;
  }
  private barrier(state: TrainmanChase): void {
    const id = 'film:trainman:car-door', structures = this.sandbox().structures;
    if (trainmanCarPose(state).doors >= .92) { this.sandbox().structures = structures.filter(item => item.id !== id); return; }
    if (!structures.some(item => item.id === id)) structures.push({ id, kind: 'barricade', owner: 'film', health: 1e9, matrix: true,
      position: position(-25.8, TRAINMAN_CHASE.car.doorZ), film: { scene: 'm3_trainman_chase', width: .25, depth: TRAINMAN_CHASE.car.doorWidth, height: 6.4 } });
  }
  private pose(member: AgentState, root: { x: number; y: number; z: number; yaw: number; vault?: number }, state: TrainmanChase, dt: number, tick: number): void {
    const before = member.position;
    member.position = position(root.x, root.z, root.y); member.rotation = root.yaw;
    member.currentLocation = SET; member.isInMatrix = true; member.targetPosition = null; member.currentPath = [];
    if (dt) member.velocity = { x: (member.position.x - before.x) / dt, y: (member.position.y - before.y) / dt, z: (member.position.z - before.z) / dt };
    const gun = member.id === 'trainman' && ['confronting', 'braking', 'cover', 'crossing'].includes(state.phase);
    member.currentAction = { type: 'idle', parameters: { resolved: true,
      trainmanChase: { phase: state.phase, elapsed: state.elapsed, age: state.age, role: member.id, vault: root.vault,
        stride: member.id === 'trainman' ? state.route : state.crew[member.id as 'trinity' | 'morpheus'],
        bracing: state.phase === 'braking', recoil: state.shot && state.shot.age < .2 ? 1 - state.shot.age / .2 : 0 },
      seated: member.id === 'trainman' && state.phase === 'ready', armed: gun, weaponStyle: 'revolver',
    }, startedAt: this.journey!.enteredAt, duration: 1e9, progress: 0 };
  }
  private cast(actor: AgentState, state: TrainmanChase, dt: number, tick: number): void {
    const trainman = this.world.agents.get('trainman');
    if (trainman && trainman.status === 'alive' && !trainman.controller) {
      let root = { x: -27.3, y: 0, z: 14, yaw: 0, vault: undefined as number | undefined };
      if (state.phase === 'confronting') {
        const t = Math.max(0, Math.min(1, (state.elapsed - 2) / 4));
        const stand = Math.min(1, state.elapsed / 1.4);
        root = { x: -27.3 + t * .7, y: 0, z: 14 + stand * 1.4 + t * 4.6, yaw: t < .5 ? 0 : Math.PI / 2, vault: undefined };
      } else if (state.phase === 'braking') root = { x: -26.6, y: 0, z: 20, yaw: Math.PI / 2, vault: undefined };
      else if (['running', 'vaulting', 'failed'].includes(state.phase)) root = trainmanRoutePose(state.route);
      else if (state.phase === 'cover') {
        root = trainmanRoutePose(trainmanRouteLength()); root.yaw = Math.atan2(actor.position.x - position(root.x, root.z).x, actor.position.z - position(root.x, root.z).z);
      } else if (state.phase === 'crossing' || state.phase === 'escaped') {
        const time = state.phase === 'escaped' ? 7 : state.elapsed, t = Math.min(1, time / 1.05);
        const escape = TRAINMAN_CHASE.escape;
        root = { x: escape.x + t * 18, z: escape.z - Math.min(escape.z - escape.runZ, Math.max(0, time - 1.05) * 5.5),
          y: Math.sin(t * Math.PI) * 3.2, yaw: t < 1 ? Math.PI / 2 : Math.PI, vault: t < 1 ? t : undefined };
      }
      this.pose(trainman, root, state, dt, tick);
    }
    for (const role of ['trinity', 'morpheus'] as const) {
      const member = this.world.agents.get(role); if (!member || member.status !== 'alive' || member.controller) continue;
      const root = trainmanRoutePose(state.crew[role]);
      this.pose(member, root, state, dt, tick);
    }
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, state = this.ensure(actor), center = FILM_SETS[SET].center;
    const occupied = TRAINMAN_CHASE.cast.find(id => id !== actor.id && this.world.agents.get(id)?.controller);
    const unavailable = TRAINMAN_CHASE.cast.find(id => this.world.agents.get(id)?.status !== 'alive');
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const elapsed = !occupied && !unavailable && actor.controller && actor.status === 'alive' ? Math.max(0, Math.min(.1, dt)) : 0;
    if (elapsed) {
      state.age += elapsed;
      if (state.shot) state.shot.age += elapsed;
      if (state.phase === 'confronting' || state.phase === 'braking' || state.phase === 'vaulting' || state.phase === 'cover' || state.phase === 'crossing') state.elapsed += elapsed;
      if (state.phase === 'confronting' && state.elapsed >= 6) { state.phase = 'braking'; state.elapsed = 0; }
      else if (state.phase === 'braking' && state.elapsed >= TRAINMAN_CHASE.brakingSeconds) {
        state.phase = 'running'; state.elapsed = 0; state.route = Math.hypot(3.4, 5);
        this.onAdvance?.('车门打开。追出车厢，经楼梯赶到 Platform 2。', actor, tick);
      } else if (state.phase === 'vaulting') {
        const t = Math.min(1, state.elapsed / TRAINMAN_CHASE.vaultSeconds), from = state.vaultStart!;
        const travel = trainmanVaultProgress(t, from.x);
        actor.position = position(from.x + (TRAINMAN_CHASE.gate.finishX - from.x) * travel,
          from.z + (TRAINMAN_CHASE.gate.z - from.z) * travel, TRAINMAN_CHASE.upper + trainmanVaultLift(t));
        actor.rotation = Math.PI / 2; actor.velocity = zero();
        if (t >= 1) { state.passedGate = true; state.routeStage = 3; state.phase = 'running'; state.elapsed = 0; }
      }
      if (state.phase === 'running' || state.phase === 'vaulting') {
        state.remaining = Math.max(0, state.remaining - elapsed);
        state.route = Math.min(trainmanRouteLength(), state.route + elapsed * 6.4);
        const x = actor.position.x - center.x, z = actor.position.z - center.z;
        if (state.routeStage === 0 && x > -24) state.routeStage = 1;
        if (state.routeStage === 1 && z < -13 && x < 0) state.routeStage = 2;
        if (state.passedGate && state.routeStage === 3 && x > 13 && z < -13) state.routeStage = 4;
        if (state.routeStage === 4 && z > -5 && x > 0) state.routeStage = 5;
        if (state.routeStage === 5 && x > 22 && z > -6) state.routeStage = 6;
        if (state.routeStage === 6 && state.route >= trainmanRouteLength() && distance(actor.position, position(TRAINMAN_CHASE.cover.x, TRAINMAN_CHASE.cover.z)) < 3) {
          state.phase = 'cover'; state.elapsed = 0; journey.checkpoint = { ...actor.position };
          this.onAdvance?.('Trainman 在柱后开枪。柱子可以截住射线；列车即将进站。', actor, tick);
        } else if (state.remaining <= 0) { state.phase = 'failed'; state.elapsed = 0; }
      }
      if (state.phase === 'cover') {
        const previous = state.elapsed - elapsed, period = 1.8;
        if (Math.floor(previous / period) !== Math.floor(state.elapsed / period) || !state.aim) state.aim = { ...actor.position, y: actor.position.y + 2.35 };
        if (Math.floor((previous - .75) / period) !== Math.floor((state.elapsed - .75) / period) && state.elapsed > .75) this.fire(actor, state);
        if (state.elapsed >= TRAINMAN_CHASE.coverSeconds) { state.phase = 'crossing'; state.elapsed = 0; }
      } else if (state.phase === 'crossing' && state.elapsed >= 7) { state.phase = 'escaped'; state.elapsed = 7; }
      if (['running', 'vaulting', 'cover', 'crossing', 'escaped'].includes(state.phase)) {
        const progress = trainmanRouteProgress(actor.position.x - center.x, actor.position.y - center.y, actor.position.z - center.z);
        state.playerRoute = progress;
        for (const [index, role] of (['trinity', 'morpheus'] as const).entries()) {
          const next = Math.min(progress - 3.4 - index * 3.4, state.crew[role] + elapsed * 6.8);
          if (next > state.crew[role]) state.crew[role] = next;
        }
      }
    }
    this.barrier(state);
    if (!occupied && !unavailable) this.cast(actor, state, elapsed, tick);
    actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, trainmanChase: {
      phase: state.phase, elapsed: state.elapsed, age: state.age, role: 'seraph', bracing: state.phase === 'braking',
      paused: state.paused, unavailable: state.unavailable,
      vault: state.phase === 'vaulting' ? Math.min(1, state.elapsed / TRAINMAN_CHASE.vaultSeconds) : undefined,
      dodging: state.dodgeUntil !== undefined ? Math.max(0, 1 - (state.dodgeUntil - state.age) / .85) : undefined,
    } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    journey.helChase!.phase = state.phase === 'escaped' ? 'escaped' : ['ready', 'confronting', 'braking'].includes(state.phase) ? 'sighting' : 'running';
    journey.helChase!.elapsed = state.elapsed; journey.helChase!.lastTick = tick;
    journey.lastText = trainmanChaseText(state);
    return trainmanChaseLocked(state);
  }
  private fire(actor: AgentState, state: TrainmanChase): void {
    const source = position(TRAINMAN_CHASE.escape.x, TRAINMAN_CHASE.escape.z, 2.5), aim = state.aim!, length = distance(source, aim);
    const direction = { x: (aim.x - source.x) / length, y: (aim.y - source.y) / length, z: (aim.z - source.z) / length };
    let hit = length, blocked = false;
    for (const obstacle of TRAINMAN_OBSTACLES) {
      if (obstacle.kind !== 'column' && obstacle.kind !== 'wall') continue;
      const p = position(obstacle.x, obstacle.z, obstacle.y);
      const collision = rayBox(source, direction, { x: p.x - obstacle.width / 2, y: p.y, z: p.z - obstacle.depth / 2 },
        { x: p.x + obstacle.width / 2, y: p.y + obstacle.height, z: p.z + obstacle.depth / 2 });
      if (collision !== undefined && collision < hit) { hit = collision; blocked = true; }
    }
    const to = { x: source.x + direction.x * hit, y: source.y + direction.y * hit, z: source.z + direction.z * hit };
    state.shot = { from: source, to, age: 0, blocked };
    if (blocked) { state.impacts.push({ x: to.x - FILM_SETS[SET].center.x, y: to.y - FILM_SETS[SET].center.y, z: to.z - FILM_SETS[SET].center.z }); state.impacts = state.impacts.slice(-12); }
    else if (Math.hypot(actor.position.x - aim.x, actor.position.z - aim.z) < .95 && (state.dodgeUntil ?? 0) < state.age) {
      actor.health = Math.max(1, actor.health - 9);
      if (actor.health <= 1) { state.phase = 'failed'; state.elapsed = 0; }
    }
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.helChase!.performance!;
    if (state.paused || state.unavailable) return trainmanChaseText(state);
    if (target === 'retry') {
      if (state.phase !== 'failed') return '追逐仍在继续，当前进度已保存。';
      const retry = newTrainmanChase(); Object.assign(retry, { phase: 'running', attempts: state.attempts + 1, route: Math.hypot(3.4, 5) });
      journey.helChase!.performance = retry;
      actor.position = position(-30, 25); actor.velocity = zero(); actor.rotation = Math.PI;
      journey.step = 1; journey.checkpoint = { ...actor.position }; this.frame(actor, 0, tick); return trainmanChaseText(retry);
    }
    if (target !== 'act') return;
    if (state.phase === 'ready') {
      if (distance(actor.position, position(TRAINMAN_CHASE.question.x, TRAINMAN_CHASE.question.z)) > 2) return '先沿车厢中央通道靠近 Trainman，留出距离再请他帮忙。';
      state.phase = 'confronting'; state.elapsed = 0; journey.checkpoint = { ...actor.position }; this.frame(actor, 0, tick); return journey.lastText;
    }
    if (state.phase === 'running' && !state.passedGate && state.routeStage >= 2) {
      const gate = TRAINMAN_CHASE.gate;
      if (distance(actor.position, position(gate.approachX, gate.z, TRAINMAN_CHASE.upper)) > 1.8) return '先走到闸机左侧的翻越标记。';
      state.phase = 'vaulting'; state.elapsed = 0;
      state.vaultStart = { x: actor.position.x - FILM_SETS[SET].center.x, z: actor.position.z - FILM_SETS[SET].center.z, yaw: actor.rotation };
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (state.phase === 'escaped' && journey.step === 2) {
      if (distance(actor.position, position(TRAINMAN_CHASE.exit.x, TRAINMAN_CHASE.exit.z)) > 2) return '走到两位同行者身旁，再商量如何救回 Neo。';
      this.onAdvance?.('Trinity 决定直接去找 Merovingian，迫使他放回 Neo。', actor, tick); return journey.lastText;
    }
    return trainmanChaseText(state);
  }
  action(actor: AgentState, kind: string): string | undefined {
    if (!this.active(actor) || !['dodge', 'attack', 'shoot', 'ability', 'ability2', 'travel'].includes(kind)) return;
    const state = this.ensure(actor);
    if (kind === 'dodge' && state.phase === 'cover' && !state.paused && !state.unavailable) { state.dodgeUntil = state.age + .85; return 'Seraph 避开已经锁定的射线，继续利用钢柱接近。'; }
    return '需要活着的 Trainman 接通线路。保持距离，按追逐提示行动。';
  }
}
