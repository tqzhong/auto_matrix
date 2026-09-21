import type { AgentState, CyclePhaseId, EvolutionUpdate, WorldEvent } from '@auto_matrix/shared';
import { EventBus } from '../simulation/EventBus.js';

const NAMES: Record<CyclePhaseId, string> = {
  cycle_stable: '表象之下', cycle_anomaly: '现实裂缝', cycle_discovery: '觉醒蔓延', cycle_revolt: '秩序失衡',
  cycle_catastrophe: '生存危机', cycle_extinction: '文明消逝', cycle_darkness: '至暗时刻', cycle_rebirth: '新的可能',
};

export class EvolutionEngine {
  private update: EvolutionUpdate = { cycleNumber: 1, phase: 'cycle_stable', phaseName: NAMES.cycle_stable,
    narrative: '城市照常运转。每个人都有自己的生活，也有尚未说出口的疑问。', destructionCount: 0,
    population: 0, awakenedCount: 0, timeline: [] };

  constructor(private eventBus: EventBus) {}

  getUpdate(): EvolutionUpdate { return structuredClone(this.update); }

  evaluate(tick: number, agents: AgentState[] = [], events: WorldEvent[] = []): void {
    const alive = agents.filter(a => a.status === 'alive');
    this.update.population = alive.length;
    this.update.awakenedCount = alive.filter(a => a.isAwakened).length;
    const recent = events.filter(e => tick - e.tick < 100);
    let phase: CyclePhaseId = 'cycle_stable';
    if (events.some(e => e.type === 'anomaly')) phase = 'cycle_anomaly';
    if (events.some(e => e.type === 'awakening')) phase = 'cycle_discovery';
    if (recent.filter(e => e.type === 'gunfight').length >= 3) phase = 'cycle_revolt';
    if (agents.length && alive.length / agents.length < 0.5) phase = 'cycle_catastrophe';
    if (agents.length && alive.length === 0) phase = 'cycle_extinction';
    if (phase !== this.update.phase) {
      this.update.phase = phase;
      this.update.phaseName = NAMES[phase];
      this.update.narrative = events[events.length - 1]?.consequence ?? this.update.narrative;
      this.eventBus.emit('evolution_phase_change', { tick });
    }
  }
}
