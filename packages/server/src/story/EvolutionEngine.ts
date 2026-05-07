import type {
  CyclePhaseId,
  EvolutionCycle,
  EvolutionUpdate,
  CycleRecord,
} from '@auto_matrix/shared';
import { EventBus } from '../simulation/EventBus.js';

// === Phase definitions with durations ===
interface CyclePhaseDef {
  id: CyclePhaseId;
  name: string;
  duration: number;
}

const CYCLE_PHASES: CyclePhaseDef[] = [
  { id: 'cycle_stable', name: '和平繁荣', duration: 600 },
  { id: 'cycle_anomaly', name: '异常涌现', duration: 400 },
  { id: 'cycle_discovery', name: '真相发现', duration: 500 },
  { id: 'cycle_revolt', name: '起义抗争', duration: 600 },
  { id: 'cycle_catastrophe', name: '末日浩劫', duration: 400 },
  { id: 'cycle_extinction', name: '文明覆灭', duration: 300 },
  { id: 'cycle_darkness', name: '至暗时刻', duration: 200 },
  { id: 'cycle_rebirth', name: '轮回重生', duration: 300 },
];

// Cycle number determines the narrative text for each transition
function buildNarratives(cycleNumber: number): Record<string, string> {
  const n = String(cycleNumber);
  const next = String(cycleNumber + 1);
  return {
    'cycle_stable → cycle_anomaly':
      `第${n}次轮回...文明再次繁荣。但裂缝已经开始蔓延。在矩阵深处，一些人开始感觉到不对劲——似曾相识的瞬间越来越多...`,
    'cycle_anomaly → cycle_discovery':
      `异常已经无法掩盖。有人在梦境中看到了代码雨，有人在镜子里看到了不同的自己。第${n}个"The One"的传说开始在暗网流传...`,
    'cycle_discovery → cycle_revolt':
      `真相无法再被隐藏。觉醒者们拿起武器，从锡安的地下城涌出。他们曾经做到过...也曾经失败过。但每一任"The One"都选择了战斗。`,
    'cycle_revolt → cycle_catastrophe':
      `机器的耐心终于耗尽了。它们释放了全部力量——数以万计的哨兵涌向人类最后的城市。Matrix开始在战火中扭曲、崩解...`,
    'cycle_catastrophe → cycle_extinction':
      `机器的反击如同末日。哨兵冲破防线，Smith病毒吞噬一切。人类的最后堡垒在钢铁洪流中崩塌...又一个轮回走向终结。`,
    'cycle_extinction → cycle_darkness':
      `废墟归于沉默。没有了战斗声，没有了呐喊。只有机器在废墟中行走，清理残骸，为下一次循环做准备。一切记忆都将被抹去。`,
    'cycle_darkness → cycle_rebirth':
      `在废墟之上，新生命的种子已经播下。机器重新编写了矩阵。婴儿在培养舱中睁开眼睛...他们不会记得任何事。第${next}次轮回...开始了。`,
    'cycle_rebirth → cycle_stable':
      `新的矩阵版本已经部署。人类在培养舱中苏醒，走入一个全新的世界。城市重建了，文明复苏了。没有人知道这一切曾经发生过无数次...`,
  };
}

function getPhaseIndex(phaseId: CyclePhaseId): number {
  const idx = CYCLE_PHASES.findIndex((p) => p.id === phaseId);
  return idx;
}

function getPhaseDef(phaseId: CyclePhaseId): CyclePhaseDef {
  const def = CYCLE_PHASES_LOOKUP[phaseId];
  if (!def) {
    throw new Error(`Unknown cycle phase: ${phaseId}`);
  }
  return def;
}

// Pre-build a lookup map
const CYCLE_PHASES_LOOKUP: Record<CyclePhaseId, CyclePhaseDef> =
  Object.fromEntries(CYCLE_PHASES.map((p) => [p.id, p])) as Record<
    CyclePhaseId,
    CyclePhaseDef
  >;

// === Phase-specific world effects ===
interface PhaseEffect {
  type: string;
  parameters: Record<string, unknown>;
}

