import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the power station HUD follows installation, evacuation and midnight instead of showing a generic G prompt', async t => {
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
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const player = { id: 'niobe', status: 'alive', isInMatrix: true, rotation: Math.PI,
    position: { ...filmPosition('film_power_station', 0, 41), y: 4.2 } } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm2_blackout', actor: 'niobe', step: 0, completed: [], reflections: {},
    primaryDemolition: { phase: 'done', installed: ['west', 'east', 'clock'], elapsed: 0, remaining: 25, attempts: 1,
      blast: { phase: 'ready', elapsed: 0 } } } } } as SandboxState;
  const journey = sandbox.neoLife!.journey!;
  ui.updateFilm(player, sandbox); assert.match(element('game-objective-copy').textContent, /按 G/);
  for (const phase of ['countdown', 'blast'] as const) {
    journey.primaryDemolition!.blast!.phase = phase; journey.primaryDemolition!.blast!.elapsed = 2;
    ui.updateFilm(player, sandbox);
    assert.doesNotMatch(element('game-objective-copy').textContent, /按 G/, 'a committed midnight clock is not a second manual action');
  }
  journey.primaryDemolition!.blast!.phase = 'done'; journey.step = 1;
  ui.updateFilm(player, sandbox); assert.match(element('game-objective-copy').textContent, /Trinity/);

  journey.scene = 'm2_power';
  journey.primaryDemolition = { phase: 'mounting', selected: 0, elapsed: 1.1, installed: [], remaining: 35, attempts: 0 };
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /按住 G.*西侧变压器.*50%/);
  journey.primaryDemolition.phase = 'sync';
  ui.updateFilm(player, sandbox); assert.match(element('game-objective-copy').textContent, /绿色区.*按 G 校准/);
  journey.primaryDemolition.phase = 'retreat';
  ui.updateFilm(player, sandbox); assert.match(element('game-objective-copy').textContent, /35 秒内带 Ghost/);
  journey.primaryDemolition.phase = 'failed';
  ui.updateFilm(player, sandbox); assert.match(element('game-objective-copy').textContent, /按 J 重试当前撤离检查点/);
});
