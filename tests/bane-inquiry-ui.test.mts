import assert from 'node:assert/strict';
import test from 'node:test';
import { newBaneInquiry, type AgentState, type SandboxState } from '@auto_matrix/shared';
import { build } from 'esbuild';
const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
test('the inquiry journal offers two page-specific results and waits for both before a philosophical judgment', () => {
  const player = { id: 'roland', status: 'alive', isInMatrix: false, position: {x:0,y:0,z:0} } as AgentState;
  const state = { threats: [], neoLife: { journey: { scene:'m3_bane_questions',actor:'roland',step:3,completed:[],reflections:{},baneInquiry:newBaneInquiry(3,37) } } } as unknown as SandboxState;
  const inquiry=state.neoLife!.journey!.baneInquiry!; inquiry.phase='reviewing';
  let html=renderFilmJourney(player,state); assert.match(html,/review:negative/); assert.match(html,/review:positive/); assert.doesNotMatch(html,/review:abnormal|reflect:|film:next/);
  inquiry.page='neural';html=renderFilmJourney(player,state);assert.match(html,/review:abnormal/);assert.match(html,/review:normal/);assert.doesNotMatch(html,/review:negative|reflect:/);
  inquiry.phase='reflection';state.neoLife!.journey!.step=4;assert.match(renderFilmJourney(player,state),/reflect:care/);
  inquiry.phase='responding';assert.doesNotMatch(renderFilmJourney(player,state),/data-target="film:(act|next|reflect:)/);
  inquiry.phase='leaving';assert.doesNotMatch(renderFilmJourney(player,state),/film:next/);
  inquiry.phase='done';assert.match(renderFilmJourney(player,state),/film:next/);
});
test('participant occupancy and interviewer death cannot be skipped by the report journal', () => {
  const player = {id:'roland',status:'alive'} as AgentState;
  const state = { neoLife:{journey:{scene:'m3_bane_questions',actor:'roland',step:3,baneInquiry:newBaneInquiry(3,37)}}} as unknown as SandboxState;
  state.neoLife!.journey!.baneInquiry!.paused='Maggie';assert.doesNotMatch(renderFilmJourney(player,state),/data-target="film:(act|review:|reflect:|next)/);
  state.neoLife!.journey!.baneInquiry!.paused=undefined;player.status='dead';assert.match(renderFilmJourney(player,state),/film:retry/);
});
