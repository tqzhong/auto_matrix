import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { NEO_CHAPTERS, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { MUSIC, MusicDirector, musicForScene, type MusicScene, type MusicCue } from '../packages/client/src/engine/Soundtrack.js';
import { GameAudio, readAudioSettings } from '../packages/client/src/engine/GameAudio.js';
import { FILM_MUSIC, FILM_TRACKS } from '../packages/client/src/engine/OriginalScore.js';
import { createHash } from 'node:crypto';

function scene(): MusicScene {
  const world = new WorldState(); new AgentManager(world).initializeAllAgents();
  const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
  const sandbox = new SandboxSystem(world, dynamics, 42);
  const player = world.agents.get('neo')!; player.controller = 'player'; sandbox.enter(player); sandbox.life.begin(player, 0);
  return { player, sandbox: sandbox.state, time: 7500, matrix: true, running: true };
}

test('ordinary life keeps its warm score until night or a nightclub, regardless of global war state', () => {
  const game = scene(); game.sandbox!.ending = 'peace'; game.sandbox!.corruption = 100;
  game.sandbox!.neoLife!.doubt = 100;
  assert.equal(musicForScene(game), 'ordinary');
  game.time = 22000; assert.equal(musicForScene(game), 'night');
  game.player!.currentLocation = 'nightclub'; assert.equal(musicForScene(game), 'club');
  game.player!.currentLocation = 'downtown'; game.player!.isAwakened = true;
  assert.equal(musicForScene(game), 'matrix');
});

test('anomaly music needs a nearby anomaly in the player location, and stops after it is resolved', () => {
  const game = scene(); const player = game.player!; const life = game.sandbox!.neoLife!;
  life.anomaly = { id: 'clock', location: 'nightclub', position: { ...player.position } };
  assert.equal(musicForScene(game), 'ordinary');
  life.anomaly.location = player.currentLocation; life.anomaly.position.x += 50;
  assert.equal(musicForScene(game), 'ordinary');
  life.anomaly.position.x -= 50; assert.equal(musicForScene(game), 'anomaly');
  life.anomaly = undefined; assert.equal(musicForScene(game), 'ordinary');
});

test('only living threats pursuing this player in the same nearby world trigger combat', () => {
  const game = scene(); const player = game.player!;
  const threat = { id: 'test', kind: 'smith' as const, position: { ...player.position }, matrix: true, health: 100, maxHealth: 100, target: 'trinity', stunUntil: 0, lastStrike: 0 };
  game.sandbox!.threats = [threat];
  assert.equal(musicForScene(game), 'ordinary');
  threat.target = player.id; threat.matrix = false; assert.equal(musicForScene(game), 'ordinary');
  threat.matrix = true; threat.position.x += 60; assert.equal(musicForScene(game), 'ordinary');
  threat.position.x -= 60; assert.equal(musicForScene(game), 'combat');
  threat.health = 0; assert.equal(musicForScene(game), 'ordinary');
});

test('philosophical meetings score their actual location, and a new cycle returns to everyday life', () => {
  const game = scene(); const player = game.player!; const life = game.sandbox!.neoLife!;
  player.isAwakened = true;
  for (const id of ['oracle_first', 'oracle_second', 'oracle_last', 'sati']) {
    life.chapter = NEO_CHAPTERS.findIndex(chapter => chapter.id === id);
    player.currentLocation = 'downtown'; assert.equal(musicForScene(game), 'matrix', id);
    player.currentLocation = NEO_CHAPTERS[life.chapter].location; assert.equal(musicForScene(game), 'oracle', id);
  }
  life.chapter = NEO_CHAPTERS.findIndex(chapter => chapter.id === 'dawn'); assert.equal(musicForScene(game), 'dawn');
  life.chapter = 0; life.cycle++; life.ending = undefined; player.isAwakened = false; player.currentLocation = 'neo_apartment';
  assert.equal(musicForScene(game), 'ordinary');
  player.isInMatrix = false; assert.equal(musicForScene(game), 'zion');
});

test('daily work, meals and sleep keep distinct scores without leaking later chapters', () => {
  const game = scene(); const player = game.player!; const life = game.sandbox!.neoLife!;
  player.currentLocation = 'metacortex_office'; assert.equal(musicForScene(game), 'office');
  player.currentLocation = 'corner_cafe'; assert.equal(musicForScene(game), 'cafe');
  player.currentLocation = 'neo_apartment'; life.activity = { id: 'sleep', position: player.position, startedAt: 0, endsAt: 100 };
  assert.equal(musicForScene(game), 'night');
  life.activity = undefined;
  game.sandbox!.missions.smith_final = { status: 'active', stage: 'combat', actor: 'smith', startedAt: 0, progress: 0 };
  assert.equal(musicForScene(game), 'ordinary');
});

test('every Neo chapter has a score at its destination, with distinct trilogy set pieces', () => {
  const expected = ['ordinary', 'contact', 'anomaly', 'awakening', 'awakening', 'training', 'oracle', 'infiltration', 'combat', 'combat', 'the_one', 'zion', 'oracle', 'swarm', 'restaurant', 'chase', 'source', 'oracle', 'mobil', 'oracle', 'oracle', 'siege', 'bane', 'farewell', 'source', 'final', 'source', 'source', 'dawn'];
  assert.equal(expected.length, NEO_CHAPTERS.length);
  const game = scene(); const player = game.player!; const life = game.sandbox!.neoLife!;
  NEO_CHAPTERS.forEach((chapter, index) => {
    life.chapter = index; player.currentLocation = chapter.location;
    player.isAwakened = index >= 4;
    player.isInMatrix = !['nebuchadnezzar', 'zion_command', 'zion_dock', 'machine_city'].includes(chapter.location);
    assert.equal(musicForScene(game), expected[index], chapter.id);
  });
});

test('other roles score their own active mission, leaving its location restores exploration', () => {
  const game = scene(); const player = game.player!; player.id = 'trinity'; player.isAwakened = true;
  player.currentLocation = 'freeway';
  const mission = game.sandbox!.missions.freeway = { status: 'active', stage: 'escort', actor: player.id, startedAt: 0, progress: 0 };
  assert.equal(musicForScene(game), 'chase');
  mission.actor = 'smith'; assert.equal(musicForScene(game), 'matrix');
  mission.actor = player.id; player.currentLocation = 'downtown'; assert.equal(musicForScene(game), 'matrix');
  player.currentLocation = 'freeway'; mission.status = 'complete'; assert.equal(musicForScene(game), 'matrix');
});

test('hits preserve the current set piece; a new chapter or cycle immediately clears its combat tail', () => {
  const game = scene(); const player = game.player!; const life = game.sandbox!.neoLife!; const director = new MusicDirector();
  life.chapter = NEO_CHAPTERS.findIndex(chapter => chapter.id === 'copies'); player.currentLocation = 'central_park'; player.isAwakened = true;
  assert.equal(director.update(game, 0), 'swarm');
  director.impact(10); assert.equal(director.update(game, 10), 'swarm');
  life.chapter = NEO_CHAPTERS.findIndex(chapter => chapter.id === 'oracle_last'); player.currentLocation = 'oracles_apartment';
  assert.equal(director.update(game, 11), 'oracle');
  director.impact(20); director.update(game, 20);
  life.chapter = 0; life.cycle++; player.isAwakened = false; player.currentLocation = 'neo_apartment';
  assert.equal(director.update(game, 21), 'ordinary');
});

test('scene boundaries need two stable seconds; hits sustain combat, but death and role changes clear it', () => {
  const game = scene(); const director = new MusicDirector();
  assert.equal(director.update(game, 0), 'ordinary');
  game.player!.currentLocation = 'nightclub'; assert.equal(director.update(game, 1000), 'ordinary');
  game.player!.currentLocation = 'neo_apartment'; director.update(game, 2000);
  game.player!.currentLocation = 'nightclub'; director.update(game, 3000);
  assert.equal(director.update(game, 4999), 'ordinary');
  assert.equal(director.update(game, 5000), 'club');
  director.impact(5500); assert.equal(director.update(game, 5500), 'combat');
  assert.equal(director.update(game, 13499), 'combat');
  director.update(game, 13500); assert.equal(director.update(game, 15500), 'club');
  director.impact(16000); assert.equal(director.update(game, 16000), 'combat');
  game.player!.status = 'dead'; assert.equal(director.update(game, 16001), 'oracle');
  game.player!.status = 'alive'; assert.equal(director.update(game, 16002), 'club');
  director.impact(17000); director.update(game, 17000);
  game.player!.id = 'morpheus'; game.player!.isInMatrix = false;
  assert.equal(director.update(game, 17001), 'zion');
  game.player = undefined; assert.equal(director.update(game, 17002), 'matrix');
});

test('saved audio settings preserve zero, clamp old out-of-range values, and tolerate corrupt storage', () => {
  assert.equal(readAudioSettings('{"music":0,"effects":0}').music, 0);
  assert.deepEqual(readAudioSettings('{"music":3,"effects":-1,"musicMuted":true,"effectsMuted":"true"}'), { music: 1, effects: 0, musicMuted: true, effectsMuted: false });
  for (const raw of ['broken', 'null', '[]', null]) assert.deepEqual(readAudioSettings(raw), { music: .48, effects: .8, musicMuted: false, effectsMuted: false });
});

function audioHarness(t: TestContext, saved?: string) {
  class Param {
    value = 1;
    events: { value: number; time: number }[] = [];
    setTargetAtTime(value: number, time: number) { this.value = value; this.events.push({ value, time }); }
    setValueAtTime(value: number, time: number) { this.setTargetAtTime(value, time); }
    linearRampToValueAtTime(value: number, time: number) { this.setTargetAtTime(value, time); }
    cancelAndHoldAtTime() {}
  }
  class Node {
    connections: Node[] = [];
    connect(node: Node) { this.connections.push(node); return node; }
    disconnect() { this.connections = []; }
  }
  class Gain extends Node { gain = new Param(); }
  class Source extends Node {
    buffer?: unknown; loop = false; loopEnd = 0; starts = 0; stopAt?: number; onended?: () => void;
    start() { this.starts++; }
    stop(time = 0) { this.stopAt = time; if (!time) this.onended?.(); }
  }
  const contexts: Context[] = [];
  const legacyStorage = { reads: 0 };
  class Context {
    state = 'suspended'; currentTime = 10; destination = new Node(); gains: Gain[] = []; sources: Source[] = [];
    onstatechange?: () => void;
    recording = Object.assign(new Node(), { stream: { id: 'mixed-audio' } });
    compressor = Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() });
    constructor() { contexts.push(this); }
    createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
    createDynamicsCompressor() { return this.compressor; }
    createMediaStreamDestination() { return this.recording; }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
    async decodeAudioData() { return { duration: 90 }; }
    async resume() { this.state = 'running'; this.onstatechange?.(); }
    async close() { this.state = 'closed'; }
  }
  const window = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const storage = new Map(saved ? [['matrix:audio', saved]] : []);
  const requests: { url: string; resolve: (response: Response) => void; signal: AbortSignal }[] = [];
  const globals = { window, document, AudioContext: Context,
    indexedDB: { open: () => { legacyStorage.reads++; throw new Error('Legacy music overrides must not be read'); } },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    fetch: (url: string, options: { signal: AbortSignal }) => new Promise<Response>(resolve => requests.push({ url, resolve, signal: options.signal })) };
  const previous = Object.keys(globals).map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.assign(globalThis, globals);
  const audio = new GameAudio();
  t.after(() => {
    audio.dispose();
    Object.keys(globals).forEach((key, i) => {
      if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key);
    });
  });
  const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  const respond = async (index: number, ok = true) => { await flush(); requests[index].resolve({ ok, status: ok ? 200 : 503, arrayBuffer: async () => new ArrayBuffer(8) } as Response); await flush(); };
  return { audio, contexts, requests, window, document, storage, legacyStorage, flush, respond };
}

