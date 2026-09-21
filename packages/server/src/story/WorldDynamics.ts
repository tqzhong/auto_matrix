import { LOCATIONS, distance, locationEntrance, type AgentState, type WorldEvent } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import type { MemoryManager } from '../memory/MemoryManager.js';
import type { RelationshipGraph } from '../agents/RelationshipGraph.js';

export class WorldDynamics {
  neoStory = false;
  private deployed = new Set<string>();

  constructor(
    private world: WorldState,
    private memories: MemoryManager,
    private relationships: RelationshipGraph,
    private publish: (event: WorldEvent) => void,
    private random = Math.random,
  ) {}

  tick(tick: number): void {
    for (const agent of this.world.agents.values()) {
      const mind = agent.mind;
      if (!mind || agent.status !== 'alive') continue;
      const resting = agent.currentAction?.type === 'idle' || agent.currentAction?.type === 'hide';
      mind.energy = Math.min(100, Math.max(0, mind.energy + (resting ? 0.8 : -0.12)));
      mind.social = Math.max(0, mind.social - 0.15);
      mind.stress = Math.max(0, mind.stress - 0.18);
      mind.memoryCount = this.memories.getMemoryCount(agent.id);
      if (resting && mind.stress < 20) agent.health = Math.min(agent.maxHealth, agent.health + 0.15);
      const destination = agent.currentAction?.parameters.location as string | undefined;
      if (destination && !agent.targetPosition && agent.currentAction?.parameters.resolved && agent.currentLocation !== destination) {
        agent.currentLocation = destination;
        this.record({ type: 'arrival', title: `${agent.name} 抵达${LOCATIONS[destination]?.nameCn ?? destination}`,
          description: agent.currentGoal, cause: mind.thought, consequence: '开始感知这个地点附近的人与事件。',
          involvedAgents: [agent.id], location: destination, position: { ...agent.position }, tick, importance: 3 });
      }
    }

    if (!this.neoStory && tick % 28 === 8) this.anomaly(tick);
    if (!this.neoStory && tick % 70 === 15 && this.world.globalEvents.some(event => event.type === 'anomaly')) {
      const crew = ['trinity', 'morpheus', 'niobe'].map(id => this.world.agents.get(id))
        .find(agent => agent?.status === 'alive' && !agent.controller && !agent.isInMatrix && !this.deployed.has(agent.id));
      if (crew) {
        const signal = [...this.world.globalEvents].reverse().find(event => event.type === 'anomaly')!;
        crew.isInMatrix = true;
        crew.currentLocation = signal.location;
        crew.position = locationEntrance(signal.location);
        crew.currentAction = null;
        crew.targetPosition = null;
        crew.currentPath = [];
        crew.currentGoal = '寻找目击异常的人，确认是否可以信任。';
        this.deployed.add(crew.id);
        this.record({ type: 'portal_open', title: `${crew.name} 接入 Matrix`,
          description: `锡安截获异常信号，${crew.name} 从飞船接入${LOCATIONS[signal.location]?.nameCn ?? '城市'}。`,
          cause: signal.title, causeEventId: signal.id, consequence: '觉醒者开始在附近寻找愿意了解真相的人。',
          involvedAgents: [crew.id], location: signal.location, position: { ...crew.position }, tick, importance: 7 });
      }
    }
  }

  anomaly(tick: number, preferredLocation?: string): WorldEvent | undefined {
    const candidates = [...this.world.agents.values()].filter(a => !(this.neoStory && a.id === 'neo') && a.status === 'alive' && a.isInMatrix && a.faction !== 'machines' && !a.isAwakened);
    const local = preferredLocation ? candidates.filter(a => a.currentLocation === preferredLocation) : candidates;
    const witness = local[Math.floor(this.random() * local.length)];
    if (!witness) return;
    const phenomena = ['同一辆黑色轿车连续两次经过同一个路口', '霓虹招牌短暂地化成了绿色代码', '墙面出现了一扇片刻前还不存在的门', '街上所有的时钟同时倒退了三秒'];
    const description = phenomena[Math.floor(this.random() * phenomena.length)];
    const witnesses = candidates.filter(a => distance(a.position, witness.position) < 65);
    for (const person of witnesses) {
      if (!person.mind) continue;
      person.mind.suspicion = Math.min(100, person.mind.suspicion + 16);
      person.mind.thought = `我亲眼看到${description}。也许有人能解释。`;
      person.mood = '疑惑';
    }
    return this.record({ type: 'anomaly', title: '现实出现裂缝', description,
      cause: preferredLocation ? '观察者向这片区域注入了一次代码异常。' : '局部模拟出现渲染错误，被附近的人目击。',
      consequence: `${witnesses.map(a => a.name).join('、')} 的怀疑增加，开始寻找解释。`,
      involvedAgents: witnesses.map(a => a.id), location: witness.currentLocation,
      position: { ...witness.position }, tick, importance: 7 });
  }

