import { ZION_DEPLOYMENT, FILM_SETS, FILM_SCENE_BY_ID, zionDeploymentActive, zionDeploymentLocked, zionDeploymentTarget,
  zionDeploymentLines, zionDeploymentText, newZionDeployment, filmPosition, filmReflections, distance,
  type AgentState, type SandboxState, type ZionAllocation } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class ZionDeploymentSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return zionDeploymentActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:zion-deployment:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.zionDeployment) member.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m3_zion_prepare;
    if (!journey.zionDeployment) {
      const old = FILM_SETS.film_zion_council, center = FILM_SETS[scene.set].center;
      const legacy = Math.abs(actor.position.x - old.center.x) < old.width / 2 + 28 && Math.abs(actor.position.z - old.center.z) < old.depth / 2 + 28;
      if (legacy) {
        const untouched = journey.step === 0 && distance(actor.position, filmPosition(old.id, 0, old.depth * .32)) < .1;
        const shift = (point: AgentState['position']) => ({ x: center.x + (point.x - old.center.x) * 26 / old.width,
          y: point.y, z: center.z + (point.z - old.center.z) * 32 / old.depth });
        actor.position = shift(actor.position); journey.checkpoint = shift(journey.checkpoint);
        if (untouched) {
          actor.position = filmPosition(scene.set, ZION_DEPLOYMENT.entry.x, ZION_DEPLOYMENT.entry.z);
          journey.checkpoint = { ...actor.position }; actor.rotation = Math.PI;
        }
        journey.step = journey.step >= 2 ? 5 : journey.step === 1 ? 2 : 0;
        actor.currentLocation = scene.set;
      }
      journey.zionDeployment = newZionDeployment(journey.step, actor.health);
      if (legacy) journey.zionDeployment.legacy = true;
    }
    const state = journey.zionDeployment; delete journey.started;
    const occupied = ZION_DEPLOYMENT.cast.find(id => this.world.agents.get(id)?.controller);
    const unavailable = ZION_DEPLOYMENT.cast.find(id => !this.world.agents.get(id) || this.world.agents.get(id)!.status !== 'alive' || this.world.agents.get(id)!.health <= 0);
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const elapsed = !occupied && !unavailable && actor.controller && actor.status === 'alive' && actor.health > 0 ? Math.max(0, Math.min(.1, dt)) : 0;
    const close = (point: { x: number; z: number }, radius: number) => !actor.isInMatrix && actor.currentLocation === scene.set
      && distance(actor.position, filmPosition(scene.set, point.x, point.z)) <= radius;
    this.seal();
    if (state.phase === 'approach' && elapsed && close(ZION_DEPLOYMENT.report, 1.1)) {
      state.phase = 'ready'; this.onAdvance?.(zionDeploymentText(state), actor, tick);
    }
    const lines = zionDeploymentLines(state);
    if (lines) {
      state.elapsed = Math.min(lines.length * ZION_DEPLOYMENT.lineSeconds, state.elapsed + elapsed);
      if (state.elapsed >= lines.length * ZION_DEPLOYMENT.lineSeconds) {
        state.elapsed = 0;
        if (state.phase === 'reporting') state.phase = 'question';
        else if (state.phase === 'answering') { state.phase = 'review'; this.onAdvance?.(zionDeploymentText(state), actor, tick); }
        else state.phase = 'reflection';
      }
    } else if (state.phase === 'responding') {
      state.elapsed = Math.min(ZION_DEPLOYMENT.lineSeconds, state.elapsed + elapsed);
      if (state.elapsed >= ZION_DEPLOYMENT.lineSeconds) { state.elapsed = 0; state.phase = 'leaving'; this.onAdvance?.(zionDeploymentText(state), actor, tick); }
    } else if (state.phase === 'leaving' && elapsed && close(ZION_DEPLOYMENT.exit, 1.1)) {
      state.phase = 'done'; this.onAdvance?.(zionDeploymentText(state), actor, tick);
    }
    for (const [role, root] of Object.entries(ZION_DEPLOYMENT.roots)) {
      const member = this.world.agents.get(role); if (!member || member.status !== 'alive' || member.health <= 0 || member.controller) continue;
      member.position = filmPosition(scene.set, root.x, root.z); member.rotation = root.yaw;
      member.currentLocation = scene.set; member.isInMatrix = false; member.targetPosition = null; member.currentPath = [];
      member.velocity = { x: 0, y: 0, z: 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, zionDeployment: { ...state, confirmed: [...state.confirmed], role } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    if (zionDeploymentLocked(state) && !state.paused && !state.unavailable) {
      const point = zionDeploymentTarget(state); actor.position = filmPosition(scene.set, point.x, point.z);
      actor.rotation = state.phase === 'allocating' ? Math.PI / 2 : Math.PI;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, zionDeployment: { ...state, confirmed: [...state.confirmed], role: 'lock' } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.zionDeployment) actor.currentAction = null;
    journey.lastText = zionDeploymentText(state); return zionDeploymentLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.zionDeployment!, life = this.sandbox().neoLife!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry') {
      if (actor.status !== 'alive' || actor.health <= 0) { actor.status = 'alive'; actor.health = state.checkpointHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick);
      return '接回议会检查点。已核对的部署、判断、物品与其他人的伤势保留。';
    }
    if (actor.status !== 'alive' || actor.health <= 0) return '先在手记中接回议会检查点。';
    if (target.startsWith('allocation:') && state.phase === 'allocating') {
      const [, id, answer] = target.split(':'), allocation = ZION_DEPLOYMENT.allocations.find(item => item.id === id);
      if (!allocation) return '请选择手记中的一项部署。';
      if (answer !== allocation.correct) { state.mistakes++; state.feedback = allocation.reason; this.frame(actor, 0, tick); return journey.lastText; }
      delete state.feedback;
      if (!state.confirmed.includes(id as ZionAllocation)) state.confirmed.push(id as ZionAllocation);
      life.choices[`zion_deployment_${id}`] = answer;
      if (state.confirmed.length === ZION_DEPLOYMENT.allocations.length) { state.phase = 'hope'; this.onAdvance?.(zionDeploymentText(state), actor, tick); }
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target.startsWith('reflect:') && state.phase === 'reflection' && journey.step === 3) {
      const choice = filmReflections('m3_zion_prepare').find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的一种判断。';
      const key = 'm3_zion_prepare:3'; if (journey.reflections[key]) return '判断已保存，等待回应结束。';
      journey.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `锡安议会 · ${choice.label}`, text: choice.response });
      state.reply = choice.id; state.phase = 'responding'; state.elapsed = 0; this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target === 'act' && ['ready', 'question', 'review', 'hope'].includes(state.phase)) {
      const point = zionDeploymentTarget(state);
      if (actor.isInMatrix || actor.currentLocation !== FILM_SCENE_BY_ID.m3_zion_prepare.set || distance(actor.position, filmPosition(actor.currentLocation, point.x, point.z)) > 1.6)
        return '先走近当前议会位置，再按 G 开始。';
      state.phase = state.phase === 'ready' ? 'reporting' : state.phase === 'question' ? 'answering' : state.phase === 'review' ? 'allocating' : 'hearing';
      state.elapsed = 0; state.checkpointHealth = actor.health; journey.checkpoint = { ...actor.position };
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (state.phase !== 'done') return journey.lastText;
  }
  private seal(): void {
    const prefix = 'film:zion-deployment:', scene = FILM_SCENE_BY_ID.m3_zion_prepare;
    if (this.sandbox().structures.some(item => item.id === `${prefix}map`)) return;
    const seats = Object.values(ZION_DEPLOYMENT.roots).map(root => ({ x: root.x, z: root.z, width: 2.8, depth: 2.8, height: 3.5 }));
    for (const [i, shape] of [{ ...ZION_DEPLOYMENT.map, height: 4.7 }, ...ZION_DEPLOYMENT.walls, ...seats].entries()) this.sandbox().structures.push({
      id: i === 0 ? `${prefix}map` : `${prefix}obstacle:${i}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9,
      position: filmPosition(scene.set, shape.x, shape.z), film: { scene: scene.id, width: shape.width, depth: shape.depth, height: shape.height },
    });
  }
}
