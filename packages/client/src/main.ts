import * as THREE from 'three';
import type { AgentState, SimulationState, WorldEvent, SandboxState } from '@auto_matrix/shared';
import { Engine } from './engine/Engine.js';
import { SocketClient } from './network/SocketClient.js';
import { ObserverUI } from './ui/ObserverUI.js';
import { PlayerControls } from './player/PlayerControls.js';
import { PlayerExperience } from './player/PlayerExperience.js';
import { CharacterViewer } from './player/CharacterViewer.js';
import { SandboxUI } from './player/SandboxUI.js';
import { AudioPanel } from './player/AudioPanel.js';
import './style.css';
import './player/player.css';

const overlay = document.getElementById('ui-overlay')!;
const app = document.getElementById('app')!;
let engine: Engine;
try {
  engine = new Engine(app);
} catch (error) {
  const message = document.createElement('div');
  message.className = 'boot';
  const title = document.createElement('h2'); title.textContent = '无法启动三维渲染';
  const hint = document.createElement('p'); hint.textContent = '请在支持 WebGL 2 的浏览器中开启硬件加速，然后刷新页面。';
  const retry = document.createElement('button'); retry.textContent = '重新尝试'; retry.onclick = () => location.reload();
  message.append(title, hint, retry); overlay.append(message);
  throw error;
}

const agents: Record<string, AgentState> = {};
let simulation: SimulationState | undefined;
let sandbox: SandboxState | undefined;
let timeOfDay = 21000;
let selected: string | null = null;
let following = false;
let inMatrix = true;
let director = false;
let lastCut = 0;
let lastContext = 0;
let contextRequest = false;
let lastUIUpdate = 0;

function setWorld(matrix: boolean): void {
  inMatrix = matrix;
  following = false;
  engine.setWorld(matrix);
  ui.setWorld(matrix);
  ui.setCamera('overview');
}

async function loadContext(id: string): Promise<void> {
  if (contextRequest) return;
  contextRequest = true;
  lastContext = performance.now();
  try {
    const response = await fetch(`/api/agents/${encodeURIComponent(id)}/context`);
    if (!response.ok) throw new Error('Context unavailable');
    ui.setContext(id, await response.json());
  } catch { ui.contextFailed(id); }
  finally { contextRequest = false; }
}

function selectAgent(id: string): void {
  const agent = agents[id];
  if (!agent) return;
  if (agent.isInMatrix !== inMatrix) setWorld(agent.isInMatrix);
  selected = id; following = true; director = false;
  engine.cameraController.director = false;
  engine.agentRenderer.setSelected(id);
  engine.cameraController.setFollowTarget(agent.position);
  ui.showAgent(id); ui.setCamera('follow');
  void loadContext(id);
}

function focusEvent(event: WorldEvent): void {
  const agent = agents[event.involvedAgents[0]];
  const locationMatrix = event.position ? event.position.y >= 0 : agent?.isInMatrix ?? true;
  if (locationMatrix !== inMatrix) setWorld(locationMatrix);
  following = false;
  engine.cameraController.clearFollow();
  if (event.position) engine.cameraController.focusOnPosition(event.position);
  else if (agent) engine.cameraController.focusOnPosition(agent.position);
  engine.showEvent(event);
  ui.showEvent(event);
  ui.setCamera(director ? 'director' : '');
}

const ui = new ObserverUI(overlay, {
  play: () => playerUI.openRoster(),
  pause: () => {
    if (!socket.isConnected || !simulation) return;
    simulation.running ? socket.pause() : socket.resume();
  },
  speed: value => socket.setSpeed(value),
  agent: selectAgent,
  event: focusEvent,
  world: matrix => { director = false; setWorld(matrix); },
  camera: mode => {
    director = mode === 'director';
    engine.cameraController.director = director;
    following = false;
    if (mode === 'overview') engine.cameraController.overview(inMatrix);
    if (mode === 'follow') {
      const fallback = Object.values(agents).find(a => a.isInMatrix === inMatrix && a.status === 'alive');
      const id = selected && agents[selected]?.isInMatrix === inMatrix ? selected : inMatrix ? 'neo' : fallback?.id;
      if (id) selectAgent(id);
    }
    ui.setCamera(mode);
    if (director) ui.toast('导演视角已开启，将关注新发生的重要事件。');
  },
  intervene: kind => socket.send('intervene', { kind }),
  sound: () => audioPanel.open(),
});

