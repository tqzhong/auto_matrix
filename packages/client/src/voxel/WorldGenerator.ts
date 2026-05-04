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
  BRICK_RED: 7,
  BRICK_BROWN: 8,
  WOOD: 9,
  TILE_WHITE: 10,
  TILE_GRAY: 11,
  CARPET_RED: 12,
  STEEL: 13,
  GLASS_DARK: 14,
  NEON_RED: 15,
  NEON_BLUE: 16,
  NEON_WHITE: 17,
  GRASS: 18,
  DIRT: 19,
  STONE: 20,
  MARBLE: 21,
  GOLD_ACCENT: 22,
  ROOF_TILE: 23,
  PIPE: 24,
  ZION_METAL: 25,
  ZION_DARK: 26,
  MONITOR_GREEN: 27,
  WIRE: 28,
  LAMP_POST: 29,
  SIDEWALK: 30,
  ROAD_LINE: 31,
} as const;

export const BLOCK_COLORS: Record<number, number> = {
  [BlockType.CONCRETE_LIGHT]: 0x8a8a8a,
  [BlockType.CONCRETE_DARK]: 0x5a5a5a,
  [BlockType.GLASS]: 0x66aacc,
  [BlockType.METAL]: 0x778888,
  [BlockType.ASPHALT]: 0x2a2a2a,
  [BlockType.NEON_GREEN]: 0x00ff41,
  [BlockType.BRICK_RED]: 0x8b4513,
  [BlockType.BRICK_BROWN]: 0x6b3410,
  [BlockType.WOOD]: 0x8b7355,
  [BlockType.TILE_WHITE]: 0xe8e8e8,
  [BlockType.TILE_GRAY]: 0xaaaaaa,
  [BlockType.CARPET_RED]: 0x8b2020,
  [BlockType.STEEL]: 0x667788,
  [BlockType.GLASS_DARK]: 0x334455,
  [BlockType.NEON_RED]: 0xff2200,
  [BlockType.NEON_BLUE]: 0x2244ff,
  [BlockType.NEON_WHITE]: 0xffffff,
  [BlockType.GRASS]: 0x3a6b35,
  [BlockType.DIRT]: 0x6b5535,
  [BlockType.STONE]: 0x777777,
  [BlockType.MARBLE]: 0xd4d4cc,
  [BlockType.GOLD_ACCENT]: 0xccaa44,
  [BlockType.ROOF_TILE]: 0x555555,
  [BlockType.PIPE]: 0x556666,
  [BlockType.ZION_METAL]: 0x4a5555,
  [BlockType.ZION_DARK]: 0x2a3030,
  [BlockType.MONITOR_GREEN]: 0x00cc33,
  [BlockType.WIRE]: 0x444444,
  [BlockType.LAMP_POST]: 0xffeecc,
  [BlockType.SIDEWALK]: 0x999999,
  [BlockType.ROAD_LINE]: 0xcccc66,
};

export const CHUNK_SIZE = 16;
const WORLD_CHUNKS = 32;
const WORLD_SIZE = WORLD_CHUNKS * CHUNK_SIZE; // 512

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function isInLocation(wx: number, wy: number, wz: number): LocationDef | null {
  for (const loc of Object.values(LOCATIONS)) {
    const b = loc.bounds;
    if (wx >= b.min.x && wx < b.max.x &&
        wy >= b.min.y && wy < b.max.y &&
        wz >= b.min.z && wz < b.max.z) {
      return loc;
    }
  }
  return null;
}

// Simple hash for deterministic per-block randomness
function hash(x: number, y: number, z: number): number {
  return ((x * 7919 + y * 3571 + z * 6271) >>> 0) / 0xffffffff;
}

