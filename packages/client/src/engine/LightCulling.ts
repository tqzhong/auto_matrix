import * as THREE from 'three';

/** A finite point light outside this view cannot illuminate any of its pixels. */
export class LightCulling {
  enabled = true;
  lastView = { considered: 0, culled: 0 };
  private frustum = new THREE.Frustum();
  private projection = new THREE.Matrix4();
  private sphere = new THREE.Sphere();
  private frames: THREE.PointLight[][] = [];
  private depth = 0;
  private previousBefore: THREE.Scene['onBeforeRender'];
  private previousAfter: THREE.Scene['onAfterRender'];

  constructor(private scene: THREE.Scene) {
    this.previousBefore = scene.onBeforeRender; this.previousAfter = scene.onAfterRender;
    scene.onBeforeRender = this.before; scene.onAfterRender = this.after;
  }

  private before: THREE.Scene['onBeforeRender'] = (...args) => {
    this.previousBefore.apply(this.scene, args);
    // A mirror has a different view. Restore the parent pass before selecting
    // its lights, then reinstate the parent's selection when the mirror ends.
    for (const light of this.frames[this.depth - 1] ?? []) light.visible = true;
    const hidden = this.frames[this.depth] ??= []; hidden.length = 0; this.depth++;
    const camera = args[2]; let considered = 0;
    if (this.enabled && !this.scene.overrideMaterial && !(camera instanceof THREE.ArrayCamera)) {
      this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      this.scene.traverseVisible(object => {
        if (!(object instanceof THREE.PointLight) || object.children.length) return;
        considered++;
        this.sphere.center.setFromMatrixPosition(object.matrixWorld);
        // Three's cutoff distance is in world units, independent of node scale.
        this.sphere.radius = object.distance + .01;
        if (object.intensity === 0 || object.distance > 0 && !this.frustum.intersectsSphere(this.sphere)) {
          object.visible = false; hidden.push(object);
        }
      });
    }
    if (this.depth === 1 && !this.scene.overrideMaterial) this.lastView = { considered, culled: hidden.length };
  };

  private after: THREE.Scene['onAfterRender'] = (...args) => {
    for (const light of this.frames[--this.depth]) light.visible = true;
    for (const light of this.frames[this.depth - 1] ?? []) light.visible = false;
    this.previousAfter.apply(this.scene, args);
  };

  /** Also called from the frame's finally block if a nested renderer throws. */
  restore(): void {
    while (this.depth > 0) for (const light of this.frames[--this.depth]) light.visible = true;
  }

  dispose(): void {
    this.restore(); this.scene.onBeforeRender = this.previousBefore; this.scene.onAfterRender = this.previousAfter;
  }
}
