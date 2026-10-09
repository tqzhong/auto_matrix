import { PRIMARY_DEMOLITION, FILM_SCENE_BY_ID, FILM_SETS, filmPosition, distance, primaryFloor, primaryActive, primaryLocked, primaryText, primaryTarget,
  type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class PrimaryDemolitionSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return primaryActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    for (const member of this.world.agents.values()) if (!member.controller && (member.currentAction?.parameters.primaryDemolition || member.currentAction?.parameters.primaryDemolitionCompanion)) member.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number, held = false): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m2_power, blackout = journey.scene === 'm2_blackout';
    const state = journey.primaryDemolition ??= { phase: journey.step >= 2 ? 'done' : 'install', installed: journey.step >= 2 ? PRIMARY_DEMOLITION.sites.map(site => site.id) : [],
      elapsed: 0, remaining: PRIMARY_DEMOLITION.retreatSeconds, attempts: 0 };
    delete journey.started;
    const ghost = this.world.agents.get('ghost');
    state.paused = ghost?.controller ? ghost.name : undefined;
    state.unavailable = ghost?.status !== 'alive' ? ghost?.name ?? 'Ghost' : undefined;
    if (blackout && ghost && (!ghost.isInMatrix || ghost.currentLocation !== scene.set)) state.unavailable = 'Ghost 尚未回到 Logos 的观察位';
    const elapsed = actor.controller && actor.status === 'alive' && !state.paused && !state.unavailable ? Math.max(0, Math.min(.1, dt)) : 0;
    if (blackout && state.blast) {
      const blast = state.blast;
      if (blast.phase === 'countdown' || blast.phase === 'blast') {
        blast.elapsed = Math.min(blast.phase === 'countdown' ? PRIMARY_DEMOLITION.countdownSeconds : PRIMARY_DEMOLITION.blastSeconds, blast.elapsed + elapsed);
        if (blast.phase === 'countdown' && blast.elapsed >= PRIMARY_DEMOLITION.countdownSeconds) {
          blast.phase = 'blast'; blast.elapsed = 0;
          if (journey.grid) { journey.grid.primary = 'off'; journey.grid.emergency = 'online'; journey.grid.phase = 'emergency'; journey.grid.lastTick = tick; }
        } else if (blast.phase === 'blast' && blast.elapsed >= PRIMARY_DEMOLITION.blastSeconds) {
          blast.phase = 'done'; this.onAdvance?.(primaryText(state), actor, tick);
        }
      }
    } else if (state.phase === 'mounting') {
      const site = PRIMARY_DEMOLITION.sites[state.selected!];
      actor.position = filmPosition(scene.set, site.x, site.z); actor.rotation = site.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 };
      if (held) state.elapsed = Math.min(PRIMARY_DEMOLITION.installSeconds, state.elapsed + elapsed);
      actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, primaryDemolition: { ...state } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
      if (state.elapsed >= PRIMARY_DEMOLITION.installSeconds) {
        if (!state.installed.includes(site.id)) state.installed.push(site.id);
        state.phase = state.installed.length === 3 ? 'sync' : 'install'; state.elapsed = 0; delete state.selected;
        actor.currentAction = null; journey.checkpoint = { ...actor.position };
      }
    } else if (state.phase === 'sync') state.elapsed = (state.elapsed + elapsed) % PRIMARY_DEMOLITION.syncCycle;
    else if (state.phase === 'retreat') {
      state.remaining = Math.max(0, state.remaining - elapsed);
      if (state.remaining === 0) { state.phase = 'failed'; if (journey.grid) journey.grid.primary = 'online'; }
    }
    if (primaryLocked(state)) {
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, primaryDemolition: { ...state, installed: [...state.installed] } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.primaryDemolition) actor.currentAction = null;
    if (ghost && ghost.status === 'alive' && !ghost.controller) {
      // Walk the clear central aisle; do not teleport a companion through transformer banks.
      const retreating = state.phase === 'retreat' || state.phase === 'done';
      const target = filmPosition(scene.set, retreating ? 3 : 5, blackout ? 40 : retreating ? 27 : 15);
      const gap = Math.hypot(target.x - ghost.position.x, target.z - ghost.position.z);
      if (elapsed > 0 && ghost.currentLocation === scene.set && gap > .01) {
        const amount = Math.min(gap, elapsed * 8);
        ghost.rotation = Math.atan2(target.x - ghost.position.x, target.z - ghost.position.z);
        ghost.velocity = { x: (target.x - ghost.position.x) / gap * amount / elapsed, y: 0, z: (target.z - ghost.position.z) / gap * amount / elapsed };
        ghost.position.x += (target.x - ghost.position.x) / gap * amount; ghost.position.z += (target.z - ghost.position.z) / gap * amount;
        ghost.position.y = FILM_SETS[scene.set].center.y + primaryFloor(ghost.position.x - FILM_SETS[scene.set].center.x, ghost.position.z - FILM_SETS[scene.set].center.z);
      }
      if (gap <= .01 || state.paused || state.unavailable || !actor.controller) ghost.velocity = { x: 0, y: 0, z: 0 };
      if (blackout && gap <= .01) {
        const center = FILM_SETS[scene.set].center;
        ghost.rotation = Math.atan2(center.x - ghost.position.x, center.z - ghost.position.z);
      }
      ghost.currentAction = { type: gap > .01 ? 'move_to' : 'idle', parameters: { resolved: true, primaryDemolitionCompanion: true }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    journey.lastText = primaryText(state); return primaryLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.primaryDemolition!;
    if (state.paused || state.unavailable) return primaryText(state);
    if (target === 'retry') {
      if (actor.status !== 'alive') { actor.status = 'alive'; actor.health = actor.maxHealth; }
      actor.position = { ...journey.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 };
      if (state.phase === 'failed') { state.phase = 'retreat'; state.remaining = PRIMARY_DEMOLITION.retreatSeconds; state.attempts++; if (journey.grid) journey.grid.primary = 'armed'; }
      this.frame(actor, 0, tick); return '已接回当前检查点；安装进度、队友伤势和先前哲学选择保留。';
    }
    if (primaryLocked(state)) return primaryText(state);
    if (journey.scene === 'm2_blackout' && target === 'act' && state.blast?.phase === 'ready') {
      const point = filmPosition(FILM_SCENE_BY_ID.m2_power.set, PRIMARY_DEMOLITION.observation.x, PRIMARY_DEMOLITION.observation.z);
      point.y += PRIMARY_DEMOLITION.ramp.top;
      if (!actor.isInMatrix || actor.currentLocation !== FILM_SCENE_BY_ID.m2_power.set || distance(actor.position, point) > .8) return '先回到桥上的观察位核对同步时刻。';
      if (journey.grid?.primary !== 'armed' || state.installed.length !== PRIMARY_DEMOLITION.sites.length) return '同步装置尚未全部安装并武装。';
      const ghost = this.world.agents.get('ghost')!, center = FILM_SETS[FILM_SCENE_BY_ID.m2_power.set].center;
      if (ghost.position.z < center.z + 38 || ghost.position.y < center.y + PRIMARY_DEMOLITION.ramp.top - .15) return '等 Ghost 也撤到桥上，不能把队友留在爆破区。';
      state.blast.phase = 'countdown'; state.blast.elapsed = 0; actor.rotation = Math.PI;
      journey.checkpoint = { ...actor.position }; this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target !== 'act' || state.phase === 'done') return;
    const at = primaryTarget(state), point = filmPosition(FILM_SCENE_BY_ID.m2_power.set, at.x, at.z);
    point.y += primaryFloor(at.x, at.z);
    if (!actor.isInMatrix || actor.currentLocation !== FILM_SCENE_BY_ID.m2_power.set || distance(actor.position, point) > .8)
      return state.phase === 'retreat' ? '先亲自撤到厂房外的观察桥。' : '先走近当前装置的实体安装点。';
    if (state.phase === 'sync') {
      if (state.elapsed < PRIMARY_DEMOLITION.syncStart || state.elapsed > PRIMARY_DEMOLITION.syncEnd) return '指针尚未落在同步区，等绿色区亮起再校准。';
      state.phase = 'retreat'; state.remaining = PRIMARY_DEMOLITION.retreatSeconds;
      if (journey.grid) journey.grid.primary = 'armed';
    } else if (state.phase === 'retreat') {
      if (this.world.agents.get('ghost')!.position.z < FILM_SETS[FILM_SCENE_BY_ID.m2_power.set].center.z + 26) return '等 Ghost 撤出厂房再确认。';
      state.phase = 'done'; this.onAdvance?.(primaryText(state), actor, tick);
    } else {
      state.selected = PRIMARY_DEMOLITION.sites.findIndex(site => !state.installed.includes(site.id)); state.phase = 'mounting'; state.elapsed = 0;
    }
    journey.checkpoint = { ...actor.position }; this.frame(actor, 0, tick); return journey.lastText;
  }
}
