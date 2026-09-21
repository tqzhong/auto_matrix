import * as THREE from 'three';
import type { CombatImpact, SkillCast } from '@auto_matrix/shared';
import type { GameAudio } from './GameAudio.js';

interface Burst {
  group: THREE.Group;
  streaks: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  velocities: THREE.Vector3[];
  flash: THREE.Sprite;
  label: THREE.Sprite;
  age: number;
  heavy: boolean;
}

export class CombatEffects {
  private bursts: Burst[] = [];
  private pulses: { group: THREE.Group; material: THREE.MeshBasicMaterial; age: number; radius: number; duration: number; direction: THREE.Vector3 }[] = [];
  private ring = new THREE.RingGeometry(.94, 1, 64);
  private flashTexture: THREE.CanvasTexture;

  constructor(private scene: THREE.Scene, private audio: GameAudio) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    glow.addColorStop(0, '#ffffff'); glow.addColorStop(.18, '#ffffffbb'); glow.addColorStop(1, '#ffffff00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 64, 64);
    this.flashTexture = new THREE.CanvasTexture(canvas);
  }

  private playSound(heavy: boolean, skill = false): void {
    const sound = this.audio.effects(); if (!sound) return;
    const ctx = sound.context; const now = ctx.currentTime;
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(skill ? 250 : heavy ? 125 : 180, now);
    oscillator.frequency.exponentialRampToValueAtTime(skill ? 70 : 45, now + .13);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(heavy ? .12 : .07, now + .006);
    gain.gain.exponentialRampToValueAtTime(.001, now + .18);
    oscillator.connect(gain); gain.connect(sound.output); oscillator.start(); oscillator.stop(now + .2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .075), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2 * .1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = heavy ? 1300 : 2100;
    noise.connect(filter); filter.connect(sound.output); noise.start();
    noise.onended = () => { noise.disconnect(); filter.disconnect(); };
  }

  skill(cast: SkillCast): void {
    if (this.pulses.length >= 12) this.removePulse(this.pulses.shift()!);
    const fast = ['scorpion_dash', 'dodge', 'phase_shift', 'escape', 'agent_evade'].includes(cast.skill);
    const guard = ['iron_guard', 'foresight'].includes(cast.skill);
    const color = cast.skill === 'viral_overwrite' ? '#aac876' : cast.skill === 'crushing_palm' || guard ? '#efdaa6' : fast ? '#b7e0df' : '#9fe6b3';
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const group = new THREE.Group(); group.position.set(cast.position.x, cast.position.y + .03, cast.position.z);
    const radius = cast.skill === 'force_push' ? 8 : cast.skill === 'system_hack' ? 9 : guard ? 2 : fast ? 1.3 : 3;
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(this.ring, material); mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = i * (guard ? .85 : .14); mesh.scale.setScalar(1 - i * .14);
      if (guard) { mesh.rotation.x = i * Math.PI / 3; mesh.position.y = 1.6; }
      group.add(mesh);
    }
    if (fast) group.rotation.y = Math.atan2(cast.direction.x, cast.direction.z);
    this.scene.add(group); this.pulses.push({ group, material, age: 0, radius, duration: fast ? .35 : .75,
      direction: new THREE.Vector3(cast.direction.x, 0, cast.direction.z).multiplyScalar(fast ? 10 : 0) });
    this.playSound(false, true);
  }

  impact(hit: CombatImpact, hurtPlayer: boolean): void {
    if (this.bursts.length >= 20) this.remove(this.bursts.shift()!);
    const heavy = hit.combo === 2; const count = heavy ? 20 : 12;
    if (hit.damage > 0) this.playSound(heavy);
    const group = new THREE.Group(); group.position.set(hit.position.x, hit.position.y, hit.position.z);
    const positions = new Float32Array(count * 6);
    const velocities = Array.from({ length: count }, () => new THREE.Vector3(
      (Math.random() - .5) * 5 + hit.direction.x * 3, (Math.random() - .35) * 4, (Math.random() - .5) * 5 + hit.direction.z * 3));
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const streaks = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: hurtPlayer ? '#e7a18a' : heavy ? '#d7efb1' : '#e8e8d9', transparent: true, depthWrite: false, toneMapped: false }));
    group.add(streaks);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTexture, color: '#eff3d8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    group.add(flash);
    const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 80;
    const ctx = canvas.getContext('2d')!; ctx.font = '600 34px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillStyle = hurtPlayer ? '#f4ab99' : '#f0efd9';
    ctx.fillText(hit.downed ? '击倒' : `${heavy ? '重击 ' : ''}${hit.damage}`, 96, 40);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    label.scale.set(1.6, .67, 1); label.position.y = .65; group.add(label);
    this.scene.add(group); this.bursts.push({ group, streaks, velocities, flash, label, age: 0, heavy });
  }

  update(delta: number): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i]; pulse.age += delta;
      if (pulse.age > pulse.duration) { this.removePulse(pulse); this.pulses.splice(i, 1); continue; }
      const t = pulse.age / pulse.duration;
      pulse.group.scale.setScalar(.4 + pulse.radius * (1 - (1 - t) ** 3));
      pulse.group.position.addScaledVector(pulse.direction, delta);
      pulse.material.opacity = (1 - t) ** 2 * .6;
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i]; burst.age += delta;
      if (burst.age > .65) { this.remove(burst); this.bursts.splice(i, 1); continue; }
      const t = burst.age;
      const positions = burst.streaks.geometry.attributes.position;
      burst.velocities.forEach((velocity, n) => {
        const tail = Math.max(0, t - .035);
        positions.setXYZ(n * 2, velocity.x * t, velocity.y * t - 3 * t * t, velocity.z * t);
        positions.setXYZ(n * 2 + 1, velocity.x * tail, velocity.y * tail - 3 * tail * tail, velocity.z * tail);
      });
      positions.needsUpdate = true;
      burst.streaks.material.opacity = Math.max(0, 1 - t / .24);
      burst.flash.material.opacity = Math.max(0, 1 - t / .09);
      burst.flash.scale.setScalar((burst.heavy ? 1.2 : .7) + t * 4);
      burst.label.position.y = .65 + t * 1.25;
      burst.label.material.opacity = Math.min(1, Math.max(0, (.65 - t) / .2));
    }
  }

  private remove(burst: Burst): void {
    this.scene.remove(burst.group); burst.streaks.geometry.dispose(); burst.streaks.material.dispose();
    burst.flash.material.dispose(); burst.label.material.map?.dispose(); burst.label.material.dispose();
  }
  private removePulse(pulse: typeof this.pulses[number]): void { this.scene.remove(pulse.group); pulse.material.dispose(); }
  dispose(): void {
    this.bursts.forEach(burst => this.remove(burst)); this.bursts = []; this.flashTexture.dispose();
    this.pulses.forEach(pulse => this.removePulse(pulse)); this.pulses = []; this.ring.dispose();
  }
}