test('audio waits for a gesture, loops a cue once, ducks dialogue, and sends the same mix to recordings', async t => {
  const h = audioHarness(t); const game = scene(); h.audio.update(game);
  assert.equal(h.contexts.length, 0); assert.equal(h.requests.length, 0);
  h.window.dispatchEvent(new Event('pointerdown')); await h.flush(); await h.respond(0);
  const ctx = h.contexts[0]; assert.equal(ctx.sources.length, 1); assert.equal(ctx.sources[0].loopEnd, 90);
  assert.equal(h.audio.status, '正在播放');
  for (let i = 0; i < 100; i++) h.audio.update(game);
  assert.equal(ctx.sources.length, 1); assert.equal(h.requests.length, 1);
  assert.equal(ctx.gains[0].gain.events.length, 0, 'stable snapshots do not queue new volume automation');
  h.audio.dialogue(); assert.equal(ctx.gains[0].gain.value, .48 * .42);
  h.audio.setReading('dialogue', false); assert.equal(ctx.gains[0].gain.value, .48);
  game.running = false; h.audio.update(game); assert.equal(ctx.gains[0].gain.value, .48 * .3);
  assert.equal(await h.audio.recordingAudio(), ctx.recording.stream);
  assert.ok(ctx.compressor.connections.includes(ctx.recording)); assert.ok(ctx.compressor.connections.includes(ctx.destination));
  assert.equal(h.audio.effects()!.output.connections[0], ctx.gains[2]);
  assert.equal(ctx.gains[0].connections[0], ctx.gains[2], 'effects and music use one master');
});

