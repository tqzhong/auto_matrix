import { generateId, type AgentId, type Memory, type MemoryType } from '@auto_matrix/shared';

export class MemoryManager {
  private memories: Map<AgentId, Memory[]> = new Map();
  private readonly maxMemoriesPerAgent = 50;

  record(
    agentId: AgentId,
    type: MemoryType,
    content: string,
    options: {
      importance?: number;
      relatedAgents?: AgentId[];
      location?: string;
      emotion?: string;
      tags?: string[];
    } = {}
  ): Memory {
    const memory: Memory = {
      id: generateId('mem'),
      agentId,
      type,
      content,
      importance: options.importance ?? 5,
      timestamp: Date.now(),
      relatedAgents: options.relatedAgents ?? [],
      location: options.location ?? '',
      emotion: options.emotion ?? 'neutral',
      tags: options.tags ?? [],
    };

    const existing = this.memories.get(agentId) ?? [];
    existing.push(memory);
    if (existing.length > this.maxMemoriesPerAgent) {
      // Keep the most important memories
      existing.sort((a, b) => b.importance - a.importance);
      existing.length = this.maxMemoriesPerAgent;
    }
    this.memories.set(agentId, existing);
    return memory;
  }

  getRecentContext(agentId: AgentId, count: number): Memory[] {
    const existing = this.memories.get(agentId) ?? [];
    return existing.slice(-count);
  }

  getImportantMemories(agentId: AgentId, count: number): Memory[] {
    const existing = this.memories.get(agentId) ?? [];
    return [...existing].sort((a, b) => b.importance - a.importance).slice(0, count);
  }

  getMemoriesByType(agentId: AgentId, type: MemoryType): Memory[] {
    const existing = this.memories.get(agentId) ?? [];
    return existing.filter((m) => m.type === type);
  }

  getMemoriesInvolvingAgent(agentId: AgentId, targetAgentId: AgentId): Memory[] {
    const existing = this.memories.get(agentId) ?? [];
    return existing.filter((m) => m.relatedAgents.includes(targetAgentId));
  }

  getAllMemories(agentId: AgentId): Memory[] {
    return [...(this.memories.get(agentId) ?? [])];
  }

  getMemoryCount(agentId: AgentId): number {
    return this.memories.get(agentId)?.length ?? 0;
  }
}
