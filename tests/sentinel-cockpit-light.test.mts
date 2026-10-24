import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { SENTINEL_STATION, type FilmJourney, type SentinelPhase } from '@auto_matrix/shared';
import { SentinelSetRenderer } from '../packages/client/src/engine/SentinelSetRenderer.js';

function fixture(t: { after(fn: () => void): void }) {
  const root = new THREE.Group(), renderer = new SentinelSetRenderer(root);
  t.after(() => renderer.dispose());
  const draw = (phase: SentinelPhase, elapsed = 0) => {
    renderer.update({ scene: 'm1_sentinels', sentinel: { phase, elapsed, noise: 0, attempt: 0 } } as FilmJourney, elapsed);
    root.updateMatrixWorld(true);
  };
  const lights: THREE.PointLight[] = [];
  root.traverse(object => { if (object instanceof THREE.PointLight) lights.push(object); });
  return { root, draw, lights };
}

test('cockpit lamps illuminate crew from above without a point-light hotspot at face height', t => {
  const { draw, lights } = fixture(t); draw('ready');
  // Same distance/window attenuation as Three's lights_pars_begin. This is an
  // upper bound before surface normals and BRDF, not a measured lux value.
  for (const [role, at] of Object.entries(SENTINEL_STATION)) for (const y of [3.5, 4, 4.5]) {
    const point = new THREE.Vector3(at.x, y, at.z);
    const direct = lights.reduce((sum, light) => {
      const distance = point.distanceTo(light.getWorldPosition(new THREE.Vector3()));
      const window = light.distance > 0 ? Math.max(0, 1 - (distance / light.distance) ** 4) ** 2 : 1;
      return sum + light.intensity * window / Math.max(distance ** light.decay, .01);
    }, 0);
    assert.ok(direct < 5, `${role} at head height ${y}: direct-light bound ${direct} washes out the skin`);
  }
  const powered = lights.filter(light => light.name === 'sentinel-power-light');
  assert.equal(powered.length, 3, 'retain the existing finite light budget');
  assert.ok(powered.every(light => light.color.b >= light.color.g && light.position.y > 7), 'the real ship uses elevated cool practical lights');
});

test('the central cockpit has an opaque ceiling with clear headroom over the walking and control positions', t => {
  const { root, draw } = fixture(t); draw('ready');
  for (const x of [-5, 0, 5]) for (const z of [-12, -20, -28, -36, -44]) {
    const hit = new THREE.Raycaster(new THREE.Vector3(x, 5.5, z), new THREE.Vector3(0, 1, 0), 0, 6).intersectObject(root, true)
      .find(hit => !(hit.object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.transparent);
    assert.ok(hit && hit.point.y > 8 && hit.point.y < 11.5, `${x}/${z}: the cockpit must not open directly into the exterior tunnel`);
  }
});

test('power loss and restoration reconstruct the same fixture lighting from the saved phase', t => {
  const { draw, lights } = fixture(t);
  const sample = () => lights.map(light => ({ intensity: light.intensity, color: light.color.toArray() }));
  draw('ready'); const ready = sample();
  draw('shutdown', 5.5); const dark = sample();
  for (const [i, light] of lights.entries()) if (light.name === 'sentinel-power-light') {
    assert.ok(dark[i].intensity < ready[i].intensity * .2);
    assert.ok(dark[i].intensity > 0, 'retain emergency light rather than a black frame');
  }
  draw('confirming', 1.4); const saved = sample();
  draw('done'); assert.deepEqual(sample(), ready);
  draw('confirming', 1.4); assert.deepEqual(sample(), saved);
});

test('the cockpit ambient fill dims with ship power and restores on a cold completed checkpoint', t => {
  const { root, draw } = fixture(t), fill = root.getObjectByName('sentinel-cockpit-fill') as THREE.HemisphereLight;
  draw('ready'); const powered = fill.intensity;
  draw('shutdown', 5.5); assert.ok(fill.intensity < powered * .5, 'emergency light must not retain the powered cabin ambience');
  assert.ok(fill.intensity > 0, 'the crew must remain readable during the scan');
  draw('done'); assert.equal(fill.intensity, powered);
});
