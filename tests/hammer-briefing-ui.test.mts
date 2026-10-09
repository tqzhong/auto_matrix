import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { newHammerBriefing, FILM_SCENE_BY_ID, filmEntry, type SandboxCommand } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('G starts the faith exchange before the reflection step opens the journal', () => {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42), player = world.agents.get('neo')!;
  sandbox.enter(player); sandbox.life.begin(player, 0);
  const scene = FILM_SCENE_BY_ID.m3_logos_plan;
  sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, step: 3, actor: 'neo', enteredAt: 0, completed: [],
    checkpoint: filmEntry(scene), reflections: {}, lastText: '', hammerBriefing: newHammerBriefing(3, 43) };
  const sent: SandboxCommand[] = [], opened: string[] = [];
  const ui = Object.assign(Object.create(SandboxUI.prototype), { player, state: sandbox.state,
    send: (command: SandboxCommand) => sent.push(command), open: (panel: string) => opened.push(panel) });
  ui.interact();
  assert.deepEqual(sent, [{ kind: 'life', target: 'film:act' }]); assert.deepEqual(opened, []);
  sandbox.state.neoLife!.journey!.hammerBriefing!.phase = 'reflection';
  ui.interact(); assert.deepEqual(opened, ['journal']);
});
