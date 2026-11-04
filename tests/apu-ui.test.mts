import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { APU_ROUTE, filmPosition, newApuRun, newDockGate, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the APU HUD shows the saved deadline and exposes the handoff after Hammer enters', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set<string>();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: {
        add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name),
        toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        contains: (name: string) => classes.has(name),
      } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const player = { id: 'kid', status: 'alive', isInMatrix: false, rotation: Math.PI, position: filmPosition('film_zion_hangar', 0, 12) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_gate', actor: 'kid', step: 1, completed: [], reflections: {},
    apu: { ...newApuRun(), elapsed: 21.25 } } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.ok(element('#film-ride-health').textContent.endsWith(`剩余 ${Math.ceil(APU_ROUTE.limit - 21.25)} 秒`));
  assert.match(element('#film-ride-controls').textContent, /跨过队长/);
  sandbox.neoLife!.journey!.apu!.clearingCaptain = false; ui.updateFilm(player, sandbox);
  assert.match(element('#film-ride-controls').textContent, /横向避让/);
  sandbox.neoLife!.journey!.apu!.phase = 'arrived'; ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /已抵达/);

  const journey = sandbox.neoLife!.journey!;
  journey.step = 2; journey.dockGate = { ...newDockGate(0, APU_ROUTE.finish), phase: 'entering' };
  ui.updateFilm(player, sandbox);
  assert.equal(element('#sandbox-interact').classList.contains('hidden'), true);
  journey.dockGate.phase = 'done'; journey.step = 3; journey.completed.push(journey.scene);
  ui.updateFilm(player, sandbox);
  assert.equal(element('#sandbox-interact').classList.contains('hidden'), false);
  assert.match(element('#sandbox-nearby').textContent, /交接 Link/);
});
