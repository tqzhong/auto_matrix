import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { actor } from './candidate-release/tests/helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from './candidate-release/packages/client/src/agents/CharacterMotion.js';
import { FILM_SETS, groundHeight } from './candidate-release/packages/shared/dist/index.js';

const world = JSON.parse(await readFile(new URL('./native-retry-walking.json', import.meta.url), 'utf8'));
const state = world.agents.citizen_2, h = await actor('trinity');
const rig = (await h.models.create('trinity', undefined, 'citizen_2'))!;
const group = new THREE.Group(), body = new THREE.Group(), detail = new THREE.Group();
group.position.copy(state.position); body.position.y = -1; body.rotation.y = state.rotation;
group.add(body); body.add(detail); detail.add(rig.root);
const floor = groundHeight(state.position, state.isInMatrix);
const motion = newMotion(), input = { speed: 0, grounded: state.position.y <= floor + .12, verticalVelocity: 0, turn: 0,
  training: state.currentAction.parameters.training };
h.models.animate(rig, advanceMotion(motion, input, 0), motion, input, 0); group.updateMatrixWorld(true);
const shoes = ['Red_dress_pumps', 'Red_dress_outsoles', 'Red_dress_heels'].map(name => {
  const mesh = rig.root.getObjectByName(name) as THREE.SkinnedMesh; mesh.skeleton.update();
  let minY = Infinity; const point = new THREE.Vector3();
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) minY = Math.min(minY, mesh.localToWorld(mesh.getVertexPosition(i, point)).y);
  return { name, minY };
});
console.log(JSON.stringify({ state: { position: state.position, rotation: state.rotation, training: input.training }, grounded: input.grounded,
  center: FILM_SETS.film_red_dress_plaza.center, nominalFloor: floor, actorRootY: rig.root.getWorldPosition(new THREE.Vector3()).y,
  shoes, minimum: Math.min(...shoes.map(shoe => shoe.minY)) }, null, 2));
h.models.dispose();
