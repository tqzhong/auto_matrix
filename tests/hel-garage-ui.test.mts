import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { HEL_GARAGE, filmPosition, newHelGarage, type AgentState, type SandboxState } from '@auto_matrix/shared';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('the Hel HUD describes the current defence window instead of sending the player back to a G marker', t => {
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: {
        add: (...names: string[]) => names.forEach(name => classes.add(name)),
        remove: (...names: string[]) => names.forEach(name => classes.delete(name)),
        toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
        contains: (name: string) => classes.has(name),
      } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: (selector: string) => element(selector.slice(1)) }, tick: 0 });
  const player = { id: 'trinity', status: 'alive', isInMatrix: true, position: filmPosition(HEL_GARAGE.set, 5.3, -16.35) } as AgentState;
  const garage = newHelGarage();
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_hel_garage', actor: 'trinity', step: 0,
    completed: [], reflections: {}, helGarage: garage } } } as SandboxState;
  for (const [phase, text] of [['talking', /守卫/], ['evade', /按 X/], ['counter', /按 F/], ['combo', /按 F/], ['opening', /钢门/]] as const) {
    garage.phase = phase; ui.updateFilm(player, sandbox);
    assert.match(element('game-objective-copy').textContent, text);
    assert.equal(element('sandbox-interact').classList.contains('hidden'), true);
    assert.equal(element('sandbox-waypoint').textContent, '', 'a locked exchange must not display its earlier approach marker');
  }
  garage.phase = 'failed'; ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /重试/);
  assert.match(element('film-sequence-hint').textContent, /J/);
  assert.equal(element('film-sequence').classList.contains('urgent'), true);
  garage.phase = 'evade'; garage.paused = 'Morpheus'; ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /另一位玩家/);
  assert.doesNotMatch(element('film-sequence-hint').textContent, /按 [XF]/);
  delete garage.paused; garage.phase = 'cleared'; sandbox.neoLife!.journey!.step = 1;
  player.position = filmPosition(HEL_GARAGE.set, 2.7, -28.55); ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-interact').classList.contains('hidden'), false);
  assert.match(element('sandbox-nearby').textContent, /推开.*钢门/);
  garage.phase = 'exit'; ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-interact').classList.contains('hidden'), true);
  assert.match(element('game-objective-copy').textContent, /WASD/);
  garage.phase = 'done'; sandbox.neoLife!.journey!.step = 2; ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-interact').classList.contains('hidden'), false);
  assert.match(element('game-objective-copy').textContent, /G/);
});

test('the live Hel journal keeps its buttons mounted until their visible content changes', t => {
  const elements = new Map(), element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {}, scrollTop: 0,
      querySelectorAll: () => [], classList: { toggle() {} } });
    return elements.get(id);
  };
  let replacements = 0, html = '';
  Object.defineProperty(element('#sandbox-panel-body'), 'innerHTML', { get: () => html, set: value => { html = value; replacements++; } });
  const player = { id: 'trinity', name: 'Trinity', status: 'alive', isInMatrix: true, position: filmPosition(HEL_GARAGE.set, 5.3, -16.35) } as AgentState;
  const garage = { ...newHelGarage(), phase: 'failed' as const };
  const state = { profiles: { trinity: { inventory: {}, xp: 0, skills: {}, visited: [] } }, missions: {}, structures: [], incidents: [], threats: [], ending: 'open',
    neoLife: { journal: [], cycle: 1, journey: { scene: 'm3_hel_garage', actor: 'trinity', step: 0, completed: [], reflections: {}, helGarage: garage } } } as unknown as SandboxState;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { player, state, panel: 'journal', signature: '', time: 7500,
    root: { querySelector: element, querySelectorAll: () => [] } });
  ui.renderPanel(); assert.match(html, /重试当前入口交战/);
  for (let frame = 0; frame < 20; frame++) { garage.age += .03; ui.renderPanel(); }
  assert.equal(replacements, 1, 'saved frame clocks must not remove the button between mouse-down and mouse-up');
  state.neoLife!.journey!.helGarage!.phase = 'drawing'; ui.renderPanel(); assert.equal(replacements, 2);
  assert.doesNotMatch(html, /data-target="film:retry"/);
  state.neoLife!.journey!.helGarage!.phase = 'cleared'; state.neoLife!.journey!.step = 1; ui.renderPanel();
  assert.match(html, /data-target="film:act" disabled/);
  player.position = filmPosition(HEL_GARAGE.set, 2.7, -28.55); ui.renderPanel();
  assert.match(html, /data-target="film:act" >推开钢门/);
  ui.panel = 'map'; ui.renderPanel(); assert.equal(replacements, 5, 'changing tabs must refresh the selected tab even with identical story content');
});
