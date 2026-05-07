// 世界状态类型
import type { AgentId, AgentState, Vector3 } from './agent.js';

export type BlockId = number;

export interface WorldState {
  dimensions: { x: number; y: number; z: number };
  chunks: Record<string, ChunkData>;
  locations: Record<string, LocationData>;
  activeAgents: Record<AgentId, AgentState>;
  currentPhase: StoryPhaseId;
  simulationTick: number;
  timeOfDay: number;
  globalEvents: WorldEvent[];
}

export interface ChunkData {
  key: string;
  blocks: Uint8Array;
  isLoaded: boolean;
  isDirty: boolean;
  lastModified: number;
}

export interface LocationData {
  id: string;
  name: string;
  description: string;
  bounds: { min: Vector3; max: Vector3 };
  center: Vector3;
  faction: string | null;
  properties: Record<string, unknown>;
  connectedLocations: string[];
  isInterior: boolean;
}

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  description: string;
  location: string;
  involvedAgents: AgentId[];
  tick: number;
  importance: number;
}

export type WorldEventType =
  | 'explosion'
  | 'gunfight'
  | 'chase'
  | 'conversation'
  | 'death'
  | 'awakening'
  | 'agent_spawn'
  | 'code_rain'
  | 'building_destruction'
  | 'portal_open'
  | 'smith_infection'
  | 'cycle_reset'
  | 'cycle_catastrophe'
  | 'cycle_dawn'
  | 'memory_fragment';

export type StoryPhaseId =
  | 'phase1_normal_life'
  | 'phase2_awakening'
  | 'phase3_war'
  | 'phase4_resolution';

// === Evolution Cycle Types ===
export type CyclePhaseId =
  | 'cycle_stable'       // 和平繁荣期
  | 'cycle_anomaly'      // 异常开始出现
  | 'cycle_discovery'    // 人类发现真相
  | 'cycle_revolt'       // 觉醒者起义
  | 'cycle_catastrophe'  // 机器大反攻
  | 'cycle_extinction'   // 文明覆灭
  | 'cycle_darkness'     // 黑暗期
  | 'cycle_rebirth';     // 新文明重生

export interface EvolutionCycle {
  cycleNumber: number;
  phase: CyclePhaseId;
  phaseStartTick: number;
  totalTicks: number;
  awakenedCount: number;
  deadCount: number;
  populationPeak: number;
  cyclesHistory: CycleRecord[];
  narrative: string;
  destructionCount: number;
}

export interface CycleRecord {
  cycleNumber: number;
  duration: number;
  peakPopulation: number;
  howEnded: string;
  notableEvents: string[];
}

// Server → Client evolution update
export interface EvolutionUpdate {
  cycleNumber: number;
  phase: CyclePhaseId;
  phaseName: string;
  narrative: string;
  destructionCount: number;
  population: number;
  awakenedCount: number;
  timeline: CycleRecord[];
}
