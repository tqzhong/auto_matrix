import { TRINITY_TERMINAL, GRID_HACK_SECONDS, FILM_SCENE_BY_ID, filmPosition, distance, trinityTerminalActive,
  trinityTerminalLocked, trinityTerminalText, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class TrinityTerminalSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return trinityTerminalActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void { for (const actor of this.world.agents.values()) if (!actor.controller && actor.currentAction?.parameters.trinityTerminal) actor.currentAction = null; }
  frame(actor: AgentState, dt: number, tick: number, held = false): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, state = journey.trinityTerminal ??= { phase: 'ready', elapsed: 0, attempts: 0 };
    delete journey.started;
    const link = this.world.agents.get('link');
    state.paused = link?.controller ? link.name : undefined;
    state.unavailable = link?.status !== 'alive' ? link?.name ?? 'Link' : undefined;
    const grid = journey.grid;
    const legacyArmed = grid?.primary === 'armed' && !journey.primaryDemolition?.blast && !journey.trinityRelay;
    state.blocked = state.phase === 'ready' && (grid?.primary !== 'off' && !legacyArmed || grid?.vigilant !== 'lost' || grid?.trinity !== 'connected')
      ? '主网爆破、Vigilant 失联与现实接线尚未全部完成。' : undefined;
    const elapsed = actor.controller && actor.status === 'alive' && actor.isInMatrix && actor.currentLocation === FILM_SCENE_BY_ID.m2_backup.set
      && !state.paused && !state.unavailable ? Math.max(0, Math.min(.1, dt)) : 0;
    if (state.phase === 'scanning') {
      state.elapsed = Math.min(TRINITY_TERMINAL.scanSeconds, state.elapsed + elapsed);
      if (state.elapsed >= TRINITY_TERMINAL.scanSeconds) { state.phase = 'selecting'; state.elapsed = 0; }
    } else if (state.phase === 'typing' && held) {
      state.elapsed = Math.min(TRINITY_TERMINAL.typingSeconds, state.elapsed + elapsed);
      if (state.elapsed >= TRINITY_TERMINAL.typingSeconds) { state.phase = 'armed'; state.elapsed = 0; }
    }
    if (trinityTerminalLocked(state)) {
      const point = TRINITY_TERMINAL.root;
      actor.position = filmPosition(FILM_SCENE_BY_ID.m2_backup.set, point.x, point.z); actor.rotation = point.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, trinityTerminal: { ...state } },
        startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.trinityTerminal) actor.currentAction = null;
    journey.lastText = trinityTerminalText(state); return trinityTerminalLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.trinityTerminal!;
    if (target === 'retry') {
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; }
      if (state.phase === 'failed') { state.phase = 'ready'; state.elapsed = 0; state.attempts++; delete state.selected; }
      if (state.phase === 'ready') actor.position = { ...journey.checkpoint };
      actor.velocity = { x: 0, y: 0, z: 0 }; this.frame(actor, 0, tick);
      return '接回终端检查点；主网爆破、队友伤亡与先前选择保持。';
    }
    if (state.paused || state.unavailable) return trinityTerminalText(state);
    if (target.startsWith('terminal:select:')) {
      if (state.phase !== 'selecting') return trinityTerminalText(state);
      const selected = target.slice('terminal:select:'.length);
      if (!TRINITY_TERMINAL.nodes.some(node => node.id === selected)) return '请选择终端扫描得到的服务。';
      state.selected = selected; state.phase = selected === 'ssh' ? 'typing' : 'failed'; state.elapsed = 0;
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target === 'next' && state.phase !== 'deployed') return trinityTerminalText(state);
    if (target !== 'act' || state.phase === 'deployed') return;
    if (state.phase === 'ready') {
      if (!actor.isInMatrix || actor.currentLocation !== FILM_SCENE_BY_ID.m2_backup.set
        || distance(actor.position, filmPosition(FILM_SCENE_BY_ID.m2_backup.set, TRINITY_TERMINAL.root.x, TRINITY_TERMINAL.root.z)) > 1.3)
        return '先亲自走到机房电脑的键盘前。';
      const grid = journey.grid;
      // Old checkpoints entered this room after the explosion but retained the earlier armed flag.
      if (grid?.primary === 'armed' && !journey.primaryDemolition?.blast && !journey.trinityRelay) grid.primary = 'off';
      if (grid?.primary !== 'off' || grid.vigilant !== 'lost' || grid.trinity !== 'connected') return '主网爆破、Vigilant 失联与现实接线尚未全部完成。';
      state.phase = 'scanning'; state.elapsed = 0; journey.checkpoint = { ...actor.position };
    } else if (state.phase === 'armed') {
      state.phase = 'deployed'; state.elapsed = 0;
      const grid = journey.grid!; grid.emergency = 'online'; grid.phase = 'emergency'; grid.hackRemaining = GRID_HACK_SECONDS; grid.lastTick = tick;
      this.onAdvance?.(trinityTerminalText(state), actor, tick);
    }
    this.frame(actor, 0, tick); return journey.lastText;
  }
}
