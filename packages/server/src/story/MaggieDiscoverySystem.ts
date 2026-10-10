import { MAGGIE_DISCOVERY, HAMMER_MEDICAL, FILM_SETS, FILM_SCENE_BY_ID, maggieDiscoveryActive, maggieDiscoveryLocked, maggieDiscoveryTarget,
  maggieDiscoveryLines, maggieDiscoveryRoot, maggieDiscoveryText, maggieDiscoveryDoor, newMaggieDiscovery, filmPosition, filmReflections, distance,
  type AgentState, type SandboxState, type MaggieDiscovery } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class MaggieDiscoverySystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return maggieDiscoveryActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:maggie-discovery:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.id !== 'maggie' && member.currentAction?.parameters.maggieDiscovery) member.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m3_maggie_discovery;
    if (!journey.maggieDiscovery) {
      const legacy = journey.step > 0;
      if (legacy) journey.step = journey.completed.includes(scene.id) ? 7 : 2;
      journey.maggieDiscovery = newMaggieDiscovery(journey.step, actor.health);
      if (legacy) journey.maggieDiscovery.legacy = true;
    }
    const state = journey.maggieDiscovery; delete journey.started;
    const oldEntry = filmPosition(scene.set, 0, FILM_SETS[scene.set].depth * .32);
    if (journey.step === 0 && state.phase === 'call' && !state.incident && !state.legacy && state.elapsed === 0
      && state.evidence.length === 0 && distance(actor.position, oldEntry) < .1 && distance(journey.checkpoint, oldEntry) < .1) {
      actor.position = filmPosition(scene.set, MAGGIE_DISCOVERY.entry.x, MAGGIE_DISCOVERY.entry.z);
      actor.rotation = Math.PI; journey.checkpoint = { ...actor.position };
    }
    const required = [...MAGGIE_DISCOVERY.cast, 'maggie', 'bane', ...(!state.departed ? ['neo', 'trinity'] : [])];
    const occupied = required.find(id => this.world.agents.get(id)?.controller);
    const unavailable = required.find(id => {
      const member = this.world.agents.get(id);
      return !member || id !== 'maggie' && (member.status !== 'alive' || member.health <= 0)
        || id === 'maggie' && member.status === 'disconnected';
    });
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    if (!state.departed && !occupied && !unavailable) this.depart(state);
    const elapsed = !occupied && !unavailable && actor.controller && actor.status === 'alive' && actor.health > 0 ? Math.max(0, Math.min(.1, dt)) : 0;
    const close = (point: { x: number; z: number }, radius: number) => !actor.isInMatrix && actor.currentLocation === scene.set
      && distance(actor.position, filmPosition(scene.set, point.x, point.z)) <= radius;
    if (state.incident && !occupied && !unavailable) this.incident();
    if (state.phase === 'approach' && elapsed && close(MAGGIE_DISCOVERY.approach, 1.1)) {
      state.phase = 'ready'; this.onAdvance?.(maggieDiscoveryText(state), actor, tick);
    }
    const lines = maggieDiscoveryLines(state);
    if (lines) {
      if (state.phase === 'covering') state.cover = Math.min(MAGGIE_DISCOVERY.coverSeconds, state.cover + elapsed);
      if (state.phase === 'searching') state.arrival = Math.min(MAGGIE_DISCOVERY.arrivalSeconds, state.arrival + elapsed);
      const arriving = state.phase === 'searching' && state.arrival < MAGGIE_DISCOVERY.arrivalSeconds;
      state.elapsed = Math.min(lines.length * MAGGIE_DISCOVERY.lineSeconds, state.elapsed + (arriving ? 0 : elapsed));
      if (state.elapsed >= lines.length * MAGGIE_DISCOVERY.lineSeconds) {
        state.elapsed = 0;
        if (state.phase === 'calling') { state.phase = 'approach'; this.onAdvance?.(maggieDiscoveryText(state), actor, tick); }
        else if (state.phase === 'covering') {
          state.phase = 'empty'; if (!state.evidence.includes('maggie')) state.evidence.push('maggie');
          this.sandbox().neoLife!.choices.maggie_identity = 'confirmed'; this.onAdvance?.(maggieDiscoveryText(state), actor, tick);
        } else if (state.phase === 'checking') {
          state.phase = 'report'; if (!state.evidence.includes('berth')) state.evidence.push('berth');
          this.sandbox().neoLife!.choices.bane_berth = 'empty'; this.onAdvance?.(maggieDiscoveryText(state), actor, tick);
        } else if (state.phase === 'searching') {
          state.phase = 'return'; if (!state.evidence.includes('ship')) state.evidence.push('ship');
          this.sandbox().neoLife!.choices.bane_ship_search = 'not_found'; this.sandbox().neoLife!.choices.bane_escape_route = 'logos_suspected';
        } else { state.phase = 'reflection'; this.sandbox().neoLife!.choices.logos_emp_risk = 'acknowledged'; this.onAdvance?.(maggieDiscoveryText(state), actor, tick); }
      }
    } else if (state.phase === 'responding') {
      state.elapsed = Math.min(MAGGIE_DISCOVERY.lineSeconds, state.elapsed + elapsed);
      if (state.elapsed >= MAGGIE_DISCOVERY.lineSeconds) { state.elapsed = 0; state.phase = 'leaving'; this.onAdvance?.(maggieDiscoveryText(state), actor, tick); }
    } else if (state.phase === 'leaving' && elapsed && close(MAGGIE_DISCOVERY.exit, 1.1)) {
      state.phase = 'done'; this.onAdvance?.(maggieDiscoveryText(state), actor, tick);
    }
    this.seal(state);
    for (const role of Object.keys(MAGGIE_DISCOVERY.roots) as (keyof typeof MAGGIE_DISCOVERY.roots)[]) {
      const member = this.world.agents.get(role); if (!member || member.status !== 'alive' || member.health <= 0 || member.controller) continue;
      const root = maggieDiscoveryRoot(state, role);
      member.position = filmPosition(scene.set, root.x, root.z); member.rotation = root.yaw;
      member.currentLocation = scene.set; member.isInMatrix = false; member.targetPosition = null; member.currentPath = [];
      member.velocity = { x: 0, y: 0, z: 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, maggieDiscovery: { ...state, evidence: [...state.evidence], role } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    const maggie = this.world.agents.get('maggie');
    if (state.incident && maggie && !maggie.controller && maggie.status === 'dead') {
      maggie.position = filmPosition(scene.set, MAGGIE_DISCOVERY.corpse.x, MAGGIE_DISCOVERY.corpse.z); maggie.rotation = 0;
      maggie.currentLocation = scene.set; maggie.isInMatrix = false; maggie.targetPosition = null; maggie.currentPath = [];
      maggie.velocity = { x: 0, y: 0, z: 0 };
      maggie.currentAction = { type: 'idle', parameters: { resolved: true, maggieDiscovery: { ...state, evidence: [...state.evidence], role: 'maggie' } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    if (maggieDiscoveryLocked(state) && !state.paused && !state.unavailable) {
      const point = maggieDiscoveryTarget(state); actor.position = filmPosition(scene.set, point.x, point.z);
      actor.rotation = state.phase === 'covering' ? -Math.PI / 2 : state.phase === 'checking' ? Math.PI / 2
        : ['searching', 'hearing', 'reflection', 'responding'].includes(state.phase) ? 0 : Math.PI;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, maggieDiscovery: { ...state, evidence: [...state.evidence], role: 'roland' } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.maggieDiscovery) actor.currentAction = null;
    journey.lastText = maggieDiscoveryText(state); return maggieDiscoveryLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.maggieDiscovery!, life = this.sandbox().neoLife!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry') {
      if (actor.status !== 'alive' || actor.health <= 0) { actor.status = 'alive'; actor.health = state.checkpointHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick);
      return '接回调查检查点。保留 Maggie 的死亡、搜查进度、判断、物品与其他人的伤势。';
    }
    if (actor.status !== 'alive' || actor.health <= 0) return '先在手记中接回调查检查点。';
    if (target.startsWith('reflect:') && state.phase === 'reflection' && journey.step === 5) {
      const choice = filmReflections('m3_maggie_discovery').find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的一种判断。';
      const key = 'm3_maggie_discovery:5'; if (journey.reflections[key]) return '判断已经保存，等待回应结束。';
      journey.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `Roland 的调查 · ${choice.label}`, text: `这不是 Neo 此时拥有的角色知识。${choice.response}` });
      state.reply = choice.id; state.phase = 'responding'; state.elapsed = 0; this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target === 'act' && ['call', 'ready', 'empty', 'report', 'return'].includes(state.phase)) {
      const point = maggieDiscoveryTarget(state);
      if (actor.isInMatrix || actor.currentLocation !== FILM_SCENE_BY_ID.m3_maggie_discovery.set || distance(actor.position, filmPosition(actor.currentLocation, point.x, point.z)) > 1.6)
        return '先走近当前调查位置，再按 G。';
      state.phase = state.phase === 'call' ? 'calling' : state.phase === 'ready' ? 'covering' : state.phase === 'empty' ? 'checking' : state.phase === 'report' ? 'searching' : 'hearing';
      if (state.phase === 'calling') state.incident = true;
      state.elapsed = 0; state.checkpointHealth = actor.health; journey.checkpoint = { ...actor.position };
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (state.phase !== 'done') return journey.lastText;
  }
  private incident(): void {
    const maggie = this.world.agents.get('maggie')!, bane = this.world.agents.get('bane')!, life = this.sandbox().neoLife!;
    maggie.status = 'dead'; maggie.health = 0;
    if (life.choices.maggie_incident !== 'committed') {
      life.choices.maggie_incident = 'committed';
      bane.currentLocation = 'film_logos_deck'; bane.position = filmPosition('film_logos_deck', 7, -16);
      bane.isInMatrix = false; bane.currentAction = null; bane.targetPosition = null; bane.currentPath = []; bane.velocity = { x: 0, y: 0, z: 0 };
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: 'Hammer 的紧急报告', text: '另一视角：AK 报告 Maggie 遇害。Logos 已离开；Neo 并未收到 Hammer 的报告。' });
    }
  }
  private depart(state: MaggieDiscovery): void {
    for (const id of ['neo', 'trinity']) {
      const member = this.world.agents.get(id)!;
      if (member.currentLocation !== 'film_logos_deck') {
        member.currentLocation = 'film_logos_deck'; member.position = filmPosition('film_logos_deck', id === 'neo' ? 0 : -6, id === 'neo' ? 10 : 8);
        member.currentAction = null; member.targetPosition = null; member.currentPath = []; member.velocity = { x: 0, y: 0, z: 0 };
      }
      member.isInMatrix = false;
    }
    state.departed = true;
  }
  private seal(state: MaggieDiscovery): void {
    const prefix = 'film:maggie-discovery:', scene = FILM_SCENE_BY_ID.m3_maggie_discovery;
    const doorId = `${prefix}door`, door = MAGGIE_DISCOVERY.door;
    if (maggieDiscoveryDoor(state) < 1) {
      if (!this.sandbox().structures.some(item => item.id === doorId)) this.sandbox().structures.push({ id: doorId, owner: 'film', kind: 'barricade', matrix: false,
        health: 1e9, position: filmPosition(scene.set, door.x, door.z), film: { scene: scene.id, width: door.width, depth: door.depth, height: door.height } });
    } else this.sandbox().structures = this.sandbox().structures.filter(item => item.id !== doorId);
    if (this.sandbox().structures.some(item => item.id === `${prefix}bed:maggie`)) return;
    for (const bed of [{ id: 'maggie', ...MAGGIE_DISCOVERY.corpse }, { id: 'bane', ...MAGGIE_DISCOVERY.berth }])
      this.sandbox().structures.push({ id: `${prefix}bed:${bed.id}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9,
        position: filmPosition(scene.set, bed.x, bed.z), film: { scene: scene.id, width: HAMMER_MEDICAL.width + .3, depth: HAMMER_MEDICAL.length, height: HAMMER_MEDICAL.mattressTop } });
    for (const [i, bed] of [MAGGIE_DISCOVERY.corpse, MAGGIE_DISCOVERY.berth].entries()) {
      const monitor = MAGGIE_DISCOVERY.monitor;
      this.sandbox().structures.push({ id: `${prefix}monitor:${i}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9,
        position: filmPosition(scene.set, bed.x, bed.z + Math.cos(bed.yaw) * monitor.z),
        film: { scene: scene.id, width: monitor.width, depth: monitor.depth, height: monitor.height } });
    }
    for (const [i, wall] of MAGGIE_DISCOVERY.walls.entries()) this.sandbox().structures.push({ id: `${prefix}wall:${i}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9,
      position: filmPosition(scene.set, wall.x, wall.z), film: { scene: scene.id, width: wall.width, depth: wall.depth, height: wall.height } });
  }
}