  resolveConversation(a: AgentState, b: AgentState, summary: string, tick: number): void {
    if (this.neoStory && [a.id, b.id].includes('neo')) return;
    const [informed, listener] = (a.mind?.suspicion ?? 0) >= (b.mind?.suspicion ?? 0) ? [a, b] : [b, a];
    const trust = this.relationships.getRelationship(listener.id, informed.id)?.trust ?? 0;
    let consequence = '双方留下了共同记忆，熟悉程度提高。';
    for (const agent of [a, b]) {
      if (agent.mind) agent.mind.social = Math.min(100, agent.mind.social + 25);
    }
    if (listener.mind && !listener.isAwakened && listener.faction !== 'machines' && trust >= 0 && (informed.mind?.suspicion ?? 0) > listener.mind.suspicion + 10) {
      listener.mind.suspicion = Math.min(100, listener.mind.suspicion + (informed.isAwakened ? 22 : 9));
      listener.mind.thought = `${informed.name} 的经历印证了我的怀疑。我需要继续调查。`;
      listener.currentGoal = '寻找可以验证异常的证据';
      consequence = `${listener.name} 开始相信对方，怀疑升至 ${Math.round(listener.mind.suspicion)}%。`;
    }
    const event = this.record({ type: 'conversation', title: `${a.name} 与 ${b.name} 交换情报`,
      description: summary, cause: informed.mind?.thought ?? '两人在附近相遇。', causeEventId: informed.mind?.lastEventId,
      consequence, involvedAgents: [a.id, b.id], location: a.currentLocation, position: { ...a.position }, tick, importance: 5 });
    if (listener.mind && listener.mind.suspicion >= 70 && informed.isAwakened && !listener.isAwakened && listener.faction !== 'machines' && trust >= 10) {
      listener.isAwakened = true;
      listener.mind.suspicion = 100;
      listener.mood = '清醒';
      listener.currentGoal = '帮助更多人看见真相，并避开特工';
      listener.mind.thought = '那些异常与记忆终于有了共同的解释：这个世界是一段程序。';
      this.record({ type: 'awakening', title: `${listener.name} 选择面对真相`,
        description: '亲历的异常、积累的怀疑与一次可信的交谈共同促成了觉醒。',
        cause: event.title, causeEventId: event.id, consequence: '开始帮助其他人，也成为安全程序可能追踪的目标。',
        involvedAgents: [listener.id, informed.id], location: listener.currentLocation,
        position: { ...listener.position }, tick, importance: 10 });
    }
  }

  record(input: Omit<WorldEvent, 'id'>): WorldEvent {
    const event = this.world.addWorldEvent(input);
    const type = event.type === 'conversation' ? 'conversation' : ['gunfight', 'death'].includes(event.type) ? 'combat' : event.type === 'arrival' ? 'observation' : 'discovery';
    for (const id of event.involvedAgents) {
      const agent = this.world.agents.get(id);
      this.memories.record(id, type, `${event.title ?? ''}：${event.description} ${event.consequence ?? ''}`, {
        importance: event.importance, relatedAgents: event.involvedAgents.filter(other => other !== id),
        location: event.location, tags: [event.type, `event:${event.id}`, `tick:${event.tick}`],
      });
      if (agent?.mind) agent.mind.lastEventId = event.id;
    }
    if (event.type === 'gunfight' || event.type === 'death') {
      const origin = this.world.agents.get(event.involvedAgents[0]);
      if (origin) for (const bystander of this.world.agents.values()) {
        if (bystander.status !== 'alive' || bystander.isInMatrix !== origin.isInMatrix || event.involvedAgents.includes(bystander.id) || distance(bystander.position, origin.position) > 80) continue;
        if (bystander.mind) {
          bystander.mind.stress = Math.min(100, bystander.mind.stress + 18);
          bystander.mind.lastEventId = event.id;
          bystander.mind.thought = '附近发生了冲突。我需要先确保自己和同伴安全。';
        }
        this.memories.record(bystander.id, 'observation', `目击：${event.description}`, { importance: 7, tags: [`event:${event.id}`], relatedAgents: event.involvedAgents });
      }
    }
    this.publish(event);
    return event;
  }
}
