import { dockGateActive, dockGateText, fireDockGate, newDockGate, stepDockGate, FILM_SETS, filmPosition,
  type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class DockGateSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return dockGateActive(this.journey) && this.journey!.actor === actor.id; }
  stage(actor: AgentState, tick: number): void {
    if (!this.active(actor)) return;
    const journey = this.journey!, center = FILM_SETS.film_zion_hangar.center;
    const gate = journey.dockGate ??= newDockGate(journey.apu?.x ?? actor.position.x - center.x, journey.apu?.z ?? -50);
    delete journey.started;
    actor.position = filmPosition('film_zion_hangar', gate.x, gate.z); actor.position.y += 2.2;
    actor.rotation = Math.PI; actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
    actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, riding: true, seated: true, dockGate: { ...gate } }, startedAt: tick, duration: 1e9, progress: 0 };
    journey.checkpoint = { ...actor.position };
  }
  frame(actor: AgentState, dt: number, tick: number, yaw?: number, pitch?: number): boolean {
    if (!this.active(actor)) return false;
    this.stage(actor, tick); const journey = this.journey!, gate = journey.dockGate!;
    if (!actor.controller || actor.status !== 'alive') return true;
    // Link is needed at the next handoff; never consume the ending under another player.
    if (gate.phase === 'entering' && this.world.agents.get('link')?.controller) { journey.lastText = 'Link 正由另一位玩家控制，Hammer 进场进度已保留。'; return true; }
    if (gate.phase === 'aiming' && Number.isFinite(yaw) && Number.isFinite(pitch)) { gate.yaw = yaw!; gate.pitch = Math.max(-1.35, Math.min(1.35, pitch!)); }
    stepDockGate(gate, dt); this.stage(actor, tick); journey.lastText = dockGateText(gate);
    if (gate.phase === 'done' && journey.step === 2) this.onAdvance?.('Kid 用机炮击断承重缆索，配重牵开三号闸门。Hammer 穿过开口进入船坞，Link 现在可以启动 EMP。', actor, tick);
    return true;
  }
  shoot(actor: AgentState, yaw: number, pitch: number, tick: number): string {
    this.stage(actor, tick); const gate = this.journey!.dockGate!;
    const hit = fireDockGate(gate, yaw, pitch); this.stage(actor, tick);
    this.journey!.lastText = gate.phase === 'aiming' ? hit ? `缆索钢股断裂 ${gate.hits}/8 · 剩余 ${gate.ammo} 发` : '弹幕未击中承重缆索。调整上下瞄准，观察右上方悬挂的配重。' : dockGateText(gate);
    return this.journey!.lastText;
  }
  command(actor: AgentState, target: string, tick: number): string {
    this.stage(actor, tick); const journey = this.journey!, gate = journey.dockGate!;
    if (target === 'retry') {
      if (gate.phase === 'failed') journey.dockGate = newDockGate(gate.x, gate.z);
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = []; }
      this.stage(actor, tick); return journey.lastText = dockGateText(journey.dockGate!);
    }
    if (target === 'act' && gate.phase === 'ready') { gate.phase = 'aiming'; gate.elapsed = 0; }
    this.stage(actor, tick); return journey.lastText = dockGateText(gate);
  }
}
