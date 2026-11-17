import assert from 'node:assert/strict';
import test from 'node:test';
import { filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';
import { build } from 'esbuild';

const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('the journal offers local questions, withholds early reflections, and directs physical departure', () => {
  const player = { id: 'trinity', isInMatrix: true, position: filmPosition('film_oracle_home', 0, 23) } as AgentState;
  const state = { neoLife: { journey: { scene: 'm3_oracle_request', actor: 'trinity', step: 0,
    oracleRequest: { phase: 'ready', elapsed: 0, guide: 0 } } } } as SandboxState;
  let html = renderFilmJourney(player, state);
  assert.match(html, /data-target="film:act" disabled/);
  player.position = filmPosition('film_oracle_home', -4.6, 12);
  html = renderFilmJourney(player, state); assert.match(html, /data-target="film:act" >确认先知身份/);
  const journey = state.neoLife!.journey!;
  journey.oracleRequest!.phase = 'answering'; journey.step = 1; journey.oracleRequest!.elapsed = 10;
  html = renderFilmJourney(player, state); assert.match(html, /Morpheus/);
  assert.doesNotMatch(html, /data-target="film:(act|next|reflect:)/, 'a pending reply cannot be skipped through the journal');
  journey.oracleRequest!.phase = 'reflection'; journey.step = 2;
  assert.match(renderFilmJourney(player, state), /data-target="film:reflect:/);
  journey.oracleRequest!.phase = 'guiding'; journey.step = 3;
  html = renderFilmJourney(player, state); assert.match(html, /亲自跨过公寓门槛/); assert.doesNotMatch(html, /data-target="film:next"/);
  journey.oracleRequest!.phase = 'done'; journey.step = 4;
  assert.match(renderFilmJourney(player, state), /data-target="film:next"/);
});

test('crossing the Oracle apartment door gives Trinity a prompt to follow Seraph', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map<string, { textContent: string; style: {}; classList: { add(): void; remove(): void; toggle(): void } }>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id)!;
  };
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const player = { id: 'trinity', isInMatrix: true, status: 'alive', position: filmPosition('film_oracle_home', 0, 31) } as AgentState;
  const state = { threats: [], neoLife: { journey: { scene: 'm3_oracle_request', actor: 'trinity', step: 4, completed: ['m3_oracle_request'],
    reflections: {}, oracleRequest: { phase: 'done', elapsed: 0, guide: 9 } } } } as SandboxState;
  const sent: unknown[] = [];
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element },
    player, state, tick: 0, send: (command: unknown) => sent.push(command) });
  ui.updateFilm(player, state);
  assert.equal(element('#sandbox-nearby').textContent, '跟随 Seraph 去找 Trainman');
  ui.interact();
  assert.deepEqual(sent, [{ kind: 'life', target: 'film:next' }]);
});