test('music mute persists independently from effects; backgrounding silences the shared output', async t => {
  const h = audioHarness(t, '{"music":0.25,"effects":0.65,"musicMuted":true}'); h.audio.update(scene());
  await h.audio.resume(); assert.equal(h.requests.length, 0); assert.ok(h.audio.effects());
  h.audio.toggle('music'); await h.respond(0); const ctx = h.contexts[0];
  assert.equal(ctx.gains[0].gain.value, .25);
  h.audio.toggle('effects'); assert.equal(h.audio.effects(), undefined); assert.equal(ctx.gains[0].gain.value, .25);
  h.audio.setVolume('music', 0); assert.equal(ctx.gains[0].gain.value, 0);
  assert.deepEqual(readAudioSettings(h.storage.get('matrix:audio')!), { music: 0, effects: .65, musicMuted: false, effectsMuted: true });
  h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange')); assert.equal(ctx.gains[2].gain.value, 0);
  h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); assert.equal(ctx.gains[2].gain.value, .9);
});

test('late scene downloads cannot replace the current score; valid changes crossfade and retire the old source', async t => {
  const h = audioHarness(t); const game = scene(); h.audio.update(game); await h.audio.resume(); await h.respond(0);
  game.player = undefined; h.audio.update(game); assert.equal(h.requests[1].url, '/assets/music/originals/matrix_1.mp3');
  const next = scene(); h.audio.update(next); assert.equal(h.requests[1].signal.aborted, true);
  await h.respond(1); assert.equal(h.audio.cue, 'ordinary'); assert.equal(h.contexts[0].sources.length, 1);
  next.player!.id = 'morpheus'; next.player!.isInMatrix = false; h.audio.update(next); await h.respond(2);
  const ctx = h.contexts[0]; assert.equal(h.audio.cue, 'zion'); assert.equal(ctx.sources[0].stopAt, 13.05);
  assert.equal(ctx.sources[1].starts, 1); assert.equal(ctx.gains.at(-1)!.gain.events.at(-1)!.time, 13);
  h.audio.dispose(); assert.equal(ctx.state, 'closed'); assert.ok(ctx.sources.every(source => source.stopAt === 0));
});

