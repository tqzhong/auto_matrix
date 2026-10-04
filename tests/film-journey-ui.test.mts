import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, oracleReceptionRoot, mirrorEntryPose, awakeningDuration, MIRROR_TIMING, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the Oracle departure journal requires the hostess, privacy, bite and physical exit in order', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player = { id: 'neo', status: 'alive', isInMatrix: true, position: filmPosition('film_oracle_home', -4.6, -10.2) } as AgentState;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: 'm1_oracle', actor: 'neo', step: 2, completed: [], reflections: {}, lastText: '带着饼干离开。',
    oracle: { consultation: { phase: 'done', elapsed: 4.2 }, departure: { phase: 'waiting', elapsed: 0, rise: 0 }, reception: { phase: 'ready', progress: 0, elapsed: 0 } } } } } as SandboxState;
  const departure = sandbox.neoLife!.journey!.oracle!.departure!;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >请接待者带路/);
  assert.doesNotMatch(renderFilmJourney(player, sandbox), /data-target="film:next"/);
  departure.phase = 'guiding'; assert.doesNotMatch(renderFilmJourney(player, sandbox), /data-target="film:act"/);
  departure.phase = 'bite_ready'; player.position = filmPosition('film_oracle_home', 3, 20);
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >吃一口饼干/);
  departure.phase = 'leaving'; assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" disabled>确认离开公寓/);
  player.position = filmPosition('film_oracle_home', 0, 27); assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >确认离开公寓/);
  departure.phase = 'done'; sandbox.neoLife!.journey!.step = 3;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:next" >继续返回路线/);
});

test('Oracle departure navigation follows the returning hostess and only offers local interactions', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const player = { id: 'neo', status: 'alive', isInMatrix: true, rotation: 0, position: filmPosition('film_oracle_home', -4.6, -10.2) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm1_oracle', actor: 'neo', step: 2, completed: [], reflections: {}, lastText: '接待者正在等你。',
    oracle: { consultation: { phase: 'done', elapsed: 4.2 }, departure: { phase: 'guiding', elapsed: 0, rise: 0 }, reception: { phase: 'returning', progress: 3, elapsed: 0 } } } } } as SandboxState;
  ui.updateFilm(player, sandbox); assert.match(element('#sandbox-waypoint').innerHTML, /白衣接待者/);
  assert.doesNotMatch(element('#film-sequence-hint').textContent, /G 离开厨房/);
  sandbox.neoLife!.journey!.oracle!.departure!.phase = 'bite_ready'; ui.updateFilm(player, sandbox);
  assert.match(element('#sandbox-nearby').textContent, /吃一口饼干/); assert.equal(element('#sandbox-waypoint').textContent, '');
  sandbox.neoLife!.journey!.oracle!.departure!.phase = 'leaving'; ui.updateFilm(player, sandbox);
  assert.match(element('#sandbox-waypoint').innerHTML, /公寓出口/);
});

test('Oracle navigation points to the waiting hostess until she reaches the kitchen', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const reception = { phase: 'guiding' as const, progress: 3.84, elapsed: 2.2 }, place = oracleReceptionRoot(reception);
  const player = { id: 'neo', status: 'alive', isInMatrix: true, rotation: Math.PI, position: filmPosition('film_oracle_home', 0, -6) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm1_spoon', actor: 'neo', step: 1, completed: [], reflections: {}, lastText: '接待者正在等你。',
    oracle: { spoon: 1, spoonLesson: { phase: 'done', elapsed: 2.6 }, reception } } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  const gap = Math.round(Math.hypot(place.x, place.z + 6));
  assert.match(element('#sandbox-waypoint').innerHTML, new RegExp(`白衣接待者.*${gap} m`));
  assert.doesNotMatch(element('game-objective-copy').textContent, /走到标记旁/);
  sandbox.neoLife!.journey!.oracle!.reception!.phase = 'ready';
  ui.updateFilm(player, sandbox);
  assert.match(element('#sandbox-waypoint').innerHTML, /厨房入口.*2 m/);
});

test('the spoon journal waits for the hostess before offering Neo a standing action', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player = { id: 'neo', status: 'alive', isInMatrix: true, position: filmPosition('film_oracle_home', -7.4, 9.6) } as AgentState;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: 'm1_spoon', actor: 'neo', step: 0, completed: [], reflections: {}, lastText: '接待者从厨房走来。',
    oracle: { spoon: 1, spoonLesson: { phase: 'understood', elapsed: 0 }, reception: { phase: 'approaching', progress: 2, elapsed: 0 } } } } } as SandboxState;
  assert.doesNotMatch(renderFilmJourney(player, sandbox), /按住 G/);
  assert.doesNotMatch(renderFilmJourney(player, sandbox), /data-target="film:act" >起身/);
  sandbox.neoLife!.journey!.oracle!.reception = { phase: 'inviting', progress: 20, elapsed: 2.2 };
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" >起身去见先知/);
});

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

