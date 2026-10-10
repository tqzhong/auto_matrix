import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { MAGGIE_DISCOVERY, newMaggieDiscovery, maggieDiscoveryText, FILM_SCENE_BY_ID, filmEntry, filmPosition, type SandboxCommand } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('G requests the separate search and EMP conversations, and opens judgment only after hearing them', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42), player = world.agents.get('roland')!;
  sandbox.enter(player); sandbox.life.begin(world.agents.get('neo')!, 0);
  const scene = FILM_SCENE_BY_ID.m3_maggie_discovery;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, step: 4, actor: 'roland', enteredAt: 0, completed: [],
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', maggieDiscovery: newMaggieDiscovery(4, 47) };
  const sent: SandboxCommand[] = [], opened: string[] = [];
  const ui = Object.assign(Object.create(SandboxUI.prototype), { player, state: sandbox.state,
    send: (command: SandboxCommand) => sent.push(command), open: (panel: string) => opened.push(panel) });
  ui.interact(); sandbox.state.neoLife!.journey!.maggieDiscovery!.phase = 'return'; ui.interact();
  assert.deepEqual(sent, [{ kind: 'life', target: 'film:act' }, { kind: 'life', target: 'film:act' }]); assert.deepEqual(opened, []);
  sandbox.state.neoLife!.journey!.step = 5; sandbox.state.neoLife!.journey!.maggieDiscovery!.phase = 'reflection'; ui.interact();
  assert.deepEqual(opened, ['journal']);
});

test('the live HUD names the return request after search instead of asking for the already completed search again', t => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42), player = world.agents.get('roland')!;
  sandbox.enter(player); sandbox.life.begin(world.agents.get('neo')!, 0); const scene = FILM_SCENE_BY_ID.m3_maggie_discovery;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, step: 4, actor: 'roland', enteredAt: 0, completed: [],
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', maggieDiscovery: { ...newMaggieDiscovery(4, 47), phase: 'return' } };
  player.currentLocation = scene.set; player.isInMatrix = false; player.position = filmPosition(scene.set, MAGGIE_DISCOVERY.report.x, MAGGIE_DISCOVERY.report.z);
  const elements = new Map<string, any>();
  const el = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set<string>(); elements.set(id, { style: {}, textContent: '', innerHTML: '',
        classList: { add: (...items: string[]) => items.forEach(item => classes.add(item)), remove: (...items: string[]) => items.forEach(item => classes.delete(item)),
          contains: (item: string) => classes.has(item), toggle: (item: string, value: boolean) => value ? classes.add(item) : classes.delete(item) } });
    }
    return elements.get(id);
  };
  const before = globalThis.document; globalThis.document = { getElementById: el } as unknown as Document;
  t.after(() => { globalThis.document = before; });
  const ui = Object.assign(Object.create(SandboxUI.prototype), { player, state: sandbox.state, time: 0, tick: 0, el });
  ui.updateFilm(player, sandbox.state);
  assert.equal(el('game-objective-copy').textContent, maggieDiscoveryText(sandbox.state.neoLife!.journey!.maggieDiscovery));
  assert.match(el('sandbox-nearby').textContent, /返航|EMP/);
});
