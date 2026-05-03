import { CHARACTERS, FACTIONS, type AgentId, type Relationship } from '@auto_matrix/shared';

export class RelationshipGraph {
  private relationships: Map<string, Relationship> = new Map();

  initialize(): void {
    const characters = Object.values(CHARACTERS);
    for (const charA of characters) {
      for (const charB of characters) {
        if (charA.id === charB.id) continue;
        const key = this.key(charA.id, charB.id);
        if (this.relationships.has(key)) continue;

        let trust = 0;
        let fear = 0;
        let respect = 30;
        let familiarity = 20;

        // Allies
        if (charA.allies.includes(charB.id)) {
          trust = 60;
          respect = 50;
          familiarity = 60;
        }

        // Enemies
        if (charA.enemies.includes(charB.id)) {
          trust = -50;
          fear = 30;
          respect = 40;
        }

        // Same faction (not already overridden)
        if (charA.faction === charB.faction && trust === 0) {
          trust = 50;
          respect = 40;
          familiarity = 50;
        }

        // Agents (machines) are feared by non-machine factions
        if (charB.faction === 'machines' && charA.faction !== 'machines') {
          fear = Math.max(fear, 40);
        }

        // Oracle is universally respected
        if (charB.id === 'oracle') {
          respect = Math.max(respect, 70);
        }

        this.relationships.set(key, {
          fromAgent: charA.id,
          toAgent: charB.id,
          trust,
          fear,
          respect,
          familiarity,
          lastInteraction: 0,
          notes: '',
        });
      }
    }
  }

  private key(from: AgentId, to: AgentId): string {
    return `${from}->${to}`;
  }

  getRelationship(from: AgentId, to: AgentId): Relationship | undefined {
    return this.relationships.get(this.key(from, to));
  }

  modifyRelationship(
    from: AgentId,
    to: AgentId,
    changes: Partial<Pick<Relationship, 'trust' | 'fear' | 'respect' | 'familiarity' | 'notes'>>
  ): void {
    const key = this.key(from, to);
    const existing = this.relationships.get(key);
    if (!existing) return;

    const updated: Relationship = {
      ...existing,
      trust: changes.trust !== undefined ? changes.trust : existing.trust,
      fear: changes.fear !== undefined ? changes.fear : existing.fear,
      respect: changes.respect !== undefined ? changes.respect : existing.respect,
      familiarity: changes.familiarity !== undefined ? changes.familiarity : existing.familiarity,
      notes: changes.notes !== undefined ? changes.notes : existing.notes,
      lastInteraction: Date.now(),
    };
    this.relationships.set(key, updated);
  }

  adjustTrust(from: AgentId, to: AgentId, delta: number): void {
    const existing = this.relationships.get(this.key(from, to));
    if (!existing) return;
    const newTrust = Math.max(-100, Math.min(100, existing.trust + delta));
    this.modifyRelationship(from, to, { trust: newTrust });
  }

  adjustFear(from: AgentId, to: AgentId, delta: number): void {
    const existing = this.relationships.get(this.key(from, to));
    if (!existing) return;
    const newFear = Math.max(0, Math.min(100, existing.fear + delta));
    this.modifyRelationship(from, to, { fear: newFear });
  }

  adjustRespect(from: AgentId, to: AgentId, delta: number): void {
    const existing = this.relationships.get(this.key(from, to));
    if (!existing) return;
    const newRespect = Math.max(0, Math.min(100, existing.respect + delta));
    this.modifyRelationship(from, to, { respect: newRespect });
  }

  getRelationshipsForAgent(agentId: AgentId): Relationship[] {
    const results: Relationship[] = [];
    for (const rel of this.relationships.values()) {
      if (rel.fromAgent === agentId) {
        results.push({ ...rel });
      }
    }
    return results.sort((a, b) => b.trust - a.trust);
  }

  getAllies(agentId: AgentId, threshold = 30): Relationship[] {
    return this.getRelationshipsForAgent(agentId).filter((r) => r.trust >= threshold);
  }

  getEnemies(agentId: AgentId, threshold = -20): Relationship[] {
    return this.getRelationshipsForAgent(agentId).filter((r) => r.trust <= threshold);
  }
}