test('the tracking journal keeps new entries locked beyond the legacy eight seconds', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m1_mirror;
  const player = { id: 'neo', status: 'alive', isInMatrix: true, position: filmStepPosition(scene, scene.steps[0]) } as AgentState;
  const beat = { kind: 'mirror' as const, elapsed: 10, chairMotion: 'stepping' as const,
    approach: { x: -7.05949, z: -14.53079, yaw: -2.61374 } };
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: scene.id, actor: 'neo', step: 0, completed: [], reflections: {},
    lastText: 'Trinity 正在接线。', awakening: beat } } } as SandboxState;
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" disabled>演出进行中/);
  assert.doesNotMatch(renderFilmJourney(player, sandbox), /data-target="film:act" >.*G/);
  sandbox.neoLife!.journey!.awakening = { kind: 'mirror', elapsed: 4 };
  assert.match(renderFilmJourney(player, sandbox), /data-target="film:act" disabled>演出进行中/);
});

test('tracking progress follows the saved chair entry before wiring and mirror coverage', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
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
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const beat = { kind: 'mirror' as const, elapsed: 4.558, chairMotion: 'stepping' as const,
    approach: { x: -7.05949, z: -14.53079, yaw: -2.61374 } };
  const player = { id: 'neo', isInMatrix: true, rotation: Math.PI, position: filmPosition('film_lafayette', -7.7, -16.95) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm1_mirror', actor: 'neo', step: 0, completed: [], reflections: {},
    lastText: 'Neo 走到追踪椅前。', awakening: beat } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /入椅进行中/);
  assert.match(element('game-objective-copy').textContent, new RegExp(`${Math.round(beat.elapsed / awakeningDuration(beat) * 100)}%`));
  assert.equal(element('#sandbox-interact').classes.has('hidden'), true, 'the entry cannot offer a second G action');
  beat.elapsed = mirrorEntryPose(beat).duration + .75;
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /追踪接线进行中/);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), true, 'the old eight-second limit cannot release a new entry');
  beat.elapsed = mirrorEntryPose(beat).duration + MIRROR_TIMING.touch - MIRROR_TIMING.sit;
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /镜面覆盖进行中/);
  sandbox.neoLife!.journey!.awakening = { kind: 'mirror', elapsed: 4 };
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /镜面覆盖进行中 · 50%/);
});

