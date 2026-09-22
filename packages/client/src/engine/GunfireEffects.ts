import * as THREE from 'three';
import type { CombatImpact } from '@auto_matrix/shared';
import type { GameAudio } from './GameAudio.js';

export class GunfireEffects {
  private flashes: { group: THREE.Group; line: THREE.Line; light: THREE.PointLight; age: number }[] = [];
  private debris: { mesh: THREE.Mesh; velocity: THREE.Vector3; age: number }[] = [];
  private clouds: { sprite: THREE.Sprite; age: number }[] = [];
  private chip = new THREE.TetrahedronGeometry(1);
  private stone = new THREE.MeshStandardMaterial({ color: 0xaeb6a4, roughness: .94 });
  private flash = new THREE.MeshBasicMaterial({ color: 0xffdd9e, transparent: true, opacity: .9, toneMapped: false });
  private muzzle = new THREE.SphereGeometry(.12, 8, 6);
  private dust: THREE.CanvasTexture;
  private noise?: AudioBuffer;
  constructor(private scene: THREE.Scene, private audio: GameAudio) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#bdc4acaa'); gradient.addColorStop(.35, '#adb59e55'); gradient.addColorStop(1, '#a5ae9600');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); this.dust = new THREE.CanvasTexture(canvas);
  }
  shot(hit: CombatImpact, muzzle?: THREE.Vector3): void {
    const shot = hit.shot!; const from = muzzle ?? new THREE.Vector3(shot.from.x, shot.from.y, shot.from.z); const to = new THREE.Vector3(hit.position.x, hit.position.y, hit.position.z);
    if (this.flashes.length >= 18) this.removeFlash(this.flashes.shift()!);
    const group = new THREE.Group(); group.position.copy(from);
    const flare = new THREE.Mesh(this.muzzle, this.flash); flare.scale.set(1, 1, 2.7); flare.lookAt(to.clone().sub(from)); group.add(flare);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), to.clone().sub(from)]), new THREE.LineBasicMaterial({ color: 0xebd8a0, transparent: true, opacity: .6, toneMapped: false, depthWrite: false })); group.add(line);
    const light = new THREE.PointLight(0xffd495, 85, 9); group.add(light); this.scene.add(group); this.flashes.push({ group, line, light, age: 0 });
    if (shot.surface === 'stone') {
      for (let i = 0; i < 10; i++) {
        if (this.debris.length >= 180) { const old = this.debris.shift()!; old.mesh.removeFromParent(); }
        const mesh = new THREE.Mesh(this.chip, this.stone); mesh.position.copy(to); mesh.scale.setScalar(.06 + Math.random() * .16); this.scene.add(mesh);
        this.debris.push({ mesh, velocity: new THREE.Vector3((Math.random() - .5) * 7 - hit.direction.x * 3, Math.random() * 4 + 1, (Math.random() - .5) * 7 - hit.direction.z * 3), age: 0 });
      }
      if (this.clouds.length >= 28) { const old = this.clouds.shift()!; old.sprite.removeFromParent(); old.sprite.material.dispose(); }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dust, transparent: true, opacity: .45, depthWrite: false })); sprite.position.copy(to); this.scene.add(sprite); this.clouds.push({ sprite, age: 0 });
    }
    this.sound();
  }
  private sound(): void {
    const audio = this.audio.effects(); if (!audio) return;
    const ctx = audio.context; const now = ctx.currentTime;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .24), ctx.sampleRate); const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / ctx.sampleRate * 36);
    }
    const noise = ctx.createBufferSource(); noise.buffer = this.noise;
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 380;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(.24, now); gain.gain.exponentialRampToValueAtTime(.001, now + .23);
    noise.connect(filter); filter.connect(gain); gain.connect(audio.output);
    const echo = ctx.createDelay(.2); echo.delayTime.value = .085; const echoGain = ctx.createGain(); echoGain.gain.value = .22;
    gain.connect(echo); echo.connect(echoGain); echoGain.connect(audio.output); noise.start(now);
    noise.onended = () => window.setTimeout(() => { noise.disconnect(); filter.disconnect(); gain.disconnect(); echo.disconnect(); echoGain.disconnect(); }, 250);
  }
  update(dt: number): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const item = this.flashes[i]; item.age += dt;
      (item.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, .6 * (1 - item.age / .1)); item.light.intensity = Math.max(0, 85 * (1 - item.age / .07));
      if (item.age > .1) { this.removeFlash(item); this.flashes.splice(i, 1); }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const item = this.debris[i]; item.age += dt; item.velocity.y -= 18 * dt;
      item.mesh.position.addScaledVector(item.velocity, dt); item.mesh.rotation.x += dt * 5; item.mesh.rotation.z += dt * 3;
      if (item.mesh.position.y < .12) { item.mesh.position.y = .12; item.velocity.y = Math.abs(item.velocity.y) * .25; item.velocity.x *= .65; item.velocity.z *= .65; }
      if (item.age > 2.5) { item.mesh.removeFromParent(); this.debris.splice(i, 1); }
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const item = this.clouds[i]; item.age += dt; item.sprite.position.y += dt * .35;
      item.sprite.scale.setScalar(.8 + item.age * 2.5); item.sprite.material.opacity = Math.max(0, .45 * (1 - item.age / 2));
      if (item.age > 2) { item.sprite.removeFromParent(); item.sprite.material.dispose(); this.clouds.splice(i, 1); }
    }
  }
  private removeFlash(item: typeof this.flashes[number]): void { item.group.removeFromParent(); item.line.geometry.dispose(); (item.line.material as THREE.Material).dispose(); item.light.dispose(); }
  dispose(): void {
    this.flashes.forEach(item => this.removeFlash(item)); this.debris.forEach(item => item.mesh.removeFromParent());
    this.clouds.forEach(item => { item.sprite.removeFromParent(); item.sprite.material.dispose(); });
    this.chip.dispose(); this.stone.dispose(); this.flash.dispose(); this.muzzle.dispose(); this.dust.dispose();
  }
}
