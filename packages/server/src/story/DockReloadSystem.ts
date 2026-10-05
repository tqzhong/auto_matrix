import { DOCK_RELOAD, DOCK_GUNNERY, FILM_SETS, dockReloadActive, dockReloadHeight, dockReloadLocked, dockReloadText, filmPosition,
  kickDockReload, newDockReload, stepDockReload, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class DockReloadSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  onHandoff?: (actor: AgentState, id: string, tick: number) => boolean;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return dockReloadActive(this.journey) && this.journey!.actor === actor.id; }
  private occupied(): boolean {
    return ['kid', 'mifune'].some(id => id !== this.journey!.actor && Boolean(this.world.agents.get(id)?.controller));
  }
  stage(tick: number): void {
    const journey = this.journey;
    const id = 'film:dock:apu';
    if (!journey || journey.visiting || journey.scene !== 'm3_dock_battle' || journey.dockGunnery?.phase !== 'cleared') {
      this.sandbox().structures = this.sandbox().structures.filter(item => item.id !== id); return;
    }
    if (!this.sandbox().structures.some(item => item.id === id)) {
      const body = DOCK_RELOAD.body;
      this.sandbox().structures.push({ id, kind: 'barricade', owner: 'zion', matrix: false, health: 1,
        position: filmPosition('film_zion_hangar', body.x, body.z),
        film: { scene: 'm3_dock_battle', width: body.width, depth: body.depth, height: body.height } });
    }
    const mifune = this.world.agents.get('mifune')!;
    if (!mifune.controller || journey.actor === 'mifune') {
      const fallen = journey.completed.includes('m3_dock_battle');
      mifune.position = filmPosition('film_zion_hangar', fallen ? 4.7 : 0, DOCK_GUNNERY.apuZ); mifune.position.y += fallen ? .6 : 2.2;
      mifune.rotation = fallen ? Math.PI / 2 : Math.PI; mifune.currentLocation = 'film_zion_hangar'; mifune.isInMatrix = false;
      mifune.velocity = { x: 0, y: 0, z: 0 }; mifune.targetPosition = null; mifune.currentPath = [];
      mifune.currentAction = fallen ? null : { type: 'idle', parameters: { resolved: true, riding: true, seated: true }, startedAt: tick, duration: 1e9, progress: 0 };
    }
    const encounter = journey.dockReload, kid = this.world.agents.get('kid')!;
    if (!encounter || journey.actor !== 'kid') return;
    if (dockReloadLocked(encounter)) {
      kid.position = filmPosition('film_zion_hangar', DOCK_RELOAD.entry.x, DOCK_RELOAD.entry.z);
      kid.position.y += dockReloadHeight(encounter.climb); kid.rotation = Math.PI;
      kid.currentLocation = 'film_zion_hangar'; kid.isInMatrix = false;
      kid.velocity = { x: 0, y: 0, z: 0 }; kid.targetPosition = null; kid.currentPath = [];
      kid.currentAction = { type: 'idle', parameters: { resolved: true, dockReload: { ...encounter, role: 'kid' } }, startedAt: tick, duration: 1e9, progress: 0 };
    }
  }
  frame(actor: AgentState, input: { focus: boolean; climb: number }, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!;
    delete journey.started; // A legacy two-second interaction cannot finish this encounter.
    if (this.occupied()) { journey.lastText = '装填同伴正由另一位玩家控制，当前检查点保持不变。'; return true; }
    const encounter = journey.dockReload;
    if (actor.id === 'mifune' || !encounter) { this.stage(tick); return true; }
    if (!actor.controller || actor.status !== 'alive') { this.stage(tick); return dockReloadLocked(encounter); }
    stepDockReload(encounter, input, dt);
    if (encounter.phase === 'done') {
      actor.position = filmPosition('film_zion_hangar', DOCK_RELOAD.entry.x, DOCK_RELOAD.entry.z);
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
    this.stage(tick);
    journey.lastText = dockReloadText(encounter);
    if (dockReloadLocked(encounter)) journey.checkpoint = { ...actor.position };
    if (encounter.phase === 'done') {
      journey.checkpoint = { ...actor.position };
      this.onAdvance?.('Kid 抓住横杆，把卡住的弹箱踢进导轨并爬回地面。装填完成，继续守住船坞。', actor, tick);
    }
    return dockReloadLocked(encounter);
  }
  handle(actor: AgentState, kind: string, tick: number): string | undefined {
    if (!this.active(actor) || !['attack', 'shoot', 'dodge', 'ability', 'ability2', 'travel'].includes(kind)) return;
    if (this.occupied()) return '装填同伴正由另一位玩家控制，当前检查点保持不变。';
    const encounter = this.journey!.dockReload;
    if (kind === 'attack' && encounter && actor.id === 'kid') { kickDockReload(encounter); this.stage(tick); }
    return this.journey!.lastText = dockReloadText(encounter);
  }
  command(actor: AgentState, target: string, tick: number): string {
    const journey = this.journey!;
    if (this.occupied()) return 'Kid 或 Mifune 正由另一位玩家控制，装填检查点与炮位胜利已保留。';
    if (target === 'act' && actor.id === 'mifune') {
      const previous = journey.actor; journey.actor = 'kid';
      if (!this.onHandoff?.(actor, 'kid', tick)) { journey.actor = previous; return '暂时不能接管 Kid，炮位胜利已保留。'; }
      journey.dockReload ??= newDockReload(); delete journey.started;
      journey.checkpoint = { ...this.world.agents.get('kid')!.position };
      this.stage(tick); return journey.lastText = dockReloadText(journey.dockReload);
    }
    const encounter = journey.dockReload ??= newDockReload();
    if (target === 'retry' && encounter.phase === 'failed') {
      journey.dockReload = newDockReload(encounter.attempts + 1);
      actor.position = filmPosition('film_zion_hangar', DOCK_RELOAD.entry.x, DOCK_RELOAD.entry.z);
      actor.currentAction = null; actor.rotation = Math.PI; actor.velocity = { x: 0, y: 0, z: 0 };
      journey.checkpoint = { ...actor.position }; delete journey.started;
    } else if (target === 'act' && encounter.phase === 'approach') {
      const center = FILM_SETS.film_zion_hangar.center;
      if (Math.hypot(actor.position.x - center.x - DOCK_RELOAD.entry.x, actor.position.z - center.z - DOCK_RELOAD.entry.z) > 1.5
        || Math.abs(actor.position.y - center.y) > .3) return '走到 APU 后方装填架旁，再按 G 操作升降手柄。';
      encounter.phase = 'hoisting'; delete journey.started; this.stage(tick);
    }
    return journey.lastText = dockReloadText(journey.dockReload);
  }
}
