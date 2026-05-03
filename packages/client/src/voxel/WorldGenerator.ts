import { LOCATIONS } from '@auto_matrix/shared';
import type { LocationDef } from '@auto_matrix/shared';

export const BlockType = {
  AIR: 0,
  CONCRETE_LIGHT: 1,
  CONCRETE_DARK: 2,
  GLASS: 3,
  METAL: 4,
  ASPHALT: 5,
  NEON_GREEN: 6,
} as const;

export const BLOCK_COLORS: Record<number, number> = {
  [BlockType.CONCRETE_LIGHT]: 0x889988,
  [BlockType.CONCRETE_DARK]: 0x445544,
  [BlockType.GLASS]: 0x33aa88,
  [BlockType.METAL]: 0x667788,
  [BlockType.ASPHALT]: 0x333333,
  [BlockType.NEON_GREEN]: 0x00ff41,
};

export const CHUNK_SIZE = 16;
const WORLD_CHUNKS = 32;
const WORLD_SIZE = WORLD_CHUNKS * CHUNK_SIZE;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function generateWorld(): Map<string, Uint8Array> {
  const chunks = new Map<string, Uint8Array>();
  const rand = seededRandom(42);

  for (let cx = 0; cx < WORLD_CHUNKS; cx++) {
    for (let cz = 0; cz < WORLD_CHUNKS; cz++) {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
      const baseX = cx * CHUNK_SIZE;
      const baseZ = cz * CHUNK_SIZE;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const worldX = baseX + lx;
          const worldZ = baseZ + lz;

          const isRoadX = worldX % 32 < 4;
          const isRoadZ = worldZ % 32 < 4;
          const isRoad = isRoadX || isRoadZ;

          for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            const idx = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;

            if (ly === 0) {
              blocks[idx] = isRoad ? BlockType.ASPHALT : BlockType.CONCRETE_LIGHT;
              continue;
            }

            if (isRoad) {
              if (ly <= 1) {
                blocks[idx] = BlockType.ASPHALT;
              } else {
                blocks[idx] = BlockType.AIR;
              }

              if ((worldX % 32 === 0 || worldX % 32 === 3) &&
                  (worldZ % 32 >= 4 && worldZ % 32 < 28) &&
                  ly >= 1 && ly <= 3) {
                blocks[idx] = BlockType.NEON_GREEN;
              }
              if ((worldZ % 32 === 0 || worldZ % 32 === 3) &&
                  (worldX % 32 >= 4 && worldX % 32 < 28) &&
                  ly >= 1 && ly <= 3) {
                blocks[idx] = BlockType.NEON_GREEN;
              }
              continue;
            }

            const isLocationBlock = isInLocation(worldX, ly, worldZ);

            const blockSeed = (worldX * 7919 + worldZ * 6271 + ly * 3571) >>> 0;
            const localRand = seededRandom(blockSeed);
            const buildingHeight = Math.floor(localRand() * 25) + 5;

            if (ly <= buildingHeight) {
              let blockType: number = BlockType.CONCRETE_DARK;

              if (ly === buildingHeight) {
                blockType = BlockType.METAL;
              } else if (ly > buildingHeight * 0.7 && localRand() < 0.3) {
                blockType = BlockType.GLASS;
              } else if (ly > 2 && localRand() < 0.15) {
                blockType = BlockType.GLASS;
              } else {
                blockType = localRand() < 0.5
                  ? BlockType.CONCRETE_LIGHT
                  : BlockType.CONCRETE_DARK;
              }

              blocks[idx] = blockType;
            } else if (isLocationBlock && ly <= buildingHeight + 2) {
              blocks[idx] = BlockType.NEON_GREEN;
            } else {
              blocks[idx] = BlockType.AIR;
            }
          }
        }
      }

      const key = `${cx},0,${cz}`;
      chunks.set(key, blocks);
    }
  }

  return chunks;
}

function isInLocation(wx: number, wy: number, wz: number): boolean {
  for (const key of Object.keys(LOCATIONS)) {
    const loc: LocationDef = LOCATIONS[key];
    const b = loc.bounds;
    if (
      wx >= b.min.x && wx < b.max.x &&
      wy >= b.min.y && wy < b.max.y &&
      wz >= b.min.z && wz < b.max.z
    ) {
      return true;
    }
  }
  return false;
}
