import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { bridgeArrivalPose, meetingCarPose, meetingRollRoadTime, MEETING_ROAD_WIDTH, MEETING_CAR, type FilmJourney } from '@auto_matrix/shared';
import { MeetingSetRenderer } from '../packages/client/src/engine/MeetingSetRenderer.js';

test('the actual car body uses the same fast pose as its occupants between journey snapshots', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) } as unknown as Document;
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const parent = new THREE.Group(); const renderer = new MeetingSetRenderer(parent);
  const journey: FilmJourney = { version: 1, scene: 'm1_bug', step: 2, actor: 'neo', completed: [], reflections: {}, enteredAt: 0, checkpoint: { x: 0, y: 1, z: 0 }, lastText: '',
    meeting: { phase: 'driving', elapsed: 20, bugged: false, approach: { x: 4, z: -12.35, yaw: Math.PI } } };
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    const tailLights = vehicle.children.filter(child => child.name.startsWith('meeting-tail-light-')) as THREE.SpotLight[];
    assert.equal(tailLights.length, 2, 'the parked car needs two visible rear lamps against the bridge darkness');
    for (const light of tailLights) {
      assert.ok(light.position.z > 6.5 && light.position.y > 1, 'the rear lamps must sit on the car tail');
      assert.ok(light.color.r > light.color.g * 2 && light.intensity >= 40, 'the wet road needs a readable red spill');
      assert.ok(light instanceof THREE.SpotLight && light.target.position.z > light.position.z,
        'tail lamps must light the road behind the car without washing the passenger cabin red');
    }
    for (const elapsed of [20, 20.45, 40.5, 42]) {
      const gesture = { phase: 'driving' as const, elapsed, role: 'neo' as const, bugged: false };
      renderer.update(journey, elapsed, gesture);
      const car = meetingCarPose(gesture);
      assert.ok(vehicle.position.distanceTo(new THREE.Vector3(car.x, 0, car.z)) < .001, 'a slow journey snapshot cannot leave the car behind its occupants');
      assert.ok(Math.abs(vehicle.rotation.y - car.yaw) < .001);
    }
    journey.scene = 'm1_bridge'; delete journey.meeting;
    journey.bridgeArrival = { phase: 'approaching', elapsed: 2.35 };
    renderer.update(journey, 2.35);
    const inbound = bridgeArrivalPose(2.35);
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(inbound.x, 0, inbound.z)) < .001);
    assert.ok(Math.abs(vehicle.rotation.y - inbound.yaw) < .001);
    journey.meeting = { phase: 'rolling', elapsed: 3, roadTime: meetingRollRoadTime(3), bugged: true, approach: { x: 4, z: -12.35, yaw: Math.PI } };
    renderer.update(journey, 3);
    const rolling = meetingCarPose(journey.meeting);
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(rolling.x, 0, rolling.z)) < .001, 'the rolling car body follows the passenger pose');
    delete journey.meeting; journey.bridgeArrival = { phase: 'parked', elapsed: 7, parkedRoadTime: 3 };
    renderer.update(journey, 15);
    const stopped = meetingCarPose({ phase: 'ready', elapsed: 0, roadTime: 3 });
    assert.ok(vehicle.position.distanceTo(new THREE.Vector3(stopped.x, 0, stopped.z)) < .001, 'the car remains at the new curb after Neo leaves');
    const door = (renderer as unknown as { door: THREE.Group }).door;
    journey.meeting = { phase: 'hesitating', elapsed: 2, roadTime: 3, bugged: true, approach: { x: 4, z: -12.35, yaw: Math.PI } };
    renderer.update(journey, 2); assert.ok(door.rotation.y < -.95, 'the right rear door remains open during Trinity’s appeal');
    journey.meeting.phase = 'reconsidering'; journey.meeting.elapsed = 0;
    renderer.update(journey, 2); assert.ok(door.rotation.y < -.95, 'trust begins with the same open door pose');
    journey.meeting.elapsed = 2;
    renderer.update(journey, 4); assert.ok(Math.abs(door.rotation.y) < .01, 'Neo shuts the door before examination');
  } finally { renderer.dispose(); globalThis.document = document; }
});

