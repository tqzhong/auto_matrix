import * as THREE from 'three';
import type { AppearanceConfig } from '@auto_matrix/shared';

const VOXEL_SIZE = 1;

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const geom = new THREE.BoxGeometry(w * VOXEL_SIZE, h * VOXEL_SIZE, d * VOXEL_SIZE);
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geom, mat);
}

function colorFromHex(hex: string): number {
  if (hex.startsWith('#')) {
    return parseInt(hex.slice(1), 16);
  }
  return parseInt(hex, 16) || 0x888888;
}

export class VoxelCharacterModel {
  static buildFromConfig(config: AppearanceConfig): THREE.Group {
    const group = new THREE.Group();
    const bodyColor = colorFromHex(config.bodyColor);
    const headColor = colorFromHex(config.headColor);

    const head = box(2, 2, 1, headColor);
    head.position.y = 5.5 * VOXEL_SIZE;
    group.add(head);

    const body = box(2, 3, 1, bodyColor);
    body.position.y = 3 * VOXEL_SIZE;
    group.add(body);

    const leftLeg = box(1, 2, 1, bodyColor);
    leftLeg.position.set(-0.5 * VOXEL_SIZE, 0.5 * VOXEL_SIZE, 0);
    group.add(leftLeg);

    const rightLeg = box(1, 2, 1, bodyColor);
    rightLeg.position.set(0.5 * VOXEL_SIZE, 0.5 * VOXEL_SIZE, 0);
    group.add(rightLeg);

    if (config.isAgent) {
      const suit = box(2.2, 3.2, 1.1, 0x111111);
      suit.position.y = 3 * VOXEL_SIZE;
      group.add(suit);

      const tie = box(0.3, 1.5, 0.2, 0x880000);
      tie.position.set(0, 3.2 * VOXEL_SIZE, 0.6 * VOXEL_SIZE);
      group.add(tie);
    }

    if (config.clothing === 'trench_coat') {
      const coat = box(2.6, 4, 1.2, 0x3a3020);
      coat.position.y = 2.5 * VOXEL_SIZE;
      group.add(coat);
    }

    if (config.accessories.includes('sunglasses')) {
      const glasses = box(2, 0.5, 0.3, 0x111111);
      glasses.position.set(0, 6 * VOXEL_SIZE, 0.5 * VOXEL_SIZE);
      group.add(glasses);
    }

    return group;
  }
}
