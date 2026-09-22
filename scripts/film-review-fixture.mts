// Creates an isolated visual-review save; never writes the player's data directory.
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FILM_SCENES, FILM_SETS, RESCUE, filmEntry, filmStepPosition, filmPosition, playerBlocked, NEO_CHAPTERS, MEETING_DRIVE_SECONDS, type WorldEvent } from '@auto_matrix/shared';
import { WorldState } from '../packages/server/src/world/WorldState.js';
import { AgentManager } from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem } from '../packages/server/src/player/SandboxSystem.js';
import type { WorldDynamics } from '../packages/server/src/story/WorldDynamics.js';
import { hotelRouteProgress, HOTEL_ROUTE_LENGTH, HOTEL_DOOR_PROGRESS, LAFAYETTE } from '@auto_matrix/shared';
const scene = FILM_SCENES.find(s => s.id === (process.argv[2] ?? 'm1_lobby'));
if (!scene) throw new Error('Unknown film scene');
const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-film-review-'));
const world = new WorldState(); new AgentManager(world).initializeAllAgents();
const dynamics = { record: (event: Omit<WorldEvent, 'id'>) => world.addWorldEvent(event) } as WorldDynamics;
const sandbox = new SandboxSystem(world, dynamics, 42); const neo = world.agents.get('neo')!;
sandbox.enter(neo); sandbox.life.begin(neo, 0); const actor = world.agents.get(scene.actor)!; sandbox.enter(actor);
actor.position = filmEntry(scene); actor.currentLocation = scene.set; actor.isInMatrix = FILM_SETS[scene.set].world === 'matrix'; actor.rotation = Math.PI;
sandbox.state.profiles[actor.id].trackedMission = ''; sandbox.state.neoLife!.chapter = NEO_CHAPTERS.findIndex(c => c.id === scene.chapter);
sandbox.state.neoLife!.journey = { version: 1, scene: scene.id, step: 0, actor: actor.id, completed: FILM_SCENES.slice(0, FILM_SCENES.indexOf(scene)).map(s => s.id), enteredAt: 0, reflections: {}, lastText: '独立验收存档：此前场景可回访，玩家原存档不受影响。', checkpoint: { ...actor.position } };
const previous = FILM_SCENES[FILM_SCENES.indexOf(scene) - 1];
sandbox.life.film.handoff = (from, id) => { delete from.controller; world.agents.get(id)!.controller = 'player'; return true; };
if (previous) {
  Object.assign(sandbox.state.neoLife!.journey, { scene: previous.id, actor: previous.actor, step: previous.steps.length });
  if (previous.id === 'm1_bug') sandbox.state.neoLife!.journey!.meeting = { phase: 'outside', elapsed: 0, bugged: false, approach: { x: 4, z: -12.35, yaw: Math.PI } };
  if (scene.id === 'm1_ledge') actor.position = filmStepPosition(previous, previous.steps[2]);
  sandbox.life.film.command(world.agents.get(previous.actor)!, 'next', 0);
  if (scene.id === 'm1_ledge') for (let frame = 0; frame < 65; frame++) sandbox.life.film.crossingFrame(actor, .1, 0);
} else {
  delete sandbox.state.neoLife!.journey; sandbox.life.film.command(neo, 'start', 0);
}
if (sandbox.state.neoLife!.journey?.scene !== scene.id) throw new Error(`Review fixture did not enter ${scene.id}`);
if (process.argv[3] === 'near') {
  actor.position = filmStepPosition(scene, scene.steps[0]); actor.position.z += 2.5;
  if (playerBlocked(actor.position, actor.isInMatrix)) actor.position = filmStepPosition(scene, scene.steps[0]);
  sandbox.state.neoLife!.journey!.checkpoint = { ...actor.position };
}
if (scene.id === 'm1_club' && ['club-meeting', 'club-whisper'].includes(process.argv[3])) {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]); actor.rotation = Math.PI;
  sandbox.life.film.tick(0);
  for (let frame = 0; frame < 81; frame++) sandbox.life.film.clubFrame(actor, .1, 0);
  if (process.argv[3] === 'club-whisper') {
    sandbox.life.film.command(actor, 'act', 0);
    for (let frame = 0; frame < 61; frame++) sandbox.life.film.clubFrame(actor, .1, 0);
    sandbox.life.film.command(actor, 'act', 0);
    for (let frame = 0; frame < 20; frame++) sandbox.life.film.clubFrame(actor, .1, 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (scene.id === 'm1_wake_up' && ['contact-door', 'contact-book', 'contact-trade', 'contact-rabbit'].includes(process.argv[3])) {
  actor.controller = 'player';
  const act = () => { actor.position = filmStepPosition(scene, scene.steps[sandbox.life.film.state!.step]); sandbox.life.film.command(actor, 'act', 0); };
  const frames = (count: number) => { for (let i = 0; i < count; i++) sandbox.life.film.apartmentFrame(actor, .1, 0); };
  act(); frames(81); act(); frames(41);
  if (process.argv[3] !== 'contact-door') { act(); frames(25); }
  if (['contact-trade', 'contact-rabbit'].includes(process.argv[3])) { act(); frames(33); }
  if (process.argv[3] === 'contact-rabbit') { act(); frames(66); }
  actor.position = filmStepPosition(scene, scene.steps[sandbox.life.film.state!.step]); actor.rotation = 0;
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (process.argv[3] === 'pills' && scene.id === 'm1_pills') {
  actor.position = filmStepPosition(scene, scene.steps[0]);
  sandbox.state.neoLife!.journey!.checkpoint = { ...actor.position };
}
if (['hotel', 'hotel-upper', 'knock', 'welcome'].includes(process.argv[3]) && scene.id === 'm1_pills') {
  const arrival = FILM_SCENES.find(s => s.id === 'm1_bug')!; const journey = sandbox.state.neoLife!.journey!;
  Object.assign(journey, { scene: arrival.id, step: 2, meeting: { phase: 'outside', elapsed: 8, bugged: false, approach: { x: 4, z: -12.35, yaw: Math.PI } } });
  actor.controller = 'player'; actor.position = filmStepPosition(arrival, arrival.steps[2]); actor.currentLocation = arrival.set;
  sandbox.life.film.command(actor, 'act', 0);
  if (process.argv[3] === 'hotel-upper') {
    const local = { x: 43, y: 80.5, z: -4 };
    actor.position = { ...filmPosition(scene.set, local.x, local.z), y: FILM_SETS[scene.set].center.y - LAFAYETTE.upper + local.y }; actor.rotation = 0;
    journey.hotel!.progress = hotelRouteProgress(local) + 5;
  }
  if (process.argv[3] === 'knock') {
    actor.position = filmPosition(scene.set, 22.5, 0); actor.rotation = -Math.PI / 2;
    journey.hotel!.progress = HOTEL_DOOR_PROGRESS; journey.checkpoint = { ...actor.position };
  }
  if (process.argv[3] === 'welcome') {
    actor.position = filmPosition(scene.set, 18, 0); actor.rotation = -Math.PI / 2;
    Object.assign(journey.hotel!, { progress: HOTEL_ROUTE_LENGTH, door: LAFAYETTE.doorSeconds, entered: true, welcome: { phase: 'approach', elapsed: 0 } });
    journey.checkpoint = { ...actor.position };
  }
  sandbox.life.film.hotelFrame(actor, 0, 0);
}
if (process.argv[3] === 'interrogation' && scene.id === 'm1_interrogation') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]);
  sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < 61; frame++) sandbox.life.film.interrogationFrame(actor, .1, 0);
  sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < 85; frame++) sandbox.life.film.interrogationFrame(actor, .1, 0);
}
if (scene.id === 'm1_wake_again' && ['wake-ringing', 'wake-listening', 'wake-decision'].includes(process.argv[3])) {
  actor.controller = 'player';
  for (let frame = 0; frame < 57; frame++) sandbox.life.film.apartmentFrame(actor, .1, 0);
  if (process.argv[3] !== 'wake-ringing') {
    actor.position = filmStepPosition(scene, scene.steps[0]); actor.rotation = Math.PI;
    sandbox.life.film.command(actor, 'act', 0);
    const frames = process.argv[3] === 'wake-listening' ? 45 : 110;
    for (let frame = 0; frame < frames; frame++) sandbox.life.film.apartmentFrame(actor, .1, 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['meeting', 'meeting-clear', 'meeting-scan', 'meeting-drive', 'meeting-driving', 'meeting-arrival'].includes(process.argv[3]) && scene.id === 'm1_bridge') {
  const journey = sandbox.state.neoLife!.journey!;
  journey.office = { alert: 0, suspicion: [], waypoints: [], lastTick: 0, guide: '', outcome: process.argv[3] === 'meeting-clear' ? 'escaped' : 'captured', bugged: process.argv[3] !== 'meeting-clear' };
  actor.position = filmStepPosition(scene, scene.steps[0]); actor.position.z += 3.2; actor.rotation = Math.PI;
  journey.checkpoint = { ...actor.position };
  if (['meeting-scan', 'meeting-drive', 'meeting-driving', 'meeting-arrival'].includes(process.argv[3])) {
    actor.controller = 'player'; sandbox.life.film.tick(0); sandbox.life.film.command(actor, 'act', 0);
    for (let frame = 0; frame < 81; frame++) sandbox.life.film.meetingFrame(actor, false, .1, 0);
    sandbox.life.film.command(actor, 'meeting:stay', 0);
    for (let frame = 0; frame < 81; frame++) sandbox.life.film.meetingFrame(actor, false, .1, 0);
    for (let frame = 0; frame < 24; frame++) sandbox.life.film.meetingFrame(actor, true, .1, 0);
    if (['meeting-drive', 'meeting-driving', 'meeting-arrival'].includes(process.argv[3])) {
      for (let frame = 0; frame < 140; frame++) sandbox.life.film.meetingFrame(actor, true, .1, 0);
      sandbox.life.film.command(actor, 'reflect:trust', 0);
      if (['meeting-driving', 'meeting-arrival'].includes(process.argv[3])) {
        sandbox.life.film.command(actor, 'act', 0);
        const seconds = process.argv[3] === 'meeting-driving' ? 20 : MEETING_DRIVE_SECONDS - 5;
        for (let frame = 0; frame < Math.ceil(seconds * 10); frame++) sandbox.life.film.meetingFrame(actor, false, .1, 0);
      }
    }
  }
}
if (['workday', 'delivery', 'signature', 'phone'].includes(process.argv[3]) && scene.id === 'm1_boss') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]);
  actor.rotation = -Math.PI / 2;
  if (process.argv[3] !== 'workday') {
    sandbox.life.film.command(actor, 'act', 0);
    for (let frame = 0; frame < 91; frame++) sandbox.life.film.workdayFrame(actor, .1, 0);
    sandbox.life.film.command(actor, 'act', 0); actor.position = filmStepPosition(scene, scene.steps[1]);
    sandbox.life.film.command(actor, 'act', 0);
    if (process.argv[3] !== 'delivery') {
      for (let frame = 0; frame < 111; frame++) sandbox.life.film.workdayFrame(actor, .1, 0);
      if (process.argv[3] === 'phone') {
        sandbox.life.film.command(actor, 'act', 0);
        for (let frame = 0; frame < 41; frame++) sandbox.life.film.workdayFrame(actor, .1, 0);
      }
    }
  }
  sandbox.state.neoLife!.journey!.checkpoint = { ...actor.position };
}
if (process.argv[3] === 'pursuit' && scene.id === 'm1_office_escape') {
  actor.position = filmPosition(scene.set, -16, -5.2);
  const journey = sandbox.state.neoLife!.journey!;
  journey.checkpoint = { ...actor.position }; journey.office!.searchAt = 0;
  journey.phone = { phase: 'connected', elapsed: 11 };
  const guard = sandbox.state.threats.find(threat => threat.id === 'office:0')!;
  guard.position = filmPosition(scene.set, -16, -12.5); guard.yaw = 0;
}
if (['window', 'crossing'].includes(process.argv[3]) && scene.id === 'm1_office_escape') {
  actor.controller = 'player';
  for (let step = 0; step < 2; step++) { actor.position = filmStepPosition(scene, scene.steps[step]); sandbox.life.film.tick(step); }
  actor.position = filmStepPosition(scene, scene.steps[2]); actor.rotation = -Math.PI / 2;
  const journey = sandbox.state.neoLife!.journey!;
  journey.checkpoint = { ...actor.position }; journey.phone = { phase: 'connected', elapsed: 11 };
  if (process.argv[3] === 'crossing') {
    sandbox.life.film.command(actor, 'act', 2);
    for (let frame = 0; frame < 40; frame++) sandbox.life.film.windowFrame(actor, .1, 2);
  }
}
if (process.argv[3] === 'ladder' && scene.id === 'm1_ledge') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]);
  sandbox.life.film.tick(0); sandbox.life.film.command(actor, 'escape:climb', 0);
  for (let frame = 0; frame < 80; frame++) sandbox.life.film.climbFrame(actor, 1, .05, 0);
}
if (process.argv[3] === 'spoon' && scene.id === 'm1_spoon') {
  actor.position = filmStepPosition(scene, scene.steps[0]);
  sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < 60; frame++) sandbox.life.film.oracleFrame(actor, true, .1, 0);
}
if (['oracle-exam', 'oracle-cookie', 'oracle-question'].includes(process.argv[3]) && scene.id === 'm1_oracle') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]);
  sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < 46; frame++) sandbox.life.film.oracleFrame(actor, false, .1, 0);
  actor.position = filmStepPosition(scene, scene.steps[1]); sandbox.life.film.command(actor, 'act', 0);
  const frames = process.argv[3] === 'oracle-exam' ? 0 : process.argv[3] === 'oracle-cookie' ? 88 : 110;
  for (let frame = 0; frame < frames; frame++) sandbox.life.film.oracleFrame(actor, false, .1, 0);
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['bathroom-hold', 'bathroom-crash'].includes(process.argv[3]) && scene.id === 'm1_bathroom') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]); actor.rotation = Math.PI;
  sandbox.life.film.command(actor, 'act', 0);
  const holdFrames = process.argv[3] === 'bathroom-hold' ? 70 : 125;
  for (let frame = 0; frame < holdFrames; frame++) sandbox.life.film.betrayalFrame(actor, .1, 0);
  if (process.argv[3] === 'bathroom-crash') {
    const smith = sandbox.state.threats.find(threat => threat.scene === scene.id && threat.character === 'smith');
    if (!smith) throw new Error('Bathroom review fixture has no Smith threat');
    for (let hit = 0; hit < 3; hit++) sandbox.life.film.bathroomHit(actor, smith);
    sandbox.life.film.betrayalFrame(actor, .1, 0); sandbox.life.film.command(actor, 'act', 0);
    for (let frame = 0; frame < 32; frame++) sandbox.life.film.betrayalFrame(actor, .1, 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['unplug-window', 'unplug-counter', 'unplug-reconnect'].includes(process.argv[3]) && scene.id === 'm1_unplugged') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]); actor.rotation = 0;
  sandbox.life.film.tick(0); actor.position = filmStepPosition(scene, scene.steps[1]); sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < 92 && sandbox.life.film.state!.betrayal?.phase !== 'window'; frame++) sandbox.life.film.betrayalFrame(actor, .1, 0);
  if (process.argv[3] !== 'unplug-window') {
    sandbox.life.film.command(actor, 'act', 0);
    const frames = process.argv[3] === 'unplug-counter' ? 23 : 56;
    for (let frame = 0; frame < frames; frame++) sandbox.life.film.betrayalFrame(actor, .1, 0);
    if (process.argv[3] === 'unplug-reconnect') sandbox.life.film.command(actor, 'act', 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (process.argv[3] === 'rescue-briefing' && scene.id === 'm1_rescue_decision') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]);
  sandbox.life.film.command(actor, 'reflect:care', 0); actor.position = filmStepPosition(scene, scene.steps[1]);
  sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < 24; frame++) sandbox.life.film.rescueFrame(actor, .1, 0);
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['racks-arriving', 'racks-selecting', 'equip-compact'].includes(process.argv[3]) && scene.id === 'm1_guns') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]); sandbox.life.film.command(actor, 'act', 0);
  const frames = process.argv[3] === 'racks-arriving' ? 24 : 50;
  for (let frame = 0; frame < frames; frame++) sandbox.life.film.rescueFrame(actor, .1, 0);
  if (process.argv[3] === 'equip-compact') {
    const root = RESCUE.loadoutRoots.compact; actor.position = filmPosition(scene.set, root.x, root.z);
    sandbox.life.film.command(actor, 'act', 0);
    for (let frame = 0; frame < 30; frame++) sandbox.life.film.rescueFrame(actor, .1, 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
for (const resident of world.agents.values()) delete resident.controller;
neo.isAwakened = FILM_SCENES.indexOf(scene) >= FILM_SCENES.findIndex(s => s.id === 'm1_pod');
await writeFile(path.join(directory, 'world.json'), JSON.stringify({ version: 1, tick: 0, timeOfDay: 12000, day: 1, phase: 'phase1_normal_life', agents: Object.fromEntries(world.agents), events: [], relationships: [], sandbox: sandbox.state }));
console.log(directory);
