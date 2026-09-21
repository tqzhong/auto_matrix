import * as THREE from 'three';

export class LightingSystem {
  readonly ambientLight: THREE.HemisphereLight;
  readonly directionalLight: THREE.DirectionalLight;
  private fill = new THREE.DirectionalLight(0xc3d4d1, .75);
  private timeOfDay = 7500;
  private closeShadows = false;

  constructor(private scene: THREE.Scene) {
    this.ambientLight = new THREE.HemisphereLight(0xd3e3f0, 0x5f5343, .9);
    this.directionalLight = new THREE.DirectionalLight(0xe7e2ce, 2);
    this.directionalLight.position.set(600, 800, 300);
    this.directionalLight.target.position.set(1120, 0, 920);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.directionalLight.shadow.camera, { left: -650, right: 650, top: 650, bottom: -650, near: 10, far: 1800 });
    this.directionalLight.shadow.bias = -0.00008;
    this.directionalLight.shadow.normalBias = .045;
    scene.add(this.ambientLight, this.directionalLight, this.directionalLight.target, this.fill, this.fill.target);
  }
  setTime(time: number): void { this.timeOfDay = time; }
  update(_elapsed: number, camera?: THREE.Camera): void {
    const daylight = Math.max(0, Math.sin((this.timeOfDay / 24000 - 0.25) * Math.PI * 2));
    this.ambientLight.intensity = .5 + daylight * 1.1;
    this.directionalLight.intensity = .35 + daylight * 2.6;
    this.directionalLight.color.setHex(0xffd7a7).lerp(new THREE.Color(0xfff7e6), daylight);
    if (this.closeShadows !== Boolean(camera)) {
      this.closeShadows = Boolean(camera);
      const extent = camera ? 75 : 650;
      Object.assign(this.directionalLight.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: camera ? 360 : 1800 });
      this.directionalLight.shadow.camera.updateProjectionMatrix();
    }
    const center = camera ? new THREE.Vector3(Math.round(camera.position.x / 4) * 4, camera.position.y - 5, Math.round(camera.position.z / 4) * 4) : new THREE.Vector3(1120, 0, 920);
    this.directionalLight.target.position.copy(center);
    const angle = (this.timeOfDay / 24000 - .25) * Math.PI * 2;
    this.directionalLight.position.copy(center).add(new THREE.Vector3(-Math.cos(angle) * 90, 35 + daylight * 100, 45).multiplyScalar(camera ? 1 : 5));
    this.fill.visible = Boolean(camera);
    if (camera) {
      this.fill.position.copy(camera.position).add(new THREE.Vector3(0, 8, 0));
      this.fill.target.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 14);
    }
  }
  dispose(): void {
    this.scene.remove(this.ambientLight, this.directionalLight, this.directionalLight.target, this.fill, this.fill.target);
    this.ambientLight.dispose(); this.directionalLight.dispose(); this.fill.dispose();
  }
}
