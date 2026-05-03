// Agent 核心类型定义
export type AgentId = string;
export type FactionId = string;
export type AgentStatus = 'alive' | 'dead' | 'disconnected' | 'transcended';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface AgentState {
  id: AgentId;
  name: string;
  faction: FactionId;
  status: AgentStatus;

  // 位置与移动
  position: Vector3;
  rotation: number;
  velocity: Vector3;
  targetPosition: Vector3 | null;
  currentPath: Vector3[];

  // 物理状态
  health: number;
  maxHealth: number;
  isAwakened: boolean;
  isInMatrix: boolean;
  currentLocation: string;

  // 认知状态
  currentGoal: string;
  currentAction: AgentAction | null;
  mood: string;
  alertness: number;

  // 能力
  abilities: Ability[];
  activeEffects: ActiveEffect[];

  // 视觉
  appearance: AppearanceConfig;
}

export interface AppearanceConfig {
  bodyColor: string;
  headColor: string;
  clothing: string;
  accessories: string[];
  isAgent: boolean;
}

export interface AgentAction {
  type: ActionType;
  target?: AgentId;
  parameters: Record<string, unknown>;
  startedAt: number;
  duration: number;
  progress: number;
}

export type ActionType =
  | 'idle'
  | 'move_to'
  | 'talk_to'
  | 'attack'
  | 'defend'
  | 'use_ability'
  | 'interact_object'
  | 'enter_location'
  | 'exit_location'
  | 'hide'
  | 'observe'
  | 'train'
  | 'hack';

export interface Ability {
  id: string;
  name: string;
  description: string;
  cooldownTicks: number;
  currentCooldown: number;
  requiredAwakened: boolean;
  powerLevel: number;
  visualEffect: string;
}

export interface ActiveEffect {
  abilityId: string;
  remainingTicks: number;
  visualEffect: string;
}

// 记忆系统
export type MemoryType =
  | 'observation'
  | 'conversation'
  | 'combat'
  | 'discovery'
  | 'reflection'
  | 'story_event'
  | 'relationship';

export interface Memory {
  id: string;
  agentId: AgentId;
  type: MemoryType;
  content: string;
  importance: number;
  timestamp: number;
  relatedAgents: AgentId[];
  location: string;
  emotion: string;
  tags: string[];
}

export interface ConversationRecord {
  id: string;
  participants: AgentId[];
  messages: ConversationMessage[];
  location: string;
  startTick: number;
  endTick: number;
  summary?: string;
}

export interface ConversationMessage {
  speaker: AgentId;
  content: string;
  tick: number;
  tone: string;
}

export interface Reflection {
  id: string;
  agentId: AgentId;
  insights: string[];
  updatedGoals: string[];
  relationshipChanges: {
    targetAgent: AgentId;
    newDisposition: string;
    reason: string;
  }[];
  timestamp: number;
}

// 关系图
export interface Relationship {
  fromAgent: AgentId;
  toAgent: AgentId;
  trust: number;
  fear: number;
  respect: number;
  familiarity: number;
  lastInteraction: number;
  notes: string;
}
