import * as THREE from 'three';

// Voxel-based pixel art character models for Matrix characters
// Each character is ~4 wide x 8 tall x 2 deep

const V = 1; // voxel unit size

function hexColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function voxel(x: number, y: number, z: number, w: number, h: number, d: number, color: number, group: THREE.Group): void {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w * V, h * V, d * V),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x * V, y * V, z * V);
  mesh.castShadow = true;
  group.add(mesh);
}

// Build a character from a 2D pixel map (front view), extruded 2 deep
function buildFromPixelMap(
  pixels: string[],
  palette: Record<string, number>,
  scale: number = 1,
): THREE.Group {
  const group = new THREE.Group();
  const rows = pixels.length;
  for (let row = 0; row < rows; row++) {
    const cols = pixels[row].length;
    for (let col = 0; col < cols; col++) {
      const ch = pixels[row][col];
      if (ch === ' ' || ch === '.') continue;
      const color = palette[ch];
      if (color === undefined) continue;
      // row 0 = bottom, so y = row
      voxel(col * scale, row * scale, 0, scale, scale, 2 * scale, color, group);
    }
  }
  // Center the model
  const w = pixels[0]?.length ?? 0;
  group.position.set(-(w * scale) / 2, 0, -scale);
  return group;
}

// === CHARACTER-SPECIFIC MODELS ===

function buildNeo(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x1a1a1a, // hair (dark brown/black)
    'S': 0xd4a574, // skin
    'G': 0x111111, // sunglasses
    'C': 0x111111, // coat (black)
    'T': 0x0a0a0a, // trench coat long
    'P': 0x1a1a1a, // pants
    'B': 0x0f0f0f, // boots
  };
  return buildFromPixelMap([
    ' HH ', // row 7 (top)
    ' HH ',
    'SGGS', // face + glasses
    ' CC ', // coat body
    ' CC ',
    'TCTC', // trench coat extends
    ' PP ', // legs
    ' BB ', // boots
  ], p);
}

function buildMorpheus(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x2a1a0a, // dark skin / bald
    'S': 0x8b6914, // skin
    'G': 0xc0c0c0, // round glasses
    'C': 0x4a3a5a, // purple-gray coat
    'T': 0x3a2a4a, // long coat
    'P': 0x2a2a2a, // pants
    'B': 0x1a1a1a, // boots
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    'SGGS',
    ' CC ',
    ' CC ',
    'TCTC',
    ' PP ',
    ' BB ',
  ], p);
}

function buildTrinity(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x111111, // short black hair
    'S': 0xd4a574, // skin
    'L': 0x111111, // leather suit
    'J': 0x1a1a1a, // jacket
    'P': 0x111111, // leather pants
    'B': 0x0a0a0a, // boots
  };
  return buildFromPixelMap([
    ' HH ',
    'HHHH',
    ' SS ',
    ' LL ',
    ' JLJ',
    ' LL ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildSmith(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x1a1a1a, // slicked hair
    'S': 0xd0b090, // skin
    'G': 0x111111, // sunglasses
    'K': 0x222222, // suit
    'W': 0xdddddd, // white shirt
    'I': 0x880000, // tie
    'P': 0x222222, // pants
    'B': 0x111111, // shoes
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    'SGGS',
    'KWK ', // suit with white shirt
    'KIWK', // tie on shirt
    ' KK ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildOracle(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x3a2a1a, // curly hair
    'S': 0x8b6914, // dark skin
    'G': 0xc0a040, // glasses
    'T': 0xcc7722, // warm blouse
    'A': 0x996633, // apron
    'K': 0x664422, // skirt
    'B': 0x443322, // shoes
  };
  return buildFromPixelMap([
    'HHHH',
    'HHHH',
    'SGGS',
    ' TT ',
    ' AT ',
    ' KK ',
    ' KK ',
    ' BB ',
  ], p);
}

