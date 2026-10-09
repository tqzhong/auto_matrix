import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { newZionDeployment, FILM_SCENE_BY_ID, filmEntry, type SandboxCommand } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('G requests Hamann’s exchange before permitting the journal judgment, and opens the allocation sheet', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42), player = world.agents.get('lock')!;
  sandbox.enter(player); const neo = world.agents.get('neo')!; sandbox.life.begin(neo, 0);
  const scene = FILM_SCENE_BY_ID.m3_zion_prepare;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, step: 3, actor: 'lock', enteredAt: 0, completed: [],
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', zionDeployment: newZionDeployment(3, 47) };
  const sent: SandboxCommand[] = [], opened: string[] = [];
  const ui = Object.assign(Object.create(SandboxUI.prototype), { player, state: sandbox.state,
    send: (command: SandboxCommand) => sent.push(command), open: (panel: string) => opened.push(panel) });
  ui.interact(); assert.deepEqual(sent, [{ kind: 'life', target: 'film:act' }]); assert.deepEqual(opened, []);
  sandbox.state.neoLife!.journey!.zionDeployment!.phase = 'reflection'; ui.interact(); assert.deepEqual(opened, ['journal']);
  sandbox.state.neoLife!.journey!.step = 2; sandbox.state.neoLife!.journey!.zionDeployment!.phase = 'allocating';
  ui.interact(); assert.deepEqual(opened, ['journal', 'journal']);
});
