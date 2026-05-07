import { CHARACTERS, generateId, type AgentId, type AgentState, type ConversationRecord, type ConversationMessage, type Memory } from '@auto_matrix/shared';
import type { LLMClient } from '../llm/LLMClient.js';
import type { MemoryManager } from '../memory/MemoryManager.js';
import type { RelationshipGraph } from './RelationshipGraph.js';
import type { SocketServer } from '../network/SocketServer.js';
import type { StoryEngine } from '../story/StoryEngine.js';
import {
  buildMultiTurnConversationPrompt,
  buildConversationSummaryPrompt,
  buildReflectionPrompt,
} from '../llm/PromptTemplates.js';

interface ActiveConversation {
  record: ConversationRecord;
  totalTurns: number;
  currentTurn: number;
  speakerOrder: [AgentId, AgentId];
  topic: string;
}

export class ConversationEngine {
  private activeConversations: Map<string, ActiveConversation> = new Map();
  private agentConversationCooldowns: Map<AgentId, number> = new Map();
  private readonly cooldownTicks = 20;
  private readonly minTurns = 3;
  private readonly maxTurns = 5;

  constructor(
    private llmClient: LLMClient,
    private memoryManager: MemoryManager,
    private relationshipGraph: RelationshipGraph,
    private socketServer: SocketServer,
    private storyEngine: StoryEngine,
  ) {}

  /**
   * Start a new multi-turn conversation between two agents.
   * Returns the conversation id, or null if agents can't talk right now.
   */
  startConversation(
    agent1Id: AgentId,
    agent2Id: AgentId,
    agent1State: AgentState,
    agent2State: AgentState,
    topic: string | undefined,
    tick: number,
  ): string | null {
    // World separation: agents in different worlds can't talk
    if (agent1State.isInMatrix !== agent2State.isInMatrix) {
      return null;
    }

    // Cooldown check
    const cd1 = this.agentConversationCooldowns.get(agent1Id) ?? 0;
    const cd2 = this.agentConversationCooldowns.get(agent2Id) ?? 0;
    if (tick < cd1 || tick < cd2) {
      return null;
    }

    // Already in a conversation
    for (const conv of this.activeConversations.values()) {
      if (conv.record.participants.includes(agent1Id) || conv.record.participants.includes(agent2Id)) {
        return null;
      }
    }

    const totalTurns = this.minTurns + Math.floor(Math.random() * (this.maxTurns - this.minTurns + 1));
    const resolvedTopic = topic ?? this.inferTopic(agent1State, agent2State);

    const conversationId = generateId('conv');
    const record: ConversationRecord = {
      id: conversationId,
      participants: [agent1Id, agent2Id],
      messages: [],
      location: agent1State.currentLocation,
      startTick: tick,
      endTick: tick,
    };

    this.activeConversations.set(conversationId, {
      record,
      totalTurns,
      currentTurn: 0,
      speakerOrder: [agent1Id, agent2Id],
      topic: resolvedTopic,
    });

    // Set cooldowns
    this.agentConversationCooldowns.set(agent1Id, tick + this.cooldownTicks);
    this.agentConversationCooldowns.set(agent2Id, tick + this.cooldownTicks);

    // Broadcast conversation start
    this.socketServer.broadcastMessage({
      type: 'conversation_start',
      data: {
        id: conversationId,
        participants: [agent1Id, agent2Id],
        location: agent1State.currentLocation,
      },
      tick,
      timestamp: Date.now(),
    });

    // Improve familiarity
    this.relationshipGraph.modifyRelationship(agent1Id, agent2Id, { familiarity: 2 });
    this.relationshipGraph.modifyRelationship(agent2Id, agent1Id, { familiarity: 2 });

    return conversationId;
  }

