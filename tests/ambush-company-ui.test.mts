import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SETS, filmPosition, newAmbushApproach, type AgentState, type SandboxState } from '@auto_matrix/shared';

function fixture() {
  const player = { id: 'neo', status: 'alive', isInMatrix: true, rotation: Math.PI, position: filmPosition('film_ambush_house', -5.5, 32) } as AgentState;
  player.position.y -= 7.4;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], reflections: {}, lastText: '跟随同伴上楼。',
    ambushApproach: newAmbushApproach() } } } as SandboxState;
  return { player, sandbox, journey: sandbox.neoLife!.journey! };
}

test('the ambush journal describes physical ascent and never offers an early cat interaction', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const h = fixture();
  assert.match(renderFilmJourney(h.player, h.sandbox), /跟随.*上楼/);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
  h.player.id = 'tank'; assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:resume"/);
  h.player.id = 'neo'; h.journey.ambushApproach!.ready = true; h.journey.ambush = { elapsed: 4.8 };
  assert.match(renderFilmJourney(h.player, h.sandbox), /观察.*黑猫/);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
});

test('ambush navigation changes with storey and turn, then waits for the company without showing G', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classes, classList: {
        add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value),
        toggle: (value: string, force: boolean) => force ? classes.add(value) : classes.delete(value) } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const h = fixture(), center = FILM_SETS.film_ambush_house.center;
  ui.updateFilm(h.player, h.sandbox);
  assert.match(element('#sandbox-waypoint').innerHTML, /木楼梯/);
  assert.ok(element('#film-sequence').classes.has('ambush-company'), 'the new ascent caption needs its own non-overlapping layout');
  assert.ok(element('#sandbox-interact').classes.has('hidden'));
  assert.doesNotMatch(element('game-objective-copy').textContent, /靠近后按 G/);
  h.player.position = { x: center.x, y: center.y - 3.7, z: center.z + 14.5 }; ui.updateFilm(h.player, h.sandbox);
  assert.match(element('#sandbox-waypoint').innerHTML, /平台/);
  h.player.position = filmPosition('film_ambush_house', 11, 23); ui.updateFilm(h.player, h.sandbox);
  assert.match(element('#sandbox-waypoint').innerHTML, /护栏|走廊/);
  h.player.position = filmPosition('film_ambush_house', 0, -8); ui.updateFilm(h.player, h.sandbox);
  assert.match(element('game-objective-copy').textContent, /等.*同伴/);
  assert.ok(element('#sandbox-interact').classes.has('hidden'));
  h.journey.ambushApproach!.ready = true; ui.updateFilm(h.player, h.sandbox);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), false);
  h.journey.ambush = { elapsed: 4.8 }; ui.updateFilm(h.player, h.sandbox);
  assert.ok(element('#sandbox-interact').classes.has('hidden'));
  assert.match(element('#film-sequence-hint').textContent, /观察.*黑猫/);
  h.journey.step = 1; element('#film-sequence').classes.delete('ambush-company'); ui.updateFilm(h.player, h.sandbox);
  assert.ok(element('#film-sequence').classes.has('ambush-company'), 'the sealed-building action must keep a layout clear of the conversation button');
});