export function generateWorld(): Map<string, Uint8Array> {
  const chunks = new Map<string, Uint8Array>();

  // Pre-compute building heights for the entire city
  const buildingHeightMap = new Map<string, number>();
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const h = computeBuildingHeight(x, z);
      buildingHeightMap.set(`${x},${z}`, h);
    }
  }

  for (let cx = 0; cx < WORLD_CHUNKS; cx++) {
    for (let cz = 0; cz < WORLD_CHUNKS; cz++) {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
      const baseX = cx * CHUNK_SIZE;
      const baseZ = cz * CHUNK_SIZE;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = baseX + lx;
          const wz = baseZ + lz;

          // Road grid: main roads every 48 blocks (6 wide), side roads every 24 (4 wide)
          const mainRoadX = wx % 48 < 6;
          const mainRoadZ = wz % 48 < 6;
          const sideRoadX = wx % 24 < 3 && !mainRoadX;
          const sideRoadZ = wz % 24 < 3 && !mainRoadX && !mainRoadZ;
          const isRoad = mainRoadX || mainRoadZ || sideRoadX || sideRoadZ;

          // Sidewalk: 1 block on each side of road
          const nearRoadX = !isRoad && ((wx - 1) % 48 < 6 || (wx + 1) % 48 < 6 || (wx - 1) % 24 < 3 || (wx + 1) % 24 < 3);
          const nearRoadZ = !isRoad && ((wz - 1) % 48 < 6 || (wz + 1) % 48 < 6 || (wz - 1) % 24 < 3 || (wz + 1) % 24 < 3);
          const isSidewalk = (nearRoadX || nearRoadZ) && !isRoad;

          // Road line marking
          const isRoadLine = isRoad && (
            (mainRoadX && (wz % 48 === 2 || wz % 48 === 3)) ||
            (mainRoadZ && (wx % 48 === 2 || wx % 48 === 3))
          );

          const buildingH = buildingHeightMap.get(`${wx},${wz}`) ?? 0;
          const loc = isInLocation(wx, 0, wz);

          for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            const idx = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
            const wy = ly;

            // === Ground layer ===
            if (wy === 0) {
              if (isRoad) {
                blocks[idx] = isRoadLine ? BlockType.ROAD_LINE : BlockType.ASPHALT;
              } else if (isSidewalk) {
                blocks[idx] = BlockType.SIDEWALK;
              } else if (loc) {
                blocks[idx] = BlockType.CONCRETE_LIGHT;
              } else {
                blocks[idx] = Math.random() < 0.3 ? BlockType.GRASS : BlockType.DIRT;
              }
              continue;
            }

            // === Special locations override ===
            if (loc) {
              const block = getLocationBlock(loc, wx, wy, wz, buildingH);
              if (block !== null) {
                blocks[idx] = block;
                continue;
              }
            }

            // === Road space ===
            if (isRoad) {
              // Lamp posts every 8 blocks along main roads
              if (mainRoadX && wz % 48 === 0 && wx % 8 === 0 && wy <= 4) {
                blocks[idx] = wy === 4 ? BlockType.LAMP_POST : BlockType.STEEL;
              } else if (mainRoadZ && wx % 48 === 0 && wz % 8 === 0 && wy <= 4) {
                blocks[idx] = wy === 4 ? BlockType.LAMP_POST : BlockType.STEEL;
              } else {
                blocks[idx] = BlockType.AIR;
              }
              continue;
            }

            // === Sidewalk space ===
            if (isSidewalk) {
              blocks[idx] = wy <= 1 ? BlockType.SIDEWALK : BlockType.AIR;
              continue;
            }

            // === Buildings ===
            if (wy <= buildingH) {
              blocks[idx] = getBuildingBlock(wx, wy, wz, buildingH);
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

function computeBuildingHeight(wx: number, wz: number): number {
  // No buildings on roads
  if (wx % 48 < 6 || wz % 48 < 6 || wx % 24 < 3 || wz % 24 < 3) return 0;
  // Sidewalks
  const nearRoadX = (wx - 1) % 48 < 6 || (wx + 1) % 48 < 6 || (wx - 1) % 24 < 3 || (wx + 1) % 24 < 3;
  const nearRoadZ = (wz - 1) % 48 < 6 || (wz + 1) % 48 < 6 || (wz - 1) % 24 < 3 || (wz + 1) % 24 < 3;
  if (nearRoadX || nearRoadZ) return 0;

  // Check if in a key location
  const loc = isInLocation(wx, 0, wz);
  if (loc) return 0; // Locations handle their own blocks

  // Deterministic height from position
  const h = hash(wx, 0, wz);

  // Metacortex area (x:50-80, z:50-80): tall office towers
  if (wx >= 50 && wx < 80 && wz >= 50 && wz < 80) {
    return Math.floor(h * 20) + 15;
  }

  // Downtown core: varied tall buildings
  if (wx >= 100 && wx < 400 && wz >= 100 && wz < 400) {
    return Math.floor(h * 25) + 8;
  }

  // Outer areas: shorter buildings
  return Math.floor(h * 12) + 3;
}

function getBuildingBlock(wx: number, wy: number, wz: number, totalH: number): number {
  const h = hash(wx, wy, wz);

  // Roof
  if (wy === totalH) return BlockType.ROOF_TILE;

  // Top floor windows
  if (wy >= totalH - 1 && h < 0.4) return BlockType.GLASS;

  // Windows on facade (every 3rd block horizontally, every 4th vertically)
  const isWindowX = (wx % 3 === 0) && (wy % 4 >= 1 && wy % 4 <= 2);
  const isWindowZ = (wz % 3 === 0) && (wy % 4 >= 1 && wy % 4 <= 2);

  if ((isWindowX || isWindowZ) && wy > 1 && wy < totalH - 1) {
    // Mix of lit and dark windows
    return h < 0.3 ? BlockType.NEON_WHITE : h < 0.5 ? BlockType.GLASS : BlockType.GLASS_DARK;
  }

  // Building walls
  if (totalH > 15) {
    // Tall buildings: modern concrete/glass
    return h < 0.6 ? BlockType.CONCRETE_LIGHT : BlockType.CONCRETE_DARK;
  } else if (totalH > 8) {
    // Medium: mix of brick and concrete
    return h < 0.4 ? BlockType.BRICK_RED : h < 0.7 ? BlockType.CONCRETE_LIGHT : BlockType.BRICK_BROWN;
  } else {
    // Short: brick/wood
    return h < 0.5 ? BlockType.BRICK_BROWN : BlockType.WOOD;
  }
}

function getLocationBlock(loc: LocationDef, wx: number, wy: number, wz: number, _buildingH: number): number | null {
  const b = loc.bounds;
  const lx = wx - b.min.x;
  const ly = wy - b.min.y;
  const lz = wz - b.min.z;
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  const d = b.max.z - b.min.z;

  // Outside bounds
  if (wx < b.min.x || wx >= b.max.x || wy < b.min.y || wy >= b.max.y || wz < b.min.z || wz >= b.max.z) {
    return null;
  }

  const isWall = lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1;
  const isFloor = ly === 0;
  const isRoof = ly === h - 1;
  const h2 = hash(wx, wy, wz);

  switch (loc.id) {
    case 'metacortex_office': {
      if (isRoof) return BlockType.ROOF_TILE;
      if (isFloor) return BlockType.TILE_GRAY;
      if (isWall) {
        if (wy % 4 >= 1 && wy % 4 <= 2 && lx % 3 === 0) return BlockType.GLASS;
        return BlockType.CONCRETE_LIGHT;
      }
      // Interior
      if (h2 < 0.1) return BlockType.MONITOR_GREEN;
      return BlockType.AIR;
    }

    case 'oracles_apartment': {
      if (isRoof) return BlockType.ROOF_TILE;
      if (isFloor) return BlockType.WOOD;
      if (isWall) {
        if (wy >= 3 && wy <= 5 && (lx === 2 || lx === w - 3)) return BlockType.NEON_WHITE; // windows
        return BlockType.BRICK_BROWN;
      }
      // Kitchen area
      if (lz <= 3 && lx >= 2 && lx <= 6) {
        if (wy === 1 && lx <= 4) return BlockType.TILE_WHITE; // counter
      }
      return BlockType.AIR;
    }

    case 'merovingians_restaurant': {
      if (isRoof) return BlockType.GOLD_ACCENT;
      if (isFloor) return BlockType.MARBLE;
      if (isWall) {
        if (ly >= 3 && ly <= 6 && lx % 4 === 0) return BlockType.GOLD_ACCENT; // columns
        return BlockType.BRICK_RED;
      }
      // Chandelier area
      if (wy === 8 && Math.abs(lx - w/2) < 3 && Math.abs(lz - d/2) < 3) return BlockType.NEON_WHITE;
      return BlockType.AIR;
    }

    case 'architects_chamber': {
      if (isFloor || isRoof) return BlockType.MARBLE;
      if (isWall) {
        return h2 < 0.5 ? BlockType.MONITOR_GREEN : BlockType.MARBLE;
      }
      return BlockType.AIR;
    }

    case 'subway_station': {
      if (isFloor) return BlockType.TILE_GRAY;
      if (isRoof) return BlockType.STEEL;
      if (isWall) {
        if (wy % 3 === 0) return BlockType.NEON_GREEN; // lighting strips
        return BlockType.STEEL;
      }
      // Platform
      if (lz <= 3 && wy === 1) return BlockType.TILE_WHITE;
      // Tracks
      if (lz > d - 4 && wy === 0) return BlockType.STEEL;
      return BlockType.AIR;
    }

    case 'nightclub': {
      if (isFloor) return BlockType.CARPET_RED;
      if (isRoof) return BlockType.ZION_DARK;
      if (isWall) {
        if (h2 < 0.3) return BlockType.NEON_RED;
        if (h2 < 0.5) return BlockType.NEON_BLUE;
        return BlockType.ZION_DARK;
      }
      return BlockType.AIR;
    }

    case 'lobby': {
      if (isFloor) return BlockType.MARBLE;
      if (isRoof) return BlockType.TILE_WHITE;
      if (isWall) {
        if (ly >= 4 && ly <= 10) return BlockType.GLASS; // big glass walls
        return BlockType.CONCRETE_LIGHT;
      }
      // Pillars
      if ((lx === 5 || lx === w - 6) && (lz === 5 || lz === d - 6)) return BlockType.MARBLE;
      return BlockType.AIR;
    }

    // Zion locations
    case 'zion_dock':
    case 'zion_command':
    case 'zion_council':
    case 'nebuchadnezzar':
    case 'logos':
    case 'mjolnir': {
      if (isFloor) return BlockType.STEEL;
      if (isRoof) return BlockType.ZION_DARK;
      if (isWall) {
        if (h2 < 0.15) return BlockType.PIPE;
        if (h2 < 0.25) return BlockType.WIRE;
        if (h2 < 0.35) return BlockType.MONITOR_GREEN;
        return BlockType.ZION_METAL;
      }
      return BlockType.AIR;
    }

    case 'mobil_ave': {
      if (isFloor) return BlockType.STEEL;
      if (isRoof) return BlockType.STONE;
      if (isWall) return BlockType.STONE;
      // Train tracks
      if (lz === Math.floor(d / 2) && wy === 0) return BlockType.STEEL;
      return BlockType.AIR;
    }

    case 'machine_city': {
      if (isFloor || isRoof) return BlockType.ZION_DARK;
      if (isWall) {
        if (h2 < 0.2) return BlockType.NEON_GREEN;
        return BlockType.ZION_DARK;
      }
      return BlockType.AIR;
    }

    default: {
      // Generic location
      if (isFloor) return BlockType.CONCRETE_LIGHT;
      if (isRoof) return BlockType.ROOF_TILE;
      if (isWall) return BlockType.CONCRETE_DARK;
      return BlockType.AIR;
    }
  }
}
