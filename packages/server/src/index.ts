import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SimulationState, WorldStateFull, SandboxCommand } from '@auto_matrix/shared';
import { NEO_CAST } from '@auto_matrix/shared';
import { config } from './config.js';
import { EventBus } from './simulation/EventBus.js';
import { SimulationLoop } from './simulation/SimulationLoop.js';
import { WorldState } from './world/WorldState.js';
import { AgentManager } from './agents/AgentManager.js';
import { DecisionEngine } from './agents/DecisionEngine.js';
import { ActionExecutor } from './agents/ActionExecutor.js';
import { ConversationEngine } from './agents/ConversationEngine.js';
import { RelationshipGraph } from './agents/RelationshipGraph.js';
import { PersistentMemoryManager } from './memory/PersistentMemoryManager.js';
import { StoryEngine } from './story/StoryEngine.js';
import { EvolutionEngine } from './story/EvolutionEngine.js';
import { WorldDynamics } from './story/WorldDynamics.js';
import { LLMClient } from './llm/LLMClient.js';
import { SocketServer } from './network/SocketServer.js';
import { StateSync } from './network/StateSync.js';
import { PlayerController } from './player/PlayerController.js';
import { CheckpointStore } from './world/CheckpointStore.js';
import { SandboxSystem } from './player/SandboxSystem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventBus = new EventBus();
const world = new WorldState();
const memory = new PersistentMemoryManager(path.resolve(__dirname, '../../../data/memories'));
const checkpoints = new CheckpointStore(path.resolve(__dirname, '../../../data/world.json'));
const relationships = new RelationshipGraph();
const llm = new LLMClient(config.llm);
const story = new StoryEngine(eventBus);
const evolution = new EvolutionEngine(eventBus);
const app = express();
const httpServer = createServer(app);
const sockets = new SocketServer(httpServer);
const sync = new StateSync();
const manager = new AgentManager(world);
const conversations = new ConversationEngine(llm, memory, relationships, sockets, story);
const dynamics = new WorldDynamics(world, memory, relationships, event => sync.addEvent(event));
conversations.onComplete = (a, b, summary, tick) => dynamics.resolveConversation(a, b, summary, tick);
const decisions = new DecisionEngine(llm, memory, relationships, story, conversations);
const actions = new ActionExecutor(relationships, conversations, event => dynamics.record(event));
const sandbox = new SandboxSystem(world, dynamics);
const players = new PlayerController(world, conversations, actions, dynamics, sandbox);
sandbox.onImpact = actions.onImpact = (impact, tick) => {
  if (impact.damage > 0) players.takeHit(impact.target);
  sockets.broadcastMessage({ type: 'effect', data: { effectType: 'melee_hit', agents: [impact.source, impact.target], duration: .35, impact }, tick, timestamp: Date.now() });
  sockets.broadcastDelta({ ...sync.calculateDelta(world.agents), sandbox: sandbox.state }, tick);
};
players.onSkill = (skill, tick) => {
  sockets.broadcastMessage({ type: 'effect', data: { effectType: 'combat_skill', agents: [skill.source], duration: 1, skill }, tick, timestamp: Date.now() });
  sockets.broadcastDelta({ ...sync.calculateDelta(world.agents), sandbox: sandbox.state }, tick);
};
players.onReplaced = (socketId, tick) => {
  sockets.getIO().to(socketId).emit('message', { type: 'player_state', data: { agentId: null, message: '已在另一页面继续游玩，进度已保留。当前页面已退出角色控制。' }, tick, timestamp: Date.now() });
};
let speed = 1;

function simulationState(): SimulationState {
  const agents = [...world.agents.values()];
  const alive = agents.filter(a => a.status === 'alive');
  const recent = world.globalEvents.filter(e => simLoop.getTick() - e.tick < 100);
  const humans = alive.filter(a => a.faction !== 'machines' && a.isInMatrix);
  return {
    running: simLoop.isRunning(), speed, timeScale: players.timeScale(), tick: simLoop.getTick(),
    mode: llm.enabled ? 'llm' : 'rules', llmStatus: llm.status,
    population: alive.length, awakened: alive.filter(a => a.isAwakened).length,
    tension: Math.min(100, Math.round(recent.filter(e => e.type === 'gunfight').length * 7 + alive.reduce((sum, a) => sum + (a.mind?.stress ?? 0), 0) / Math.max(1, alive.length))),
    anomaly: Math.round(humans.reduce((sum, a) => sum + (a.mind?.suspicion ?? 0), 0) / Math.max(1, humans.length)),
    conversations: conversations.getActiveConversations().length,
    day: world.day,
    chapter: sandbox.life.chapter?.title ?? story.getCurrentPhase().name, chapterDescription: sandbox.life.chapter?.objective ?? story.getCurrentPhase().description,
  };
}

