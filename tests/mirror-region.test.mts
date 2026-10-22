import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FILM_SETS, PILL_ROOM, MIRROR_FACE } from '@auto_matrix/shared';
import { createMirrorSurface } from '../packages/client/src/engine/MirrorSurface.js';
import { showMirrorSubject } from '../packages/client/src/engine/FilmSetRenderer.js';
import { enableSkinnedCulling } from '../packages/client/src/agents/SkinnedBounds.js';

function roomMirror() {
  const scene = new THREE.Scene(), room = new THREE.Group(); scene.add(room);
  const center = FILM_SETS.film_lafayette.center; room.position.set(center.x, center.y - 1, center.z);
  const mirror = createMirrorSurface(); mirror.scale.set(MIRROR_FACE.radiusX, MIRROR_FACE.radiusY, 1);
  mirror.position.set(PILL_ROOM.mirror.x, MIRROR_FACE.y + 1, PILL_ROOM.mirror.z); room.add(mirror); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(57, 16 / 9, .5, 5000);
  camera.position.copy(room.localToWorld(new THREE.Vector3(.1, 2.7, 2.6)));
  camera.lookAt(room.localToWorld(new THREE.Vector3(0, 1.1, -6))); camera.updateMatrixWorld(true);
  const target = mirror.getRenderTarget(), shader = mirror.material as THREE.ShaderMaterial;
  let current: THREE.WebGLRenderTarget | null = null;
  let draw = (_scene: THREE.Object3D, _camera: THREE.Camera) => {};
  const renderer = { xr: { enabled: true }, shadowMap: { autoUpdate: true }, autoClear: true,
    state: { buffers: { depth: { setMask() {} } } },
    getRenderTarget: () => current, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { current = value; },
    render: (scene: THREE.Object3D, camera: THREE.Camera) => draw(scene, camera),
  } as unknown as THREE.WebGLRenderer;
  const render = renderer.render;
  return { scene, room, mirror, camera, renderer, target, shader, render,
    draw: (operation: typeof draw) => { draw = operation; },
    paint: () => mirror.onBeforeRender(renderer, scene, camera, mirror.geometry, mirror.material, null),
    dispose: () => { mirror.dispose(); mirror.geometry.dispose(); },
  };
}

test('the pill-room reflection draws only sampled pixels and culls the rest of the panorama without moving the image', () => {
  const view = roomMirror(); const { mirror, camera, target, shader, room } = view;
  const playerProjection = camera.projectionMatrix.clone(); let painted = false;
  view.draw((_scene, reflection) => {
    painted = true;
    assert.equal(reflection, mirror.camera);
    assert.ok(target.scissorTest, 'the reflection must not shade the full camera panorama');
    assert.ok(target.viewport.z * target.viewport.w < target.width * target.height * .1,
      'the small glass in the pill-room view uses less than a tenth of the panorama');
    assert.deepEqual(target.scissor.toArray(), target.viewport.toArray());
    const transform = shader.uniforms.textureMatrix.value as THREE.Matrix4;
    const positions = mirror.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector4(positions.getX(i), positions.getY(i), 0, 1);
      const sample = point.clone().applyMatrix4(transform);
      const clip = point.applyMatrix4(mirror.matrixWorld).applyMatrix4(reflection.matrixWorldInverse).applyMatrix4(reflection.projectionMatrix);
      const pixel = [target.viewport.x + (clip.x / clip.w + 1) * target.viewport.z / 2,
        target.viewport.y + (clip.y / clip.w + 1) * target.viewport.w / 2];
      assert.ok(Math.abs(pixel[0] - sample.x / sample.w * target.width) < 1e-6);
      assert.ok(Math.abs(pixel[1] - sample.y / sample.w * target.height) < 1e-6,
        'the tighter frustum and viewport must cancel: every glass texel keeps its original location');
    }
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(reflection.projectionMatrix, reflection.matrixWorldInverse));
    const throughGlass = mirror.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, .2));
    assert.ok(frustum.containsPoint(throughGlass), 'objects immediately behind the mirror plane remain reflected');
    const outsideGlass = room.localToWorld(new THREE.Vector3(.1, 1.1, -6));
    const panorama = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(playerProjection, reflection.matrixWorldInverse));
    assert.ok(panorama.containsPoint(outsideGlass));
    assert.equal(frustum.containsPoint(outsideGlass), false, 'objects outside the sampled mirror cone no longer submit reflection geometry');
  });
  try {
    view.paint(); assert.ok(painted); assert.deepEqual(camera.projectionMatrix.elements, playerProjection.elements);
    assert.deepEqual(target.viewport.toArray(), [0, 0, target.width, target.height]);
    assert.deepEqual(target.scissor.toArray(), [0, 0, target.width, target.height]); assert.equal(target.scissorTest, false);
    assert.equal(view.renderer.render, view.render); assert.equal(view.renderer.getRenderTarget(), null);
  } finally { view.dispose(); }
});

