import * as THREE from 'three';
import { generateWorldAround, BLOCK_COLORS, CHUNK_SIZE } from '../voxel/WorldGenerator.js';

const MAX_INSTANCES_PER_TYPE = 50000;
const LOAD_RADIUS = 12; // chunks around camera center
const CULL_DISTANCE = 220; // hide chunks beyond this (in chunk units)
const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();

interface ChunkMeshes {
  meshes: Map<number, THREE.InstancedMesh>;
  key: string;
}

export class VoxelRenderer {
  private scene: THREE.Scene;
  private chunks: Map<string, ChunkMeshes> = new Map();
  private geometry: THREE.BoxGeometry;
  private initialized = false;
  private loadedRegions: Set<string> = new Set();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  init(): void {
    if (this.initialized) return;
    // Load initial area around world center (1280, 1280)
    this.loadChunksAround(1280, 1280, LOAD_RADIUS);
    this.initialized = true;
  }

  /**
   * Load chunks around a world position. Only loads chunks not already loaded.
   */
  loadChunksAround(worldX: number, worldZ: number, radiusChunks: number = LOAD_RADIUS): number {
    const centerCX = Math.floor(worldX / CHUNK_SIZE);
    const centerCZ = Math.floor(worldZ / CHUNK_SIZE);
    const worldChunks = generateWorldAround(worldX, worldZ, radiusChunks);
    let loaded = 0;

    for (const [key, blocks] of worldChunks) {
      if (!this.chunks.has(key)) {
        this.addChunk(key, blocks);
        loaded++;
      }
    }

    return loaded;
  }

  /**
   * Update which chunks are visible based on camera position.
   * Unloads distant chunks and loads new ones as the camera moves.
   */
  updateVisibility(cameraWorldX: number, cameraWorldZ: number): void {
    const camCX = Math.floor(cameraWorldX / CHUNK_SIZE);
    const camCZ = Math.floor(cameraWorldZ / CHUNK_SIZE);

    // Unload distant chunks
    for (const [key, chunk] of this.chunks) {
      const parts = key.split(',');
      const cx = parseInt(parts[0]);
      const cz = parseInt(parts[2]);
      const dx = cx - camCX;
      const dz = cz - camCZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > CULL_DISTANCE) {
        this.removeChunk(key);
      }
    }

    // Load new chunks within radius
    this.loadChunksAround(cameraWorldX, cameraWorldZ, LOAD_RADIUS);
  }

  addChunk(key: string, blocks: Uint8Array | number[]): void {
    const blockArray = blocks instanceof Uint8Array ? blocks : new Uint8Array(blocks);
    const meshes = this.buildChunkMeshes(key, blockArray);
    this.chunks.set(key, meshes);
  }

  updateChunk(key: string, blocks: Uint8Array | number[]): void {
    this.removeChunk(key);
    this.addChunk(key, blocks);
  }

  removeChunk(key: string): void {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    for (const mesh of chunk.meshes.values()) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.chunks.delete(key);
  }

  getLoadedChunkCount(): number {
    return this.chunks.size;
  }

  private buildChunkMeshes(key: string, blocks: Uint8Array): ChunkMeshes {
    const blockCounts = new Map<number, number>();
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b !== 0) {
        blockCounts.set(b, (blockCounts.get(b) || 0) + 1);
      }
    }

    const meshes = new Map<number, THREE.InstancedMesh>();
    const meshParts = key.split(',');
    const baseX = parseInt(meshParts[0]) * CHUNK_SIZE;
    const baseZ = parseInt(meshParts[2]) * CHUNK_SIZE;

    for (const [blockType, count] of blockCounts) {
      const clampedCount = Math.min(count, MAX_INSTANCES_PER_TYPE);
      const colorHex = BLOCK_COLORS[blockType] ?? 0x888888;
      const material = new THREE.MeshLambertMaterial({ color: colorHex });
      const mesh = new THREE.InstancedMesh(this.geometry, material, clampedCount);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      let instanceIdx = 0;
      for (let i = 0; i < blocks.length && instanceIdx < clampedCount; i++) {
        if (blocks[i] !== blockType) continue;
        const lx = i % CHUNK_SIZE;
        const ly = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
        const lz = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));

        const wx = baseX + lx;
        const wy = ly;
        const wz = baseZ + lz;

        if (wy > 0) {
          tempMatrix.makeTranslation(wx + 0.5, wy + 0.5, wz + 0.5);
          mesh.setMatrixAt(instanceIdx, tempMatrix);
        } else {
          tempMatrix.makeTranslation(wx + 0.5, wy, wz + 0.5);
          mesh.setMatrixAt(instanceIdx, tempMatrix);
        }
        tempColor.setHex(colorHex);
        mesh.setColorAt(instanceIdx, tempColor);
        instanceIdx++;
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.count = instanceIdx;
      this.scene.add(mesh);
      meshes.set(blockType, mesh);
    }

    return { meshes, key };
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      for (const mesh of chunk.meshes.values()) {
        this.scene.remove(mesh);
        mesh.dispose();
      }
    }
    this.chunks.clear();
    this.geometry.dispose();
  }
}
