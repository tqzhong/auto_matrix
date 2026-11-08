import * as THREE from 'three';

// Keep the same slots; skip unlit slots and shading once distance attenuation removes all energy.
THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(
  /(pointLight = pointLights\[ i \];)(\s+getPointLightInfo\([\s\S]*?)(\n\t}\n\t#pragma unroll_loop_end)/,
  (_match, assignment, body: string, end) => assignment + '\n\t\tif ( pointLight.color != vec3( 0.0 ) ) {'
    + body.replace(/(\t\t)(RE_Direct\([^;]+;)/, '$1if ( directLight.visible ) {\n$1\t$2\n$1}') + '\n\t\t}' + end,
);
THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(
  /(spotLight = spotLights\[ i \];)(\s+getSpotLightInfo\([\s\S]*?)(\n\t}\n\t#pragma unroll_loop_end)/,
  (_match, assignment, body: string, end) => assignment + '\n\t\tif ( spotLight.color != vec3( 0.0 ) ) {'
    + body.replace(/(\t\t)(RE_Direct\([^;]+;)/, '$1if ( directLight.visible ) {\n$1\t$2\n$1}') + '\n\t\t}' + end,
);

export const POINT_SLOT_FLOOR = 4;
type LightSelection = { hidden: THREE.PointLight[]; muted: THREE.PointLight[]; intensities: number[]; fill: number };

/** Reuse non-shadow light shader variants across camera changes. */
export class LightCulling {
  enabled = true;
  stablePointSlots = false;
  minimumPointSlots = 0;
  lastView = { considered: 0, culled: 0 };
  private frustum = new THREE.Frustum();
  private projection = new THREE.Matrix4();
  private sphere = new THREE.Sphere();
  private frames: LightSelection[] = [];
  private depth = 0;
  private pointFill?: THREE.Group;
  private previousBefore: THREE.Scene['onBeforeRender'];
  private previousAfter: THREE.Scene['onAfterRender'];

  constructor(private scene: THREE.Scene) {
    this.previousBefore = scene.onBeforeRender; this.previousAfter = scene.onAfterRender;
    scene.onBeforeRender = this.before; scene.onAfterRender = this.after;
  }

  private before: THREE.Scene['onBeforeRender'] = (...args) => {
    this.previousBefore.apply(this.scene, args);
    this.select(args[2]);
  };

  private select(camera: THREE.Camera): void {
    // A mirror has a different view. Restore the parent pass before selecting
    // its lights, then reinstate the parent's selection when the mirror ends.
    this.restoreSelection(this.frames[this.depth - 1]);
    const selected = this.frames[this.depth] ??= { hidden: [], muted: [], intensities: [], fill: 0 };
    selected.hidden.length = selected.muted.length = selected.intensities.length = 0; this.depth++;
    selected.fill = 0;
    let considered = 0, kept = 0;
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
      const slots = this.stablePointSlots ? kept + selected.muted.length : Math.max(POINT_SLOT_FLOOR, 2 ** Math.ceil(Math.log2(Math.max(1, kept))));
      const padding = Math.min(selected.muted.length, slots - kept);
      for (let index = padding; index < selected.muted.length; index++) {
        const light = selected.muted[index]; light.intensity = selected.intensities[index];
        light.visible = false; selected.hidden.push(light);
      }
      selected.muted.length = selected.intensities.length = padding;
      selected.fill = Math.max(0, this.minimumPointSlots - kept - padding);
      this.setPointFill(selected.fill);
    }
    if (this.depth === 1 && !this.scene.overrideMaterial) this.lastView = { considered, culled: selected.hidden.length + selected.muted.length };
  }

  private after: THREE.Scene['onAfterRender'] = (...args) => {
    this.finishSelection();
    this.previousAfter.apply(this.scene, args);
  };

  private finishSelection(): void {
    this.restoreSelection(this.frames[--this.depth]);
    const parent = this.frames[this.depth - 1];
    if (parent) {
      for (const light of parent.hidden) light.visible = false;
      for (const light of parent.muted) light.intensity = 0;
      this.setPointFill(parent.fill);
    }
  }

  private restoreSelection(selected?: LightSelection): void {
    if (this.pointFill) this.pointFill.visible = false;
    if (!selected) return;
    for (const light of selected.hidden) light.visible = true;
    selected.muted.forEach((light, index) => { light.intensity = selected.intensities[index]; });
  }

  private setPointFill(count: number): void {
    if (!this.pointFill && count > 0) {
      this.pointFill = new THREE.Group();
      this.scene.add(this.pointFill);
    }
    if (this.pointFill) {
      for (let i = this.pointFill.children.length; i < count; i++) this.pointFill.add(new THREE.PointLight(0xffffff, 0, 1));
      this.pointFill.visible = count > 0;
      this.pointFill.children.forEach((light, i) => { light.visible = i < count; });
    }
  }

  /** Also called from the frame's finally block if a nested renderer throws. */
  restore(): void {
    while (this.depth > 0) this.restoreSelection(this.frames[--this.depth]);
  }

  compileSubject(renderer: THREE.WebGLRenderer, camera: THREE.Camera, subject: THREE.Object3D, detachedLights?: THREE.Object3D,
    shadow?: THREE.Object3D, colorState: 'live' | 'isolated' = 'live'): void {
    const depth = this.depth;
    if (detachedLights) this.scene.add(detachedLights);
    try {
      this.scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      this.select(camera);
      // compile gathers lights from both roots. Keep the office in only one of them.
      if (subject === detachedLights) detachedLights.removeFromParent();
      const colorScene = colorState === 'isolated' ? new THREE.Scene() : this.scene;
      if (colorScene !== this.scene) {
        // A compile on the live scene would leave its light counts in the next shadow pass.
        colorScene.environment = this.scene.environment;
        colorScene.fog = this.scene.fog;
        colorScene.traverseVisible = visit => this.scene.traverseVisible(visit);
      }
      renderer.compile(subject, camera, colorScene);
      if (shadow) {
        const depthScene = new THREE.Scene();
        // The normal pass leaves zero light counts, while the next draw still has shadows.
        const caster = new THREE.AmbientLight(0xffffff, 0);
        caster.castShadow = true; depthScene.add(caster);
        renderer.compile(shadow, camera, depthScene);
        // Shadow programs use the selected lights but no scene fog.
        depthScene.traverseVisible = visit => this.scene.traverseVisible(visit);
        renderer.compile(shadow, camera, depthScene);
      }
    } finally {
      detachedLights?.removeFromParent();
      if (this.depth > depth) this.finishSelection();
    }
  }

  dispose(): void {
    this.restore(); this.scene.onBeforeRender = this.previousBefore; this.scene.onAfterRender = this.previousAfter;
    this.pointFill?.removeFromParent();
  }
}
