import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { SERAPH_DOOR_ROLES, seraphDoorSet, seraphDoorAnchor, seraphDoorStance, filmPosition, type ServerMessage, type WorldStateFull, type WorldStateDelta, type SeraphDoorEncounter, type SeraphDoorGesture } from '@auto_matrix/shared';

async function server(t: test.TestContext, phase: 'following' | 'unlocking' | 'opening') {
  const root = fileURLToPath(new URL('../', import.meta.url)), directory = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/film-review-fixture.mts', 'm2_oracle_message'], { cwd: root, encoding: 'utf8' }).trim();
  const file = path.join(directory, 'world.json'), checkpoint = JSON.parse(await readFile(file, 'utf8')), place = phase === 'following' ? 'm2_backdoors' : 'm2_seraph', set = seraphDoorSet(place), anchor = seraphDoorAnchor(place), j = checkpoint.sandbox.neoLife.journey;
  const state: SeraphDoorEncounter = { scene: place, phase, elapsed: .35, door: phase === 'opening' ? .4 : 0, neo: { ...anchor,yaw: Math.PI }, seraph: phase === 'following' ? { x: 2.5,z: 12,yaw: Math.PI } : seraphDoorStance(place,phase === 'opening' ? .4 : 0), route: phase === 'following' ? [{ x: 2.5,z: -29 }] : [], cursor: 0 };
  if (phase === 'following') state.neo = { x: 0,z: 18,yaw: Math.PI };
  j.scene = place; j.actor = 'neo'; j.step = phase === 'following' ? 0 : 1; j.seraphDoor = state; delete j.started; checkpoint.simulation = { running: false,speed: 1 };
  for (const [index,role] of SERAPH_DOOR_ROLES.entries()) {
    const actor = checkpoint.agents[role], point = state[role];
    Object.assign(actor,{ position: filmPosition(set,point.x,point.z), rotation: point.yaw, currentLocation: set, isInMatrix: true, health: 76-index*11, velocity: role === 'seraph' && phase !== 'unlocking' ? { x: -.9,y: 0,z: -1.3 } : { x: 0,y: 0,z: 0 }, targetPosition: null,currentPath: [] });
    actor.currentAction = phase === 'following' && role === 'neo' ? null : { type: role === 'seraph' && phase !== 'unlocking' ? 'move_to' : 'idle', parameters: { player: role === 'neo', resolved: true, seraphDoor: { scene: state.scene,phase: state.phase,elapsed: state.elapsed,door: state.door,seraph: { ...state.seraph },role } },startedAt: j.enteredAt,duration: 1e9,progress: 0 };
  }
  j.checkpoint = { ...checkpoint.agents.neo.position }; await writeFile(file, JSON.stringify(checkpoint));
  const expected = structuredClone(checkpoint), child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/server-startup.mts', 'normal'], {
    cwd: root, env: { ...process.env, MATRIX_DATA_DIR: directory, MATRIX_CLOUD_SAVE: '', HOST: '127.0.0.1', PORT: '0', TICK_RATE_MS: '10000', STATE_SYNC_INTERVAL: '1', LLM_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', socket: ReturnType<typeof io> | undefined; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; }); const finished = new Promise(resolve => child.once('close', resolve));
  t.after(async () => { socket?.disconnect(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000);
    try { await finished; } finally { clearTimeout(timer); await rm(directory, { recursive: true, force: true }); }
  });
  const wait = async (ready: () => boolean, label: string) => { const end = Date.now() + 15000; while (!ready()) { assert(child.exitCode === null && child.signalCode === null && Date.now() < end, label + ': ' + output.slice(-1500)); await new Promise(resolve => setTimeout(resolve, 20)); } };
  await wait(() => output.includes('STARTUP_LISTENING'), 'startup'); const address = JSON.parse(output.match(/STARTUP_LISTENING (\{[^\n]+\})/)![1]), url = `http://127.0.0.1:${address.port}`;
  const world = async () => await (await fetch(url + '/api/world')).json() as WorldStateFull;
  const connect = async () => { socket = io(url, { autoConnect: false, transports: ['websocket'] }); const messages: ServerMessage[] = []; socket.on('message', message => messages.push(message)); socket.connect(); await wait(() => messages.some(message => message.type === 'world_state_full'), 'initial state'); socket.emit('message', { type: 'play_as', data: { agentId: 'neo' } }); await wait(() => messages.some(message => message.type === 'player_state' && (message.data as { agentId?: string }).agentId === 'neo'), 'possession'); return { socket, messages }; };
  return { world, connect, expected, wait };
}

for (const phase of ['following','unlocking','opening'] as const) test(`cold ${phase} keeps both exact poses, wounds, key and door progress through possession`, { timeout: 25000 }, async t => {
  const h = await server(t,phase), check = (w: WorldStateFull) => {
    assert.equal(w.simulation!.running,false); assert.deepEqual(w.sandbox!.neoLife!.journey!.seraphDoor,h.expected.sandbox.neoLife.journey.seraphDoor);
    for (const role of SERAPH_DOOR_ROLES) for (const key of ['position','rotation','velocity','health','currentAction'] as const) assert.deepEqual(w.agents[role][key],h.expected.agents[role][key],role+'/'+key);
  };
  check(await h.world()); const { socket } = await h.connect(); check(await h.world()); socket.disconnect();
  const end = Date.now()+5000; while((await h.world()).agents.neo.controller) { assert(Date.now()<end);await new Promise(resolve=>setTimeout(resolve,20)); } check(await h.world());
});

test('fast packets keep the physical door, Neo and Seraph on the same saved clock between world ticks', { timeout: 25000 }, async t => {
  const h = await server(t,'unlocking'), { socket,messages } = await h.connect(); messages.length = 0; socket.emit('message',{type:'resume'});
  await h.wait(()=>messages.filter(m=>m.type==='world_state_delta'&&(m.data as WorldStateDelta).sandbox?.neoLife?.journey?.seraphDoor?.elapsed > .35).length>=6,'fast door packets');
  for (const packet of messages.filter(m=>m.type==='world_state_delta').map(m=>m.data as WorldStateDelta).filter(p=>(p.sandbox?.neoLife?.journey?.seraphDoor?.elapsed ?? 0)>.35)) {
    const state=packet.sandbox!.neoLife!.journey!.seraphDoor!;
    for (const role of SERAPH_DOOR_ROLES) { const gesture=packet.agents[role]?.currentAction?.parameters.seraphDoor as SeraphDoorGesture|undefined; assert.equal(gesture?.phase,state.phase);assert.equal(gesture?.elapsed,state.elapsed);assert.equal(gesture?.door,state.door);assert.deepEqual(gesture?.seraph,state.seraph); }
  }
});
