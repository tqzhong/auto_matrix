import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FilmSetRenderer } from '../packages/client/src/engine/FilmSetRenderer.js';

test('film set walls use their base color until all three texture images are ready', t => {
  const loaded: (() => void)[] = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', (_url, onLoad) => {
    const texture = new THREE.Texture();
    loaded.push(() => onLoad?.(texture));
    return texture;
  });
  const renderer = new FilmSetRenderer(new THREE.Scene());
  try {
    const material = (renderer as unknown as { pbr: (id: string, color: number) => THREE.MeshStandardMaterial }).pbr('damaged_plaster', 0xadae9c);
    assert.equal(material.map, null, 'an unloaded image must not turn the wall into a black silhouette');
    loaded[1](); loaded[2]();
    assert.equal(material.map, null, 'partially loaded maps keep the same fallback appearance');
    loaded[0]();
    assert.ok(material.map && material.normalMap && material.roughnessMap, 'all maps appear together once ready');
  } finally { renderer.dispose(); }
});

test('a previous film set cannot attach a late texture after disposal', t => {
  const loaded: (() => void)[] = [];
  t.mock.method(THREE.TextureLoader.prototype, 'load', (_url, onLoad) => {
    const texture = new THREE.Texture();
    loaded.push(() => onLoad?.(texture));
    return texture;
  });
  const renderer = new FilmSetRenderer(new THREE.Scene());
  const material = (renderer as unknown as { pbr: (id: string, color: number) => THREE.MeshStandardMaterial }).pbr('damaged_plaster', 0xadae9c);
  renderer.dispose();
  loaded.forEach(finish => finish());
  assert.equal(material.map, null);
});
