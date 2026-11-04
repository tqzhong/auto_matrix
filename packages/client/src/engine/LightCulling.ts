import * as THREE from 'three';

type LightSelection = { hidden: THREE.PointLight[]; muted: THREE.PointLight[]; intensities: number[] };

/** Reuse non-shadow light shader variants across camera changes. */
export class LightCulling {
  enabled = true;
  stablePointSlots = false;
  lastView = { considered: 0, culled: 0 };
  private frustum = new THREE.Frustum();
  private projection = new THREE.Matrix4();
  private sphere = new THREE.Sphere();
  private frames: LightSelection[] = [];
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
    this.restoreSelection(this.frames[this.depth - 1]);
    const selected = this.frames[this.depth] ??= { hidden: [], muted: [], intensities: [] };
    selected.hidden.length = selected.muted.length = selected.intensities.length = 0; this.depth++;
    const camera = args[2]; let considered = 0, kept = 0;
    if (this.enabled && !this.scene.overrideMaterial && !(camera instanceof THREE.ArrayCamera)) {
      this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      this.scene.traverseVisible(object => {
        if (!(object instanceof THREE.PointLight)) return;
        if (object.children.length) { kept++; return; }
        considered++;
        this.sphere.center.setFromMatrixPosition(object.matrixWorld);
        // Three's cutoff distance is in world units, independent of node scale.
        this.sphere.radius = object.distance + .01;
        if (object.intensity === 0 && (!this.stablePointSlots || object.castShadow)) {
          object.visible = false; selected.hidden.push(object);
        } else if (object.distance > 0 && !this.frustum.intersectsSphere(this.sphere)) {
          // Light count is part of Three's program cache key. A zero-energy
          // slot avoids compiling every material again when the camera turns.
          if (object.castShadow) { object.visible = false; selected.hidden.push(object); }
          else { selected.muted.push(object); selected.intensities.push(object.intensity); object.intensity = 0; }
        } else kept++;
      });
      // Small fixed rigs keep all their slots. Elsewhere bound the extra slots.
      const slots = this.stablePointSlots ? kept + selected.muted.length : Math.max(4, 2 ** Math.ceil(Math.log2(Math.max(1, kept))));
      const padding = Math.min(selected.muted.length, slots - kept);
      for (let index = padding; index < selected.muted.length; index++) {
        const light = selected.muted[index]; light.intensity = selected.intensities[index];
        light.visible = false; selected.hidden.push(light);
      }
      selected.muted.length = selected.intensities.length = padding;
    }
    if (this.depth === 1 && !this.scene.overrideMaterial) this.lastView = { considered, culled: selected.hidden.length + selected.muted.length };
  };

  private after: THREE.Scene['onAfterRender'] = (...args) => {
    this.restoreSelection(this.frames[--this.depth]);
    const parent = this.frames[this.depth - 1];
    if (parent) { for (const light of parent.hidden) light.visible = false; for (const light of parent.muted) light.intensity = 0; }
    this.previousAfter.apply(this.scene, args);
  };

  private restoreSelection(selected?: LightSelection): void {
    if (!selected) return;
    for (const light of selected.hidden) light.visible = true;
    selected.muted.forEach((light, index) => { light.intensity = selected.intensities[index]; });
  }

  /** Also called from the frame's finally block if a nested renderer throws. */
  restore(): void {
    while (this.depth > 0) this.restoreSelection(this.frames[--this.depth]);
  }

  dispose(): void {
    this.restore(); this.scene.onBeforeRender = this.previousBefore; this.scene.onAfterRender = this.previousAfter;
  }
}
