import * as THREE from 'three';

/** Stage the original vertex and instance attributes without drawing into the live scene. */
export function* prepareMeshBuffers(renderer: THREE.WebGLRenderer, camera: THREE.Camera,
  meshes: (THREE.Mesh | THREE.Line)[], target?: THREE.WebGLRenderTarget): Generator<void> {
  const view = new THREE.Scene(), hidden = new THREE.MeshBasicMaterial({ visible: false });
  const preparedTarget = target ?? new THREE.WebGLRenderTarget(1, 1);
  view.matrixWorldAutoUpdate = false;
  try {
    while (meshes.length) {
      const batch = meshes.splice(0, 4);
      const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      const { autoClear, sortObjects } = renderer;
      const saved = batch.map(mesh => ({ mesh, material: mesh.material, children: mesh.children,
        visible: mesh.visible, frustumCulled: mesh.frustumCulled }));
      try {
        // Three uploads attributes before testing material visibility.
        for (const mesh of batch) {
          mesh.material = hidden; mesh.children = []; mesh.visible = true; mesh.frustumCulled = false;
        }
        view.children = batch;
        renderer.autoClear = renderer.sortObjects = false;
        renderer.setRenderTarget(preparedTarget);
        renderer.render(view, camera);
      } finally {
        for (const { mesh, material, children, visible, frustumCulled } of saved) {
          mesh.material = material; mesh.children = children; mesh.visible = visible; mesh.frustumCulled = frustumCulled;
        }
        view.children = [];
        renderer.autoClear = autoClear; renderer.sortObjects = sortObjects;
        renderer.setRenderTarget(previous, face, mip);
      }
      yield;
    }
  } finally {
    hidden.dispose();
    if (!target) preparedTarget.dispose();
  }
}
