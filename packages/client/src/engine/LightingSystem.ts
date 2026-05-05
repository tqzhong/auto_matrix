import * as THREE from 'three';

const DAY_CYCLE_DURATION = 120;

export class LightingSystem {
  readonly ambientLight: THREE.AmbientLight;
  readonly directionalLight: THREE.DirectionalLight;
  readonly neonLights: THREE.PointLight[] = [];

  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
    this.directionalLight.position.set(100, 150, 80);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 400;
    this.directionalLight.shadow.camera.left = -200;
    this.directionalLight.shadow.camera.right = 200;
    this.directionalLight.shadow.camera.top = 200;
    this.directionalLight.shadow.camera.bottom = -200;
    scene.add(this.directionalLight);
    scene.add(this.directionalLight.target);

    this.addNeonLights(scene);
  }

  private addNeonLights(scene: THREE.Scene): void {
    const neonConfigs: [number, number, number, number][] = [
      [100, 8, 100, 0xff6600],   // warm orange
      [200, 10, 200, 0x00ccff],   // cyan
      [300, 6, 150, 0xff2244],    // red
      [150, 12, 300, 0x4488ff],   // blue
      [400, 8, 400, 0xffaa00],    // gold
      [50, 5, 250, 0xff44aa],     // pink
      [350, 10, 50, 0x00ff41],    // matrix green
      [450, 7, 300, 0xffffff],    // white
    ];

    for (const [x, y, z, color] of neonConfigs) {
      const light = new THREE.PointLight(color, 3, 50, 2);
      light.position.set(x, y, z);
      scene.add(light);
      this.neonLights.push(light);
    }
  }

  update(elapsed: number): void {
    this.elapsed = elapsed;
    const cycleT = (elapsed % DAY_CYCLE_DURATION) / DAY_CYCLE_DURATION;
    const angle = cycleT * Math.PI * 2;
    const sunX = Math.cos(angle) * 200;
    const sunY = Math.sin(angle) * 150 + 50;
    this.directionalLight.position.set(sunX, Math.max(sunY, 10), 80);
    this.directionalLight.target.position.set(256, 0, 256);

    const daylightFactor = Math.max(0, Math.sin(angle)) * 0.5 + 0.1;
    this.directionalLight.intensity = daylightFactor;
    this.ambientLight.intensity = daylightFactor * 0.4 + 0.1;

    const neonFlicker = Math.sin(elapsed * 3) * 0.3 + 0.7;
    for (let i = 0; i < this.neonLights.length; i++) {
      const offset = Math.sin(elapsed * 2 + i * 1.5) * 0.2 + 0.8;
      this.neonLights[i].intensity = 2 * offset * neonFlicker;
    }
  }

  dispose(): void {
    this.ambientLight.dispose();
    this.directionalLight.dispose();
    for (const light of this.neonLights) {
      light.dispose();
    }
  }
}