function update(force = false): void {
  if (!simulation) return;
  if (force || performance.now() - lastUIUpdate >= 100) {
    if (!controls.id) ui.update(agents, simulation, timeOfDay);
    playerUI.update(agents, simulation, sandbox?.neoLife);
    sandboxUI.update(controls.id ? agents[controls.id] : undefined, sandbox, timeOfDay, simulation.tick, simulation.day);
    lastUIUpdate = performance.now();
  }
  const player = controls.id ? agents[controls.id] : undefined;
  if (player && player.isInMatrix !== inMatrix) {
    inMatrix = player.isInMatrix;
    engine.setWorld(inMatrix, false);
    ui.setWorld(inMatrix);
  }
  engine.updateAgents(agents);
  engine.setSimulation(simulation, timeOfDay);
  engine.audio.update({ player, sandbox, time: timeOfDay, matrix: inMatrix, running: simulation.running });
  if (sandbox) {
    engine.setSandbox(sandbox, agents); controls.structures = sandbox.structures;
    controls.targets = sandbox.threats.filter(threat => threat.matrix === player?.isInMatrix && threat.health > 0).map(threat => threat.position);
  }
}

const socket = new SocketClient({
  onConnection: connected => {
    ui.setConnection(connected);
    if (!connected && controls.id) {
      sandboxUI.close(); controls.release(); engine.agentRenderer.setPlayer(null);
      playerUI.observe(false); engine.cameraController.overview(inMatrix);
      playerUI.message('连接中断，正在重新连接；恢复后会接续当前角色进度。');
    }
  },
  onPlayerState: data => {
    if (data.error) { if (!controls.id) playerUI.openRoster(); playerUI.message(data.error); return; }
    if (!data.agentId) {
      sandboxUI.close(); controls.release(); engine.agentRenderer.setPlayer(null);
      playerUI.observe(false); engine.cameraController.overview(inMatrix);
      if (data.message) { playerUI.openRoster(); playerUI.message(data.message); }
      update(true); return;
    }
    const agent = agents[data.agentId];
    if (!agent) return;
    sandboxUI.close();
    selected = agent.id; following = false; director = false; engine.cameraController.director = false;
    inMatrix = agent.isInMatrix;
    engine.setWorld(inMatrix, false); ui.setWorld(inMatrix);
    controls.possess(agent); engine.agentRenderer.setPlayer(agent.id);
    playerUI.enter(agent.id);
    update(true);
  },
  onWorldStateFull: (data, tick) => {
    for (const id of Object.keys(agents)) delete agents[id];
    Object.assign(agents, data.agents);
    timeOfDay = data.timeOfDay;
    simulation = data.simulation;
    sandbox = data.sandbox;
    if (simulation) simulation.tick = tick;
    ui.addEvents(data.events ?? [], true);
    update();
  },
  onWorldStateDelta: (data, tick) => {
    for (const [id, state] of Object.entries(data.agents)) {
      if (agents[id]) agents[id] = { ...agents[id], ...state };
      else if (state.id && state.name && state.position) agents[id] = state as AgentState;
    }
    if (data.timeOfDay !== undefined) timeOfDay = data.timeOfDay;
    if (data.simulation) simulation = data.simulation;
    if (data.sandbox) sandbox = data.sandbox;
    if (simulation) simulation.tick = tick;
    if (data.events.length) ui.addEvents(data.events);
    for (const event of data.events) {
      playerUI.event(event);
      if (event.importance >= 7) engine.showEvent(event);
      if (director && event.importance >= 7 && performance.now() - lastCut > 14000) {
        focusEvent(event); lastCut = performance.now(); engine.cameraController.director = true;
      }
    }
    update();
  },
  onAgentUpdate: data => { if (agents[data.id]) { agents[data.id] = { ...agents[data.id], ...data.state }; update(); } },
  onConversationStart: () => {},
  onConversationMessage: data => {
    if (playerUI.dialogue(data.speaker, data.content)) engine.audio.dialogue();
    engine.agentRenderer.showSpeechBubble(data.speaker, agents[data.speaker]?.name ?? data.speaker, data.content);
    if (selected === data.speaker || !selected) ui.showDialogue(data.speaker, data.content);
  },
  onConversationEnd: () => {},
  onConversationSummary: () => {},
  onStoryEvent: () => {},
  onPhaseChange: data => ui.toast(`故事进入新的阶段：${data.name}`),
  onEffect: data => {
    if (data.impact) { engine.showImpact(data.impact); return; }
    if (data.skill) { engine.showSkill(data.skill); return; }
    for (const id of data.agents) {
      const position = agents[id]?.position;
      if (position) engine.particleSystem.spawnEffect(data.effectType, new THREE.Vector3(position.x, position.y, position.z));
    }
  },
  onChatBubble: data => engine.agentRenderer.showSpeechBubble(data.agentId, agents[data.agentId]?.name ?? data.agentId, data.text),
  onNotification: data => { ui.toast(data.message); playerUI.message(data.message); },
  onEvolutionUpdate: () => {},
  onEvolutionNarration: () => {},
});