test('a failed music request leaves the game usable and can be explicitly retried', async t => {
  const h = audioHarness(t); const game = scene(); h.audio.update(game); await h.audio.resume(); await h.respond(0, false);
  assert.match(h.audio.status, /重试/); assert.ok(h.audio.effects());
  for (let i = 0; i < 100; i++) h.audio.update(game);
  assert.equal(h.requests.length, 1, 'failed requests do not hammer the server');
  h.audio.retry(); await h.flush(); await h.respond(1); assert.equal(h.audio.status, '正在播放');
});

test('scene audition returns to the latest live scene and a hidden download resumes on foregrounding', async t => {
  const h = audioHarness(t); const game = scene(); h.audio.update(game); await h.audio.resume(); await h.respond(0);
  h.audio.audition('final'); await h.respond(1); assert.equal(h.audio.cue, 'final');
  game.player = undefined; game.matrix = false; h.audio.update(game);
  assert.equal(h.audio.cue, 'final', 'live updates cannot interrupt audition');
  h.audio.audition(); assert.equal(h.audio.previewCue, undefined);
  h.document.hidden = true; await h.respond(2);
  h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); await h.flush();
  assert.equal(h.audio.cue, 'zion', 'a hidden load cannot leave the music stuck loading');
  assert.equal(h.audio.status, '正在播放');
});

