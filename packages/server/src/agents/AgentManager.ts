import { CHARACTERS, LOCATIONS, ABILITIES, locationEntrance, type AgentState, type AgentId, type Ability, type AppearanceConfig, type CharacterDef } from '@auto_matrix/shared';
import { Agent } from './Agent.js';
import { WorldState } from '../world/WorldState.js';

const FACTION_COLORS: Record<string, { body: string; head: string; clothing: string }> = {
  zion: { body: '#d4a574', head: '#e0b088', clothing: '#1a1a1a' },
  machines: { body: '#888888', head: '#999999', clothing: '#222222' },
  civilians: { body: '#d4a574', head: '#e0b088', clothing: '#4a4a6a' },
  merovingian: { body: '#c8a080', head: '#d0b090', clothing: '#3a1a1a' },
  exiles: { body: '#a0a0b0', head: '#b0b0c0', clothing: '#2a2a3a' },
  oracle: { body: '#8b6914', head: '#a07828', clothing: '#6b3a1a' },
  smith_virus: { body: '#555555', head: '#666666', clothing: '#111111' },
};

export class AgentManager {
  private agents: Map<AgentId, Agent> = new Map();
  private worldState: WorldState;

  constructor(worldState: WorldState) {
    this.worldState = worldState;
  }

  initializeAllAgents(): void {
    for (const charDef of Object.values(CHARACTERS)) {
      this.spawnAgent(charDef);
    }
  }

  spawnAgent(charDef: CharacterDef): Agent {
    const location = LOCATIONS[charDef.initialLocation];
    const pos = locationEntrance(charDef.initialLocation);
    pos.x += (Math.random() - 0.5) * 18;
    pos.z += (Math.random() - 0.5) * 8;

    const factionColors = FACTION_COLORS[charDef.faction] ?? FACTION_COLORS.civilians;
    const appearance: AppearanceConfig = {
      bodyColor: factionColors.body,
      headColor: factionColors.head,
      clothing: charDef.id === 'citizen_2' ? '#a21722' : factionColors.clothing,
      accessories: [],
      isAgent: charDef.faction === 'machines',
    };

    const abilities: Ability[] = charDef.abilities.map((abilityId) => {
      const def = ABILITIES[abilityId];
      if (!def) {
        return {
          id: abilityId,
          name: abilityId,
          description: '',
          cooldownTicks: 10,
          currentCooldown: 0,
          requiredAwakened: true,
          powerLevel: 1,
          visualEffect: 'default',
        };
      }
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        cooldownTicks: def.cooldownTicks,
        currentCooldown: 0,
        requiredAwakened: def.requiredAwakened,
        powerLevel: def.powerLevel,
        visualEffect: def.visualEffect,
      };
    });

    const state: AgentState = {
      id: charDef.id,
      name: charDef.name,
      faction: charDef.faction,
      status: 'alive',
      position: pos,
      rotation: Math.random() * Math.PI * 2,
      velocity: { x: 0, y: 0, z: 0 },
      targetPosition: null,
      currentPath: [],
      health: charDef.health,
      maxHealth: charDef.health,
      isAwakened: charDef.isAwakened,
      isInMatrix: location?.world !== 'real',
      currentLocation: charDef.initialLocation,
      currentGoal: charDef.goals[0] ?? 'Exist',
      currentAction: null,
      mood: 'neutral',
      alertness: charDef.faction === 'machines' ? 8 : 3,
      mind: {
        energy: 65 + Math.random() * 30,
        social: 40 + Math.random() * 40,
        suspicion: charDef.isAwakened ? 100 : charDef.id === 'neo' ? 32 : 5 + Math.random() * 15,
        stress: 0,
        thought: charDef.id === 'neo' ? '昨晚的梦太真实了。我需要找到一个解释。' : '今晚，一切看起来和平常一样。',
        source: 'rules',
        memoryCount: 0,
        home: charDef.initialLocation,
      },
      abilities,
      activeEffects: [],
      appearance,
    };

    const agent = new Agent(state, charDef.personality);
    this.agents.set(charDef.id, agent);
    this.worldState.registerAgent(agent.state);
    return agent;
  }

  getAgent(agentId: AgentId): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAliveAgents(): Agent[] {
    return this.getAllAgents().filter((a) => a.state.status === 'alive');
  }

  setGoal(agentId: AgentId, goal: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.setGoal(goal);
    this.worldState.updateAgent(agentId, { currentGoal: goal });
  }

  killAgent(agentId: AgentId): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.state.status = 'dead';
    agent.state.health = 0;
    this.worldState.updateAgent(agentId, { status: 'dead', health: 0 });
  }

  awakenAgent(agentId: AgentId): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.state.isAwakened = true;
    this.worldState.updateAgent(agentId, { isAwakened: true });
  }

  updateAgentState(agentId: AgentId, tick: number): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.update(tick);
    // Sync back to world state
    this.worldState.updateAgent(agentId, agent.state);
  }

  updateAllAgents(tick: number): void {
    for (const agent of this.agents.values()) {
      if (agent.state.status === 'dead') continue;
      agent.update(tick);
      this.worldState.updateAgent(agent.id, agent.state);
    }
  }

  getAgentsByFaction(factionId: string): Agent[] {
    return this.getAllAgents().filter((a) => a.state.faction === factionId);
  }

  getAgentsByLocation(locationId: string): Agent[] {
    return this.getAllAgents().filter(
      (a) => a.state.currentLocation === locationId && a.state.status === 'alive'
    );
  }
}