test('bridge puddles stay on the road as the car arrives and leaves, without covering the pavement', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const reflection = (renderer as unknown as { reflection: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> }).reflection;
    renderer.update(undefined, 0);
    const origin = reflection.position.clone();
    for (const elapsed of [0, 1.5, 4, 7]) {
      renderer.update({ scene: 'm1_bridge', bridgeArrival: { phase: 'approaching', elapsed } } as FilmJourney, elapsed);
      assert.ok(reflection.position.distanceTo(origin) < .001, 'standing water must not slide with the arriving vehicle');
    }
    renderer.update(undefined, 20, { phase: 'driving', elapsed: 20, role: 'neo', bugged: false });
    assert.ok(reflection.position.distanceTo(origin) < .001, 'driving away must not drag the reflection plane across the street');
    assert.ok(reflection.geometry.parameters.width <= MEETING_ROAD_WIDTH, 'the raised pavement must remain stone, not a rectangular mirror');
    assert.equal(reflection.material.transparent, true, 'asphalt must remain visible between shallow puddles');
    assert.equal(reflection.material.depthWrite, false, 'the water film must not occlude the road markings');
  } finally { renderer.dispose(); }
});

test('the meeting road loads asphalt maps together and ignores images finishing after leaving the set', t => {
  const loaded = new Map<string, { texture: THREE.Texture; finish: () => void }>();
  t.mock.method(THREE.TextureLoader.prototype, 'load', (url, onLoad) => {
    const texture = new THREE.Texture(); loaded.set(url, { texture, finish: () => onLoad?.(texture) }); return texture;
  });
  const parent = new THREE.Group(); const renderer = new MeetingSetRenderer(parent, false);
  const road = (): THREE.MeshStandardMaterial => {
    let material: THREE.MeshStandardMaterial | undefined;
    parent.traverse(object => { if (object instanceof THREE.Mesh && object.material.name === 'meeting-asphalt') material = object.material; });
    assert.ok(material, 'the meeting street needs a dedicated asphalt material'); return material;
  };
  try {
    const asphalt = road();
    const images = ['color', 'normal', 'roughness'].map(kind => loaded.get(`/assets/surfaces/asphalt_02-${kind}.jpg`)!);
    assert.ok(images.every(Boolean), 'wet asphalt cannot use an unrelated metal-plate normal map');
    assert.equal(asphalt.map, null);
    images[1].finish(); images[2].finish(); assert.equal(asphalt.normalMap, null, 'keep the fallback until the complete texture set is ready');
    images[0].finish();
    assert.equal(asphalt.map, images[0].texture); assert.equal(asphalt.normalMap, images[1].texture); assert.equal(asphalt.roughnessMap, images[2].texture);
    assert.equal(asphalt.map.colorSpace, THREE.SRGBColorSpace);
  } finally { renderer.dispose(); }
  const lateParent = new THREE.Group(); const late = new MeetingSetRenderer(lateParent, false);
  let lateRoad: THREE.MeshStandardMaterial | undefined;
  lateParent.traverse(object => { if (object instanceof THREE.Mesh && object.material.name === 'meeting-asphalt') lateRoad = object.material; });
  late.dispose(); loaded.forEach(image => image.finish());
  assert.ok(lateRoad); assert.equal(lateRoad.map, null, 'a departed set must not reattach disposed textures');
});

