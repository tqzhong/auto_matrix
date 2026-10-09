import assert from 'node:assert/strict';
import test from 'node:test';
import { ORACLE_LAST, newOracleLast, filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';
import { build } from 'esbuild';

const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('the final Oracle journal requires two local questions and a reply before physical departure', () => {
  const player = { id: 'neo', status: 'alive', isInMatrix: true, position: filmPosition('film_oracle_home', 0, -10) } as AgentState;
  const state = { threats: [], neoLife: { journey: { scene: 'm3_oracle_last', actor: 'neo', step: 0, completed: [], reflections: {}, oracleLast: newOracleLast(0, 61) } } } as unknown as SandboxState;
  const journey = state.neoLife!.journey!, visit = journey.oracleLast!;
  let html = renderFilmJourney(player, state);
  assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/, 'arrival must be played in the apartment');
  visit.phase = 'greeting'; visit.arrival = 10;
  html = renderFilmJourney(player, state); assert.match(html, /水槽/);
  assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
  visit.phase = 'ready'; visit.arrival = 28; journey.step = 1;
  html = renderFilmJourney(player, state); assert.match(html, /data-target="film:act" disabled/);
  player.position = filmPosition('film_oracle_home', ORACLE_LAST.question.x, ORACLE_LAST.question.z);
  assert.match(renderFilmJourney(player, state), /data-target="film:act" >.*身份/);
  visit.phase = 'answering'; visit.elapsed = 0;
  html = renderFilmJourney(player, state); assert.match(html, /糖/);
  assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
  visit.phase = 'ready'; journey.step = 2;
  assert.match(renderFilmJourney(player, state), /data-target="film:act" >.*源头/);
  visit.phase = 'reflection'; journey.step = 3;
  assert.match(renderFilmJourney(player, state), /data-target="film:reflect:/);
  visit.phase = 'responding'; visit.reply = 'care';
  html = renderFilmJourney(player, state); assert.match(html, /两个世界/);
  assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
  visit.phase = 'leaving'; journey.step = 4;
  html = renderFilmJourney(player, state); assert.match(html, /亲自|WASD/);
  assert.doesNotMatch(html, /data-target="film:next"/);
  visit.phase = 'done'; journey.step = 5;
  assert.match(renderFilmJourney(player, state), /data-target="film:next"/);
});

test('a dead Neo can retry, but an occupied or unavailable Oracle cannot be skipped or healed from the journal', () => {
  const player = { id: 'neo', status: 'dead', isInMatrix: true, position: filmPosition('film_oracle_home', -6, -15.4) } as AgentState;
  const state = { threats: [], neoLife: { journey: { scene: 'm3_oracle_last', actor: 'neo', step: 1, completed: [], reflections: {}, oracleLast: newOracleLast(1, 61) } } } as unknown as SandboxState;
  assert.match(renderFilmJourney(player, state), /data-target="film:retry"/);
  player.status = 'alive'; state.neoLife!.journey!.oracleLast!.paused = 'Sati';
  let html = renderFilmJourney(player, state); assert.match(html, /Sati/);
  assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
  state.neoLife!.journey!.oracleLast!.paused = undefined; state.neoLife!.journey!.oracleLast!.unavailable = '先知';
  html = renderFilmJourney(player, state); assert.match(html, /没有恢复/);
  assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
});
