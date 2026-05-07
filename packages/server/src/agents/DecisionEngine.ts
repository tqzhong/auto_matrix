import type { AgentState, AgentAction, Vector3 } from '@auto_matrix/shared';
import { STORY_PHASES, CHARACTERS, distance } from '@auto_matrix/shared';
import type { Agent } from './Agent.js';
import type { StoryEngine } from '../story/StoryEngine.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { MemoryManager } from '../memory/MemoryManager.js';
import type { RelationshipGraph } from './RelationshipGraph.js';
import type { ConversationEngine } from './ConversationEngine.js';

export class DecisionEngine {
  constructor(
    private llmClient: LLMClient,
    private memoryManager: MemoryManager,
    private relationshipGraph: RelationshipGraph,
    private storyEngine: StoryEngine,
    private conversationEngine: ConversationEngine,
  ) {}

  async batchDecide(agents: Agent[], allAgents: Map<string, AgentState>, tick: number): Promise<void> {
    const groups = this.groupByLocation(agents);

    for (const [, group] of groups) {
      const needsDecision = group.filter(a => {
        // Skip agents currently in an active conversation
        if (this.conversationEngine.isAgentInConversation(a.id)) return false;
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

    // Get memories as string for context
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
    const nearbyDesc = nearby.map(a => {
      const rel = this.relationshipGraph.getRelationship(state.id, a.id);
      const relHint = rel
        ? ` [trust:${rel.trust} fear:${rel.fear} respect:${rel.respect}]`
        : '';
      return `- ${a.name} (${a.faction}): ${distance(a.position, state.position).toFixed(1)}m, ${a.currentAction?.type || 'idle'}${relHint}`;
    }).join('\n');

    // Include conversation memories specifically
    const convMemories = this.memoryManager.getMemoriesByType(state.id, 'conversation');
    const recentConvStr = convMemories.slice(-3).map(m => `[conversation] ${m.content}`).join('\n');
    const reflectionStr = this.memoryManager.getMemoriesByType(state.id, 'reflection')
      .slice(-2).map(m => `[reflection] ${m.content}`).join('\n');

    return `You are ${state.name}. Current state: health=${state.health}/100, mood=${state.mood}, goal="${state.currentGoal}", awakened=${state.isAwakened}, inMatrix=${state.isInMatrix}, phase=${phase}.

Nearby: ${nearbyDesc || '(nobody)'}
Recent: ${memories || '(nothing)'}
${recentConvStr ? `Past Conversations:\n${recentConvStr}` : ''}
${reflectionStr ? `Reflections:\n${reflectionStr}` : ''}

Choose ONE action: idle, move_to, talk_to, attack, observe, defend.
If you choose talk_to, specify which nearby character and a brief reason.
Reply: ACTION: <type> TARGET: <id or none> REASON: <brief>`;
  }

  private parseAction(content: string, state: AgentState, nearby: AgentState[], tick: number): AgentAction {
    const lower = content.toLowerCase();

    if (lower.includes('talk') && nearby.length > 0) {
      // Try to find a specific target mentioned in the response
      let target = this.findNamedTarget(content, nearby);
      if (!target) {
        target = nearby[Math.floor(Math.random() * nearby.length)];
      }

      // Don't start conversation if target is already in one
      if (this.conversationEngine.isAgentInConversation(target.id)) {
        return this.createIdleAction(tick);
      }

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

  /**
   * Try to find a specific target mentioned by name in the LLM response.
   */
  private findNamedTarget(content: string, nearby: AgentState[]): AgentState | null {
    const lower = content.toLowerCase();
    for (const agent of nearby) {
      if (lower.includes(agent.name.toLowerCase())) {
        return agent;
      }
    }
    return null;
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
