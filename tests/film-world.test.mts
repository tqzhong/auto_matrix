import assert from 'node:assert/strict';
import test from 'node:test';
import { FILM_SETS, filmPosition } from '../packages/shared/src/constants/film-sets.ts';
import { PILL_ROOM } from '../packages/shared/src/constants/pills.ts';
import { INTERROGATION_ROOM } from '../packages/shared/src/constants/interrogation.ts';
import { groundHeight, playerBlocked, stepPlayer } from '../packages/shared/src/constants/city.ts';

test('film sets admit walking in both worlds and use their own floor', () => {
  for (const set of Object.values(FILM_SETS)) {
    const position = filmPosition(set.id, set.architecture === 'freeway' ? 14 : set.id === 'film_agent_interrogation' ? INTERROGATION_ROOM.approach.x : 0);
    assert.equal(playerBlocked(position, set.world === 'matrix'), false, set.name);
    assert.equal(groundHeight(position, set.world === 'matrix'), position.y, set.name);
    const next = stepPlayer(position, 0, { x: 0, z: -1, yaw: Math.PI, jump: false, sprint: false, sequence: 1 }, .1, set.world === 'matrix');
    assert.ok(next.position.z < position.z, `${set.name}: movement must not freeze at the old city boundary`);
    assert.equal(playerBlocked({ ...position, x: position.x + (set.id === 'film_lafayette' ? 48.4 : (set.id === 'film_office_ledge' ? -1 : 1) * (set.width / 2 + 2)) }, set.world === 'matrix'), true, set.name);
  }
});

test('the interrogation table and chairs are solid while both side aisles admit walking', () => {
  for (const x of [0, -INTERROGATION_ROOM.seat, INTERROGATION_ROOM.seat]) assert.equal(playerBlocked(filmPosition('film_agent_interrogation', x, 0), true), true);
  for (const x of [-INTERROGATION_ROOM.approach.x, INTERROGATION_ROOM.approach.x]) for (const z of [-6, 0, 6]) assert.equal(playerBlocked(filmPosition('film_agent_interrogation', x, z), true), false);
});

test('freeway central and edge barriers match the lanes and its long route does not overlap other sets', () => {
  const set = FILM_SETS.film_freeway_101;
  for (const x of [-28, 0, 28]) assert.equal(playerBlocked(filmPosition(set.id, x, 0), true), true);
  for (const x of [-22, -14, -6, 6, 14, 22]) for (const z of [-700, 0, 700]) assert.equal(playerBlocked(filmPosition(set.id, x, z), true), false);
  for (const other of Object.values(FILM_SETS)) if (other.id !== set.id) assert.ok(Math.abs(other.center.x - set.center.x) > (set.width + other.width) / 2 + 56);
});

test('the chateau staircase supports the player and its upper landing blocks entry from below', () => {
  const set = FILM_SETS.film_chateau_hall;
  const top = filmPosition(set.id, 24.4, -27.2); top.y += 9;
  assert.ok(groundHeight(top, true) > set.center.y + 8);
  const landing = filmPosition(set.id, 0, -36);
  assert.equal(playerBlocked(landing, true), true);
  landing.y += 10;
  assert.equal(playerBlocked(landing, true), false);
  assert.equal(groundHeight(landing, true), landing.y);
});

test('Neo can walk from the château floor up either staircase and reach the actual upper door', () => {
  for (const side of [-1, 1]) {
    let position = filmPosition('film_chateau_hall', 0, 0);
    let verticalVelocity = 0; let horizontalVelocity = { x: 0, z: 0 };
    for (const [x, z] of [[side * 14, -4], [side * 25, -29], [0, -38.5]]) {
      const target = filmPosition('film_chateau_hall', x, z);
      for (let frame = 0; frame < 2000; frame++) {
        const dx = target.x - position.x; const dz = target.z - position.z; const length = Math.hypot(dx, dz);
        if (length < .6) break;
        const next = stepPlayer(position, verticalVelocity, { x: dx / length, z: dz / length, yaw: 0, jump: false, sprint: false }, .05, true, [], horizontalVelocity);
        position = next.position; verticalVelocity = next.verticalVelocity; horizontalVelocity = next.horizontalVelocity;
        assert.ok(frame < 1999, `${side} staircase blocked at ${JSON.stringify(position)}`);
      }
    }
    assert.ok(position.y > FILM_SETS.film_chateau_hall.center.y + 9);
    assert.ok(Math.hypot(position.x - FILM_SETS.film_chateau_hall.center.x, position.z - (FILM_SETS.film_chateau_hall.center.z - 38.5)) < 1);
  }
});

test('the Oracle apartment separates the waiting room from the kitchen while keeping its doorway open', () => {
  assert.equal(playerBlocked(filmPosition('film_oracle_home', 13, -8), true), true);
  assert.equal(playerBlocked(filmPosition('film_oracle_home', 0, -8), true), false);
  assert.equal(playerBlocked(filmPosition('film_oracle_home', 7, -14), true), false);
  for (const [x, z] of [[8, -11], [3, -17], [9, -25.5], [-6, -27.5]]) assert.equal(playerBlocked(filmPosition('film_oracle_home', x, z), true), true, 'kitchen furniture is solid');
});

test('Metacortex cubicles block movement but leave the escape aisles open', () => {
  assert.equal(playerBlocked(filmPosition('film_metacortex_floor', -16, 2), true), true);
  for (const [x, z] of [[0, 20], [-16, 11], [-16, -13], [-24, -27]]) {
    assert.equal(playerBlocked(filmPosition('film_metacortex_floor', x, z), true), false, `${x}, ${z}`);
  }
});

test('the office ledge has a real drop beyond its narrow supporting surface', () => {
  const middle = filmPosition('film_office_ledge', 0, -12);
  assert.equal(groundHeight(middle, true), middle.y);
  assert.ok(groundHeight({ ...middle, x: middle.x - 4 }, true) < middle.y - 30);
});

test('the Lafayette chairs and equipment are solid, with room to reach the pills and mirror', () => {
  for (const [x, z] of [[-PILL_ROOM.seat, PILL_ROOM.z], [PILL_ROOM.seat, PILL_ROOM.z], [0, PILL_ROOM.tableZ], [12, 10]]) assert.equal(playerBlocked(filmPosition('film_lafayette', x, z), true), true);
  for (const [x, z] of [[0, -3.3], [-7, -15.8], [8, 5]]) assert.equal(playerBlocked(filmPosition('film_lafayette', x, z), true), false);
});
