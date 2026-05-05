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
  CONCRETE_WARM: 32,
  BRICK_TAN: 33,
  STUCCO: 34,
  ROOF_RED: 35,
  ROOF_BLUE: 36,
  GLASS_GREEN: 37,
  NEON_PINK: 38,
  NEON_ORANGE: 39,
  METAL_DARK: 40,
  METAL_RUST: 41,
  CONCRETE_CRACKED: 42,
  WOOD_DARK: 43,
  CHROME: 44,
  PLANT: 45,
  WATER: 46,
} as const;

export const BLOCK_COLORS: Record<number, number> = {
  [BlockType.CONCRETE_LIGHT]: 0xcccccc,
  [BlockType.CONCRETE_DARK]: 0x888888,
  [BlockType.GLASS]: 0x88ccdd,
  [BlockType.METAL]: 0x999999,
  [BlockType.ASPHALT]: 0x444444,
  [BlockType.NEON_GREEN]: 0x00ff41,
  [BlockType.BRICK_RED]: 0xb85c38,
  [BlockType.BRICK_BROWN]: 0x8b6914,
  [BlockType.WOOD]: 0xc4a265,
  [BlockType.TILE_WHITE]: 0xf0f0f0,
  [BlockType.TILE_GRAY]: 0xbbbbbb,
  [BlockType.CARPET_RED]: 0x8b2020,
  [BlockType.STEEL]: 0x8899aa,
  [BlockType.GLASS_DARK]: 0x445566,
  [BlockType.NEON_RED]: 0xff2244,
  [BlockType.NEON_BLUE]: 0x2266ff,
  [BlockType.NEON_WHITE]: 0xffffff,
  [BlockType.GRASS]: 0x5a8f3c,
  [BlockType.DIRT]: 0x8b7355,
  [BlockType.STONE]: 0x999999,
  [BlockType.MARBLE]: 0xe8e0d0,
  [BlockType.GOLD_ACCENT]: 0xd4a843,
  [BlockType.ROOF_TILE]: 0x666666,
  [BlockType.PIPE]: 0x667788,
  [BlockType.ZION_METAL]: 0x556666,
  [BlockType.ZION_DARK]: 0x333d3d,
  [BlockType.MONITOR_GREEN]: 0x00cc33,
  [BlockType.WIRE]: 0x555555,
  [BlockType.LAMP_POST]: 0xffeecc,
  [BlockType.SIDEWALK]: 0xbbbbbb,
  [BlockType.ROAD_LINE]: 0xeeee88,
  [BlockType.CONCRETE_WARM]: 0xd4b896,
  [BlockType.BRICK_TAN]: 0xc9a96e,
  [BlockType.STUCCO]: 0xe8dcc8,
  [BlockType.ROOF_RED]: 0xaa3333,
  [BlockType.ROOF_BLUE]: 0x4466aa,
  [BlockType.GLASS_GREEN]: 0x66aa88,
  [BlockType.NEON_PINK]: 0xff44aa,
  [BlockType.NEON_ORANGE]: 0xff8800,
  [BlockType.METAL_DARK]: 0x556666,
  [BlockType.METAL_RUST]: 0x8b4513,
  [BlockType.CONCRETE_CRACKED]: 0x777766,
  [BlockType.WOOD_DARK]: 0x5c3a1e,
  [BlockType.CHROME]: 0xcccccc,
  [BlockType.PLANT]: 0x3d7a2e,
  [BlockType.WATER]: 0x3399cc,
};