function buildAgentGeneric(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x1a1a1a, // dark hair
    'S': 0xd0b090, // skin
    'G': 0x111111, // sunglasses
    'K': 0x1a1a1a, // black suit
    'W': 0xdddddd, // white shirt
    'I': 0x333333, // tie
    'P': 0x1a1a1a, // pants
    'B': 0x111111, // shoes
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    'SGGS',
    'KWK ',
    'KIWK',
    ' KK ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildMerovingian(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x1a1a1a, // long dark hair
    'S': 0xd0b090, // skin
    'G': 0x333333, // goatee
    'K': 0x2a2a3a, // expensive suit
    'V': 0x3a3a4a, // vest
    'P': 0x2a2a2a, // dress pants
    'B': 0x1a1a1a, // shoes
  };
  return buildFromPixelMap([
    'HHHH',
    'HHHH',
    'SSG ',
    'KVK ',
    'KVK ',
    ' KK ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildPersephone(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x1a1a1a, // dark updo
    'S': 0xc8a080, // skin
    'D': 0x8b0000, // red dress
    'R': 0x6b0000, // dress lower
    'B': 0x222222, // heels
  };
  return buildFromPixelMap([
    'HHHH',
    'HHHH',
    ' SS ',
    ' DD ',
    ' DD ',
    ' RR ',
    ' RR ',
    ' BB ',
  ], p);
}

function buildSeraph(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x0a0a0a, // neat dark hair
    'S': 0xc8a878, // Asian skin
    'K': 0x1a1a2a, // formal dark jacket
    'P': 0x1a1a1a, // dark pants
    'B': 0x111111, // shoes
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    ' SS ',
    ' KK ',
    ' KK ',
    ' KK ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildArchitect(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0xdddddd, // white hair
    'S': 0xd0b090, // skin
    'G': 0xc0c0c0, // glasses
    'B': 0xcccccc, // white beard
    'K': 0xeeeeee, // white suit
    'P': 0xdddddd, // white pants
    'W': 0xffffff, // white shoes
  };
  return buildFromPixelMap([
    'HHHH',
    'HHHH',
    'SGGB',
    'BBBB',
    ' KK ',
    ' KK ',
    ' PP ',
    ' WW ',
  ], p);
}

function buildCypher(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x2a1a0a, // dark hair
    'S': 0xd0b090, // skin
    'M': 0x3a2a1a, // mustache
    'J': 0x2a2a2a, // leather jacket
    'T': 0x444444, // t-shirt
    'P': 0x3344aa, // jeans
    'B': 0x2a2a2a, // boots
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    'SSMS',
    ' JT ',
    ' JT ',
    ' JJ ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildZionFighter(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x1a1a1a,
    'S': 0xd4a574,
    'K': 0x2a3a2a, // tactical gear
    'V': 0x3a4a3a, // vest
    'P': 0x2a2a2a, // tactical pants
    'B': 0x1a2a1a, // boots
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    ' SS ',
    'KVK ',
    'KVK ',
    ' KK ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildCivilian(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x3a2a1a,
    'S': 0xd4a574,
    'T': 0x4a6a8a, // shirt
    'P': 0x444466, // pants
    'B': 0x333333, // shoes
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    ' SS ',
    ' TT ',
    ' TT ',
    ' TT ',
    ' PP ',
    ' BB ',
  ], p);
}

function buildWomanInRed(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x3a2a1a,
    'S': 0xd4a574,
    'D': 0xcc2222, // red dress
    'B': 0x111111, // heels
  };
  return buildFromPixelMap([
    ' HH ',
    'HHHH',
    ' SS ',
    ' DD ',
    ' DD ',
    ' DD ',
    ' DD ',
    ' BB ',
  ], p);
}

function buildSati(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x0a0a0a,
    'S': 0xc8a878,
    'D': 0x8866aa, // purple dress
    'B': 0x333333,
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    ' SS ',
    ' DD ',
    ' DD ',
    ' DD ',
    '  B ',
    '    ',
  ], p);
}

