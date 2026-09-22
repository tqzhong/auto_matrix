import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FILM_SETS, LOCATIONS, LIFE_ROOMS, STREET_SPACING, locationEntrance, CITY_BUILDINGS, cityNoise as noise } from '@auto_matrix/shared';
import { UrbanMaterials } from './UrbanMaterials.js';
import { LifeInteriors } from './LifeInteriors.js';

export class VoxelRenderer {
  readonly matrix = new THREE.Group();
  readonly real = new THREE.Group();
  interiors!: LifeInteriors;
  private textures: THREE.Texture[] = [];
  private traffic: THREE.InstancedMesh | null = null;
  private headlights: THREE.InstancedMesh | null = null;
  private materials = new UrbanMaterials();
  private markers: THREE.Mesh[] = [];
  private signs: { sprite: THREE.Sprite; width: number }[] = [];
  private transform = new THREE.Object3D();

  constructor(private scene: THREE.Scene) {
    scene.add(this.matrix, this.real);
    this.real.visible = false;
  }

  init(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), this.materials.surface('concrete_pavement_03', 4000, 4000, 12));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(1280, -0.15, 1280);
    floor.receiveShadow = true;
    this.matrix.add(floor);
    this.buildStreets();
    this.buildBuildings();
    this.buildArchitectureDetails();
    this.buildLandmarks();
    this.interiors = new LifeInteriors(this.matrix);
    this.buildStreetDetails();
    this.buildRealWorld();
    this.buildTrilogySites();
    this.buildTraffic();
  }

  private buildBuildings(): void {
    const lots = CITY_BUILDINGS.filter(building => !building.location).map(building => ({ x: building.x, z: building.z, h: building.height, w: building.width, variant: building.variant }));
    for (let variant = 0; variant < 4; variant++) {
      const side = this.materials.facade(variant);
      const top = new THREE.MeshStandardMaterial({ color: 0x444b44, roughness: 0.9 });
      const filtered = lots.filter(l => l.variant === variant);
      const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [side, side, top, top, side, side], filtered.length);
      const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), top, filtered.length);
      filtered.forEach((lot, i) => {
        this.transform.position.set(lot.x, lot.h / 2, lot.z);
        this.transform.scale.set(lot.w, lot.h, lot.w * 0.82);
        this.transform.updateMatrix();
        towers.setMatrixAt(i, this.transform.matrix);
        this.transform.position.y = lot.h + 3;
        this.transform.scale.set(lot.w * 0.5, 6, lot.w * 0.5);
        this.transform.updateMatrix();
        roofs.setMatrixAt(i, this.transform.matrix);
      });
      towers.castShadow = true;
      towers.receiveShadow = true;
      this.matrix.add(towers, roofs);
    }
  }

  private buildArchitectureDetails(): void {
    const stone: THREE.Matrix4[] = []; const glass: THREE.Matrix4[] = []; const metal: THREE.Matrix4[] = [];
    const box = (list: THREE.Matrix4[], x: number, y: number, z: number, w: number, h: number, d: number) => {
      this.transform.position.set(x, y, z); this.transform.scale.set(w, h, d); this.transform.rotation.set(0, 0, 0);
      this.transform.updateMatrix(); list.push(this.transform.matrix.clone());
    };
    for (const lot of CITY_BUILDINGS) {
      if (lot.location && LIFE_ROOMS[lot.location]) continue;
      box(stone, lot.x, .35, lot.z, lot.width + .3, .7, lot.depth + .3);
      box(stone, lot.x, lot.height, lot.z, lot.width + .8, .7, lot.depth + .8);
      for (let y = 13.6; y < Math.min(lot.height, 55); y += 13.6) box(stone, lot.x, y, lot.z, lot.width + .35, .28, lot.depth + .35);
      if (Math.hypot(lot.x - 1120, lot.z - 920) > 560) continue;
      const front = lot.z + lot.depth / 2;
      for (let x = lot.x - lot.width / 2 + 5; x < lot.x + lot.width / 2 - 3; x += 9) {
        box(glass, x, 3.7, front + .12, 7, 5.8, .15);
        box(stone, x - 3.7, 3.6, front + .2, .65, 6.5, .65);
        box(metal, x, 3.7, front + .25, .12, 5.8, .12);
        box(metal, x, 4.1, front + .25, 7, .12, .12);
        box(metal, x + 2, 2.5, front + .34, .07, 1.3, .08);
      }
      box(stone, lot.x, 7.2, front + .35, lot.width, .65, 1.1);
      box(metal, lot.x, 8.3, front + 1.3, lot.width * .7, .24, 2.8);
      box(metal, lot.x - lot.width / 2 + .35, lot.height / 2, front + .4, .24, lot.height, .24);
      if (lot.height > 45) {
        for (const side of [-1, 1]) box(metal, lot.x + side * 3, lot.height + 3, lot.z, 3.8, 5.5, 5);
      }
    }
    for (const [placements, material] of [
      [stone, new THREE.MeshStandardMaterial({ color: 0x646c61, roughness: .88 })],
      [glass, new THREE.MeshPhysicalMaterial({ color: 0x243734, metalness: .38, roughness: .2, clearcoat: .7 })],
      [metal, new THREE.MeshStandardMaterial({ color: 0x242c28, metalness: .65, roughness: .48 })],
    ] as const) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, placements.length);
      placements.forEach((matrix, index) => mesh.setMatrixAt(index, matrix)); mesh.castShadow = mesh.receiveShadow = true; this.matrix.add(mesh);
    }
  }

  private buildTraffic(): void {
    const pieces: THREE.BufferGeometry[] = []; const lamps: THREE.BufferGeometry[] = [];
    const part = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, color: string, list = pieces) => {
      geometry.translate(x, y, z); const rgb = new THREE.Color(color); const colors: number[] = [];
      for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(rgb.r, rgb.g, rgb.b);
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); list.push(geometry);
    };
    part(new THREE.BoxGeometry(3.5, .9, 7.7), 0, 1.1, 0, '#3c4b45');
    part(new THREE.BoxGeometry(3.25, .3, 7.9), 0, .76, 0, '#1a221f');
    part(new THREE.BoxGeometry(2.95, 1.05, 3.9), 0, 2, -.45, '#20312f');
    part(new THREE.BoxGeometry(2.95, .16, 3.9), 0, 2.61, -.45, '#46514a');
    for (const side of [-1, 1]) {
      part(new THREE.BoxGeometry(.13, 1.2, .2), side * 1.49, 2, -.35, '#49534b');
      part(new THREE.BoxGeometry(.33, .24, .6), side * 1.83, 1.75, .9, '#48514b');
      for (const z of [-2.5, 2.5]) {
        const tyre = new THREE.CylinderGeometry(.65, .65, .34, 16); tyre.rotateZ(Math.PI / 2);
        part(tyre, side * 1.73, .67, z, '#111614');
        const hub = new THREE.CylinderGeometry(.36, .36, .36, 12); hub.rotateZ(Math.PI / 2);
        part(hub, side * 1.74, .67, z, '#707b71');
      }
      part(new THREE.BoxGeometry(.86, .3, .09), side * 1.05, 1.22, 3.9, '#e1e5ca', lamps);
      part(new THREE.BoxGeometry(.9, .28, .09), side * 1.04, 1.23, -3.9, '#a82c23', lamps);
    }
    const geometry = mergeGeometries(pieces)!; const lightGeometry = mergeGeometries(lamps)!;
    [...pieces, ...lamps].forEach(piece => piece.dispose());
    this.traffic = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .48 }), 64);
    this.traffic.castShadow = this.traffic.receiveShadow = true;
    this.headlights = new THREE.InstancedMesh(lightGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff, toneMapped: false }), 64);
    this.matrix.add(this.traffic, this.headlights);
  }

  private buildStreets(): void {
    const asphalt = this.materials.surface('asphalt_02', 17, 2000, 8);
    for (let n = 240; n <= 2000; n += STREET_SPACING) {
      for (let direction = 0; direction < 2; direction++) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(17, 2000), asphalt);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = direction * Math.PI / 2;
        road.position.set(direction ? 1160 : n, 0, direction ? n : 1120);
        road.receiveShadow = true;
        this.matrix.add(road);
      }
    }
    const lines: number[] = [];
    for (let n = 240; n <= 2000; n += STREET_SPACING) for (let p = 200; p < 2060; p += 22) {
      lines.push(n, 0.08, p, n, 0.08, p + 9, p, 0.08, n, p + 9, 0.08, n);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.matrix.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x607766, transparent: true, opacity: 0.45 })));

    const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 10, 0.5), new THREE.MeshStandardMaterial({ color: 0x526359 }), 400);
    const glow = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.35, 1), new THREE.MeshBasicMaterial({ color: 0xcbeecb }), 400);
    let index = 0;
    for (let x = 640; x <= 1600; x += 80) for (let z = 480; z <= 1600; z += 80) {
      this.transform.scale.set(1, 1, 1);
      this.transform.position.set(x + 10, 5, z + 15);
      this.transform.updateMatrix();
      lamps.setMatrixAt(index, this.transform.matrix);
      this.transform.position.set(x + 9, 10, z + 15);
      this.transform.updateMatrix();
      glow.setMatrixAt(index++, this.transform.matrix);
    }
    lamps.count = glow.count = index;
    this.matrix.add(lamps, glow);
  }

  private buildLandmarks(): void {
    for (const location of Object.values(LOCATIONS)) {
      if (location.world !== 'matrix' || location.id === 'downtown' || FILM_SETS[location.id]) continue;
      const { min, max } = location.bounds;
      const centerX = (min.x + max.x) / 2;
      const centerZ = (min.z + max.z) / 2;
      if (location.id === 'central_park') {
        const park = new THREE.Mesh(new THREE.BoxGeometry(max.x - min.x, 0.6, max.z - min.z), new THREE.MeshStandardMaterial({ color: 0x5b7442, roughness: 1 }));
        park.position.set(centerX, 0, centerZ);
        this.matrix.add(park);
        const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(.7, 1, 1, 7), new THREE.MeshStandardMaterial({ color: 0x353b2f, roughness: 1 }), 35 * 7);
        const foliage = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95 }), 35 * 288);
        let branchIndex = 0; let leafIndex = 0;
        const up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < 35; i++) {
          const x = min.x + 12 + noise(i, 1) * (max.x - min.x - 24); const z = min.z + 12 + noise(i, 2) * (max.z - min.z - 24);
          const height = 7 + noise(i, 3) * 3;
          this.transform.position.set(x, height / 2, z); this.transform.rotation.set(0, 0, 0); this.transform.scale.set(.35, height, .35); this.transform.updateMatrix();
          branches.setMatrixAt(branchIndex++, this.transform.matrix);
          for (let b = 0; b < 6; b++) {
            const angle = b * 2.4 + i; const start = new THREE.Vector3(x, height * .45 + b * .35, z);
            const tip = new THREE.Vector3(x + Math.cos(angle) * 3.1, height - .8 + noise(i, b + 5) * 2, z + Math.sin(angle) * 3.1);
            const direction = tip.clone().sub(start);
            this.transform.position.copy(start).addScaledVector(direction, .5); this.transform.quaternion.setFromUnitVectors(up, direction.clone().normalize());
            this.transform.scale.set(.13, direction.length(), .13); this.transform.updateMatrix(); branches.setMatrixAt(branchIndex++, this.transform.matrix);
            for (let leaf = 0; leaf < 48; leaf++) {
              const a = leaf * 2.4 + angle; const radius = Math.sqrt(noise(leaf, i + b + 8)) * 1.65;
              this.transform.position.set(tip.x + Math.cos(a) * radius, tip.y + noise(leaf, b + 18) * 2 - .9, tip.z + Math.sin(a) * radius);
              this.transform.rotation.set(noise(leaf, i + 20) * Math.PI, a, noise(leaf, b + 25) * Math.PI);
              this.transform.scale.set(.32, .55 + noise(leaf, i) * .25, .045); this.transform.updateMatrix(); foliage.setMatrixAt(leafIndex, this.transform.matrix);
              foliage.setColorAt(leafIndex++, new THREE.Color(0x253e29).lerp(new THREE.Color(0x52694a), noise(leaf, b + 29)));
            }
          }
        }
        branches.castShadow = branches.receiveShadow = foliage.castShadow = foliage.receiveShadow = true;
        this.matrix.add(branches, foliage); this.transform.rotation.set(0, 0, 0); this.transform.scale.set(1, 1, 1);
      } else if (location.isInterior && location.id !== 'subway_station') {
        const height = location.id === 'metacortex_office' ? 110 : location.id === 'architects_chamber' ? 160 : Math.max(12, max.y - min.y);
        const mat = this.materials.facade(Math.floor(centerX));
        const roof = new THREE.MeshStandardMaterial({ color: 0x263930 });
        const room = LIFE_ROOMS[location.id]; const base = room ? 10 : 0;
        const building = new THREE.Mesh(new THREE.BoxGeometry(max.x - min.x, height - base, max.z - min.z), [mat, mat, roof, roof, mat, mat]);
        building.position.set(centerX, base + (height - base) / 2, centerZ);
        building.castShadow = true;
        building.receiveShadow = true;
        this.matrix.add(building);
        if (room) {
          const backDepth = max.z - min.z - room.depth;
          if (backDepth > 0) {
            const back = new THREE.Mesh(new THREE.BoxGeometry(max.x - min.x, 10, backDepth), mat);
            back.position.set(centerX, 5, min.z + backDepth / 2); back.castShadow = true; this.matrix.add(back);
          }
          const sideWidth = (max.x - min.x - room.width) / 2;
          if (sideWidth > 0) for (const sign of [-1, 1]) {
            const side = new THREE.Mesh(new THREE.BoxGeometry(sideWidth, 10, room.depth), mat);
            side.position.set(centerX + sign * (room.width / 2 + sideWidth / 2), 5, max.z - room.depth / 2); side.castShadow = true; this.matrix.add(side);
          }
        }
        if (location.id === 'metacortex_office') this.sign('METACORTEX', new THREE.Vector3(centerX, height + 7, centerZ), 54, '#b5e8bd', this.matrix);
      }
      const entrance = locationEntrance(location.id);
      if (location.id === 'rooftop_A') {
        const platform = new THREE.Mesh(new THREE.BoxGeometry(44, 50, 55), new THREE.MeshStandardMaterial({ color: 0x283c33 }));
        platform.position.set(entrance.x, 25, entrance.z - 12);
        this.matrix.add(platform);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(8, 8.5, 48), new THREE.MeshBasicMaterial({ color: 0x62d9a0, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(entrance.x, entrance.y + 0.05, entrance.z);
      this.matrix.add(ring);
      this.markers.push(ring);
      if (['metacortex_office', 'nightclub', 'times_square', 'oracles_apartment', 'subway_station'].includes(location.id)) {
        this.sign(location.id === 'times_square' ? 'SECTOR 01 / MIDTOWN' : location.name.toUpperCase(), new THREE.Vector3(entrance.x, entrance.y + 12, entrance.z), 40, '#84b69a', this.matrix);
      }
    }
    for (const [text, x, y, z, color] of [
      ['METRO / NEWS', 1110, 28, 958, '#d6cbb6'], ['DOWNTOWN', 1070, 17, 915, '#b3c4c9'], ['GOA', 930, 20, 813, '#d6bb9c'],
    ] as const) this.sign(text, new THREE.Vector3(x, y, z), 32, color, this.matrix);
  }

  private buildStreetDetails(): void {
    const metal = new THREE.MeshStandardMaterial({ color: 0x293c31, roughness: 0.4, metalness: 0.65 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0x666b60, roughness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x173e32, roughness: 0.13, metalness: 0.7 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xc9d9a6 });
    const roadMarkings: THREE.Matrix4[] = [];
    for (let x = 800; x <= 1440; x += 80) for (let z = 640; z <= 1200; z += 80) {
      for (let line = 0; line < 6; line++) {
        this.transform.position.set(x - 6 + line * 2.4, 0.13, z + 16);
        this.transform.scale.set(1, 1, 1); this.transform.updateMatrix();
        roadMarkings.push(this.transform.matrix.clone());
      }
      const curb = new THREE.Mesh(new THREE.BoxGeometry(38, 0.28, 2), concrete);
      curb.position.set(x + 28, 0.05, z + 11); this.matrix.add(curb);
      if (noise(x, z) > 0.5) {
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 1.5, 8), metal);
        bin.position.set(x + 12, 0.9, z + 20); this.matrix.add(bin);
      }
      const reflection = new THREE.Mesh(new THREE.PlaneGeometry(2, 16), new THREE.MeshBasicMaterial({ color: 0xc5ccb1, transparent: true, opacity: 0.025, depthWrite: false }));
      reflection.rotation.x = -Math.PI / 2; reflection.position.set(x + 6, 0.09, z + 12); this.matrix.add(reflection);
    }
    const crossing = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.03, 7), new THREE.MeshStandardMaterial({ color: 0x7e9580, roughness: 0.7 }), roadMarkings.length);
    roadMarkings.forEach((matrix, i) => crossing.setMatrixAt(i, matrix)); this.matrix.add(crossing);

    const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), 1440);
    let leafIndex = 0;
    for (const id of ['metacortex_office', 'nightclub', 'oracles_apartment', 'merovingians_restaurant']) {
      if (LIFE_ROOMS[id]) continue;
      const entrance = locationEntrance(id);
      const door = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 0.5), glass);
      door.position.set(entrance.x, 3.5, entrance.z - 8.5); this.matrix.add(door);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(12, 0.7, 5), metal);
      awning.position.set(entrance.x, 8, entrance.z - 6.5); this.matrix.add(awning);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.18, 0.2), glow);
      strip.position.set(entrance.x, 7.55, entrance.z - 4); this.matrix.add(strip);
      for (const side of [-1, 1]) {
        const planter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 2.5), concrete);
        planter.position.set(entrance.x + side * 8, 0.75, entrance.z - 3); this.matrix.add(planter);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.09, .16, 1.8, 7), metal);
        trunk.position.set(entrance.x + side * 8, 2, entrance.z - 3); this.matrix.add(trunk);
        for (let i = 0; i < 180; i++) {
          const angle = i * 2.39996; const radius = Math.sqrt(noise(i + leafIndex, side)) * 1.15;
          this.transform.position.set(entrance.x + side * 8 + Math.cos(angle) * radius, 1.65 + noise(i, 31) * 1.65, entrance.z - 3 + Math.sin(angle) * radius);
          this.transform.rotation.set(noise(i, 19) * 1.3, angle, -.4 + noise(i, 24) * .8);
          this.transform.scale.set(.17, .3 + noise(i, 16) * .18, .035); this.transform.updateMatrix();
          leaves.setMatrixAt(leafIndex, this.transform.matrix);
          leaves.setColorAt(leafIndex++, new THREE.Color(0x253b22).lerp(new THREE.Color(0x516744), noise(i, 28)));
        }
      }
      const light = new THREE.PointLight(0xa9d99c, 80, 24, 2);
      light.position.set(entrance.x, 6, entrance.z - 3); this.matrix.add(light);
    }
    leaves.count = leafIndex; leaves.castShadow = leaves.receiveShadow = true; this.matrix.add(leaves);
    this.transform.rotation.set(0, 0, 0); this.transform.scale.set(1, 1, 1);
    const phonePosition = locationEntrance('subway_station');
    const phone = new THREE.Group(); phone.position.set(phonePosition.x + 10, 0, phonePosition.z);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(3, 7, 3), new THREE.MeshStandardMaterial({ color: 0x255037, metalness: 0.6, roughness: 0.35 }));
    booth.position.y = 3.5; phone.add(booth);
    const window = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4, 3.04), new THREE.MeshStandardMaterial({ color: 0x97cfa3, emissive: 0x235b39, roughness: 0.15, metalness: 0.8 }));
    window.position.y = 4; phone.add(window); this.matrix.add(phone);
    this.sign('EXIT / PHONE', new THREE.Vector3(phonePosition.x + 10, 9, phonePosition.z), 14, '#c3efb0', this.matrix);
    const realPosition = locationEntrance('nebuchadnezzar');
    this.sign('JACK IN / R', new THREE.Vector3(realPosition.x, realPosition.y + 5, realPosition.z), 14, '#edcb92', this.real);
  }

  private sign(text: string, position: THREE.Vector3, width: number, color: string, group: THREE.Group): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0a1915'; ctx.fillRect(0, 0, 512, 80);
    ctx.strokeStyle = color; ctx.strokeRect(2, 2, 508, 76);
    ctx.font = '500 26px monospace'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 40, 490);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(texture);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.9 }));
    sprite.position.copy(position); sprite.scale.set(width, width / 6.4, 1);
    this.signs.push({ sprite, width });
    group.add(sprite);
  }

  private buildRealWorld(): void {
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(450, 450, 5, 64), new THREE.MeshStandardMaterial({ color: 0x282a25, roughness: 0.65, metalness: 0.5 }));
    floor.position.set(2170, -104, 2390);
    this.real.add(floor);
    const grid = new THREE.GridHelper(900, 45, 0x8b7250, 0x403e30);
    grid.position.set(2170, -101, 2390);
    this.real.add(grid);
    for (const location of Object.values(LOCATIONS).filter(l => l.world === 'real' && !FILM_SETS[l.id])) {
      const entry = locationEntrance(location.id);
      const platform = new THREE.Mesh(new THREE.BoxGeometry(64, 3, 52), new THREE.MeshStandardMaterial({ color: 0x4b4937, metalness: 0.65, roughness: 0.5 }));
      platform.position.set(entry.x, entry.y - 2.5, entry.z - 8);
      this.real.add(platform);
      this.sign(location.name.toUpperCase(), new THREE.Vector3(entry.x, entry.y + 18, entry.z), 48, '#d8bb7f', this.real);
      for (let i = 0; i < 4; i++) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 30, 8), new THREE.MeshStandardMaterial({ color: 0x6c6350, metalness: 0.75, roughness: 0.3 }));
        column.position.set(entry.x - 27 + (i % 2) * 54, entry.y + 12, entry.z - 25 + Math.floor(i / 2) * 38);
        this.real.add(column);
      }
    }
  }

  private buildTrilogySites(): void {
    const metal = new THREE.MeshStandardMaterial({ color: 0x34433d, metalness: .7, roughness: .35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x12211c, roughness: .6 });
    const pale = new THREE.MeshStandardMaterial({ color: 0xaeb9a3, roughness: .85 });
    const amber = new THREE.MeshBasicMaterial({ color: 0xddbb80 });
    const box = (group: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
    };
    const dojo = locationEntrance('training_dojo');
    box(this.matrix, dark, dojo.x, .05, dojo.z + 12, 50, .2, 36);
    const tatami = new THREE.MeshStandardMaterial({ color: 0x77785a, roughness: 1 });
    for (let x = -20; x <= 20; x += 8) for (let z = -8; z <= 32; z += 8) {
      box(this.matrix, tatami, dojo.x + x, .07, dojo.z + z, 7.9, .05, 7.9);
      box(this.matrix, dark, dojo.x + x - 3.8, .11, dojo.z + z, .16, .02, 7.9);
    }
    for (const x of [-25, 25]) for (const z of [-10, 32]) box(this.matrix, dark, dojo.x + x, 7, dojo.z + z, .8, 14, .8);
    box(this.matrix, dark, dojo.x, 14, dojo.z - 10, 54, 1, 1.2);
    this.sign('CONSTRUCT / KUNG FU', new THREE.Vector3(dojo.x, 12, dojo.z - 10), 28, '#ccd5b3', this.matrix);

    const freeway = locationEntrance('freeway');
    box(this.matrix, dark, freeway.x + 90, .02, freeway.z + 9, 580, .1, 48);
    for (let x = freeway.x - 190; x < freeway.x + 380; x += 18) box(this.matrix, pale, x, .12, freeway.z + 9, 10, .08, .3);
    for (const z of [-18, 36]) box(this.matrix, metal, freeway.x + 90, 1.4, freeway.z + z, 580, .45, .45);
    for (const x of [-140, 240]) {
      box(this.matrix, metal, freeway.x + x, 11, freeway.z - 15, 1, 22, 1);
      box(this.matrix, metal, freeway.x + x, 22, freeway.z + 9, 1, .6, 49);
    }
    this.sign('FREEWAY 101 / EXIT →', new THREE.Vector3(freeway.x + 100, 18, freeway.z + 9), 42, '#c5de9c', this.matrix);

    const mobil = locationEntrance('mobil_ave');
    box(this.matrix, pale, mobil.x, .06, mobil.z + 22, 115, .2, 44);
    for (let i = -2; i <= 2; i++) {
      box(this.matrix, pale, mobil.x + i * 22, 5, mobil.z + 40, 1.4, 10, 1.4);
      box(this.matrix, dark, mobil.x + i * 22, 1.2, mobil.z + 26, 12, 1.2, 2);
    }
    box(this.matrix, pale, mobil.x, 10, mobil.z + 37, 116, .8, 14);
    this.sign('MOBIL AVE', new THREE.Vector3(mobil.x, 8, mobil.z + 30), 25, '#e4dfc7', this.matrix);

    const dock = locationEntrance('zion_dock');
    for (const side of [-1, 1]) {
      const x = dock.x + side * 27; const z = dock.z - 3;
      box(this.real, metal, x, dock.y + 4, z, 5, 5, 3);
      for (const limb of [-1, 1]) {
        box(this.real, dark, x + limb * 2, dock.y + 1, z, 1.4, 4, 1.8);
        box(this.real, metal, x + limb * 4, dock.y + 4.5, z + 2, 1.2, 1.4, 7);
      }
      box(this.real, amber, x, dock.y + 6.5, z + 1.6, 2.5, .6, .1);
    }
    this.sign('ZION / HOLD THE DOCK', new THREE.Vector3(dock.x, dock.y + 12, dock.z - 6), 36, '#debf88', this.real);
    const machine = locationEntrance('machine_city');
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2; const h = 22 + (i % 4) * 12;
      box(this.real, metal, machine.x + Math.cos(a) * 48, machine.y + h / 2, machine.z + Math.sin(a) * 38 - 15, 6, h, 6);
      box(this.real, amber, machine.x + Math.cos(a) * 48, machine.y + h, machine.z + Math.sin(a) * 38 - 15, 5, .4, 5);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 1), new THREE.MeshStandardMaterial({ color: 0x57452a, emissive: 0x7e5b21, emissiveIntensity: .4, wireframe: true }));
    core.position.set(machine.x, machine.y + 26, machine.z - 8); this.real.add(core);
    this.sign('01 / DEUS EX MACHINA', new THREE.Vector3(machine.x, machine.y + 45, machine.z - 8), 45, '#ead699', this.real);
  }

  setWorld(matrix: boolean): void { this.matrix.visible = matrix; this.real.visible = !matrix; }
  setWeather(wet: boolean): void { this.materials.setWet(wet); }

  update(elapsed: number, playerCamera?: THREE.Camera): void {
    for (const marker of this.markers) marker.visible = !playerCamera;
    for (const { sprite, width } of this.signs) {
      const distance = playerCamera ? sprite.position.distanceTo(playerCamera.position) : Infinity;
      sprite.visible = distance > 35 && (!playerCamera || distance < 160);
      const size = playerCamera ? Math.min(width, distance * 0.3) : width;
      sprite.scale.set(size, size / 6.4, 1);
    }
    if (!this.traffic) return;
    for (let i = 0; i < 64; i++) {
      const axis = i % 2;
      const lane = 640 + (i % 12) * 80 + (i % 4 < 2 ? 4 : -4);
      const forward = i % 4 < 2;
      const progress = 300 + ((elapsed * (10 + i % 7) + i * 83) % 1550);
      const route = forward ? progress : 2150 - progress;
      this.transform.position.set(axis ? lane : route, .05, axis ? route : lane);
      this.transform.rotation.y = (axis ? 0 : Math.PI / 2) + (forward ? 0 : Math.PI);
      this.transform.scale.set(1, 1, 1);
      this.transform.updateMatrix();
      this.traffic.setMatrixAt(i, this.transform.matrix);
      this.headlights?.setMatrixAt(i, this.transform.matrix);
    }
    this.traffic.instanceMatrix.needsUpdate = true;
    if (this.headlights) this.headlights.instanceMatrix.needsUpdate = true;
    this.transform.rotation.y = 0;
  }

  updateVisibility(_x: number, _z: number): void { /* Instanced city uses renderer frustum culling. */ }

  dispose(): void {
    this.interiors.dispose();
    for (const group of [this.matrix, this.real]) {
      this.scene.remove(group);
      group.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) object.geometry.dispose();
        if ('material' in object) {
          const materials = (object as THREE.Mesh).material;
          for (const material of Array.isArray(materials) ? materials : [materials]) material.dispose();
        }
      });
    }
    this.textures.forEach(texture => texture.dispose());
    this.materials.dispose();
  }
}
