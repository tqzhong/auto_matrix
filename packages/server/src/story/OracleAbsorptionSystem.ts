import { ORACLE_ABSORPTION, ORACLE_LAST, FILM_SCENE_BY_ID, filmPosition, filmReflections, distance,
  newOracleAbsorption, oracleAbsorptionActive, oracleAbsorptionLocked, oracleAbsorptionRoot, oracleAbsorptionText,
  type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class OracleAbsorptionSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return oracleAbsorptionActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:oracle-last:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.oracleAbsorption) member.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number, focus = false): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, state = journey.oracleAbsorption ??= newOracleAbsorption(journey.step, actor.health);
    const scene = FILM_SCENE_BY_ID.m3_oracle_absorbed;
    const neo = this.world.agents.get('neo');
    if (neo && !neo.controller && neo.status === 'alive' && neo.currentLocation === scene.set) {
      neo.currentLocation = 'film_hammer_deck'; neo.isInMatrix = false; neo.position = filmPosition(neo.currentLocation, 0, -12);
      neo.currentAction = null; neo.targetPosition = null; neo.currentPath = []; neo.velocity = { x: 0, y: 0, z: 0 };
    }
    delete journey.started;
    const occupied = ORACLE_ABSORPTION.cast.find(id => id !== actor.id && this.world.agents.get(id)?.controller);
    const missing = state.phase === 'done' ? undefined : ORACLE_ABSORPTION.cast.find(id => id !== actor.id && (!this.world.agents.get(id) || this.world.agents.get(id)!.status !== 'alive' || this.world.agents.get(id)!.health <= 0));
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = missing ? this.world.agents.get(missing)?.name ?? missing : undefined;
    const elapsed = !occupied && !missing && actor.controller && actor.status === 'alive' && actor.health > 0 ? Math.max(0, Math.min(.1, dt)) : 0;
    if (!this.sandbox().structures.some(item => item.id === 'film:oracle-last:table')) {
      for (const [i, shape] of [ORACLE_LAST.table, ...ORACLE_LAST.chairs.map(chair => ({ ...chair, width: 1.7, depth: 1.7, height: 2.8 }))].entries()) this.sandbox().structures.push({
        id: i ? `film:oracle-last:chair:${i}` : 'film:oracle-last:table', kind: 'barricade', owner: 'film', health: 1e9, matrix: true,
        position: filmPosition(scene.set, shape.x, shape.z), film: { scene: scene.id, width: shape.width, depth: shape.depth, height: shape.height },
      });
    }
    if (state.phase === 'farewell') {
      state.farewell = Math.min(16, state.farewell + elapsed); state.elapsed = state.farewell;
      if (state.farewell >= 16) { state.phase = 'watching'; state.elapsed = 0; this.onAdvance?.('先知把饼干交给 Sati；Seraph 准备带她离开。', actor, tick); }
    } else if (state.phase === 'escaping') {
      state.escape = Math.min(32, state.escape + elapsed); state.elapsed = state.escape;
      if (state.escape >= 32) { state.phase = 'reflection'; state.elapsed = 0; this.onAdvance?.('电梯和走廊陷入黑暗。两人的信号沉默，先知留下。', actor, tick); }
    } else if (state.phase === 'confrontation') {
      state.invasion = Math.min(44, state.invasion + elapsed); state.elapsed = state.invasion;
      if (state.invasion >= 44) { state.phase = 'consent'; state.elapsed = 0; }
    } else if (state.phase === 'consent' && focus) {
      state.held = Math.min(1.8, state.held + elapsed);
      if (state.held >= 1.8) { state.phase = 'contact'; state.elapsed = 0; }
    } else if (state.phase === 'contact' || state.phase === 'coating' || state.phase === 'laughing') {
      state.elapsed += elapsed;
      const duration = state.phase === 'contact' ? 2.2 : state.phase === 'coating' ? 5 : 3;
      if (state.phase === 'coating') state.coating = Math.min(1, state.elapsed / 5);
      if (state.elapsed >= duration) {
        state.elapsed = 0;
        if (state.phase === 'contact') state.phase = 'coating';
        else if (state.phase === 'coating') state.phase = 'laughing';
        else {
          state.phase = 'done'; this.onAdvance?.('Smith 同化先知，带走她的预见。Neo 并未看见这件事。', actor, tick);
          actor.status = 'disconnected'; actor.health = 0;
        }
      }
    }
    for (const role of ORACLE_ABSORPTION.cast) {
      const member = this.world.agents.get(role);
      if (!member || member.controller && member.id !== actor.id || member.status !== 'alive' && !(role === 'oracle' && state.phase === 'done')) continue;
      if (role === 'oracle' && !oracleAbsorptionLocked(state) && state.phase !== 'done') {
        if (member.currentAction?.parameters.oracleAbsorption) member.currentAction = null;
        continue;
      }
      const root = oracleAbsorptionRoot(state, role), before = member.position;
      member.position = filmPosition(scene.set, root.x, root.z); member.rotation = root.yaw; member.currentLocation = scene.set; member.isInMatrix = true;
      member.targetPosition = null; member.currentPath = [];
      member.velocity = { x: elapsed ? (member.position.x - before.x) / elapsed : 0, y: 0, z: elapsed ? (member.position.z - before.z) / elapsed : 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, oracleAbsorption: { ...state, role } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    journey.lastText = oracleAbsorptionText(state);
    return oracleAbsorptionLocked(state) || state.phase === 'done';
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.oracleAbsorption!, life = this.sandbox().neoLife!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry' && state.phase !== 'done') {
      if (actor.status !== 'alive' || actor.health <= 0) { actor.status = 'alive'; actor.health = state.checkpointHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick);
      return '已接回先知的当前检查点；动作、选择、物品和其他人的伤势保留。';
    }
    if (state.phase === 'done') return target === 'next' || target === 'act' ? undefined : journey.lastText;
    if (actor.status !== 'alive' || actor.health <= 0 || oracleAbsorptionLocked(state) && !['reflection', 'waiting'].includes(state.phase)) return journey.lastText;
    const point = journey.step === 0 || journey.step === 1 ? ORACLE_ABSORPTION.start : ORACLE_ABSORPTION.seat;
    const close = actor.currentLocation === sceneSet() && distance(actor.position, filmPosition(sceneSet(), point.x, point.z)) <= 1.6;
    if (!close) return '先回到厨房当前目标旁，再作出先知的决定。';
    if (target.startsWith('reflect:')) {
      if (state.phase !== 'reflection') return '先亲自经历撤离和断电，再记录这次判断。';
      const choice = filmReflections('m3_oracle_absorbed').find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的反思。';
      const key = 'm3_oracle_absorbed:2';
      if (!journey.reflections[key]) {
        journey.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
        life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `先知的赌注 · ${choice.label}`, text: `这是先知的另一视角，不是 Neo 此时的知识。${choice.response}` });
      }
      state.phase = 'waiting'; this.onAdvance?.('先知在厨房等待；反思已保存，结果仍没有保证。', actor, tick);
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target !== 'act') return journey.lastText;
    if (state.phase === 'ready') state.phase = 'farewell';
    else if (state.phase === 'watching') state.phase = 'escaping';
    else if (state.phase === 'waiting') state.phase = 'confrontation';
    journey.checkpoint = { ...actor.position }; state.checkpointHealth = actor.health; this.frame(actor, 0, tick);
    return journey.lastText;
  }
}
function sceneSet() { return FILM_SCENE_BY_ID.m3_oracle_absorbed.set; }
