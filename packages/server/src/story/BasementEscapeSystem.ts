import { BASEMENT, BASEMENT_ROLES, BASEMENT_TUNNEL_LENGTH, BETRAYAL, FILM_SETS, FILM_SCENE_BY_ID, TV_EXIT, TV_EXIT_STREET_ROLES, WETWALL_SHAFT,
  basementDrainRoot, basementGasDensity, basementLandingRoot, basementLifterRoot, basementLocked, basementRouteLength, basementRouteRoot,
  basementText, basementTunnelProgress, basementTunnelRoot, playerBlocked, tvExitEntered, tvExitLocked, tvExitRoot, tvExitStreetFrame,
  tvExitStreetRoot, tvExitStreetRouteLength, tvExitText, wetwallEntry,
  ambushCompanyBlocked, ambushCompanyStep, type AgentState, type BasementEncounter, type BasementRole, type PlayerInput,
  type SandboxState, type Vector3 } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import { CypherBetrayalSystem } from './CypherBetrayalSystem.js';

/** The lower shaft, boiler room and hardline share the saved company state. */
export class BasementEscapeSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  readonly crosscut: CypherBetrayalSystem;
  constructor(private world: WorldState, private sandbox: () => SandboxState) { this.crosscut = new CypherBetrayalSystem(world, sandbox); }
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return this.crosscut.active(actor) || Boolean(this.journey && !this.journey.visiting && ['m1_basement', 'm1_tv_exit'].includes(this.journey.scene) && this.journey.actor === actor.id); }
  private occupied(): boolean {
    const roles = BASEMENT_ROLES;
    return roles.some(role => role !== 'neo' && this.world.agents.get(role)?.controller);
  }
  start(): void {
    const center = FILM_SETS.film_ambush_house.center;
    const starts = Object.fromEntries(BASEMENT_ROLES.map(role => {
      const actor = this.world.agents.get(role)!;
      return [role, { x: actor.position.x - center.x, y: actor.position.y - center.y, z: actor.position.z - center.z, yaw: actor.rotation }];
    })) as BasementEncounter['starts'];
    this.journey!.basement = { phase: 'ready', elapsed: 0, attempts: 0, air: 100, gas: 0, hatch: 0, separated: false, starts,
      heights: Object.fromEntries(BASEMENT_ROLES.map(role => [role, starts[role].y])) as BasementEncounter['heights'],
      company: Object.fromEntries(BASEMENT_ROLES.map(role => [role, 0])) as BasementEncounter['company'], landings: {}, tunnel: 0, checkpoint: 'shaft' };
    this.frame(this.world.agents.get('neo')!, { yaw: starts.neo.yaw }, 0, this.world.simulationTick);
  }
  startTv(): void {
    this.journey!.tvExit = { phase: 'ready', elapsed: 0,
      street: Object.fromEntries(TV_EXIT_STREET_ROLES.map(role => [role, 0])) as Record<typeof TV_EXIT_STREET_ROLES[number], number> };
    this.crosscut.start();
    const center = FILM_SETS.film_tv_repair.center;
    for (const id of TV_EXIT_STREET_ROLES) {
      const root = tvExitStreetRoot(id, 0);
      const actor = this.world.agents.get(id)!; if (actor.controller) continue;
      actor.position = { x: center.x + root.x, y: center.y, z: center.z + root.z }; actor.rotation = root.yaw;
      actor.currentLocation = 'film_tv_repair'; actor.isInMatrix = true;
    }
    this.frame(this.world.agents.get('neo')!, { yaw: Math.PI }, 0, this.world.simulationTick);
  }
  private advance(index: number, actor: AgentState, tick: number): void {
    if (this.journey!.step === index) this.onAdvance?.(FILM_SCENE_BY_ID[this.journey!.scene].steps[index].text ?? '抵达下一段路线。', actor, tick);
  }
  private stage(encounter: BasementEncounter, dt: number, tick: number, crouching: boolean, previous?: Record<BasementRole, Vector3>): void {
    const center = FILM_SETS.film_ambush_house.center, wall = this.journey!.wetwall;
    for (const role of BASEMENT_ROLES) {
      const actor = this.world.agents.get(role)!; if (role !== 'neo' && actor.controller) continue;
      const before = previous?.[role] ?? actor.position;
      let root: Vector3 & { yaw: number; hanging?: boolean; crawling?: boolean; landing?: number };
      if (['ready', 'descending', 'landing'].includes(encounter.phase)) root = basementLandingRoot(encounter, role);
      else if (encounter.failure === 'fall') root = role === 'neo' ? { ...encounter.starts.neo, y: encounter.fallY!, hanging: false } : basementLandingRoot(encounter, role);
      else if (encounter.phase === 'draining') root = basementDrainRoot(encounter, role);
      else if (encounter.phase === 'tunnel' || encounter.phase === 'done') root = role === 'neo' ? { x: actor.position.x - center.x, y: BASEMENT.tunnelFloor, z: actor.position.z - center.z, yaw: actor.rotation, crawling: true }
        : role === 'cypher' ? basementRouteRoot(role, encounter.company[role])
          : { ...basementTunnelRoot(encounter.tunnel + ({ trinity: 11.1, apoc: 7.4, switch: 3.7 } as const)[role]), crawling: true };
      else root = role === 'neo' ? { x: actor.position.x - center.x, y: actor.position.y - center.y, z: actor.position.z - center.z, yaw: actor.rotation }
        : basementRouteRoot(role, encounter.company[role]);
      if (role === 'trinity' && ['lifting', 'hatch_ready'].includes(encounter.phase)) root = basementLifterRoot(encounter.hatch);
      if (role !== 'neo' || basementLocked(this.journey)) {
        actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; actor.rotation = root.yaw;
        actor.velocity = dt ? { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      }
      if (role === 'trinity' && ['lifting', 'hatch_ready'].includes(encounter.phase)) actor.rotation = Math.PI / 2;
      actor.currentLocation = 'film_ambush_house'; actor.isInMatrix = true; actor.targetPosition = null; actor.currentPath = [];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, crouching: role === 'neo' && crouching,
        basement: { role, phase: encounter.phase, elapsed: encounter.elapsed, hatch: encounter.hatch, paused: encounter.paused,
          crawling: root.crawling, landing: root.landing, crouching: role === 'neo' && crouching },
        wetwall: root.hanging && wall ? { role, phase: 'done', elapsed: 0, start: wall.starts[role], entry: wetwallEntry(wall, role),
          progress: wetwallEntry(wall, role) + WETWALL_SHAFT.top - root.y, hanging: true, freed: true, continued: true } : undefined }, startedAt: tick, duration: 1e9, progress: 0 };
    }
  }
  movement(actor: AgentState, before: Vector3, after: Vector3): Vector3 {
    if (!this.active(actor) || this.journey!.scene !== 'm1_basement') return after;
    const positions = BASEMENT_ROLES.filter(role => role !== actor.id).map(role => this.world.agents.get(role)!.position);
    return ambushCompanyStep(before, after, positions);
  }
  frame(actor: AgentState, input: Partial<PlayerInput>, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    if (this.crosscut.active(actor)) return this.crosscut.frame(actor, dt, tick);
    if (this.journey!.scene === 'm1_tv_exit') return this.tvFrame(actor, dt, tick);
    const encounter = this.journey!.basement!, center = FILM_SETS.film_ambush_house.center;
    const previous = Object.fromEntries(BASEMENT_ROLES.map(role => [role, { ...this.world.agents.get(role)!.position }])) as Record<BasementRole, Vector3>;
    encounter.paused = this.occupied();
    const delta = encounter.paused || !actor.controller || actor.status !== 'alive' ? 0 : Math.max(0, Math.min(.1, dt));
    if (['descending', 'landing'].includes(encounter.phase) && delta > 0) {
      if (input.jump && encounter.landings.neo === undefined) { encounter.phase = 'failed'; encounter.failure = 'fall'; encounter.fallY = actor.position.y - center.y; encounter.fallSpeed = 0; encounter.elapsed = 0; }
      else {
        const edge = BASEMENT.floor + BASEMENT.ceiling;
        if (encounter.landings.neo === undefined) encounter.heights.neo = Math.min(encounter.starts.neo.y, Math.max(edge, encounter.heights.neo - (input.climb ?? 0) * BASEMENT.descentSpeed * delta));
        for (const role of BASEMENT_ROLES) {
          const age = encounter.landings[role];
          if (age !== undefined) { encounter.landings[role] = age + delta; continue; }
          if (role !== 'neo') {
            const lead = ['apoc', 'switch'].includes(role) ? -5.4 : role === 'cypher' ? 5.4 : 0;
            const goal = Math.max(edge, (encounter.landings.neo ?? 0) >= 3 ? edge : encounter.heights.neo + lead);
            encounter.heights[role] += Math.sign(goal - encounter.heights[role]) * Math.min(Math.abs(goal - encounter.heights[role]), BASEMENT.descentSpeed * delta);
          }
          if (encounter.heights[role] <= edge + .001) encounter.landings[role] = 0;
        }
        encounter.elapsed += delta;
        if (encounter.landings.neo !== undefined) encounter.phase = 'landing';
        if (BASEMENT_ROLES.every(role => (encounter.landings[role] ?? 0) >= 3)) {
          encounter.phase = 'searching'; encounter.elapsed = 0; encounter.checkpoint = 'floor'; this.advance(0, actor, tick);
        }
      }
    }
    if (encounter.phase === 'failed' && encounter.failure === 'fall' && delta > 0 && (encounter.fallY ?? BASEMENT.floor) > BASEMENT.floor) {
      encounter.fallSpeed = (encounter.fallSpeed ?? 0) - 24 * delta; encounter.fallY = Math.max(BASEMENT.floor, encounter.fallY! + encounter.fallSpeed * delta);
      if (encounter.fallY === BASEMENT.floor) { actor.status = 'dead'; actor.health = 0; }
    }
    if (['searching', 'lifting', 'hatch_ready'].includes(encounter.phase) && delta > 0) {
      encounter.gas += delta;
      const density = basementGasDensity(actor.position.x - center.x, actor.position.z - center.z, encounter.gas);
      encounter.air = Math.max(0, encounter.air - density * (input.crouch ? .8 : 4) * delta);
      if (encounter.air === 0) { encounter.phase = 'failed'; encounter.failure = 'gas'; actor.health = 0; actor.status = 'dead'; }
      else {
        const guide = this.world.agents.get('trinity')!, gap = Math.hypot(actor.position.x - guide.position.x, actor.position.z - guide.position.z);
        for (const role of ['trinity', 'apoc', 'switch', 'cypher'] as const) {
          const goal = basementRouteLength(role), progress = encounter.company[role];
          const lead = role === 'trinity' || encounter.company.trinity >= basementRouteLength('trinity') - .001 ? goal : Math.min(goal, Math.max(12, encounter.company.trinity + goal - basementRouteLength('trinity') - ({ apoc: 4, switch: 8, cypher: 12 } as const)[role]));
          if (role === 'cypher' && encounter.separated || role === 'trinity' && gap > 12 || lead <= progress) continue;
          const next = Math.min(lead, progress + BASEMENT.guideSpeed * delta), root = basementRouteRoot(role, next);
          const before = this.world.agents.get(role)!.position, after = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
          if (!ambushCompanyBlocked(before, after, BASEMENT_ROLES.filter(other => other !== role).map(other => this.world.agents.get(other)!.position))) {
            encounter.company[role] = next; this.world.agents.get(role)!.position = after;
          }
        }
        if (encounter.phase === 'searching' && encounter.company.trinity >= basementRouteLength('trinity') - .001 && gap < 5) this.advance(1, actor, tick);
        if (encounter.phase === 'lifting') {
          encounter.elapsed = Math.min(BASEMENT.liftSeconds, encounter.elapsed + delta); encounter.hatch = encounter.elapsed / BASEMENT.liftSeconds;
          if (encounter.elapsed >= BASEMENT.liftSeconds) { encounter.phase = 'hatch_ready'; encounter.separated = true; this.advance(2, actor, tick); }
        }
      }
    }
    if (encounter.phase === 'draining' && delta > 0) {
      encounter.elapsed += delta;
      if (BASEMENT_ROLES.filter(role => role !== 'cypher').every(role => basementDrainRoot(encounter, role).ended)) {
        encounter.phase = 'tunnel'; encounter.elapsed = 0; encounter.checkpoint = 'tunnel'; encounter.tunnel = 0;
        actor.position = { x: center.x + BASEMENT.grate.x, y: center.y + BASEMENT.tunnelFloor, z: center.z + BASEMENT.grate.z }; actor.rotation = 0;
        this.advance(3, actor, tick);
      }
    }
    if (encounter.phase === 'tunnel' && delta > 0) {
      const magnitude = Math.max(1, Math.hypot(input.x ?? 0, input.z ?? 0)), before = actor.position;
      const after = { x: before.x + (input.x ?? 0) / magnitude * 3.1 * delta, y: center.y + BASEMENT.tunnelFloor, z: before.z + (input.z ?? 0) / magnitude * 3.1 * delta };
      if (!playerBlocked(after, true, .65, this.sandbox().structures) && !ambushCompanyBlocked(before, after, ['trinity', 'apoc', 'switch'].map(role => this.world.agents.get(role)!.position))) actor.position = after;
      actor.rotation = input.yaw ?? actor.rotation; encounter.tunnel = basementTunnelProgress(actor.position.x - center.x, actor.position.z - center.z);
      if (encounter.tunnel >= BASEMENT_TUNNEL_LENGTH - .5) { encounter.phase = 'done'; this.advance(4, actor, tick); }
    }
    this.stage(encounter, delta, tick, Boolean(input.crouch), previous);
    this.journey!.checkpoint = { ...actor.position }; this.journey!.lastText = basementText(encounter);
    return basementLocked(this.journey);
  }
  private tvFrame(actor: AgentState, dt: number, tick: number): boolean {
    const encounter = this.journey!.tvExit!, center = FILM_SETS.film_tv_repair.center;
    encounter.paused = this.occupied();
    const cypher = this.world.agents.get('cypher')!;
    if (!cypher.controller) {
      const deck = FILM_SETS.film_neb_deck.center, root = BETRAYAL.deckRoots.cypher;
      cypher.position = { x: deck.x + root.x, y: deck.y, z: deck.z + root.z }; cypher.rotation = root.yaw;
      cypher.currentLocation = 'film_neb_deck'; cypher.isInMatrix = false; cypher.velocity = { x: 0, y: 0, z: 0 };
      cypher.targetPosition = null; cypher.currentPath = [];
      cypher.currentAction = { type: 'idle', parameters: { resolved: true }, startedAt: tick, duration: 1e9, progress: 0 };
    }
    const delta = encounter.paused || !actor.controller || actor.status !== 'alive' ? 0 : Math.max(0, Math.min(.1, dt));
    const x = actor.position.x - center.x, z = actor.position.z - center.z;
    tvExitStreetFrame(encounter, x, z, encounter.phase === 'ready' ? delta : 0);
    if (encounter.phase === 'ready' && delta > 0) {
      if (this.journey!.step === 0 && tvExitEntered(x, z)) this.advance(0, actor, tick);
      else if (this.journey!.step === 1 && Math.hypot(x - TV_EXIT.approach.x, z - TV_EXIT.approach.z) < 1.2) this.advance(1, actor, tick);
    }
    if (['pickup', 'calling'].includes(encounter.phase)) encounter.elapsed += delta;
    if (encounter.phase === 'pickup' && encounter.elapsed >= TV_EXIT.pickupSeconds) { encounter.phase = 'line_dead'; encounter.elapsed = 0; this.advance(2, actor, tick); }
    else if (encounter.phase === 'calling' && encounter.elapsed >= TV_EXIT.callSeconds) { encounter.phase = 'done'; this.advance(3, actor, tick); }
    if (encounter.start && !['ready', 'done'].includes(encounter.phase)) {
      const root = tvExitRoot(encounter), before = actor.position;
      actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; actor.rotation = root.yaw;
      actor.velocity = delta ? { x: (actor.position.x - before.x) / delta, y: 0, z: (actor.position.z - before.z) / delta } : { x: 0, y: 0, z: 0 };
    }
    for (const role of ['neo', 'trinity', 'apoc', 'switch'] as const) {
      const other = this.world.agents.get(role)!; if (role !== 'neo' && other.controller) continue;
      other.targetPosition = null; other.currentPath = [];
      if (role !== 'neo') {
        const before = other.position, root = tvExitStreetRoot(role, encounter.street![role]);
        other.position = { x: center.x + root.x, y: center.y, z: center.z + root.z }; other.rotation = root.yaw;
        other.velocity = delta ? { x: (other.position.x - before.x) / delta, y: 0, z: (other.position.z - before.z) / delta } : { x: 0, y: 0, z: 0 };
      }
      const calling = role === 'trinity' && encounter.phase === 'calling';
      other.currentAction = { type: 'idle', parameters: { resolved: true, tvExit: ['neo', 'trinity'].includes(role) ? { ...encounter, role } : undefined,
        phone: calling ? { phase: 'connected', slide: 1, elapsed: encounter.elapsed } : undefined }, startedAt: tick, duration: 1e9, progress: 0 };
    }
    this.journey!.checkpoint = { ...actor.position }; this.journey!.lastText = tvExitText(encounter, this.journey!.step); return tvExitLocked(this.journey);
  }
  command(actor: AgentState, target: string, tick: number): string {
    if (this.crosscut.active(actor)) return this.crosscut.command(actor, target, tick);
    if (this.occupied()) { this.frame(actor, {}, 0, tick); return this.journey!.lastText; }
    if (this.journey!.scene === 'm1_tv_exit') {
      const encounter = this.journey!.tvExit!, center = FILM_SETS.film_tv_repair.center;
      if (target === 'act' && encounter.phase === 'ready' && this.journey!.step === 2) {
        if (Math.hypot(actor.position.x - center.x - TV_EXIT.approach.x, actor.position.z - center.z - TV_EXIT.approach.z) >= 1.2) return '走近后墙的硬线电话，再亲手拿起听筒。';
        tvExitStreetFrame(encounter, actor.position.x - center.x, actor.position.z - center.z, 0);
        for (const role of TV_EXIT_STREET_ROLES) encounter.street![role] = tvExitStreetRouteLength(role);
        encounter.start = { x: actor.position.x - center.x, y: actor.position.y - center.y, z: actor.position.z - center.z, yaw: actor.rotation };
        encounter.phase = 'pickup'; encounter.elapsed = 0;
      } else if (target === 'act' && encounter.phase === 'line_dead') { encounter.phase = 'calling'; encounter.elapsed = 0; }
    } else {
      const encounter = this.journey!.basement!, center = FILM_SETS.film_ambush_house.center;
      if (target === 'retry' && encounter.phase === 'failed') {
        encounter.attempts++; delete encounter.failure; delete encounter.fallY; delete encounter.fallSpeed;
        encounter.elapsed = 0; encounter.air = 100; encounter.gas = 0; encounter.hatch = 0; encounter.separated = false; encounter.paused = false;
        actor.health = actor.maxHealth; actor.status = 'alive'; actor.activeEffects = [];
        if (encounter.checkpoint === 'shaft') { encounter.phase = 'ready'; encounter.landings = {}; for (const role of BASEMENT_ROLES) encounter.heights[role] = encounter.starts[role].y; this.journey!.step = 0; }
        else { encounter.phase = 'searching'; for (const role of BASEMENT_ROLES) encounter.company[role] = 0; const root = BASEMENT.landing.neo; actor.position = { x: center.x + root.x, y: center.y + BASEMENT.floor, z: center.z + root.z }; this.journey!.step = 1; }
      } else if (target === 'act' && encounter.phase === 'ready') { encounter.phase = 'descending'; encounter.elapsed = 0; }
      else if (target === 'act' && encounter.phase === 'searching' && this.journey!.step === 2) {
        if (Math.hypot(actor.position.x - center.x - BASEMENT.approach.x, actor.position.z - center.z - BASEMENT.approach.z) > 4) return '靠近集水口，再请 Trinity 打开格栅。';
        encounter.phase = 'lifting'; encounter.elapsed = 0;
      }
      else if (target === 'act' && encounter.phase === 'hatch_ready') {
        if (Math.hypot(actor.position.x - center.x - BASEMENT.approach.x, actor.position.z - center.z - BASEMENT.approach.z) > 1.2) return '回到集水口前的扶手，再按 G 下到排水道。';
        if (['apoc', 'switch'].some(role => encounter.company[role as BasementRole] < basementRouteLength(role as BasementRole) - .05)) return 'Apoc 与 Switch 还在锅炉后面，留出通道等他们靠近。';
        encounter.drainStarts = Object.fromEntries(BASEMENT_ROLES.map(role => {
          const other = this.world.agents.get(role)!; return [role, { x: other.position.x - center.x, y: other.position.y - center.y, z: other.position.z - center.z, yaw: other.rotation }];
        })) as BasementEncounter['drainStarts'];
        encounter.phase = 'draining'; encounter.elapsed = 0;
      }
    }
    this.frame(actor, {}, 0, tick); return this.journey!.lastText;
  }
}
