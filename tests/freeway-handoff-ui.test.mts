import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, newFreewayHandoff, newFreewayRide, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the handoff HUD asks for completion after the passenger settles, and keeps G hidden during departure', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', style: {}, classList: { add: (name: string) => classes.add(name),
        remove: (name: string) => classes.delete(name), toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        contains: (name: string) => classes.has(name) } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const player = { id: 'trinity', status: 'alive', isInMatrix: true, position: filmPosition('film_freeway_101', 18.1, -660) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm2_freeway', actor: 'trinity', step: 2, completed: [], reflections: {},
    freewayHandoff: { ...newFreewayHandoff(newFreewayRide()), phase: 'departing', elapsed: 1 } } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.equal(element('#sandbox-interact').classList.contains('hidden'), true);
  sandbox.neoLife!.journey!.freewayHandoff!.phase = 'done'; ui.updateFilm(player, sandbox);
  assert.equal(element('#sandbox-interact').classList.contains('hidden'), false);
  assert.match(element('#sandbox-nearby').textContent, /确认接应完成/);
  assert.doesNotMatch(element('#sandbox-nearby').textContent, /接管/);
});
