import assert from 'node:assert/strict';
import test from 'node:test';
import { newOracleAbsorption, ORACLE_ABSORPTION, filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';
import { build } from 'esbuild';

const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('the Oracle journal follows the physical farewell and invasion, with no timed shortcut or premature reflection', () => {
  const player = { id: 'oracle', status: 'alive', isInMatrix: true, position: filmPosition('film_oracle_home', ORACLE_ABSORPTION.start.x, ORACLE_ABSORPTION.start.z) } as AgentState;
  const state = { threats: [], neoLife: { journey: { scene: 'm3_oracle_absorbed', actor: 'oracle', step: 0, completed: [], reflections: {}, oracleAbsorption: newOracleAbsorption(0, 47) } } } as unknown as SandboxState;
  const journey = state.neoLife!.journey!, scene = journey.oracleAbsorption!;
  assert.match(renderFilmJourney(player, state), /先知.*另一视角/);
  scene.phase = 'farewell'; scene.farewell = 5;
  let html = renderFilmJourney(player, state); assert.match(html, /Sati/); assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
  scene.phase = 'escaping'; journey.step = 1; scene.escape = 26;
  html = renderFilmJourney(player, state); assert.match(html, /信号.*沉默|不知道两人/); assert.doesNotMatch(html, /撤离没有成功/); assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
  scene.phase = 'reflection'; journey.step = 2; player.position = filmPosition('film_oracle_home', ORACLE_ABSORPTION.seat.x, ORACLE_ABSORPTION.seat.z);
  assert.match(renderFilmJourney(player, state), /data-target="film:reflect:/);
  scene.phase = 'consent'; journey.step = 3; html = renderFilmJourney(player, state);
  assert.match(html, /按住 G/); assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/);
  scene.phase = 'done'; journey.step = 4; player.status = 'disconnected';
  html = renderFilmJourney(player, state); assert.match(html, /data-target="film:next"/);
  assert.doesNotMatch(html, /data-target="film:retry"/);
});
