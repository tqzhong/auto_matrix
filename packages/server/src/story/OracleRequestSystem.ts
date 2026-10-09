import { ORACLE_REQUEST, FILM_SCENE_BY_ID, filmPosition, distance, oracleRequestActive, oracleRequestLocked, oracleRequestRoot,
  oracleRequestText, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class OracleRequestSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return oracleRequestActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => item.id !== 'film:oracle-request:table');
    for (const member of this.world.agents.values()) if (member.id !== 'oracle' && !member.controller && member.currentAction?.parameters.oracleRequest) member.currentAction = null;
  }
  restoreSeat(tick: number): void {
    const journey = this.journey;
    if (!journey?.completed.includes('m3_oracle_request') || journey.oracleRequest?.phase !== 'done'
      || journey.completed.includes('m3_oracle_last') || FILM_SCENE_BY_ID[journey.visiting ?? journey.scene].cast.includes('oracle')) return;
    const oracle = this.world.agents.get('oracle');
    if (!oracle || oracle.controller || oracle.status !== 'alive' || oracle.currentAction || oracle.currentLocation !== 'film_oracle_home') return;
    const root = ORACLE_REQUEST.oracle;
    oracle.position = filmPosition('film_oracle_home', root.x, root.z); oracle.rotation = root.yaw;
    oracle.velocity = { x: 0, y: 0, z: 0 }; oracle.targetPosition = null; oracle.currentPath = [];
    oracle.currentAction = { type: 'idle', parameters: { resolved: true, oracleRequest: { ...journey.oracleRequest, step: 4, role: 'oracle' } }, startedAt: tick, duration: 1e9, progress: 0 };
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m3_oracle_request;
    const state = journey.oracleRequest ??= { phase: journey.step >= 4 ? 'done' : journey.step === 3 ? 'guiding' : journey.step === 2 ? 'reflection' : 'ready', elapsed: 0, guide: 0 };
    delete journey.started;
    const occupied = ORACLE_REQUEST.cast.find(id => id !== actor.id && this.world.agents.get(id)?.controller);
    const unavailable = ORACLE_REQUEST.cast.find(id => this.world.agents.get(id)?.status !== 'alive');
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const elapsed = !occupied && !unavailable && actor.controller && actor.status === 'alive' ? Math.max(0, Math.min(.1, dt)) : 0;
    const table = ORACLE_REQUEST.table;
    if (!this.sandbox().structures.some(item => item.id === 'film:oracle-request:table')) this.sandbox().structures.push({
      id: 'film:oracle-request:table', kind: 'barricade', owner: 'film', health: 1e9, matrix: true,
      position: filmPosition(scene.set, table.x, table.z), film: { scene: scene.id, width: table.width, depth: table.depth, height: table.height },
    });
    if (state.phase === 'answering') {
      const duration = (journey.step === 0 ? ORACLE_REQUEST.identity.length : ORACLE_REQUEST.route.length) * ORACLE_REQUEST.lineSeconds;
      state.elapsed = Math.min(duration, state.elapsed + elapsed);
      if (state.elapsed >= duration) {
        state.phase = journey.step === 0 ? 'ready' : 'reflection'; state.elapsed = 0;
        this.onAdvance?.(oracleRequestText(state, journey.step + 1), actor, tick);
      }
    }
    if (journey.step === 3) state.phase = 'guiding';
    if (state.phase === 'guiding') {
      const guide = oracleRequestRoot(state, 'seraph'), position = filmPosition(scene.set, guide.x, guide.z);
      if (distance(actor.position, position) <= 6.5) state.guide = Math.min(ORACLE_REQUEST.guideLength, state.guide + elapsed * ORACLE_REQUEST.guideSpeed);
      if (state.guide >= ORACLE_REQUEST.guideLength && distance(actor.position, filmPosition(scene.set, ORACLE_REQUEST.exit.x, ORACLE_REQUEST.exit.z)) <= 1.3) {
        state.phase = 'done'; this.onAdvance?.('三人跨过公寓门槛，出发寻找 Trainman。', actor, tick);
      }
    }
    for (const role of ['oracle', 'morpheus', 'seraph'] as const) {
      const member = this.world.agents.get(role);
      if (!member || member.status !== 'alive' || member.controller) continue;
      const root = role === 'oracle' ? ORACLE_REQUEST.oracle : oracleRequestRoot(state, role), before = member.position;
      member.position = filmPosition(scene.set, root.x, root.z); member.rotation = root.yaw;
      member.currentLocation = scene.set; member.isInMatrix = true; member.targetPosition = null; member.currentPath = [];
      member.velocity = { x: elapsed ? (member.position.x - before.x) / elapsed : 0, y: 0, z: elapsed ? (member.position.z - before.z) / elapsed : 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, oracleRequest: { ...state, step: journey.step, role } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    journey.lastText = oracleRequestText(state, journey.step);
    return oracleRequestLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick);
    const journey = this.journey!, state = journey.oracleRequest!;
    if (state.paused || state.unavailable || oracleRequestLocked(state)) return oracleRequestText(state, journey.step);
    if (target === 'retry') {
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 };
      return '已返回保存的会面位置，已听过的回答与反思保留。';
    }
    if (target !== 'act' || journey.step >= 2) return;
    const point = ORACLE_REQUEST.question;
    if (actor.currentLocation !== FILM_SCENE_BY_ID.m3_oracle_request.set || !actor.isInMatrix
      || distance(actor.position, filmPosition(FILM_SCENE_BY_ID.m3_oracle_request.set, point.x, point.z)) > 1.6) return '先走到客厅茶几右侧，再向先知提问。';
    state.phase = 'answering'; state.elapsed = 0; journey.checkpoint = { ...actor.position };
    this.frame(actor, 0, tick); return journey.lastText;
  }
}
