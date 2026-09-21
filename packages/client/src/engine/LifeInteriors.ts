import * as THREE from 'three';
import { LIFE_ROOMS, lifeRoomCenter, insideLifeRoom, type NeoLifeState, type Vector3 } from '@auto_matrix/shared';

export class LifeInteriors {
  private textures: THREE.Texture[] = [];
  private lights: { light: THREE.PointLight; location: string }[] = [];
  private clocks: THREE.Group[] = [];
  private screens: THREE.MeshStandardMaterial[] = [];
  private cats = new THREE.Group();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private cylinder = new THREE.CylinderGeometry(1, 1, 1, 24);
  private sphere = new THREE.SphereGeometry(1, 20, 12);
  private materials = new Map<string, THREE.MeshStandardMaterial>();

  constructor(parent: THREE.Group) {
    for (const [id, room] of Object.entries(LIFE_ROOMS)) {
      const center = lifeRoomCenter(id)!; const group = new THREE.Group(); group.position.set(center.x, 0, center.z); parent.add(group);
      const plaster = room.theme === 'office' ? '#d1d7d4' : room.theme === 'bar' ? '#403c43' : room.theme === 'oracle' ? '#b7bf91' : '#ded3bd';
      this.part(group, [0, .04, 0], [room.width, .08, room.depth], room.theme === 'office' ? '#858d8d' : '#8c7258');
      for (let z = -room.depth / 2; z < room.depth / 2; z += 1.4) this.part(group, [0, .09, z], [room.width, .01, .026], room.theme === 'office' ? '#6b7573' : '#665643');
      this.part(group, [0, 5, -room.depth / 2], [room.width, 10, .6], plaster);
      for (const side of [-1, 1]) {
        this.part(group, [side * room.width / 2, 5, 0], [.6, 10, room.depth], plaster);
        this.part(group, [side * room.width / 2, .45, 0], [.8, .9, room.depth], '#655f51');
        const panelWidth = (room.width - 10) / 2;
        this.part(group, [side * (5 + panelWidth / 2), 5, room.depth / 2], [panelWidth, 10, .5], plaster);
        this.part(group, [side * (room.width / 2 - .37), 5.4, 1], [.06, 5, 7], '#abc2cc', .25);
        this.part(group, [side * (room.width / 2 - .43), 5.4, 1], [.06, .12, 7.2], '#eae7dc');
        for (const z of [-2.5, 1, 4.5]) this.part(group, [side * (room.width / 2 - .43), 5.4, z], [.07, 5.2, .13], '#eae7dc');
        this.part(group, [side * (room.width / 2 - .55), 2.85, 1], [.6, .18, 7.5], '#e5e0d2');
      }
      this.part(group, [0, 9.8, room.depth / 2], [10, .4, .6], plaster);
      this.part(group, [0, .45, -room.depth / 2 + .3], [room.width, .9, .25], '#655f51');
      this.label(group, id === 'neo_apartment' ? '101  /  THOMAS ANDERSON' : id === 'metacortex_office' ? 'METACORTEX  /  DEVELOPMENT' : id === 'nightclub' ? 'GOA  /  MUSIC & CONVERSATION' : id === 'oracles_apartment' ? 'MAKE YOURSELF AT HOME' : 'ASTER COFFEE  /  EST. 1989', [0, 8.6, -room.depth / 2 + .4], 14, '#4c5144', '#d6d0bc');
      const lamp = new THREE.PointLight(room.theme === 'office' ? 0xe8f2ff : room.theme === 'bar' ? 0xe5af76 : 0xffdbab, room.theme === 'bar' ? 100 : 180, 28, 2);
      lamp.position.set(0, 7.4, 1); group.add(lamp); this.lights.push({ light: lamp, location: id });
      this.part(group, [0, 8.8, 0], [.08, 1.6, .08], '#343937');
      this.part(group, [0, 8, 0], [room.theme === 'office' ? 9 : 3, .22, 1.6], '#f3e6cc', .65);
      if (room.theme === 'home') this.home(group);
      if (room.theme === 'office') this.office(group);
      if (room.theme === 'cafe' || room.theme === 'bar') this.cafe(group, room.theme === 'bar');
      if (room.theme === 'oracle') this.oracle(group);
      this.plant(group, room.width / 2 - 2.5, room.depth / 2 - 3);
      const clock = new THREE.Group(); clock.position.set(-room.width / 2 + 4, 7.3, -room.depth / 2 + .55); group.add(clock);
      const face = this.part(clock, [0, 0, 0], [1.5, 1.5, .1], '#eae5d4', 0, this.sphere);
      face.scale.z = .12;
      const hands = new THREE.Group(); hands.add(this.part(new THREE.Group(), [0, .4, .18], [.05, .8, .05], '#263438')); clock.add(hands); this.clocks.push(hands);
    }
    for (const offset of [0, 2.6]) {
      const cat = new THREE.Group(); cat.position.x = offset;
      this.part(cat, [0, .7, 0], [.35, .43, .85], '#18191b', 0, this.sphere);
      this.part(cat, [0, 1.03, .5], [.32, .32, .3], '#18191b', 0, this.sphere);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(.13, .3, 3), this.material('#18191b')); ear.position.set(side * .2, 1.39, .5); cat.add(ear);
        for (const z of [-.45, .45]) this.part(cat, [side * .23, .35, z], [.12, .6, .13], '#18191b');
      }
      this.cats.add(cat);
    }
    this.cats.visible = false; parent.add(this.cats);
  }
  private material(color: string, glow = 0): THREE.MeshStandardMaterial {
    const key = `${color}:${glow}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .05, emissive: color, emissiveIntensity: glow }));
    return this.materials.get(key)!;
  }
  private part(parent: THREE.Group, position: number[], scale: number[], color: string, glow = 0, geometry: THREE.BufferGeometry = this.box): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material(color, glow));
    mesh.position.set(position[0], position[1], position[2]); mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private label(parent: THREE.Group, text: string, position: number[], width: number, ink: string, background: string): void {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = ink; ctx.font = '500 35px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 80, 950);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; this.textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 6.4), new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }));
    mesh.position.set(position[0], position[1], position[2]); parent.add(mesh);
  }
  private table(group: THREE.Group, x: number, z: number, width = 6, depth = 3, color = '#866749'): void {
    this.part(group, [x, 2.45, z], [width, .22, depth], color);
    for (const a of [-1, 1]) for (const b of [-1, 1]) this.part(group, [x + a * (width / 2 - .3), 1.2, z + b * (depth / 2 - .3)], [.16, 2.4, .16], '#3c4443');
  }
  private chair(group: THREE.Group, x: number, z: number, facing = 0): void {
    const chair = new THREE.Group(); chair.position.set(x, 0, z); chair.rotation.y = facing; group.add(chair);
    this.part(chair, [0, 1.5, 0], [1.7, .3, 1.6], '#655c4e'); this.part(chair, [0, 2.5, -.7], [1.7, 1.8, .2], '#655c4e');
    for (const a of [-.65, .65]) for (const b of [-.6, .6]) this.part(chair, [a, .7, b], [.13, 1.4, .13], '#333d3b');
  }
  private computer(group: THREE.Group, x: number, z: number): void {
    this.part(group, [x, 3.25, z], [2.3, 1.55, 1.6], '#c1bbaa');
    const screen = this.part(group, [x, 3.28, z + .83], [1.93, 1.17, .03], '#688993', .35);
    this.screens.push(screen.material as THREE.MeshStandardMaterial);
    this.label(group, 'C : /  WORKSPACE', [x, 3.4, z + .86], 1.75, '#c7e1d7', '#24343c');
    this.part(group, [x, 2.64, z + 1.2], [2.6, .16, .8], '#beb9ac');
    for (let row = 0; row < 3; row++) for (let key = 0; key < 11; key++) this.part(group, [x - 1.1 + key * .21, 2.74, z + 1 + row * .2], [.17, .05, .15], '#797e76');
    this.part(group, [x + 1.8, 2.7, z + 1.2], [.4, .18, .6], '#b2b4a9', 0, this.sphere);
  }
  private home(group: THREE.Group): void {
    this.part(group, [-8, .7, -5], [7, 1.3, 10], '#594b3e');
    this.part(group, [-8, 1.45, -5], [6.8, .7, 9.7], '#d7d0bd');
    this.part(group, [-8, 1.9, -3.5], [6.9, .22, 6.7], '#7b8a91');
    this.part(group, [-8, 2.8, -9.8], [7.2, 3.2, .5], '#6c5b49');
    for (const x of [-9.6, -6.4]) this.part(group, [x, 1.95, -8.5], [2.5, .38, 1.9], '#e9e2d2', 0, this.sphere);
    this.table(group, 7, -7, 7, 3.8); this.computer(group, 7, -7.4); this.chair(group, 7, -3.5);
    this.part(group, [11.8, 3.2, -7.5], [2.5, 6.4, 5], '#655e4b');
    for (let i = 0; i < 16; i++) this.part(group, [10.5, 1 + Math.floor(i / 4) * 1.4, -9.3 + i % 4 * .9], [.16, .85, .65], ['#a99d7c', '#506b72', '#7d4e41'][i % 3]);
    this.part(group, [-8, 1.5, 8], [8, 3, 3], '#c5baa0');
    this.part(group, [-8, 3.1, 8], [8.2, .2, 3.2], '#dcd6c9');
    this.part(group, [-10, 3.25, 8], [3, .15, 2.5], '#454d4b');
    for (const x of [-10.7, -9.3]) this.part(group, [x, 3.38, 8], [.5, .05, .5], '#7d827b', 0, this.cylinder);
    this.table(group, 6, 6, 5, 3); this.chair(group, 6, 9, Math.PI);
    this.part(group, [6, 2.72, 6], [.45, .48, .45], '#e8e0c8', 0, this.cylinder);
    this.part(group, [1, .13, 1], [8, .05, 7], '#b29c77');
    this.label(group, 'HAVE A GOOD DAY.', [-5, 5.6, -11.6], 5, '#d6cbbb', '#5f706e');
  }
  private office(group: THREE.Group): void {
    for (const x of [-8, 8]) for (const z of [-6, 3]) {
      this.table(group, x, z, 8, 4, '#c9c8b5'); this.computer(group, x, z - .7); this.chair(group, x, z + 3.4);
      this.part(group, [x, 2.3, z - 2.1], [8.4, 4.6, .3], '#8d9c9c');
      this.part(group, [x + 3.5, 2.7, z], [1, .2, 1.5], '#f0ead7');
    }
    this.label(group, 'MON  /  09:00  /  TEAM MEETING', [5, 6, -12.6], 8, '#455a5f', '#e0e2d6');
  }
  private cafe(group: THREE.Group, bar: boolean): void {
    this.part(group, [0, 1.8, -8], [22, 3.6, 3], bar ? '#60482d' : '#b09c72');
    this.part(group, [0, 3.7, -8], [22.5, .22, 3.5], '#514b42');
    this.label(group, bar ? 'LIVE TONIGHT  /  19:00' : 'ESPRESSO   SOUP   SANDWICHES', [0, 6.5, -11.55], 12, '#ede5d0', '#354c45');
    for (let i = -4; i <= 4; i++) this.part(group, [i * 2, 4.15, -8], [.35, .8, .35], bar ? ['#75613b', '#354c36', '#8a5a3d'][(i + 4) % 3] : '#ddd3bc', 0, this.cylinder);
    for (const x of [-8, 8]) for (const z of [0, 7]) {
      this.table(group, x, z, 4, 3); this.chair(group, x, z - 2.5); this.chair(group, x, z + 2.5, Math.PI);
      this.part(group, [x, 2.75, z], [.32, .55, .32], '#eae3d0', 0, this.cylinder);
    }
  }
  private oracle(group: THREE.Group): void {
    this.part(group, [0, 1.7, -9.5], [23, 3.4, 4], '#aaa97f');
    this.part(group, [0, 3.5, -9.5], [23.3, .2, 4.2], '#e0d8bb');
    this.part(group, [-7, 2, -9.3], [4, 3.4, 4.2], '#e2dccc');
    this.part(group, [-7, 2, -7.1], [3.2, 2, .1], '#4a5750');
    this.part(group, [7, 4, -10.4], [4, 8, 2.2], '#d9d7be');
    this.table(group, -6, 1, 6, 4); this.chair(group, -6, 4, Math.PI);
    for (let i = 0; i < 7; i++) this.part(group, [-7.6 + i % 4, 2.68, .4 + Math.floor(i / 4)], [.35, .1, .35], '#ad8254', 0, this.cylinder);
    this.part(group, [8, 1.2, 2], [5, 2.4, 7], '#817953');
    this.part(group, [10, 2.6, 2], [1, 2.8, 7], '#817953');
  }
  private plant(group: THREE.Group, x: number, z: number): void {
    this.part(group, [x, .7, z], [.8, 1.4, .8], '#90775f', 0, this.cylinder);
    for (let i = 0; i < 7; i++) {
      const leaf = this.part(group, [x + Math.sin(i * 2.4) * .65, 2 + i * .25, z + Math.cos(i * 2.4) * .65], [.3, 1.6, .1], i % 2 ? '#566d41' : '#75815a', 0, this.sphere);
      leaf.rotation.set(.4, i * 2.4, .5);
    }
  }
  update(time: number, player: Vector3 | undefined, life?: NeoLifeState): void {
    const room = player ? insideLifeRoom(player) : undefined;
    for (const entry of this.lights) entry.light.visible = entry.location === room;
    for (const hand of this.clocks) hand.rotation.z = -time / 1000 * Math.PI * 2 + (life?.anomaly?.id === 'clock' ? Math.sin(time * 3) * .2 : 0);
    for (const screen of this.screens) screen.emissiveIntensity = life?.anomaly?.id === 'screen' ? .3 + Math.sin(time) * .3 : .25;
    this.cats.visible = life?.anomaly?.id === 'cat';
    if (life?.anomaly) this.cats.position.set(life.anomaly.position.x - 2, 0, life.anomaly.position.z - 4);
  }
  dispose(): void { this.textures.forEach(texture => texture.dispose()); }
}
