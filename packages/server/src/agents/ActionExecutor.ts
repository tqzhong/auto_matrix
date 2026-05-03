import type { AgentState, AgentAction, ActionType, Vector3 } from '@auto_matrix/shared';
import { distance } from '@auto_matrix/shared';
import type { RelationshipGraph } from './RelationshipGraph.js';

export interface ActionResult {
  success: boolean;
  newState: Partial<AgentState>;
  events: string[];
}

export class ActionExecutor {
  constructor(private relationshipGraph: RelationshipGraph) {}

  execute(agent: AgentState, action: AgentAction, allAgents: Map<string, AgentState>, tick: number): ActionResult {
    switch (action.type) {
      case 'move_to':
        return this.executeMove(agent, action, tick);
      case 'talk_to':
        return this.executeTalk(agent, action, allAgents, tick);
      case 'attack':
        return this.executeAttack(agent, action, allAgents, tick);
      case 'defend':
        return this.executeDefend(agent, action, tick);
      case 'observe':
        return this.executeObserve(agent, tick);
      case 'use_ability':
        return this.executeAbility(agent, action, tick);
      case 'idle':
      default:
        return { success: true, newState: {}, events: [] };
    }
  }

  private executeMove(agent: AgentState, action: AgentAction, tick: number): ActionResult {
    const dest = action.parameters.destination as Vector3 | undefined;
    if (!dest) return { success: false, newState: {}, events: [] };

    const dx = dest.x - agent.position.x;
    const dz = dest.z - agent.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 1) {
      return {
        success: true,
        newState: { position: dest, velocity: { x: 0, y: 0, z: 0 } },
        events: [`${agent.name} arrived at destination`],
      };
    }

    // Move toward destination
    const speed = 2; // blocks per tick
    const nx = dx / dist;
    const nz = dz / dist;
    const newPos = {
      x: agent.position.x + nx * speed,
      y: agent.position.y,
      z: agent.position.z + nz * speed,
    };

    return {
      success: true,
      newState: {
        position: newPos,
        velocity: { x: nx * speed, y: 0, z: nz * speed },
        rotation: Math.atan2(nx, nz),
      },
      events: [],
    };
  }

  private executeTalk(agent: AgentState, action: AgentAction, allAgents: Map<string, AgentState>, tick: number): ActionResult {
    const targetId = action.target;
    if (!targetId) return { success: false, newState: {}, events: [] };

    const target = allAgents.get(targetId);
    if (!target) return { success: false, newState: {}, events: [] };

    const dist = distance(agent.position, target.position);
    if (dist > 5) {
      // Too far, move closer
      return this.executeMove(agent, {
        ...action,
        type: 'move_to',
        parameters: { destination: target.position },
      }, tick);
    }

    const dialogue = (action.parameters.dialogue as string) || `${agent.name} nods at ${target.name}.`;

    // Improve relationship slightly from conversation
    this.relationshipGraph.modifyRelationship(agent.id, targetId, { familiarity: 1 });

    return {
      success: true,
      newState: { mood: 'engaged' },
      events: [`${agent.name} says to ${target.name}: "${dialogue}"`],
    };
  }

  private executeAttack(agent: AgentState, action: AgentAction, allAgents: Map<string, AgentState>, tick: number): ActionResult {
    const targetId = action.target;
    if (!targetId) return { success: false, newState: {}, events: [] };

    const target = allAgents.get(targetId);
    if (!target) return { success: false, newState: {}, events: [] };

    const dist = distance(agent.position, target.position);
    if (dist > 3) {
      return this.executeMove(agent, {
        ...action,
        type: 'move_to',
        parameters: { destination: target.position },
      }, tick);
    }

    const damage = 5 + Math.floor(Math.random() * 10);

    // Worsen relationship
    this.relationshipGraph.modifyRelationship(agent.id, targetId, { trust: -10, fear: 5 });

    return {
      success: true,
      newState: { mood: 'aggressive' },
      events: [`${agent.name} attacks ${target.name} for ${damage} damage!`],
    };
  }

  private executeDefend(agent: AgentState, action: AgentAction, tick: number): ActionResult {
    return {
      success: true,
      newState: { mood: 'defensive' },
      events: [`${agent.name} takes a defensive stance`],
    };
  }

  private executeObserve(agent: AgentState, tick: number): ActionResult {
    return {
      success: true,
      newState: { alertness: Math.min(100, agent.alertness + 5) },
      events: [`${agent.name} surveys the surroundings`],
    };
  }

  private executeAbility(agent: AgentState, action: AgentAction, tick: number): ActionResult {
    const abilityId = action.parameters.ability as string;
    if (!abilityId) return { success: false, newState: {}, events: [] };

    const ability = agent.abilities.find(a => a.id === abilityId);
    if (!ability || ability.currentCooldown > 0) {
      return { success: false, newState: {}, events: [] };
    }

    if (ability.requiredAwakened && !agent.isAwakened) {
      return { success: false, newState: {}, events: [`${agent.name} tries to use ${ability.name} but is not awakened`] };
    }

    return {
      success: true,
      newState: {
        activeEffects: [...agent.activeEffects, {
          abilityId: ability.id,
          remainingTicks: 30,
          visualEffect: ability.visualEffect,
        }],
      },
      events: [`${agent.name} activates ${ability.name}!`],
    };
  }
}
