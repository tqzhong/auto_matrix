import { FILM_SCENE_BY_ID, FILM_SETS, NEB_CREW, NEB_ESCAPE, RELOADED_FINALE, filmPosition, nebHatchHeight,
  nebEscapeLocked, stepPlayer, type AgentState, type SandboxState, type NebCrewRole, type WorldStructure } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class NebEscapeSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return this.journey?.scene === 'm2_ship_lost' && !this.journey.visiting && this.journey.actor === actor.id; }
  seal(): void {
    const journey = this.journey, prefix = 'film:neb-escape:';
    const wanted: WorldStructure[] = [];
    if (journey?.scene === 'm2_ship_lost' && !journey.visiting) {
      wanted.push({ id: `${prefix}route`, kind: 'beacon', owner: 'matrix', position: { ...FILM_SETS.film_neb_deck.center }, matrix: false, health: 999 });
      if (!journey.shipLoss || nebHatchHeight(journey.shipLoss) < NEB_ESCAPE.hatch.closedY + NEB_ESCAPE.hatch.height - .01)
        wanted.push({ id: `${prefix}hatch`, kind: 'barricade', owner: 'matrix',
          position: { ...filmPosition('film_neb_deck', 0, NEB_ESCAPE.hatch.z), y: FILM_SETS.film_neb_deck.center.y + (journey.shipLoss ? nebHatchHeight(journey.shipLoss) : NEB_ESCAPE.hatch.closedY) - NEB_ESCAPE.hatch.height / 2 - 1.4 },
          matrix: false, health: 999,
          film: { scene: 'm2_ship_lost', width: NEB_ESCAPE.hatch.width, height: NEB_ESCAPE.hatch.height + 1.4, depth: NEB_ESCAPE.hatch.depth } });
      if (journey.shipLoss?.phase !== 'briefing') for (const id of NEB_CREW.filter(id => id !== journey.actor)) {
        const member = this.world.agents.get(id);
        if (member?.status === 'alive' && member.currentLocation === 'film_neb_deck' && !member.isInMatrix)
          wanted.push({ id: `${prefix}body:${id}`, kind: 'barricade', owner: id, position: { ...member.position }, matrix: false, health: 999,
            film: { scene: 'm2_ship_lost', width: 1.4, depth: 1.4, height: 4.4 } });
      }
    }
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith(prefix) || wanted.some(w => w.id === s.id));
    for (const structure of wanted) {
      const existing = this.sandbox().structures.find(s => s.id === structure.id);
      if (existing) existing.position = structure.position;
      else this.sandbox().structures.push(structure);
    }
  }
  private available(actor: AgentState): boolean {
    const loss = this.journey!.shipLoss!;
    const ids = NEB_CREW.filter(id => id !== actor.id), crew = ids.map(id => this.world.agents.get(id));
    loss.paused = crew.find(member => member?.controller)?.name;
    const missing = crew.findIndex(member => !member || member.status !== 'alive' || member.health <= 0);
    loss.unavailable = missing >= 0 ? crew[missing]?.name ?? ids[missing] : undefined;
    return Boolean(actor.controller && actor.status === 'alive' && actor.health > 0 && actor.currentLocation === 'film_neb_deck'
      && !actor.isInMatrix && !loss.paused && !loss.unavailable && crew.every(Boolean));
  }
  frame(actor: AgentState, dt: number, tick: number, yaw?: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, loss = journey.shipLoss;
    if (!loss) { this.seal(); return false; }
    // Completed pre-upgrade saves keep their completion and original controlled role.
    if (loss.phase === 'escaped' && journey.completed.includes(journey.scene)) journey.step = FILM_SCENE_BY_ID.m2_ship_lost.steps.length;
    this.seal();
    if (loss.phase === 'briefing' || loss.phase === 'escaped') return false;
    delete journey.started;
    const available = this.available(actor), elapsed = available ? Math.max(0, Math.min(.1, dt)) : 0;
    if (loss.paused || loss.unavailable) {
      journey.lastText = loss.paused ? `${loss.paused} 由其他玩家控制；撤离和炸弹停在当前一拍。` : `${loss.unavailable ?? '船员'} 无法参与撤离；不会移动死者或补回生命。`;
      return true;
    }
    if (loss.phase === 'evacuating') {
      loss.age = (loss.age ?? RELOADED_FINALE.evacuationSeconds - loss.remaining) + elapsed;
      this.seal();
      loss.crew ??= {};
      if (elapsed > 0) for (const id of NEB_CREW.filter(id => id !== actor.id)) this.moveCrew(id, actor, elapsed, tick);
      this.seal();
      const center = FILM_SETS.film_neb_deck.center;
      if (elapsed > 0 && actor.position.z - center.z >= NEB_ESCAPE.playerZ && Math.abs(actor.position.x - center.x) < NEB_ESCAPE.routeHalfWidth - 1.1
        && NEB_CREW.filter(id => id !== actor.id).every(id => this.world.agents.get(id)!.position.z - center.z >= NEB_ESCAPE.safeZ)) {
        loss.phase = 'destroying'; loss.elapsed = 0; actor.velocity = { x: 0, y: 0, z: 0 };
        journey.lastText = '全员已经离开船体。炸弹击中尼布甲尼撒号；回头看，爆炸正在吞没旧船。';
      }
      return nebEscapeLocked(loss);
    }
    for (const id of NEB_CREW) {
      const crew = this.world.agents.get(id);
      if (crew?.status === 'alive' && !crew.controller) { crew.velocity = { x: 0, y: 0, z: 0 }; crew.targetPosition = null;
        if (elapsed > 0 && (loss.phase === 'destroying' || loss.phase === 'mourning')) {
          const center = FILM_SETS.film_neb_deck.center, target = Math.atan2(center.x - crew.position.x, center.z + 25 - crew.position.z);
          const turn = Math.atan2(Math.sin(target - crew.rotation), Math.cos(target - crew.rotation));
          crew.rotation += turn * Math.min(1, elapsed * 4);
        }
        crew.currentAction = { type: 'move_to', parameters: { resolved: true, nebEscape: loss.phase }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 }; }
    }
    if (loss.phase === 'destroying') {
      if (elapsed > 0 && yaw !== undefined) actor.rotation = yaw;
      loss.elapsed = Math.min(NEB_ESCAPE.blastSeconds, (loss.elapsed ?? 0) + elapsed);
      if (loss.elapsed >= NEB_ESCAPE.blastSeconds - 1e-8) {
        loss.phase = 'mourning'; this.onAdvance?.('船体已经解体，火焰映在隧道里。Morpheus 面对失去的旧船与信念；走近他，按 G 听完，再继续逃亡。', actor, tick);
      }
    }
    return nebEscapeLocked(loss);
  }
  private moveCrew(id: NebCrewRole, actor: AgentState, dt: number, tick: number): void {
    const member = this.world.agents.get(id)!;
    if (member.status !== 'alive' || member.controller || (this.journey!.shipLoss!.age ?? 0) < NEB_ESCAPE.openingSeconds) return;
    const center = FILM_SETS.film_neb_deck.center, loss = this.journey!.shipLoss!;
    const destinations = { neo: { x: -3.5, z: 59 }, morpheus: { x: -3.5, z: 60 }, trinity: { x: 3.5, z: 60 }, link: { x: 0, z: 57 } };
    const lane = id === 'trinity' ? 3.7 : id === 'link' ? 1.1 : -1.5;
    const route = loss.crew![id] ??= { points: [{ x: member.position.x - center.x, z: member.position.z - center.z },
      { x: lane, z: Math.max(member.position.z - center.z, 15) }, { x: lane, z: 30 }, { x: lane, z: 47 }, destinations[id]], index: 1, yaw: member.rotation };
    let point = route.points[route.index];
    if (!point) { member.velocity = { x: 0, y: 0, z: 0 }; member.currentAction = null; return; }
    let dx = center.x + point.x - member.position.x, dz = center.z + point.z - member.position.z, gap = Math.hypot(dx, dz);
    if (gap < .3) { route.index++; point = route.points[route.index]; if (!point) { member.velocity = { x: 0, y: 0, z: 0 }; member.currentAction = null; return; }
      dx = center.x + point.x - member.position.x; dz = center.z + point.z - member.position.z; gap = Math.hypot(dx, dz); }
    // Each companion traverses the same physical opening as the player.
    const old = { ...member.position }, scale = Math.min(1, gap / (NEB_ESCAPE.crewSpeed * dt));
    const actorBody: WorldStructure = { id: 'film:neb-escape:player', kind: 'barricade', owner: actor.id,
      position: actor.position, matrix: false, health: 999, film: { scene: 'm2_ship_lost', width: 1.4, depth: 1.4, height: 4.4 } };
    const moved = stepPlayer(member.position, 0, { x: dx / gap * scale, z: dz / gap * scale, yaw: Math.atan2(dx, dz), jump: false, sprint: true, sequence: 0 }, dt,
      false, [...this.sandbox().structures.filter(s => s.id !== `film:neb-escape:body:${id}`), actorBody], undefined, NEB_ESCAPE.crewSpeed / 8.4);
    member.position = moved.position; member.rotation = route.yaw = Math.atan2(dx, dz);
    member.currentLocation = 'film_neb_deck'; member.isInMatrix = false; member.targetPosition = null;
    member.velocity = { x: (member.position.x - old.x) / dt, y: 0, z: (member.position.z - old.z) / dt };
    member.currentAction = { type: 'move_to', parameters: { resolved: true }, startedAt: this.journey!.enteredAt, duration: 1e9, progress: 0 };
  }
  tick(actor: AgentState | undefined, tick: number): void {
    const loss = this.journey?.shipLoss;
    if (this.journey?.scene !== 'm2_ship_lost' || this.journey.visiting || !loss) return;
    const elapsed = Math.max(0, tick - loss.lastTick) * .5; loss.lastTick = tick;
    if (loss.phase !== 'evacuating' || !actor || !this.available(actor)) return;
    loss.remaining = Math.max(0, loss.remaining - elapsed);
    if (loss.remaining === 0) { loss.phase = 'failed'; this.journey.lastText = '炸弹已命中，撤离未完成。J 从弃船检查点重试；已有伤势与伤亡保留。'; }
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor) || !this.journey!.shipLoss) return;
    this.frame(actor, 0, tick); const journey = this.journey!, loss = journey.shipLoss!;
    if (target === 'retry' && loss.phase === 'failed') {
      if (!this.available(actor)) return journey.lastText;
      for (const id of NEB_CREW.filter(id => id !== actor.id)) {
        const member = this.world.agents.get(id)!, route = loss.crew?.[id];
        if (route) { member.position = filmPosition('film_neb_deck', route.points[0].x, route.points[0].z); member.rotation = route.yaw; member.velocity = { x: 0, y: 0, z: 0 }; member.currentAction = null; }
      }
      journey.shipLoss = { phase: 'evacuating', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: tick, attempts: loss.attempts + 1, age: 0, elapsed: 0 };
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; this.seal();
      return journey.lastText = '回到弃船检查点。船员原有伤势和前序选择保留；等待舱门升起，再真正走出船体。';
    }
    if (target === 'act' && loss.phase === 'mourning') {
      if (!this.available(actor)) return journey.lastText;
      if (Math.hypot(actor.position.x - FILM_SETS.film_neb_deck.center.x, actor.position.z - FILM_SETS.film_neb_deck.center.z - NEB_ESCAPE.playerZ) > 4) return '回到同伴身旁，再按 G。';
      loss.phase = 'escaped'; this.onAdvance?.(FILM_SCENE_BY_ID.m2_ship_lost.steps[4].text!, actor, tick); return journey.lastText;
    }
    if (nebEscapeLocked(loss) || target === 'act' && journey.step === 3 || target === 'next' && loss.phase !== 'escaped') return journey.lastText;
  }
}