function snapshot(): WorldStateFull {
  return { agents: Object.fromEntries(world.agents), chunks: {}, locations: Object.fromEntries(world.locations),
    phase: story.getCurrentPhaseId(), timeOfDay: world.timeOfDay, events: world.getRecentEvents(100), simulation: simulationState(), sandbox: sandbox.state };
}

async function saveWorld(): Promise<void> {
  await memory.saveAll();
  await checkpoints.save({ version: 1, tick: simLoop.getTick(), timeOfDay: world.timeOfDay, day: world.day, phase: story.getCurrentPhaseId(),
    agents: Object.fromEntries(world.agents), events: world.globalEvents,
    relationships: [...world.agents.keys()].flatMap(id => relationships.getRelationshipsForAgent(id)), sandbox: sandbox.state });
}

const simLoop = new SimulationLoop(config.simulation.tickRateMs, config.simulation.agentDecisionIntervalTicks,
  config.simulation.reflectionIntervalTicks, config.simulation.stateSyncIntervalTicks, eventBus, async tick => {
    dynamics.neoStory = decisions.narrativeMode = Boolean(sandbox.state.neoLife);
    conversations.ordinaryLife = Boolean(sandbox.state.neoLife && !world.agents.get('neo')?.isAwakened);
    decisions.reservedAgents = new Set(sandbox.state.neoLife ? NEO_CAST : []);
    decisions.timeOfDay = world.timeOfDay;
    await conversations.tickConversations(world.agents, tick);
    if (simLoop.shouldDecide()) await decisions.batchDecide(manager.getAllAgents(), world.agents, tick);
    for (const agent of manager.getAliveAgents()) {
      if (agent.state.controller || decisions.reservedAgents.has(agent.id)) continue;
      if (decisions.narrativeMode && agent.state.currentAction?.type === 'attack') { agent.state.currentAction = null; continue; }
      const action = agent.state.currentAction;
      if (action && action.progress < 1) actions.execute(agent.state, action, world.agents, tick);
    }
    manager.updateAllAgents(tick);
    dynamics.tick(tick);
    sandbox.tick(tick);
    if (sandbox.state.ending === 'peace') story.setCeasefire(tick);
    world.advanceTick(sandbox.state.neoLife ? .25 : .72);
    if (!sandbox.state.neoLife) {
      story.evaluate(tick, [...world.agents.values()], world.globalEvents);
      evolution.evaluate(tick, [...world.agents.values()], world.globalEvents);
    }
    world.setPhase(story.getCurrentPhaseId());
    if (simLoop.shouldSave()) await saveWorld();
    if (simLoop.shouldSync()) sockets.broadcastDelta({ ...sync.calculateDelta(world.agents), timeOfDay: world.timeOfDay, simulation: simulationState(), sandbox: sandbox.state }, tick);
  });

eventBus.on('phase_change', data => {
  const change = data as { from: WorldStateFull['phase']; to: string; name: string; description: string; tick: number };
  sockets.broadcastPhaseChange(change.from, change.to, change.name, change.description, change.tick);
});

