import { CHARACTERS, distance, generateId, type AgentId, type AgentState, type ConversationRecord, type Memory } from '@auto_matrix/shared';
import type { LLMClient } from '../llm/LLMClient.js';
import type { MemoryManager } from '../memory/MemoryManager.js';
import type { RelationshipGraph } from './RelationshipGraph.js';
import type { SocketServer } from '../network/SocketServer.js';
import type { StoryEngine } from '../story/StoryEngine.js';

interface ActiveConversation {
  ordinary: boolean;
  record: ConversationRecord;
  topic: string;
  nextTurn: number;
  lines: string[];
  modelLines?: string[];
  awaitingModel: boolean;
}

export class ConversationEngine {
  ordinaryLife = false;
  private active = new Map<string, ActiveConversation>();
  private cooldowns = new Map<AgentId, number>();
  onComplete?: (a: AgentState, b: AgentState, summary: string, tick: number) => void;

  constructor(
    private llmClient: LLMClient,
    private memoryManager: MemoryManager,
    private relationshipGraph: RelationshipGraph,
    private socketServer: SocketServer,
    private storyEngine: StoryEngine,
  ) {}

  startConversation(id1: string, id2: string, a: AgentState, b: AgentState, topic: string | undefined, tick: number): string | null {
    if (id1 === id2 || a.status !== 'alive' || b.status !== 'alive' || a.isInMatrix !== b.isInMatrix || distance(a.position, b.position) > 12) return null;
    if (this.active.size >= 5 || this.isAgentInConversation(id1) || this.isAgentInConversation(id2) || this.isOnCooldown(id1, tick) || this.isOnCooldown(id2, tick)) return null;
    const id = generateId('conv');
    const suspicious = !this.ordinaryLife && Math.max(a.mind?.suspicion ?? 0, b.mind?.suspicion ?? 0) > 35;
    const resolvedTopic = topic ?? (suspicious ? '那些无法解释的异常' : '今天的生活');
    const memory = this.memoryManager.getRecentContext(a.id, 1)[0];
    const ordinaryLines = a.currentLocation === 'metacortex_office'
      ? ['今天的报表终于跑完了。下班之后有什么安排？', '想去街角吃点东西，晚些时候再回家。', '那明天见。路上慢慢来。']
      : a.currentLocation === 'nightclub'
        ? ['今晚这首曲子不错，你常来这里吗？', '偶尔来，见见朋友，暂时把工作放一边。', '有空再约。今晚过得开心。']
        : ['今天外面的街道很热闹。你吃过饭了吗？', '还没，想去咖啡馆坐一会儿。', '我也是。生活总要给自己留一点时间。'];
    const lines = this.ordinaryLife ? ordinaryLines : suspicious ? [
      a.isAwakened ? '你有没有发现，记忆和眼前的世界有时对不上？' : '有些事情不对劲。你也看到那些异常了吗？',
      b.isAwakened ? '你看到的并不是幻觉。但信任之前，你应该自己验证。' : `我也开始怀疑了。${b.mind?.thought ?? '我们应该再找一些证据。'}`,
      a.isAwakened ? '记住亲眼看见的事，和你信任的人核实。我会继续留意。' : '我会记住这次谈话。下次再遇到异常，我不会装作没看见。',
    ] : [
      memory ? `最近我一直在想：${memory.content.slice(0, 64)}` : `晚上好，${b.name}。今天过得怎么样？`,
      b.mind && b.mind.energy < 50 ? '有点累，想找个安静的地方歇一会儿。' : '和往常差不多。有时候我会想，明天是不是还会一模一样。',
      '有消息再联系。能遇到一个愿意听的人，总是好事。',
    ];
    const conv: ActiveConversation = { ordinary: this.ordinaryLife, record: { id, participants: [id1, id2], messages: [], location: a.currentLocation, startTick: tick, endTick: tick }, topic: resolvedTopic, nextTurn: tick + 1, lines, awaitingModel: this.llmClient.enabled && !this.ordinaryLife };
    this.active.set(id, conv);
    for (const person of [a, b]) {
      person.targetPosition = null;
      person.currentPath = [];
      person.velocity = { x: 0, y: 0, z: 0 };
      person.currentAction = { type: 'talk_to', target: person.id === id1 ? id2 : id1, parameters: { resolved: true }, startedAt: tick, duration: 14, progress: 0 };
      person.mood = '交谈中';
    }
    this.socketServer.broadcastMessage({ type: 'conversation_start', data: { id, participants: [id1, id2], location: a.currentLocation }, tick, timestamp: Date.now() });
    if (this.llmClient.enabled && !this.ordinaryLife) {
      void this.llmClient.complete({ messages: [
        { role: 'system', content: '为 Matrix 世界中的人物写简短自然的中文对话。只谈人物已知的经历，不预言剧情、不声称不存在的事件。返回 JSON 字符串数组，恰好三句，发言顺序 A、B、A，每句不超过 60 字。' },
        { role: 'user', content: JSON.stringify({ A: { name: a.name, personality: CHARACTERS[id1]?.personality, mind: a.mind }, B: { name: b.name, personality: CHARACTERS[id2]?.personality, mind: b.mind }, topic: resolvedTopic, phase: this.storyEngine.getCurrentPhaseId(), memories: this.memoryManager.getRecentContext(id1, 3).map(m => m.content) }) },
      ], maxTokens: 350, temperature: 0.8 }).then(response => {
        try {
          const match = response.content.match(/\[[\s\S]*\]/);
          const parsed: unknown = match ? JSON.parse(match[0]) : null;
          if (Array.isArray(parsed) && parsed.length === 3 && parsed.every(line => typeof line === 'string' && line.length > 0 && line.length < 200)) conv.modelLines = parsed;
        } catch { /* Continue the local conversation. */ }
      }).catch(() => {}).finally(() => { conv.awaitingModel = false; });
    }
    return id;
  }

