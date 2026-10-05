import { dockGateActive, dockGateText, dockGatePoint, dockGateZee, dockGateEye, DOCK_GATE, fireDockGate, newDockGate, stepDockGate, FILM_SETS, filmPosition,
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
    const pilot = dockGatePoint(gate, { x: 0, y: 1.3, z: 0 });
    actor.position = filmPosition('film_zion_hangar', pilot.x, pilot.z); actor.position.y += pilot.y;
    actor.rotation = Math.PI; actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
    actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, riding: true, seated: true, dockGate: { ...gate } }, startedAt: tick, duration: 1e9, progress: 0 };
    journey.checkpoint = { ...actor.position };
    const zee = this.world.agents.get('zee');
    if (gate.toppled && zee && !zee.controller) {
      const cover = dockGateZee(gate);
      zee.position = filmPosition('film_zion_hangar', cover.x, cover.z); zee.rotation = cover.yaw;
      zee.currentLocation = 'film_zion_hangar'; zee.isInMatrix = false;
      zee.velocity = { x: 0, y: 0, z: 0 }; zee.targetPosition = null; zee.currentPath = [];
      zee.currentAction = { type: 'idle', parameters: { resolved: true, armed: true, weaponStyle: 'pulse', dockGateCover: { ...gate } }, startedAt: tick, duration: 1e9, progress: 0 };
    }
  }
  frame(actor: AgentState, dt: number, tick: number, yaw?: number, pitch?: number, focus = false): boolean {
    if (!this.active(actor)) return false;
    this.stage(actor, tick); const journey = this.journey!, gate = journey.dockGate!;
    if (!actor.controller || actor.status !== 'alive') return true;
    // Link is needed at the next handoff; never consume the ending under another player.
    if (gate.phase === 'entering' && this.world.agents.get('link')?.controller) { journey.lastText = 'Link 正由另一位玩家控制，Hammer 进场进度已保留。'; return true; }
    if (['falling', 'rescue'].includes(gate.phase) && this.world.agents.get('zee')?.controller) { journey.lastText = 'Zee 正由另一位玩家控制，救援进度已保留。'; return true; }
    if (gate.phase === 'aiming' && Number.isFinite(yaw) && Number.isFinite(pitch)) { gate.yaw = yaw!; gate.pitch = Math.max(-1.35, Math.min(1.35, pitch!)); }
    const previous = gate.phase;
    stepDockGate(gate, dt, focus);
    if (previous === 'braced' && gate.phase === 'aiming') {
      const eye = dockGateEye(gate), dx = DOCK_GATE.cable.x - 2 - eye.x, dz = DOCK_GATE.cable.z - eye.z;
      gate.yaw = Math.atan2(dx, dz); gate.pitch = -Math.atan2(32 - eye.y, Math.hypot(dx, dz));
    }
    this.stage(actor, tick); journey.lastText = dockGateText(gate);
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
      if (gate.phase === 'failed') {
        journey.dockGate = newDockGate(gate.x, gate.z);
        if (gate.toppled) Object.assign(journey.dockGate, { toppled: true, phase: 'braced', brace: 0 });
      }
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = []; }
      this.stage(actor, tick); return journey.lastText = dockGateText(journey.dockGate!);
    }
    if (target === 'act' && gate.phase === 'ready') {
      if (this.world.agents.get('zee')?.controller) return journey.lastText = 'Zee 正由另一位玩家控制，等待她可参与救援后再接管机炮。';
      gate.phase = 'falling'; gate.elapsed = 0; gate.toppled = true;
    }
    this.stage(actor, tick); return journey.lastText = dockGateText(gate);
  }
}
