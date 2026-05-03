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
import { RelationshipGraph } from './agents/RelationshipGraph.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { StoryEngine } from './story/StoryEngine.js';
import { LLMClient } from './llm/LLMClient.js';
import { SocketServer } from './network/SocketServer.js';
import { StateSync } from './network/StateSync.js';

// Core systems
const eventBus = new EventBus();
const worldState = new WorldState();
const memoryManager = new MemoryManager();
const relationshipGraph = new RelationshipGraph();
const llmClient = new LLMClient(config.llm);
const storyEngine = new StoryEngine(eventBus);
const actionExecutor = new ActionExecutor(relationshipGraph);
const decisionEngine = new DecisionEngine(llmClient, memoryManager, relationshipGraph, storyEngine);
const agentManager = new AgentManager(worldState);

// Express + Socket.IO
const app = express();
const httpServer = createServer(app);
const socketServer = new SocketServer(httpServer);
const stateSync = new StateSync();

// Serve static client files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../../client/dist')));

// REST API
app.get('/api/status', (_req, res) => {
  res.json({
    tick: simLoop.getTick(),
    phase: storyEngine.getCurrentPhaseId(),
    agentCount: agentManager.getAllAgents().length,
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

// Handle story events
eventBus.on('phase_change', (data: unknown) => {
  const d = data as { from: string; to: string; name: string; description: string; tick: number };
  socketServer.broadcastPhaseChange(d.from as any, d.to, d.name, d.description, d.tick);
});

eventBus.on('story_event', (data: unknown) => {
  const d = data as { name: string; tick: number };
  socketServer.broadcastStoryEvent(d.name, `Story event: ${d.name}`, d.tick);
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
      socketServer.broadcastChatBubble(speakers[0], `[对话] ${d.parameters.topic}`, d.tick);
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

    // 2. Agent decisions (batched)
    if (simLoop.shouldDecide()) {
      try {
        await decisionEngine.batchDecide(agentManager.getAllAgents(), worldState.agents, tick);
      } catch (err) {
        // Silently handle decision errors
      }
    }

    // 3. Execute actions
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

    // 4. Update all agents (movement, effects, cooldowns)
    agentManager.updateAllAgents(tick);

    // 5. Sync to clients
    if (simLoop.shouldSync()) {
      const delta = stateSync.calculateDelta(worldState.agents);
      socketServer.broadcastDelta(delta, tick);
    }
  }
);

// Start
async function main() {
  // Initialize relationships and agents
  relationshipGraph.initialize();
  agentManager.initializeAllAgents();

  // Send full state to new clients
  socketServer.getIO().on('connection', (socket) => {
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
    console.log(`╚══════════════════════════════════════╝\n`);
  });
}

main().catch(console.error);