test('the default game actually loads film audio, keeps its full duration, and includes it in the recording mix', async t => {
  const h = audioHarness(t); h.audio.update(scene()); await h.audio.resume(); await h.flush();
  assert.equal(h.requests[0].url, '/assets/music/originals/matrixreloaded_2.mp3');
  await h.respond(0);
  assert.equal(h.audio.trackName, 'Niaiserie');
  const ctx = h.contexts[0];
  assert.equal(ctx.sources[0].loopEnd, 90, 'the film excerpt must not use the 72-second synthesized loop');
  assert.equal(ctx.sources[0].connections[0].connections[0], ctx.gains[0]);
  assert.equal(await h.audio.recordingAudio(), ctx.recording.stream);
  h.audio.audition('final'); await h.respond(1);
  assert.equal(h.requests[1].url, '/assets/music/originals/matrixrevolutions_6.mp3');
  assert.equal(h.audio.trackName, 'Neodämmerung');
});

test('all three films have actual audio files matching their source hashes, and every mapped cue resolves', () => {
  assert.equal(FILM_TRACKS.length, 14);
  assert.deepEqual(new Set(FILM_TRACKS.map(track => track.film)), new Set(['The Matrix', 'The Matrix Reloaded', 'The Matrix Revolutions']));
  for (const track of FILM_TRACKS) {
    const bytes = readFileSync(new URL(`../packages/client/public${track.file}`, import.meta.url));
    assert.equal(bytes.length, track.bytes, track.title);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), track.sha256, track.title);
    assert.ok(track.seconds > 45 && track.seconds < 150);
    assert.equal(new URL(track.url).hostname, 'www.dondavis.net');
  }
  const publicMusic = new URL('../packages/client/public/assets/music/', import.meta.url);
  const files = readdirSync(publicMusic, { recursive: true }).filter(file => String(file).endsWith('.mp3')).map(file => `/assets/music/${file}`).sort();
  assert.deepEqual(files, FILM_TRACKS.map(track => track.file).sort(), 'only film recordings may be shipped in the game');
  for (const [cue, track] of Object.entries(FILM_MUSIC)) {
    assert.ok(cue in MUSIC); assert.ok(FILM_TRACKS.includes(track));
  }
});

test('every game scene including the nightclub has an explicit film recording', () => {
  assert.deepEqual(Object.keys(FILM_MUSIC).sort(), Object.keys(MUSIC).sort());
  for (const track of Object.values(FILM_MUSIC)) assert.ok(FILM_TRACKS.includes(track));
});

test('missing film audio stops music and offers retry without requesting any synthesized replacement', async t => {
  const h = audioHarness(t); h.audio.update(scene()); await h.audio.resume(); await h.respond(0, false);
  assert.equal(h.requests.length, 1);
  assert.match(h.audio.status, /原声.*重试/);
  assert.ok(h.audio.effects());
  h.audio.retry(); await h.respond(1);
  assert.equal(h.requests[1].url, h.requests[0].url);
  assert.equal(h.audio.status, '正在播放');
});

test('shared daily recordings continue without restarting when moving between work, cafe and bar', async t => {
  const h = audioHarness(t); h.audio.update(scene()); await h.audio.resume(); await h.respond(0);
  for (const cue of ['office', 'cafe', 'club', 'ordinary'] as const) {
    h.audio.audition(cue); await h.flush();
    assert.equal(h.audio.cue, cue);
    assert.equal(h.audio.trackName, 'Niaiserie');
    assert.equal(h.contexts[0].sources.length, 1, cue);
    assert.equal(h.requests.length, 1, cue);
    assert.equal(h.contexts[0].sources[0].stopAt, undefined, cue);
    assert.equal(h.contexts[0].gains.at(-1)!.gain.value, MUSIC[cue].level);
  }
});

