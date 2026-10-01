import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { FILM_SETS, WETWALL_SHAFT, newBathroomFight, bathroomFightText, bathroomFightAction, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the sixth-floor bathroom offers its nearby start action instead of pointing to the old upper floor', async t => {
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
  const center = FILM_SETS.film_ambush_house.center;
  const player = { id: 'morpheus', status: 'alive', isInMatrix: true, rotation: 0, position: { x: center.x - 15.5, y: center.y + WETWALL_SHAFT.sixth, z: center.z - 27.2 } } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm1_bathroom', actor: 'morpheus', step: 0, completed: [], reflections: {}, lastText: '在六楼掩护。',
    betrayal: { kind: 'bathroom', phase: 'ready', elapsed: 0, sixth: true } } } } as SandboxState;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  ui.updateFilm(player, sandbox);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), false, 'the nearby sixth-floor start button is hidden by the legacy upstairs target');
  assert.equal(element('#sandbox-waypoint').textContent, '', 'a remote upper-floor waypoint must not survive the sixth-floor handoff');
  const css = await readFile(new URL('../packages/client/src/player/film-journey.css', import.meta.url), 'utf8');
  assert.match(css, /body\.film-sixth-hold \.film-sequence\s*\{[^}]*bottom:18[0-9]px/, 'the holdout caption must clear the combat hotbar');
  const fight = { ...newBathroomFight(), phase: 'pinning' as const, held: 1.5 };
  const journey = sandbox.neoLife!.journey!; journey.betrayal!.fight = fight; journey.lastText = bathroomFightText(fight);
  ui.updateFilm(player, sandbox);
  assert.match(element('#film-sequence-hint').textContent, /按住 Z/);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), true, 'the timed grapple cannot offer the generic G advance button');
  assert.equal(element('#sandbox-job').style.width, '37.5%');
  assert.equal(element('#film-sequence').classes.has('bathroom-duel'), true, 'the new ground duel needs a layout that does not cover the bodies');
  assert.match(css, /\.film-sequence\.bathroom-duel\s*\{[^}]*bottom:88px/, 'the duel caption must leave the central body contact visible');
  assert.match(css, /body:has\(\.film-sequence\.bathroom-duel:not\(\.hidden\)\) \.sandbox-interact\s*\{[^}]*bottom:208px/, 'the ready action must move below the actual grapple');
  journey.betrayal!.fight.phase = 'failed'; journey.lastText = bathroomFightText(journey.betrayal!.fight); ui.updateFilm(player, sandbox);
  assert.match(element('#film-sequence-hint').textContent, /J.*六楼地面压制重试/);
  const panel = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(panel.outputFiles[0].contents).toString('base64')}`);
  const failed = renderFilmJourney(player, sandbox);
  assert.match(failed, /data-target="film:retry"/); assert.match(failed, /从六楼地面压制重试/);
  assert.doesNotMatch(failed, /备用控制台|3 次有效击退/);
});

test('the headbutt cue only asks for an immediate attack while the saved strike window is open', () => {
  for (const elapsed of [.2, .8, 1.5]) {
    const fight = { ...newBathroomFight(), phase: 'breakout' as const, elapsed }, available = elapsed === .8;
    assert.equal(bathroomFightText(fight).includes('现在按 F'), available, `misleading headbutt cue at ${elapsed}`);
    bathroomFightAction(fight, 'attack'); assert.equal(fight.headbutt, available);
  }
});
