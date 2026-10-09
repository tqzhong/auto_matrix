import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { newTruckWeapons, newTruckRoad, truckWeaponsText, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the journal shows controls for the current truck weapon phase and preserves the local retry', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player = { id: 'morpheus', status: 'alive' } as AgentState;
  const sandbox = { neoLife: { journey: { scene: 'm2_trucks', actor: 'morpheus', step: 0, trucks: {
    phase: 'duel', elapsed: 0, lastTick: 0, attempt: 2, weapons: newTruckWeapons(), road: newTruckRoad(
      { x: 14, z: -600 }, { x: 0, y: 6.6, z: -3.5, yaw: Math.PI }, { x: 1, y: 6.6, z: -10.2, yaw: 0 }, 100)
  } } } } as SandboxState;
  const w = sandbox.neoLife!.journey!.trucks!.weapons!;
  assert.doesNotMatch(truckWeaponsText(w), /F 挥刀/, 'the gun phase must not advertise a rejected blade action');
  w.phase = 'blade'; assert.match(renderFilmJourney(player, sandbox), /F 挥刀/);
  w.phase = 'unarmed'; const unarmed = renderFilmJourney(player, sandbox);
  assert.match(unarmed, /F 连击 · X 闪避/);
  assert.doesNotMatch(unarmed, /F 挥刀 · X 限时格挡/);
  player.status = 'dead';
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:retry"/);
  assert.match(renderFilmJourney(player, sandbox), /第 3 次尝试/);
});

test('the truck HUD uses the saved weapon stage rather than displaying zero generic enemies', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name),
        toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name), contains: (name: string) => classes.has(name) } });
    }
    return elements.get(id);
  };
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const player = { id: 'morpheus', status: 'alive', isInMatrix: true, position: { x: 8206, y: 7.6, z: 5092.5 }, rotation: Math.PI } as AgentState;
  const road = newTruckRoad({ x: 14, z: -600 }, { x: 0, y: 6.6, z: -3.5, yaw: Math.PI }, { x: 1, y: 6.6, z: -10.2, yaw: 0 }, 100);
  road.phase = 'ready'; road.elapsed = 5;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm2_trucks', actor: 'morpheus', step: 0, completed: [], reflections: {}, fighting: true,
    trucks: { phase: 'duel', elapsed: 0, lastTick: 0, attempt: 2, weapons: newTruckWeapons(), road } } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /鼠标瞄准/);
  assert.doesNotMatch(element('game-objective-copy').textContent, /Q \/ C 技能/);
  assert.equal(element('#sandbox-interact').classList.contains('hidden'), true);
  sandbox.neoLife!.journey!.trucks!.weapons!.phase = 'counter'; ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /Johnson 抬臂/);
  assert.doesNotMatch(element('#sandbox-nearby').textContent, /剩余 0/);
});