app.use(express.static(path.join(__dirname, '../../client/dist')));
app.use(express.json());
app.get('/api/status', (_req, res) => res.json({ ...simulationState(), phase: story.getCurrentPhaseId(), agentCount: world.agents.size, uptime: process.uptime() }));
app.get('/api/world', (_req, res) => res.json(snapshot()));
app.get('/api/sandbox', (_req, res) => res.json(sandbox.state));
app.get('/api/agents', (_req, res) => res.json([...world.agents.values()]));
app.get('/api/agents/:id', (req, res) => {
  const agent = world.agents.get(req.params.id);
  return agent ? res.json(agent) : res.status(404).json({ error: 'Agent not found' });
});
app.get('/api/agents/:id/context', (req, res) => {
  if (!world.agents.has(req.params.id)) return res.status(404).json({ error: 'Agent not found' });
  res.json({ memories: memory.getRecentContext(req.params.id, 12), relationships: relationships.getRelationshipsForAgent(req.params.id).filter(r => r.lastInteraction > 0 || r.trust > 30).slice(0, 8) });
});
app.get('/api/events', (_req, res) => res.json(world.getRecentEvents(100)));
app.get('/api/story', (_req, res) => res.json({ phase: story.getCurrentPhaseId(), phaseInfo: story.getCurrentPhase() }));
app.get('/api/evolution', (_req, res) => res.json(evolution.getUpdate()));
app.get('/api/conversations', (_req, res) => res.json({ active: conversations.getActiveConversations() }));
app.get('/api/memories/:agentId', (req, res) => res.json({ recent: memory.getRecentContext(req.params.agentId, 20), total: memory.getMemoryCount(req.params.agentId) }));

sockets.getIO().on('connection', socket => {
  sockets.sendFullState(socket.id, snapshot(), simLoop.getTick());
  socket.on('message', (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const { type, data } = message as { type?: string; data?: { speed?: number; kind?: string; agentId?: string; target?: string; takeover?: boolean } };
    if (type === 'play_as' && typeof data?.agentId === 'string') {
      const result = players.possess(socket.id, data.agentId, simLoop.getTick(), data.takeover === true);
      if (result.agentId === 'neo') sandbox.life.begin(world.agents.get('neo')!, simLoop.getTick());
      sockets.broadcastDelta({ ...sync.calculateDelta(world.agents), timeOfDay: world.timeOfDay, simulation: simulationState(), sandbox: sandbox.state }, simLoop.getTick());
      socket.emit('message', { type: 'player_state', data: result, tick: simLoop.getTick(), timestamp: Date.now() });
      return;
    }
    if (type === 'leave_character') {
      players.release(socket.id, simLoop.getTick());
      socket.emit('message', { type: 'player_state', data: { agentId: null }, tick: simLoop.getTick(), timestamp: Date.now() });
      sockets.broadcastDelta(sync.calculateDelta(world.agents), simLoop.getTick());
      return;
    }
    if (type === 'player_input') { players.receiveInput(socket.id, data); return; }
    if ((type === 'sandbox_action' || type === 'player_action') && !simLoop.isRunning()) {
      socket.emit('message', { type: 'notification', data: { message: '世界已暂停，请先继续时间。', level: 'info' }, tick: simLoop.getTick(), timestamp: Date.now() });
      return;
    }
    if (type === 'sandbox_action' && typeof data?.kind === 'string' && simLoop.isRunning()) {
      const text = players.sandboxAction(socket.id, { kind: data.kind as SandboxCommand['kind'], target: typeof data.target === 'string' ? data.target : undefined }, simLoop.getTick());
      if (text) socket.emit('message', { type: 'notification', data: { message: text, level: 'info' }, tick: simLoop.getTick(), timestamp: Date.now() });
      sockets.broadcastDelta({ ...sync.calculateDelta(world.agents), sandbox: sandbox.state, timeOfDay: world.timeOfDay, simulation: simulationState() }, simLoop.getTick());
      return;
    }
    if (type === 'player_action' && typeof data?.kind === 'string' && simLoop.isRunning()) {
      const text = players.act(socket.id, data.kind, simLoop.getTick());
      if (text) socket.emit('message', { type: 'notification', data: { message: text, level: 'info' }, tick: simLoop.getTick(), timestamp: Date.now() });
      return;
    }
    if (type === 'request_full_state') {
      sockets.sendFullState(socket.id, snapshot(), simLoop.getTick());
      return;
    }
    if (type === 'pause') simLoop.stop();
    else if (type === 'resume') simLoop.start();
    else if (type === 'set_speed') {
      if (![0.5, 1, 2, 4, 8].includes(data?.speed ?? 0)) return;
      speed = data!.speed!;
      simLoop.setTickRate(config.simulation.tickRateMs / speed / players.timeScale());
    } else if (type === 'intervene') {
      if (!simLoop.isRunning()) return;
      // A bounded, explicit observer action; the resulting event is recorded with its origin.
      if (data?.kind === 'anomaly') dynamics.anomaly(simLoop.getTick());
      else if (data?.kind === 'ceasefire') {
        story.setCeasefire(simLoop.getTick());
        for (const agent of world.agents.values()) {
          if (agent.mind) agent.mind.stress = Math.max(0, agent.mind.stress - 35);
          if (agent.currentAction?.type === 'attack') {
            agent.currentAction = null;
            agent.targetPosition = null;
            agent.currentPath = [];
            agent.velocity = { x: 0, y: 0, z: 0 };
          }
        }
        dynamics.record({ type: 'ceasefire', title: '短暂的停火窗口', description: '观察者向双方广播了停火信号。', cause: '观察者干预',
          consequence: '接下来 180 个模拟刻暂停主动攻击，人物仍可移动、交谈与恢复。', involvedAgents: [], location: 'times_square', tick: simLoop.getTick(), importance: 8 });
      } else return;
    } else return;
    sockets.broadcastDelta({ ...sync.calculateDelta(world.agents), simulation: simulationState() }, simLoop.getTick());
  });
  socket.on('disconnect', () => players.release(socket.id, simLoop.getTick()));
});

