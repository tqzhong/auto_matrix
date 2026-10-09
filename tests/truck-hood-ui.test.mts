import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('a reception crew view keeps the highway objective instead of the unrelated white-rabbit mission', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: { add: (name: string) => classes.add(name),
        remove: (name: string) => classes.delete(name), toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        contains: (name: string) => classes.has(name) } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: (id: string) => element(`#${id}`) } as unknown as Document;
  const root = { classList: element('#root').classList, querySelector: element, querySelectorAll: () => [] };
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root, drawMinimap() {}, renderPanel() {} });
  const sandbox = { nodes: [], incidents: [], threats: [], weather: 'clear', missions: { rabbit: { status: 'available', stage: 'choice', progress: 0 } },
    profiles: {}, neoLife: { journey: { scene: 'm2_trucks', actor: 'morpheus', step: 0, trucks: { hood: { phase: 'impact' } } } } } as unknown as SandboxState;
  for (const role of ['niobe', 'ghost']) {
    const player = { id: role, status: 'alive', isInMatrix: true, rotation: 0, position: filmPosition('film_freeway_101', 5, -440),
      currentAction: { parameters: { truckHood: { role, phase: 'impact' } } } } as unknown as AgentState;
    sandbox.profiles[role] = { inventory: {}, trace: 0, trackedMission: 'rabbit' } as SandboxState['profiles'][string];
    ui.player = player; ui.update(player, sandbox, 12000, 328);
    assert.match(element('#game-objective').textContent, /高速公路.*接应/);
    assert.match(element('#game-objective-copy').textContent, /Morpheus/);
    assert.doesNotMatch(element('#game-objective').textContent, /白兔/);
    assert.equal(element('#sandbox-waypoint').textContent, '');
    assert.equal(element('#sandbox-interact').classList.contains('hidden'), true);
    assert.equal(element('#game-interaction').classList.contains('hidden'), true);
  }
});
