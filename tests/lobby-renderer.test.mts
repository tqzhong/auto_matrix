import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, filmPosition, type FilmJourney } from '@auto_matrix/shared';
import { LobbySetRenderer } from '../packages/client/src/engine/LobbySetRenderer.js';

const canvasDocument = () => ({
  createElement: () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {},
  }) }),
}) as unknown as Document;

const journey = (): FilmJourney => ({ version: 1, scene: 'm1_lobby', step: 1, actor: 'neo', completed: [], enteredAt: 0,
  checkpoint: filmPosition('film_government_lobby'), reflections: {}, lastText: '', fighting: true,
  lobby: { phase: 'checkpoint', elapsed: 0, ammo: 16, wave: 0, columns: Array(10).fill(0), allyShotAt: -10, shots: 0, kills: 0 } });

test('the lobby checkpoint has physical alarm, console, weapon case and impact aftermath', () => {
  const savedDocument = globalThis.document; globalThis.document = canvasDocument();
  const root = new THREE.Group(); const renderer = new LobbySetRenderer(root, FILM_SETS.film_government_lobby);
  try {
    assert.ok(root.getObjectByName('lobby-security-console')); assert.ok(root.getObjectByName('lobby-security-display'));
    const lid = root.getObjectByName('lobby-weapon-case-lid')!;
    const left = root.getObjectByName('lobby-alarm-left') as THREE.Mesh;
    const state = journey(); renderer.update(state, 1);
    assert.equal((left.material as THREE.MeshStandardMaterial).emissiveIntensity, 0); assert.ok(Math.abs(lid.rotation.x) < .001);
    state.lobby!.elapsed = 2.2; renderer.update(state, 2.2);
    const alarms = ['lobby-alarm-left', 'lobby-alarm-right'].map(name => root.getObjectByName(name) as THREE.Mesh);
    assert.ok(alarms.some(mesh => (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity > 1));
    state.lobby!.elapsed = 4.4; renderer.update(state, 4.4); assert.ok(lid.rotation.x < -.5, 'the saved draw beat opens the physical weapon case');
    const center = FILM_SETS.film_government_lobby.center;
    renderer.impact({ source: 'neo', target: 'lobby-stone', position: { x: center.x + 10, y: center.y + 3, z: center.z + 2 }, direction: { x: 1, y: 0, z: 0 }, damage: 0, combo: 0, matrix: true,
      downed: false, shot: { from: center, surface: 'stone', column: 0 } });
    const debris = root.getObjectByName('lobby-impact-debris')!; const before = debris.children[0].position.clone(); renderer.update(state, 4.5);
    assert.ok(debris.children[0].position.distanceTo(before) > 0, 'stone hits throw physical chips instead of leaving only a flat decal');
  } finally { renderer.dispose(); globalThis.document = savedDocument; }
});
