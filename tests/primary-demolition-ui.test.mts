import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('midnight HUD offers G at the clock, observes during detonation, then offers the Trinity handoff', async t => {
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
});