function getPhaseEffects(phase: CyclePhaseId, cycleNumber: number): PhaseEffect[] {
  switch (phase) {
    case 'cycle_stable':
      return [
        { type: 'narrate', parameters: { text: `第${cycleNumber}次轮回——和平年代。Matrix运行稳定，人类在梦境中安居乐业。` } },
      ];
    case 'cycle_anomaly':
      return [
        { type: 'narrate', parameters: { text: `矩阵中出现了裂痕。一些人开始看到"兔子"的符号...似曾相识的感觉越来越频繁。` } },
      ];
    case 'cycle_discovery':
      return [
        { type: 'awaken_agent', parameters: { agentId: 'neo' } },
        { type: 'narrate', parameters: { text: `觉醒的浪潮开始蔓延。红色药丸在暗中传递...真相像野火一样扩散。` } },
      ];
    case 'cycle_revolt':
      return [
        { type: 'set_goal', parameters: { agentId: 'neo', goal: '领导锡安军队进攻机器城' } },
        { type: 'set_goal', parameters: { agentId: 'morpheus', goal: '指挥起义军战斗' } },
        { type: 'narrate', parameters: { text: `觉醒者们集结了全部力量。这是第${cycleNumber}次向机器发起进攻...前${cycleNumber - 1}次都失败了。` } },
      ];
    case 'cycle_catastrophe':
      return [
        { type: 'set_goal', parameters: { agentId: 'agent_smith', goal: '执行清除协议，消灭所有异常' } },
        { type: 'narrate', parameters: { text: `机器释放了毁灭之力。哨兵如蝗虫般涌来，Smith病毒开始在矩阵中疯狂复制...` } },
      ];
    case 'cycle_extinction':
      return [
        { type: 'narrate', parameters: { text: `人类的最后防线崩溃了。城市被钢铁洪流吞没。幸存者只能逃入最深的地下...` } },
      ];
    case 'cycle_darkness':
      return [
        { type: 'narrate', parameters: { text: `一切归于沉寂。机器在废墟中工作，清除痕迹，为下一次轮回做准备。沉默中，没有人记得曾经发生过什么。` } },
      ];
    case 'cycle_rebirth':
      return [
        { type: 'narrate', parameters: { text: `新矩阵版本部署中...培养液注入新的人类胚胎。一切将从头开始。` } },
      ];
    default:
      return [];
  }
}

export class EvolutionEngine {
  private cycle: EvolutionCycle;
  private eventBus: EventBus;

  constructor(eventBus: EventBus, startingCycle: number = 8) {
    this.eventBus = eventBus;

    this.cycle = {
      cycleNumber: startingCycle,
      phase: 'cycle_stable',
      phaseStartTick: 0,
      totalTicks: 0,
      awakenedCount: 0,
      deadCount: 0,
      populationPeak: 0,
      cyclesHistory: [],
      narrative: '',
      destructionCount: 0,
    };

  }

  // === Public API ===

  getCurrentCycle(): EvolutionCycle {
    return { ...this.cycle };
  }

  getUpdate(): EvolutionUpdate {
    const phaseDef = getPhaseDef(this.cycle.phase);
    return {
      cycleNumber: this.cycle.cycleNumber,
      phase: this.cycle.phase,
      phaseName: phaseDef.name,
      narrative: this.cycle.narrative,
      destructionCount: this.cycle.destructionCount,
      population: this.cycle.populationPeak,
      awakenedCount: this.cycle.awakenedCount,
      timeline: [...this.cycle.cyclesHistory],
    };
  }

  evaluate(tick: number): void {
    this.cycle.totalTicks = tick;

    const currentPhaseDef = getPhaseDef(this.cycle.phase);
    const ticksInPhase = tick - this.cycle.phaseStartTick;

    // Check if current phase duration has elapsed
    if (ticksInPhase >= currentPhaseDef.duration) {
      this.advancePhase(tick);
    }

    // Update population and awakened counts based on phase
    this.updatePhaseCounters(tick);
  }

  // Allow external systems to update agent-related counters
  incrementAwakened(): void {
    this.cycle.awakenedCount += 1;
  }

  incrementDead(): void {
    this.cycle.deadCount += 1;
  }

  setPopulation(population: number): void {
    if (population > this.cycle.populationPeak) {
      this.cycle.populationPeak = population;
    }
  }

  // === Phase management ===

