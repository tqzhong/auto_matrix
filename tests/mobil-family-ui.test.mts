import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, mobilFamilyText, type AgentState, type SandboxState } from '@auto_matrix/shared';

async function client(path: string) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false,
    loader: { '.css': 'empty' }, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}
function state() {
  const player = { id: 'neo', status: 'alive', isInMatrix: true, rotation: -Math.PI / 2,
    position: filmPosition('film_mobil_station', -7, -8) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_family', actor: 'neo', step: 1, completed: [], reflections: {},
    mobil: { phase: 'waiting', elapsed: 0, lastTick: 0, loops: 0, family: { phase: 'questions', answered: [], elapsed: 0 } } } } } as unknown as SandboxState;
  return { player, sandbox, family: sandbox.neoLife!.journey!.mobil!.family! };
}

test('the family journal offers actual questions and opens the existing philosophy choices only after their answers', async () => {
  const { renderFilmJourney } = await client('packages/client/src/player/FilmJourneyPanel.ts');
  const h = state();
  const questions = renderFilmJourney(h.player, h.sandbox);
  assert.equal((questions.match(/data-target="film:family:ask:/g) ?? []).length, 4);
  assert.doesNotMatch(questions, /data-target="film:reflect:/);
  h.family.phase = 'hearing'; h.family.selected = 'purpose'; h.family.elapsed = 4;
  const hearing = renderFilmJourney(h.player, h.sandbox);
  assert.match(hearing, /Sati 没有系统指定的功能/);
  assert.doesNotMatch(hearing, /data-target="film:reflect:/);
  h.family.phase = 'reflection'; h.family.answered = ['identity', 'purpose', 'connection', 'parting'];
  const reflection = renderFilmJourney(h.player, h.sandbox);
  assert.match(reflection, /data-target="film:reflect:care"/);
  assert.doesNotMatch(reflection, /data-target="film:family:ask:/);
});

test('the Mobil luggage prompt and journal agree on the reachable grip after the doors open', async t => {
  const { renderFilmJourney } = await client('packages/client/src/player/FilmJourneyPanel.ts'), h = state(), journey = h.sandbox.neoLife!.journey!;
  const { SandboxUI } = await client('packages/client/src/player/SandboxUI.ts');
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: {
      hidden: false, add(name: string) { if (name === 'hidden') this.hidden = true; }, remove() {},
      toggle(_name: string, hidden: boolean) { this.hidden = hidden; },
    } });
    return elements.get(id);
  };
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const hidden = () => { ui.updateFilm(h.player, h.sandbox); return element('#sandbox-interact').classList.hidden; };
  journey.scene = 'm3_trainman'; journey.step = 0; journey.mobil!.phase = 'approaching'; journey.mobil!.luggage = { phase: 'ready', elapsed: 0 };
  h.player.position = filmPosition('film_mobil_station', -10.8, -10);
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
  assert.equal(hidden(), true);
  journey.mobil!.phase = 'stopped'; journey.mobil!.elapsed = 1;
  for (const [x, z] of [[-11.01, -11.5], [-11.2, -10]]) {
    h.player.position = filmPosition('film_mobil_station', x, z);
    assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:act" disabled/);
    assert.equal(hidden(), true, 'a G prompt must match the actual pickup distance');
  }
  h.player.position = filmPosition('film_mobil_station', -10.8, -10);
  assert.match(renderFilmJourney(h.player, h.sandbox), /data-target="film:act" >/);
  assert.equal(hidden(), false);
  journey.mobil!.luggage.phase = 'lifting';
  assert.doesNotMatch(renderFilmJourney(h.player, h.sandbox), /data-target="film:act"/);
  assert.equal(hidden(), true);
  journey.mobil!.luggage.phase = 'carried'; journey.step = 1;
  const carrying = renderFilmJourney(h.player, h.sandbox);
  assert.match(carrying, /WASD/); assert.doesNotMatch(carrying, /data-target="film:act"/);
});

test('G asks a family question, spoken answers appear in world subtitles, and J is requested only for the final reflection', async t => {
  const { SandboxUI } = await client('packages/client/src/player/SandboxUI.ts'), h = state();
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id);
  };
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const sent: any[] = [], opened: string[] = [];
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, player: h.player, state: h.sandbox,
    tick: 0, send: (command: unknown) => sent.push(command), open: (panel: string) => opened.push(panel) });
  ui.updateFilm(h.player, h.sandbox); ui.interact();
  assert.deepEqual(sent, [{ kind: 'life', target: 'film:act' }]); assert.deepEqual(opened, []);
  h.family.phase = 'hearing'; h.family.selected = 'purpose'; h.family.elapsed = 4;
  ui.updateFilm(h.player, h.sandbox);
  assert.equal(element('#film-sequence-line').textContent, mobilFamilyText(h.family));
  assert.doesNotMatch(element('game-objective-copy').textContent, /记录反思/);
  h.family.phase = 'reflection'; ui.updateFilm(h.player, h.sandbox); ui.interact();
  assert.deepEqual(opened, ['journal']); assert.match(element('#film-sequence-hint').textContent, /J 记录/);
  h.family.phase = 'done'; h.sandbox.neoLife!.journey!.step = 2;
  ui.updateFilm(h.player, h.sandbox);
  assert.equal(element('#sandbox-nearby').textContent, '继续等候列车');
  assert.match(element('#film-sequence-hint').textContent, /G 继续等候列车/);
  ui.interact(); assert.deepEqual(sent.at(-1), { kind: 'life', target: 'film:next' });
});
