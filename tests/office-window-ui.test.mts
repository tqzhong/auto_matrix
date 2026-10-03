import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

const modules = Promise.all(['SandboxUI', 'FilmJourneyPanel'].map(async name => {
  const output = await build({ entryPoints: [`packages/client/src/player/${name}.ts`], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
}));
function openWindow() {
  const scene = FILM_SCENE_BY_ID.m1_office_escape;
  const player = { id: 'neo', status: 'alive', isInMatrix: true, rotation: -Math.PI / 2,
    position: filmStepPosition(scene, scene.steps[2]) } as AgentState;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: scene.id, actor: 'neo', step: 3, completed: [], reflections: {},
    lastText: '窗口已打开。', office: { window: 3.2, alert: 0, suspicion: [0, 0, 0], waypoints: [1, 1, 1], lastTick: 10,
      guide: 'MORPHEUS · 沿百叶窗走到尽头。靠近窗户后按 G 打开。', searches: [null, null, null] } } } } as SandboxState;
  return { player, sandbox, journey: sandbox.neoLife!.journey! };
}

test('the open-window HUD offers physical crossing and guides Neo back without concealing pursuit', async t => {
  const [{ SandboxUI }] = await modules, elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set<string>();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classes, classList: {
        add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name),
        toggle: (name: string, force?: boolean) => (force ?? !classes.has(name)) ? classes.add(name) : classes.delete(name),
      } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 10 });
  const { player, sandbox, journey } = openWindow();
  ui.updateFilm(player, sandbox);
  assert.match(element('#sandbox-nearby').textContent, /翻过窗台/);
  assert.match(element('game-objective-copy').textContent, /G.*外侧窄台/);
  assert.doesNotMatch(element('#film-phone-line').textContent, /按 G 打开/,
    'pausing on the completion frame must not keep the earlier open-window instruction');
  assert.equal(element('#sandbox-interact').classes.has('hidden'), false);
  player.position = filmPosition('film_metacortex_floor', -16, -27);
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /回到.*窗口/);
  assert.match(element('#sandbox-waypoint').innerHTML, /已打开的窗口.*9 m/);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), true);
  journey.office!.spotted = true; journey.office!.alert = 80; journey.office!.guide = 'MORPHEUS · 他认出你了，正在追过来！';
  ui.updateFilm(player, sandbox); assert.match(element('#film-phone-line').textContent, /正在追过来/);
  journey.office!.spotted = false; journey.office!.searches![0] = { source: 'sound', position: { ...player.position }, remaining: 20 };
  journey.office!.guide = 'MORPHEUS · 他们听见了脚步。'; ui.updateFilm(player, sandbox);
  assert.match(element('#film-phone-line').textContent, /听见了脚步/);
  journey.office!.crossing = 2.2; ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /正在跨窗/);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), true);
  delete journey.office!.crossing; journey.office!.outcome = 'captured'; ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /进入审讯/);
});

test('the journal only starts the physical window crossing from its actual interaction radius', async () => {
  const [, { renderFilmJourney }] = await modules, { player, sandbox, journey } = openWindow();
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:next" >翻过窗台.*外侧窄台/);
  player.position.x += 4.01;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:next" disabled>翻过窗台/);
  assert.match(renderFilmJourney(player, sandbox), /回到.*窗口/);
  player.position.x -= 4.01; player.id = 'trinity';
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:next" disabled>翻过窗台/);
  player.id = 'neo'; journey.office!.crossing = 2.2;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:next" disabled>正在跨窗/);
  delete journey.office!.crossing; journey.office!.outcome = 'captured';
  assert.doesNotMatch(renderFilmJourney(player, sandbox), /翻过窗台/);
});
