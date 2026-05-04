import * as THREE from 'three';
import type {
  AgentState,
  WorldStateFull,
  WorldStateDelta,
  ConversationStartData,
  ConversationMessageData,
  StoryEventData,
  EffectData,
  StoryPhaseId,
} from '@auto_matrix/shared';
import { Engine } from './engine/Engine.js';
import { SocketClient } from './network/SocketClient.js';
import { HUD } from './ui/HUD.js';
import { AgentPanel } from './ui/AgentPanel.js';
import { ConversationView } from './ui/ConversationView.js';
import { ControlPanel } from './ui/ControlPanel.js';

const overlay = document.getElementById('ui-overlay')!;
const app = document.getElementById('app')!;

const agents: Record<string, AgentState> = {};
let currentPhase: StoryPhaseId = 'phase1_normal_life';
let currentTick = 0;
let currentTimeOfDay = 0;
let activeConversations = 0;
let selectedAgentId: string | null = null;

const agentNameMap = new Map<string, string>();

const engine = new Engine(app);

const hud = new HUD(overlay, {
  onSpeedChange: (speed: number) => socket.setSpeed(speed),
  onPause: () => socket.pause(),
  onResume: () => socket.resume(),
});

const agentPanel = new AgentPanel(overlay, () => {
  selectedAgentId = null;
  engine.getCameraController().clearFollow();
});

const conversationView = new ConversationView(overlay);

// Wire 3D speech bubble system into the conversation view
conversationView.setAgentRenderer(engine.getAgentRenderer());

const controlPanel = new ControlPanel(overlay, {
  onSpeedChange: (speed: number) => socket.setSpeed(speed),
  onPause: () => socket.pause(),
  onResume: () => socket.resume(),
  onFocusAgent: (agentId: string) => {
    const state = agents[agentId];
    if (state) {
      engine.getCameraController().setFollowTarget(state.position);
      selectedAgentId = agentId;
      agentPanel.show();
      agentPanel.update(state);
      socket.inspectAgent(agentId);
    }
  },
});

function spawnEffectForAgents(data: EffectData): void {
  for (const agentId of data.agents) {
    const state = agents[agentId];
    if (state) {
      engine.getParticleSystem().spawnEffect(
        data.effectType,
        new THREE.Vector3(state.position.x, state.position.y, state.position.z),
      );
    }
  }
}

const socket = new SocketClient({
  onWorldStateFull: (data: WorldStateFull, tick: number) => {
    currentTick = tick;
    currentPhase = data.phase;
    currentTimeOfDay = data.timeOfDay;

    for (const [id, state] of Object.entries(data.agents)) {
      agents[id] = state;
      agentNameMap.set(id, state.name);
      conversationView.registerAgentName(id, state.name);
    }

    engine.updateAgents(agents);
    controlPanel.setAgentOptions(agentNameMap);
    controlPanel.setPhase(currentPhase);
  },

  onWorldStateDelta: (data: WorldStateDelta & { timeOfDay?: number }, tick: number) => {
    currentTick = tick;
    if (data.timeOfDay !== undefined) {
      currentTimeOfDay = data.timeOfDay;
    }

    for (const [id, partial] of Object.entries(data.agents)) {
      if (agents[id]) {
        agents[id] = { ...agents[id], ...partial };
      }
    }

    // updateAgents calls agentRenderer.updateAgent for each agent,
    // which now automatically updates action indicators from currentAction
    engine.updateAgents(agents);

    if (selectedAgentId && agents[selectedAgentId]) {
      agentPanel.update(agents[selectedAgentId]);
    }
  },

  onAgentUpdate: (data: { id: string; state: Partial<AgentState> }, tick: number) => {
    currentTick = tick;
    if (agents[data.id]) {
      agents[data.id] = { ...agents[data.id], ...data.state };
      if (!agentNameMap.has(data.id) && data.state.name) {
        agentNameMap.set(data.id, data.state.name);
        conversationView.registerAgentName(data.id, data.state.name!);
        controlPanel.setAgentOptions(agentNameMap);
      }
    }
  },

  onConversationStart: (data: ConversationStartData, _tick: number) => {
    activeConversations++;
    conversationView.showConversation(data);
  },

  onConversationMessage: (data: ConversationMessageData, _tick: number) => {
    // addMessage now also triggers 3D speech bubbles via AgentRenderer
    conversationView.addMessage(data);
  },

  onConversationEnd: (data: { id: string }, _tick: number) => {
    activeConversations = Math.max(0, activeConversations - 1);
    conversationView.hideConversation(data.id);
  },

  onStoryEvent: (data: StoryEventData, _tick: number) => {
    controlPanel.addEvent(data);
  },

  onPhaseChange: (data: { phase: string; name: string; description: string }, _tick: number) => {
    currentPhase = data.phase as StoryPhaseId;
    controlPanel.setPhase(currentPhase);
    controlPanel.addEventText(`PHASE CHANGE: ${data.name}`);
  },

  onEffect: (data: EffectData, _tick: number) => {
    spawnEffectForAgents(data);
  },

  onChatBubble: (data: { agentId: string; text: string }, _tick: number) => {
    const name = agentNameMap.get(data.agentId) ?? data.agentId;

    // Add to side-panel transcript
    conversationView.addMessage({
      conversationId: 'bubble',
      speaker: data.agentId,
      content: data.text,
      tone: 'normal',
    });

    // Also explicitly spawn 3D speech bubble above the agent
    engine.getAgentRenderer().showSpeechBubble(data.agentId, name, data.text);
  },

  onNotification: (data: { message: string; level: string }, _tick: number) => {
    controlPanel.addEventText(data.message);
  },
});

// Raycaster for agent picking on click
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

app.addEventListener('click', (e: MouseEvent) => {
  if (e.button !== 0) return;

  const renderer = engine.renderer;
  const camera = engine.camera;
  const rect = renderer.domElement.getBoundingClientRect();

  mouseVec.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );

  raycaster.setFromCamera(mouseVec, camera);

  let closestId: string | null = null;
  let closestDist = Infinity;

  for (const [id] of Object.entries(agents)) {
    const group = engine.getAgentRenderer().getAgent(id);
    if (!group) continue;

    const agentPos = group.position.clone();
    const sphere = new THREE.Sphere(agentPos, 4);
    const intersection = new THREE.Vector3();

    if (raycaster.ray.intersectSphere(sphere, intersection)) {
      const dist = camera.position.distanceTo(intersection);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = id;
      }
    }
  }

  if (closestId) {
    selectedAgentId = closestId;
    const state = agents[closestId];
    if (state) {
      agentPanel.show();
      agentPanel.update(state);
      engine.getCameraController().setFollowTarget(state.position);
      socket.inspectAgent(closestId);
    }
  }
});

socket.connect();
engine.start();

// HUD update loop — separate from render loop for UI updates
let lastUIUpdate = performance.now();
function uiUpdateLoop(): void {
  const now = performance.now();
  const delta = (now - lastUIUpdate) / 1000;
  lastUIUpdate = now;

  hud.updateHUD(
    currentTick,
    currentPhase,
    currentTimeOfDay,
    Object.keys(agents).length,
    activeConversations,
  );
  conversationView.update(delta);
  controlPanel.update(delta);

  if (selectedAgentId && agents[selectedAgentId]) {
    agentPanel.update(agents[selectedAgentId]);
    engine.getCameraController().setFollowTarget(agents[selectedAgentId].position);
  }

  requestAnimationFrame(uiUpdateLoop);
}

requestAnimationFrame(uiUpdateLoop);
