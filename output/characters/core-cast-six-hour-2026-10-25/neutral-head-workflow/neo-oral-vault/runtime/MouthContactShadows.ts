import * as THREE from 'three';

export interface MouthShadowData { mapSize: number; halfSpan: number; distance: number; bias: number }

/** A small directional shadow pass using the actual current skinned head. */
export class MouthContactShadows {
  readonly targets: THREE.WebGLRenderTarget[];
  readonly count = { value: 0 };
  readonly matrices = { value: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()] };
  readonly directions = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
  private worldDirections = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private scenes = new WeakMap<THREE.Scene, THREE.DirectionalLight[]>();
  private previous: number[] = [];
  private previousGeometry?: THREE.BufferGeometry;
  private depthScene = new THREE.Scene();
  private depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  private depthMesh: THREE.SkinnedMesh;
  private camera = new THREE.OrthographicCamera();
  private center = new THREE.Vector3();
  private frame = new THREE.Matrix4();
  private scale = new THREE.Vector3();
  private target = new THREE.Vector3();
  private viewport = new THREE.Vector4();
  private scissor = new THREE.Vector4();
  private clearColor = new THREE.Color();
  private biasMatrix = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);

  constructor(private face: THREE.SkinnedMesh, private data: MouthShadowData) {
    this.targets = Array.from({ length: 3 }, () => new THREE.WebGLRenderTarget(data.mapSize, data.mapSize, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false }));
    this.depthMesh = new THREE.SkinnedMesh(face.geometry, this.depthMaterial); this.depthMesh.matrixAutoUpdate = false;
    this.depthMesh.bindMode = face.bindMode; this.depthMesh.frustumCulled = false; this.depthScene.add(this.depthMesh); this.depthScene.background = new THREE.Color(1, 1, 1);
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, receiver: THREE.SkinnedMesh, centerBind: THREE.Vector3): void {
    let lights = this.scenes.get(scene);
    if (!lights) {
      lights = []; scene.traverse(object => { if (object instanceof THREE.DirectionalLight) lights!.push(object); });
      lights.sort((a, b) => b.intensity - a.intensity); this.scenes.set(scene, lights);
    }
    const active = lights.filter(light => light.visible && light.intensity > 0).sort((a, b) => b.intensity - a.intensity).slice(0, 3); this.count.value = active.length;
    if (!active.length) return;
    const bone = receiver.skeleton.bones.findIndex(item => item.name === 'head');
    this.frame.copy(receiver.matrixWorld).multiply(receiver.bindMatrixInverse).multiply(receiver.skeleton.bones[bone].matrixWorld)
      .multiply(receiver.skeleton.boneInverses[bone]).multiply(receiver.bindMatrix);
    this.center.copy(centerBind).applyMatrix4(this.frame); this.scale.setFromMatrixScale(this.frame);
    const size = Math.max(this.scale.x, this.scale.y, this.scale.z);
    this.face.skeleton.update();
    const input = [...this.face.skeleton.boneMatrices, ...this.face.matrixWorld.elements, ...(this.face.morphTargetInfluences ?? []),
      (this.face.geometry.attributes.position as THREE.BufferAttribute).version, this.center.x, this.center.y, this.center.z, size, active.length];
    active.forEach((light, i) => {
      const direction = this.worldDirections[i]; light.getWorldPosition(direction); direction.sub(light.target.getWorldPosition(this.target)).normalize();
      this.directions.value[i].copy(direction).transformDirection(camera.matrixWorldInverse); input.push(...direction.toArray());
    });
    if (this.previousGeometry === this.face.geometry && input.length === this.previous.length && input.every((value, i) => value === this.previous[i])) return;
    this.depthMesh.geometry = this.face.geometry; this.depthMesh.skeleton = this.face.skeleton;
    this.depthMesh.bindMode = this.face.bindMode;
    this.depthMesh.bindMatrix.copy(this.face.bindMatrix); this.depthMesh.bindMatrixInverse.copy(this.face.bindMatrixInverse);
    this.depthMesh.matrix.copy(this.face.matrixWorld); this.depthMesh.matrixWorldNeedsUpdate = true;
    this.depthMesh.morphTargetInfluences = this.face.morphTargetInfluences; this.depthMesh.morphTargetDictionary = this.face.morphTargetDictionary;
    const span = this.data.halfSpan * size, distance = this.data.distance * size;
    Object.assign(this.camera, { left: -span, right: span, top: span, bottom: -span, near: distance - span * 2, far: distance + span * 2 });
    this.camera.updateProjectionMatrix();
    const renderTarget = renderer.getRenderTarget(), xrEnabled = renderer.xr.enabled, shadowAuto = renderer.shadowMap.autoUpdate, infoAuto = renderer.info.autoReset;
    renderer.getViewport(this.viewport); renderer.getScissor(this.scissor); const scissorTest = renderer.getScissorTest(); renderer.getClearColor(this.clearColor); const clearAlpha = renderer.getClearAlpha();
    try {
      renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; renderer.info.autoReset = false; renderer.setScissorTest(false);
      for (let i = 0; i < active.length; i++) {
        const direction = this.worldDirections[i]; this.camera.position.copy(this.center).addScaledVector(direction, distance);
        this.camera.up.set(Math.abs(direction.y) > .95 ? 1 : 0, Math.abs(direction.y) > .95 ? 0 : 1, 0); this.camera.lookAt(this.center); this.camera.updateMatrixWorld(true);
        this.matrices.value[i].copy(this.biasMatrix).multiply(this.camera.projectionMatrix).multiply(this.camera.matrixWorldInverse);
        renderer.setRenderTarget(this.targets[i]); renderer.state.buffers.depth.setMask(true); renderer.clear(); renderer.render(this.depthScene, this.camera);
      }
      this.previous = input; this.previousGeometry = this.face.geometry;
    } finally {
      renderer.xr.enabled = xrEnabled; renderer.shadowMap.autoUpdate = shadowAuto; renderer.info.autoReset = infoAuto;
      renderer.setRenderTarget(renderTarget); renderer.setViewport(this.viewport); renderer.setScissor(this.scissor); renderer.setScissorTest(scissorTest); renderer.setClearColor(this.clearColor, clearAlpha);
    }
  }

  patch(shader: Parameters<THREE.Material['onBeforeCompile']>[0], tissueMask?: string): void {
    Object.assign(shader.uniforms, { oralContactCount: this.count, oralContactMatrices: this.matrices, oralContactDirections: this.directions,
      oralContactMap0: { value: this.targets[0].texture }, oralContactMap1: { value: this.targets[1].texture }, oralContactMap2: { value: this.targets[2].texture },
      oralContactTexel: { value: 1 / this.data.mapSize }, oralContactBias: { value: this.data.bias } });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOralWorldPosition;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvOralWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vOralWorldPosition;
      uniform float oralContactCount;
      uniform mat4 oralContactMatrices[3];
      uniform vec3 oralContactDirections[3];
      uniform sampler2D oralContactMap0;
      uniform sampler2D oralContactMap1;
      uniform sampler2D oralContactMap2;
      uniform float oralContactTexel;
      uniform float oralContactBias;
    `).replace('#include <packing>', `#include <packing>
      float oralDepthVisibility(sampler2D map, mat4 matrix) {
        vec4 projected = matrix * vec4(vOralWorldPosition, 1.0);
        vec3 point = projected.xyz / projected.w;
        if (any(lessThan(point, vec3(0.0))) || any(greaterThan(point, vec3(1.0)))) return 1.0;
        float visibility = 0.0;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++)
          visibility += step(point.z - oralContactBias, unpackRGBAToDepth(texture2D(map, point.xy + vec2(float(x), float(y)) * oralContactTexel)));
        return visibility / 9.0;
      }
      float oralDirectVisibility(vec3 direction) {
        if (oralContactCount > 0.5 && dot(direction, oralContactDirections[0]) > 0.9999) return oralDepthVisibility(oralContactMap0, oralContactMatrices[0]);
        if (oralContactCount > 1.5 && dot(direction, oralContactDirections[1]) > 0.9999) return oralDepthVisibility(oralContactMap1, oralContactMatrices[1]);
        if (oralContactCount > 2.5 && dot(direction, oralContactDirections[2]) > 0.9999) return oralDepthVisibility(oralContactMap2, oralContactMatrices[2]);
        return 1.0;
      }
    `).replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;',
      `vec3 irradiance = dotNL * directLight.color * ${tissueMask ? `mix(1.0, oralDirectVisibility(directLight.direction), clamp(${tissueMask}, 0.0, 1.0))` : 'oralDirectVisibility(directLight.direction)'};`));
  }

  dispose(): void { this.targets.forEach(target => target.dispose()); this.depthMaterial.dispose(); this.depthScene.remove(this.depthMesh); }
}
