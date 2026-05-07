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
    this.directionalLight.position.set(1280, 300, 1280);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 2000;
    this.directionalLight.shadow.camera.left = -800;
    this.directionalLight.shadow.camera.right = 800;
    this.directionalLight.shadow.camera.top = 800;
    this.directionalLight.shadow.camera.bottom = -800;
    scene.add(this.directionalLight);
    scene.add(this.directionalLight.target);

    this.addNeonLights(scene);
  }

  private addNeonLights(scene: THREE.Scene): void {
    // NYC Times Square area neon lights (scaled to 2560 world)
    const neonConfigs: [number, number, number, number][] = [
      [1100, 12, 940, 0xff6600],   // Times Square warm orange
      [1080, 15, 920, 0x00ccff],   // Times Square cyan
      [1120, 10, 960, 0xff2244],   // Times Square red
      [1060, 18, 930, 0x4488ff],   // Times Square blue
      [1140, 12, 950, 0xffaa00],   // Times Square gold
      [1070, 8, 910, 0xff44aa],    // Times Square pink
      [1090, 14, 970, 0x00ff41],   // Times Square matrix green
      [1110, 10, 945, 0xffffff],   // Times Square white
      // Downtown / Wall Street
      [600, 8, 400, 0xffaa00],
      [650, 10, 350, 0x00ff41],
      // Brooklyn
      [400, 6, 1800, 0xff6600],
      // Upper East Side
      [1800, 8, 600, 0x4488ff],
      // Midtown avenue neon
      [1200, 15, 850, 0xff2244],
      [1000, 12, 880, 0x00ccff],
    ];

    for (const [x, y, z, color] of neonConfigs) {
      const light = new THREE.PointLight(color, 5, 120, 2);
      light.position.set(x, y, z);
      scene.add(light);
      this.neonLights.push(light);
    }
  }

  update(elapsed: number): void {
    this.elapsed = elapsed;
    const cycleT = (elapsed % DAY_CYCLE_DURATION) / DAY_CYCLE_DURATION;
    const angle = cycleT * Math.PI * 2;
    const sunX = Math.cos(angle) * 1000 + 1280;
    const sunY = Math.sin(angle) * 600 + 200;
    this.directionalLight.position.set(sunX, Math.max(sunY, 50), 1280);
    this.directionalLight.target.position.set(1280, 0, 1280);

    const daylightFactor = Math.max(0, Math.sin(angle)) * 0.5 + 0.1;
    this.directionalLight.intensity = daylightFactor;
    this.ambientLight.intensity = daylightFactor * 0.4 + 0.1;

    const neonFlicker = Math.sin(elapsed * 3) * 0.3 + 0.7;
    for (let i = 0; i < this.neonLights.length; i++) {
      const offset = Math.sin(elapsed * 2 + i * 1.5) * 0.2 + 0.8;
      this.neonLights[i].intensity = 4 * offset * neonFlicker;
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