test('every scene plays only the film catalog, ignores old browser imports, and keeps originals in the recording mix', async t => {
  const h = audioHarness(t); h.audio.update(scene()); await h.audio.resume(); await h.respond(0);
  for (const cue of Object.keys(MUSIC) as MusicCue[]) {
    const requests = h.requests.length;
    h.audio.audition(cue); await h.flush();
    if (h.requests.length > requests) await h.respond(requests);
    assert.equal(h.audio.cue, cue);
    assert.equal(h.audio.trackName, FILM_MUSIC[cue].title);
    assert.match(h.audio.trackCredit, /Don Davis.*原声片段/);
    assert.equal(h.audio.status, '正在播放');
    assert.equal(h.contexts[0].sources.at(-1)!.loopEnd, 90);
    assert.equal(h.contexts[0].gains.at(-1)!.gain.value, MUSIC[cue].level);
  }
  assert.equal(h.legacyStorage.reads, 0);
  assert.ok(h.requests.every(request => FILM_TRACKS.some(track => track.file === request.url)));
  assert.ok(h.contexts[0].sources.every(source => source.connections[0].connections[0] === h.contexts[0].gains[0]));
});

test('a failed story cue fades the previous battle out instead of continuing the wrong mood', async t => {
  const h = audioHarness(t); h.audio.audition('final'); await h.audio.resume(); await h.respond(0);
  const battle = h.contexts[0].sources[0];
  h.audio.audition('oracle'); await h.respond(1, false);
  assert.equal(battle.stopAt, 10.55);
  assert.equal(h.audio.cue, 'oracle');
  assert.match(h.audio.status, /原声.*重试/);
  for (let i = 0; i < 100; i++) h.audio.update(scene());
  assert.equal(h.requests.length, 2);
  h.audio.retry(); await h.respond(2);
  assert.equal(h.audio.trackName, 'Neovision');
});

test('restaurant dialogue becomes Chateau combat, while a Bane fight preserves its own score', () => {
  const game = scene(); const player = game.player!; const life = game.sandbox!.neoLife!;
  life.chapter = NEO_CHAPTERS.findIndex(chapter => chapter.id === 'keymaker');
  player.currentLocation = 'merovingians_restaurant';
  assert.equal(musicForScene(game), 'restaurant');
  game.sandbox!.threats.push({ id: 'guard', kind: 'smith', position: { ...player.position }, matrix: true, health: 100, maxHealth: 100, target: player.id, stunUntil: 0, lastStrike: 0 });
  assert.equal(musicForScene(game), 'chateau');
  assert.equal(FILM_MUSIC[musicForScene(game)].title, 'Chateau Swashbuckling');
  life.chapter = NEO_CHAPTERS.findIndex(chapter => chapter.id === 'bane');
  player.currentLocation = 'nebuchadnezzar'; player.isInMatrix = false; game.sandbox!.threats[0].matrix = false;
  const director = new MusicDirector();
  assert.equal(director.update(game, 0), 'bane'); director.impact(100);
  assert.equal(director.update(game, 100), 'bane');
  assert.equal(FILM_MUSIC.bane.title, 'The Bane Revelation');
});

test('awakening, Mobil and Bane chapters use their own original cue rather than a generic battle score', () => {
  const game = scene(); const player = game.player!; const life = game.sandbox!.neoLife!;
  for (const [chapterId, cue] of [['contact', 'contact'], ['pill', 'awakening'], ['construct', 'awakening'], ['the_one', 'the_one'], ['mobil', 'mobil'], ['bane', 'bane']]) {
    life.chapter = NEO_CHAPTERS.findIndex(chapter => chapter.id === chapterId);
    player.currentLocation = NEO_CHAPTERS[life.chapter].location;
    assert.equal(musicForScene(game), cue, chapterId);
  }
});
