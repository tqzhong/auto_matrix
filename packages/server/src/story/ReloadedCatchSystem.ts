import { CATCH, FILM_SCENE_BY_ID, catchFallY, catchFallClock, catchLocked, catchRoot, catchText, catchLaunchReady, catchFlightBlocked, catchDistance, filmPosition, newCatch,
  type AgentState, type CatchEncounter, type CatchGesture, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

/** Neo's return from the Architect: player-steered interception, then a saved rooftop revival. */
export class ReloadedCatchSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean {
    const journey = this.journey;
    return Boolean(journey && journey.scene === 'm2_catch' && !journey.visiting && journey.actor === actor.id);
  }
  private ensure(): CatchEncounter {
    const journey = this.journey!;
    if (!journey.catch) {
      journey.catch = newCatch();
      if (journey.completed.includes('m2_catch') || journey.step >= FILM_SCENE_BY_ID.m2_catch.steps.length) journey.catch.phase = 'done';
      else journey.step = 0; // The former two-step scene had no catch or rooftop state to resume.
      delete journey.started;
    }
    if (!journey.catch.layout && journey.catch.phase === 'launch') { journey.catch.x = CATCH.start.x; journey.catch.z = CATCH.start.z; journey.catch.layout = 2; }
    return journey.catch;
  }
  private occupied(): AgentState | undefined {
    return ['trinity', 'agent_thompson'].map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private stage(role: CatchGesture['role'], dt: number, tick: number): void {
    const actor = this.world.agents.get(role); if (!actor || actor.status !== 'alive' || actor.health <= 0 || role !== 'neo' && actor.controller) return;
    const encounter = this.ensure(); const root = catchRoot(encounter, role); const before = { ...actor.position };
    actor.position = filmPosition('film_trinity_roof', root.x, root.z); actor.position.y += root.y;
    const unchanged = actor.position.x === before.x && actor.position.y === before.y && actor.position.z === before.z;
    actor.currentLocation = 'film_trinity_roof'; actor.isInMatrix = true; actor.rotation = root.yaw;
    if (dt > 0) actor.velocity = { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt };
    else if (!unchanged) actor.velocity = { x: 0, y: 0, z: 0 };
    actor.targetPosition = null; actor.currentPath = [];
    actor.currentAction = { type: 'idle', parameters: { resolved: true, catch: { ...encounter, role } },
      startedAt: dt === 0 && unchanged && actor.currentAction?.parameters.catch ? actor.currentAction.startedAt : tick, duration: 1e9, progress: 0 };
  }
  private clearActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.catch) {
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  private fail(checkpoint: 'flight' | 'pulse'): void {
    const encounter = this.ensure();
    encounter.failure = { neo: catchRoot(encounter, 'neo'), trinity: catchRoot(encounter, 'trinity'), agent_thompson: catchRoot(encounter, 'agent_thompson') };
    encounter.phase = 'failed'; encounter.checkpoint = checkpoint;
    this.journey!.lastText = catchText(encounter);

  }
  frame(actor: AgentState, input: { x: number; z: number; focus: boolean }, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const encounter = this.ensure(); const journey = this.journey!;
    const occupied = this.occupied();
    if (occupied) { journey.lastText = `${occupied.name} 正由另一位玩家控制，营救停在当前检查点。`; return true; }
    const trinity = this.world.agents.get('trinity');
    if (actor.status !== 'alive' || actor.health <= 0 || trinity?.status !== 'alive' || trinity.health <= 0) { journey.lastText = '营救角色无法行动，当前进度已保留。'; return true; }
    if (encounter.phase === 'done') return false;
    if (encounter.phase === 'failed') { for (const role of ['neo', 'trinity', 'agent_thompson'] as const) this.stage(role, 0, tick); return true; }
    const delta = Math.max(0, Math.min(.1, dt));
    if (encounter.phase === 'launch') {
      encounter.x = Math.max(-2, Math.min(2, encounter.x + input.x * 4 * delta));
      encounter.z = Math.max(CATCH.window.z + .55, Math.min(53, encounter.z + input.z * 4 * delta));
      if (Math.hypot(input.x, input.z) > .1) encounter.yaw = Math.atan2(input.x, input.z);
    } else if (encounter.phase === 'departing') {
      encounter.elapsed = Math.min(CATCH.departure, encounter.elapsed + delta);
      if (encounter.elapsed >= CATCH.departure) { Object.assign(encounter, { phase: 'flight', elapsed: 0, x: CATCH.flightStart.x, z: CATCH.flightStart.z, yaw: Math.PI }); this.onAdvance?.(FILM_SCENE_BY_ID.m2_catch.steps[0].text!, actor, tick); }
    } else if (encounter.phase === 'flight') {
      const before = catchRoot(encounter, 'neo');
      encounter.elapsed = Math.min(CATCH.impact, encounter.elapsed + delta);
      if (Math.hypot(input.x, input.z) > .1) encounter.yaw = Math.atan2(input.x, input.z);
      encounter.x = Math.max(-22, Math.min(22, encounter.x + input.x * CATCH.lateral * delta));
      encounter.z = Math.max(-30, Math.min(CATCH.flightStart.z, encounter.z + input.z * CATCH.speed * delta));
      if (catchFlightBlocked(before, catchRoot(encounter, 'neo'))) { this.fail('flight'); return false; }
      if (encounter.elapsed >= CATCH.impact || catchFallY(encounter.elapsed) <= CATCH.roadY) { this.fail('flight'); return false; }
    } else if (encounter.phase === 'catching') {
      encounter.elapsed = Math.min(CATCH.catching, encounter.elapsed + delta);
      if (encounter.elapsed >= CATCH.catching - 1e-6) { encounter.phase = 'ascent'; encounter.elapsed = 0; }
    } else if (encounter.phase === 'ascent') {
      encounter.elapsed = Math.min(CATCH.ascent, encounter.elapsed + delta);
      if (encounter.elapsed >= CATCH.ascent - 1e-6) { encounter.phase = 'landing'; encounter.elapsed = 0; }
    } else if (encounter.phase === 'landing') {
      encounter.elapsed = Math.min(CATCH.landing, encounter.elapsed + delta);
      if (encounter.elapsed >= CATCH.landing - 1e-6) { encounter.phase = 'extract_ready'; encounter.elapsed = 0; }
    } else if (encounter.phase === 'extracting') {
      encounter.focus = Math.max(0, Math.min(CATCH.extraction, encounter.focus + (input.focus ? delta : -delta * .35)));
      if (encounter.focus >= CATCH.extraction) {
        encounter.phase = 'pulse'; encounter.elapsed = 0; encounter.beats = 0; encounter.checkpoint = 'pulse';
        this.onAdvance?.(FILM_SCENE_BY_ID.m2_catch.steps[2].text!, actor, tick);
      }
    } else if (encounter.phase === 'reviving') {
      encounter.elapsed = Math.min(CATCH.revival, encounter.elapsed + delta);
      if (encounter.elapsed >= CATCH.revival - 1e-6) {
        encounter.phase = 'done'; this.sandbox().neoLife!.choices.trinity_revived = 'neo';
        this.clearActions(); this.stage('trinity', 0, tick); this.onAdvance?.(FILM_SCENE_BY_ID.m2_catch.steps[3].text!, actor, tick);
        return false;
      }
    } else if (encounter.phase === 'pulse') {
      encounter.elapsed += delta;
      if (encounter.elapsed > CATCH.pulsePeriod) encounter.elapsed -= CATCH.pulsePeriod;
    }
    for (const role of ['neo', 'trinity', 'agent_thompson'] as const) this.stage(role, delta, tick);
    const thompson = this.world.agents.get('agent_thompson');
    if (delta > 0 && catchFallClock(encounter) >= CATCH.agentImpact && thompson?.status === 'alive' && thompson.health > 0) {
      encounter.carImpact = true;
      thompson.health = 0; thompson.status = 'dead'; thompson.velocity = { x: 0, y: 0, z: 0 };
      this.world.addWorldEvent({ type: 'death', title: 'Thompson 坠落撞上汽车', description: '特工在追击 Trinity 时坠落，车顶被撞毁。',
        involvedAgents: ['agent_thompson'], location: 'film_trinity_roof', tick, importance: 8 });
    }
    journey.checkpoint = { ...actor.position }; journey.lastText = catchText(encounter);
    return catchLocked(encounter);
  }
  handle(actor: AgentState, kind: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    const encounter = this.ensure();
    if (this.occupied()) return this.journey!.lastText;
    const trinity = this.world.agents.get('trinity');
    if (actor.status !== 'alive' || actor.health <= 0 || trinity?.status !== 'alive' || trinity.health <= 0) return '营救角色无法行动，当前进度已保留。';
    if (kind === 'attack' && encounter.phase === 'pulse') {
      if (Math.abs(encounter.elapsed - CATCH.pulseAt) <= CATCH.pulseWindow) {
        encounter.beats++; encounter.elapsed = 0;
        if (encounter.beats === 3) {
          encounter.phase = 'reviving'; encounter.elapsed = 0;
        }
      } else {
        encounter.misses++; encounter.elapsed = 0;
        if (encounter.misses >= 3) this.fail('pulse');
      }
      this.journey!.lastText = catchText(encounter); return this.journey!.lastText;
    }
    if (['attack', 'shoot', 'dodge', 'ability', 'ability2'].includes(kind)) return catchText(encounter);
  }
  command(actor: AgentState, target: string, tick: number): string {
    const encounter = this.ensure(); const journey = this.journey!;
    const occupied = this.occupied(); if (occupied) return `${occupied.name} 正由另一位玩家控制，营救进度已保留。`;
    if (target === 'retry') {
      if (encounter.phase === 'failed') {
        const attempt = encounter.attempt + 1;
        if (encounter.checkpoint === 'pulse') {
          Object.assign(encounter, { phase: 'pulse', elapsed: 0, beats: 0, misses: 0, attempt });
        } else { journey.catch = newCatch(attempt); if (encounter.carImpact) journey.catch.carImpact = true; journey.step = 0; }
        if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = []; }
        this.frame(actor, { x: 0, z: 0, focus: false }, 0, tick);
      }
      return catchText(this.ensure());
    }
    if (target !== 'act') return catchText(encounter);
    const trinity = this.world.agents.get('trinity');
    if (actor.status !== 'alive' || actor.health <= 0 || trinity?.status !== 'alive' || trinity.health <= 0) return '营救角色无法行动，当前进度已保留。';
    if (encounter.phase === 'launch') {
      if (!catchLaunchReady(encounter)) return '先用 W 走到实体窗口，再按 G 起飞。';
      encounter.launch = { x: encounter.x, z: encounter.z }; encounter.phase = 'departing'; encounter.elapsed = 0;
    } else if (encounter.phase === 'flight') {
      const gap = catchDistance(encounter);
      if (encounter.elapsed < CATCH.catchFrom || gap > CATCH.catchRadius) return `${catchText(encounter)} 当前身体距离 ${gap.toFixed(1)} 米。`;
      encounter.caught = { neo: catchRoot(encounter, 'neo'), trinity: catchRoot(encounter, 'trinity'), age: encounter.elapsed };
      encounter.catchY = catchFallY(encounter.elapsed); encounter.phase = 'catching'; encounter.elapsed = 0;
      this.onAdvance?.(FILM_SCENE_BY_ID.m2_catch.steps[1].text!, actor, tick);
    } else if (encounter.phase === 'extract_ready') {
      encounter.phase = 'extracting'; encounter.focus = 0;
    }
    this.frame(actor, { x: 0, z: 0, focus: false }, 0, tick);
    return journey.lastText;
  }
}
