import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('the dojo counter HUD asks the player to close the actual gap after a backstep', t => {
  const elements = new Map();
  const element = (id: string): any => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, disabled: false,
        querySelector: (selector: string) => element(`${id} ${selector}`), classList: {
          add: (...names: string[]) => names.forEach(name => classes.add(name)),
          remove: (...names: string[]) => names.forEach(name => classes.delete(name)),
          toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
          contains: (name: string) => classes.has(name),
        } });
    }
    return elements.get(id);
  };
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), {
    root: { querySelector: (selector: string) => element(selector.slice(1)) }, tick: 10,
  });
  const player = { id: 'neo', status: 'alive', isInMatrix: true,
    position: filmPosition('film_kungfu_dojo', 0, 6.22), rotation: 0 } as AgentState;
  const sandbox = { structures: [], threats: [{ id: 'morpheus-duel', scene: 'm1_dojo', character: 'morpheus',
    target: 'neo', matrix: true, position: filmPosition('film_kungfu_dojo', 0, 0) }],
    neoLife: { journey: { scene: 'm1_dojo', actor: 'neo', step: 0, completed: [], reflections: {}, fighting: true,
      lastText: '三秒内按 F 完成刺拳、直拳、正蹬三段反击。', dojo: { dodged: true, combo: 0, hits: 0, counterUntil: 16 } } },
  } as unknown as SandboxState;
  const lesson = sandbox.neoLife!.journey!.dojo!;
  ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-hint').textContent, /WASD.*靠近/);
  assert.match(element('game-objective-copy').textContent, /靠近 Morpheus.*3 秒/);
  assert.match(element('film-sequence-line').textContent, /距离.*范围/);
  assert.doesNotMatch(element('film-sequence-hint').textContent, /距离合适/);

  player.position.z = sandbox.threats[0].position.z + 2.7;
  ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-hint').textContent, /距离合适.*F/);
  assert.equal(element('film-training-actions [data-combat="attack"] span').textContent, '刺拳');
  assert.doesNotMatch(element('game-objective-copy').textContent, /靠近/);

  player.position.z = sandbox.threats[0].position.z + 3.5;
  ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-hint').textContent, /WASD.*靠近/, 'a jab cannot reach 3.5 units');
  lesson.combo = 2; ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-hint').textContent, /距离合适.*F/, 'the kick uses its longer reach');
  assert.equal(element('film-training-actions [data-combat="attack"] span').textContent, '正蹬');

  lesson.dodged = false; lesson.combo = 0; delete lesson.counterUntil;
  sandbox.threats[0].attackAt = 12; ui.updateFilm(player, sandbox);
  assert.match(element('film-sequence-hint').textContent, /现在.*X/);
  assert.equal(element('film-training-actions [data-combat="dodge"]').disabled, false);
  assert.equal(element('film-sequence').classList.contains('urgent'), true);
});
