import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { APARTMENT_NETWORK, filmPosition, newReloaded } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

function fixture(panel = 'journal') {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const sandbox = new SandboxSystem(world, { record() {} } as unknown as WorldDynamics, 42);
  const player = world.agents.get('neo')!; sandbox.enter(player); sandbox.life.begin(player, 0);
  sandbox.state.structures.push({ id: 'traffic:0', owner: 'matrix', kind: 'barricade', health: 99999, matrix: true,
    position: { x: 1204, y: 1, z: 650 }, film: { scene: 'city', width: 4, depth: 8, height: 2.8 } });
  let html = '', targets = new Map<string, { connected: boolean; disabled: boolean }>();
  const body = {
    scrollTop: 0, querySelectorAll: () => [],
    get innerHTML() { return html; },
    set innerHTML(value: string) {
      for (const target of targets.values()) target.connected = false;
      html = value; targets = new Map();
      for (const [, attributes] of value.matchAll(/<button ([^>]+)>/g)) {
        const target = attributes.match(/data-target="([^"]+)"/)?.[1];
        if (target) targets.set(target, { connected: true, disabled: /\bdisabled\b/.test(attributes) });
      }
    },
    action: (id: string) => targets.get(id),
  };
  const elements = new Map<string, unknown>([['#sandbox-panel-body', body]]);
  const root = { querySelectorAll: () => [], querySelector(id: string) {
    if (!elements.has(id)) elements.set(id, { textContent: '', classList: { toggle() {} } });
    return elements.get(id);
  } };
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root, player, state: sandbox.state,
    panel, selectedFilm: 1, signature: '', time: 7500, tick: 0 });
  ui.renderPanel();
  return { ui, body, sandbox, player };
}

test('traffic movement preserves the open daily journal action targets between pointer down and click', () => {
  const { ui, body, sandbox } = fixture();
  const breakfast = body.action('breakfast'); assert.ok(breakfast && !breakfast.disabled);
  body.scrollTop = 180;
  for (let frame = 1; frame <= 20; frame++) {
    sandbox.state.structures[0].position.z += .4; ui.tick = frame; ui.renderPanel();
  }
  assert.equal(breakfast.connected, true, 'background traffic detached the breakfast button before click');
  assert.equal(body.action('breakfast'), breakfast);
  assert.equal(body.scrollTop, 180);
});

test('the daily journal still updates action availability for money, active activities and completion', () => {
  const { ui, body, sandbox, player } = fixture(), life = sandbox.state.neoLife!;
  life.money = 3; ui.renderPanel(); assert.equal(body.action('breakfast')!.disabled, true);
  assert.match(body.innerHTML, /现金不足/);
  life.money = 140; life.activity = { id: 'breakfast', startedAt: 0, endsAt: 6, position: { ...player.position } };
  ui.renderPanel(); assert.equal(body.action('breakfast')!.disabled, true);
  assert.match(body.innerHTML, /活动进行中/);
  delete life.activity; life.money = 136; life.done.breakfast = life.day;
  ui.renderPanel(); assert.equal(body.action('breakfast')!.disabled, false);
  assert.doesNotMatch(body.innerHTML, /活动进行中/); assert.match(body.innerHTML, /\$136/);
});

test('inventory ignores moving scene colliders but keeps nearby player structures and their durability current', () => {
  const { ui, body, sandbox, player } = fixture('inventory');
  const before = body.innerHTML, craft = body.action('medkit');
  sandbox.state.structures[0].position.z += 5; ui.renderPanel();
  assert.ok(craft?.connected, 'traffic detached the crafting controls');
  assert.equal(body.innerHTML, before); assert.doesNotMatch(body.innerHTML, /traffic:0/);
  sandbox.state.structures.push({ id: 'build:1', owner: 'neo', kind: 'barricade', health: 100,
    matrix: true, position: { ...player.position } }); ui.renderPanel();
  assert.match(body.innerHTML, /耐久 100/); assert.ok(body.action('build:1'));
  sandbox.state.structures[1].health = 80; ui.renderPanel();
  assert.match(body.innerHTML, /耐久 80/); assert.ok(body.action('build:1'));
});

test('a saved computer performance clock does not repeatedly detach the open journal, but a new phase updates its action', () => {
  const { ui, body, sandbox } = fixture();
  sandbox.state.neoLife!.anomaly = { id: 'screen', location: 'neo_apartment', position: { ...ui.player.position } };
  sandbox.state.neoLife!.computerCheck = { phase: 'offline', elapsed: 0 }; ui.renderPanel();
  const ignore = body.action('anomaly:ignore'); assert.ok(ignore);
  for (let frame = 1; frame <= 20; frame++) { sandbox.state.neoLife!.computerCheck!.elapsed = frame / 10; ui.renderPanel(); }
  assert.equal(body.action('anomaly:ignore'), ignore); assert.equal(ignore.connected, true);
  sandbox.state.neoLife!.computerCheck = { phase: 'evidence', elapsed: 0 }; ui.renderPanel();
  assert.equal(ignore.connected, false); assert.match(body.innerHTML, /data-target="computer:capture"/);
});

