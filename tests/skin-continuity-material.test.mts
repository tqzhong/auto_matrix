import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { HeroRig } from '../packages/client/src/agents/HeroModel.js';
import { SkinContinuity } from '../packages/client/src/agents/SkinContinuity.js';

function extension(bodyMaterial: THREE.MeshStandardMaterial) {
  const root = new THREE.Group(), bone = new THREE.Bone(); root.add(bone);
  const geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .02, 0, 0, 0, .02, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(12), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    g.setIndex([0, 1, 2]); return g;
  };
  const headAtlas = new THREE.Texture(), handMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughnessMap: headAtlas, aoMap: headAtlas });
  const hand = new THREE.SkinnedMesh(geometry(), handMaterial), bodyGeometry = geometry(), body = new THREE.SkinnedMesh(bodyGeometry, bodyMaterial);
  hand.geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
  hand.name = 'Anatomical_head_and_hands'; root.add(hand, body); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([bone]); hand.bind(skeleton); body.bind(skeleton);
  const surface = new SkinContinuity({ root, bones: new Map([['wrist_R', bone]]) } as unknown as HeroRig, body);
  return { surface, body, material: body.material as THREE.MeshStandardMaterial, dispose() {
    surface.dispose(); hand.geometry.dispose(); bodyGeometry.dispose(); handMaterial.dispose(); headAtlas.dispose(); skeleton.dispose();
  } };
}

test('an uncolored wrist extension keeps its own atlas and does not request missing head color data', t => {
  const map = new THREE.Texture(), source = new THREE.MeshStandardMaterial({ map, color: 0x916449, roughness: .63 });
  const h = extension(source); t.after(() => { h.dispose(); source.dispose(); map.dispose(); }); h.surface.update();
  assert.equal(h.body.geometry.hasAttribute('color'), false);
  assert.equal(h.material.vertexColors, false, 'a wrist without COLOR_0 must not inherit a colored head shader');
  assert.equal(h.material.map, map);
  assert.equal(h.material.roughnessMap, null, 'the unrelated head roughness atlas cannot shade wrist UVs');
  assert.equal(h.material.aoMap, null, 'the unrelated head AO atlas cannot darken wrist UVs');
  assert.ok(h.material.color.equals(source.color));
});

test('a skin extension retains its authored PBR maps and shader callbacks independently', t => {
  const map = new THREE.Texture(), roughnessMap = new THREE.Texture(), aoMap = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial({ map, roughnessMap, aoMap, roughness: .71 });
  source.onBeforeCompile = shader => { shader.fragmentShader += '\n// authored skin'; };
  source.customProgramCacheKey = () => 'authored-extension';
  const h = extension(source); t.after(() => { h.dispose(); source.dispose(); map.dispose(); roughnessMap.dispose(); aoMap.dispose(); });
  assert.notEqual(h.material, source);
  assert.equal(h.material.roughnessMap, roughnessMap); assert.equal(h.material.aoMap, aoMap);
  assert.equal(h.material.onBeforeCompile, source.onBeforeCompile); assert.equal(h.material.customProgramCacheKey, source.customProgramCacheKey);
  assert.equal(h.material.roughness, .71);
});
