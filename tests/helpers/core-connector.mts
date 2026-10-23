import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { awakeningPose, CABIN, FILM_SETS, cabinPlugProgress, type FilmJourney } from '@auto_matrix/shared';
import { NebDeckRenderer } from '../../packages/client/src/engine/NebDeckRenderer.js';
import { advanceMotion, newMotion, type MotionInput } from '../../packages/client/src/agents/CharacterMotion.js';
import { actor, fingerGroups } from './fighting-hand-fixture.mjs';

export async function coreConnector(t?: TestContext) {
  const previous = globalThis.document;
  const load = THREE.TextureLoader.prototype.load; THREE.TextureLoader.prototype.load = () => new THREE.Texture();
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) } as unknown as Document;
  const neo = await actor('neo'), morpheus = await actor('morpheus');
  const center = FILM_SETS.film_neb_deck.center, room = new THREE.Group(); room.position.set(center.x, center.y - 1, center.z);
  const renderer = new NebDeckRenderer(room), groups = fingerGroups(morpheus.rig, 'R');
  const dispose = () => { neo.models.dispose(); morpheus.models.dispose(); renderer.dispose(); globalThis.document = previous; THREE.TextureLoader.prototype.load = load; };
  t?.after(dispose);
  function at(elapsed: number) {
    const point = awakeningPose({ kind: 'core', elapsed });
    neo.rig.root.position.set(center.x + point.x, center.y - 1 + point.y, center.z + point.z); neo.rig.root.rotation.y = CABIN.chair.yaw;
    morpheus.rig.root.position.set(center.x + CABIN.connector.x, center.y - 1, center.z + CABIN.connector.z); morpheus.rig.root.rotation.y = CABIN.connector.yaw;
    const draw = (h: typeof neo, input: MotionInput) => {
      const motion = newMotion(); h.models.animate(h.rig, advanceMotion(motion, input, 0), motion, input, 0); h.rig.root.updateMatrixWorld(true);
    };
    draw(neo, { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, nebCrew: 'neo', nebCrewEarly: true,
      performance: 'core', seated: elapsed >= 1.8, cabin: { kind: 'core', elapsed, role: 'neo' } });
    const socket = neo.rig.root.getObjectByName('cervical-interface')!, contact = socket.getWorldPosition(new THREE.Vector3());
    contact.x += .49 + .7 * (1 - cabinPlugProgress(elapsed));
    const operatorInput: MotionInput = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true, nebCrew: 'morpheus', nebCrewEarly: true,
      cabin: { kind: 'core', elapsed, role: 'morpheus', target: { x: contact.x, y: contact.y, z: contact.z } } };
    draw(morpheus, operatorInput);
    renderer.update({ scene: 'm1_cabin', step: 2, awakening: { kind: 'core', elapsed, started: true } } as FilmJourney, 0, neo.rig.root,
      id => id === 'morpheus' ? morpheus.rig.root : id === 'neo' ? neo.rig.root : undefined);
    room.updateMatrixWorld(true); morpheus.rig.root.updateMatrixWorld(true); groups.skin.skeleton.update();
    return { socket, contact, operatorInput, plug: room.getObjectByName('neb-first-core-connector')! };
  }
  return { neo, morpheus, room, renderer, groups, at, dispose };
}

export function wristSwing(wrist: THREE.Bone): number {
  const axis = wrist.position.clone().normalize(), q = wrist.quaternion, projection = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  const twist = new THREE.Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, q.w).normalize();
  return q.clone().multiply(twist.invert()).angleTo(new THREE.Quaternion()) * 180 / Math.PI;
}
