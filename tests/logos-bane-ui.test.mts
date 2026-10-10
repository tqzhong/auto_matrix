import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { LOGOS_BANE, filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';
const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
function setup() {
  const player = { id: 'neo', status: 'alive', health: 43, position: filmPosition('film_logos_deck', LOGOS_BANE.approach.x, LOGOS_BANE.approach.z) } as AgentState;
  const state = { threats: [], neoLife: { journey: { scene: 'm3_bane', actor: 'neo', step: 1, completed: [], reflections: {}, lastText: 'Trinity 被挟持。',
    bane: { phase: 'ready', elapsed: 0, attempts: 0, checkpoint: 'gun', hits: 0, focus: 0, counters: 0, lastStrike: -1,
      physical: { version: 1, intro: 'hostage', elapsed: 2, known: false, gunOnDeck: false, rescue: 'waiting', rescueElapsed: 0, gunHealth: 43, blindHealth: 25, baneHealth: 80, fall: 0, player: LOGOS_BANE.neo } } } } } as unknown as SandboxState;
  return { player, state, journey: state.neoLife!.journey!, physical: state.neoLife!.journey!.bane!.physical! };
}
test('the Logos journal waits for dialogue and cannot skip hostage actions or disclose the later gold perception', () => {
  const h = setup();
  assert.doesNotMatch(renderFilmJourney(h.player, h.state), /data-target="film:act"|失明与金色视野/);
  h.physical.intro = 'lower_ready'; assert.match(renderFilmJourney(h.player, h.state), /data-target="film:act"/);
  h.physical.intro = 'lowering'; assert.doesNotMatch(renderFilmJourney(h.player, h.state), /data-target="film:act"/);
  h.physical.intro = 'recognition_ready'; assert.match(renderFilmJourney(h.player, h.state), /data-target="film:act"/);
  h.physical.paused = 'Trinity'; assert.doesNotMatch(renderFilmJourney(h.player, h.state), /data-target="film:act"/);
});
test('the Logos journal waits for the physical hatch rescue and offers the next scene only after Trinity returns', () => {
  const h = setup(); h.physical.intro = 'done'; h.physical.known = true; h.journey.bane!.phase = 'defeated'; h.journey.step = 2;
  h.player.position = filmPosition('film_logos_deck', LOGOS_BANE.rescue.x, LOGOS_BANE.rescue.z);
  assert.match(renderFilmJourney(h.player, h.state), /data-target="film:act"/);
  h.physical.rescue = 'climbing'; assert.doesNotMatch(renderFilmJourney(h.player, h.state), /data-target="film:(act|next)"/);
  h.physical.rescue = 'done'; h.journey.step = 3; assert.match(renderFilmJourney(h.player, h.state), /data-target="film:next"/);
});

test('the recognition prompt stays enabled after Neo retreats from the outer edge of the approach area', () => {
  const h = setup(); h.physical.intro = 'recognition_ready';
  h.player.position = filmPosition('film_logos_deck', 0, -9.6);
  h.physical.player = { x: 0, y: 0, z: -9.6, yaw: 0 };
  h.physical.gunPoint = { x: .34, y: .26, z: -6.7 };
  const action = renderFilmJourney(h.player, h.state).match(/<button[^>]*data-target="film:act"[^>]*>/)?.[0];
  assert.ok(action); assert.doesNotMatch(action, /disabled/, 'the journal uses the same recognition reach as the physical encounter');
});
