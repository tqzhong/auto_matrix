import { FILM_SETS, SERAPH_DOOR, SERAPH_ORACLE, distance, filmPosition, seraphDoorActive, seraphDoorAnchor, seraphDoorAngle, seraphDoorLocked, seraphDoorSet, seraphDoorStance, seraphDoorText, seraphDoorZ,
  type AgentState, type FilmJourney, type SandboxState, type SeraphDoorBody, type SeraphDoorEncounter, type SeraphDoorGesture, type SeraphDoorScene } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export function savedSeraphDoorAction(journey: FilmJourney | undefined, actor: AgentState): boolean {
  const state = journey?.seraphDoor, action = actor.currentAction, gesture = action?.parameters.seraphDoor as SeraphDoorGesture | undefined;
  return Boolean(seraphDoorActive(journey) && state && gesture && gesture.role === actor.id && (actor.id === 'seraph' || seraphDoorLocked(state))
    && (action?.type === 'idle' || action?.type === 'move_to') && action.parameters.resolved === true && gesture.scene === state.scene && gesture.phase === state.phase
    && gesture.elapsed === state.elapsed && gesture.door === state.door && gesture.seraph.x === state.seraph.x && gesture.seraph.z === state.seraph.z && gesture.seraph.yaw === state.seraph.yaw);
}
export class SeraphDoorSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return seraphDoorActive(this.journey) && actor.id === this.journey!.actor; }
  private body(actor: AgentState): SeraphDoorBody { const c = FILM_SETS[seraphDoorSet(this.journey!.scene as SeraphDoorScene)].center; return { x: actor.position.x - c.x, z: actor.position.z - c.z, yaw: actor.rotation }; }
  private route(state: SeraphDoorEncounter): void {
    const guide = this.world.agents.get('seraph')!, c = FILM_SETS[seraphDoorSet(state.scene)].center;
    state.route = state.phase === 'following' ? [{ x: 2.5, z: SERAPH_ORACLE.hall.turn.z }] : [...guide.currentPath, ...(guide.targetPosition ? [guide.targetPosition] : [])].map(p => ({ x: p.x - c.x, z: p.z - c.z })).concat(seraphDoorStance(state.scene, 0)); state.cursor = 0;
  }
  private ensure(): SeraphDoorEncounter {
    const j = this.journey!;
    if (!j.seraphDoor) {
      j.seraphDoor = { scene: j.scene as SeraphDoorScene, phase: j.step >= 2 ? 'done' : j.scene === 'm2_backdoors' && j.step === 0 ? 'following' : j.started !== undefined ? 'approaching' : 'ready', elapsed: 0, door: j.step >= 2 ? 1 : 0,
        neo: this.body(this.world.agents.get(j.actor)!), seraph: this.body(this.world.agents.get('seraph')!), route: [], cursor: 0 }; this.route(j.seraphDoor);
    }
    delete j.started; return j.seraphDoor;
  }
  stage(): void { if (seraphDoorActive(this.journey)) this.ensure(); this.seal(); }
  clear(): void { for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.seraphDoor) actor.currentAction = null; this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== 'film:seraph:door'); }
  seal(): void {
    const j = this.journey, id = 'film:seraph:door';
    if (!j || j.visiting || !['m2_seraph','m2_backdoors'].includes(j.scene)) { this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== id); return; }
    const scene = j.scene as SeraphDoorScene, angle = seraphDoorAngle(j.seraphDoor?.door ?? (j.step >= 2 ? 1 : 0)), c = Math.cos(angle), s = Math.sin(angle), d = SERAPH_DOOR;
    const leaf = { id, kind: 'barricade' as const, owner: 'seraph', position: filmPosition(seraphDoorSet(scene), d.hingeX + d.width / 2 * c, seraphDoorZ(scene) - d.width / 2 * s), matrix: true, health: 1,
      film: { scene, width: Math.abs(c) * d.width + Math.abs(s) * d.depth, depth: Math.abs(s) * d.width + Math.abs(c) * d.depth, height: d.height } };
    const index = this.sandbox().structures.findIndex(s => s.id === id); if (index < 0) this.sandbox().structures.push(leaf); else this.sandbox().structures[index] = leaf;
  }
  private face(body: SeraphDoorBody, yaw: number, dt: number): boolean { const d = Math.atan2(Math.sin(yaw - body.yaw), Math.cos(yaw - body.yaw)); body.yaw += Math.max(-3.2 * dt, Math.min(3.2 * dt, d)); return Math.abs(d) < .02; }
  private move(body: SeraphDoorBody, target: { x: number; z: number }, speed: number, dt: number): boolean {
    const x = target.x - body.x, z = target.z - body.z, gap = Math.hypot(x, z), scale = Math.min(1, speed * dt / Math.max(gap, .001)); body.x += x * scale; body.z += z * scale;
    if (gap > .01) this.face(body, Math.atan2(x,z), dt); return gap <= speed * dt;
  }
  private phase(state: SeraphDoorEncounter, phase: SeraphDoorEncounter['phase']): void { state.phase = phase; state.elapsed = 0; }
  private actors(state: SeraphDoorEncounter, dt: number): void {
    for (const role of ['neo','seraph'] as const) {
      const actor = this.world.agents.get(role)!; if (role === 'neo' && !seraphDoorLocked(state)) continue;
      const before = actor.position, point = state[role]; actor.position = filmPosition(seraphDoorSet(state.scene), point.x, point.z); actor.rotation = point.yaw;
      actor.targetPosition = null; actor.currentPath = []; if (dt) actor.velocity = { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt };
      if (state.phase === 'done') actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: Math.hypot(actor.velocity.x,actor.velocity.z) > .01 ? 'move_to' : 'idle', parameters: { resolved: true, player: role === 'neo',
        seraphDoor: { scene: state.scene, phase: state.phase, elapsed: state.elapsed, door: state.door, seraph: { ...state.seraph }, role } }, startedAt: this.journey!.enteredAt, duration: 1e9, progress: 0 };
    }
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false; const j = this.journey!, state = this.ensure(); this.seal(); if (dt <= 0) return seraphDoorLocked(state); if (state.phase === 'done') return false;
    const guide = this.world.agents.get('seraph')!;
    if (guide.controller || guide.status !== 'alive' || guide.currentLocation !== seraphDoorSet(state.scene) || !guide.isInMatrix) { j.lastText = 'Seraph 目前无法参与；钥匙、门角和当前进度保留。'; return seraphDoorLocked(state); }
    dt = Math.min(.1, dt);
    if (!guide.currentAction?.parameters.seraphDoor) { state.seraph = this.body(guide); this.route(state); }
    if (!seraphDoorLocked(state)) state.neo = this.body(actor); else state.elapsed += dt;
    if (['following','ready','approaching'].includes(state.phase)) {
      const gap = Math.hypot(state.seraph.x - state.neo.x, state.seraph.z - state.neo.z), waiting = state.phase !== 'approaching' && state.seraph.z < state.neo.z && gap > SERAPH_DOOR.waitRange;
      if (!waiting && state.cursor < state.route.length && this.move(state.seraph, state.route[state.cursor], SERAPH_DOOR.speed, dt)) state.cursor++;
      if (state.phase === 'following' && state.cursor >= state.route.length && Math.hypot(state.neo.x - SERAPH_ORACLE.hall.turn.x, state.neo.z - SERAPH_ORACLE.hall.turn.z) <= 4) {
        this.phase(state,'ready'); state.route = [seraphDoorStance(state.scene,0)]; state.cursor = 0; this.onAdvance?.('两人已走过白色走廊。Seraph 走向尽头的锁，示意 Neo 在门旁等候。',actor,tick);
      } else if (state.phase === 'approaching') {
        const target = seraphDoorAnchor(state.scene), arrived = this.move(state.neo,target,4.2,dt), stance = seraphDoorStance(state.scene,0);
        const a = arrived && this.face(state.neo,Math.atan2(1.8-target.x,seraphDoorZ(state.scene)+.43-target.z),dt), b = state.cursor >= state.route.length && this.face(state.seraph,stance.yaw,dt);
        if (a && b) this.phase(state,'retrieving');
      }
    } else if (state.phase === 'opening') {
      state.door = Math.min(1,state.elapsed / SERAPH_DOOR.opening); state.seraph = seraphDoorStance(state.scene,state.door);
      if (state.door === 1) { this.phase(state,'done'); this.onAdvance?.('Seraph 用钥匙开锁、收回钥匙并实际推开门。可以跟他进入另一侧。',actor,tick); }
    } else {
      const phases = ['retrieving','inserting','unlocking','withdrawing','grasping'] as const, index = phases.indexOf(state.phase as typeof phases[number]);
      if (index >= 0 && state.elapsed >= SERAPH_DOOR[phases[index]]) this.phase(state,phases[index+1] ?? 'opening');
    }
    this.actors(state,dt); this.seal(); j.lastText = seraphDoorText(state);
    if (!seraphDoorLocked(state) && actor.currentAction?.parameters.seraphDoor) { actor.currentAction = null; actor.velocity = { x: 0,y: 0,z: 0 }; }
    return seraphDoorLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return; const j = this.journey!, guide = this.world.agents.get('seraph')!;
    if (target === 'next') {
      if (guide.controller || guide.status !== 'alive' || guide.currentLocation !== seraphDoorSet(j.scene as SeraphDoorScene) || !guide.isInMatrix) return 'Seraph 目前无法同行；已打开的门和当前进度保留。';
      return;
    }
    if (j.step >= 2) return; const state = this.ensure();
    if (target === 'retry') { actor.status = 'alive'; actor.health = actor.maxHealth;
      if (seraphDoorLocked(state)) { actor.position = filmPosition(seraphDoorSet(state.scene),state.neo.x,state.neo.z); actor.rotation = state.neo.yaw; }
      else { actor.position = { ...j.checkpoint }; state.neo = this.body(actor); actor.currentAction = null; } actor.velocity = { x: 0,y: 0,z: 0 }; return j.lastText = '已接回当前检查点；门的位置、钥匙动作和 Seraph 伤势保留。';
    }
    if (target !== 'act') return; if (state.phase === 'following' || seraphDoorLocked(state)) return j.lastText = seraphDoorText(state);
    const anchor = seraphDoorAnchor(state.scene);
    if (guide.controller || guide.status !== 'alive' || guide.currentLocation !== seraphDoorSet(state.scene) || !guide.isInMatrix) return 'Seraph 目前无法参与开锁；当前进度保留。';
    if (!actor.isInMatrix || distance(actor.position,filmPosition(seraphDoorSet(state.scene),anchor.x,anchor.z)) > SERAPH_DOOR.radius) return '先走到门旁的金色标记，再按 G。';
    state.neo = this.body(actor); j.checkpoint = { ...actor.position }; this.phase(state,'approaching'); return j.lastText = seraphDoorText(state);
  }
}