  async tickConversations(all: Map<string, AgentState>, tick: number): Promise<void> {
    for (const [id, conv] of this.active) {
      const [a, b] = conv.record.participants.map(agentId => all.get(agentId));
      if (conv.ordinary !== this.ordinaryLife || !a || !b || a.status !== 'alive' || b.status !== 'alive' || a.isInMatrix !== b.isInMatrix || distance(a.position, b.position) > 25) {
        this.finish(id, conv, a, b, tick, true);
        continue;
      }
      if (tick < conv.nextTurn) continue;
      const turn = conv.record.messages.length;
      if (turn === 0 && conv.awaitingModel && !conv.modelLines && tick < conv.record.startTick + 12) continue;
      // Select a coherent script once, so a delayed response cannot replace half a dialogue.
      if (turn === 0 && conv.modelLines) conv.lines = conv.modelLines;
      const speaker = turn % 2 === 0 ? a : b;
      const content = conv.lines[turn];
      conv.record.messages.push({ speaker: speaker.id, content, tick, tone: 'thoughtful' });
      this.socketServer.broadcastMessage({ type: 'conversation_message', data: { conversationId: id, speaker: speaker.id, content, tone: 'thoughtful' }, tick, timestamp: Date.now() });
      conv.nextTurn = tick + 4;
      if (conv.record.messages.length === 3) this.finish(id, conv, a, b, tick, false);
    }
  }

  private finish(id: string, conv: ActiveConversation, a: AgentState | undefined, b: AgentState | undefined, tick: number, interrupted: boolean): void {
    const summary = interrupted ? '谈话因距离或人物状态改变而中断。' : `${a!.name} 与 ${b!.name} 谈起${conv.topic}。${conv.record.messages[1]?.content ?? ''}`;
    for (const person of [a, b]) if (person) {
      this.cooldowns.set(person.id, tick + 35);
      if (person.currentAction?.type === 'talk_to') person.currentAction = null;
      person.mood = interrupted ? '警觉' : '思索';
    }
    if (!interrupted && a && b) {
      for (const [from, to] of [[a, b], [b, a]]) {
        this.relationshipGraph.adjustTrust(from.id, to.id, 6);
        const familiarity = this.relationshipGraph.getRelationship(from.id, to.id)?.familiarity ?? 0;
        this.relationshipGraph.modifyRelationship(from.id, to.id, { familiarity: Math.min(100, familiarity + 5) });
      }
      this.onComplete?.(a, b, summary, tick);
    }
    this.socketServer.broadcastMessage({ type: 'conversation_end', data: { conversationId: id, participants: conv.record.participants, summary }, tick, timestamp: Date.now() });
    this.active.delete(id);
  }

  interrupt(id: string, all: Map<string, AgentState>, tick: number): void {
    for (const [conversationId, conv] of this.active) if (conv.record.participants.includes(id)) {
      const [a, b] = conv.record.participants.map(agentId => all.get(agentId));
      this.finish(conversationId, conv, a, b, tick, true);
    }
  }

  isAgentInConversation(id: string): boolean { return [...this.active.values()].some(c => c.record.participants.includes(id)); }
  isOnCooldown(id: string, tick: number): boolean { return tick < (this.cooldowns.get(id) ?? 0); }
  getActiveConversations(): ConversationRecord[] { return [...this.active.values()].map(c => structuredClone(c.record)); }
  getConversationHistory(a: string, b: string): Memory[] { return this.memoryManager.getMemoriesInvolvingAgent(a, b).filter(m => m.type === 'conversation'); }
}
