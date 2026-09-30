import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SETS, WETWALL, WETWALL_ROLES, wetwallEntry, type AgentState, type SandboxState, type WetwallEncounter } from '@auto_matrix/shared';

function fixture() {
  const center = FILM_SETS.film_ambush_house.center;
  const wall: WetwallEncounter = { phase: 'sealed', elapsed: 0, attempts: 0, freed: false,
    starts: Object.fromEntries(WETWALL_ROLES.map(role => [role, { x: -18, y: -37, z: -27 }])) as WetwallEncounter['starts'],
    progress: { neo: 0, apoc: 0, switch: 0, trinity: 0, cypher: 0, morpheus: 0 }, checkpoint: { progress: { neo: 0, apoc: 0, switch: 0, trinity: 0, cypher: 0, morpheus: 0 }, freed: false } };
  const player = { id: 'neo', status: 'alive', isInMatrix: true, rotation: Math.PI, position: { x: center.x - 18, y: center.y - 37, z: center.z - 27 } } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm1_wetwall', actor: 'neo', step: 0, completed: [], reflections: {}, lastText: '墙里的退路。', wetwall: wall } } } as SandboxState;
  return { player, sandbox, wall, center };
}

test('the wetwall journal offers only nearby breaking, explicit rescue, failed retry and completed continuation', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const h = fixture();
  assert.match(renderFilmJourney(h.player, h.sandbox), /破开.*灰泥/);
  assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:act" disabled/);
  h.player.position.z = h.center.z + WETWALL.approach.z;
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act" disabled/);
  h.wall.phase = 'climbing'; h.sandbox.neoLife!.journey!.step = 1;
  assert.match(renderFilmJourney(h.player, h.sandbox), /W.*下行.*S/);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
  h.wall.phase = 'jammed'; assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:act".*Trinity/);
  h.wall.paused = true; assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
  h.wall.paused = false; h.wall.phase = 'rescuing'; assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
  h.wall.phase = 'failed'; assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:retry"/);
  h.wall.phase = 'done'; h.sandbox.neoLife!.journey!.step = 4; assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:next"/);
});

test('wall navigation describes actual pipe controls and suppresses a remote ground waypoint while hanging', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map<string, { textContent: string; innerHTML: string; style: Record<string, string>; classes: Set<string>; classList: { add(value: string): void; remove(value: string): void; toggle(value: string, force: boolean): void } }>();
  const element = (id: string) => {
    if (!elements.has(id)) { const classes = new Set<string>(); elements.set(id, { textContent: '', innerHTML: '', style: {}, classes, classList: {
      add: value => { classes.add(value); }, remove: value => { classes.delete(value); }, toggle: (value, force) => { if (force) classes.add(value); else classes.delete(value); } } }); }
    return elements.get(id)!;
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 }), h = fixture();
  ui.updateFilm(h.player, h.sandbox); assert.ok(element('#sandbox-interact').classes.has('hidden'));
  h.player.position.z = h.center.z + WETWALL.approach.z; ui.updateFilm(h.player, h.sandbox);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), false);
  h.wall.phase = 'climbing'; h.wall.progress.neo = wetwallEntry(h.wall, 'neo') + 2; h.sandbox.neoLife!.journey!.step = 1;
  ui.updateFilm(h.player, h.sandbox);
  assert.ok(element('#sandbox-interact').classes.has('hidden')); assert.equal(element('#sandbox-waypoint').textContent, '');
  assert.match(element('#film-sequence-hint').textContent, /W.*下行.*S/); assert.doesNotMatch(element('game-objective-copy').textContent, /靠近后按 G/);
  h.wall.phase = 'jammed'; ui.updateFilm(h.player, h.sandbox); assert.equal(element('#sandbox-interact').classes.has('hidden'), false);
  assert.match(element('#film-sequence-hint').textContent, /G.*Trinity/);
  h.wall.paused = true; ui.updateFilm(h.player, h.sandbox); assert.ok(element('#sandbox-interact').classes.has('hidden'));
  h.wall.paused = false; h.wall.phase = 'failed'; ui.updateFilm(h.player, h.sandbox); assert.match(element('game-objective-copy').textContent, /重试/);
});
