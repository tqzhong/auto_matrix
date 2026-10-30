import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { actor } from './helpers/fighting-hand-fixture.mjs';
import { advanceMotion, newMotion } from '../packages/client/src/agents/CharacterMotion.js';
import { prepareThinCornea } from '../packages/client/src/agents/ThinCornea.js';

function addCornea(scene: THREE.Group) {
  let eyes: THREE.SkinnedMesh | undefined;
  scene.traverse(object => {
    if (object instanceof THREE.SkinnedMesh && (object.material as THREE.Material).name === 'Eyes') eyes = object;
  });
  if (!eyes) return;
  const cornea = eyes.clone();
  cornea.name = 'test-corneal-surface';
  cornea.material = new THREE.MeshPhysicalMaterial({ transmission: 1, roughness: .04, ior: 1.4 });
  cornea.material.name = 'Eyes cornea';
  cornea.material.aoMap = new THREE.Texture();
  eyes.parent!.add(cornea);
}

test('a thin cornea preserves reflections without a scene transmission pass or an opaque iris shadow', async t => {
  let source: THREE.MeshPhysicalMaterial;
  const h = await actor('smith', scene => {
    addCornea(scene);
    source = (scene.getObjectByName('test-corneal-surface') as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
  }); t.after(() => h.models.dispose());
  const cornea = h.rig.root.getObjectByName('test-corneal-surface') as THREE.SkinnedMesh;
  assert.ok(cornea.material instanceof THREE.MeshPhysicalMaterial);
  assert.equal(cornea.material.transmission, 0, 'a zero-thickness surface must not re-render every opaque object');
  assert.equal(cornea.material.transparent, true);
  assert.equal(cornea.material.depthWrite, false, 'the iris supplies the opaque eye depth');
  assert.equal(cornea.material.ior, 1.4, 'keep the delivered reflection response');
  assert.equal(cornea.material.aoMap, null, 'scalar lid visibility must not erase visible corneal reflections');
  assert.equal(cornea.castShadow, false);
  assert.notEqual(cornea.material, source!);
  assert.equal(source!.transmission, 1, 'a runtime instance must not alter the shared GLTF material');
  assert.ok(source!.aoMap, 'retain the authored source occlusion map');
  assert.equal((h.rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.Mesh).castShadow, true);
});

test('first-person head hiding removes both eye layers and restores them afterwards', async t => {
  const h = await actor('neo', addCornea); t.after(() => h.models.dispose());
  const cornea = h.rig.root.getObjectByName('test-corneal-surface') as THREE.SkinnedMesh;
  const eyes = h.rig.wardrobe.find(part => (part.mesh.material as THREE.Material).name === 'Eyes')!.mesh;
  const material = cornea.material as THREE.MeshPhysicalMaterial;
  const shader = { uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms), vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  assert.equal(shader.uniforms.matrixSilver, h.rig.silver, 'Neo’s moving silver surface retains its live uniform binding');
  assert.match(shader.vertexShader, /vLiquidArrival = _mirrorArrival/);
  assert.match(shader.fragmentShader, /vec3 corneaF/);
  const state = newMotion();
  for (const firstPerson of [false, true, false]) {
    const input = { speed: 0, grounded: true, verticalVelocity: 0, turn: 0, firstPerson,
      construct: { phase: 'image' as const, elapsed: 2, role: 'neo' as const } };
    h.models.animate(h.rig, advanceMotion(state, input, 0), state, input, 0);
    assert.equal(eyes.visible, !firstPerson, 'iris visibility');
    assert.equal(cornea.visible, !firstPerson, 'cornea must follow iris visibility');
  }
});

test('ordinary transparent objects and thick refracting eyes keep their authored materials', () => {
  for (const [name, thickness] of [['Glass', 0], ['Eyes cornea', .01]] as const) {
    const material = new THREE.MeshPhysicalMaterial({ transmission: 1, thickness }); material.name = name;
    const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
    prepareThinCornea(material);
    assert.equal(material.transmission, 1);
    assert.equal(material.onBeforeCompile, compile);
    assert.equal(material.customProgramCacheKey(), key);
    material.dispose();
  }
});