export const CHUNK_SIZE = 16;
const WORLD_CHUNKS = 32;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function hash(x: number, y: number, z: number): number {
  return ((x * 7919 + y * 3571 + z * 6271) >>> 0) / 0xffffffff;
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

// --- District types for city variety ---
enum District {
  DOWNTOWN = 0,    // tall glass/steel skyscrapers
  RESIDENTIAL = 1, // brick apartments, warm colors
  COMMERCIAL = 2,  // shops, restaurants, varied
  INDUSTRIAL = 3,  // metal, concrete, flat roofs
  PARK = 4,        // green space
}

function getDistrict(wx: number, wz: number): District {
  // Downtown core: center of city
  if (wx >= 180 && wx < 340 && wz >= 180 && wz < 340) return District.DOWNTOWN;
  // Industrial: top-left
  if (wx < 180 && wz < 180) return District.INDUSTRIAL;
  // Residential: bottom areas
  if (wz >= 340) return District.RESIDENTIAL;
  // Park: scattered green areas
  if ((wx >= 100 && wx < 140 && wz >= 250 && wz < 290) ||
      (wx >= 350 && wx < 390 && wz >= 100 && wz < 140)) return District.PARK;
  // Commercial: rest
  return District.COMMERCIAL;
}

export function generateWorld(): Map<string, Uint8Array> {
  const chunks = new Map<string, Uint8Array>();

  for (let cx = 0; cx < WORLD_CHUNKS; cx++) {
    for (let cz = 0; cz < WORLD_CHUNKS; cz++) {
      const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
      const baseX = cx * CHUNK_SIZE;
      const baseZ = cz * CHUNK_SIZE;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = baseX + lx;
          const wz = baseZ + lz;

          const district = getDistrict(wx, wz);
          const mainRoadX = wx % 48 < 6;
          const mainRoadZ = wz % 48 < 6;
          const sideRoadX = !mainRoadX && wx % 24 < 3;
          const sideRoadZ = !mainRoadZ && !mainRoadX && wz % 24 < 3;
          const isRoad = mainRoadX || mainRoadZ || sideRoadX || sideRoadZ;

          const nearRoadX = !isRoad && ((wx + 1) % 48 < 6 || (wx - 1) % 48 < 6 || (wx + 1) % 24 < 3 || (wx - 1) % 24 < 3);
          const nearRoadZ = !isRoad && ((wz + 1) % 48 < 6 || (wz - 1) % 48 < 6 || (wz + 1) % 24 < 3 || (wz - 1) % 24 < 3);
          const isSidewalk = (nearRoadX || nearRoadZ) && !isRoad;

          const isRoadLine = isRoad && (
            (mainRoadX && (wz % 48 === 2 || wz % 48 === 3)) ||
            (mainRoadZ && (wx % 48 === 2 || wx % 48 === 3))
          );

          const loc = isInLocation(wx, 0, wz);
          const buildingH = computeBuildingHeight(wx, wz, district);

          for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            const idx = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
            const wy = ly;

            if (wy === 0) {
              if (isRoad) {
                blocks[idx] = isRoadLine ? BlockType.ROAD_LINE : BlockType.ASPHALT;
              } else if (isSidewalk) {
                blocks[idx] = BlockType.SIDEWALK;
              } else if (district === District.PARK) {
                blocks[idx] = BlockType.GRASS;
              } else if (loc) {
                blocks[idx] = BlockType.CONCRETE_LIGHT;
              } else {
                blocks[idx] = Math.random() < 0.2 ? BlockType.GRASS : BlockType.DIRT;
              }
              continue;
            }

            if (loc) {
              const block = getLocationBlock(loc, wx, wy, wz);
              if (block !== null) { blocks[idx] = block; continue; }
            }

            if (isRoad) {
              if (mainRoadX && wz % 48 === 0 && wx % 10 === 0 && wy <= 5) {
                blocks[idx] = wy === 5 ? BlockType.LAMP_POST : BlockType.METAL;
              } else if (mainRoadZ && wx % 48 === 0 && wz % 10 === 0 && wy <= 5) {
                blocks[idx] = wy === 5 ? BlockType.LAMP_POST : BlockType.METAL;
              } else {
                blocks[idx] = BlockType.AIR;
              }
              continue;
            }

            if (isSidewalk) {
              if (wy <= 1) blocks[idx] = BlockType.SIDEWALK;
              else blocks[idx] = BlockType.AIR;
              continue;
            }

            if (district === District.PARK) {
              // Trees
              const treeHash = hash(wx, 0, wz);
              if (treeHash < 0.08 && wy <= 5) {
                if (wy <= 2) blocks[idx] = BlockType.WOOD_DARK;
                else if (wy <= 5) blocks[idx] = BlockType.PLANT;
              } else {
                blocks[idx] = BlockType.AIR;
              }
              continue;
            }

            // Buildings
            if (wy <= buildingH && buildingH > 0) {
              blocks[idx] = getBuildingBlock(wx, wy, wz, buildingH, district);
            } else {
              blocks[idx] = BlockType.AIR;
            }
          }
        }
      }

      // --- Zion underground layer (y: 50-64, z: 480-512) ---
      if (cz >= 30) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const wx = baseX + lx;
            const wz = baseZ + lz;
            for (let ly = 0; ly < CHUNK_SIZE; ly++) {
              const idx = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
              const wy = ly;
              const zionY = wy; // 0-15 maps to actual y
              const h = hash(wx, wy, wz);

              // Cave walls
              const isWall = lx === 0 || lx === 15 || lz === 0 || lz === 15;
              const isCeiling = wy === 15;
              const isFloor = wy === 0;

              if (isFloor) {
                blocks[idx] = BlockType.STEEL;
              } else if (isCeiling) {
                blocks[idx] = h < 0.3 ? BlockType.STONE : BlockType.ZION_DARK;
              } else if (isWall) {
                if (h < 0.1) blocks[idx] = BlockType.PIPE;
                else if (h < 0.2) blocks[idx] = BlockType.WIRE;
                else if (h < 0.3) blocks[idx] = BlockType.MONITOR_GREEN;
                else if (h < 0.4) blocks[idx] = BlockType.METAL_RUST;
                else blocks[idx] = BlockType.ZION_METAL;
              } else {
                // Interior: mostly open with some structures
                if (wy <= 2 && h < 0.15) blocks[idx] = BlockType.STEEL; // raised platforms
                else if (wy >= 6 && wy <= 8 && h < 0.1) blocks[idx] = BlockType.PIPE; // overhead pipes
                else blocks[idx] = BlockType.AIR;
              }
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

function computeBuildingHeight(wx: number, wz: number, district: District): number {
  if (wx % 48 < 6 || wz % 48 < 6 || wx % 24 < 3 || wz % 24 < 3) return 0;
  const nearRoadX = (wx + 1) % 48 < 6 || (wx - 1) % 48 < 6 || (wx + 1) % 24 < 3 || (wx - 1) % 24 < 3;
  const nearRoadZ = (wz + 1) % 48 < 6 || (wz - 1) % 48 < 6 || (wz + 1) % 24 < 3 || (wz - 1) % 24 < 3;
  if (nearRoadX || nearRoadZ) return 0;
  if (isInLocation(wx, 0, wz)) return 0;

  const h = hash(wx, 0, wz);
  switch (district) {
    case District.DOWNTOWN: return Math.floor(h * 25) + 12;
    case District.RESIDENTIAL: return Math.floor(h * 10) + 5;
    case District.COMMERCIAL: return Math.floor(h * 14) + 4;
    case District.INDUSTRIAL: return Math.floor(h * 8) + 6;
    case District.PARK: return 0;
  }
}

function getBuildingBlock(wx: number, wy: number, wz: number, totalH: number, district: District): number {
  const h = hash(wx, wy, wz);

  if (wy === totalH) {
    // Roofs vary by district
    switch (district) {
      case District.RESIDENTIAL: return h < 0.5 ? BlockType.ROOF_RED : BlockType.ROOF_BLUE;
      case District.INDUSTRIAL: return BlockType.METAL_DARK;
      case District.COMMERCIAL: return h < 0.3 ? BlockType.ROOF_RED : BlockType.ROOF_TILE;
      default: return BlockType.ROOF_TILE;
    }
  }

  // Windows
  const isWindowX = (wx % 3 === 0) && (wy % 4 >= 1 && wy % 4 <= 2);
  const isWindowZ = (wz % 3 === 0) && (wy % 4 >= 1 && wy % 4 <= 2);
  if ((isWindowX || isWindowZ) && wy > 1 && wy < totalH - 1) {
    switch (district) {
      case District.DOWNTOWN: return h < 0.4 ? BlockType.GLASS : BlockType.GLASS_DARK;
      case District.COMMERCIAL: return h < 0.3 ? BlockType.GLASS_GREEN : BlockType.GLASS;
      case District.RESIDENTIAL: return h < 0.5 ? BlockType.NEON_WHITE : BlockType.GLASS;
      default: return BlockType.GLASS_DARK;
    }
  }

  // Walls
  switch (district) {
    case District.DOWNTOWN:
      return h < 0.5 ? BlockType.CONCRETE_LIGHT : BlockType.STEEL;
    case District.RESIDENTIAL:
      if (h < 0.4) return BlockType.BRICK_TAN;
      if (h < 0.7) return BlockType.STUCCO;
      return BlockType.CONCRETE_WARM;
    case District.COMMERCIAL:
      if (h < 0.3) return BlockType.BRICK_RED;
      if (h < 0.6) return BlockType.CONCRETE_LIGHT;
      return BlockType.STUCCO;
    case District.INDUSTRIAL:
      if (h < 0.5) return BlockType.METAL;
      if (h < 0.7) return BlockType.METAL_RUST;
      return BlockType.CONCRETE_CRACKED;
    default:
      return BlockType.CONCRETE_LIGHT;
  }
}

function getLocationBlock(loc: LocationDef, wx: number, wy: number, wz: number): number | null {
  const b = loc.bounds;
  if (wx < b.min.x || wx >= b.max.x || wy < b.min.y || wy >= b.max.y || wz < b.min.z || wz >= b.max.z) return null;

  const lx = wx - b.min.x;
  const ly = wy - b.min.y;
  const lz = wz - b.min.z;
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  const d = b.max.z - b.min.z;
  const isWall = lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1;
  const isFloor = ly === 0;
  const isRoof = ly === h - 1;
  const h2 = hash(wx, wy, wz);

  switch (loc.id) {
    case 'metacortex_office':
      if (isRoof) return BlockType.ROOF_TILE;
      if (isFloor) return BlockType.TILE_GRAY;
      if (isWall) return (wy % 4 >= 1 && wy % 4 <= 2 && lx % 3 === 0) ? BlockType.GLASS : BlockType.CONCRETE_LIGHT;
      return h2 < 0.1 ? BlockType.MONITOR_GREEN : BlockType.AIR;

    case 'oracles_apartment':
      if (isRoof) return BlockType.ROOF_RED;
      if (isFloor) return BlockType.WOOD;
      if (isWall) {
        if (wy >= 3 && wy <= 5 && (lx === 2 || lx === w - 3)) return BlockType.NEON_WHITE;
        return BlockType.BRICK_TAN;
      }
      if (lz <= 3 && lx >= 2 && lx <= 6 && wy === 1 && lx <= 4) return BlockType.TILE_WHITE;
      return BlockType.AIR;

    case 'merovingians_restaurant':
      if (isRoof) return BlockType.GOLD_ACCENT;
      if (isFloor) return BlockType.MARBLE;
      if (isWall) return (ly >= 3 && ly <= 6 && lx % 4 === 0) ? BlockType.GOLD_ACCENT : BlockType.BRICK_RED;
      if (wy === 8 && Math.abs(lx - w / 2) < 3 && Math.abs(lz - d / 2) < 3) return BlockType.NEON_WHITE;
      return BlockType.AIR;

    case 'architects_chamber':
      if (isFloor || isRoof) return BlockType.MARBLE;
      if (isWall) return h2 < 0.5 ? BlockType.MONITOR_GREEN : BlockType.MARBLE;
      return BlockType.AIR;

    case 'subway_station':
      if (isFloor) return BlockType.TILE_GRAY;
      if (isRoof) return BlockType.STEEL;
      if (isWall) return wy % 3 === 0 ? BlockType.NEON_GREEN : BlockType.STEEL;
      if (lz <= 3 && wy === 1) return BlockType.TILE_WHITE;
      if (lz > d - 4 && wy === 0) return BlockType.STEEL;
      return BlockType.AIR;

    case 'nightclub':
      if (isFloor) return BlockType.CARPET_RED;
      if (isRoof) return BlockType.ZION_DARK;
      if (isWall) {
        if (h2 < 0.2) return BlockType.NEON_PINK;
        if (h2 < 0.4) return BlockType.NEON_BLUE;
        return BlockType.ZION_DARK;
      }
      return BlockType.AIR;

    case 'lobby':
      if (isFloor) return BlockType.MARBLE;
      if (isRoof) return BlockType.TILE_WHITE;
      if (isWall) return ly >= 4 && ly <= 10 ? BlockType.GLASS : BlockType.CONCRETE_LIGHT;
      if ((lx === 5 || lx === w - 6) && (lz === 5 || lz === d - 6)) return BlockType.MARBLE;
      return BlockType.AIR;

    // Zion locations
    case 'zion_dock':
    case 'zion_command':
    case 'zion_council':
    case 'nebuchadnezzar':
    case 'logos':
    case 'mjolnir':
      if (isFloor) return BlockType.STEEL;
      if (isRoof) return BlockType.ZION_DARK;
      if (isWall) {
        if (h2 < 0.12) return BlockType.PIPE;
        if (h2 < 0.22) return BlockType.WIRE;
        if (h2 < 0.32) return BlockType.MONITOR_GREEN;
        if (h2 < 0.4) return BlockType.METAL_RUST;
        return BlockType.ZION_METAL;
      }
      return BlockType.AIR;

    case 'mobil_ave':
      if (isFloor) return BlockType.STEEL;
      if (isRoof) return BlockType.STONE;
      if (isWall) return BlockType.STONE;
      if (lz === Math.floor(d / 2) && wy === 0) return BlockType.STEEL;
      return BlockType.AIR;

    case 'machine_city':
      if (isFloor || isRoof) return BlockType.ZION_DARK;
      if (isWall) return h2 < 0.2 ? BlockType.NEON_GREEN : BlockType.ZION_DARK;
      return BlockType.AIR;

    default:
      if (isFloor) return BlockType.CONCRETE_LIGHT;
      if (isRoof) return BlockType.ROOF_TILE;
      if (isWall) return BlockType.CONCRETE_DARK;
      return BlockType.AIR;
  }
}