test('moving views keep every fractured and rippling sample painted and the first-person subject live', () => {
  const view = roomMirror(); const { mirror, camera, room, target, shader } = view;
  const body = new THREE.Group(); body.visible = false; const prop = new THREE.Group(); prop.visible = false;
  const nextFrame = showMirrorSubject(mirror, () => body, () => [prop]); let paints = 0;
  const positions = mirror.geometry.getAttribute('position'), fractures = mirror.geometry.getAttribute('fracture');
  view.draw(() => {
    paints++; assert.equal(body.visible, true); assert.equal(prop.visible, true);
    assert.ok(target.viewport.z > 0 && target.viewport.w > 0, 'grazing or very close views may retain the whole texture');
    const transform = shader.uniforms.textureMatrix.value as THREE.Matrix4;
    const heal = shader.uniforms.healProgress.value as number;
    for (let i = 0; i < positions.count; i++) {
      const fracture = 1 - THREE.MathUtils.smoothstep(heal, fractures.getZ(i), 1);
      const sample = new THREE.Vector4(positions.getX(i) + fractures.getX(i) * fracture,
        positions.getY(i) + fractures.getY(i) * fracture, 0, 1).applyMatrix4(transform);
      for (const dx of [-.015, .015]) for (const dy of [-.015, .015]) {
        const x = THREE.MathUtils.clamp(sample.x / sample.w + dx, 0, 1) * target.width;
        const y = THREE.MathUtils.clamp(sample.y / sample.w + dy, 0, 1) * target.height;
        assert.ok(x >= target.scissor.x && x <= target.scissor.x + target.scissor.z,
          'crack offsets, ripple displacement and edge-clamped samples must never read unpainted pixels');
        assert.ok(y >= target.scissor.y && y <= target.scissor.y + target.scissor.w);
      }
    }
  });
  try {
    for (const [x, y, z, aspect] of [[.1, 2.7, 2.6, 16 / 9], [-8.5, 4, -12.2, .7], [-9.2, 4, -16.5, 16 / 9], [-13, 5, -15.5, 16 / 9]]) {
      camera.position.copy(room.localToWorld(new THREE.Vector3(x, y, z)));
      camera.lookAt(mirror.getWorldPosition(new THREE.Vector3())); camera.aspect = aspect; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      for (const heal of [0, .5, 1]) {
        shader.uniforms.healProgress.value = heal; shader.uniforms.liquidTime.value = 1.2; shader.uniforms.liquidAmount.value = .8;
        nextFrame(); view.paint(); view.paint();
        assert.equal(body.visible, false); assert.equal(prop.visible, false);
        assert.equal(view.renderer.render, view.render); assert.equal(target.scissorTest, false);
      }
    }
    assert.equal(paints, 12, 'each new frame and camera refreshes once; transmission and color share that view');
  } finally { view.dispose(); }
});

