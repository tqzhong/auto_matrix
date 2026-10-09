import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the seated connection HUD clears the walk marker until the actual jack-in finishes', async t => {
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
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: (selector: string) => element(selector.replace(/^#/, '')) }, tick: 0 });
  const player = { id: 'trinity', status: 'alive', isInMatrix: false, rotation: Math.PI / 2,
    position: filmPosition('film_neb_deck', -6.5, 6) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm2_relay', actor: 'trinity', step: 1, completed: [], reflections: {},
    trinityRelay: { phase: 'connecting', elapsed: 5 } } } } as SandboxState;
  const journey = sandbox.neoLife!.journey!;
  element('sandbox-waypoint').textContent = '走到连接椅，让 Link 接入 3 m';
  ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-waypoint').textContent, '', 'a seated player must not be told to keep walking');
  assert.match(element('game-objective-copy').textContent, /坐下等待/);
  journey.trinityRelay!.phase = 'connected'; journey.step = 2;
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /G 进入矩阵/);
});
