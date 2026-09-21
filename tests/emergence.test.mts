import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { ActionExecutor } from '../packages/server/src/agents/ActionExecutor.js';
import { DecisionEngine } from '../packages/server/src/agents/DecisionEngine.js';
import { ConversationEngine } from '../packages/server/src/agents/ConversationEngine.js';
import { RelationshipGraph } from '../packages/server/src/agents/RelationshipGraph.js';
import { MemoryManager } from '../packages/server/src/memory/MemoryManager.js';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { StoryEngine } from '../packages/server/src/story/StoryEngine.js';
import { EvolutionEngine } from '../packages/server/src/story/EvolutionEngine.js';
import { EventBus } from '../packages/server/src/simulation/EventBus.js';
import { LLMClient } from '../packages/server/src/llm/LLMClient.js';
import type { SocketServer } from '../packages/server/src/network/SocketServer.js';
import { LOCATIONS, type WorldEvent } from '@auto_matrix/shared';

function setup() {
  const world = new WorldState();
  const manager = new AgentManager(world); manager.initializeAllAgents();
  const memory = new MemoryManager();
  const relationships = new RelationshipGraph(); relationships.initialize();
  const bus = new EventBus(); const story = new StoryEngine(bus);
  const llm = new LLMClient({ baseUrl: 'http://127.0.0.1:1', apiKey: '', model: 'offline', maxTokens: 256, maxRequestsPerMinute: 30, maxTokensPerMinute: 10000 });
  const socket = { broadcastMessage() {}, broadcastChatBubble() {} } as unknown as SocketServer;
  const conversations = new ConversationEngine(llm, memory, relationships, socket, story);
  const journal: WorldEvent[] = [];
  let seed = 7;
  const dynamics = new WorldDynamics(world, memory, relationships, event => journal.push(event), () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
  conversations.onComplete = (a, b, summary, tick) => dynamics.resolveConversation(a, b, summary, tick);
  const decisions = new DecisionEngine(llm, memory, relationships, story, conversations);
  const actions = new ActionExecutor(relationships, conversations, event => dynamics.record(event));
  return { world, manager, memory, relationships, bus, story, conversations, dynamics, decisions, actions, journal };
}

test('awakening requires evidence and trusted contact; the event links to its cause', () => {
  const { world, dynamics, memory, relationships } = setup();
  const neo = world.agents.get('neo')!; const trinity = world.agents.get('trinity')!;
  neo.mind!.suspicion = 30;
  trinity.isInMatrix = true;
  dynamics.resolveConversation(trinity, neo, '讨论看到的异常', 10);
  assert.equal(neo.isAwakened, false);
  neo.mind!.suspicion = 65;
  relationships.adjustTrust('neo', 'trinity', 10);
  dynamics.resolveConversation(trinity, neo, '核实亲历的异常', 20);
  assert.equal(neo.isAwakened, true);
  const awakening = world.globalEvents.find(e => e.type === 'awakening')!;
  assert.ok(world.globalEvents.some(e => e.id === awakening.causeEventId && e.type === 'conversation'));
  assert.ok(memory.getAllMemories('neo').some(m => m.tags.includes('awakening')));
});

test('Neo story ownership prevents old suspicion and trusted conversations from skipping the red pill', () => {
  const { world, dynamics, relationships } = setup();
  const neo = world.agents.get('neo')!; const trinity = world.agents.get('trinity')!;
  dynamics.neoStory = true; neo.mind!.suspicion = 99; neo.isAwakened = false;
  trinity.isInMatrix = true; trinity.position = { ...neo.position }; relationships.adjustTrust('neo', 'trinity', 80);
  dynamics.resolveConversation(trinity, neo, '旧存档里的觉醒情报', 10);
  dynamics.anomaly(11, neo.currentLocation);
  assert.equal(neo.isAwakened, false);
  assert.ok(!world.globalEvents.some(e => e.type === 'anomaly' && e.involvedAgents.includes('neo')));
});

test('ordinary conversations do not expose late-campaign memories or awakened NPC knowledge', async () => {
  const { world, conversations, memory } = setup();
  const neo = world.agents.get('neo')!; const trinity = world.agents.get('trinity')!;
  trinity.isInMatrix = true; trinity.position = { ...neo.position }; neo.mind!.suspicion = 100;
  memory.record('neo', 'discovery', '机器城与 Smith 病毒的最终战争', { importance: 10 });
  conversations.ordinaryLife = true;
  const id = conversations.startConversation('neo', 'trinity', neo, trinity, undefined, 0);
  assert.ok(id);
  await conversations.tickConversations(world.agents, 1);
  const line = conversations.getActiveConversations()[0].messages[0].content;
  assert.doesNotMatch(line, /机器|Smith|矩阵|异常|救世主/);
  assert.match(line, /报表|街道|曲子/);
});

test('narrative NPCs remain available while ordinary citizens follow the actual daytime clock', async () => {
  const { manager, decisions, world } = setup();
  decisions.narrativeMode = true; decisions.timeOfDay = 12000; decisions.reservedAgents = new Set(['morpheus']);
  const morpheus = manager.getAgent('morpheus')!; morpheus.state.currentAction = null; morpheus.state.targetPosition = null;
  await decisions.batchDecide([morpheus], world.agents, 1);
  assert.equal(morpheus.state.currentAction, null);
  const neo = manager.getAgent('neo')!; neo.state.currentAction = null; neo.state.targetPosition = null;
  await decisions.batchDecide([neo], new Map([[neo.id, neo.state]]), 1);
  assert.notEqual(neo.state.currentAction?.parameters.location, 'nightclub');
});

test('story does not advance with time alone; evolution population counts real residents', () => {
  const { world, story, bus } = setup();
  story.evaluate(100000, [...world.agents.values()], []);
  assert.equal(story.getCurrentPhaseId(), 'phase1_normal_life');
  const evolution = new EvolutionEngine(bus);
  world.agents.get('neo')!.status = 'dead';
  evolution.evaluate(100000, [...world.agents.values()], []);
  assert.equal(evolution.getUpdate().population, world.agents.size - 1);
});

test('autonomous crew deployment cannot teleport a player-controlled character', () => {
  const { world, dynamics } = setup();
  const trinity = world.agents.get('trinity')!;
  trinity.controller = 'player';
  const position = { ...trinity.position };
  dynamics.anomaly(8); dynamics.tick(15);
  assert.equal(trinity.isInMatrix, false);
  assert.deepEqual(trinity.position, position);
});

test('deployed crew routines stay in the current world until they use an exit', async () => {
  const { manager, decisions } = setup();
  const trinity = manager.getAgent('trinity')!;
  trinity.state.isInMatrix = true; trinity.state.currentLocation = 'downtown';
  trinity.state.mind!.energy = 100; trinity.state.mind!.stress = 0;
  const alone = new Map([[trinity.id, trinity.state]]);
  for (const tick of [1, 101, 201, 301]) {
    trinity.state.currentAction = null; trinity.state.targetPosition = null;
    await decisions.batchDecide([trinity], alone, tick);
    const location = trinity.state.currentAction?.parameters.location as string | undefined;
    if (location) assert.equal(LOCATIONS[location].world, 'matrix', 'daily routines cannot walk into another world');
  }
});

test('a conversation rejects distant, dead, and cross-world participants', () => {
  const { world, conversations } = setup();
  const neo = world.agents.get('neo')!; const trinity = world.agents.get('trinity')!;
  assert.equal(conversations.startConversation(neo.id, trinity.id, neo, trinity, undefined, 1), null);
  trinity.isInMatrix = true; trinity.position = { ...neo.position }; trinity.status = 'dead';
  assert.equal(conversations.startConversation(neo.id, trinity.id, neo, trinity, undefined, 2), null);
  trinity.status = 'alive'; trinity.position.x += 100;
  assert.equal(conversations.startConversation(neo.id, trinity.id, neo, trinity, undefined, 3), null);
});

test('a delayed model dialogue is used without blocking ticks; unavailable models fall back', async () => {
  const { world, memory, relationships, story } = setup();
  const a = world.agents.get('neo')!; const b = world.agents.get('trinity')!;
  b.isInMatrix = a.isInMatrix; b.position = { ...a.position };
  let resolve!: (result: { content: string }) => void;
  const model = { enabled: true, complete: () => new Promise(done => { resolve = done; }) } as unknown as LLMClient;
  const emitted: { type: string; data: { content?: string } }[] = [];
  const socket = { broadcastMessage: (message: { type: string; data: { content?: string } }) => emitted.push(message) } as unknown as SocketServer;
  const conversation = new ConversationEngine(model, memory, relationships, socket, story);
  conversation.startConversation(a.id, b.id, a, b, undefined, 0);
  await conversation.tickConversations(world.agents, 1);
  assert.equal(emitted.filter(message => message.type === 'conversation_message').length, 0);
  resolve({ content: JSON.stringify(['我记得那通电话。', '去出口核实一下。', '一起去。']) });
  await Promise.resolve();
  for (const tick of [3, 7, 11]) await conversation.tickConversations(world.agents, tick);
  assert.deepEqual(emitted.filter(message => message.type === 'conversation_message').map(message => message.data.content), ['我记得那通电话。', '去出口核实一下。', '一起去。']);

  const stalled = new ConversationEngine(model, memory, relationships, socket, story);
  stalled.startConversation(a.id, b.id, a, b, undefined, 30);
  for (const tick of [42, 46, 50]) await stalled.tickConversations(world.agents, tick);
  assert.equal(stalled.getActiveConversations().length, 0, 'model latency must not leave characters stuck');
  assert.equal(emitted.filter(message => message.type === 'conversation_message').length, 6);
});

test('offline world runs 1200 ticks with conversations, travel, memories and consequences', async () => {
  const { world, manager, dynamics, decisions, actions, conversations, story, memory, journal } = setup();
  for (let tick = 1; tick <= 1200; tick++) {
    await conversations.tickConversations(world.agents, tick);
    if (tick % 5 === 0) await decisions.batchDecide(manager.getAllAgents(), world.agents, tick);
    for (const agent of manager.getAliveAgents()) {
      const action = agent.state.currentAction;
      if (action && action.progress < 1) actions.execute(agent.state, action, world.agents, tick);
    }
    manager.updateAllAgents(tick); dynamics.tick(tick); world.advanceTick();
    story.evaluate(tick, [...world.agents.values()], world.globalEvents);
    for (const agent of world.agents.values()) {
      assert.ok(Number.isFinite(agent.position.x) && Number.isFinite(agent.position.y) && Number.isFinite(agent.position.z));
      assert.ok(agent.health >= 0 && agent.health <= agent.maxHealth);
      assert.ok(agent.mind!.energy >= 0 && agent.mind!.energy <= 100);
    }
  }
  assert.ok(journal.some(e => e.type === 'conversation'));
  assert.ok(journal.some(e => e.type === 'arrival'));
  assert.ok(journal.some(e => e.type === 'awakening'));
  assert.ok(memory.getAllMemories('neo').length > 0);
  assert.ok(world.globalEvents.length <= 100);
  console.log('Emergent events:', Object.fromEntries([...new Set(journal.map(e => e.type))].map(type => [type, journal.filter(e => e.type === type).length])));
});
