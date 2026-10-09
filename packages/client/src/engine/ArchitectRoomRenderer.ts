import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ARCHITECT_ROOM, architectDoorAngle, type ArchitectEncounter } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Circular CRT room, leather swivel chair and two physical doors. */
export class ArchitectRoomRenderer {
  readonly group = new THREE.Group();
  readonly chair = new THREE.Group();
  readonly leftDoor = new THREE.Group();
  readonly rightDoor = new THREE.Group();
  readonly screens: THREE.InstancedMesh[] = [];
  private fixed = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private neo: THREE.Texture[];
  private trinity: THREE.Texture;
  private displays: THREE.MeshBasicMaterial[];
  private time = { value: 0 };
  private exitGlow: THREE.Mesh;
  private disposed = false;
  constructor(root: THREE.Group) {
    const room = ARCHITECT_ROOM;
    this.group.name = 'architect-circular-control-room'; root.add(this.group);
    this.group.add(this.fixed, this.chair, this.leftDoor, this.rightDoor);
    const plaster = this.surface(0xe3e4df, .74), porcelain = this.surface(0xd5d8d2, .26);
    const black = this.surface(0x101312, .48), leather = this.surface(0x171a19, .43), chrome = this.surface(0xb3b6b2, .25, .85);
    const floor = this.mesh(this.fixed, this.own(new THREE.CylinderGeometry(room.radius + .15, room.radius + .15, .12, 96)), porcelain, 0, -.065, room.centerZ);
    floor.receiveShadow = true;
    for (let i = 0; i < 96; i++) {
      const theta = (i + .5) / 96 * Math.PI * 2, x = Math.cos(theta) * (room.radius + .5), z = room.centerZ + Math.sin(theta) * (room.radius + .5);
      const aperture = z < -24 && Object.values(room.doors).some(door => Math.abs(x - door.x) < room.doorWidth / 2 + .8);
      const bottom = aperture ? room.doorHeight + .35 : 0, height = room.height - bottom;
      const wall = this.box(this.fixed, plaster, x, bottom + height / 2, z, 2 * Math.PI * (room.radius + .5) / 96 + .1, height, .2);
      wall.rotation.y = Math.atan2(-x, room.centerZ - z);
    }
    const ceiling = this.mesh(this.fixed, this.own(new THREE.CircleGeometry(room.radius + .5, 96)), plaster, 0, room.height, room.centerZ); ceiling.rotation.x = Math.PI / 2;
    const loader = new THREE.TextureLoader();
    this.neo = [0, 1, 2, 3].map(index => {
      const texture = loader.load('/assets/architect/neo-reactions-atlas.png');
      texture.repeat.set(.5, .5); texture.offset.set(index % 2 * .5, index < 2 ? .5 : 0); return texture;
    });
    this.trinity = loader.load('/assets/architect/trinity-signal.png');
    for (const texture of [...this.neo, this.trinity]) { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; this.textures.add(texture); }
    this.displays = this.neo.map(map => {
      const material = new THREE.MeshBasicMaterial({ map, color: 0xdde0c7, toneMapped: false });
      material.onBeforeCompile = shader => {
        shader.uniforms.roomTime = this.time;
        shader.fragmentShader = 'uniform float roomTime;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
          float line = .96 + .04 * sin(vMapUv.y * 1350.0 + roomTime * 1.8);
          gl_FragColor.rgb *= line;
          #include <dithering_fragment>`);
      };
      this.materials.add(material); return material;
    });
    const n = room.screens, capacity = n.columns * n.rows;
    const cases = new THREE.InstancedMesh(this.own(new RoundedBoxGeometry(n.width + .12, n.height + .12, .5, 2, .085)), black, capacity);
    const geometry = this.own(new THREE.PlaneGeometry(n.width - .14, n.height - .14, 8, 5));
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) / (n.width / 2), y = positions.getY(i) / (n.height / 2);
      positions.setZ(i, .075 * (1 - x * x) * (1 - y * y));
    }
    geometry.computeVertexNormals();
    this.screens.push(...this.displays.map(material => new THREE.InstancedMesh(geometry, material, capacity)));
    const counts = [0, 0, 0, 0], dummy = new THREE.Object3D(); let index = 0;
    for (let row = 0; row < n.rows; row++) for (let col = 0; col < n.columns; col++) {
      const theta = (col + .5) / n.columns * Math.PI * 2, x = Math.cos(theta) * room.radius, z = room.centerZ + Math.sin(theta) * room.radius;
      const y = .95 + row * n.pitchY;
      if (y - n.height / 2 < room.doorHeight + .35 && z < -24 && Object.values(room.doors).some(door => Math.abs(x - door.x) < room.doorWidth / 2 + n.width / 2 + .15)) continue;
      const yaw = Math.atan2(-x, room.centerZ - z);
      dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix(); cases.setMatrixAt(index++, dummy.matrix);
      dummy.position.set(x + Math.sin(yaw) * .26, y, z + Math.cos(yaw) * .26); dummy.updateMatrix();
      const variant = (row * 7 + col * 11) % 4; this.screens[variant].setMatrixAt(counts[variant]++, dummy.matrix);
    }
    cases.name = 'CRT-wall-cases'; cases.count = index; cases.instanceMatrix.needsUpdate = true;
    this.fixed.add(cases, ...this.screens);
    this.screens.forEach((screen, i) => { screen.name = `CRT-wall-neo-${i}`; screen.count = counts[i]; screen.instanceMatrix.needsUpdate = true; screen.computeBoundingSphere(); });
    cases.computeBoundingSphere();
    this.chair.name = 'architect-black-leather-swivel-chair'; this.chair.position.set(room.chair.x, 0, room.chair.z);
    this.box(this.chair, leather, 0, room.chair.seat - .16, .05, 1.73, .32, room.chair.depth, .12);
    this.box(this.chair, leather, 0, 2.58, -.77, 1.9, 2.67, .36, .15);
    this.box(this.chair, leather, 0, 3.75, -.74, 1.72, .36, .38, .12);
    for (const side of [-1, 1]) {
      this.box(this.chair, leather, side * .84, room.chair.arm, .12, .26, .105, 1.42, .05);
      this.box(this.chair, chrome, side * .84, 1.56, .28, .065, .83, .07);
      this.box(this.chair, chrome, side * .84, 1.29, -.55, .065, .4, .07);
    }
    this.mesh(this.chair, this.own(new THREE.CylinderGeometry(.12, .14, .9, 16)), chrome, 0, .57, -.17);
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2, spoke = this.box(this.chair, chrome, Math.sin(angle) * .47, .14, -.17 + Math.cos(angle) * .47, .1, .09, .96, .035); spoke.rotation.y = angle;
      const wheel = this.mesh(this.chair, this.own(new THREE.CylinderGeometry(.09, .09, .13, 12)), black, Math.sin(angle) * .93, .095, -.17 + Math.cos(angle) * .93); wheel.rotation.z = Math.PI / 2;
    }
    for (const [side, hinge] of [['matrix', this.leftDoor], ['source', this.rightDoor]] as const) {
      const door = room.doors[side];
      hinge.name = `architect-${side}-hinge`; hinge.position.set(door.x - room.doorWidth / 2, 0, door.z);
      this.box(hinge, plaster, room.doorWidth / 2, room.doorHeight / 2, 0, room.doorWidth, room.doorHeight, .23, .04);
      this.box(hinge, chrome, room.doorWidth - .47, 3.1, .17, .08, .32, .045, .025);
      this.box(hinge, chrome, room.doorWidth - .66, 3.05, .21, .45, .055, .065, .025);
      for (const dx of [-room.doorWidth / 2 - .13, room.doorWidth / 2 + .13]) this.box(this.fixed, plaster, door.x + dx, room.doorHeight / 2, door.z, .22, room.doorHeight + .25, .48);
      this.box(this.fixed, plaster, door.x, room.doorHeight + .12, door.z, room.doorWidth + .48, .24, .48);
      this.box(this.fixed, porcelain, door.x, -.06, door.z - 1, room.doorWidth + .45, .12, 3.1);
    }
    this.exitGlow = this.mesh(this.fixed, this.own(new THREE.PlaneGeometry(room.doorWidth, room.doorHeight)),
      this.material(new THREE.MeshBasicMaterial({ color: 0xe7efdd, transparent: true, opacity: .4, toneMapped: false, side: THREE.DoubleSide, depthWrite: false })), room.doors.matrix.x, room.doorHeight / 2, room.doors.matrix.z - 2.3);
    this.exitGlow.visible = false;
    for (const [x, z] of [[-12, -7], [12, -7], [0, 9]]) {
      const light = new THREE.PointLight(0xe6ecd9, 70, 40, 2); light.position.set(x, 10, z); this.group.add(light);
    }
    const key = new THREE.SpotLight(0xf1edde, 150, 35, .7, .8, 1.7); key.position.set(-6, 11, -4); key.target.position.set(0, 2, -14);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0003; this.group.add(key, key.target);
    for (const group of [this.fixed, this.chair, this.leftDoor, this.rightDoor]) batchStaticGeometry(group, new Set()).forEach(g => this.geometries.add(g));
  }
  update(encounter?: ArchitectEncounter): void {
    this.time.value = encounter?.room?.elapsed ?? 0;
    this.chair.rotation.y = encounter?.room?.chairYaw ?? 0;
    this.leftDoor.rotation.y = architectDoorAngle(encounter);
    this.exitGlow.visible = this.leftDoor.rotation.y > .1;
    const live = Boolean(encounter && ['trinity', 'reflection', 'decision', 'failed', 'done'].includes(encounter.phase));
    this.displays.forEach((material, index) => {
      const map = live ? this.trinity : this.neo[index];
      if (material.map !== map) { material.map = map; material.needsUpdate = true; }
      material.color.setHex(encounter?.phase === 'failed' ? 0x000000 : 0xdde0c7);
    });
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private surface(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial { return this.material(new THREE.MeshStandardMaterial({ color, roughness, metalness })); }
  private own<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0): THREE.Mesh {
    return this.mesh(parent, this.own(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d)), material, x, y, z);
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.group.traverse(object => { if (object instanceof THREE.Light) object.dispose(); }); this.group.removeFromParent();
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
  }
}
