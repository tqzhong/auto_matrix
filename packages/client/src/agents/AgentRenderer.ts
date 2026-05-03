import * as THREE from 'three';
import type { AgentState, AgentId } from '@auto_matrix/shared';
import { VoxelCharacterModel } from './VoxelCharacterModel.js';
import { AnimationSystem, type AnimationState } from './AnimationSystem.js';
import { lerpVector3, lerpAngle } from '../network/StateInterpolator.js';

interface AgentEntry {
  group: THREE.Group;
  targetPosition: THREE.Vector3;
  currentRotation: number;
  targetRotation: number;
  nameLabel: THREE.Sprite;
  healthBar: THREE.Mesh;
  healthBarBg: THREE.Mesh;
  lastState: AgentState;
}

export class AgentRenderer {
  private scene: THREE.Scene;
  private agents: Map<AgentId, AgentEntry> = new Map();
  private animationSystem: AnimationSystem;
  private spriteMaterial: THREE.SpriteMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.animationSystem = new AnimationSystem();
  }

  updateAgent(id: AgentId, state: AgentState): void {
    let entry = this.agents.get(id);

    if (!entry) {
      entry = this.createAgentEntry(id, state);
      this.agents.set(id, entry);
    }

    entry.targetPosition.set(state.position.x, state.position.y, state.position.z);
    entry.targetRotation = state.rotation;
    entry.lastState = state;

    this.updateHealthBar(entry, state);

    const labelSprite = entry.nameLabel;
    if (labelSprite) {
      labelSprite.position.set(0, 8, 0);
    }

    let animState: AnimationState = 'idle';
    if (state.currentAction) {
      switch (state.currentAction.type) {
        case 'move_to':
          animState = 'walk';
          break;
        case 'attack':
        case 'defend':
          animState = 'fight';
          break;
        default:
          animState = 'idle';
          break;
      }
    }
    this.animationSystem.setState(id, animState);
  }

  removeAgent(id: AgentId): void {
    const entry = this.agents.get(id);
    if (!entry) return;
    this.scene.remove(entry.group);
    this.scene.remove(entry.nameLabel);
    this.scene.remove(entry.healthBar);
    this.scene.remove(entry.healthBarBg);
    this.animationSystem.removeAgent(id);
    this.agents.delete(id);
  }

  getAgent(id: AgentId): THREE.Group | null {
    return this.agents.get(id)?.group ?? null;
  }

  getAgentState(id: AgentId): AgentState | null {
    return this.agents.get(id)?.lastState ?? null;
  }

  getAgentIds(): AgentId[] {
    return [...this.agents.keys()];
  }

  update(delta: number): void {
    for (const [_id, entry] of this.agents) {
      entry.group.position.lerp(entry.targetPosition, 1 - Math.exp(-8 * delta));

      entry.currentRotation = lerpAngle(entry.currentRotation, entry.targetRotation, delta);
      entry.group.rotation.y = entry.currentRotation;

      entry.nameLabel.position.copy(entry.group.position);
      entry.nameLabel.position.y += 8;

      entry.healthBar.position.copy(entry.group.position);
      entry.healthBar.position.y += 7;
      entry.healthBarBg.position.copy(entry.healthBar.position);
    }

    this.animationSystem.update(delta);
  }

  private createAgentEntry(id: AgentId, state: AgentState): AgentEntry {
    const group = VoxelCharacterModel.buildFromConfig(state.appearance);
    group.position.set(state.position.x, state.position.y, state.position.z);
    this.scene.add(group);

    const nameLabel = this.createNameLabel(state.name);
    this.scene.add(nameLabel);

    const { bar: healthBar, bg: healthBarBg } = this.createHealthBar();
    this.scene.add(healthBarBg);
    this.scene.add(healthBar);

    this.animationSystem.registerAgent(id, group);

    return {
      group,
      targetPosition: new THREE.Vector3(state.position.x, state.position.y, state.position.z),
      currentRotation: state.rotation,
      targetRotation: state.rotation,
      nameLabel,
      healthBar,
      healthBarBg,
      lastState: state,
    };
  }

  private createNameLabel(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 28px Courier New';
    ctx.fillStyle = '#00ff41';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 6;
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(8, 2, 1);
    return sprite;
  }

  private createHealthBar(): { bar: THREE.Mesh; bg: THREE.Mesh } {
    const bgGeom = new THREE.PlaneGeometry(3, 0.4);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x220000, side: THREE.DoubleSide });
    const bg = new THREE.Mesh(bgGeom, bgMat);

    const barGeom = new THREE.PlaneGeometry(3, 0.4);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff41, side: THREE.DoubleSide });
    const bar = new THREE.Mesh(barGeom, barMat);

    return { bar, bg };
  }

  private updateHealthBar(entry: AgentEntry, state: AgentState): void {
    const ratio = state.maxHealth > 0 ? state.health / state.maxHealth : 1;
    entry.healthBar.scale.x = Math.max(0, ratio);
    entry.healthBar.position.x -= (1 - ratio) * 1.5 * 0.5;

    const mat = entry.healthBar.material as THREE.MeshBasicMaterial;
    if (ratio > 0.6) {
      mat.color.setHex(0x00ff41);
    } else if (ratio > 0.3) {
      mat.color.setHex(0xffaa00);
    } else {
      mat.color.setHex(0xff2200);
    }
  }

  dispose(): void {
    for (const [_id, entry] of this.agents) {
      this.scene.remove(entry.group);
      this.scene.remove(entry.nameLabel);
      this.scene.remove(entry.healthBar);
      this.scene.remove(entry.healthBarBg);
    }
    this.agents.clear();
  }
}