const controls = new PlayerControls(engine.renderer.domElement, engine.camera,
  input => socket.send('player_input', input), kind => {
    if (kind === 'interact') sandboxUI.interact();
    else if (kind === 'talk' && controls.id === 'neo' && sandbox?.neoLife) sandboxUI.open('journal');
    else if (['medkit', 'emp'].includes(kind)) socket.send('sandbox_action', { kind: 'use', target: kind });
    else if (['beacon', 'barricade'].includes(kind)) socket.send('sandbox_action', { kind: 'build', target: kind });
    else socket.send('player_action', { kind });
  });
engine.playerControls = controls;
const characterViewer = new CharacterViewer(() => agents, id => socket.send('play_as', { agentId: id, takeover: true }));
const playerUI = new PlayerExperience({
  skill: kind => socket.send('player_action', { kind }),
  sound: () => audioPanel.open(),
  play: id => socket.send('play_as', { agentId: id, takeover: true }),
  observe: () => {
    socket.send('leave_character'); controls.release(); engine.agentRenderer.setPlayer(null);
    engine.cameraController.overview(inMatrix); following = false; selected = null;
  },
  menu: open => { if (open) sandboxUI.close(); controls.setEnabled(!open); engine.audio.setReading('roster', open); },
  resume: () => controls.lockPointer(),
  pause: () => { if (simulation) simulation.running ? socket.pause() : socket.resume(); },
  inspect: id => {
    controls.setEnabled(false); engine.suspended = true; engine.audio.setReading('inspect', true);
    characterViewer.open(id, () => { engine.suspended = false; controls.setEnabled(true); engine.audio.setReading('inspect', false); });
  },
});
controls.onViewChange = firstPerson => playerUI.viewChanged(firstPerson);
controls.onMenu = () => playerUI.openRoster();
controls.onHUD = () => playerUI.toggleHUD();
const sandboxUI = new SandboxUI(command => socket.send('sandbox_action', command), open => {
  controls.setEnabled(!open); engine.audio.setReading('sandbox', open);
}, (kind, combo) => {
  if (!controls.triggerCombat(kind, true, combo)) socket.send('player_action', { kind });
}, () => engine.televisionPreviewImage);
const audioPanel = new AudioPanel(engine.audio, open => {
  if (open) sandboxUI.close();
  controls.setEnabled(!open && !playerUI.isChoosingCharacter);
});
controls.onPanel = panel => { if (!engine.suspended && !playerUI.isChoosingCharacter) sandboxUI.toggle(panel); };
controls.onClosePanel = () => audioPanel.close() || sandboxUI.close();

engine.cameraController.onManualControl = () => { following = false; director = false; ui.setCamera(''); };
const raycaster = new THREE.Raycaster();
let down = { x: 0, y: 0 };
engine.renderer.domElement.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY }; });
engine.renderer.domElement.addEventListener('pointerup', event => {
  if (controls.id) return;
  if (event.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
  const rect = engine.renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), engine.camera);
  let closest: string | null = null;
  let closestDistance = Infinity;
  for (const [id, agent] of Object.entries(agents)) {
    if (agent.isInMatrix !== inMatrix || agent.status !== 'alive') continue;
    const group = engine.agentRenderer.getAgent(id);
    if (!group) continue;
    const center = group.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    const hit = raycaster.ray.intersectSphere(new THREE.Sphere(center, Math.max(3, engine.camera.position.distanceTo(center) * 0.008)), new THREE.Vector3());
    if (hit && engine.camera.position.distanceTo(hit) < closestDistance) { closest = id; closestDistance = engine.camera.position.distanceTo(hit); }
  }
  if (closest) selectAgent(closest);
});

window.addEventListener('keydown', event => {
  if (controls.id) return;
  if ((event.target as HTMLElement).matches('input, textarea, button')) return;
  if (event.code === 'Space') { event.preventDefault(); if (simulation) simulation.running ? socket.pause() : socket.resume(); }
});

const uiTimer = window.setInterval(() => {
  ui.setFps(engine.fps);
  if (following && selected && agents[selected]) engine.cameraController.setFollowTarget(agents[selected].position);
  if (selected && performance.now() - lastContext > 5000) void loadContext(selected);
}, 150);
const connectionTimer = window.setTimeout(() => ui.showConnectionHelp(), 10000);
socket.connect(); engine.start();
if (import.meta.env.DEV && new URLSearchParams(location.search).has('record')) {
  void import('./player/GameplayRecorder.js').then(({ GameplayRecorder }) => new GameplayRecorder(engine));
}
if (import.meta.env.DEV && new URLSearchParams(location.search).has('profile')) {
  void import('./player/PerformancePanel.js').then(({ PerformancePanel }) => new PerformancePanel(engine));
}
window.addEventListener('beforeunload', () => {
  window.clearInterval(uiTimer); window.clearTimeout(connectionTimer);
  audioPanel.dispose(); sandboxUI.dispose(); characterViewer.dispose(); controls.dispose(); socket.dispose(); engine.dispose();
});