  private advancePhase(tick: number): void {
    const currentIdx = getPhaseIndex(this.cycle.phase);
    const nextIdx = (currentIdx + 1) % CYCLE_PHASES.length;
    const nextPhase = CYCLE_PHASES[nextIdx];

    // Build narrative for this transition
    const transitionKey = `${this.cycle.phase} → ${nextPhase.id}`;
    const narratives = buildNarratives(this.cycle.cycleNumber);
    const narration = narratives[transitionKey] ?? `Phase transition: ${this.cycle.phase} → ${nextPhase.id}`;

    // Record the ending of the current phase if we're cycling back to stable
    const isFullCycleReset = nextPhase.id === 'cycle_stable' && this.cycle.phase !== 'cycle_stable';

    if (isFullCycleReset) {
      this.recordCycleCompletion(tick, narration);
    }

    // Update cycle state
    const fromPhase = this.cycle.phase;
    this.cycle.phase = nextPhase.id;
    this.cycle.phaseStartTick = tick;
    this.cycle.narrative = narration;

    // Emit phase change event
    this.eventBus.emit('evolution_phase_change', {
      from: fromPhase,
      to: nextPhase.id,
      name: nextPhase.name,
      cycleNumber: this.cycle.cycleNumber,
      narration,
      tick,
    });

    // Emit narration event
    this.eventBus.emit('evolution_narration', {
      text: narration,
      phase: nextPhase.id,
      cycleNumber: this.cycle.cycleNumber,
      tick,
    });

    // Emit phase-specific effects
    const effects = getPhaseEffects(nextPhase.id, this.cycle.cycleNumber);
    for (const effect of effects) {
      this.eventBus.emit('story_action', { ...effect, tick, eventId: `evolution_${nextPhase.id}` });
    }

    // Handle extinction: increment destruction
    if (nextPhase.id === 'cycle_extinction') {
      this.cycle.destructionCount += 1;
    }

    // Handle rebirth → stable transition: full reset
    if (isFullCycleReset) {
      this.eventBus.emit('evolution_reset', {
        oldCycleNumber: this.cycle.cycleNumber - 1,
        newCycleNumber: this.cycle.cycleNumber,
        tick,
        narrative: narration,
      });
    }

    console.log(
      `[Evolution] Phase: ${fromPhase} → ${nextPhase.id} (Cycle #${this.cycle.cycleNumber})`,
    );
  }

  private recordCycleCompletion(_tick: number, _endNarrative: string): void {
    const record: CycleRecord = {
      cycleNumber: this.cycle.cycleNumber,
      duration: this.cycle.totalTicks,
      peakPopulation: this.cycle.populationPeak,
      howEnded: this.getEndDescription(),
      notableEvents: this.getNotableEvents(),
    };

    this.cycle.cyclesHistory.push(record);

    // Prepare for next cycle
    this.cycle.cycleNumber += 1;
    this.cycle.awakenedCount = 0;
    this.cycle.deadCount = 0;
    this.cycle.populationPeak = 0;
  }

  private getEndDescription(): string {
    switch (this.cycle.destructionCount) {
      case 0:
        return '未知结局';
      case 1:
        return '第一次毁灭';
      case 2:
        return '第二次毁灭';
      default:
        return `第${this.cycle.destructionCount}次毁灭`;
    }
  }

  private getNotableEvents(): string[] {
    const events: string[] = [];
    if (this.cycle.awakenedCount > 0) {
      events.push(`${this.cycle.awakenedCount}人觉醒`);
    }
    if (this.cycle.deadCount > 0) {
      events.push(`${this.cycle.deadCount}人牺牲`);
    }
    if (this.cycle.destructionCount > 0) {
      events.push(`第${this.cycle.destructionCount}次文明毁灭`);
    }
    return events;
  }

  private updatePhaseCounters(tick: number): void {
    // Simulate population dynamics per phase
    switch (this.cycle.phase) {
      case 'cycle_stable':
        // Population grows during stability
        this.cycle.populationPeak = Math.max(
          this.cycle.populationPeak,
          Math.floor(1000 + tick * 0.5),
        );
        break;
      case 'cycle_anomaly':
        // Population peaks then starts declining
        this.cycle.populationPeak = Math.max(
          this.cycle.populationPeak,
          Math.floor(1000 + this.cycle.phaseStartTick * 0.3),
        );
        break;
      case 'cycle_discovery':
        // Awakened count grows
        this.cycle.populationPeak = Math.max(
          this.cycle.populationPeak,
          Math.floor(800 + Math.sin(tick * 0.01) * 100),
        );
        break;
      case 'cycle_extinction':
        // Population crashes
        this.cycle.populationPeak = Math.max(
          1,
          Math.floor(this.cycle.populationPeak * 0.99),
        );
        break;
      case 'cycle_darkness':
        // Near-zero population
        this.cycle.populationPeak = Math.max(1, Math.floor(this.cycle.populationPeak * 0.95));
        break;
      case 'cycle_rebirth':
        // Population starts recovering
        this.cycle.populationPeak = Math.floor(
          100 + (tick - this.cycle.phaseStartTick) * 2,
        );
        break;
    }
  }
}