test('the G key offers the same anomaly as the journal after an earlier offline frame was saved', () => {
  const { ui, sandbox, player } = fixture(), sent: object[] = [], opened: string[] = [];
  player.position = filmPosition('film_anderson_flat', APARTMENT_NETWORK.approach.x, APARTMENT_NETWORK.approach.z);
  sandbox.state.neoLife!.computerCheck = { phase: 'saved', elapsed: 0 };
  sandbox.state.neoLife!.anomaly = { id: 'clock', location: 'neo_apartment', position: { ...player.position } };
  ui.send = (command: object) => sent.push(command); ui.open = (panel: string) => opened.push(panel);
  ui.interact(); assert.deepEqual(sent, []); assert.deepEqual(opened, ['journal']);
  sandbox.state.neoLife!.anomaly = { id: 'screen', location: 'neo_apartment', position: { ...player.position } };
  sandbox.state.neoLife!.computerCheck = { phase: 'reading', elapsed: 0 };
  ui.interact(); assert.deepEqual(sent, [{ kind: 'life', target: 'computer:disconnect' }]);
});

test('the Oracle kitchen G key starts the examination before opening the journal for the actual question', () => {
  const { ui, body, sandbox, player } = fixture(), sent: object[] = [], opened: string[] = [];
  player.position = filmPosition('film_oracle_home', -5, -22);
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm1_oracle', actor: 'neo', step: 1, completed: [],
    enteredAt: 0, reflections: {}, lastText: '', checkpoint: player.position, oracle: { vase: 4.5, consultation: { phase: 'waiting', elapsed: 0 } } };
  ui.send = (command: object) => sent.push(command); ui.open = (panel: string) => opened.push(panel);
  ui.renderPanel(); assert.ok(body.action('film:act') && !body.action('film:act')!.disabled);
  ui.interact(); assert.deepEqual(sent, [{ kind: 'life', target: 'film:act' }]); assert.deepEqual(opened, []);
  sandbox.state.neoLife!.journey.oracle!.consultation!.phase = 'question';
  ui.renderPanel(); assert.ok(body.action('film:reflect:care') && !body.action('film:reflect:care')!.disabled);
  ui.interact(); assert.equal(sent.length, 1); assert.deepEqual(opened, ['journal']);
});

test('a failed bridge keeps its retry button attached while background story clocks advance', () => {
  const { ui, body, sandbox } = fixture();
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm1_bridge', actor: 'neo', step: 0, completed: [],
    enteredAt: 0, reflections: {}, lastText: '接头被追踪特工阻断。', checkpoint: filmPosition('film_adams_bridge', 0, 24.32),
    bridgeTail: { phase: 'failed', alert: 70, lastTick: 0, attempts: 1, spawned: true } };
  ui.renderPanel(); const retry = body.action('film:retry'); assert.ok(retry && !retry.disabled);
  body.scrollTop = 120;
  for (let frame = 1; frame <= 20; frame++) {
    sandbox.state.neoLife!.journey!.bridgeTail!.lastTick = frame; ui.tick = frame; ui.renderPanel();
  }
  assert.equal(retry.connected, true, 'an unchanged failure menu detached the retry button before click');
  assert.equal(body.action('film:retry'), retry); assert.equal(body.scrollTop, 120);
  sandbox.state.neoLife!.journey!.bridgeTail!.attempts = 2; ui.renderPanel();
  assert.equal(retry.connected, false, 'a changed attempt count must still update the visible menu');
  assert.match(body.innerHTML, /第 3 次尝试/);
});

test('the captains journal keeps both exit choices attached until evacuation begins', () => {
  const { ui, body, sandbox, player } = fixture();
  player.position = filmPosition('film_captains_meeting', 0, -14);
  player.isInMatrix = true;
  const meeting = newReloaded('meeting'); meeting.phase = 'evacuate_ready';
  sandbox.state.neoLife!.journey = { version: 1, scene: 'm2_meeting', actor: 'neo', step: 3, completed: ['m2_dream'],
    enteredAt: 0, reflections: {}, lastText: '', checkpoint: player.position, reloaded: meeting };
  ui.renderPanel();
  const east = body.action('film:exit:east'), west = body.action('film:exit:west');
  assert.ok(east && !east.disabled && west && !west.disabled);
  body.scrollTop = 85;
  for (let frame = 0; frame < 20; frame++) {
    meeting.shotAge += .05; meeting.punchAge += .05; meeting.dodgeAge += .05;
    ui.renderPanel();
  }
  assert.equal(east.connected, true, 'background encounter clocks detached the east exit during a click');
  assert.equal(body.action('film:exit:east'), east);
  assert.equal(body.action('film:exit:west'), west);
  assert.equal(body.scrollTop, 85);
  meeting.exit = 'east'; meeting.phase = 'breach'; ui.renderPanel();
  assert.equal(east.connected, false);
  assert.equal(body.action('film:exit:west'), undefined);
  assert.match(body.innerHTML, /铁门连续凹陷/);
});
