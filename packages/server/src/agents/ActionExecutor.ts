import { distance, streetPath, meleeReach, type AgentState, type AgentAction, type Vector3, type WorldEvent, type CombatImpact } from '@auto_matrix/shared';
import type { RelationshipGraph } from './RelationshipGraph.js';
import type { ConversationEngine } from './ConversationEngine.js';

export interface ActionResult {
  success: boolean;
  newState: Partial<AgentState>;
  events: string[];
}

export class ActionExecutor {
  onImpact?: (impact: CombatImpact, tick: number) => void;
  constructor(
    private relationshipGraph: RelationshipGraph,
    private conversationEngine: ConversationEngine,
    private onEvent?: (event: Omit<WorldEvent, 'id'>) => void,
  ) {}

  execute(agent: AgentState, action: AgentAction, allAgents: Map<string, AgentState>, tick: number): ActionResult {
    const result: ActionResult = { success: true, newState: {}, events: [] };
    if (agent.status !== 'alive' || action.parameters.resolved) return result;
    if (action.type === 'move_to') {
      const destination = action.parameters.destination as Vector3 | undefined;
      if (!destination || ![destination.x, destination.y, destination.z].every(Number.isFinite)) return { ...result, success: false };
      agent.targetPosition = { ...destination };
      agent.currentPath = streetPath(agent.position, destination);
      let previous = agent.position;
      const length = agent.currentPath.reduce((sum, point) => {
        const segment = distance(previous, point);
        previous = point;
        return sum + segment;
      }, 0);
      action.duration = Math.ceil(length / 4) + agent.currentPath.length + 2;
      action.parameters.resolved = true;
    } else if (action.type === 'talk_to' || action.type === 'attack') {
      const target = action.target ? allAgents.get(action.target) : undefined;
      if (!target || target.status !== 'alive' || target.isInMatrix !== agent.isInMatrix) return { ...result, success: false };
      if (distance(agent.position, target.position) > (action.type === 'attack' ? 3.5 : 8)) {
        delete action.parameters.contactTick;
        agent.targetPosition = { ...target.position };
        agent.currentPath = [];
        return result;
      }
      agent.targetPosition = null;
      agent.currentPath = [];
      agent.velocity = { x: 0, y: 0, z: 0 };
      if (action.type === 'talk_to') {
        this.conversationEngine.startConversation(agent.id, target.id, agent, target, action.parameters.topic as string | undefined, tick);
      } else {
        if (!action.parameters.player) agent.rotation = Math.atan2(target.position.x - agent.position.x, target.position.z - agent.position.z);
        if (!meleeReach(agent.position, agent.rotation, target.position, 3.7, agent.isInMatrix)) return result;
        if (!action.parameters.player && target.controller) {
          if (action.parameters.contactTick === undefined) { action.parameters.contactTick = tick + 1; return result; }
          if (tick < Number(action.parameters.contactTick)) return result;
        }
        const evading = target.activeEffects.some(effect => ['dodge', 'agent_dodge', 'vision_flash', 'phase_shift', 'counter_guard'].includes(effect.visualEffect));
        const baseDamage = action.parameters.player && typeof action.parameters.damage === 'number' ? action.parameters.damage : 8;
        const damage = evading ? 0 : target.currentAction?.type === 'defend' ? Math.ceil(baseDamage / 3) : baseDamage;
        const health = target.health;
        target.health = Math.max(0, target.health - damage);
        target.mood = '警觉';
        if (target.mind) target.mind.stress = Math.min(100, target.mind.stress + 22);
        if (target.health === 0) {
          target.status = 'dead';
          target.currentAction = null;
          target.targetPosition = null;
          target.currentPath = [];
          target.velocity = { x: 0, y: 0, z: 0 };
        }
        if (damage > 0) this.onImpact?.({ source: agent.id, target: target.id, position: { ...target.position, y: target.position.y + 2 },
          direction: { x: Math.sin(agent.rotation), y: 0, z: Math.cos(agent.rotation) }, damage: health - target.health, combo: Number(action.parameters.combo ?? 0),
          matrix: agent.isInMatrix, downed: target.health <= 0 }, tick);
        this.relationshipGraph.adjustTrust(target.id, agent.id, -15);
        this.relationshipGraph.adjustFear(target.id, agent.id, 12);
        this.onEvent?.({
          type: target.status === 'dead' ? 'death' : 'gunfight',
          title: target.status === 'dead' ? `${target.name} 的信号消失` : `${agent.name} 与 ${target.name} 发生冲突`,
          description: `${agent.name} 攻击了 ${target.name}，造成 ${damage} 点伤害。`,
          cause: agent.mind?.thought ?? agent.currentGoal,
          consequence: target.status === 'dead' ? '人物死亡，停止行动；幸存者保留对这次冲突的记忆。' : `${target.name} 的生命降至 ${target.health}，恐惧上升，双方信任下降。`,
          causeEventId: agent.mind?.lastEventId,
          involvedAgents: [agent.id, target.id], location: agent.currentLocation,
          position: { ...agent.position }, tick, importance: target.status === 'dead' ? 10 : 8,
        });
      }
      action.parameters.resolved = true;
    } else if (action.type === 'interact_object' && action.target) {
      const target = allAgents.get(action.target);
      if (target?.status === 'alive' && target.isInMatrix === agent.isInMatrix && distance(agent.position, target.position) < 12) {
        target.health = Math.min(target.maxHealth, target.health + 12);
        this.relationshipGraph.adjustTrust(target.id, agent.id, 8);
        if (agent.mind) agent.mind.energy = Math.max(0, agent.mind.energy - 8);
        this.onEvent?.({ type: 'aid', title: `${agent.name} 帮助了 ${target.name}`, description: '处理伤势，建立信任。',
          cause: agent.mind?.thought, consequence: `${target.name} 恢复生命，对施助者的信任提高。`,
          involvedAgents: [agent.id, target.id], location: agent.currentLocation, position: { ...agent.position }, tick, importance: 6 });
      }
      action.parameters.resolved = true;
    } else if (action.type === 'use_ability') {
      const ability = agent.abilities.find(a => a.id === action.parameters.ability);
      if (ability && ability.currentCooldown === 0 && (!ability.requiredAwakened || agent.isAwakened)) {
        ability.currentCooldown = ability.cooldownTicks;
        agent.activeEffects.push({ abilityId: ability.id, remainingTicks: 12, visualEffect: ability.visualEffect });
      }
      action.parameters.resolved = true;
    } else if (action.type === 'observe') {
      agent.alertness = Math.min(10, agent.alertness + 1);
      action.parameters.resolved = true;
    }
    return result;
  }
}
