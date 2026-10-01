import { BETRAYAL, CONNECTED_ROLES, CROSSCUT, CROSSCUT_ROLES, FILM_SETS, TV_EXIT, TV_EXIT_STREET_ROLES, crosscutActive, crosscutDeckRoot, crosscutLocked,
  crosscutText, crosscutTrinityRoot, crosscutView, tvExitEntered, tvExitRoot, tvExitStreetFrame, tvExitStreetRoot, tvExitStreetRouteLength,
  type AgentState, type CombatImpact, type CrosscutRole,
  type CypherCrosscut, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

/** The saved clock drives the physical ship and its still-connected Matrix avatars. */
export class CypherBetrayalSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  onHandoff?: (actor: AgentState, id: string, tick: number) => boolean;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife!.journey!; }
  active(actor: AgentState): boolean { const journey = this.sandbox().neoLife?.journey; return crosscutActive(journey) && journey!.actor === actor.id; }
  private occupied(): boolean { return CROSSCUT_ROLES.some(id => id !== this.journey.actor && this.world.agents.get(id)?.controller); }
  start(): void {
    const tank = this.world.agents.get('tank')!;
    this.journey.tvExit!.crosscut = { phase: 'phone', elapsed: 0, view: 'matrix', attempts: 0, tankHealth: tank.health,
      tankHit: false, dozerDead: false, apocDead: false, switchDead: false, cypherDead: false, trinityOut: false, neoOut: false };
  }
  startCounter(tick: number): void {
    const cut = this.journey.tvExit!.crosscut!;
    cut.phase = 'counter_ready'; cut.elapsed = 0; cut.view = 'ship';
    this.journey.betrayal = { kind: 'unplugged', phase: 'ready', elapsed: 0, attempt: cut.attempts, rescued: 0 };
    this.journey.step = 1;
    this.frame(this.world.agents.get('tank')!, 0, tick);
  }
  private switchView(view: CypherCrosscut['view'], tick: number): boolean {
    const cut = this.journey.tvExit!.crosscut!, id = view === 'ship' ? 'tank' : 'neo';
    if (this.journey.actor === id) { cut.view = view; return true; }
    const from = this.world.agents.get(this.journey.actor)!, old = this.journey.actor;
    this.journey.actor = id; cut.view = view;
    if (this.onHandoff?.(from, id, tick)) return true;
    this.journey.actor = old; cut.view = old === 'tank' ? 'ship' : 'matrix'; return false;
  }
  private death(id: CrosscutRole): void {
    const actor = this.world.agents.get(id)!;
    actor.health = 0; actor.status = 'dead'; actor.velocity = { x: 0, y: 0, z: 0 };
  }
  private shot(target: 'tank' | 'dozer' | 'cypher', damage: number, tick: number): void {
    const actor = this.world.agents.get(target)!, source = target === 'cypher' ? 'tank' : 'cypher';
    this.onImpact?.({ source, target, position: { ...actor.position, y: actor.position.y + 2 }, direction: { x: 0, y: 0, z: 1 },
      damage, combo: 0, matrix: false, downed: actor.status === 'dead', shot: { from: { ...this.world.agents.get(source)!.position, y: actor.position.y + 3 }, surface: 'body' } }, tick);
  }
  private stage(dt: number, tick: number): void {
    const journey = this.journey, tv = journey.tvExit!, cut = tv.crosscut!, shop = FILM_SETS.film_tv_repair.center, deck = FILM_SETS.film_neb_deck.center;
    for (const role of CROSSCUT_ROLES) {
      const actor = this.world.agents.get(role)!; if (role !== journey.actor && actor.controller) continue;
      if (role === 'tank' && cut.tankHit && actor.status === 'alive') actor.health = Math.min(actor.health, cut.tankHealth);
      const before = actor.position;
      const connected = (CONNECTED_ROLES as readonly string[]).includes(role), out = role === 'neo' && cut.neoOut || role === 'trinity' && cut.trinityOut;
      if (!connected || out) {
        const root = crosscutDeckRoot(cut, role);
        actor.position = { x: deck.x + root.x, y: deck.y, z: deck.z + root.z }; actor.rotation = root.yaw;
        actor.currentLocation = 'film_neb_deck'; actor.isInMatrix = false;
      } else if (role === 'neo' && (['assault', 'call'].includes(cut.phase) || cut.phase === 'phone' && tv.phase === 'pickup' || cut.phase === 'neo_exit')) {
        const root = tvExitRoot({ ...tv, phase: cut.phase === 'phone' || cut.phase === 'neo_exit' ? 'pickup' : 'line_dead', elapsed: cut.elapsed });
        actor.position = { x: shop.x + root.x, y: shop.y + root.y, z: shop.z + root.z }; actor.rotation = root.yaw;
      } else if (role === 'trinity' && cut.phase === 'trinity_exit') {
        const root = crosscutTrinityRoot(cut);
        actor.position = { x: shop.x + root.x, y: shop.y + root.y, z: shop.z + root.z }; actor.rotation = root.yaw;
      } else if ((TV_EXIT_STREET_ROLES as readonly string[]).includes(role) && tv.street) {
        const streetRole = role as typeof TV_EXIT_STREET_ROLES[number], root = tvExitStreetRoot(streetRole, tv.street[streetRole]);
        actor.position = { x: shop.x + root.x, y: shop.y + root.y, z: shop.z + root.z }; actor.rotation = root.yaw;
      }
      if (connected && !out) { actor.currentLocation = 'film_tv_repair'; actor.isInMatrix = true; }
      actor.velocity = dt ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.targetPosition = null; actor.currentPath = [];
      const dead = role === 'apoc' && cut.apocDead || role === 'switch' && cut.switchDead || role === 'dozer' && cut.dozerDead || role === 'cypher' && cut.cypherDead;
      const fall = dead ? cut.phase === 'call' && (role === 'apoc' || role === 'switch') ? Math.max(0, cut.elapsed - (role === 'apoc' ? CROSSCUT.apocPull : CROSSCUT.switchPull))
        : cut.phase === 'assault' && role === 'dozer' ? Math.max(0, cut.elapsed - CROSSCUT.dozerShot)
          : cut.phase === 'countering' && role === 'cypher' ? Math.max(0, cut.elapsed - 2.2) : 4
        : role === 'tank' && cut.tankHit ? cut.phase === 'assault' ? Math.max(0, cut.elapsed - CROSSCUT.tankShot) : 4 : 0;
      let hardline;
      if (role === 'neo' && (cut.phase === 'phone' && tv.phase === 'pickup' || cut.phase === 'neo_exit')) hardline = { phase: 'pickup' as const, elapsed: cut.elapsed, role: 'neo' as const };
      else if (role === 'neo' && cut.phase === 'assault') hardline = { phase: 'line_dead' as const, elapsed: 0, role: 'neo' as const };
      else if (role === 'neo' && cut.phase === 'call' && tv.phase === 'line_dead') hardline = { phase: 'line_dead' as const, elapsed: 0, role: 'neo' as const };
      else if (role === 'neo' && cut.phase === 'call' && cut.elapsed < 6.6) hardline = { phase: 'calling' as const, elapsed: cut.elapsed, role: 'neo' as const };
      else if (role === 'trinity' && cut.phase === 'trinity_exit' && cut.elapsed >= 2) hardline = { phase: 'pickup' as const, elapsed: cut.elapsed - 2, role: 'trinity' as const };
      actor.currentAction = { type: 'idle', parameters: { resolved: true, crosscut: { ...cut, role, fall, body: Boolean(connected && out) },
        seated: Boolean(out), armed: role === 'cypher' && cut.phase === 'assault' || role === 'tank' && cut.phase === 'countering',
        tvExit: hardline, phone: role === 'trinity' && cut.phase === 'call' && tv.phase === 'calling' ? { phase: 'connected', slide: 1, elapsed: cut.elapsed } : undefined },
        startedAt: tick, duration: 1e9, progress: 0 };
    }
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey, tv = journey.tvExit!, cut = tv.crosscut!;
    tv.paused = this.occupied();
    const delta = tv.paused || !actor.controller || actor.status !== 'alive' ? 0 : Math.max(0, Math.min(.1, dt));
    const previous = cut.elapsed;
    const timed = cut.phase === 'phone' && tv.phase === 'pickup' || cut.phase === 'call' && tv.phase === 'calling'
      || ['assault', 'aiming', 'window', 'countering', 'trinity_exit', 'neo_exit'].includes(cut.phase);
    if (timed) cut.elapsed += delta;
    if (journey.scene === 'm1_tv_exit' && cut.phase === 'phone' && tv.phase === 'ready') {
      const neo = this.world.agents.get('neo')!, center = FILM_SETS.film_tv_repair.center;
      tvExitStreetFrame(tv, neo.position.x - center.x, neo.position.z - center.z, delta);
    }
    if (delta > 0) {
      if (cut.phase === 'phone' && tv.phase === 'ready') {
        const center = FILM_SETS.film_tv_repair.center, x = actor.position.x - center.x, z = actor.position.z - center.z;
        if (journey.step === 0 && tvExitEntered(x, z)) this.onAdvance?.('Neo 与同伴穿过白昼街道，走进 Franklin 与 Erie 的店门。', actor, tick);
        else if (journey.step === 1 && this.phoneNear(actor)) this.onAdvance?.('Neo 穿过维修柜台，抵达后墙硬线电话。', actor, tick);
      } else if (cut.phase === 'phone' && tv.phase === 'pickup' && cut.elapsed >= CROSSCUT.pickup) {
        cut.phase = 'assault'; cut.elapsed = 0; this.switchView('ship', tick);
      } else if (cut.phase === 'assault') {
        if (!cut.tankHit && cut.elapsed >= CROSSCUT.tankShot) {
          cut.tankHit = true; const tank = this.world.agents.get('tank')!;
          cut.tankHealth = Math.max(1, Math.min(tank.health, tank.maxHealth * .4)); const damage = tank.health - cut.tankHealth; tank.health = cut.tankHealth; this.shot('tank', damage, tick);
        }
        if (!cut.dozerDead && cut.elapsed >= CROSSCUT.dozerShot) { cut.dozerDead = true; this.death('dozer'); this.shot('dozer', 100, tick); }
        if (cut.elapsed >= CROSSCUT.assault) {
          cut.phase = 'call'; cut.elapsed = 0; tv.phase = 'line_dead'; this.switchView('matrix', tick);
          if (journey.step === 2) this.onAdvance?.('飞船袭击令硬线无人应答，Neo 仍在矩阵。', this.world.agents.get('neo')!, tick);
        }
      } else if (cut.phase === 'call' && tv.phase === 'calling') {
        if (!cut.apocDead && cut.elapsed >= CROSSCUT.apocPull) { cut.apocDead = true; this.death('apoc'); }
        if (!cut.switchDead && cut.elapsed >= CROSSCUT.switchPull) { cut.switchDead = true; this.death('switch'); }
        this.switchView(crosscutView(cut), tick);
        if (cut.elapsed >= CROSSCUT.call) { cut.elapsed = CROSSCUT.call; tv.phase = 'done'; if (journey.step === 3) this.onAdvance?.('Cypher 威胁最后两条接线。Tank 仍有意识。', this.world.agents.get('neo')!, tick); }
      } else if (cut.phase === 'aiming' && cut.elapsed >= BETRAYAL.unplugged.aiming) { cut.phase = 'window'; cut.elapsed = 0; }
      else if (cut.phase === 'window' && cut.elapsed >= BETRAYAL.unplugged.window) { cut.phase = 'failed'; this.death('tank'); this.shot('tank', cut.tankHealth, tick); }
      else if (cut.phase === 'countering') {
        if (!cut.cypherDead && cut.elapsed >= 2.2) { cut.cypherDead = true; this.death('cypher'); this.shot('cypher', 100, tick); }
        if (cut.elapsed >= BETRAYAL.unplugged.countering) { cut.phase = 'return'; cut.elapsed = 0; this.sandbox().neoLife!.choices.cypher_stopped = 'tank'; }
      } else if (cut.phase === 'trinity_exit' && cut.elapsed >= CROSSCUT.exit) { cut.trinityOut = true; cut.phase = 'neo_ready'; cut.elapsed = 0; }
      else if (cut.phase === 'neo_exit' && cut.elapsed >= CROSSCUT.exit) {
        cut.neoOut = true; cut.phase = 'done'; cut.elapsed = 0; cut.view = 'ship';
        this.stage(0, tick); this.onAdvance?.('Trinity 先接出，Neo 随后回到现实；伤亡保留。', this.world.agents.get('neo')!, tick);
      }
    }
    tv.elapsed = cut.elapsed;
    if (journey.scene === 'm1_unplugged' && journey.betrayal) {
      const betrayal = journey.betrayal;
      betrayal.phase = cut.phase === 'counter_ready' ? 'ready' : ['return', 'trinity_ready', 'trinity_exit', 'neo_ready', 'neo_exit'].includes(cut.phase) ? 'reconnect'
        : cut.phase as 'aiming' | 'window' | 'failed' | 'countering' | 'done';
      betrayal.elapsed = cut.elapsed; betrayal.attempt = cut.attempts; betrayal.rescued = cut.neoOut ? 2 : cut.trinityOut ? 1 : 0;
    }
    this.stage(delta > 0 && cut.elapsed >= previous ? delta : 0, tick);
    journey.checkpoint = { ...this.world.agents.get(journey.actor)!.position }; journey.lastText = crosscutText(journey);
    return crosscutLocked(journey);
  }
  private phoneNear(actor: AgentState): boolean { const c = FILM_SETS.film_tv_repair.center; return Math.hypot(actor.position.x - c.x - TV_EXIT.approach.x, actor.position.z - c.z - TV_EXIT.approach.z) < 1.2; }
  command(actor: AgentState, target: string, tick: number): string {
    const journey = this.journey, tv = journey.tvExit!, cut = tv.crosscut!;
    if (this.occupied()) { this.frame(actor, 0, tick); return journey.lastText; }
    if (target === 'retry' && cut.phase === 'failed') {
      actor.status = 'alive'; actor.health = cut.tankHealth; actor.activeEffects = [];
      cut.phase = 'counter_ready'; cut.elapsed = 0; cut.attempts++;
    } else if (target === 'act') {
      if (cut.phase === 'phone' && tv.phase === 'ready' && journey.step === 2 && this.phoneNear(actor)) {
        const center = FILM_SETS.film_tv_repair.center;
        tvExitStreetFrame(tv, actor.position.x - center.x, actor.position.z - center.z, 0);
        for (const role of TV_EXIT_STREET_ROLES) tv.street![role] = tvExitStreetRouteLength(role);
        tv.start = { x: actor.position.x - center.x, y: actor.position.y - center.y, z: actor.position.z - center.z, yaw: actor.rotation };
        tv.phase = 'pickup'; cut.elapsed = 0;
      } else if (cut.phase === 'call' && tv.phase === 'line_dead') { tv.phase = 'calling'; cut.elapsed = 0; }
      else if (cut.phase === 'counter_ready') { cut.phase = 'aiming'; cut.elapsed = 0; }
      else if (cut.phase === 'window') { cut.phase = 'countering'; cut.elapsed = 0; }
      else if (cut.phase === 'return') { cut.phase = 'trinity_ready'; cut.elapsed = 0; this.switchView('matrix', tick); }
      else if (cut.phase === 'trinity_ready') {
        const c = FILM_SETS.film_tv_repair.center;
        if (Math.hypot(actor.position.x - c.x - TV_EXIT.approach.x, actor.position.z - c.z - TV_EXIT.approach.z) < 2) return '先离开听筒前的通道，给 Trinity 留出接出位置。';
        const trinity = this.world.agents.get('trinity')!;
        cut.trinityStart = { x: trinity.position.x - c.x, y: trinity.position.y - c.y, z: trinity.position.z - c.z, yaw: trinity.rotation };
        cut.phase = 'trinity_exit'; cut.elapsed = 0;
      } else if (cut.phase === 'neo_ready' && this.phoneNear(actor)) {
        const c = FILM_SETS.film_tv_repair.center; tv.start = { x: actor.position.x - c.x, y: actor.position.y - c.y, z: actor.position.z - c.z, yaw: actor.rotation };
        cut.phase = 'neo_exit'; cut.elapsed = 0;
      }
    }
    this.frame(this.world.agents.get(journey.actor)!, 0, tick); return journey.lastText;
  }
}