test('bridge runoff falls at both portals without synchronized diagonal bands', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  const rain = (renderer as unknown as { runoff: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> }).runoff;
  let released = 0;
  for (const resource of [rain, rain.geometry, rain.material]) resource.addEventListener('dispose', () => released++);
  try {
    const matrix = new THREE.Matrix4(); const samples: { x: number; phase: number }[] = [];
    const portals = new Set<number>();
    for (let i = 0; i < rain.count; i++) {
      rain.getMatrixAt(i, matrix); const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(position.z <= -25 || position.z >= -3, 'the bridge vault must shelter the waiting player');
      portals.add(position.z < -14 ? 0 : 1);
      samples.push({ x: position.x, phase: rain.geometry.getAttribute('phase').getX(i) });
    }
    assert.equal(portals.size, 2);
    const meanX = samples.reduce((sum, sample) => sum + sample.x, 0) / samples.length;
    const meanPhase = samples.reduce((sum, sample) => sum + sample.phase, 0) / samples.length;
    const covariance = samples.reduce((sum, sample) => sum + (sample.x - meanX) * (sample.phase - meanPhase), 0);
    const varianceX = samples.reduce((sum, sample) => sum + (sample.x - meanX) ** 2, 0);
    const variancePhase = samples.reduce((sum, sample) => sum + (sample.phase - meanPhase) ** 2, 0);
    assert.ok(Math.abs(covariance / Math.sqrt(varianceX * variancePhase)) < .15, 'horizontal placement and falling time must be independent, or rain becomes a solid diagonal ribbon');
    renderer.update(undefined, 10, { phase: 'driving', elapsed: 10, role: 'neo', bugged: false });
    const car = meetingCarPose({ phase: 'driving', elapsed: 10, role: 'neo', bugged: false });
    assert.deepEqual(rain.material.uniforms.car.value.toArray(), [car.x, car.z, car.yaw], 'the passing car must mask rain out of its occupied cabin');
    renderer.update(undefined, 40, { phase: 'driving', elapsed: 40, role: 'neo', bugged: false });
    assert.equal(rain.visible, false, 'distant bridge spray must stop drawing once the car leaves the area');
  } finally { renderer.dispose(); assert.equal(released, 3, 'changing scenes releases the rain instances, geometry and shader'); }
});

test('the meeting sedan has actual wheel openings and its tires fit under the body', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    vehicle.updateWorldMatrix(true, true);
    const panels: THREE.Mesh[] = [];
    vehicle.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshPhysicalMaterial && object.material.clearcoat === 1) panels.push(object); });
    const ray = new THREE.Raycaster();
    for (const side of [-1, 1]) for (const z of [-4.3, 4.6]) {
      ray.set(new THREE.Vector3(side * 4, 1.55, z), new THREE.Vector3(-side, 0, 0));
      const body = ray.intersectObjects(panels, false)[0];
      assert.ok(!body || Math.abs(body.point.x) < 2.32, 'painted box sides must not fill the wheel opening');
      ray.set(new THREE.Vector3(side * 4, 1.55, z < 0 ? -6.25 : 6.35), new THREE.Vector3(-side, 0, 0));
      assert.ok(Math.abs(ray.intersectObjects(panels, false)[0]?.point.x ?? 0) > 2.5, 'the fender remains solid outside the wheel opening');
    }
    const wheels = (renderer as unknown as { wheels: { steering: THREE.Group }[] }).wheels;
    for (const { steering } of wheels) {
      const bounds = new THREE.Box3().setFromObject(steering);
      assert.ok(bounds.min.x >= -MEETING_CAR.width / 2 - .02 && bounds.max.x <= MEETING_CAR.width / 2 + .02,
        'the tires sit inside the collision width, rather than protruding from box sides');
    }
  } finally { renderer.dispose(); }
});

