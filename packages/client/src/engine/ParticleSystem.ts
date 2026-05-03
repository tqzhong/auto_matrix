import * as THREE from 'three';

const CODE_RAIN_COUNT = 500;
const BULLET_TIME_COUNT = 200;

interface ParticleEffect {
  type: string;
  mesh: THREE.Points;
  velocities: Float32Array;
  lifetimes: Float32Array;
  maxLifetime: number;
  elapsed: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private effects: ParticleEffect[] = [];
  private codeRainGeometry: THREE.BufferGeometry | null = null;
  private codeRainMaterial: THREE.PointsMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawnCodeRain(): void {
    const count = CODE_RAIN_COUNT;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 500 + 256;
      positions[i3 + 1] = Math.random() * 200 + 100;
      positions[i3 + 2] = (Math.random() - 0.5) * 500 + 256;
      velocities[i3] = (Math.random() - 0.5) * 2;
      velocities[i3 + 1] = -30 - Math.random() * 40;
      velocities[i3 + 2] = (Math.random() - 0.5) * 2;
      lifetimes[i] = Math.random() * 4 + 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00ff41,
      size: 1.5,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Points(geometry, material);
    this.scene.add(mesh);

    this.effects.push({
      type: 'code_rain',
      mesh,
      velocities,
      lifetimes,
      maxLifetime: 8,
      elapsed: 0,
    });
  }

  spawnBulletTime(position: THREE.Vector3): void {
    const count = BULLET_TIME_COUNT;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = position.x + (Math.random() - 0.5) * 10;
      positions[i3 + 1] = position.y + Math.random() * 5;
      positions[i3 + 2] = position.z + (Math.random() - 0.5) * 10;
      velocities[i3] = (Math.random() - 0.5) * 15;
      velocities[i3 + 1] = Math.random() * 5;
      velocities[i3 + 2] = (Math.random() - 0.5) * 15;
      lifetimes[i] = Math.random() * 2 + 1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00ccff,
      size: 0.8,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Points(geometry, material);
    this.scene.add(mesh);

    this.effects.push({
      type: 'bullet_time',
      mesh,
      velocities,
      lifetimes,
      maxLifetime: 3,
      elapsed: 0,
    });
  }

  spawnEffect(type: string, position: THREE.Vector3): void {
    switch (type) {
      case 'code_rain':
        this.spawnCodeRain();
        break;
      case 'bullet_time':
      case 'slow_motion':
        this.spawnBulletTime(position);
        break;
      default:
        this.spawnBulletTime(position);
        break;
    }
  }

  update(delta: number): void {
    const toRemove: number[] = [];

    for (let e = 0; e < this.effects.length; e++) {
      const effect = this.effects[e];
      effect.elapsed += delta;

      if (effect.elapsed >= effect.maxLifetime) {
        toRemove.push(e);
        continue;
      }

      const positions = effect.mesh.geometry.attributes.position.array as Float32Array;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3] += effect.velocities[i3] * delta;
        positions[i3 + 1] += effect.velocities[i3 + 1] * delta;
        positions[i3 + 2] += effect.velocities[i3 + 2] * delta;

        effect.lifetimes[i] -= delta;
        if (effect.type === 'code_rain' && positions[i3 + 1] < -10) {
          positions[i3 + 1] = 200 + Math.random() * 50;
          effect.lifetimes[i] = Math.random() * 4 + 2;
        }
      }

      (effect.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      const fadeStart = effect.maxLifetime * 0.7;
      if (effect.elapsed > fadeStart) {
        (effect.mesh.material as THREE.PointsMaterial).opacity =
          0.8 * (1 - (effect.elapsed - fadeStart) / (effect.maxLifetime - fadeStart));
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const effect = this.effects[idx];
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      (effect.mesh.material as THREE.Material).dispose();
      this.effects.splice(idx, 1);
    }
  }

  dispose(): void {
    for (const effect of this.effects) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      (effect.mesh.material as THREE.Material).dispose();
    }
    this.effects = [];
    this.codeRainGeometry?.dispose();
    this.codeRainMaterial?.dispose();
  }
}
