import { FILM_SETS, FILM_SCENE_BY_ID, WETWALL, WETWALL_SHAFT, WETWALL_ROLES, wetwallRoot, wetwallEntry, wetwallText, wetwallPath,
  type AgentState, type PlayerInput, type SandboxState, type WetwallEncounter, type WetwallRole, type Vector3 } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

/** The same saved path drives controller movement, company bodies and pipe contact. */
export class WetwallEscapeSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return Boolean(this.journey?.scene === 'm1_wetwall' && !this.journey.visiting && this.journey.actor === actor.id); }
  start(): void {
    const center = FILM_SETS.film_ambush_house.center;
    const starts = Object.fromEntries(WETWALL_ROLES.map(role => {
      const position = this.world.agents.get(role)!.position;
      return [role, { x: position.x - center.x, y: position.y - center.y, z: position.z - center.z }];
    })) as WetwallEncounter['starts'];
    const progress = Object.fromEntries(WETWALL_ROLES.map(role => [role, 0])) as WetwallEncounter['progress'];
    this.journey!.wetwall = { phase: 'sealed', elapsed: 0, attempts: 0, freed: false, starts, progress, checkpoint: { progress: { ...progress }, freed: false } };
    this.seal();
  }
  seal(): void {
    const id = 'film:wetwall:panel', journey = this.journey;
    const closed = journey && !journey.visiting && (journey.scene === 'm1_wetwall' && (journey.wetwall?.phase === 'sealed'
      || journey.wetwall?.phase === 'breaking' && journey.wetwall.elapsed < WETWALL.impact) || journey.scene === 'm1_dejavu' && journey.ambushEscape);
    if (!closed) { this.sandbox().structures = this.sandbox().structures.filter(item => item.id !== id); return; }
    if (this.sandbox().structures.some(item => item.id === id)) return;
    const center = FILM_SETS.film_ambush_house.center;
    this.sandbox().structures.push({ id, kind: 'barricade', owner: 'matrix', matrix: true, health: 999,
      position: { x: center.x - 18, y: center.y + WETWALL_SHAFT.top, z: center.z + WETWALL_SHAFT.front },
      film: { scene: 'm1_wetwall', width: WETWALL_SHAFT.holeWidth, depth: .24, height: WETWALL_SHAFT.holeHeight } });
  }
  private occupied(): boolean { return WETWALL_ROLES.some(role => role !== 'neo' && this.world.agents.get(role)?.controller); }
  private position(encounter: WetwallEncounter, role: WetwallRole, progress?: number): Vector3 {
    const root = wetwallRoot(encounter, role, progress), center = FILM_SETS.film_ambush_house.center;
    return { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
  }
  private clear(before: Vector3, after: Vector3, role: WetwallRole): boolean {
    const dx = after.x - before.x, dy = after.y - before.y, dz = after.z - before.z, span = dx * dx + dy * dy + dz * dz;
    return WETWALL_ROLES.every(other => {
      if (other === role) return true;
      const position = this.world.agents.get(other)!.position;
      const t = span ? Math.max(0, Math.min(1, ((position.x - before.x) * dx + (position.y - before.y) * dy + (position.z - before.z) * dz) / span)) : 0;
      if (Math.abs(before.y + dy * t - position.y) >= 4.7) return true;
      const gap = Math.hypot(before.x + dx * t - position.x, before.z + dz * t - position.z);
      return gap >= 2.25 || gap >= Math.hypot(before.x - position.x, before.z - position.z) - .000001;
    });
  }
  private move(encounter: WetwallEncounter, role: WetwallRole, goal: number, dt: number): void {
    const entry = wetwallEntry(encounter, role), before = this.position(encounter, role);
    const speed = encounter.progress[role] < entry ? role === 'neo' ? 2.8 : 4.2 : role === 'neo' ? WETWALL.speed : 2;
    // Stop at path corners: interpolating across two segments can cut through the plaster.
    let next = encounter.progress[role] + Math.sign(goal - encounter.progress[role]) * Math.min(Math.abs(goal - encounter.progress[role]), speed * dt);
    const points = wetwallPath(encounter.starts[role], role); let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z);
      if (length > encounter.progress[role] + .000001 && length < next) { next = length; break; }
      if (length < encounter.progress[role] - .000001 && length > next) next = length;
    }
    const after = this.position(encounter, role, next);
    if (this.clear(before, after, role)) { encounter.progress[role] = next; this.world.agents.get(role)!.position = after; }
  }
  stage(encounter: WetwallEncounter, dt: number, tick: number, previous?: Record<WetwallRole, Vector3>): void {
    for (const role of WETWALL_ROLES) {
      const actor = this.world.agents.get(role)!;
      if (role !== 'neo' && actor.controller || role === 'neo' && encounter.phase === 'sealed') continue;
      const before = previous?.[role] ?? actor.position, root = wetwallRoot(encounter, role);
      actor.position = this.position(encounter, role); actor.rotation = root.yaw; actor.isInMatrix = true; actor.currentLocation = 'film_ambush_house';
      actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.targetPosition = null; actor.currentPath = [];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, wetwall: { role, phase: encounter.phase, elapsed: encounter.elapsed,
        progress: encounter.progress[role], entry: wetwallEntry(encounter, role), hanging: root.hanging, freed: encounter.freed, start: encounter.starts[role], fallY: encounter.fallY } }, startedAt: tick, duration: 1e9, progress: 0 };
    }
  }
  private checkpoint(encounter: WetwallEncounter): void { encounter.checkpoint = { progress: { ...encounter.progress }, freed: encounter.freed }; }
  frame(actor: AgentState, input: Pick<PlayerInput, 'climb' | 'jump'>, dt: number, tick: number): boolean {
    if (!this.active(actor)) {
      const journey = this.journey, role = actor.id as WetwallRole, encounter = journey?.wetwall;
      if (journey?.scene !== 'm1_wetwall' || journey.visiting || !encounter || encounter.phase === 'sealed' || !WETWALL_ROLES.includes(role)) return false;
      const root = wetwallRoot(encounter, role);
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { resolved: true, wetwall: { role, phase: encounter.phase, elapsed: encounter.elapsed,
        progress: encounter.progress[role], entry: wetwallEntry(encounter, role), hanging: root.hanging, freed: encounter.freed, start: encounter.starts[role], fallY: encounter.fallY } }, startedAt: tick, duration: 1e9, progress: 0 };
      return true;
    }
    const encounter = this.journey!.wetwall!;
    const previous = Object.fromEntries(WETWALL_ROLES.map(role => [role, { ...this.world.agents.get(role)!.position }])) as Record<WetwallRole, Vector3>;
    encounter.paused = this.occupied();
    const delta = encounter.paused || !actor.controller || actor.status !== 'alive' ? 0 : Math.max(0, Math.min(.1, dt));
    if (encounter.phase === 'sealed') { this.stage(encounter, 0, tick); this.seal(); this.journey!.lastText = wetwallText(encounter); return false; }
    const entry = wetwallEntry(encounter, 'neo');
    if (['climbing', 'jammed'].includes(encounter.phase) && input.jump && encounter.progress.neo >= entry && delta > 0) {
      encounter.phase = 'falling'; encounter.fallY = actor.position.y - FILM_SETS.film_ambush_house.center.y; encounter.fallSpeed = 0; encounter.elapsed = 0;
    }
    if (encounter.phase === 'breaking') {
      encounter.elapsed = Math.min(WETWALL.breakSeconds, encounter.elapsed + delta);
      if (encounter.elapsed >= WETWALL.breakSeconds) {
        encounter.starts.neo = { ...encounter.starts.neo, z: -26.9 };
        encounter.phase = 'queue'; encounter.elapsed = 0; this.onAdvance?.(FILM_SCENE_BY_ID.m1_wetwall.steps[0].text!, actor, tick);
      }
    } else if (encounter.phase === 'queue') {
      const start = encounter.starts.morpheus;
      this.move(encounter, 'morpheus', Math.hypot(-18 - start.x, -24.2 - start.z), delta);
      const order = ['apoc', 'switch', 'trinity', 'cypher'] as const;
      for (const [i, role] of order.entries()) {
        const goal = wetwallEntry(encounter, role) + (i < 2 ? 11 : WETWALL.spacing), previous = i > 0 ? order[i - 1] : undefined;
        const previousGoal = previous && wetwallEntry(encounter, previous) + (i <= 2 ? 11 : WETWALL.spacing);
        if (!previous || encounter.progress[previous] >= previousGoal! - .001) this.move(encounter, role, goal, delta);
      }
      if (order.every((role, i) => encounter.progress[role] >= wetwallEntry(encounter, role) + (i < 2 ? 11 : WETWALL.spacing) - .001)) {
        encounter.phase = 'climbing'; this.checkpoint(encounter);
      }
    } else if (encounter.phase === 'climbing') {
      const maximum = entry + (encounter.freed ? WETWALL_SHAFT.top - WETWALL_SHAFT.sixth : WETWALL.jam - WETWALL.spacing);
      this.move(encounter, 'neo', Math.max(0, Math.min(maximum, encounter.progress.neo + (input.climb ?? 0) * (encounter.progress.neo < entry ? 4.2 : WETWALL.speed) * delta)), delta);
      const depth = Math.max(0, encounter.progress.neo - entry);
      for (const role of ['apoc', 'switch', 'trinity', 'cypher', 'morpheus'] as const) {
        const lead = role === 'morpheus' ? -WETWALL.spacing : ['apoc', 'switch'].includes(role) ? 11 : WETWALL.spacing;
        if (role === 'morpheus' && encounter.progress.neo < entry) continue;
        const goal = wetwallEntry(encounter, role) + Math.min(WETWALL_SHAFT.top - WETWALL_SHAFT.low, Math.max(0, depth + lead));
        this.move(encounter, role, Math.max(encounter.progress[role], goal), delta);
      }
      if (!encounter.freed && depth >= WETWALL.jam - WETWALL.spacing - .001 && encounter.progress.cypher >= wetwallEntry(encounter, 'cypher') + WETWALL.jam - .001) {
        encounter.phase = 'jammed'; encounter.elapsed = 0; this.onAdvance?.(FILM_SCENE_BY_ID.m1_wetwall.steps[1].text!, actor, tick);
      } else if (encounter.freed && depth >= WETWALL_SHAFT.top - WETWALL_SHAFT.sixth - .001) {
        encounter.phase = 'done'; this.onAdvance?.(FILM_SCENE_BY_ID.m1_wetwall.steps[3].text!, actor, tick);
      }
    } else if (encounter.phase === 'rescuing') {
      encounter.elapsed = Math.min(WETWALL.rescueSeconds, encounter.elapsed + delta);
      if (encounter.elapsed >= WETWALL.rescueSeconds) {
        encounter.freed = true; encounter.phase = 'climbing'; encounter.elapsed = 0; this.checkpoint(encounter);
        this.onAdvance?.(FILM_SCENE_BY_ID.m1_wetwall.steps[2].text!, actor, tick);
      }
    } else if (encounter.phase === 'falling') {
      encounter.elapsed += delta; encounter.fallSpeed = (encounter.fallSpeed ?? 0) - 24 * delta;
      encounter.fallY = (encounter.fallY ?? WETWALL_SHAFT.top) + encounter.fallSpeed * delta;
      if (encounter.fallY <= WETWALL_SHAFT.low) { encounter.fallY = WETWALL_SHAFT.low; encounter.fallSpeed = 0; encounter.phase = 'failed'; actor.status = 'dead'; actor.health = 0; }
    }
    this.stage(encounter, delta, tick, previous); this.seal(); this.journey!.checkpoint = { ...actor.position }; this.journey!.lastText = wetwallText(encounter);
    return true;
  }
  command(actor: AgentState, target: string, tick: number): string {
    const encounter = this.journey!.wetwall!;
    if (this.occupied()) { encounter.paused = true; return this.journey!.lastText = wetwallText(encounter); }
    if (target === 'retry' && encounter.phase === 'failed') {
      encounter.phase = 'climbing'; encounter.elapsed = 0; encounter.attempts++; encounter.progress = { ...encounter.checkpoint.progress }; encounter.freed = encounter.checkpoint.freed;
      delete encounter.fallY; delete encounter.fallSpeed; this.journey!.step = encounter.freed ? 3 : 1;
      actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
    } else if (target === 'act' && encounter.phase === 'sealed') {
      const center = FILM_SETS.film_ambush_house.center;
      if (Math.hypot(actor.position.x - center.x - WETWALL.approach.x, actor.position.z - center.z - WETWALL.approach.z) > .65
        || Math.abs(actor.position.y - center.y - WETWALL_SHAFT.top) > .15) return '走近 808 室的管线墙前，再按 G 破开灰泥。';
      encounter.starts.neo = { x: actor.position.x - center.x, y: actor.position.y - center.y, z: actor.position.z - center.z };
      encounter.phase = 'breaking'; encounter.elapsed = 0;
    } else if (target === 'act' && encounter.phase === 'jammed') { encounter.phase = 'rescuing'; encounter.elapsed = 0; }
    this.frame(actor, { climb: 0, jump: false }, 0, tick); return this.journey!.lastText;
  }
}