test('the completed oral removal offers a new neck inspection in both the journal and the game HUD', async t => {
  const outputs = await Promise.all(['FilmJourneyPanel', 'SandboxUI'].map(name => build({ entryPoints: [`packages/client/src/player/${name}.ts`], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' })));
  const [journal, hud] = await Promise.all(outputs.map(output => import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`)));
  const elements = new Map();
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
  const ui = Object.assign(Object.create(hud.SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const scene = FILM_SCENE_BY_ID.m1_pod;
  const player = { id: 'neo', status: 'alive', isInMatrix: false, position: filmStepPosition(scene, scene.steps[0]) } as AgentState;
  const sandbox = { threats: [], neoLife: { cycle: 1, journey: { scene: scene.id, actor: 'neo', step: 0, completed: [], reflections: {},
    lastText: '双手仍握着口部呼吸管。', awakening: { kind: 'breather', elapsed: 2.4 } } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /拔出口部呼吸管进行中/);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), true, 'another G cannot interrupt the grasp');
  assert.doesNotMatch(journal.renderFilmJourney(player, sandbox), /data-target="film:act" >检查后颈接口/);
  sandbox.neoLife!.journey!.awakening = { kind: 'breather', elapsed: 5.5, started: false };
  ui.updateFilm(player, sandbox);
  assert.match(element('game-objective-copy').textContent, /检查后颈接口 · 按 G/);
  assert.match(element('#film-sequence-hint').textContent, /G 检查后颈接口/);
  assert.equal(element('#sandbox-interact').classes.has('hidden'), false, 'the finished action must expose its next input');
  assert.equal(element('#sandbox-nearby').textContent, '检查后颈接口');
  assert.match(journal.renderFilmJourney(player, sandbox), /data-target="film:act" >检查后颈接口 · G/);
  assert.doesNotMatch(journal.renderFilmJourney(player, sandbox), /data-target="film:next"/);
});

test('the pill choice clears the central subtitle over Morpheus palms and restores it for the taking action', async t => {
  const output = await build({ entryPoints: ['packages/client/src/player/SandboxUI.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { SandboxUI } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map();
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
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 });
  const player = { id: 'neo', isInMatrix: true, rotation: -Math.PI / 2, position: filmPosition('film_lafayette', 1.75, -6) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm1_pills', actor: 'neo', step: 1, completed: [], reflections: {},
    lastText: 'Morpheus 解释两种选择。', pills: { phase: 'offering', elapsed: 2, approach: { x: 1.75, z: -6, yaw: -Math.PI / 2 } } } } } as SandboxState;
  ui.updateFilm(player, sandbox);
  assert.equal(element('#film-sequence').classes.has('hidden'), false, 'Morpheus introduction remains subtitled');
  assert.equal(element('#film-pills').classes.has('hidden'), true, 'the player waits for the offered choice');
  const pills = sandbox.neoLife!.journey!.pills!; pills.phase = 'choice'; ui.updateFilm(player, sandbox);
  assert.equal(element('#film-sequence').classes.has('hidden'), true, 'the central subtitle must clear the visible capsules while waiting');
  assert.equal(element('#film-pills').classes.has('hidden'), false, 'both explicit choices remain available');
  pills.phase = 'taking'; pills.choice = 'red'; sandbox.neoLife!.journey!.lastText = 'Neo 用水吞服。'; ui.updateFilm(player, sandbox);
  assert.equal(element('#film-sequence').classes.has('hidden'), false);
  assert.equal(element('#film-pills').classes.has('hidden'), true, 'taking cannot offer a second decision');
  assert.equal(element('#film-sequence-line').textContent, 'Neo 用水吞服。');
});

test('the completed farewell guides Neo to the machine city instead of asking for another reflection', async t => {
  const outputs = await Promise.all(['SandboxUI', 'PlayerExperience'].map(name => build({ entryPoints: [`packages/client/src/player/${name}.ts`], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' })));
  const [hud, experience] = await Promise.all(outputs.map(output => import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`)));
  const elements = new Map();
  const element = (selector: string) => {
    const id = selector.replace(/^#/, '');
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: { setProperty() {} }, setAttribute() {},
      classList: { add() {}, remove() {}, toggle() {} }, querySelector: (child: string) => element(`${id} ${child}`) });
    return elements.get(id);
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element, body: { classList: { toggle() {} } } } as unknown as Document;
  const root = { querySelector: element, querySelectorAll: () => [] };
  const ui = Object.assign(Object.create(hud.SandboxUI.prototype), { root, tick: 0 });
  const playerUI = Object.assign(Object.create(experience.PlayerExperience.prototype), { root, controlled: 'neo', chosen: 'neo', lastPlayed: 'neo',
    menuOpen: false, entryExplicit: false, tipUntil: Infinity, drawMap() {} });
  const player = { id: 'neo', name: 'Neo', faction: 'zion', status: 'alive', health: 100, maxHealth: 100, isAwakened: true,
    isInMatrix: false, rotation: Math.PI, activeEffects: [], currentLocation: 'film_logos_wreck', position: filmPosition('film_logos_wreck', 0, -14.4) } as AgentState;
  const sandbox = { threats: [], neoLife: { journey: { scene: 'm3_farewell', actor: 'neo', step: 2, completed: [], reflections: {},
    lastText: 'Trinity 的手失去力量。', farewell: { phase: 'still', elapsed: 0, total: 18.4 } } } } as SandboxState;
  const render = () => { playerUI.update({ neo: player }, { running: true, population: 1 }, sandbox.neoLife); ui.updateFilm(player, sandbox); };
  render();
  assert.match(element('mouse-hint').textContent, /记录 Neo.*理解/);
  assert.match(element('game-objective-copy').textContent, /留下 Neo.*理解/);
  assert.match(element('film-sequence-hint').textContent, /留下 Neo.*理解/);
  const journey = sandbox.neoLife!.journey!;
  journey.completed.push('m3_farewell'); render();
  assert.match(element('mouse-hint').textContent, /记录 Neo.*理解/, 'historical completion cannot skip the current reflection');
  assert.match(element('game-objective-copy').textContent, /留下 Neo.*理解/);
  journey.step = FILM_SCENE_BY_ID.m3_farewell.steps.length; journey.reflections['m3_farewell:2'] = 'care';
  render();
  assert.equal(element('game-objective').textContent, '前往机器城');
  for (const id of ['mouse-hint', 'game-objective-copy', 'film-sequence-hint']) {
    assert.match(element(id).textContent, /J.*继续下一段.*机器城/, `${id} must show the available next action`);
    assert.doesNotMatch(element(id).textContent, /记录|留下.*理解|反思/, `${id} cannot ask for the completed choice again`);
  }
});
