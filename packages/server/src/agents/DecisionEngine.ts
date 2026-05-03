import type { AgentState, AgentAction, Vector3 } from '@auto_matrix/shared';
import { STORY_PHASES, CHARACTERS, distance } from '@auto_matrix/shared';
import type { Agent } from './Agent.js';
import type { StoryEngine } from '../story/StoryEngine.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { MemoryManager } from '../memory/MemoryManager.js';
import type { RelationshipGraph } from './RelationshipGraph.js';

export class DecisionEngine {
  constructor(
    private llmClient: LLMClient,
    private memoryManager: MemoryManager,
    private relationshipGraph: RelationshipGraph,
    private storyEngine: StoryEngine,
  ) {}

  async batchDecide(agents: Agent[], allAgents: Map<string, AgentState>, tick: number): Promise<void> {
    const groups = this.groupByLocation(agents);

    for (const [, group] of groups) {
      const needsDecision = group.filter(a => {
        const action = a.state.currentAction;
        return !action || action.progress >= 1;
      });

      if (needsDecision.length === 0) continue;

      for (const agent of needsDecision) {
        try {
          const action = await this.decideForAgent(agent, allAgents, tick);
          agent.setAction(action);
        } catch {
          agent.setAction(this.createIdleAction(tick));
        }
      }
    }
  }

  private async decideForAgent(agent: Agent, allAgents: Map<string, AgentState>, tick: number): Promise<AgentAction> {
    const state = agent.state;
    const character = CHARACTERS[state.id];
    if (!character) return this.createIdleAction(tick);

    const nearby = Array.from(allAgents.values()).filter(a =>
      a.id !== state.id && distance(a.position, state.position) < 30 && a.status === 'alive'
    );

    const tier = this.determineTier(state, nearby);

    if (tier === 'routine') {
      return this.ruleBasedDecision(state, nearby, tick);
    }

    // Get memories as string
    const memories = this.memoryManager.getRecentContext(state.id, 10);
    const memoriesStr = memories.map(m => `[${m.type}] ${m.content}`).join('\n');
    const phase = this.storyEngine.getCurrentPhaseId();

    try {
      const response = await this.llmClient.complete({
        messages: [
          { role: 'system', content: character.personality },
          { role: 'user', content: this.buildDecisionPrompt(state, nearby, memoriesStr, phase) },
        ],
        maxTokens: 512,
        temperature: 0.7,
      });

      return this.parseAction(response.content, state, nearby, tick);
    } catch {
      return this.ruleBasedDecision(state, nearby, tick);
    }
  }

  private determineTier(state: AgentState, nearby: AgentState[]): 'routine' | 'awareness' | 'full' {
    if (state.currentAction?.type === 'talk_to' || state.currentAction?.type === 'attack') return 'full';
    if (nearby.length > 2) return 'awareness';
    if (state.alertness > 7) return 'awareness';
    return 'routine';
  }

  private ruleBasedDecision(state: AgentState, nearby: AgentState[], tick: number): AgentAction {
    const phase = this.storyEngine.getCurrentPhaseId();
    const behavior = STORY_PHASES[phase]?.npcBehaviors?.[state.faction];

    if (!behavior) return this.createIdleAction(tick);

    if (behavior.movementPattern === 'patrol' || behavior.movementPattern === 'wander') {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 10;
      return {
        type: 'move_to',
        parameters: {
          destination: {
            x: state.position.x + Math.cos(angle) * dist,
            y: state.position.y,
            z: state.position.z + Math.sin(angle) * dist,
          },
        },
        startedAt: tick,
        duration: 10,
        progress: 0,
      };
    }

    return this.createIdleAction(tick);
  }

  private buildDecisionPrompt(state: AgentState, nearby: AgentState[], memories: string, phase: string): string {
    const nearbyDesc = nearby.map(a =>
      `- ${a.name} (${a.faction}): ${distance(a.position, state.position).toFixed(1)}m, ${a.currentAction?.type || 'idle'}`
    ).join('\n');

    return `You are ${state.name}. Current state: health=${state.health}/100, mood=${state.mood}, goal="${state.currentGoal}", awakened=${state.isAwakened}, phase=${phase}.

Nearby: ${nearbyDesc || '(nobody)'}
Recent: ${memories || '(nothing)'}

Choose ONE action: idle, move_to, talk_to, attack, observe, defend.
Reply: ACTION: <type> TARGET: <id or none> REASON: <brief>`;
  }

  private parseAction(content: string, state: AgentState, nearby: AgentState[], tick: number): AgentAction {
    const lower = content.toLowerCase();

    if (lower.includes('talk') && nearby.length > 0) {
      const target = nearby[Math.floor(Math.random() * nearby.length)];
      return {
        type: 'talk_to',
        target: target.id,
        parameters: { dialogue: content.substring(0, 200) },
        startedAt: tick,
        duration: 15,
        progress: 0,
      };
    }

    if (lower.includes('attack') && nearby.length > 0) {
      const target = nearby[Math.floor(Math.random() * nearby.length)];
      return { type: 'attack', target: target.id, parameters: {}, startedAt: tick, duration: 5, progress: 0 };
    }

    if (lower.includes('move')) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 15;
      return {
        type: 'move_to',
        parameters: { destination: { x: state.position.x + Math.cos(angle) * dist, y: state.position.y, z: state.position.z + Math.sin(angle) * dist } },
        startedAt: tick,
        duration: 10,
        progress: 0,
      };
    }

    if (lower.includes('observe')) {
      return { type: 'observe', parameters: {}, startedAt: tick, duration: 5, progress: 0 };
    }

    return this.createIdleAction(tick);
  }

  private createIdleAction(tick: number): AgentAction {
    return { type: 'idle', parameters: {}, startedAt: tick, duration: 5, progress: 0 };
  }

  private groupByLocation(agents: Agent[]): Map<string, Agent[]> {
    const groups = new Map<string, Agent[]>();
    for (const agent of agents) {
      const loc = agent.state.currentLocation || 'unknown';
      if (!groups.has(loc)) groups.set(loc, []);
      groups.get(loc)!.push(agent);
    }
    return groups;
  }
}
