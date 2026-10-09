import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { TRINITY_TERMINAL, filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the computer HUD exposes service selection, held typing, final submit and a local retry at the appropriate stages', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set<string>();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: { add: (...names: string[]) => names.forEach(n => classes.add(n)),
        remove: (...names: string[]) => names.forEach(n => classes.delete(n)), contains: (name: string) => classes.has(name),
        toggle: (name: string, flag: boolean) => flag ? classes.add(name) : classes.delete(name) } });
    }
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: (selector: string) => element(selector.replace(/^#/, '')) }, tick: 0 });
  const player = { id: 'trinity', status: 'alive', isInMatrix: true, rotation: Math.PI,
    position: filmPosition('film_backup_station', TRINITY_TERMINAL.root.x, TRINITY_TERMINAL.root.z) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm2_backup', actor: 'trinity', step: 1, completed: [], reflections: {},
    trinityTerminal: { phase: 'scanning', elapsed: 1, attempts: 0 } } } } as SandboxState;
  const state = sandbox.neoLife!.journey!.trinityTerminal!;
  for (const phase of ['scanning', 'selecting', 'typing', 'armed', 'failed'] as const) {
    state.phase = phase; element('sandbox-waypoint').textContent = '检查终端并提交断电程序 1 m'; ui.updateFilm(player, sandbox);
    assert.equal(element('sandbox-waypoint').textContent, '', 'a player at the keyboard must not be told to keep walking');
    assert.equal(element('film-terminal').classList.contains('hidden'), phase !== 'selecting');
    assert.equal(element('film-terminal-retry').classList.contains('hidden'), phase !== 'failed');
    assert.equal(element('sandbox-interact').classList.contains('hidden'), phase !== 'armed');
  }
  state.phase = 'typing'; ui.updateFilm(player, sandbox); assert.match(element('game-objective-copy').textContent, /按住 G/);
  state.phase = 'armed'; ui.updateFilm(player, sandbox); assert.match(element('sandbox-nearby').textContent, /明确提交/);
  state.paused = 'Link'; ui.updateFilm(player, sandbox);
  assert.equal(element('sandbox-interact').classList.contains('hidden'), true); assert.match(element('game-objective-copy').textContent, /另一玩家/);
});
