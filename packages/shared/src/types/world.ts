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
  | 'smith_infection';

export type StoryPhaseId =
  | 'phase1_normal_life'
  | 'phase2_awakening'
  | 'phase3_war'
  | 'phase4_resolution';
