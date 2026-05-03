// 故事系统类型
import type { AgentId, Vector3 } from './agent.js';
import type { StoryPhaseId } from './world.js';

export interface StoryPhase {
  id: StoryPhaseId;
  name: string;
  description: string;
  entryConditions: PhaseCondition[];
  exitConditions: PhaseCondition[];
  activeEvents: StoryEvent[];
  npcBehaviors: Record<string, BehaviorDirective>;
  duration?: number;
}

export interface PhaseCondition {
  type: 'agent_action' | 'time_elapsed' | 'relationship_threshold' | 'event_occurred' | 'agent_count';
  parameters: Record<string, unknown>;
}

export interface StoryEvent {
  id: string;
  name: string;
  phase: StoryPhaseId;
  trigger: PhaseCondition;
  actions: StoryAction[];
  involvedAgents: AgentId[];
  priority: number;
  fired: boolean;
}

export interface StoryAction {
  type: 'spawn_agent' | 'move_agent' | 'set_goal' | 'trigger_dialogue' |
        'change_relationship' | 'world_change' | 'narrate' | 'kill_agent' |
        'awaken_agent' | 'spawn_smith_copy';
  parameters: Record<string, unknown>;
}

export interface BehaviorDirective {
  factionId: string;
  phase: StoryPhaseId;
  defaultGoal: string;
  movementPattern: 'patrol' | 'wander' | 'stationary' | 'follow_leader' | 'scripted';
  aggressionLevel: number;
  alertLevel: number;
  specialBehaviors: string[];
}
