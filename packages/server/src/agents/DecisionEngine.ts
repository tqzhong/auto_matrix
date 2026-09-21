import { CHARACTERS, LOCATIONS, distance, locationEntrance, type AgentState, type AgentAction } from '@auto_matrix/shared';
import type { Agent } from './Agent.js';
import type { StoryEngine } from '../story/StoryEngine.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { MemoryManager } from '../memory/MemoryManager.js';
import type { RelationshipGraph } from './RelationshipGraph.js';
import type { ConversationEngine } from './ConversationEngine.js';

export class DecisionEngine {
  reservedAgents = new Set<string>();
  narrativeMode = false;
  timeOfDay?: number;
  private pending: { agent: Agent; expected: AgentAction | null; content: string }[] = [];
  private thinking = false;

  constructor(
    private llmClient: LLMClient,
    private memoryManager: MemoryManager,
    private relationshipGraph: RelationshipGraph,
    private storyEngine: StoryEngine,
    private conversationEngine: ConversationEngine,
  ) {}

  async batchDecide(agents: Agent[], allAgents: Map<string, AgentState>, tick: number): Promise<void> {
    // Async model responses are committed only on a simulation tick, never while paused.
    for (const result of this.pending.splice(0)) {
      if (result.agent.state.status !== 'alive' || result.agent.state.controller || this.reservedAgents.has(result.agent.id) || result.agent.state.currentAction !== result.expected) continue;
      this.applyModelDecision(result.agent, result.content, allAgents, tick);
    }
    const eligible = agents.filter(a => a.state.status === 'alive' && !a.state.controller && !this.reservedAgents.has(a.id) && !this.conversationEngine.isAgentInConversation(a.id));
    for (const agent of eligible) {
      if (agent.state.currentAction && agent.state.currentAction.progress < 1) continue;
      if (agent.state.targetPosition) continue;
      agent.setAction(this.ruleBasedDecision(agent.state, allAgents, tick));
    }
    if (this.llmClient.enabled && !this.thinking && tick % 20 === 0 && eligible.length) {
      const agent = eligible[Math.floor(tick / 20) % eligible.length];
      const expected = agent.state.currentAction;
      this.thinking = true;
      const nearby = this.nearby(agent.state, allAgents);
      void this.llmClient.complete({ messages: [
        { role: 'system', content: `${CHARACTERS[agent.id]?.personality ?? ''} 你生活在 Matrix 世界中。只根据亲历的记忆和眼前人物决策，不要编造已发生的事件。用中文思考。` },
        { role: 'user', content: JSON.stringify({ name: agent.state.name, mind: agent.state.mind, goal: agent.state.currentGoal,
          memories: this.memoryManager.getRecentContext(agent.id, 5).map(m => m.content),
          nearby: nearby.map(a => ({ id: a.id, name: a.name, trust: this.relationshipGraph.getRelationship(agent.id, a.id)?.trust })),
          instruction: '返回 JSON: {"action":"talk_to 或 observe 或 idle","target":"附近人物 id","thought":"一句内心想法","goal":"当前目标"}。' }) },
      ], maxTokens: 220, temperature: 0.7 }).then(response => {
        if (response.content) this.pending.push({ agent, expected, content: response.content });
      }).catch(() => {}).finally(() => { this.thinking = false; });
    }
  }

  private nearby(state: AgentState, all: Map<string, AgentState>): AgentState[] {
    return [...all.values()].filter(a => a.id !== state.id && !this.reservedAgents.has(a.id) && a.status === 'alive' && a.isInMatrix === state.isInMatrix && distance(a.position, state.position) < 60);
  }

