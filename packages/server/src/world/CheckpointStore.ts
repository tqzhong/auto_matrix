import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentState, Relationship, StoryPhaseId, WorldEvent, SandboxState } from '@auto_matrix/shared';
import type { ConversationCheckpoint } from '../agents/ConversationEngine.js';

export interface WorldCheckpoint {
  version: 1;
  tick: number;
  timeOfDay?: number;
  day?: number;
  simulation?: { running: boolean; speed: number };
  phase: StoryPhaseId;
  agents: Record<string, AgentState>;
  events: WorldEvent[];
  relationships: Relationship[];
  sandbox?: SandboxState;
  conversations?: ConversationCheckpoint;
}

export class CheckpointStore {
  private pending: Promise<void> = Promise.resolve();
  constructor(private file: string) {}

  async load(): Promise<WorldCheckpoint | null> {
    try {
      const checkpoint = JSON.parse(await fs.readFile(this.file, 'utf8')) as WorldCheckpoint;
      if (checkpoint.version !== 1 || !Number.isSafeInteger(checkpoint.tick) || checkpoint.tick < 0 || !checkpoint.agents || !Array.isArray(checkpoint.events) || !Array.isArray(checkpoint.relationships)) throw new Error('Unsupported world checkpoint');
      if (checkpoint.simulation !== undefined && (!checkpoint.simulation || typeof checkpoint.simulation.running !== 'boolean' || ![0.5, 1, 2, 4, 8].includes(checkpoint.simulation.speed))) throw new Error('Unsupported world checkpoint');
      if (checkpoint.conversations !== undefined) {
        const saved = checkpoint.conversations;
        if (!saved || !Array.isArray(saved.active) || saved.active.length > 5 || !Array.isArray(saved.cooldowns)) throw new Error('Unsupported world checkpoint');
        const ids = new Set<string>(), participants = new Set<string>();
        const validLines = (lines: unknown): lines is string[] => Array.isArray(lines) && lines.length === 3 && lines.every(line => typeof line === 'string' && line.length > 0);
        for (const conv of saved.active) {
          if (!conv || typeof conv.ordinary !== 'boolean' || typeof conv.awaitingModel !== 'boolean' || typeof conv.topic !== 'string' || !Number.isSafeInteger(conv.nextTurn) || conv.nextTurn < 0 || !validLines(conv.lines) || conv.modelLines !== undefined && !validLines(conv.modelLines)) throw new Error('Unsupported world checkpoint');
          const record = conv.record;
          if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id) || typeof record.location !== 'string' || !Number.isSafeInteger(record.startTick) || record.startTick < 0 || record.startTick > checkpoint.tick || !Number.isSafeInteger(record.endTick) || !Array.isArray(record.participants) || record.participants.length !== 2 || !Array.isArray(record.messages) || record.messages.length > 2) throw new Error('Unsupported world checkpoint');
          ids.add(record.id);
          for (const id of record.participants) {
            if (typeof id !== 'string' || !checkpoint.agents[id] || participants.has(id)) throw new Error('Unsupported world checkpoint');
            participants.add(id);
          }
          for (const [turn, line] of record.messages.entries()) {
            if (!line || line.speaker !== record.participants[turn % 2] || typeof line.content !== 'string' || !line.content || typeof line.tone !== 'string' || !Number.isSafeInteger(line.tick) || line.tick < record.startTick || line.tick > checkpoint.tick || line.content !== conv.lines[turn]) throw new Error('Unsupported world checkpoint');
          }
        }
        for (const entry of saved.cooldowns) {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !checkpoint.agents[entry[0]] || !Number.isSafeInteger(entry[1]) || entry[1] < 0) throw new Error('Unsupported world checkpoint');
        }
      }
      return checkpoint;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  save(checkpoint: WorldCheckpoint): Promise<void> {
    const data = JSON.stringify(checkpoint);
    this.pending = this.pending.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(`${this.file}.tmp`, data, 'utf8');
      await fs.rename(`${this.file}.tmp`, this.file);
    });
    return this.pending;
  }
}
