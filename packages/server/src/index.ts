import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

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
import { LLMClient } from './llm/LLMClient.js';
import { SocketServer } from './network/SocketServer.js';
import { StateSync } from './network/StateSync.js';

// Core systems
const eventBus = new EventBus();
const worldState = new WorldState();
const memoryManager = new PersistentMemoryManager();
const relationshipGraph = new RelationshipGraph();
const llmClient = new LLMClient(config.llm);
const storyEngine = new StoryEngine(eventBus);
const evolutionEngine = new EvolutionEngine(eventBus);

// Express + Socket.IO
const app = express();
const httpServer = createServer(app);
const socketServer = new SocketServer(httpServer);
const stateSync = new StateSync();

// ConversationEngine depends on memory, relationships, socket, story
const conversationEngine = new ConversationEngine(
  llmClient,
  memoryManager,
  relationshipGraph,
  socketServer,
  storyEngine,
);

const actionExecutor = new ActionExecutor(relationshipGraph, conversationEngine);
const decisionEngine = new DecisionEngine(
  llmClient,
  memoryManager,
  relationshipGraph,
  storyEngine,
  conversationEngine,
);
const agentManager = new AgentManager(worldState);

// Serve static client files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../../client/dist')));
app.use(express.json());

// REST API
app.get('/api/status', (_req, res) => {
  res.json({
    tick: simLoop.getTick(),
    phase: storyEngine.getCurrentPhaseId(),
    agentCount: agentManager.getAllAgents().length,
    activeConversations: conversationEngine.getActiveConversations().length,
    connectedClients: socketServer.getConnectedCount(),
    uptime: process.uptime(),
  });
});

app.get('/api/agents', (_req, res) => {
  const agents = agentManager.getAllAgents().map(a => a.state);
  res.json(agents);
});

app.get('/api/agents/:id', (req, res) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent.state);
});

app.get('/api/story', (_req, res) => {
  res.json({
    phase: storyEngine.getCurrentPhaseId(),
    phaseInfo: storyEngine.getCurrentPhase(),
  });
});

app.get('/api/evolution', (_req, res) => {
  res.json(evolutionEngine.getUpdate());
});

// Conversation endpoints
app.get('/api/conversations', (_req, res) => {
  const active = conversationEngine.getActiveConversations();
  res.json({
    active,
    count: active.length,
  });
});

app.get('/api/conversations/:agentId', (req, res) => {
  const agentId = req.params.agentId;
  const memories = memoryManager.getMemoriesByType(agentId, 'conversation');
  res.json({
    agentId,
    conversations: memories,
    count: memories.length,
  });
});

// Memory endpoints
app.get('/api/memories/:agentId', (req, res) => {
  const agentId = req.params.agentId;
  const all = memoryManager.getAllMemories(agentId);
  const byType = {
    conversation: memoryManager.getMemoriesByType(agentId, 'conversation'),
    observation: memoryManager.getMemoriesByType(agentId, 'observation'),
    reflection: memoryManager.getMemoriesByType(agentId, 'reflection'),
    discovery: memoryManager.getMemoriesByType(agentId, 'discovery'),
    combat: memoryManager.getMemoriesByType(agentId, 'combat'),
    story_event: memoryManager.getMemoriesByType(agentId, 'story_event'),
    relationship: memoryManager.getMemoriesByType(agentId, 'relationship'),
  };
  res.json({
    agentId,
    total: all.length,
    byType,
    recent: memoryManager.getRecentContext(agentId, 10),
    important: memoryManager.getImportantMemories(agentId, 5),
  });
});

// Handle story events
eventBus.on('phase_change', (data: unknown) => {
  const d = data as { from: string; to: string; name: string; description: string; tick: number };
  socketServer.broadcastPhaseChange(d.from as any, d.to, d.name, d.description, d.tick);
});

eventBus.on('story_event', (data: unknown) => {
  const d = data as { name: string; tick: number };
  socketServer.broadcastStoryEvent(d.name, `Story event: ${d.name}`, d.tick);
});

// Handle evolution events
eventBus.on('evolution_phase_change', (data: unknown) => {
  const d = data as { from: string; to: string; name: string; cycleNumber: number; narration: string; tick: number };
  socketServer.broadcastEvolutionUpdate(evolutionEngine.getUpdate(), d.tick);
});

eventBus.on('evolution_narration', (data: unknown) => {
  const d = data as { text: string; tick: number };
  socketServer.broadcastEvolutionNarration(d.text, d.tick);
});

eventBus.on('evolution_reset', (data: unknown) => {
  const d = data as { oldCycleNumber: number; newCycleNumber: number; tick: number; narrative: string };
  console.log(`[Evolution] CYCLE RESET: #${d.oldCycleNumber} → #${d.newCycleNumber}`);
  // Reset story engine back to phase1
  storyEngine.resetPhase();
  // Respawn dead agents for the new cycle
  agentManager.initializeAllAgents();
});

