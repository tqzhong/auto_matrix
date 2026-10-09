import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { HEL_BREAKOUT, filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);

test('the Hel HUD uses the real kick and flight clock and hides G while the hand is catching', t => {
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
  const player = { id: 'trinity', status: 'alive', isInMatrix: true, position: filmPosition('film_club_hel', 0, -29) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_hel_bargain', actor: 'trinity', step: 4,
    completed: [], reflections: {}, helBargain: { phase: 'airborne', elapsed: .56, breakout: {} } } } } as unknown as SandboxState;
  ui.updateFilm(player, sandbox);
  const remaining = (HEL_BREAKOUT.kick + HEL_BREAKOUT.flight - .56).toFixed(1);
  assert.equal(element('sandbox-trace').textContent, `包围圈 ${remaining} 秒`);
  assert.match(element('film-sequence-hint').textContent, new RegExp(`${remaining} 秒`));
  sandbox.neoLife!.journey!.helBargain!.phase = 'catching'; ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-interact').classList.contains('hidden'), true);
  assert.match(element('game-objective-copy').textContent, /握.*枪/);
  assert.doesNotMatch(element('game-objective-copy').textContent, /按 G/);
});
