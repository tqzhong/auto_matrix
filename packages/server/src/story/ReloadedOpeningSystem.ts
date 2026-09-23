import { FILM_SCENE_BY_ID, FILM_SETS, RELOADED, newReloaded, reloadedLocked, reloadedRoot, reloadedText, filmPosition, distance, combatDisplace, meleeReach,
  type AgentState, type SandboxState, type ReloadedOpening, type ReloadedPhase, type CombatImpact } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

/** Reloaded's first vision and its aftermath. The dream cannot change a real character's fate. */
export class ReloadedOpeningSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean {
    const journey = this.journey;
    return Boolean(journey && !journey.visiting && journey.actor === actor.id && ['m2_dream', 'm2_meeting'].includes(journey.scene));
  }
  private ensure(): ReloadedOpening {
    const journey = this.journey!;
    if (!journey.reloaded) {
      journey.reloaded = newReloaded(journey.scene === 'm2_dream' ? 'dream' : 'meeting');
      if (journey.completed.includes(journey.scene)) { journey.reloaded.phase = 'done'; journey.step = FILM_SCENE_BY_ID[journey.scene].steps.length; }
      else if (journey.step > 0) {
        journey.reloaded.phase = journey.scene === 'm2_dream' ? 'window_ready' : 'combat';
        if (journey.scene === 'm2_meeting') { journey.step = 3; journey.reloaded.exit = 'west'; }
      }
      this.sandbox().threats = this.sandbox().threats.filter(threat => threat.scene !== journey.scene);
      if (journey.reloaded.phase === 'combat') for (const id of RELOADED.agents) this.stage(id, 0, 0);
      delete journey.started; delete journey.fighting;
    }
    return journey.reloaded;
  }
  private occupied(): AgentState | undefined {
    const state = this.ensure(); if (state.phase === 'done') return; const roles: readonly string[] = state.kind === 'dream' ? ['agent_johnson'] : RELOADED.cast;
    return roles.map(id => this.world.agents.get(id)).find(actor => actor?.controller && actor.id !== this.journey!.actor);
  }
  private phase(next: ReloadedPhase): void { const state = this.ensure(); state.phase = next; state.elapsed = 0; this.journey!.lastText = reloadedText(state); }
  private advance(actor: AgentState, tick: number): void { this.onAdvance?.(reloadedText(this.ensure()), actor, tick); }
  private clearActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.reloaded) { actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 }; }
  }
  private stage(role: string, dt: number, tick: number, keepPosition = false): void {
    const actor = this.world.agents.get(role); if (!actor || actor.controller && role !== this.journey!.actor) return;
    const state = this.ensure(); const pose = reloadedRoot(state, role); const before = { ...actor.position };
    if (!keepPosition) {
      actor.position = filmPosition(pose.set, pose.x, pose.z); actor.position.y += pose.y; actor.rotation = pose.yaw;
      actor.currentLocation = pose.set; actor.isInMatrix = FILM_SETS[pose.set].world === 'matrix';
    }
    actor.targetPosition = null; actor.currentPath = [];
    if (!keepPosition) actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    actor.currentAction = { type: 'idle', parameters: { player: actor.id === this.journey!.actor, resolved: true,
      armed: state.kind === 'dream' && ['breaking', 'falling', 'dream_hit'].includes(state.phase),
      reloaded: { ...state, shots: [...state.shots], missed: [...state.missed], hits: [...state.hits], role } }, startedAt: tick, duration: 1, progress: 0 };
  }
  action(actor: AgentState, tick: number): void {
    if (this.active(actor) && !reloadedLocked(this.journey!)) this.stage(actor.id, 0, tick, true);
  }
  private impact(source: AgentState, target: AgentState, damage: number, tick: number, shot = false): void {
    const from = { ...source.position, y: source.position.y + 2.4 }; const position = { ...target.position, y: target.position.y + 2 };
    const length = Math.max(.01, distance(from, position));
    this.onImpact?.({ source: source.id, target: target.id, position, direction: { x: (position.x - from.x) / length, y: (position.y - from.y) / length, z: (position.z - from.z) / length },
      damage, combo: 0, matrix: true, downed: false, ...(shot ? { shot: { from, surface: 'body' as const } } : {}) }, tick);
  }
  frame(actor: AgentState, input: { x: number; focus: boolean }, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const state = this.ensure(); const journey = this.journey!;
    const occupied = this.occupied();
    if (occupied) { journey.lastText = `${occupied.name} 正由另一位玩家控制，第二部开场停在当前进度。`; return true; }
    if (actor.status !== 'alive' && state.kind === 'meeting' && state.phase !== 'done') { this.phase('failed'); this.clearActions(); return false; }
    const doorId = 'film:reloaded:door';
    const shut = state.kind === 'meeting' && !['combat', 'departure_ready', 'departing', 'done', 'failed'].includes(state.phase);
    if (!shut) this.sandbox().structures = this.sandbox().structures.filter(structure => structure.id !== doorId);
    else if (!this.sandbox().structures.some(structure => structure.id === doorId)) this.sandbox().structures.push({ id: doorId, kind: 'barricade', owner: 'matrix', position: filmPosition('film_captains_meeting', 0, -20), matrix: true, health: 1,
      film: { scene: 'm2_meeting', width: 7.4, depth: .3, height: 8.6 } });
    if (state.phase === 'failed') return false;
    const delta = Math.max(0, Math.min(.1, dt)); state.shotAge += delta; state.dodgeAge += delta; state.dodgeCooldown = Math.max(0, state.dodgeCooldown - delta);
    state.punchAge += delta;
    if (state.kind === 'dream') {
      if (state.phase === 'approach' || state.phase === 'window_ready') {
        if (actor.position.z < filmPosition('film_trinity_roof', 0, -15.7).z) actor.position.z = filmPosition('film_trinity_roof', 0, -15.7).z;
        if (state.phase === 'approach' && distance(actor.position, filmPosition('film_trinity_roof', 0, -15)) < 3.8) { this.phase('window_ready'); this.advance(actor, tick); }
        this.stage('agent_johnson', 0, tick); this.action(actor, tick);
      } else {
        state.elapsed += delta * (state.phase === 'falling' && input.focus ? .5 : 1);
        if (state.phase === 'breaking' && state.elapsed >= RELOADED.breakGlass) this.phase('falling');
        else if (state.phase === 'falling') {
          state.drift = Math.max(-4.5, Math.min(4.5, state.drift + input.x * delta * 3));
          for (const beat of RELOADED.dreamShots) if (state.elapsed > beat + RELOADED.shotWindow && !state.shots.includes(beat) && !state.missed.includes(beat)) {
            state.missed.push(beat); this.impact(this.world.agents.get('agent_johnson')!, actor, 0, tick, true);
          }
          if (state.elapsed >= RELOADED.fall) { this.phase('dream_hit'); this.impact(this.world.agents.get('agent_johnson')!, actor, 0, tick, true); }
        } else if (state.phase === 'dream_hit' && state.elapsed >= RELOADED.impact) {
          this.phase('done'); this.sandbox().neoLife!.choices.trinity_dream = state.shots.length >= 2 ? 'clear' : 'fragmented'; this.advance(actor, tick);
        }
        this.stage('trinity', delta, tick); this.stage('agent_johnson', delta, tick);
      }
    } else {
      const timers: Partial<Record<ReloadedPhase, number>> = { waking: RELOADED.wake, talking: RELOADED.conversation, connecting: RELOADED.connect, report: RELOADED.report, earpiece: RELOADED.earpiece, breach: RELOADED.breach, departing: RELOADED.departure };
      const duration = timers[state.phase]; if (duration) state.elapsed = Math.min(duration, state.elapsed + delta);
      if (duration && state.elapsed >= duration) {
        if (state.phase === 'waking') this.phase('talk_ready');
        else if (state.phase === 'talking') this.phase('connect_ready');
        else if (state.phase === 'connecting') {
          this.phase('report_ready'); actor.position = filmPosition('film_captains_meeting', 0, 31); actor.currentLocation = 'film_captains_meeting'; actor.isInMatrix = true; actor.rotation = Math.PI;
          this.clearActions(); this.advance(actor, tick);
        } else if (state.phase === 'report') { this.phase('earpiece_ready'); this.sandbox().neoLife!.choices.ballard_watch = '36h'; this.advance(actor, tick); }
        else if (state.phase === 'earpiece') { this.phase('evacuate_ready'); this.sandbox().neoLife!.choices.smith_earpiece = 'received'; this.advance(actor, tick); }
        else if (state.phase === 'breach') { this.phase('combat'); this.sandbox().structures = this.sandbox().structures.filter(structure => structure.id !== doorId); for (const id of RELOADED.agents) this.stage(id, 0, tick); }
        else if (state.phase === 'departing') { this.phase('done'); this.advance(actor, tick); }
      }
      if (state.exit && !state.evacuated) {
        state.evacuation = Math.min(RELOADED.evacuation, state.evacuation + delta);
        state.evacuated = state.evacuation >= RELOADED.evacuation;
      }
      const ship = ['waking', 'talk_ready', 'talking', 'connect_ready', 'connecting'].includes(state.phase);
      if (ship) for (const id of ['neo', 'trinity', 'link']) this.stage(id, delta, tick);
      else {
        for (const id of ['trinity', 'morpheus', 'niobe', 'ballard', 'ghost', 'soren']) this.stage(id, delta, tick);
        if (state.phase === 'combat') this.combatFrame(actor, delta, tick);
        else if (reloadedLocked(journey)) this.stage('neo', delta, tick);
        if (state.phase === 'breach') for (const id of RELOADED.agents) this.stage(id, delta, tick);
        this.action(actor, tick);
      }
    }
    if (reloadedLocked(journey)) journey.checkpoint = { ...actor.position };
    journey.lastText = reloadedText(state); return reloadedLocked(journey);
  }
  private combatFrame(actor: AgentState, delta: number, tick: number): void {
    const state = this.ensure(); const enemy = this.world.agents.get(RELOADED.agents[state.opponent])!;
    const before = { ...enemy.position };
    for (const id of RELOADED.agents) this.world.agents.get(id)!.velocity = { x: 0, y: 0, z: 0 };
    const dx = actor.position.x - enemy.position.x; const dz = actor.position.z - enemy.position.z; const length = Math.hypot(dx, dz);
    if (length > 3.1 && state.cycle < RELOADED.strike) enemy.position = combatDisplace(enemy.position, { x: dx / length, y: 0, z: dz / length }, Math.min(length - 3.1, delta * 7), true, this.sandbox().structures);
    if (delta > 0) enemy.velocity = { x: (enemy.position.x - before.x) / delta, y: 0, z: (enemy.position.z - before.z) / delta };
    enemy.rotation = Math.atan2(dx, dz);
    if (length < 5.8 || state.cycle >= RELOADED.strike) state.cycle += delta;
    else { state.cycle = 0; state.evaded = false; }
    if (state.cycle >= RELOADED.strike && state.cycle - delta < RELOADED.strike && !state.evaded
      && meleeReach(enemy.position, enemy.rotation, actor.position, 5, true, this.sandbox().structures)) {
      actor.health = Math.max(0, actor.health - 22); this.impact(enemy, actor, 22, tick);
      if (!actor.health) { actor.status = 'dead'; this.phase('failed'); this.clearActions(); return; }
    }
    if (!state.punchResolved && state.punchAge >= .17) {
      state.punchResolved = true;
      if (state.evaded && !state.countered && state.cycle >= RELOADED.strike && state.cycle <= RELOADED.strike + RELOADED.recovery
        && meleeReach(actor.position, actor.rotation, enemy.position, 4.6, true, this.sandbox().structures)) {
        state.hits[state.opponent]++; state.countered = true; this.impact(actor, enemy, 24, tick);
        if (state.hits.every(hits => hits >= 2)) { this.phase('departure_ready'); this.advance(actor, tick); }
      } else if (meleeReach(actor.position, actor.rotation, enemy.position, 4.6, true, this.sandbox().structures)) this.impact(enemy, actor, 0, tick);
    }
    for (const id of RELOADED.agents) this.stage(id, 0, tick, true);
    if (state.cycle >= RELOADED.strike + RELOADED.recovery && state.phase === 'combat') {
      state.cycle = 0; state.round++; state.evaded = false; state.countered = false;
      for (let i = 1; i <= 3; i++) { const next = (state.opponent + i) % 3; if (state.hits[next] < 2) { state.opponent = next; break; } }
    }
  }
  handle(actor: AgentState, kind: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    const state = this.ensure(); if (this.occupied()) return this.journey!.lastText;
    if (state.kind === 'dream' && kind === 'attack') {
      if (state.phase !== 'falling') return reloadedText(state);
      const beat = RELOADED.dreamShots.find(beat => Math.abs(state.elapsed - beat) <= RELOADED.shotWindow && !state.shots.includes(beat) && !state.missed.includes(beat));
      if (beat !== undefined) { state.shots.push(beat); state.shotAge = 0; this.impact(actor, this.world.agents.get('agent_johnson')!, 0, tick, true); }
      return reloadedText(state);
    }
    if (state.phase === 'combat' && kind === 'attack') {
      if (state.punchAge >= .55) { state.punchAge = 0; state.punchResolved = false; }
      return reloadedText(state);
    }
    if (state.phase === 'combat' && kind === 'dodge') {
      if (state.dodgeCooldown > 0) return '重心还没有收回，先稳住脚步。';
      state.dodgeCooldown = .8; state.dodgeAge = 0;
      if (state.cycle >= RELOADED.strike - RELOADED.dodgeWindow && state.cycle < RELOADED.strike) state.evaded = true;
      return state.evaded ? '冲拳落空。靠近特工，等拳势落下后按 F 反击。' : '你提前移动，特工仍能修正方向。';
    }
    if (['attack', 'shoot', 'dodge', 'ability', 'ability2'].includes(kind)) return reloadedText(state);
  }
  command(actor: AgentState, target: string, tick: number): string {
    const state = this.ensure(); const occupied = this.occupied();
    if (occupied) return `${occupied.name} 正在参与另一位玩家的行动，片段已保留。`;
    if (state.phase === 'failed' && ['act', 'retry'].includes(target)) {
      const exit = state.exit; const attempt = state.attempt + 1;
      this.journey!.reloaded = { ...newReloaded('meeting'), phase: 'combat', exit, attempt }; this.journey!.step = 3;
      actor.health = actor.maxHealth; actor.status = 'alive'; actor.activeEffects = []; this.clearActions();
      this.stage('neo', 0, tick); for (const id of RELOADED.agents) this.stage(id, 0, tick);
      this.journey!.checkpoint = { ...actor.position }; return reloadedText(this.ensure());
    }
    if (target === 'retry') { this.frame(actor, { x: 0, focus: false }, 0, tick); return '已接回当前拍点，保留梦境细节、会议情报与撤离进度。'; }
    if (target === 'act') {
      if (state.phase === 'window_ready' && distance(actor.position, filmPosition('film_trinity_roof', 0, -15)) < 4) this.phase('breaking');
      else if (state.phase === 'talk_ready') this.phase('talking');
      else if (state.phase === 'connect_ready') this.phase('connecting');
      else if (state.phase === 'report_ready' && distance(actor.position, filmPosition('film_captains_meeting', 0, 13)) < 4) this.phase('report');
      else if (state.phase === 'earpiece_ready' && distance(actor.position, filmPosition('film_captains_meeting', 0, -14)) < 4) this.phase('earpiece');
      else if (state.phase === 'evacuate_ready') return this.command(actor, 'exit:west', tick);
      else if (state.phase === 'departure_ready' && state.evacuated) this.phase('departing');
    } else if (state.phase === 'evacuate_ready' && (target === 'exit:east' || target === 'exit:west')) {
      state.exit = target === 'exit:east' ? 'east' : 'west'; this.sandbox().neoLife!.choices.captains_exit = state.exit; this.phase('breach');
    }
    this.frame(actor, { x: 0, focus: false }, 0, tick); return this.journey!.lastText;
  }
}
