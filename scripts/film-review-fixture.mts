import { newReloaded, newFarewell, BURLY, EXILES, CHATEAU, MOUNTAIN, TRUCKS, HEL_COATCHECK } from '@auto_matrix/shared';
// Creates an isolated visual-review save; never writes the player's data directory.
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FILM_SCENES, FILM_SETS, RESCUE, GOVERNMENT_RESCUE, AIR_RESCUE, MIRROR_TOUCH, PILL_ROOM, filmEntry, filmStepPosition, filmPosition, playerBlocked, NEO_CHAPTERS, MEETING_DRIVE_SECONDS, type MatrixEscapeEncounter, type TheOneEncounter, type WorldEvent } from '@auto_matrix/shared';
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
const clearWake = scene.id === 'm1_wake_again' && process.argv[3] === 'wake-clear-ringing';
const previous = clearWake ? FILM_SCENES.find(s => s.id === 'm1_ledge')! : FILM_SCENES[FILM_SCENES.indexOf(scene) - 1];
sandbox.life.film.handoff = (from, id) => { delete from.controller; world.agents.get(id)!.controller = 'player'; return true; };
if (previous) {
  if (clearWake) sandbox.state.neoLife!.journey!.completed = sandbox.state.neoLife!.journey!.completed.filter(id => id !== 'm1_interrogation');
  Object.assign(sandbox.state.neoLife!.journey, { scene: previous.id, actor: previous.actor, step: previous.steps.length });
  if (['m2_backdoors', 'm2_bench'].includes(scene.id)) {
    actor.position = filmStepPosition(previous, previous.steps.at(-1)!);
    actor.currentLocation = previous.set;
  }
  if (previous.id === 'm1_bug') sandbox.state.neoLife!.journey!.meeting = { phase: 'outside', elapsed: 0, bugged: false, approach: { x: 4, z: -12.35, yaw: Math.PI } };
  if (scene.id === 'm1_wake_again') sandbox.state.neoLife!.journey!.office = { alert: 0, suspicion: [], waypoints: [], lastTick: 0,
    guide: '', outcome: clearWake ? 'escaped' : 'captured', bugged: !clearWake };
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
if (scene.id === 'm3_hammer_tunnels' && process.argv[3] === 'hammer-drive') {
  const journey = sandbox.life.film.state!;
  journey.step = 2; actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[2]);
  journey.checkpoint = { ...actor.position }; sandbox.life.film.command(actor, 'act', 0);
}
if (scene.id === 'm3_gate' && process.argv[3] === 'apu-drive') {
  const journey = sandbox.life.film.state!;
  journey.step = 1; actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[1]);
  journey.checkpoint = { ...actor.position }; sandbox.life.film.command(actor, 'act', 0);
}
if (scene.id === 'm3_emp' && process.argv[3] === 'emp-fired') {
  const journey = sandbox.life.film.state!;
  journey.step = 1; journey.emp = { firedAt: 0 };
  actor.position = filmStepPosition(scene, scene.steps[1]); journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm3_temple_defense' && process.argv[3] === 'temple-latches') {
  const journey = sandbox.life.film.state!;
  journey.step = 1; actor.position = filmStepPosition(scene, scene.steps[1]);
  journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm1_mirror' && ['mirror-wired', 'mirror-silver'].includes(process.argv[3])) {
  const journey = sandbox.life.film.state!;
  journey.awakening = { kind: 'mirror', elapsed: process.argv[3] === 'mirror-wired' ? 2.75 : 4.8, started: false,
    approach: { x: MIRROR_TOUCH.x, z: MIRROR_TOUCH.z } };
  actor.controller = 'player'; sandbox.life.film.awakeningFrame(actor, 0, 0);
  journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm1_mirror' && process.argv[3] === 'mirror-escort') {
  const journey = sandbox.life.film.state!;
  sandbox.state.neoLife!.choices.pill = 'red';
  journey.mirrorGuide = { progress: 0, lastTick: 0, done: false, rise: 0 };
  actor.position = filmPosition(scene.set, PILL_ROOM.exit.x, PILL_ROOM.exit.z);
  actor.rotation = Math.atan2(PILL_ROOM.trackingDoor.x - PILL_ROOM.exit.x, PILL_ROOM.trackingDoor.z - PILL_ROOM.exit.z);
  journey.checkpoint = { ...actor.position };
  sandbox.life.film.reconcileCast();
}
if (process.argv[3] === 'collision' && scene.id === 'm2_trucks') {
  const journey = sandbox.life.film.state!;
  journey.step = 2; journey.trucks = { phase: 'collision', elapsed: 5, lastTick: 0, attempt: 0 };
  actor.position = { ...filmPosition(scene.set, TRUCKS.roof.x, 29.5), y: FILM_SETS[scene.set].center.y + TRUCKS.roof.height };
  journey.checkpoint = { ...actor.position };
}
if (process.argv[3] === 'seraph-door' && scene.id === 'm2_seraph' || process.argv[3] === 'hall-door' && scene.id === 'm2_backdoors') {
  const journey = sandbox.life.film.state!; journey.step = scene.steps.length; journey.completed.push(scene.id);
  actor.position = filmStepPosition(scene, scene.steps.at(-1)!); journey.checkpoint = { ...actor.position };
}
if (process.argv[3] === 'oracle-note' && scene.id === 'm2_bench') {
  const journey = sandbox.life.film.state!; journey.step = 3;
  actor.position = filmStepPosition(scene, scene.steps[3]); journey.checkpoint = { ...actor.position };
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
if (scene.id === 'm1_wake_again' && ['wake-ringing', 'wake-clear-ringing', 'wake-listening', 'wake-decision'].includes(process.argv[3])) {
  actor.controller = 'player';
  for (let frame = 0; frame < 57; frame++) sandbox.life.film.apartmentFrame(actor, .1, 0);
  if (!['wake-ringing', 'wake-clear-ringing'].includes(process.argv[3])) {
    actor.position = filmStepPosition(scene, scene.steps[0]); actor.rotation = Math.PI;
    sandbox.life.film.command(actor, 'act', 0);
    const frames = process.argv[3] === 'wake-listening' ? 45 : 110;
    for (let frame = 0; frame < frames; frame++) sandbox.life.film.apartmentFrame(actor, .1, 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['meeting', 'meeting-clear', 'meeting-roll', 'meeting-stop', 'meeting-scan', 'meeting-drive', 'meeting-driving', 'meeting-arrival'].includes(process.argv[3]) && scene.id === 'm1_bridge') {
  const journey = sandbox.state.neoLife!.journey!;
  journey.office = { alert: 0, suspicion: [], waypoints: [], lastTick: 0, guide: '', outcome: process.argv[3] === 'meeting-clear' ? 'escaped' : 'captured', bugged: process.argv[3] !== 'meeting-clear' };
  actor.position = filmStepPosition(scene, scene.steps[0]); actor.position.z += 3.2; actor.rotation = Math.PI;
  journey.checkpoint = { ...actor.position };
  if (['meeting-roll', 'meeting-stop', 'meeting-scan', 'meeting-drive', 'meeting-driving', 'meeting-arrival'].includes(process.argv[3])) {
    actor.controller = 'player'; sandbox.life.film.tick(0);
    for (let frame = 0; frame < 71; frame++) sandbox.life.film.bridgeArrivalFrame(actor, .1, 0);
    sandbox.life.film.command(actor, 'act', 0);
    const boardingFrames = process.argv[3] === 'meeting-roll' ? 110 : 151;
    for (let frame = 0; frame < boardingFrames; frame++) sandbox.life.film.meetingFrame(actor, false, .1, 0);
    if (!['meeting-roll', 'meeting-stop'].includes(process.argv[3])) {
      sandbox.life.film.command(actor, 'meeting:stay', 0);
      for (let frame = 0; frame < 81; frame++) sandbox.life.film.meetingFrame(actor, false, .1, 0);
      for (let frame = 0; frame < 24; frame++) sandbox.life.film.meetingFrame(actor, true, .1, 0);
    }
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
if (['lobby-checkpoint', 'lobby-combat'].includes(process.argv[3]) && scene.id === 'm1_lobby') {
  const journey = sandbox.life.film.state!; actor.controller = 'player'; journey.step = 1;
  actor.position = filmStepPosition(scene, scene.steps[1]); actor.rotation = Math.PI; journey.checkpoint = { ...actor.position };
  sandbox.life.film.command(actor, 'act', 0);
  const frames = process.argv[3] === 'lobby-checkpoint' ? 38 : 72;
  for (let frame = 0; frame < frames; frame++) sandbox.life.film.lobby.frame(actor, .1, 0);
  journey.checkpoint = { ...actor.position };
}
if (['question-ready', 'question-monologue', 'question-alarm'].includes(process.argv[3]) && scene.id === 'm1_smith_question') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]); actor.rotation = Math.PI;
  sandbox.life.film.governmentFrame(actor, false, 0, 0);
  if (process.argv[3] !== 'question-ready') {
    sandbox.life.film.command(actor, 'reflect:care', 0);
    const frames = process.argv[3] === 'question-monologue' ? 74 : Math.ceil(GOVERNMENT_RESCUE.questioning.monologue * 10) + 1;
    for (let frame = 0; frame < frames; frame++) sandbox.life.film.governmentFrame(actor, true, .1, 0);
    if (process.argv[3] === 'question-alarm') {
      actor.position = filmStepPosition(scene, scene.steps[1]); sandbox.life.film.command(actor, 'act', 0);
      for (let frame = 0; frame < 28; frame++) sandbox.life.film.governmentFrame(actor, false, .1, 0);
    }
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['roof-ready', 'roof-bullet', 'roof-trinity', 'roof-download'].includes(process.argv[3]) && scene.id === 'm1_bullet_dodge') {
  actor.controller = 'player'; actor.position = filmStepPosition(scene, scene.steps[0]); actor.rotation = Math.PI;
  sandbox.life.film.governmentFrame(actor, false, 0, 0);
  if (process.argv[3] !== 'roof-ready') {
    sandbox.life.film.command(actor, 'act', 0);
    for (let frame = 0; frame < Math.ceil(GOVERNMENT_RESCUE.rooftop.opening * 10) + 1; frame++) sandbox.life.film.governmentFrame(actor, false, .1, 0);
    if (process.argv[3] === 'roof-bullet') {
      for (let frame = 0; frame < 8; frame++) sandbox.life.film.governmentFrame(actor, false, .1, 0);
    } else {
      for (const beat of GOVERNMENT_RESCUE.rooftop.beats) {
        while (sandbox.life.film.state!.government!.phase === 'bullet_time' && sandbox.life.film.state!.government!.elapsed < beat) sandbox.life.film.governmentFrame(actor, false, .1, 0);
        sandbox.life.film.governmentDodge(actor, 0);
      }
      while (sandbox.life.film.state!.government!.phase === 'bullet_time') sandbox.life.film.governmentFrame(actor, false, .1, 0);
      const frames = process.argv[3] === 'roof-trinity' ? 21 : Math.ceil(GOVERNMENT_RESCUE.rooftop.trinity * 10) + 1;
      for (let frame = 0; frame < frames; frame++) sandbox.life.film.governmentFrame(actor, false, .1, 0);
      if (process.argv[3] === 'roof-download') {
        actor.position = filmStepPosition(scene, scene.steps[1]); sandbox.life.film.command(actor, 'act', 0);
        for (let frame = 0; frame < 22; frame++) sandbox.life.film.governmentFrame(actor, false, .1, 0);
      }
    }
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['office-fire', 'office-catch'].includes(process.argv[3]) && scene.id === 'm1_helicopter') {
  actor.controller = 'player'; sandbox.life.film.airRescueFrame(actor, false, 0, 0); sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < Math.ceil(AIR_RESCUE.office.approach * 10) + 1; frame++) sandbox.life.film.airRescueFrame(actor, true, .1, 0);
  const fireFrames = process.argv[3] === 'office-fire' ? 24 : Math.ceil(AIR_RESCUE.office.fire * 10) + 1;
  for (let frame = 0; frame < fireFrames; frame++) sandbox.life.film.airRescueFrame(actor, true, .1, 0);
  if (process.argv[3] === 'office-catch') {
    while (sandbox.life.film.state!.airRescue!.elapsed < AIR_RESCUE.office.leapAt) sandbox.life.film.airRescueFrame(actor, true, .1, 0);
    sandbox.life.film.airRescueBrace(actor, 0);
    for (let frame = 0; frame < 10; frame++) sandbox.life.film.airRescueFrame(actor, true, .1, 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['rope-brace', 'rope-crash', 'rope-pull'].includes(process.argv[3]) && scene.id === 'm1_rooftop_rescue') {
  actor.controller = 'player'; sandbox.life.film.airRescueFrame(actor, false, 0, 0); sandbox.life.film.command(actor, 'act', 0);
  for (let frame = 0; frame < Math.ceil(AIR_RESCUE.roof.impact * 10) + 1; frame++) sandbox.life.film.airRescueFrame(actor, true, .1, 0);
  const target = process.argv[3] === 'rope-brace' ? AIR_RESCUE.roof.beats[1] : AIR_RESCUE.roof.duration;
  for (const beat of AIR_RESCUE.roof.beats) {
    while (sandbox.life.film.state!.airRescue!.phase === 'bracing' && sandbox.life.film.state!.airRescue!.elapsed < Math.min(beat, target)) sandbox.life.film.airRescueFrame(actor, true, .1, 0);
    if (beat <= target && sandbox.life.film.state!.airRescue!.phase === 'bracing') sandbox.life.film.airRescueBrace(actor, 0);
    if (beat >= target) break;
  }
  while (process.argv[3] !== 'rope-brace' && sandbox.life.film.state!.airRescue!.phase === 'bracing') sandbox.life.film.airRescueFrame(actor, true, .1, 0);
  if (process.argv[3] !== 'rope-brace') {
    const frames = process.argv[3] === 'rope-crash' ? 34 : 49;
    for (let frame = 0; frame < frames; frame++) sandbox.life.film.airRescueFrame(actor, true, .1, 0);
  }
  sandbox.life.film.state!.checkpoint = { ...actor.position };
}
if (['subway-duel', 'subway-train', 'subway-swap'].includes(process.argv[3]) && scene.id === 'm1_subway') {
  const journey = sandbox.life.film.state!; actor.controller = 'player';
  journey.step = process.argv[3] === 'subway-duel' ? 0 : 1;
  journey.matrixEscape = { kind: 'subway', phase: process.argv[3] === 'subway-duel' ? 'duel' : process.argv[3] === 'subway-train' ? 'train_window' : 'body_swap',
    elapsed: process.argv[3] === 'subway-train' ? 2.45 : process.argv[3] === 'subway-swap' ? 1.35 : 0, attempt: 0,
    checkpoint: process.argv[3] === 'subway-duel' ? 'duel' : 'tracks', hits: process.argv[3] === 'subway-duel' ? 2 : 4,
    dodges: 1, pursuit: 0, segment: journey.step, possessions: process.argv[3] === 'subway-swap' ? 1 : 0, resolved: [],
    phoneBroken: true, wallBroken: process.argv[3] !== 'subway-duel', host: process.argv[3] === 'subway-swap' ? 'citizen_13' : undefined } as MatrixEscapeEncounter;
  sandbox.life.film.matrixEscapeFrame(actor, { movement: 0, sprint: false }, 0, 0); journey.checkpoint = { ...actor.position };
}
if (['city-phone', 'city-truck', 'city-door'].includes(process.argv[3]) && scene.id === 'm1_city_chase') {
  const journey = sandbox.life.film.state!; actor.controller = 'player'; const variant = process.argv[3];
  journey.step = variant === 'city-phone' ? 0 : variant === 'city-truck' ? 1 : 2;
  journey.matrixEscape = { kind: 'city', phase: variant === 'city-phone' ? 'phone_failure' : variant === 'city-truck' ? 'truck_window' : 'door',
    elapsed: variant === 'city-phone' ? 1.15 : variant === 'city-truck' ? 1.9 : .8, attempt: 0, checkpoint: 'street', hits: 0, dodges: variant === 'city-phone' ? 0 : 1,
    pursuit: .43, segment: journey.step, possessions: variant === 'city-phone' ? 0 : variant === 'city-truck' ? 1 : 2, resolved: [],
    phoneBroken: variant !== 'city-phone', host: variant === 'city-phone' ? undefined : variant === 'city-truck' ? 'citizen_13' : 'citizen_14' } as MatrixEscapeEncounter;
  sandbox.life.film.matrixEscapeFrame(actor, { movement: 0, sprint: false }, 0, 0); journey.checkpoint = { ...actor.position };
}
if (['death-shot', 'death-listen', 'death-kiss'].includes(process.argv[3]) && scene.id === 'm1_death') {
  const journey = sandbox.life.film.state!; const variant = process.argv[3]; actor.controller = 'player'; journey.step = 1;
  journey.theOne = { kind: 'death', phase: variant === 'death-shot' ? 'gunfire' : variant === 'death-listen' ? 'listening' : 'kiss',
    elapsed: variant === 'death-shot' ? .95 : variant === 'death-kiss' ? 1.2 : 0, attempt: 0, checkpoint: 'door',
    signal: variant === 'death-listen' ? .42 : variant === 'death-kiss' ? 1 : 0, hits: 0, blocks: 0, deadline: 0,
    altitude: 0, flightX: 0, flightZ: 0, resolved: variant === 'death-shot' ? [.35, .78] : [] } as TheOneEncounter;
  sandbox.life.film.theOneFrame(actor, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, 0); journey.checkpoint = { ...actor.position };
}
if (['one-bullets', 'one-dive', 'one-emp'].includes(process.argv[3]) && scene.id === 'm1_return') {
  const journey = sandbox.life.film.state!; const variant = process.argv[3]; actor.controller = 'player';
  journey.step = variant === 'one-bullets' ? 0 : variant === 'one-dive' ? 1 : 2;
  journey.theOne = { kind: 'return', phase: variant === 'one-bullets' ? 'bullet_stop' : variant === 'one-dive' ? 'dive' : 'emp',
    elapsed: variant === 'one-bullets' ? 1.25 : variant === 'one-dive' ? 1.05 : 1.35, attempt: 0,
    checkpoint: variant === 'one-emp' ? 'exit' : 'bullets', signal: 0, hits: variant === 'one-bullets' ? 0 : 3,
    blocks: variant === 'one-bullets' ? 0 : 1, deadline: variant === 'one-emp' ? 4 : 0, altitude: 0, flightX: 0, flightZ: 0,
    resolved: [], bulletStopped: true, smithBurst: variant === 'one-emp', empFired: variant === 'one-emp' } as TheOneEncounter;
  sandbox.life.film.theOneFrame(actor, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, 0); journey.checkpoint = { ...actor.position };
}
if (['final-call', 'final-flight'].includes(process.argv[3]) && scene.id === 'm1_final_call') {
  const journey = sandbox.life.film.state!; const flight = process.argv[3] === 'final-flight'; actor.controller = 'player'; journey.step = 1;
  journey.theOne = { kind: 'flight', phase: flight ? 'takeoff' : 'call', elapsed: flight ? 4.6 : 2.7, attempt: 0, checkpoint: 'phone',
    signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: flight ? 21 : 0, flightX: flight ? 4 : 0, flightZ: flight ? -3 : 0, resolved: [] } as TheOneEncounter;
  sandbox.life.film.theOneFrame(actor, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, 0); journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm2_dream' && process.argv[3] === 'dream-fall') {
  const journey = sandbox.life.film.state!; journey.step = 1; actor.controller = 'player';
  journey.reloaded = { ...newReloaded('dream'), phase: 'falling', elapsed: 3.3, shots: [1.3], drift: -.8 };
  sandbox.life.film.reloaded.frame(actor, { x: 0, focus: false }, 0, 0); journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm2_meeting') {
  const journey = sandbox.life.film.state!; const variant = process.argv[3]; actor.controller = 'player';
  if (variant === 'meeting-report') { journey.step = 1; journey.reloaded = { ...newReloaded('meeting'), phase: 'report', elapsed: 2.5 }; }
  else if (variant === 'meeting-door') { journey.step = 3; journey.reloaded = { ...newReloaded('meeting'), phase: 'breach', elapsed: 2.6, exit: 'west', evacuation: 2.6 }; }
  else if (variant === 'meeting-combat') { journey.step = 3; journey.reloaded = { ...newReloaded('meeting'), phase: 'breach', elapsed: 3.6, exit: 'east', evacuation: 3.6 }; }
  sandbox.life.film.reloaded.frame(actor, { x: 0, focus: false }, 0, 0); journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm2_burly' && ['burly-grapple', 'burly-swarm', 'burly-staff', 'burly-flight'].includes(process.argv[3])) {
  const journey = sandbox.life.film.state!; const variant = process.argv[3]; actor.controller = 'player';
  journey.burly = { phase: 'grapple', elapsed: 1.1, attempt: 0, repelled: 0, staffSwings: 0, assimilation: 24, nextCopyAt: 5 };
  actor.position = filmStepPosition(scene, scene.steps[0]);
  if (variant !== 'burly-grapple') {
    sandbox.life.film.burlyDodge(actor, 0);
    if (variant === 'burly-staff') { journey.burly.repelled = BURLY.staffAfterRepels; journey.burly.phase = 'staff'; }
    if (variant === 'burly-flight') {
      journey.step = 1; journey.burly.phase = 'flight'; journey.burly.elapsed = 1.1;
      journey.burly.flightFrom = filmStepPosition(scene, scene.steps[1]);
      sandbox.life.film.burlyFrame(actor, 0, 0);
    }
  } else sandbox.life.film.burlyFrame(actor, 0, 0);
  journey.lastText = variant === 'burly-grapple' ? 'Smith 正试图把 Neo 同化。现在按 X 挣脱。' : variant === 'burly-flight' ? 'Neo 正冲出围攻。' : '复制体不断补位；不能靠清空一波取胜。';
  journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm2_persephone' && process.argv[3] === 'exiles-washroom') {
  const journey = sandbox.life.film.state!; actor.controller = 'player'; journey.step = 2;
  actor.position = filmPosition(scene.set, EXILES.washroom.x - 2, EXILES.washroom.z + 1); actor.rotation = 2.1;
  journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm2_library' && ['exiles-bookcase', 'exiles-escort'].includes(process.argv[3])) {
  const journey = sandbox.life.film.state!; actor.controller = 'player';
  journey.step = process.argv[3] === 'exiles-bookcase' ? 2 : 4;
  actor.position = filmPosition(scene.set, EXILES.bookshelf.x, EXILES.bookshelf.z + 7); actor.rotation = Math.PI;
  if (journey.step === 4) Object.assign(journey.keymaker!, { phase: 'following', x: EXILES.bookshelf.x, z: EXILES.bookshelf.z + 3 });
  sandbox.life.film.keymakerFrame(actor, 0, 0); journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm2_chateau' && ['chateau-duel', 'chateau-upper'].includes(process.argv[3])) {
  const journey = sandbox.life.film.state!; actor.controller = 'player';
  actor.position = filmStepPosition(scene, scene.steps[0]); sandbox.life.film.command(actor, 'act', 0);
  actor.position = filmPosition(scene.set, CHATEAU.racks.sword.x, CHATEAU.racks.sword.z);
  sandbox.life.film.command(actor, 'act', 0);
  if (process.argv[3] === 'chateau-upper') {
    sandbox.state.threats = sandbox.state.threats.filter(threat => threat.scene !== scene.id);
    sandbox.life.film.tick(1); actor.position = filmStepPosition(scene, scene.steps[1]);
    sandbox.life.film.tick(2);
    for (const threat of sandbox.state.threats.filter(threat => threat.scene === scene.id)) threat.stunUntil = 100000;
  } else {
    actor.position = filmPosition(scene.set, 0, 5);
    for (const threat of sandbox.state.threats.filter(threat => threat.scene === scene.id)) threat.stunUntil = 100000;
  }
  actor.rotation = Math.PI; journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm2_mountain' && ['mountain-lookout', 'mountain-flight'].includes(process.argv[3])) {
  const journey = sandbox.life.film.state!; actor.controller = 'player';
  journey.step = process.argv[3] === 'mountain-flight' ? 2 : 1;
  actor.position = filmStepPosition(scene, scene.steps[journey.step]); actor.rotation = Math.PI;
  if (journey.mountain) journey.mountain.phase = journey.step === 2 ? 'flying' : 'ground';
  if (journey.step === 2 && journey.mountain) {
    Object.assign(journey.mountain, { elapsed: 3, x: 0, z: 50, altitude: MOUNTAIN.altitude });
    actor.position = { ...filmPosition(scene.set, 0, 50), y: FILM_SETS[scene.set].center.y + MOUNTAIN.altitude };
    actor.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, mountainFlight: { ...journey.mountain } }, startedAt: 0, duration: 1, progress: 0 };
  }
  journey.checkpoint = { ...actor.position };
}
if (scene.id === 'm3_hel_entry' && ['hel-door', 'hel-door-open'].includes(process.argv[3])) {
  const journey = sandbox.life.film.state!;
  journey.step = process.argv[3] === 'hel-door' ? 3 : 4;
  journey.helElevator = { phase: 'open', elapsed: 4.2, lastTick: 0 };
  journey.helCoatcheck = { phase: 'cleared', ammo: 12, wave: 2, shots: 5, kills: 5, allyShotAt: [0, 0], coverHits: [2, 1, 0] };
  journey.helDanceDoor = { phase: journey.step === 3 ? 'sealed' : 'open', elapsed: journey.step === 3 ? 0 : 2.5, lastTick: 0 };
  actor.position = filmPosition(scene.set, 0, journey.step === 3 ? 4 : -4); actor.rotation = Math.PI;
  journey.checkpoint = { ...actor.position };
  for (const id of ['morpheus', 'seraph'] as const) {
    const ally = world.agents.get(id)!; const root = HEL_COATCHECK.allies[id];
    ally.position = filmPosition(scene.set, root.x, root.z); ally.rotation = Math.PI;
  }
  sandbox.life.film.reconcileCast();
}
if (scene.id === 'm3_farewell' && ['farewell-ready', 'farewell-goodbye', 'farewell-still'].includes(process.argv[3])) {
  const journey = sandbox.life.film.state!; const variant = process.argv[3]; actor.controller = 'player';
  journey.step = variant === 'farewell-still' ? 2 : 1;
  journey.farewell = variant === 'farewell-ready' ? newFarewell()
    : variant === 'farewell-goodbye' ? { phase: 'goodbye', elapsed: .4, total: 11.8 }
      : { phase: 'still', elapsed: 0, total: 18.4 };
  actor.position = filmStepPosition(scene, scene.steps[Math.min(journey.step, 1)]); actor.rotation = Math.PI;
  sandbox.life.film.farewellFrame(actor, 0, 0); journey.checkpoint = { ...actor.position };
}
for (const resident of world.agents.values()) delete resident.controller;
neo.isAwakened = FILM_SCENES.indexOf(scene) >= FILM_SCENES.findIndex(s => s.id === 'm1_pod');
await writeFile(path.join(directory, 'world.json'), JSON.stringify({ version: 1, tick: 0, timeOfDay: 12000, day: 1, phase: 'phase1_normal_life', agents: Object.fromEntries(world.agents), events: [], relationships: [], sandbox: sandbox.state }));
console.log(directory);