  private ruleBasedDecision(state: AgentState, all: Map<string, AgentState>, tick: number): AgentAction {
    const mind = state.mind!;
    const nearby = this.nearby(state, all);
    mind.source = 'rules';
    const action = (type: AgentAction['type'], duration = 12, target?: string): AgentAction => ({ type, target, parameters: {}, startedAt: tick, duration, progress: 0 });
    const move = (location: string, reason: string): AgentAction => {
      mind.thought = reason;
      state.currentGoal = `前往${LOCATIONS[location]?.nameCn ?? location}`;
      return { ...action('move_to', 50), parameters: { location, destination: locationEntrance(location) } };
    };
    if (mind.stress > 55 || state.health < state.maxHealth * 0.35) {
      mind.thought = '风险已经太高。我得先活下来，记住这里发生过什么。';
      state.mood = '紧张';
      if (state.isInMatrix && state.currentLocation !== 'oracles_apartment') return move('oracles_apartment', mind.thought);
      return action('hide', 30);
    }
    if (mind.energy < 30) {
      mind.thought = '精力快耗尽了。休息之后再作打算。';
      state.currentGoal = '恢复精力';
      state.mood = '疲惫';
      return action('idle', 45);
    }
    if (!this.narrativeMode && !this.storyEngine.isCeasefire(tick)) {
      const threat = nearby.find(a => state.faction === 'machines' && a.faction === 'zion' && a.isAwakened && a.mind?.lastEventId && this.storyEngine.getCurrentPhaseId() !== 'phase1_normal_life');
      if (threat) {
        mind.thought = `已确认 ${threat.name} 与异常活动有关。执行追踪与拦截。`;
        state.currentGoal = `拦截 ${threat.name}`;
        return action('attack', 16, threat.id);
      }
      const attacker = nearby.find(a => a.currentAction?.type === 'attack' && (a.currentAction.target === state.id || (CHARACTERS[state.id]?.allies.includes(a.currentAction.target ?? '') && state.isAwakened)));
      if (attacker && state.faction !== 'civilians') {
        mind.thought = `${attacker.name} 正在攻击同伴，我决定介入。`;
        return action('attack', 12, attacker.id);
      }
    }
    const injured = nearby.find(a => a.health < a.maxHealth * 0.7 && a.faction === state.faction && distance(a.position, state.position) < 10);
    if (injured && mind.energy > 50 && state.faction !== 'machines') {
      mind.thought = `${injured.name} 受伤了，先帮他稳定下来。`;
      return action('interact_object', 20, injured.id);
    }
    if (!this.conversationEngine.isOnCooldown(state.id, tick)) {
      const partners = nearby.filter(a => !this.conversationEngine.isAgentInConversation(a.id) && !this.conversationEngine.isOnCooldown(a.id, tick)
        && (this.relationshipGraph.getRelationship(state.id, a.id)?.trust ?? 0) > -30);
      partners.sort((a, b) => {
        const score = (p: AgentState) => Math.abs((p.mind?.suspicion ?? 0) - mind.suspicion) + (p.isAwakened !== state.isAwakened ? 30 : 0) - distance(state.position, p.position);
        return score(b) - score(a);
      });
      if (partners[0]) {
        const partner = partners[0];
        mind.thought = mind.suspicion > 30 ? `我想听听 ${partner.name} 对这些异常的解释。` : `碰到了 ${partner.name}，聊聊各自最近的生活。`;
        state.currentGoal = `与 ${partner.name} 交流`;
        return action('talk_to', 22, partner.id);
      }
    }
    if (!this.narrativeMode && state.faction === 'machines') {
      const suspect = [...all.values()].filter(a => a.status === 'alive' && a.isInMatrix && a.faction !== 'machines' && a.mind && a.mind.suspicion > 50)
        .sort((a, b) => distance(state.position, a.position) - distance(state.position, b.position))[0];
      if (suspect && suspect.currentLocation !== state.currentLocation) return move(suspect.currentLocation, '监控系统发现了可疑活动，前往核实。');
    }
    if (!this.narrativeMode && state.isAwakened && state.faction === 'zion' && state.isInMatrix) {
      const potential = [...all.values()].filter(a => a.status === 'alive' && a.isInMatrix && !a.isAwakened && a.faction !== 'machines' && (a.mind?.suspicion ?? 0) > 25)
        .sort((a, b) => (b.mind?.suspicion ?? 0) - (a.mind?.suspicion ?? 0))[0];
      if (potential && potential.currentLocation !== state.currentLocation) return move(potential.currentLocation, `收到 ${potential.name} 正在调查异常的消息，尝试建立联系。`);
    }
    const seed = [...state.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const home = LOCATIONS[mind.home]?.world === (state.isInMatrix ? 'matrix' : 'real')
      ? mind.home : state.isInMatrix ? 'oracles_apartment' : 'nebuchadnezzar';
    const hour = (this.timeOfDay ?? (21000 + tick * 12) % 24000) / 1000;
    const destination = state.isInMatrix
      ? hour < 6 ? home : hour < 17 ? ['metacortex_office', 'times_square', home][seed % 3] : hour < 20 ? 'central_park' : 'nightclub'
      : hour < 7 ? home : hour < 18 ? 'zion_command' : 'zion_dock';
    if (destination !== state.currentLocation) return move(destination, mind.suspicion > 35 ? '带着尚未解开的疑问走进人群，寻找新的线索。' : '沿着熟悉的街道继续今天的生活。');
    mind.thought = mind.suspicion > 35 ? '这里看似正常，但我忘不了刚才的异常。' : '观察周围，等待一个值得交谈的人。';
    state.currentGoal = mind.suspicion > 35 ? '观察异常，寻找证据' : '日常生活';
    return action('observe', 10);
  }

  private applyModelDecision(agent: Agent, content: string, all: Map<string, AgentState>, tick: number): void {
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return;
      const parsed = JSON.parse(match[0]);
      if (!['talk_to', 'observe', 'idle'].includes(parsed.action) || typeof parsed.thought !== 'string') return;
      if (parsed.action === 'talk_to' && !this.nearby(agent.state, all).some(a => a.id === parsed.target)) return;
      if (agent.state.currentAction?.type === 'attack' || agent.state.targetPosition) return;
      agent.setAction({ type: parsed.action, target: parsed.target, parameters: {}, startedAt: tick, duration: 15, progress: 0 });
      if (agent.state.mind) {
        agent.state.mind.thought = parsed.thought.slice(0, 180);
        agent.state.mind.source = 'llm';
      }
      if (typeof parsed.goal === 'string') agent.state.currentGoal = parsed.goal.slice(0, 120);
    } catch { /* Invalid model output leaves the local decision intact. */ }
  }
}