  /**
   * Advance all active conversations by one turn.
   * Called once per tick from the simulation loop.
   */
  async tickConversations(
    allAgents: Map<string, AgentState>,
    tick: number,
  ): Promise<void> {
    const completedIds: string[] = [];

    for (const [convId, conv] of this.activeConversations) {
      if (conv.currentTurn >= conv.totalTurns) {
        completedIds.push(convId);
        continue;
      }

      // Determine speaker and listener for this turn
      const speakerIdx = conv.currentTurn % 2;
      const speakerId = conv.speakerOrder[speakerIdx];
      const listenerId = conv.speakerOrder[1 - speakerIdx];

      const speakerState = allAgents.get(speakerId);
      const listenerState = allAgents.get(listenerId);
      if (!speakerState || !listenerState) {
        completedIds.push(convId);
        continue;
      }

      try {
        const line = await this.generateDialogueLine(
          speakerState,
          listenerState,
          conv,
          tick,
        );

        const message: ConversationMessage = {
          speaker: speakerId,
          content: line,
          tick,
          tone: this.inferTone(speakerState, listenerState),
        };

        conv.record.messages.push(message);
        conv.currentTurn++;

        // Broadcast the message
        this.socketServer.broadcastMessage({
          type: 'conversation_message',
          data: {
            conversationId: convId,
            speaker: speakerId,
            content: line,
            tone: message.tone,
          },
          tick,
          timestamp: Date.now(),
        });

        // Also broadcast as chat bubble for the 3D view
        this.socketServer.broadcastChatBubble(speakerId, line, tick);

        // Check if conversation is now complete
        if (conv.currentTurn >= conv.totalTurns) {
          completedIds.push(convId);
        }
      } catch {
        // If LLM fails, end conversation early
        completedIds.push(convId);
      }
    }

    // Finalize completed conversations
    for (const convId of completedIds) {
      const conv = this.activeConversations.get(convId);
      if (conv) {
        await this.finalizeConversation(conv, allAgents, tick);
        this.activeConversations.delete(convId);
      }
    }
  }