eventBus.on('story_action', (data: unknown) => {
  const d = data as { type: string; parameters: Record<string, unknown>; tick: number };
  if (d.type === 'narrate') {
    socketServer.broadcastNarration(d.parameters.text as string, d.tick);
  } else if (d.type === 'set_goal') {
    agentManager.setGoal(d.parameters.agentId as string, d.parameters.goal as string);
  } else if (d.type === 'awaken_agent') {
    agentManager.awakenAgent(d.parameters.agentId as string);
  } else if (d.type === 'trigger_dialogue') {
    const speakers = d.parameters.speakers as string[];
    if (speakers.length >= 2) {
      const agent1 = agentManager.getAgent(speakers[0]);
      const agent2 = agentManager.getAgent(speakers[1]);
      if (agent1 && agent2) {
        conversationEngine.startConversation(
          speakers[0],
          speakers[1],
          agent1.state,
          agent2.state,
          d.parameters.topic as string | undefined,
          d.tick,
        );
      }
    }
  }
});

// Simulation tick callback
const simLoop = new SimulationLoop(
  config.simulation.tickRateMs,
  config.simulation.agentDecisionIntervalTicks,
  config.simulation.reflectionIntervalTicks,
  config.simulation.stateSyncIntervalTicks,
  eventBus,
  async (tick: number) => {
    // 1. Evaluate story
    storyEngine.evaluate(tick);

    // 1b. Evaluate evolution cycle
    evolutionEngine.evaluate(tick);

    // 2. Advance active conversations (multi-turn dialogue)
    try {
      await conversationEngine.tickConversations(worldState.agents, tick);
    } catch {
      // Conversation errors are non-critical
    }

    // 3. Agent decisions (batched)
    if (simLoop.shouldDecide()) {
      try {
        await decisionEngine.batchDecide(agentManager.getAllAgents(), worldState.agents, tick);
      } catch {
        // Silently handle decision errors
      }
    }

    // 4. Execute actions
    for (const agent of agentManager.getAllAgents()) {
      const action = agent.state.currentAction;
      if (action && action.progress < 1) {
        const result = actionExecutor.execute(agent.state, action, worldState.agents, tick);
        if (result.success && Object.keys(result.newState).length > 0) {
          Object.assign(agent.state, result.newState);
          worldState.updateAgent(agent.id, result.newState);
        }
        action.progress = Math.min(1, action.progress + 1 / action.duration);
      }
    }

    // 5. Update all agents (movement, effects, cooldowns)
    agentManager.updateAllAgents(tick);

    // 6. Advance time of day (1 tick = 1 sim second, 24000 ticks = full day cycle)
    worldState.advanceTick();

    // 7. Periodic memory consolidation (every 120 ticks)
    if (tick % 120 === 0) {
      for (const agent of agentManager.getAllAgents()) {
        memoryManager.consolidate(agent.id);
      }
    }

    // 8. Persist memories (every 60 ticks)
    if (simLoop.shouldSave()) {
      try {
        const saved = await memoryManager.saveAll();
        if (saved > 0) {
          console.log(`[Memory] Saved memories for ${saved} agents`);
        }
      } catch {
        // Save errors are non-critical
      }
    }

    // 9. Sync to clients
    if (simLoop.shouldSync()) {
      const delta = stateSync.calculateDelta(worldState.agents);
      // Attach timeOfDay to delta (already in 0-24000 range)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (delta as any).timeOfDay = worldState.timeOfDay;
      socketServer.broadcastDelta(delta, tick);
    }
  }
);

// Start
async function main() {
  // Initialize relationships and agents
  relationshipGraph.initialize();
  agentManager.initializeAllAgents();

  // Load persisted memories
  const loadedMemories = await memoryManager.loadAll();
  console.log(`[Memory] Loaded ${loadedMemories} persisted memories`);

  // Send full state to new clients
  socketServer.getIO().on('connection', (socket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agents: Record<string, any> = {};
    for (const agent of agentManager.getAllAgents()) {
      agents[agent.id] = agent.state;
    }
    const locations = worldState.getAllLocations();
    socketServer.sendFullState(socket.id, {
      agents,
      chunks: {},
      locations: Object.fromEntries(locations.map(l => [l.id, l])),
      phase: storyEngine.getCurrentPhaseId(),
      timeOfDay: 12000,
    }, simLoop.getTick());
  });

  // Start simulation
  simLoop.start();

  httpServer.listen(config.server.port, () => {
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║   AUTO_MATRIX - The Matrix Simulation ║`);
    console.log(`║   Server running on port ${String(config.server.port).padEnd(11)}║`);
    console.log(`║   ${String(agentManager.getAllAgents().length).padEnd(3)} agents loaded                   ║`);
    console.log(`║   Memory persistence: ENABLED         ║`);
    console.log(`╚══════════════════════════════════════╝\n`);
  });
}

main().catch(console.error);
