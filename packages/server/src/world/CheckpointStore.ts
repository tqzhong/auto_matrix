import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentState, Relationship, StoryPhaseId, WorldEvent, SandboxState } from '@auto_matrix/shared';

export interface WorldCheckpoint {
  version: 1;
  tick: number;
  timeOfDay?: number;
  day?: number;
  phase: StoryPhaseId;
  agents: Record<string, AgentState>;
  events: WorldEvent[];
  relationships: Relationship[];
  sandbox?: SandboxState;
}

export class CheckpointStore {
  private pending: Promise<void> = Promise.resolve();
  constructor(private file: string) {}

  async load(): Promise<WorldCheckpoint | null> {
    try {
      const checkpoint = JSON.parse(await fs.readFile(this.file, 'utf8')) as WorldCheckpoint;
      if (checkpoint.version !== 1 || !Number.isSafeInteger(checkpoint.tick) || checkpoint.tick < 0 || !checkpoint.agents || !Array.isArray(checkpoint.events) || !Array.isArray(checkpoint.relationships)) throw new Error('Unsupported world checkpoint');
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
