import type { StoryPhaseId } from '@auto_matrix/shared';
import { STORY_PHASES } from '@auto_matrix/shared';
import { EventBus } from '../simulation/EventBus.js';
import { ScriptedEvents } from './ScriptedEvents.js';

const PHASE_ORDER: StoryPhaseId[] = [
  'phase1_normal_life',
  'phase2_awakening',
  'phase3_war',
  'phase4_resolution',
];

export class StoryEngine {
  private currentPhaseId: StoryPhaseId = 'phase1_normal_life';
  private phaseStartTick = 0;
  private scriptedEvents: ScriptedEvents;
  private firedEvents = new Set<string>();

  constructor(private eventBus: EventBus) {
    this.scriptedEvents = new ScriptedEvents();
  }

  getCurrentPhaseId(): StoryPhaseId {
    return this.currentPhaseId;
  }

  getCurrentPhase() {
    return STORY_PHASES[this.currentPhaseId];
  }

  evaluate(tick: number): void {
    // Check scripted events
    const events = this.scriptedEvents.getReady(tick, this.currentPhaseId, this.firedEvents);
    for (const event of events) {
      this.executeEvent(event, tick);
      this.firedEvents.add(event.id);
    }

    // Check phase duration
    const phase = STORY_PHASES[this.currentPhaseId];
    if (phase.duration && tick - this.phaseStartTick >= phase.duration) {
      this.advancePhase(tick);
    }
  }

  triggerEvent(eventId: string, tick: number): void {
    if (this.firedEvents.has(eventId)) return;
    const event = this.scriptedEvents.getById(eventId);
    if (event) {
      this.executeEvent(event, tick);
      this.firedEvents.add(eventId);
    }
  }

  isEventFired(eventId: string): boolean {
    return this.firedEvents.has(eventId);
  }

  private advancePhase(tick: number): void {
    const currentIdx = PHASE_ORDER.indexOf(this.currentPhaseId);
    if (currentIdx >= PHASE_ORDER.length - 1) return;

    const nextPhaseId = PHASE_ORDER[currentIdx + 1];
    const from = this.currentPhaseId;
    this.currentPhaseId = nextPhaseId;
    this.phaseStartTick = tick;

    const phase = STORY_PHASES[nextPhaseId];
    this.eventBus.emit('phase_change', {
      from,
      to: nextPhaseId,
      name: phase.name,
      description: phase.description,
      tick,
    });
    console.log(`[Story] Phase changed: ${from} → ${nextPhaseId} (${phase.name})`);
  }

  private executeEvent(event: { id: string; name: string; actions: any[] }, tick: number): void {
    console.log(`[Story] Event fired: ${event.name} (${event.id}) at tick ${tick}`);
    for (const action of event.actions) {
      this.eventBus.emit('story_action', { ...action, tick, eventId: event.id });
    }
    this.eventBus.emit('story_event', { id: event.id, name: event.name, tick });
  }
}
