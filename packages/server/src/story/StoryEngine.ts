import type { AgentState, StoryPhaseId, WorldEvent } from '@auto_matrix/shared';
import { STORY_PHASES } from '@auto_matrix/shared';
import { EventBus } from '../simulation/EventBus.js';

export class StoryEngine {
  private currentPhaseId: StoryPhaseId = 'phase1_normal_life';
  private firedEvents = new Set<string>();
  private lastConflict = 0;
  private ceasefireUntil = 0;

  constructor(private eventBus: EventBus) {}

  getCurrentPhaseId(): StoryPhaseId { return this.currentPhaseId; }
  getCurrentPhase() { return STORY_PHASES[this.currentPhaseId]; }
  restorePhase(phase: StoryPhaseId): void { if (STORY_PHASES[phase]) this.currentPhaseId = phase; }
  isEventFired(id: string): boolean { return this.firedEvents.has(id); }
  triggerEvent(id: string, _tick: number): void { this.firedEvents.add(id); }
  resetPhase(): void { this.currentPhaseId = 'phase1_normal_life'; this.firedEvents.clear(); }
  setCeasefire(tick: number): void { this.ceasefireUntil = tick + 180; }
  isCeasefire(tick: number): boolean { return tick < this.ceasefireUntil; }

  evaluate(tick: number, agents: AgentState[] = [], events: WorldEvent[] = []): void {
    const awakenings = events.filter(e => e.type === 'awakening');
    const conflicts = events.filter(e => e.type === 'gunfight' && tick - e.tick < 120);
    if (conflicts.length) this.lastConflict = conflicts[conflicts.length - 1].tick;
    let next = this.currentPhaseId;
    if (this.currentPhaseId === 'phase1_normal_life' && awakenings.length) next = 'phase2_awakening';
    else if (this.currentPhaseId !== 'phase3_war' && conflicts.length >= 3) next = 'phase3_war';
    else if (this.currentPhaseId === 'phase3_war' && tick - this.lastConflict >= 100 && agents.some(a => a.status === 'alive' && a.faction === 'zion')) next = 'phase4_resolution';
    if (next === this.currentPhaseId) return;
    const from = this.currentPhaseId;
    this.currentPhaseId = next;
    const phase = this.getCurrentPhase();
    this.eventBus.emit('phase_change', { from, to: next, name: phase.name, description: phase.description, tick });
  }
}