function buildKeymaker(): THREE.Group {
  const p: Record<string, number> = {
    'H': 0x999999, // gray hair
    'S': 0xd0b090,
    'V': 0x554433, // vest
    'P': 0x444433,
    'B': 0x333322,
  };
  return buildFromPixelMap([
    ' HH ',
    ' HH ',
    ' SS ',
    ' VV ',
    ' VV ',
    ' VV ',
    ' PP ',
    ' BB ',
  ], p);
}

// Character model registry
const CHARACTER_MODELS: Record<string, () => THREE.Group> = {
  neo: buildNeo,
  morpheus: buildMorpheus,
  trinity: buildTrinity,
  smith: buildSmith,
  agent_smith: buildSmith,
  oracle: buildOracle,
  the_oracle: buildOracle,
  cypher: buildCypher,
  merovingian: buildMerovingian,
  persephone: buildPersephone,
  seraph: buildSeraph,
  architect: buildArchitect,
  the_architect: buildArchitect,
  keymaker: buildKeymaker,
  the_keymaker: buildKeymaker,
  sati: buildSati,
  choi: buildCivilian,
  dujour: buildWomanInRed,
  spoon_boy: buildCivilian,
  rhineheart: buildCivilian,
};

// Faction-based fallback
const FACTION_BUILDERS: Record<string, () => THREE.Group> = {
  zion: buildZionFighter,
  machines: buildAgentGeneric,
  merovingian: buildMerovingian,
  exiles: buildZionFighter,
  civilians: buildCivilian,
  oracle: buildOracle,
  smith_virus: buildSmith,
};

export class VoxelCharacterModel {
  static buildFromConfig(config: { bodyColor: string; headColor: string; clothing: string; accessories: string[]; isAgent: boolean }, characterId?: string): THREE.Group {
    // Try character-specific model first
    if (characterId && CHARACTER_MODELS[characterId]) {
      return CHARACTER_MODELS[characterId]();
    }

    // Check if smith (virus variant)
    if (characterId?.includes('smith') || config.isAgent) {
      if (characterId === 'smith' || characterId === 'agent_smith') return buildSmith();
      if (characterId === 'agent_johnson' || characterId === 'agent_jackson' || characterId === 'agent_thompson') return buildAgentGeneric();
      return buildAgentGeneric();
    }

    // Faction-based fallback using characterId prefix patterns
    if (characterId) {
      if (characterId.startsWith('agent_')) return buildAgentGeneric();
      if (characterId.startsWith('citizen_')) {
        if (characterId.includes('woman') || characterId.includes('red') || characterId.includes('dj') || characterId.includes('priestess')) return buildWomanInRed();
        return buildCivilian();
      }
      // Zion crew members
      if (['tank', 'dozer', 'switch', 'mouse', 'apoc', 'link', 'niobe', 'ghost',
           'lock', 'mifune', 'kid', 'ballard', 'soren', 'roland', 'hamann', 'west',
           'dillard', 'zee', 'cas', 'maggie', 'bane', 'axel', 'vector', 'sparks',
           'charra', 'binary', 'malachi', 'ak', 'mauser', 'colt'].includes(characterId)) {
        return buildZionFighter();
      }
      // Merovingian crew
      if (['twin1', 'twin2', 'cain', 'abel_mero', 'trainman'].includes(characterId)) {
        if (characterId.startsWith('twin')) {
          // Twins: ghostly white appearance
          const model = buildAgentGeneric();
          model.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
              child.material = child.material.clone();
              child.material.color.setHex(0xcccccc);
              child.material.transparent = true;
              child.material.opacity = 0.7;
            }
          });
          return model;
        }
        return buildMerovingian();
      }
      // Programs
      if (['deus_ex_machina', 'architect'].includes(characterId)) return buildArchitect();
      if (['rama_kandra', 'kamala'].includes(characterId)) return buildCivilian();
    }

    // Faction string fallback from config
    if (config.isAgent) return buildAgentGeneric();
    return buildCivilian();
  }
}