test('a reflection render failure restores the borrowed render method, projection and target region', () => {
  const view = roomMirror(); const { mirror, target } = view;
  view.draw(() => { throw new Error('reflection draw failed'); });
  try {
    assert.throws(view.paint, /reflection draw failed/);
    assert.equal(view.renderer.render, view.render);
    assert.deepEqual(target.viewport.toArray(), [0, 0, target.width, target.height]);
    assert.deepEqual(target.scissor.toArray(), [0, 0, target.width, target.height]); assert.equal(target.scissorTest, false);
    assert.ok(Math.abs(mirror.camera.projectionMatrix.elements[0] - view.camera.projectionMatrix.elements[0]) < 1e-12,
      'the tighter horizontal projection must not leak into another pass');
  } finally { view.dispose(); }
});

test('the reflection reuses this frame\'s scene transforms without walking the hidden city again', t => {
  const view = roomMirror(), hiddenCity = new THREE.Group(); hiddenCity.visible = false; view.scene.add(hiddenCity);
  const subject = new THREE.Group(); subject.position.set(-2, 1, -4); view.room.add(subject);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); prop.position.set(.4, .2, .3); subject.add(prop);
  const updates = t.mock.method(hiddenCity, 'updateMatrixWorld');
  let paints = 0;
  view.draw((scene, camera) => {
    // This is the same scene-matrix entry condition used by WebGLRenderer.
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    camera.updateMatrixWorld(); paints++;
    assert.ok(new THREE.Vector3().setFromMatrixPosition(prop.matrixWorld).distanceTo(prop.position.clone().applyMatrix4(subject.matrix).applyMatrix4(view.room.matrixWorld)) < 1e-10,
      'the reflection still sees the prop after this frame\'s actor movement');
  });
  try {
    for (const moved of [0, .8]) {
      subject.rotation.y = moved; prop.position.y = moved;
      view.scene.updateMatrixWorld(true); const before = updates.mock.callCount();
      view.paint();
      assert.equal(updates.mock.callCount(), before, 'the color pass already updated the hidden city and every visible actor');
      assert.equal(view.scene.matrixWorldAutoUpdate, true, 'the next main frame still updates its moving scene');
    }
    assert.equal(paints, 2);
  } finally { view.dispose(); prop.geometry.dispose(); (prop.material as THREE.Material).dispose(); }
});

test('reflection matrix reuse restores the prior scene setting even when the reflected draw fails', () => {
  const view = roomMirror();
  try {
    for (const auto of [true, false]) {
      view.scene.matrixWorldAutoUpdate = auto;
      view.draw(scene => { assert.equal(scene.matrixWorldAutoUpdate, false); throw new Error('reflected scene failed'); });
      assert.throws(view.paint, /reflected scene failed/);
      assert.equal(view.scene.matrixWorldAutoUpdate, auto, 'a failed secondary draw cannot disable later main-frame animation');
    }
  } finally { view.dispose(); }
});


test('a first-person body made visible for the mirror keeps current skinned culling bounds', () => {
  const view = roomMirror(), body = new THREE.Group(), bone = new THREE.Bone(); view.room.add(body); body.add(bone);
  const geometry = new THREE.BoxGeometry(), vertices = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(vertices * 4), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: vertices * 4 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  const material = new THREE.MeshStandardMaterial(), skin = new THREE.SkinnedMesh(geometry, material); body.add(skin);
  view.scene.updateMatrixWorld(true); skin.bind(new THREE.Skeleton([bone])); enableSkinnedCulling(body);
  const nextFrame = showMirrorSubject(view.mirror, () => body);
  view.draw(scene => {
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    assert.equal(body.visible, true);
    for (let i = 0; i < vertices; i++) assert.ok(skin.boundingBox!.containsPoint(skin.getVertexPosition(i, new THREE.Vector3())),
      'moving a hidden first-person actor must not leave its reflection clipped by old skin bounds');
  });
  try {
    for (const moved of [20, -25, 0]) {
      body.visible = false; bone.position.x = moved; view.scene.updateMatrixWorld(true);
      nextFrame(); view.paint(); assert.equal(body.visible, false, 'the direct first-person body stays hidden');
    }
  } finally { view.dispose(); geometry.dispose(); material.dispose(); }
});
