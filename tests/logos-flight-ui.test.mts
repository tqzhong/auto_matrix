import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { newLogosFlight, filmStepPosition, FILM_SCENE_BY_ID, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the shared Logos stage keeps its chapter number, retained damage and actual remaining climb in the HUD', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: (selector: string) => element(selector.slice(1)) }, tick: 0 });
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_sun', actor: 'trinity', step: 0, completed: ['m3_defense'], reflections: {},
    logosEntry: { ...newLogosFlight('sun'), altitude: 42, hull: 72, neo: 58 } } } } as SandboxState;
  const journey = sandbox.neoLife!.journey!, scene = FILM_SCENE_BY_ID.m3_sun;
  const player = { id: 'trinity', status: 'alive', isInMatrix: false, rotation: Math.PI,
    position: filmStepPosition(scene, scene.steps[0], journey) } as AgentState;
  ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-clock').textContent, '矩阵革命 · 第 116 段');
  assert.match(element('sandbox-waypoint').textContent, /船体 72%.*Neo 58%/);
  assert.match(element('sandbox-nearby').textContent, /继续穿云/);
  journey.logos = { ...journey.logosEntry! }; ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-waypoint').textContent, '云顶 ↑ 20 m');
  journey.logos.stage = 'stall'; journey.logos.ignition = { phase: 'ready', pump: 1.3, stroke: 1, elapsed: 1.3, held: true, attempts: 1 };
  ui.updateFilm(player, sandbox);
  assert.match(element('film-ride-controls').textContent, /松开 G 点火/);
  assert.match(element('film-ride-health').textContent, /蓄压 100%/);
  journey.logos.ignition.phase = 'running'; ui.updateFilm(player, sandbox);
  assert.match(element('film-ride-health').textContent, /动力恢复/);
  assert.doesNotMatch(element('film-ride-controls').textContent, /按住 G|动力失效/);
  journey.logos.crash = { elapsed: 2.4, approach: 2.2, x: 0, altitude: 32, z: -145, speed: 17, vertical: -10,
    lateral: 0, pitch: -.24, yaw: 0, roll: 0 };
  ui.updateFilm(player, sandbox);
  assert.match(element('film-ride-title').textContent, /机器城塔体/);
  assert.match(element('film-ride-health').textContent, /动力中断/);
  assert.match(element('film-ride-controls').textContent, /风挡破裂/);
  assert.doesNotMatch(element('film-ride-controls').textContent, /点火|A \/ D/);
});
