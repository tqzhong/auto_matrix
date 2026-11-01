import { promises as fs } from 'fs';
import path from 'path';
import type { AgentId, Memory, MemoryType } from '@auto_matrix/shared';
import { MemoryManager } from './MemoryManager.js';

interface PersistedMemories {
  agentId: AgentId;
  memories: Memory[];
  lastSaved: number;
}

export class PersistentMemoryManager extends MemoryManager {
  private dataDir: string;
  private dirtyAgents: Set<AgentId> = new Set();
  private loaded = false;
  private pending: Promise<void> = Promise.resolve();

  constructor(dataDir: string = 'data/memories') {
    super();
    this.dataDir = dataDir;
  }

  getCheckpoint(agentIds: Iterable<AgentId>): Record<AgentId, Memory[]> {
    return Object.fromEntries([...agentIds].map(id => [id, this.getAllMemories(id)]));
  }

  restoreCheckpoint(memories: Record<AgentId, Memory[]>): void {
    for (const [id, entries] of Object.entries(memories)) this.replaceMemories(id, entries);
    this.dirtyAgents.clear();
    this.loaded = true;
  }

  /**
   * Load all agent memories from disk. Call once at server start.
   */
  async loadAll(): Promise<number> {
    let totalLoaded = 0;
    await fs.mkdir(this.dataDir, { recursive: true });
    const files = await fs.readdir(this.dataDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(this.dataDir, file);
        const raw = await fs.readFile(filePath, 'utf-8');
        const data: PersistedMemories = JSON.parse(raw);
        if (!data || data.agentId !== path.basename(file, '.json') || !Array.isArray(data.memories)
          || data.memories.some(memory => !memory || memory.agentId !== data.agentId || typeof memory.id !== 'string'
            || typeof memory.content !== 'string' || !Number.isFinite(memory.timestamp) || !Number.isFinite(memory.importance)
            || !Array.isArray(memory.tags) || !Array.isArray(memory.relatedAgents))) throw new Error('Unsupported character memories');
        this.replaceMemories(data.agentId, data.memories);
        totalLoaded += data.memories.length;
      } catch (error) {
        throw new Error(`Cannot load character memory ${file}`, { cause: error });
      }
    }

    this.loaded = true;
    return totalLoaded;
  }

  /**
   * Override record to track dirty agents.
   */
  override record(
    agentId: AgentId,
    type: MemoryType,
    content: string,
    options: {
      importance?: number;
      relatedAgents?: AgentId[];
      location?: string;
      emotion?: string;
      tags?: string[];
    } = {},
  ): Memory {
    const memory = super.record(agentId, type, content, options);
    this.dirtyAgents.add(agentId);
    return memory;
  }

  /**
   * Save all dirty agents to disk. Call periodically (every 60 ticks).
   */
  async saveAll(): Promise<number> {
    if (this.dirtyAgents.size === 0) { await this.pending; return 0; }

    const agentsToSave = Array.from(this.dirtyAgents);
    this.dirtyAgents = new Set();
    // Capture and enqueue every snapshot before disk I/O yields to new events.
    const saved = await Promise.all(agentsToSave.map(async agentId => {
      try {
        await this.writeAgent(agentId);
        return 1;
      } catch {
        // Re-add to dirty set so we retry next time
        this.dirtyAgents.add(agentId);
        return 0;
      }
    }));
    return saved.reduce<number>((sum, count) => sum + count, 0);
  }

  /**
   * Save a single agent's memories to disk immediately.
   */
  async saveAgent(agentId: AgentId): Promise<void> {
    this.dirtyAgents.delete(agentId);
    try { await this.writeAgent(agentId); }
    catch (error) { this.dirtyAgents.add(agentId); throw error; }
  }

  private writeAgent(agentId: AgentId): Promise<void> {
    const memories = this.getAllMemories(agentId);
    const data: PersistedMemories = {
      agentId,
      memories,
      lastSaved: Date.now(),
    };
    const serialized = JSON.stringify(data, null, 2);
    const filePath = path.join(this.dataDir, `${agentId}.json`);
    this.pending = this.pending.catch(() => {}).then(async () => {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(`${filePath}.tmp`, serialized, 'utf-8');
      await fs.rename(`${filePath}.tmp`, filePath);
    });
    return this.pending;
  }

  /**
   * Consolidate memories for an agent: merge similar memories,
   * increase importance of recurring themes.
   */
  consolidate(agentId: AgentId): number {
    const memories = this.getAllMemories(agentId);
    if (memories.length < 3) return 0;

    let mergeCount = 0;
    const merged: Memory[] = [];
    const consumed = new Set<string>();

    // Group by type for potential merging
    const byType = new Map<MemoryType, Memory[]>();
    for (const mem of memories) {
      const group = byType.get(mem.type) ?? [];
      group.push(mem);
      byType.set(mem.type, group);
    }

    for (const [, group] of byType) {
      for (let i = 0; i < group.length; i++) {
        if (consumed.has(group[i].id)) continue;

        const base = group[i];
        const similar: Memory[] = [base];

        for (let j = i + 1; j < group.length; j++) {
          if (consumed.has(group[j].id)) continue;
          if (this.areSimilar(base, group[j])) {
            similar.push(group[j]);
            consumed.add(group[j].id);
          }
        }

        if (similar.length > 1) {
          // Merge: combine content, boost importance
          const combinedContent = similar.map(s => s.content).join('; ');
          const maxImportance = Math.min(10, Math.max(...similar.map(s => s.importance)) + 1);
          const allTags = [...new Set(similar.flatMap(s => s.tags))];
          const allRelated = [...new Set(similar.flatMap(s => s.relatedAgents))];

          merged.push({
            ...base,
            content: combinedContent,
            importance: maxImportance,
            tags: allTags,
            relatedAgents: allRelated,
          });
          mergeCount++;
        } else {
          merged.push(base);
        }
      }
    }

    // Detect recurring themes and boost their importance
    const themeCounts = new Map<string, number>();
    for (const mem of merged) {
      for (const tag of mem.tags) {
        themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
      }
    }

    for (const mem of merged) {
      let themeBoost = 0;
      for (const tag of mem.tags) {
        const count = themeCounts.get(tag) ?? 0;
        if (count >= 3) themeBoost += 1;
      }
      if (themeBoost > 0) {
        mem.importance = Math.min(10, mem.importance + themeBoost);
      }
    }

    // If we made changes, replace the agent's memory store
    if (mergeCount > 0) {
      this.replaceMemories(agentId, merged);
      this.dirtyAgents.add(agentId);
    }

    return mergeCount;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getDirtyCount(): number {
    return this.dirtyAgents.size;
  }

  /**
   * Check if two memories are similar enough to merge.
   */
  private areSimilar(a: Memory, b: Memory): boolean {
    // Same type required
    if (a.type !== b.type) return false;

    // Same location bonus
    const sameLocation = !!(a.location && b.location && a.location === b.location);

    // Check content similarity via shared keywords
    const wordsA = new Set(a.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const wordsB = new Set(b.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) overlap++;
    }
    const similarity = overlap / Math.max(wordsA.size, wordsB.size, 1);

    // Similar if >40% word overlap, or >20% with same location
    return similarity > 0.4 || (sameLocation && similarity > 0.2);
  }
}
