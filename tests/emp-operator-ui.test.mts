import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { EMP_OPERATOR, filmPosition, empOperatorText, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('EMP operator HUD renders before there is a discharge, and separates operation from blackout', async t => {
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
  const player = { id: 'link', status: 'alive', isInMatrix: false, rotation: Math.PI, position: filmPosition('film_hammer_deck', 0, -16) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_emp', actor: 'link', step: 0, completed: [], reflections: {},
    empOperator: { phase: 'ready', elapsed: 0, approach: { ...EMP_OPERATOR.entry } } } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.match(element('#film-ride-controls').textContent, /按住 G/);
  assert.match(element('game-objective-copy').textContent, /起爆器/);
  const journey = sandbox.neoLife!.journey!;
  journey.empOperator!.phase = 'turning'; journey.empOperator!.elapsed = 1.6;
  ui.updateFilm(player, sandbox);
  assert.equal(element('game-objective-copy').textContent, empOperatorText(journey.empOperator!));
  journey.empOperator!.phase = 'fired'; journey.emp = { firedAt: 4, elapsed: 2 };
  ui.updateFilm(player, sandbox); assert.equal(element('#film-ride-speed').textContent, '全域断电');
  journey.empOperator!.phase = 'rising'; journey.emp!.elapsed = 9;
  ui.updateFilm(player, sandbox);
  assert.match(element('#film-ride-health').textContent, /已释放/);
  assert.doesNotMatch(element('#film-ride-health').textContent, /已充能/);
});
