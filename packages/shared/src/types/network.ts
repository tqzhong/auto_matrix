// WebSocket 消息类型
import type { AgentId, AgentState } from './agent.js';
import type { ChunkData, LocationData, StoryPhaseId, WorldEvent } from './world.js';

// Server → Client
export type ServerMessageType =
  | 'world_state_full'
  | 'world_state_delta'
  | 'agent_update'
  | 'agent_action'
  | 'conversation_start'
  | 'conversation_message'
  | 'conversation_end'
  | 'story_event'
  | 'phase_change'
  | 'world_event'
  | 'chat_bubble'
  | 'effect'
  | 'notification';

export interface ServerMessage {
  type: ServerMessageType;
  data: unknown;
  tick: number;
  timestamp: number;
}

export interface WorldStateFull {
  agents: Record<AgentId, AgentState>;
  chunks: Record<string, { blocks: number[] }>;
  locations: Record<string, LocationData>;
  phase: StoryPhaseId;
  timeOfDay: number;
}

export interface WorldStateDelta {
  agents: Record<string, Partial<AgentState>>;
  dirtyChunks: Record<string, { blocks: number[] }>;
  events: WorldEvent[];
}

export interface ConversationStartData {
  id: string;
  participants: AgentId[];
  location: string;
}

export interface ConversationMessageData {
  conversationId: string;
  speaker: AgentId;
  content: string;
  tone: string;
}

export interface StoryEventData {
  name: string;
  description: string;
  importance: number;
}

export interface EffectData {
  effectType: string;
  agents: AgentId[];
  duration: number;
}

// Client → Server
export type ClientMessageType =
  | 'request_full_state'
  | 'focus_agent'
  | 'inspect_agent'
  | 'set_speed'
  | 'pause'
  | 'resume'
  | 'teleport_camera'
  | 'debug_command';

export interface ClientMessage {
  type: ClientMessageType;
  data: unknown;
}
