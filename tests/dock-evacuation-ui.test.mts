import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { DOCK_EVACUATION, SHAFT_SEAL, filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
function fixture() {
  const player = { id: 'kid', status: 'alive', isInMatrix: false, position: filmPosition('film_zion_dock_exit', -3, -12) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_dock_evacuation', actor: 'kid', step: 2, completed: [], reflections: {}, lastText: '撤离',
    dockEvacuation: { phase: 'failed', elapsed: 0, crewAge: 11, remaining: 0, attempts: 0, delivered: true } } } } as SandboxState;
  return { player, sandbox, journey: sandbox.neoLife!.journey! };
}
test('the evacuation journal provides an actual failed retry and cannot abandon the last crew or skip the descent', () => {
  const h = fixture(), state = h.journey.dockEvacuation!;
  assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:retry"/);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:next"/);
  state.paused = 'Colt'; assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:retry"/); delete state.paused;
  state.phase = 'waiting'; state.crewAge = 4; h.journey.step = 3;
  h.player.position = filmPosition('film_zion_dock_exit', DOCK_EVACUATION.boarding.x, DOCK_EVACUATION.boarding.z);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"|data-target="film:next"/);
  state.crewAge = 11; assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
  state.phase = 'lowering'; assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"|data-target="film:next"/);
  state.phase = 'clear'; h.journey.step = 4; assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:next"/);
});
test('the shaft journal requires a nearby lever and preserves the held throw instead of offering a timer or replay', () => {
  const h = fixture(); h.journey.scene = 'm3_shaft_seal'; h.journey.actor = h.player.id = 'citizen_15'; h.journey.step = 1;
  h.journey.shaftSeal = { phase: 'ready', elapsed: 0, turn: 0 }; h.player.position = filmPosition('film_zion_command_bunker', -6, 10);
  assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:act" disabled/);
  h.player.position = filmPosition('film_zion_command_bunker', SHAFT_SEAL.operator.x, SHAFT_SEAL.operator.z);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act" disabled/);
  h.journey.shaftSeal.phase = 'throwing'; h.journey.shaftSeal.turn = .45;
  assert.match(renderFilmJourney(h.player, h.sandbox), /按住 G/);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"|data-target="film:next"/);
  h.journey.shaftSeal.phase = 'detonating'; assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"|data-target="film:next"/);
  h.journey.shaftSeal.phase = 'done'; h.journey.step = 2; assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:reflect:care"/);
});
