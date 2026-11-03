import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { pillLocked, type FilmJourney } from '@auto_matrix/shared';

/** A local room capture shared by Morpheus's two small curved lenses. */
export class PillReflection {
  private body?: THREE.Object3D;
  private subject?: THREE.Object3D;
  private lenses: THREE.Mesh[] = [];
  private bridge?: THREE.Mesh;
  private callbacks = new Map<THREE.Mesh, THREE.Object3D['onBeforeRender']>();
  private materials = new Map<THREE.MeshPhysicalMaterial, { envMap: THREE.Texture | null; color: THREE.Color; metalness: number; roughness: number; intensity: number }>();
  private target?: THREE.WebGLCubeRenderTarget;
  private probe?: THREE.CubeCamera;
  private filtered?: THREE.WebGLRenderTarget;
  private pmrem?: THREE.PMREMGenerator;
  private stamp = '';
  private phase = '';
  private capturedPhase = '';
  private key = '';
  private capturedAt = -Infinity;
  private busy = false;

  update(journey: FilmJourney | undefined, body?: THREE.Object3D, subject?: THREE.Object3D): void {
    if (!journey || !pillLocked(journey) || !body) { this.dispose(); return; }
    if (this.body !== body) this.dispose();
    this.subject = subject; this.stamp = JSON.stringify(journey.pills); this.phase = journey.pills!.phase;
    if (this.lenses.length) return;
    const lenses = [-1, 1].map(side => body.getObjectByName(`morpheus-glasses-lens-${side}`));
    const bridge = body.getObjectByName('morpheus-glasses-bridge');
    if (!lenses.every(lens => lens instanceof THREE.Mesh && lens.material instanceof THREE.MeshPhysicalMaterial) || !(bridge instanceof THREE.Mesh)) return;
    this.body = body; this.bridge = bridge; this.lenses = lenses as THREE.Mesh[];
    bridge.geometry.computeBoundingBox();
    for (const lens of this.lenses) {
      lens.geometry.computeBoundingBox();
      const material = lens.material as THREE.MeshPhysicalMaterial;
      if (!this.materials.has(material)) this.materials.set(material, { envMap: material.envMap, color: material.color.clone(), metalness: material.metalness, roughness: material.roughness, intensity: material.envMapIntensity });
      const before = lens.onBeforeRender; this.callbacks.set(lens, before);
      lens.onBeforeRender = (...args) => { before.apply(lens, args); this.capture(args[0], args[1], args[2]); };
    }
  }

  private capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.busy || scene.overrideMaterial) return;
    this.applyMaterial();
    const bridge = this.bridge!, box = bridge.geometry.boundingBox!;
    // The brow extends past the nose bridge. Use the fitted lens fronts too,
    // so the shared probe does not look through the actor's nearby brow.
    const position = box.getCenter(new THREE.Vector3());
    position.z = Math.max(box.max.z, ...this.lenses.map(lens => lens.geometry.boundingBox!.max.z)) + .01; bridge.localToWorld(position);
    if (camera.getWorldPosition(new THREE.Vector3()).distanceTo(position) > 18) return;
    const props = ['held-red-pill', 'held-blue-pill'].map(name => this.body!.getObjectByName(name) as THREE.Mesh | undefined);
    const key = this.stamp + bridge.matrixWorld.elements.join(',') + (this.subject?.matrixWorld.elements.join(',') ?? '')
      + (this.subject?.getObjectByName('Anatomical_head_and_hands')?.uuid ?? '')
      + props.map(prop => prop ? [prop.visible, ...prop.matrixWorld.elements, (prop.material as THREE.MeshPhysicalMaterial).color.getHex()].join(',') : '').join('|');
    const now = performance.now();
    if (key === this.key || this.phase === this.capturedPhase && now - this.capturedAt < 1000 / 12) return;
    this.target ??= new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.target.texture.name = 'Morpheus pill-room reflection';
    this.probe ??= new THREE.CubeCamera(.02, 80, this.target); this.probe.position.copy(position);
    const glasses = this.lenses[0].parent!, visible = glasses.visible, subjectVisible = this.subject?.visible;
    const target = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const autoUpdate = renderer.shadowMap.autoUpdate, needsUpdate = renderer.shadowMap.needsUpdate, xr = renderer.xr.enabled;
    glasses.visible = false;
    if (this.subject) { this.subject.visible = true; if (!subjectVisible) this.subject.updateMatrixWorld(true); }
    // This callback runs after the main view has prepared its shadow maps.
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false; this.busy = true;
    const mirrors = new Map<Reflector, THREE.Object3D['onBeforeRender']>(), transmission = new Map<THREE.MeshPhysicalMaterial, number>();
    // One optical bounce: reuse mirror images and the cup's un-refracted
    // surface. Their nested passes also reset a cube target to face zero.
    scene.traverseVisible(object => {
      if (object instanceof Reflector) { mirrors.set(object, object.onBeforeRender); object.onBeforeRender = () => {}; }
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0 && !transmission.has(material)) {
          transmission.set(material, material.transmission); material.transmission = 0; material.needsUpdate = true;
        }
      }
    });
    try {
      this.probe.update(renderer, scene);
      this.pmrem ??= new THREE.PMREMGenerator(renderer);
      this.filtered = this.pmrem.fromCubemap(this.target.texture, this.filtered); this.applyMaterial();
      this.key = key; this.capturedAt = now; this.capturedPhase = this.phase;
    } finally {
      for (const [mirror, callback] of mirrors) mirror.onBeforeRender = callback;
      for (const [material, value] of transmission) { material.transmission = value; material.needsUpdate = true; }
      glasses.visible = visible; if (this.subject) this.subject.visible = subjectVisible!;
      renderer.setRenderTarget(target, face, mip); renderer.xr.enabled = xr;
      renderer.shadowMap.autoUpdate = autoUpdate; renderer.shadowMap.needsUpdate = needsUpdate; this.busy = false;
    }
  }

  private applyMaterial(): void {
    if (!this.filtered) return;
    for (const material of this.materials.keys()) {
      if (material.envMap !== this.filtered.texture) material.needsUpdate = true;
      material.envMap = this.filtered.texture; material.color.setScalar(.22); material.metalness = 1; material.roughness = .045; material.envMapIntensity = 1;
    }
  }

  dispose(): void {
    for (const [lens, callback] of this.callbacks) lens.onBeforeRender = callback;
    for (const [material, original] of this.materials) {
      material.envMap = original.envMap; material.color.copy(original.color); material.metalness = original.metalness;
      material.roughness = original.roughness; material.envMapIntensity = original.intensity; material.needsUpdate = true;
    }
    this.target?.dispose(); this.target?.texture.dispose();
    this.filtered?.dispose(); this.filtered?.texture.dispose(); this.pmrem?.dispose();
    this.callbacks.clear(); this.materials.clear(); this.lenses = []; this.body = this.subject = this.bridge = undefined;
    this.target = this.probe = this.filtered = this.pmrem = undefined; this.key = this.stamp = this.phase = this.capturedPhase = ''; this.capturedAt = -Infinity;
  }
}