test('window trim stays on the glass perimeter instead of bowing above the roof', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false); const trim = new THREE.Group();
  try {
    const points = [[2.5, 2.7, -3.32], [2.5, 2.7, -.15], [2.28, 4.13, -.15], [2.23, 4.13, -2.53]];
    (renderer as unknown as { trim: (parent: THREE.Group, material: THREE.Material, points: number[][], radius: number) => void })
      .trim(trim, new THREE.MeshStandardMaterial(), [...points, points[0]], .028);
    const bounds = new THREE.Box3().setFromObject(trim);
    assert.ok(bounds.max.y < 4.17 && bounds.min.y > 2.66, 'a rounded spline must not create floating chrome arches above or below the window');
    assert.ok(bounds.min.z > -3.36 && bounds.max.z < -.11, 'the side rails follow the slanted glass edges');
  } finally { renderer.dispose(); }
});

test('the cabin lamp lights passengers without illuminating its own diffuser and headliner', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    const light = vehicle.children.find(child => child instanceof THREE.Light && child.position.distanceTo(new THREE.Vector3(0, 3.95, .2)) < .01);
    assert.ok(light instanceof THREE.SpotLight, 'the ceiling light must direct its spill down, rather than burn out the headliner above it');
    assert.ok(light.target.position.y < 2 && light.angle < Math.PI / 2);
    let diffuser: THREE.Material | undefined;
    vehicle.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.computeBoundingBox();
      const center = object.geometry.boundingBox!.getCenter(new THREE.Vector3());
      if (center.distanceTo(new THREE.Vector3(0, 4.005, .1)) < .015) diffuser = object.material as THREE.Material;
    });
    assert.ok(diffuser instanceof THREE.MeshBasicMaterial && diffuser.toneMapped, 'the emitting cover has bounded brightness independent of the adjacent light source');
  } finally { renderer.dispose(); }
});

test('the dashboard stays behind the windshield instead of sitting on the bonnet', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const vehicle = (renderer as unknown as { vehicle: THREE.Group }).vehicle;
    vehicle.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 2.63, -6), new THREE.Vector3(0, 0, 1));
    const hit = ray.intersectObject(vehicle, true)[0];
    // The thin rubber seal extends .07 ahead of the pane at z = -3.49.
    assert.ok(!hit || hit.point.z >= -3.57, 'the cowl must stay below the glazing; a cabin dashboard cannot protrude onto the bonnet');
  } finally { renderer.dispose(); }
});

test('the passenger fill light stays clear of the opening rear door', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const { vehicle, door } = renderer as unknown as { vehicle: THREE.Group; door: THREE.Group };
    const fill = vehicle.children.find(child => child instanceof THREE.PointLight && child.color.getHex() === 0xb9d2d1);
    assert.ok(fill instanceof THREE.PointLight);
    for (const elapsed of [0, .5, 1, 2]) {
      renderer.update(undefined, elapsed, { phase: 'hesitating', elapsed, role: 'neo', bugged: false });
      vehicle.updateWorldMatrix(true, true);
      const distance = new THREE.Box3().setFromObject(door).distanceToPoint(fill.getWorldPosition(new THREE.Vector3()));
      assert.ok(distance > 2, 'the moving window frame must not pass through its fill light and bloom into a white patch');
    }
  } finally { renderer.dispose(); }
});

test('the reshaped rear window still clears Trinity’s scanner when she discards the tracker', t => {
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const renderer = new MeetingSetRenderer(new THREE.Group(), false);
  try {
    const window = (renderer as unknown as { window: THREE.Mesh }).window;
    renderer.update(undefined, 1, { phase: 'discarding', elapsed: 1, role: 'neo', bugged: true });
    window.updateWorldMatrix(true, true);
    assert.ok(new THREE.Box3().setFromObject(window).max.y < 2.85, 'the lowered glass must be below the scanner passage at y = 3');
    renderer.update(undefined, 2, { phase: 'choice', elapsed: 0, role: 'neo', bugged: true });
    window.updateWorldMatrix(true, true);
    assert.ok(new THREE.Box3().setFromObject(window).max.y > 4.1, 'a restarted encounter restores the closed window');
  } finally { renderer.dispose(); }
});
