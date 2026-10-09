import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAINMAN_CHASE, filmPosition, newTrainmanChase, type AgentState, type SandboxState } from '@auto_matrix/shared';
import { build } from 'esbuild';

const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('the pursuit journal offers a nearby gate vault, a local retry and a finished-scene handoff without skipping the train', () => {
  const chase = newTrainmanChase(), player = { id: 'seraph', status: 'alive', isInMatrix: true, position: filmPosition(TRAINMAN_CHASE.set, -3.2, -21.5) } as AgentState;
  player.position.y += TRAINMAN_CHASE.upper;
  const state = { neoLife: { journey: { scene: 'm3_trainman_chase', actor: 'seraph', step: 1, helChase: { performance: chase } } } } as SandboxState;
  Object.assign(chase, { phase: 'running', routeStage: 2 });
  assert.match(renderFilmJourney(player, state), /data-target="film:act" >翻越闸机/);
  chase.phase = 'vaulting'; assert.doesNotMatch(renderFilmJourney(player, state), /data-target="film:(act|next)"/);
  chase.phase = 'cover'; assert.match(renderFilmJourney(player, state), /钢柱|闪避/); assert.doesNotMatch(renderFilmJourney(player, state), /data-target="film:next"/);
  chase.phase = 'failed'; assert.match(renderFilmJourney(player, state), /data-target="film:retry"/);
  chase.phase = 'escaped'; state.neoLife!.journey!.step = 2; player.position = filmPosition(TRAINMAN_CHASE.set, 17, -31);
  assert.match(renderFilmJourney(player, state), /data-target="film:act" >与同行者商量/);
  state.neoLife!.journey!.step = 3; assert.match(renderFilmJourney(player, state), /data-target="film:next" >接回 Trinity/);
});
