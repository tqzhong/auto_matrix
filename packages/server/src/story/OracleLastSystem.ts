import { ORACLE_LAST, FILM_SCENE_BY_ID, filmPosition, distance, filmReflections, newOracleLast, oracleLastActive, oracleLastLocked,
  oracleLastRoot, oracleLastLines, oracleLastText, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class OracleLastSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return oracleLastActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:oracle-last:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.oracleLast) member.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, life = this.sandbox().neoLife!, scene = FILM_SCENE_BY_ID.m3_oracle_last;
    const state = journey.oracleLast ??= newOracleLast(journey.step, actor.health, life.choices.oracle_first,
      life.choices['m2_bench:2'] as 'agency' | 'care' | 'trust' | undefined);
    state.first ??= life.choices.oracle_first;
    state.second ??= (life.choices['m2_bench:2'] ?? life.choices['m3_family:1']) as 'agency' | 'care' | 'trust' | undefined;
    delete journey.started;
    const occupied = ORACLE_LAST.cast.find(id => id !== actor.id && this.world.agents.get(id)?.controller);
    const unavailable = ORACLE_LAST.cast.find(id => id !== actor.id && (!this.world.agents.get(id) || this.world.agents.get(id)!.status !== 'alive' || this.world.agents.get(id)!.health <= 0));
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const elapsed = !occupied && !unavailable && actor.controller && actor.status === 'alive' && actor.health > 0 ? Math.max(0, Math.min(.1, dt)) : 0;
    if (!this.sandbox().structures.some(item => item.id === 'film:oracle-last:table')) {
      for (const [i, shape] of [ORACLE_LAST.table, ...ORACLE_LAST.chairs.map(chair => ({ ...chair, width: 1.7, depth: 1.7, height: 2.8 }))].entries()) this.sandbox().structures.push({
        id: i ? `film:oracle-last:chair:${i}` : 'film:oracle-last:table', kind: 'barricade', owner: 'film', health: 1e9, matrix: true,
        position: filmPosition(scene.set, shape.x, shape.z), film: { scene: scene.id, width: shape.width, depth: shape.depth, height: shape.height },
      });
    }
    if (state.phase === 'waiting' && elapsed && actor.currentLocation === scene.set
      && distance(actor.position, filmPosition(scene.set, ORACLE_LAST.entrance.x, ORACLE_LAST.entrance.z)) <= 2.2) state.phase = 'greeting';
    if (state.phase === 'greeting') {
      state.arrival = Math.min(ORACLE_LAST.welcomeSeconds, state.arrival + elapsed);
      if (state.arrival >= ORACLE_LAST.welcomeSeconds) { state.phase = 'ready'; this.onAdvance?.(oracleLastText(state, 1), actor, tick); }
    }
    if (state.phase === 'answering') {
      const duration = oracleLastLines(state, journey.step).length * ORACLE_LAST.lineSeconds;
      state.elapsed = Math.min(duration, state.elapsed + elapsed);
      if (state.elapsed >= duration) {
        state.phase = journey.step === 1 ? 'ready' : 'reflection'; state.elapsed = 0;
        this.onAdvance?.(oracleLastText(state, journey.step + 1), actor, tick);
      }
    }
    if (state.phase === 'responding') {
      state.elapsed = Math.min(ORACLE_LAST.lineSeconds, state.elapsed + elapsed);
      if (state.elapsed >= ORACLE_LAST.lineSeconds) { state.phase = 'leaving'; state.elapsed = 0; this.onAdvance?.(oracleLastText(state, 4), actor, tick); }
    }
    if (state.phase === 'leaving' && elapsed && actor.currentLocation === scene.set
      && distance(actor.position, filmPosition(scene.set, ORACLE_LAST.exit.x, ORACLE_LAST.exit.z)) <= 1.6) {
      state.phase = 'done'; this.onAdvance?.('Neo 离开公寓，带走关于源头、Smith 与选择的线索。', actor, tick);
    }
    for (const role of ['oracle', 'sati', 'seraph'] as const) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || member.health <= 0 || member.controller) continue;
      const root = oracleLastRoot(state, role), before = member.position;
      member.position = filmPosition(scene.set, root.x, root.z); member.rotation = root.yaw; member.currentLocation = scene.set; member.isInMatrix = true;
      member.targetPosition = null; member.currentPath = [];
      member.velocity = { x: elapsed ? (member.position.x - before.x) / elapsed : 0, y: 0, z: elapsed ? (member.position.z - before.z) / elapsed : 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, oracleLast: { ...state, role, step: journey.step } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    if (oracleLastLocked(state)) {
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, oracleLast: { ...state, role: 'neo', step: journey.step } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.oracleLast) actor.currentAction = null;
    journey.lastText = oracleLastText(state, journey.step);
    return oracleLastLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.oracleLast!, life = this.sandbox().neoLife!;
    if (state.paused || state.unavailable) return oracleLastText(state, journey.step);
    if (target === 'retry') {
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = state.checkpointHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 };
      this.frame(actor, 0, tick); return '已接回 Neo 的会面检查点。已听回答、反思、物品与其他人物的伤势保留。';
    }
    if (actor.status !== 'alive' || actor.health <= 0 || oracleLastLocked(state)) return oracleLastText(state, journey.step);
    if (state.phase === 'greeting' || state.phase === 'waiting') return target === 'next' ? undefined : oracleLastText(state, journey.step);
    const close = actor.currentLocation === FILM_SCENE_BY_ID.m3_oracle_last.set && actor.isInMatrix
      && distance(actor.position, filmPosition('film_oracle_home', ORACLE_LAST.question.x, ORACLE_LAST.question.z)) <= 1.6;
    if (target.startsWith('reflect:') && journey.step === 3) {
      if (!close) return '先回到先知桌子另一侧，再记录这次会面的理解。';
      const choice = filmReflections('m3_oracle_last').find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的一种反思。';
      const key = 'm3_oracle_last:3';
      if (journey.reflections[key]) return '这次反思已经保存，听完先知的回应再离开。';
      journey.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `没有保证的未来 · ${choice.label}`, text: choice.response });
      state.reply = choice.id; state.phase = 'responding'; state.elapsed = 0; journey.checkpoint = { ...actor.position }; state.checkpointHealth = actor.health;
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target !== 'act' || ![1, 2].includes(journey.step)) return;
    if (!close) return '先走到桌子另一侧，再亲自向先知提问。';
    state.phase = 'answering'; state.elapsed = 0; journey.checkpoint = { ...actor.position }; state.checkpointHealth = actor.health;
    const oracle = oracleLastRoot(state, 'oracle');
    actor.rotation = Math.atan2(filmPosition('film_oracle_home', oracle.x, oracle.z).x - actor.position.x,
      filmPosition('film_oracle_home', oracle.x, oracle.z).z - actor.position.z);
    this.frame(actor, 0, tick); return journey.lastText;
  }
}
