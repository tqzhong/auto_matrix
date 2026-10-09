import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, templeDefenseText, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('temple HUD separates held mounting from automatic city breach and restores explicit handoff after waiting', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: {
        add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name),
        toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        contains: (name: string) => classes.has(name),
      } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const player = { id: 'lock', status: 'alive', isInMatrix: false, rotation: Math.PI, position: filmPosition('film_zion_temple', 3.8, -37.5) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_temple_breach', actor: 'lock', step: 1, completed: [], reflections: {},
    templeSeal: { phase: 'sealed', remaining: 18, lastTick: 0, attempts: 0, turns: [1, 1] }, templeBreach: { phase: 'ready', elapsed: 0 } } } } as SandboxState;
  const journey = sandbox.neoLife!.journey!;
  ui.updateFilm(player, sandbox); assert.equal(element('#sandbox-interact').classList.contains('hidden'), false);
  for (const phase of ['orders', 'breach', 'waiting'] as const) {
    journey.templeBreach!.phase = phase; ui.updateFilm(player, sandbox);
    assert.equal(element('game-objective-copy').textContent, templeDefenseText(journey.templeSeal, journey.templeBreach));
    assert.equal(element('#sandbox-interact').classList.contains('hidden'), true, 'the running scene cannot ask for another G');
    assert.equal(element('#sandbox-waypoint').textContent, '', 'completed approach marker cannot cover the drill or companions');
  }
  journey.templeBreach!.phase = 'done'; journey.step = 2; ui.updateFilm(player, sandbox);
  assert.equal(element('#sandbox-interact').classList.contains('hidden'), false);
  assert.match(element('#sandbox-nearby').textContent, /接回.*Neo/);
  journey.scene = 'm3_temple_defense'; journey.actor = player.id = 'zee'; journey.step = 1; delete journey.templeBreach;
  journey.templeSeal!.phase = 'running'; journey.templeSeal!.turns = [.45, 0]; journey.templeSeal!.mount = 0;
  player.position = filmPosition('film_zion_temple', -8, -45); ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /按住 G.*45%/);
  assert.equal(element('#sandbox-interact').classList.contains('hidden'), true, 'holding uses the key, not a repeat action button');
  assert.equal(element('#sandbox-waypoint').textContent, '');
});

test('the temple journal blocks repeated start and scene skip during orders, breach and waiting', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player = { id: 'lock', status: 'alive', isInMatrix: false, position: filmPosition('film_zion_temple', 3.8, -37.5) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_temple_breach', actor: 'lock', step: 1, completed: [], reflections: {},
    templeSeal: { phase: 'sealed', remaining: 18, lastTick: 0, attempts: 0, turns: [1, 1] }, templeBreach: { phase: 'orders', elapsed: 1 } } } } as SandboxState;
  const journey = sandbox.neoLife!.journey!;
  for (const phase of ['orders', 'breach', 'waiting'] as const) {
    journey.templeBreach!.phase = phase; const html = renderFilmJourney(player, sandbox);
    assert.doesNotMatch(html, /data-target="film:act"|data-target="film:next"/);
    assert.doesNotMatch(html, /固定炮架时按住 G/, 'the automatic city scene must not tell the player to turn the wheel again');
  }
  journey.templeBreach!.phase = 'done'; journey.step = 2; assert.match(renderFilmJourney(player, sandbox), /data-target="film:next"/);
  journey.templeBreach!.paused = 'Zee'; assert.doesNotMatch(renderFilmJourney(player, sandbox), /data-target="film:next"/);
  journey.scene = 'm3_farewell'; journey.actor = player.id = 'neo'; journey.step = 3;
  journey.farewell = { phase: 'still', elapsed: 0, total: 20 };
  assert.match(renderFilmJourney(player, sandbox), /锡安/, 'the farewell handoff must identify the intervening city scene');
});
