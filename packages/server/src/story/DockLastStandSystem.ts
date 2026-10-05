import { DOCK_LAST_STAND, FILM_SCENE_BY_ID, FILM_SETS, dockLastStandActive, dockLastStandLocked, dockLastStandPose,
  dockLastStandText, filmPosition, newDockLastStand, stepDockLastStand, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class DockLastStandSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return dockLastStandActive(this.journey) && this.journey!.actor === actor.id; }
  stage(tick: number): void {
    const journey = this.journey;
    if (!journey || journey.visiting || !['m3_dock_battle', 'm3_gate'].includes(journey.scene)) return;
    // Completed saves keep their result. Adding this beat must not resurrect Mifune.
    if (journey.scene === 'm3_dock_battle' && journey.completed.includes(journey.scene)) journey.step = FILM_SCENE_BY_ID.m3_dock_battle.steps.length;
    if (dockLastStandActive(journey)) journey.dockLastStand ??= newDockLastStand();
    const encounter = journey.dockLastStand, mifune = this.world.agents.get('mifune')!;
    if (!encounter || mifune.controller) return;
    const pose = dockLastStandPose(encounter), center = FILM_SETS.film_zion_hangar.center;
    mifune.position = filmPosition('film_zion_hangar', pose.mifune.x, pose.mifune.z); mifune.position.y += pose.mifune.y;
    mifune.rotation = pose.mifune.yaw; mifune.currentLocation = 'film_zion_hangar'; mifune.isInMatrix = false;
    mifune.status = pose.dead >= 1 ? 'dead' : 'alive'; mifune.health = pose.dead >= 1 ? 0 : pose.injured ? 1 : mifune.health;
    mifune.velocity = { x: 0, y: 0, z: 0 }; mifune.targetPosition = null; mifune.currentPath = [];
    mifune.currentAction = { type: 'idle', parameters: { resolved: true, riding: !pose.fallen, seated: !pose.fallen,
      dockLastStand: { ...encounter, role: 'mifune' } }, startedAt: tick, duration: 1e9, progress: 0 };
    const kid = this.world.agents.get('kid')!;
    if (journey.actor !== 'kid' || journey.scene !== 'm3_dock_battle' || !dockLastStandLocked(encounter)) return;
    if (encounter.approach && encounter.phase !== 'attack') {
      const to = DOCK_LAST_STAND.kid, from = encounter.approach;
      kid.position = filmPosition('film_zion_hangar', from.x + (to.x - from.x) * (encounter.phase === 'kneeling' ? pose.kneel : 1),
        from.z + (to.z - from.z) * (encounter.phase === 'kneeling' ? pose.kneel : 1));
      const turn = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw));
      kid.rotation = from.yaw + turn * (encounter.phase === 'kneeling' ? pose.kneel : 1);
    }
    kid.position.y = center.y; kid.velocity = { x: 0, y: 0, z: 0 }; kid.targetPosition = null; kid.currentPath = [];
    kid.currentAction = { type: 'idle', parameters: { resolved: true, dockLastStand: { ...encounter, role: 'kid' } }, startedAt: tick, duration: 1e9, progress: 0 };
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!; delete journey.started;
    if (this.world.agents.get('mifune')?.controller) { journey.lastText = 'Mifune 正由另一位玩家控制，交接进度已保留。'; return true; }
    this.stage(tick); const encounter = journey.dockLastStand!;
    if (!actor.controller || actor.status !== 'alive') return dockLastStandLocked(encounter);
    const previous = encounter.phase; stepDockLastStand(encounter, dt); this.stage(tick);
    if (previous !== encounter.phase) {
      journey.lastText = dockLastStandText(encounter);
      if (encounter.phase === 'wounded' || encounter.phase === 'done') actor.currentAction = null;
    }
    if (dockLastStandLocked(encounter)) journey.checkpoint = { ...actor.position };
    if (encounter.phase === 'done') this.onAdvance?.('Mifune 牺牲前把打断配重、打开三号闸门的任务交给 Kid。Kid 决定接管受损 APU，接应 Hammer。', actor, tick);
    return dockLastStandLocked(encounter);
  }
  handle(actor: AgentState, kind: string): string | undefined {
    if (this.active(actor) && ['attack', 'shoot', 'dodge', 'ability', 'ability2', 'travel'].includes(kind)) return '先走近 Mifune，听完开闸的交代。';
  }
  command(actor: AgentState, target: string, tick: number): string {
    const journey = this.journey!;
    if (this.world.agents.get('mifune')?.controller) return 'Mifune 正由另一位玩家控制，交接进度已保留。';
    this.stage(tick); const encounter = journey.dockLastStand!;
    if (target === 'retry') {
      if (actor.status !== 'alive') {
        actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
        actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null;
      }
      this.stage(tick); return 'Kid 回到交接检查点；炮战、装填和 Mifune 的伤势进度保留。';
    }
    if (target !== 'act') return journey.lastText;
    const center = FILM_SETS.film_zion_hangar.center;
    if (encounter.phase === 'ready') {
      if (Math.hypot(actor.position.x - center.x, actor.position.z - center.z - 12) > 10) return '先回到机甲附近，接续最后防线。';
      encounter.phase = 'attack'; encounter.elapsed = 0;
    } else if (encounter.phase === 'wounded') {
      if (Math.hypot(actor.position.x - center.x - DOCK_LAST_STAND.kid.x, actor.position.z - center.z - DOCK_LAST_STAND.kid.z) > 1.2
        || Math.abs(actor.position.y - center.y) > .3) return '绕到机甲前方，靠近 Mifune 身旁的标记，再按 G 蹲下。';
      encounter.approach = { x: actor.position.x - center.x, z: actor.position.z - center.z, yaw: actor.rotation };
      encounter.phase = 'kneeling'; encounter.elapsed = 0;
    } else if (encounter.phase === 'response') { encounter.phase = 'answer'; encounter.elapsed = 0; }
    journey.checkpoint = { ...actor.position }; delete journey.started; this.stage(tick);
    return journey.lastText = dockLastStandText(encounter);
  }
}
