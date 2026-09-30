import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SETS, filmPosition, newAmbushApproach, newAmbushEscape, ambushRetreatRoot, type AgentState, type SandboxState } from '@auto_matrix/shared';

function fixture() {
  const player = { id: 'neo', status: 'alive', isInMatrix: true, rotation: Math.PI, position: filmPosition('film_ambush_house', -5.5, 32) } as AgentState;
  player.position.y -= 7.4;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: 'm1_dejavu', actor: 'neo', step: 0, completed: [], reflections: {}, lastText: '跟随同伴上楼。',
    ambushApproach: newAmbushApproach() } } } as SandboxState;
  delete sandbox.neoLife!.journey!.ambushApproach!.stairCat;
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
  h.journey.step = 0; delete h.journey.ambush; h.journey.ambushApproach!.stairCat = true;
  h.player.position = filmPosition('film_ambush_house', 11, 31.8); ui.updateFilm(h.player, h.sandbox);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), false, 'a fresh journey starts observation on the actual landing');
  assert.match(element('#film-sequence-hint').textContent, /黑猫/);
  assert.match(element('game-objective-copy').textContent, /楼梯/);
  h.journey.ambush = { elapsed: 1.8 }; ui.updateFilm(h.player, h.sandbox);
  assert.ok(element('#film-sequence').classes.has('ambush-observing'), 'observing must clear the cat sightline of the conversation prompt and hotbar');
  h.journey.step = 1; ui.updateFilm(h.player, h.sandbox);
  assert.equal(element('#film-sequence').classes.has('ambush-observing'), false, 'the combat step must restore the ordinary controls');
  h.journey.step = 0; delete h.journey.ambush;
  h.player.position = filmPosition('film_ambush_house', 0, -8); ui.updateFilm(h.player, h.sandbox);
  assert.ok(element('#sandbox-interact').classes.has('hidden'), 'the old doorway is no longer the fresh observation target');
  h.journey.step = 1; h.journey.ambushEscape = newAmbushEscape(); const escape = h.journey.ambushEscape;
  escape.phase = 'descending'; h.player.position = { x: center.x + 5.5, y: center.y - 14.8, z: center.z + 31.8 };
  ui.updateFilm(h.player, h.sandbox); assert.match(element('game-objective-copy').textContent, /11 楼/);
  assert.ok(element('#sandbox-interact').classes.has('hidden')); assert.doesNotMatch(element('game-objective-copy').textContent, /击败|靠近后按 G/);
  escape.phase = 'window'; h.player.position = { x: center.x - 18, y: center.y - 37, z: center.z - 16 };
  ui.updateFilm(h.player, h.sandbox); assert.equal(element('#sandbox-interact').classes.has('hidden'), false);
  escape.phase = 'phone'; escape.progress.morpheus = 400;
  ui.updateFilm(h.player, h.sandbox); assert.ok(element('#sandbox-interact').classes.has('hidden'), 'the window cannot display a remote phone interaction');
  const root = ambushRetreatRoot(escape.progress.morpheus, 'morpheus');
  h.player.position = { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z };
  ui.updateFilm(h.player, h.sandbox); assert.equal(element('#sandbox-interact').classes.has('hidden'), false);
  escape.phase = 'call'; escape.traced = true; ui.updateFilm(h.player, h.sandbox);
  assert.match(element('#sandbox-trace').textContent, /暴露八楼/); assert.ok(element('#sandbox-interact').classes.has('hidden'));
  escape.phase = 'forming'; ui.updateFilm(h.player, h.sandbox);
  assert.match(element('#sandbox-waypoint').innerHTML, /让行/); assert.match(element('#film-sequence-hint').textContent, /等同伴/);
  escape.phase = 'failed'; ui.updateFilm(h.player, h.sandbox); assert.match(element('game-objective-copy').textContent, /重试/);
});
