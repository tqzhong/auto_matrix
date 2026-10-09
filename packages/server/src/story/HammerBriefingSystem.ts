import { HAMMER_BRIEFING, FILM_SCENE_BY_ID, FILM_SETS, hammerBriefingActive, hammerBriefingLocked, hammerBriefingTarget,
  hammerBriefingText, hammerBriefingLines, newHammerBriefing, filmPosition, filmReflections, distance,
  type AgentState, type SandboxState, type HammerRoute } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class HammerBriefingSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return hammerBriefingActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:hammer-briefing:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.hammerBriefing) member.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m3_logos_plan;
    if (!journey.hammerBriefing) {
      journey.hammerBriefing = newHammerBriefing(journey.step, actor.health);
      const old = filmPosition(scene.set, 0, FILM_SETS[scene.set].depth * .32);
      const untouched = journey.step === 0 && (distance(actor.position, old) < .1 || distance(actor.position, filmPosition(scene.set, HAMMER_BRIEFING.entry.x, HAMMER_BRIEFING.entry.z)) < .1);
      if (journey.step === 0 && distance(actor.position, old) < .1) {
        actor.position = filmPosition(scene.set, HAMMER_BRIEFING.entry.x, HAMMER_BRIEFING.entry.z);
        journey.checkpoint = { ...actor.position };
      }
      if (untouched) actor.rotation = Math.atan2(HAMMER_BRIEFING.approach.x - (actor.position.x - FILM_SETS[scene.set].center.x),
        HAMMER_BRIEFING.approach.z - (actor.position.z - FILM_SETS[scene.set].center.z));
    }
    const state = journey.hammerBriefing; delete journey.started;
    const occupied = HAMMER_BRIEFING.cast.find(id => this.world.agents.get(id)?.controller);
    const unavailable = HAMMER_BRIEFING.cast.find(id => !this.world.agents.get(id) || this.world.agents.get(id)!.status !== 'alive' || this.world.agents.get(id)!.health <= 0);
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const elapsed = !occupied && !unavailable && actor.controller && actor.status === 'alive' && actor.health > 0 ? Math.max(0, Math.min(.1, dt)) : 0;
    this.seal();
    const close = (point: { x: number; z: number }, radius: number) => actor.currentLocation === scene.set && !actor.isInMatrix
      && distance(actor.position, filmPosition(scene.set, point.x, point.z)) <= radius;
    if (state.phase === 'approach' && elapsed && close(HAMMER_BRIEFING.approach, 1.1)) {
      state.phase = 'ready'; this.onAdvance?.(hammerBriefingText(state), actor, tick);
    }
    const lines = hammerBriefingLines(state);
    if (lines) {
      state.elapsed = Math.min(lines.length * HAMMER_BRIEFING.lineSeconds, state.elapsed + elapsed);
      if (state.elapsed >= lines.length * HAMMER_BRIEFING.lineSeconds) {
        state.elapsed = 0;
        if (state.phase === 'proposal') state.phase = 'objection';
        else if (state.phase === 'loan') {
          const choices = this.sandbox().neoLife!.choices;
          choices.logos_assignment = 'neo_trinity'; choices.hammer_assignment = 'niobe_zion';
          state.phase = 'route'; this.onAdvance?.(hammerBriefingText(state), actor, tick);
        }
        else if (state.phase === 'planning') state.phase = 'confirmation';
        else state.phase = 'reflection';
      }
    } else if (state.phase === 'responding') {
      state.elapsed = Math.min(HAMMER_BRIEFING.lineSeconds, state.elapsed + elapsed);
      if (state.elapsed >= HAMMER_BRIEFING.lineSeconds) { state.elapsed = 0; state.phase = 'leaving'; this.onAdvance?.(hammerBriefingText(state), actor, tick); }
    } else if (state.phase === 'leaving' && elapsed && close(HAMMER_BRIEFING.exit, 1.1) && state.escort
      && Math.hypot(state.escort.x - HAMMER_BRIEFING.exit.x, state.escort.z - HAMMER_BRIEFING.exit.z) <= 3) {
      state.phase = 'done'; this.onAdvance?.(hammerBriefingText(state), actor, tick);
    }
    if (state.phase === 'leaving') state.elapsed += elapsed;
    for (const [role, root] of Object.entries(HAMMER_BRIEFING.roots)) {
      const member = this.world.agents.get(role); if (!member || member.status !== 'alive' || member.health <= 0 || member.controller) continue;
      let point: { x: number; z: number } = root;
      if (role === 'trinity' && (state.phase === 'leaving' || state.phase === 'done')) {
        const center = FILM_SETS[scene.set].center;
        const target = { x: Math.max(-2.1, Math.min(2.1, actor.position.x - center.x + 1.6)), z: Math.max(-5.8, Math.min(10.2, actor.position.z - center.z - 1.4)) };
        state.escort ??= { x: root.x, z: root.z };
        const dx = target.x - state.escort.x, dz = target.z - state.escort.z, length = Math.hypot(dx, dz), move = Math.min(length, elapsed * 8);
        if (length > 0) { state.escort.x += dx / length * move; state.escort.z += dz / length * move; }
        point = state.escort;
      }
      const position = filmPosition(scene.set, point.x, point.z), previous = { ...member.position };
      member.position = position; member.rotation = role === 'trinity' && ['leaving', 'done'].includes(state.phase) ? actor.rotation : root.yaw;
      member.currentLocation = scene.set; member.isInMatrix = false; member.targetPosition = null; member.currentPath = [];
      member.velocity = elapsed && role === 'trinity' && state.phase === 'leaving' ? { x: (position.x - previous.x) / elapsed, y: 0, z: (position.z - previous.z) / elapsed } : { x: 0, y: 0, z: 0 };
      member.currentAction = { type: 'idle', parameters: { resolved: true, hammerBriefing: { ...state, confirmed: [...state.confirmed], role, step: journey.step } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    if (hammerBriefingLocked(state) && !state.paused && !state.unavailable) {
      const point = hammerBriefingTarget(state);
      actor.position = filmPosition(scene.set, point.x, point.z); actor.rotation = state.phase === 'planning' || state.phase === 'confirmation' ? -Math.PI / 2 : Math.PI;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, hammerBriefing: { ...state, confirmed: [...state.confirmed], role: 'neo', step: journey.step } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.hammerBriefing) actor.currentAction = null;
    journey.lastText = hammerBriefingText(state); return hammerBriefingLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.hammerBriefing!, life = this.sandbox().neoLife!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry') {
      if (actor.status !== 'alive' || actor.health <= 0) { actor.status = 'alive'; actor.health = state.checkpointHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick);
      return '已接回分航会议检查点。借船安排、判断、物品与其他人的伤势保留。';
    }
    if (actor.status !== 'alive' || actor.health <= 0) return '先在手记中接回分航会议检查点。';
    if (target.startsWith('route:') && state.phase === 'confirmation') {
      const [, ship, destination] = target.split(':'), expected = ship === 'hammer' ? 'zion' : ship === 'logos' ? 'machine_city' : undefined;
      if (!expected || destination !== expected) { state.mistakes++; return '这条航线与船长刚才的安排不符。再看终端和手记中的两船记录。'; }
      if (!state.confirmed.includes(ship as HammerRoute)) state.confirmed.push(ship as HammerRoute);
      if (state.confirmed.length === 2) {
        life.choices.logos_ammunition = 'declined'; life.choices.hammer_supplies = 'zion_defense';
        state.phase = 'faith'; this.onAdvance?.(hammerBriefingText(state), actor, tick);
      }
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target.startsWith('reflect:') && state.phase === 'reflection' && journey.step === 3) {
      const choice = filmReflections('m3_logos_plan').find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的一种信任判断。';
      const key = 'm3_logos_plan:3'; if (journey.reflections[key]) return '判断已保存，等待回应结束。';
      journey.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `两船分航 · ${choice.label}`, text: choice.response });
      state.reply = choice.id; state.phase = 'responding'; state.elapsed = 0; this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target === 'act' && ['ready', 'objection', 'route', 'faith'].includes(state.phase)) {
      const point = hammerBriefingTarget(state);
      if (actor.isInMatrix || actor.currentLocation !== FILM_SCENE_BY_ID.m3_logos_plan.set || distance(actor.position, filmPosition(actor.currentLocation, point.x, point.z)) > 1.6)
        return '先走近当前会议位置，再按 G 开始。';
      state.phase = state.phase === 'ready' ? 'proposal' : state.phase === 'objection' ? 'loan' : state.phase === 'route' ? 'planning' : 'belief';
      state.elapsed = 0; state.checkpointHealth = actor.health; journey.checkpoint = { ...actor.position };
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (state.phase !== 'done') return journey.lastText;
  }
  private seal(): void {
    const prefix = 'film:hammer-briefing:', scene = FILM_SCENE_BY_ID.m3_logos_plan;
    if (this.sandbox().structures.some(item => item.id === `${prefix}console`)) return;
    for (const [name, shape] of [['console', { ...HAMMER_BRIEFING.console, height: 4.6 }],
      ...HAMMER_BRIEFING.walls.map((wall, i) => [`wall:${i}`, wall]) ] as [string, { x: number; z: number; width: number; depth: number; height: number }][]) this.sandbox().structures.push({
      id: `${prefix}${name}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9, position: filmPosition(scene.set, shape.x, shape.z),
      film: { scene: scene.id, width: shape.width, depth: shape.depth, height: shape.height },
    });
  }
}
