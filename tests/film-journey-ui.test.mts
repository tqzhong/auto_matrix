import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the Construct journal distinguishes self inspection from approaching the chair', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m1_construct;
  const player = { id: 'neo', status: 'alive', isInMatrix: true, position: filmPosition(scene.set, 6.95, 5) } as AgentState;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: scene.id, actor: 'neo', step: 0, completed: [], reflections: {},
    lastText: '接口消失了。', constructArrival: { phase: 'ready', elapsed: 0 } } } } as SandboxState;
  const arrival = sandbox.neoLife!.journey!.constructArrival!;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >检查残余自我影像/);
  arrival.phase = 'image'; arrival.elapsed = 2;
  assert.doesNotMatch(renderFilmJourney(player, sandbox), /data-target="film:act" >/);
  arrival.phase = 'approach'; arrival.elapsed = 11;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" disabled>触摸椅背/);
  player.position = filmStepPosition(scene, scene.steps[0]);
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >触摸椅背/);
});

test('the morning journal requires a bedside action, accepts the alarm and offers the actual on-foot commute', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m1_morning;
  const player = { id: 'neo', position: filmPosition(scene.set, 0, 6) } as AgentState;
  const sandbox = { neoLife: { day: 3, money: 140, energy: 50, journey: { scene: scene.id, actor: 'neo', step: 0,
    completed: [], lastText: '回到 101。', morning: { phase: 'home', elapsed: 0 } } } } as SandboxState;
  const journey = sandbox.neoLife!.journey!;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" disabled>休息到早晨/);
  player.position = filmStepPosition(scene, scene.steps[0]);
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >休息到早晨/);
  journey.step = 1; journey.morning = { phase: 'alarm', elapsed: 2 };
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >伸手关掉闹钟/);
  journey.step = 3; journey.morning.phase = 'done';
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:next" >步行去公司 · G/);
  sandbox.neoLife!.money = 1;
  assert.match(renderFilmJourney(player, sandbox), /步行去公司 · G/);
  player.id = 'trinity'; assert.doesNotMatch(renderFilmJourney(player, sandbox), /data-target="film:next"/);
});

test('the second call offers a visible door action after Neo reaches the apartment exit', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m1_wake_again;
  const player = { id: 'neo', position: filmStepPosition(scene, scene.steps[1]) } as AgentState;
  const sandbox = { neoLife: { journey: { scene: scene.id, actor: 'neo', step: 1,
    completed: [], lastText: '前往 101 房门。站到门内侧，按 G 转动把手。',
    wakeCall: { phase: 'done', elapsed: 0, nightmare: true } } } } as SandboxState;
  const html = renderFilmJourney(player, sandbox);
  assert.match(html, /data-target="film:act"/);
  assert.match(html, /转动门把，离开 101/);
  assert.doesNotMatch(html, /data-target="film:next"/);
});

test('a clean escape presents the second call without naming a nightmare', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m1_wake_again;
  const player = { id: 'neo', position: filmStepPosition(scene, scene.steps[0]) } as AgentState;
  const sandbox = { neoLife: { journey: { scene: scene.id, actor: 'neo', step: 0,
    completed: [], lastText: '座机响了。', office: { outcome: 'escaped', bugged: false },
    wakeCall: { phase: 'ringing', elapsed: 0, nightmare: false } } } } as SandboxState;
  const html = renderFilmJourney(player, sandbox);
  assert.match(html, /101 · 第二次来电/);
  assert.doesNotMatch(html, /并非一场梦/);
});

test('the hotel journal names Trinity when Neo reaches 1313 before the guide', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player = { id: 'neo', position: filmPosition('film_lafayette', 24, 0) } as AgentState;
  const sandbox = { neoLife: { journey: { scene: 'm1_pills', actor: 'neo', step: 0, lastText: 'Trinity 正从楼梯赶来。',
    hotel: { progress: 100 } } } } as SandboxState;
  const html = renderFilmJourney(player, sandbox);
  assert.match(html, /等待 Trinity 赶来/);
  assert.doesNotMatch(html, /敲响 1313 房门/);
});

test('the negative scan journal does not claim Neo was interrogated or needed an extraction', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m1_bug;
  const player = { id: 'neo', status: 'alive', isInMatrix: true, position: filmStepPosition(scene, scene.steps[1]) } as AgentState;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: scene.id, actor: 'neo', step: 1, completed: [],
    lastText: '扫描没有发现追踪装置。', office: { outcome: 'escaped', bugged: false }, meeting: { phase: 'done' }, reflections: {} } } } as SandboxState;
  const html = renderFilmJourney(player, sandbox);
  assert.match(html, /确认没有被追踪/);
  assert.match(html, /先核对扫描结果，再问接头为什么仍要检查/);
  assert.match(html, /第二次来电/);
  assert.doesNotMatch(html, /噩梦|并非一场梦|配合扫描与抽取|取出追踪器/);
});