  /**
   * Check whether an agent is currently in an active conversation.
   */
  isAgentInConversation(agentId: AgentId): boolean {
    for (const conv of this.activeConversations.values()) {
      if (conv.record.participants.includes(agentId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check whether an agent is on conversation cooldown.
   */
  isOnCooldown(agentId: AgentId, tick: number): boolean {
    const cd = this.agentConversationCooldowns.get(agentId) ?? 0;
    return tick < cd;
  }

  getActiveConversations(): ConversationRecord[] {
    return Array.from(this.activeConversations.values()).map(c => ({ ...c.record }));
  }

  getConversationHistory(agent1Id: AgentId, agent2Id: AgentId): Memory[] {
    return this.memoryManager.getMemoriesInvolvingAgent(agent1Id, agent2Id)
      .filter(m => m.type === 'conversation');
  }

  // ─── Private helpers ──────────────────────────────────────────

  private async generateDialogueLine(
    speaker: AgentState,
    listener: AgentState,
    conv: ActiveConversation,
    tick: number,
  ): Promise<string> {
    const speakerChar = CHARACTERS[speaker.id];
    const listenerChar = CHARACTERS[listener.id];

    const speakerMemories = this.memoryManager.getRecentContext(speaker.id, 5)
      .map(m => m.content).join('\n');
    const listenerMemories = this.memoryManager.getRecentContext(listener.id, 5)
      .map(m => m.content).join('\n');

    const rel = this.relationshipGraph.getRelationship(speaker.id, listener.id);
    const previousConversationMemories = this.getConversationHistory(speaker.id, listener.id)
      .slice(-3).map(m => m.content).join('\n');

    const phase = this.storyEngine.getCurrentPhaseId();

    const prompt = buildMultiTurnConversationPrompt(
      speaker,
      listener,
      speakerChar?.personality ?? '',
      listenerChar?.personality ?? '',
      conv.topic,
      speakerMemories,
      listenerMemories,
      rel ? `trust=${rel.trust}, fear=${rel.fear}, respect=${rel.respect}, familiarity=${rel.familiarity}` : 'unknown',
      previousConversationMemories,
      phase,
      conv.record.messages,
      speaker.id,
    );

    const response = await this.llmClient.complete({
      messages: [
        { role: 'system', content: `You are writing dialogue for ${speaker.name} in the Matrix universe. Stay strictly in character. Reply with ONLY the dialogue line — no stage directions, no speaker name prefix, no quotes around the whole thing.` },
        { role: 'user', content: prompt },
      ],
      maxTokens: 256,
      temperature: 0.85,
    });

    let line = response.content.trim();
    // Strip any accidental "SpeakerName:" prefix the LLM might add
    const namePrefix = `${speaker.name}:`;
    if (line.toLowerCase().startsWith(namePrefix.toLowerCase())) {
      line = line.substring(namePrefix.length).trim();
    }
    // Strip surrounding quotes
    if ((line.startsWith('"') && line.endsWith('"')) || (line.startsWith('“') && line.endsWith('”'))) {
      line = line.slice(1, -1).trim();
    }

    return line || `${speaker.name} nods thoughtfully.`;
  }

  private async finalizeConversation(
    conv: ActiveConversation,
    allAgents: Map<string, AgentState>,
    tick: number,
  ): Promise<void> {
    conv.record.endTick = tick;

    // Generate summary via LLM
    const summary = await this.generateSummary(conv);

    // Broadcast conversation end
    this.socketServer.broadcastMessage({
      type: 'conversation_end',
      data: {
        conversationId: conv.record.id,
        participants: conv.record.participants,
        summary,
      },
      tick,
      timestamp: Date.now(),
    });

    // Store conversation memories for both participants
    for (const agentId of conv.record.participants) {
      const agentState = allAgents.get(agentId);
      const otherIds = conv.record.participants.filter(id => id !== agentId);

      this.memoryManager.record(agentId, 'conversation', summary, {
        importance: 6,
        relatedAgents: otherIds,
        location: conv.record.location,
        emotion: this.inferEmotionFromConversation(conv),
        tags: ['conversation', conv.topic],
      });
    }

    // Generate reflections for both agents
    await this.generateReflections(conv, allAgents, tick);

    // Adjust relationship based on conversation content
    this.adjustRelationshipFromConversation(conv);
  }

  private async generateSummary(conv: ActiveConversation): Promise<string> {
    const dialogueText = conv.record.messages
      .map(m => `${m.speaker}: ${m.content}`)
      .join('\n');

    const prompt = buildConversationSummaryPrompt(
      conv.record.participants,
      conv.topic,
      dialogueText,
    );

    const response = await this.llmClient.complete({
      messages: [
        { role: 'system', content: 'You are a narrative summarizer for the Matrix universe. Write a concise 1-2 sentence summary of the conversation.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 200,
      temperature: 0.5,
    });

    return response.content.trim() || `${conv.record.participants.join(' and ')} had a conversation about ${conv.topic}.`;
  }

  private async generateReflections(
    conv: ActiveConversation,
    allAgents: Map<string, AgentState>,
    tick: number,
  ): Promise<void> {
    for (const agentId of conv.record.participants) {
      const agentState = allAgents.get(agentId);
      if (!agentState) continue;

      const character = CHARACTERS[agentId];
      const otherIds = conv.record.participants.filter(id => id !== agentId);
      const otherState = allAgents.get(otherIds[0]);

      const dialogueText = conv.record.messages
        .map(m => `${m.speaker}: ${m.content}`)
        .join('\n');

      const prompt = buildReflectionPrompt(
        agentState,
        character?.personality ?? '',
        dialogueText,
        otherState?.name ?? 'someone',
      );

      try {
        const response = await this.llmClient.complete({
          messages: [
            { role: 'system', content: `You are ${agentState.name}. Reflect on the conversation you just had. Reply in JSON format: {"insights": ["..."], "updatedGoals": ["..."], "moodChange": "new mood or empty string"}` },
            { role: 'user', content: prompt },
          ],
          maxTokens: 300,
          temperature: 0.6,
        });

        const parsed = this.safeParseReflection(response.content);
        if (parsed) {
          // Store reflection as a memory
          if (parsed.insights.length > 0) {
            this.memoryManager.record(agentId, 'reflection', parsed.insights.join('. '), {
              importance: 7,
              relatedAgents: otherIds,
              location: conv.record.location,
              emotion: 'contemplative',
              tags: ['reflection', 'post-conversation'],
            });
          }
        }
      } catch {
        // Reflection failure is non-critical
      }
    }
  }

  private safeParseReflection(content: string): { insights: string[]; updatedGoals: string[]; moodChange: string } | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        updatedGoals: Array.isArray(parsed.updatedGoals) ? parsed.updatedGoals : [],
        moodChange: typeof parsed.moodChange === 'string' ? parsed.moodChange : '',
      };
    } catch {
      return null;
    }
  }

  private adjustRelationshipFromConversation(conv: ActiveConversation): void {
    const [id1, id2] = conv.record.participants;

    // Positive conversation (no hostile keywords) improves trust
    const hostileKeywords = ['attack', 'kill', 'destroy', 'hate', 'enemy', 'threat'];
    const fullText = conv.record.messages.map(m => m.content.toLowerCase()).join(' ');
    const isHostile = hostileKeywords.some(kw => fullText.includes(kw));

    if (isHostile) {
      this.relationshipGraph.adjustTrust(id1, id2, -3);
      this.relationshipGraph.adjustTrust(id2, id1, -3);
      this.relationshipGraph.adjustFear(id1, id2, 2);
      this.relationshipGraph.adjustFear(id2, id1, 2);
    } else {
      this.relationshipGraph.adjustTrust(id1, id2, 3);
      this.relationshipGraph.adjustTrust(id2, id1, 3);
      this.relationshipGraph.adjustRespect(id1, id2, 1);
      this.relationshipGraph.adjustRespect(id2, id1, 1);
    }

    // Familiarity always increases from conversation
    this.relationshipGraph.modifyRelationship(id1, id2, { familiarity: 5 });
    this.relationshipGraph.modifyRelationship(id2, id1, { familiarity: 5 });
  }

  private inferTopic(agent1: AgentState, agent2: AgentState): string {
    // Infer a plausible topic based on agent states
    if (agent1.faction === agent2.faction) {
      return 'discussing faction strategy and recent events';
    }
    if (agent1.faction === 'machines' || agent2.faction === 'machines') {
      return 'confrontation between human and machine';
    }
    if (!agent1.isAwakened && !agent2.isAwakened) {
      return 'everyday life in the Matrix';
    }
    if (agent1.isAwakened !== agent2.isAwakened) {
      return 'the nature of reality and the truth about the Matrix';
    }
    return 'recent events and what lies ahead';
  }

  private inferTone(speaker: AgentState, listener: AgentState): string {
    const rel = this.relationshipGraph.getRelationship(speaker.id, listener.id);
    if (!rel) return 'neutral';

    if (rel.fear > 50) return 'tense';
    if (rel.trust > 50) return 'friendly';
    if (rel.respect > 50) return 'respectful';
    if (rel.trust < -30) return 'hostile';
    return 'neutral';
  }

  private inferEmotionFromConversation(conv: ActiveConversation): string {
    const fullText = conv.record.messages.map(m => m.content.toLowerCase()).join(' ');

    if (fullText.includes('afraid') || fullText.includes('scared') || fullText.includes('fear')) return 'fearful';
    if (fullText.includes('angry') || fullText.includes('hate')) return 'angry';
    if (fullText.includes('happy') || fullText.includes('glad') || fullText.includes('wonderful')) return 'happy';
    if (fullText.includes('sad') || fullText.includes('sorry') || fullText.includes('loss')) return 'sad';
    if (fullText.includes('trust') || fullText.includes('friend') || fullText.includes('ally')) return 'trusting';
    if (fullText.includes('suspicious') || fullText.includes('doubt')) return 'suspicious';
    return 'thoughtful';
  }
}
