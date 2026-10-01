import { FILM_SETS, FILM_SCENE_BY_ID, SIXTH, SIXTH_ROOM, SIXTH_ROLES, WETWALL_ROLES, WETWALL_SHAFT, wetwallEntry, sixthPose, sixthText,
  type AgentState, type CombatImpact, type PlayerInput, type SandboxState, type SixthEncounter, type SixthRole, type Vector3 } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

/** Room 608 shares the pipe checkpoint; the police, replacement and breach never reset the crew upstairs. */
export class SixthFloorSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return Boolean(this.journey?.scene === 'm1_wall_exposed' && !this.journey.visiting && this.journey.actor === actor.id); }
  start(): void {
    const center = FILM_SETS.film_ambush_house.center;
    const starts = Object.fromEntries(SIXTH_ROLES.map(role => {
      const actor = this.world.agents.get(role)!;
      return [role, WETWALL_ROLES.includes(role as typeof WETWALL_ROLES[number])
        ? { x: actor.position.x - center.x, y: actor.position.y - center.y, z: actor.position.z - center.z, yaw: actor.rotation }
        : { x: role === 'citizen_14' ? -20 : -17.5, y: WETWALL_SHAFT.sixth, z: role === 'citizen_14' ? -17.7 : -20.6, yaw: Math.PI }];
    })) as SixthEncounter['starts'];
    this.journey!.wallExposure = { phase: 'ready', elapsed: 0, attempts: 0, shots: 0, ammo: 12, cooldown: 0, nextShot: .9, covered: false, cover: 0, aim: 0, starts };
    this.frame(this.world.agents.get(this.journey!.actor)!, { crouch: false, yaw: 0 }, 0, this.world.simulationTick);
  }
  private occupied(): boolean { return SIXTH_ROLES.some(role => role !== 'neo' && this.world.agents.get(role)?.controller); }
  seal(): void {
    const journey = this.journey, encounter = journey?.wallExposure;
    this.sandbox().structures = this.sandbox().structures.filter(item => item.id !== 'film:sixth:panel');
    if (!journey || journey.visiting || !encounter || journey.scene !== 'm1_wall_exposed' || ['breach', 'done'].includes(encounter.phase)) return;
    const center = FILM_SETS.film_ambush_house.center;
    this.sandbox().structures.push({ id: 'film:sixth:panel', kind: 'barricade', owner: 'matrix', matrix: true, health: 999,
      position: { x: center.x + SIXTH_ROOM.breachX, y: center.y + WETWALL_SHAFT.sixth, z: center.z + WETWALL_SHAFT.front },
      film: { scene: 'm1_wall_exposed', width: SIXTH_ROOM.breachWidth, depth: .24, height: SIXTH_ROOM.breachHeight } });
  }
  private stage(encounter: SixthEncounter, dt: number, tick: number): void {
    const center = FILM_SETS.film_ambush_house.center, wall = this.journey!.wetwall;
    for (const role of SIXTH_ROLES) {
      const actor = this.world.agents.get(role)!; if (role !== 'neo' && actor.controller) continue;
      const gesture = { role, phase: encounter.phase, elapsed: encounter.elapsed, start: encounter.starts[role], covered: encounter.covered, cover: encounter.cover, aim: encounter.aim, paused: encounter.paused };
      const root = sixthPose(gesture), before = actor.position;
      actor.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }; actor.rotation = root.yaw;
      actor.velocity = dt ? { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.currentLocation = 'film_ambush_house'; actor.isInMatrix = true; actor.targetPosition = null; actor.currentPath = [];
      const pipeRole = role as typeof WETWALL_ROLES[number];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, armed: root.armed, weaponStyle: role === 'neo' ? 'hel_pistol' : 'rifle',
        sixth: gesture, wetwall: root.hanging && wall ? { role: pipeRole, phase: 'done', elapsed: 0, start: wall.starts[pipeRole], entry: wetwallEntry(wall, pipeRole),
          progress: wetwallEntry(wall, pipeRole) + WETWALL_SHAFT.top - root.y, hanging: true, freed: true } : undefined }, startedAt: tick, duration: 1e9, progress: 0 };
    }
  }
  private shot(source: 'citizen_4' | 'neo', target: Vector3, damage: number, tick: number, body = false): void {
    const from = { ...this.world.agents.get(source)!.position }; from.y += 2.5;
    const length = Math.hypot(target.x - from.x, target.y - from.y, target.z - from.z);
    this.onImpact?.({ source, target: body ? 'neo' : 'sixth-wall', position: target, direction: { x: (target.x - from.x) / length, y: (target.y - from.y) / length, z: (target.z - from.z) / length },
      damage, combo: 0, matrix: true, downed: body && this.world.agents.get('neo')!.health <= 0, shot: { from, surface: body ? 'body' : 'stone' } }, tick);
  }
  frame(actor: AgentState, input: Pick<PlayerInput, 'crouch' | 'yaw'>, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const encounter = this.journey!.wallExposure!, center = FILM_SETS.film_ambush_house.center;
    encounter.paused = this.occupied();
    const delta = encounter.paused || !actor.controller || actor.status !== 'alive' ? 0 : Math.max(0, Math.min(.1, dt));
    if (!['ready', 'failed', 'done'].includes(encounter.phase)) encounter.elapsed += delta;
    encounter.cooldown = Math.max(0, encounter.cooldown - delta);
    if (encounter.phase === 'firing' && delta > 0) {
      encounter.aim = input.yaw; encounter.cover += Math.sign((input.crouch ? 1 : 0) - encounter.cover) * Math.min(Math.abs((input.crouch ? 1 : 0) - encounter.cover), delta * 4);
      encounter.covered = encounter.cover >= .85;
      if (encounter.elapsed >= encounter.nextShot) {
        encounter.nextShot += SIXTH.incomingInterval;
        if (!encounter.covered) { actor.health = Math.max(0, actor.health - 35); if (actor.health === 0) { actor.status = 'dead'; encounter.phase = 'failed'; } }
        this.shot('citizen_4', { x: center.x - 15.5, y: actor.position.y + 2.4, z: encounter.covered ? center.z + WETWALL_SHAFT.front : actor.position.z }, encounter.covered ? 0 : 35, tick, !encounter.covered);
      }
    }
    if (encounter.phase === 'searching' && encounter.elapsed >= SIXTH.searchSeconds) {
      encounter.phase = 'firing'; encounter.elapsed = 0; encounter.nextShot = .9;
      this.onAdvance?.(FILM_SCENE_BY_ID.m1_wall_exposed.steps[0].text!, actor, tick);
      this.shot('citizen_4', { x: center.x - 15.5, y: actor.position.y + 2.4, z: center.z + WETWALL_SHAFT.front }, 0, tick);
    } else if (encounter.phase === 'cover' && encounter.elapsed >= SIXTH.coverSeconds) {
      encounter.phase = 'replacing'; encounter.elapsed = 0;
    } else if (encounter.phase === 'replacing' && encounter.elapsed >= SIXTH.replacementSeconds) { encounter.phase = 'rushing'; encounter.elapsed = 0; }
    else if (encounter.phase === 'rushing' && encounter.elapsed >= SIXTH.rushSeconds) { encounter.phase = 'grapple'; encounter.elapsed = 0; }
    else if (encounter.phase === 'grapple' && encounter.elapsed >= SIXTH.grappleSeconds) { encounter.phase = 'breach'; encounter.elapsed = 0; }
    else if (encounter.phase === 'breach' && encounter.elapsed >= SIXTH.breachSeconds) {
      encounter.phase = 'done'; encounter.elapsed = SIXTH.breachSeconds;
      this.onAdvance?.(FILM_SCENE_BY_ID.m1_wall_exposed.steps[2].text!, actor, tick);
    }
    this.stage(encounter, delta, tick); this.seal(); this.journey!.checkpoint = { ...actor.position }; this.journey!.lastText = sixthText(encounter); return true;
  }
  handle(actor: AgentState, kind: string, yaw: number, pitch: number, tick: number): string | undefined {
    if (!this.active(actor) || kind !== 'shoot') return;
    const encounter = this.journey!.wallExposure!;
    if (this.occupied() || encounter.phase !== 'firing') return sixthText(encounter);
    if (encounter.cover > .2) return '先松开 Z，从灰泥后探回破口再还击。实心墙会挡住你的枪口。';
    if (encounter.cooldown > 0 || encounter.ammo === 0) return '';
    encounter.cooldown = SIXTH.fireInterval; encounter.ammo--; encounter.aim = yaw;
    const officer = this.world.agents.get('citizen_4')!, from = { ...actor.position, y: actor.position.y + 2.5 }, to = { ...officer.position, y: officer.position.y + 2.4 };
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, length = Math.hypot(dx, dy, dz);
    const hit = (dx * Math.sin(yaw) * Math.cos(pitch) - dy * Math.sin(pitch) + dz * Math.cos(yaw) * Math.cos(pitch)) / length > Math.cos(.22);
    this.shot('neo', hit ? to : { x: from.x + Math.sin(yaw) * 5, y: from.y - Math.sin(pitch) * 5, z: from.z + Math.cos(yaw) * 5 }, 0, tick);
    if (hit) {
      encounter.shots++; encounter.phase = 'cover'; encounter.elapsed = 0; encounter.cover = 0; encounter.covered = false;
      this.onAdvance?.(FILM_SCENE_BY_ID.m1_wall_exposed.steps[1].text!, actor, tick);
    } else if (encounter.ammo === 0) { encounter.phase = 'failed'; encounter.failure = 'ammo'; }
    this.frame(actor, { crouch: false, yaw }, 0, tick); return this.journey!.lastText;
  }
  command(actor: AgentState, target: string, tick: number): string {
    const encounter = this.journey!.wallExposure!;
    if (this.occupied()) { encounter.paused = true; return this.journey!.lastText = sixthText(encounter); }
    if (target === 'retry' && encounter.phase === 'failed') {
      encounter.phase = 'ready'; encounter.elapsed = 0; encounter.attempts++; encounter.shots = 0; encounter.ammo = 12; encounter.cooldown = 0; encounter.cover = 0; encounter.covered = false;
      delete encounter.failure;
      actor.status = 'alive'; actor.health = actor.maxHealth; this.journey!.step = 0;
    } else if (target === 'act' && encounter.phase === 'ready') { encounter.phase = 'searching'; encounter.elapsed = 0; }
    this.frame(actor, { crouch: false, yaw: encounter.aim }, 0, tick); return this.journey!.lastText;
  }
}
