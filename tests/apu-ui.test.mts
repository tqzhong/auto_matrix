import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { APU_ROUTE, filmPosition, newApuRun, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the APU countdown uses the same route deadline as the saved simulation', async t => {
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
});