let previousTimeScale = 1;
let lastPlayerStep = Date.now();
const playerTimer = setInterval(() => {
  const now = Date.now();
  players.step(Math.min(0.1, (now - lastPlayerStep) / 1000), simLoop.isRunning(), simLoop.getTick(), now);
  lastPlayerStep = now;
  const scale = players.timeScale();
  if (scale !== previousTimeScale) {
    previousTimeScale = scale;
    simLoop.setTickRate(config.simulation.tickRateMs / speed / scale);
    sockets.broadcastDelta({ agents: {}, dirtyChunks: {}, events: [], simulation: simulationState() }, simLoop.getTick());
  }
  const controlled = [...world.agents.entries()].filter(([, agent]) => agent.controller);
  if (controlled.length) sockets.broadcastDelta({ agents: Object.fromEntries(controlled), dirtyChunks: {}, events: [] }, simLoop.getTick());
}, 50);

async function main(): Promise<void> {
  relationships.initialize();
  manager.initializeAllAgents();
  await memory.loadAll();
  const checkpoint = await checkpoints.load();
  if (checkpoint) {
    for (const [id, saved] of Object.entries(checkpoint.agents)) {
      const agent = manager.getAgent(id);
      if (!agent) continue;
      Object.assign(agent.state, saved);
      delete agent.state.controller;
      if (agent.state.currentAction?.type === 'talk_to' || agent.state.currentAction?.parameters.player) {
        agent.state.currentAction = null; agent.state.targetPosition = null; agent.state.currentPath = [];
        agent.state.velocity = { x: 0, y: 0, z: 0 };
      }
    }
    simLoop.restoreTick(checkpoint.tick);
    world.simulationTick = checkpoint.tick;
    world.timeOfDay = checkpoint.timeOfDay ?? (21000 + checkpoint.tick * 12) % 24000;
    world.day = checkpoint.day ?? Math.floor((21000 + checkpoint.tick * 12) / 24000) + 1;
    world.globalEvents = checkpoint.events.slice(-100);
    if (checkpoint.sandbox) sandbox.restore(checkpoint.sandbox);
    relationships.restore(checkpoint.relationships);
    story.restorePhase(checkpoint.phase);
    world.setPhase(checkpoint.phase);
    console.log(`[Auto Matrix] Restored world at tick ${checkpoint.tick}`);
  }
  evolution.evaluate(simLoop.getTick(), [...world.agents.values()], world.globalEvents);
  simLoop.start();
  httpServer.listen(config.server.port, config.server.host, () => console.log(`[Auto Matrix] ${world.agents.size} residents · ${llm.enabled ? 'model-enhanced' : 'local simulation'} · http://localhost:${config.server.port}`));
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  simLoop.stop();
  clearInterval(playerTimer);
  void saveWorld().catch(error => console.error('[Save] Failed:', error)).finally(() => { sockets.getIO().close(); httpServer.close(); process.exit(0); });
});
main().catch(error => { console.error(error); process.exitCode = 1; });
