import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SCENE_BY_ID, filmStepPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('coat-check cues distinguish protecting the attendant from ally gunfire and keep reload information visible', t => {
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
  const coat = { phase: 'combat', ammo: 0, wave: 1, shots: 12, kills: 2, allyShotAt: [0, 0], coverHits: [0, 0],
    rescuePhysical: true, rescueElapsed: 2.6, rescuePaused: true, reloadAt: 8 };
  const journey = { version: 1, scene: 'm3_hel_entry', actor: 'trinity', step: 1, completed: [], reflections: {},
    enteredAt: 0, checkpoint: { x: 0, y: 0, z: 0 }, lastText: 'Morpheus / Seraph 掩护', fighting: true, helCoatcheck: coat };
  const player = { id: 'trinity', status: 'alive', isInMatrix: true,
    position: filmStepPosition(FILM_SCENE_BY_ID.m3_hel_entry, FILM_SCENE_BY_ID.m3_hel_entry.steps[1], journey) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey, choices: {}, cycle: 1 } } as unknown as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-line').textContent, /护送暂停.*Seraph/);
  assert.match(element('film-sequence-hint').textContent, /弹匣 0\/12.*换弹中/);
  assert.match(element('film-sequence-hint').textContent, /1 医疗包/);
  coat.rescuePaused = false; ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-line').textContent, /保护女侍/);
  coat.rescueElapsed = 4.2; ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-line').textContent, /女侍.*柜台后/);
  coat.wave = 2; ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-line').textContent, /武器墙.*中间通道.*侧面/);
});
