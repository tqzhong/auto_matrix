import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import type { SimulationState, WorldStateFull } from '@auto_matrix/shared';
import type { SocketCallbacks } from '../packages/client/src/network/SocketClient.js';

async function game() {
  const bundled = await build({ entryPoints: ['packages/client/src/main.ts'], bundle: true, platform: 'node', format: 'cjs', write: false,
    define: { 'import.meta.env.DEV': 'false' }, loader: { '.css': 'empty' }, logLevel: 'silent',
    plugins: [{ name: 'headless-game-surfaces', setup(build) {
      build.onResolve({ filter: /\/(Engine|SocketClient|PlayerControls|PlayerExperience|CharacterViewer|SandboxUI|AudioPanel)\.js$/ }, () => ({ path: 'surfaces', namespace: 'headless' }));
      build.onLoad({ filter: /.*/, namespace: 'headless' }, () => ({ contents: `
        export class Engine {
          renderer = { domElement: { addEventListener() {} } }; camera = {};
          cameraController = { overview() {} }; agentRenderer = { setPlayer() {} };
          audio = { update() {} }; fps = 30;
          updateAgents() {} setSimulation() {} setSandbox() {} start() {}
        }
        export class SocketClient {
          isConnected = true;
          constructor(callbacks) { globalThis.harness.callbacks = callbacks; }
          connect() { globalThis.harness.callbacks.onConnection(true); }
        }
        export class PlayerControls { id = null; }
        export class PlayerExperience {
          update(agents, simulation) { globalThis.harness.playerStates.push(structuredClone(simulation)); }
        }
        export class CharacterViewer {}
        export class SandboxUI { update() {} }
        export class AudioPanel {}
      ` }));
    } }],
  });
  const elements = new Map<string, { textContent: string; innerHTML: string; style: object; attributes: Record<string, string>; classList: object; addEventListener(): void; querySelector(selector: string): unknown }>();
  const canvasContext = new Proxy({}, { get: () => () => {}, set: () => true });
  const element = (id: string): any => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', innerHTML: '', style: {}, attributes: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {},
      querySelector: element, querySelectorAll: () => [], getContext: () => canvasContext,
      setAttribute(name: string, value: string) { this.attributes[name] = value; },
    } as any);
    return elements.get(id)!;
  };
  const harness = { callbacks: undefined as unknown as SocketCallbacks, playerStates: [] as SimulationState[] };
  let clock = 1000;
  runInNewContext(bundled.outputFiles[0].text, { harness, structuredClone, console,
    performance: { now: () => clock }, document: { getElementById: element },
    window: { addEventListener() {}, setInterval: () => 1, setTimeout: () => 2 },
  });
  const simulation: SimulationState = { running: true, speed: 1, tick: 4476, day: 3, mode: 'rules', llmStatus: 'offline',
    population: 85, awakened: 61, tension: 0, anomaly: 65, conversations: 3, chapter: '镜面与定位', chapterDescription: '等待玩家。' };
  const full = (sim = simulation) => ({ agents: {}, locations: {}, chunks: {}, phase: 'phase1_normal_life', timeOfDay: 500, simulation: sim }) as WorldStateFull;
  const delta = (sim: SimulationState) => harness.callbacks.onWorldStateDelta({ agents: {}, dirtyChunks: {}, events: [], simulation: sim }, sim.tick);
  return { harness, element, simulation, full, delta, time: (now: number) => { clock = now; } };
}

test('a pause inside the HUD throttle interval immediately updates the actual game transport and player HUD', async () => {
  const h = await game(); h.harness.callbacks.onWorldStateFull(h.full(), h.simulation.tick);
  h.time(1050); h.delta({ ...h.simulation, running: false });
  assert.equal(h.element('#run-state').textContent, '模拟已暂停');
  assert.equal(h.element('#pause').attributes['aria-label'], '继续模拟');
  assert.equal(h.harness.playerStates.at(-1)!.running, false);
  h.time(1051); h.delta({ ...h.simulation, running: true });
  assert.equal(h.element('#run-state').textContent, '模拟运行中');
  assert.equal(h.element('#pause').attributes['aria-label'], '暂停模拟');
});

test('a replacement snapshot renders its paused state even immediately after the previous snapshot', async () => {
  const h = await game(); h.harness.callbacks.onWorldStateFull(h.full(), h.simulation.tick);
  h.time(1010); h.harness.callbacks.onWorldStateFull(h.full({ ...h.simulation, running: false, day: 9 }), h.simulation.tick);
  assert.equal(h.element('#run-state').textContent, '模拟已暂停');
  assert.equal(h.element('#sim-day').textContent, 'DAY 09');
});

test('the observer date uses the persisted world day while old snapshots retain their clock fallback', async () => {
  const h = await game(); h.harness.callbacks.onWorldStateFull(h.full(), h.simulation.tick);
  assert.equal(h.element('#sim-day').textContent, 'DAY 03', 'Neo time advances independently of the former 12-units-per-tick rule');
  const legacy = { ...h.simulation }; delete legacy.day;
  h.time(1200); h.harness.callbacks.onWorldStateFull(h.full(legacy), legacy.tick);
  assert.equal(h.element('#sim-day').textContent, 'DAY 04');
});

test('speed and day changes render immediately while ordinary simulation ticks still share the HUD throttle', async () => {
  const h = await game(); h.harness.callbacks.onWorldStateFull(h.full(), h.simulation.tick);
  h.time(1010); h.delta({ ...h.simulation, speed: 4 });
  assert.equal(h.harness.playerStates.at(-1)!.speed, 4);
  h.time(1020); h.delta({ ...h.simulation, speed: 4, day: 4 });
  assert.equal(h.element('#sim-day').textContent, 'DAY 04');
  const rendered = h.harness.playerStates.length;
  h.time(1021); h.delta({ ...h.simulation, speed: 4, day: 4, tick: 4477 });
  assert.equal(h.harness.playerStates.length, rendered, 'routine network ticks must not force repeated DOM work');
  h.time(1150); h.delta({ ...h.simulation, speed: 4, day: 4, tick: 4478 });
  assert.equal(h.element('#latest-tick').textContent, 'T + 004478');
});
