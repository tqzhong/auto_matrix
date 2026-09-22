import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONSTRUCT_REVEAL, type FilmJourney } from '@auto_matrix/shared';

/** Horizonless loading program used for the first truth lesson and the later
 * armoury. Props remain sparse so their physical scale is unmistakable. */
export class ConstructRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights = new Set<THREE.Light>();
  private canvas = document.createElement('canvas');
  private screenTexture: THREE.CanvasTexture;
  private screenLight: THREE.PointLight;
  private lastFrame = -1;
  private white = this.material(new THREE.MeshStandardMaterial({ color: 0xe4e5df, roughness: .96 }));
  private leather = this.material(new THREE.MeshStandardMaterial({ color: 0x5a1715, roughness: .42, metalness: .03 }));
  private darkLeather = this.material(new THREE.MeshStandardMaterial({ color: 0x2d0b0a, roughness: .56 }));
  private black = this.material(new THREE.MeshStandardMaterial({ color: 0x111313, roughness: .36, metalness: .4 }));
  private steel = this.material(new THREE.MeshStandardMaterial({ color: 0x575d5b, roughness: .28, metalness: .86 }));

  constructor(private root: THREE.Group, private sceneId?: string) {
    this.canvas.width = 768; this.canvas.height = 512;
    this.screenTexture = new THREE.CanvasTexture(this.canvas); this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.minFilter = THREE.LinearFilter; this.textures.add(this.screenTexture);
    this.floor();
    if (sceneId === 'm1_guns') this.armoury();
    else this.lesson();
    this.screenLight = new THREE.PointLight(0xdceee3, 85, 20, 2); this.screenLight.name = 'construct-screen-light';
    this.screenLight.position.set(0, 4.2, -12.5); this.root.add(this.screenLight); this.lights.add(this.screenLight);
    const fill = new THREE.HemisphereLight(0xffffff, 0xd4d5cf, 1.45); fill.name = 'construct-shadowless-fill'; this.root.add(fill); this.lights.add(fill);
    this.draw(0, true);
  }

  private material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry), material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, radius = 0, name?: string): THREE.Mesh {
    const geometry = radius ? new RoundedBoxGeometry(width, height, depth, 4, Math.min(radius, width / 3, height / 3, depth / 3)) : new THREE.BoxGeometry(width, height, depth);
    const mesh = this.mesh(parent, geometry, material, name); mesh.position.set(x, y, z); return mesh;
  }
  private cylinder(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 18), material); mesh.position.set(x, y, z); return mesh;
  }
  private tube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material = this.steel): THREE.Mesh {
    return this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, radius, 8), material);
  }

  private floor(): void {
    const floor = this.mesh(this.root, new THREE.PlaneGeometry(600, 600), this.white, 'construct-infinite-floor');
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; floor.receiveShadow = true;
  }

  private chair(x: number, name: string): void {
    const chair = new THREE.Group(); chair.name = name; chair.position.set(x, 0, CONSTRUCT_REVEAL.neo.z + .15); this.root.add(chair);
    this.box(chair, this.darkLeather, 0, .72, .25, 3.6, 1.3, 3.45, .28);
    this.box(chair, this.leather, 0, 1.25, -.05, 2.75, .55, 2.65, .24);
    const back = this.box(chair, this.leather, 0, 2.75, 1.27, 3.1, 3.25, .62, .24); back.rotation.x = -.08;
    for (const side of [-1, 1]) {
      this.box(chair, this.leather, side * 1.62, 1.55, .05, .52, 1.45, 3.15, .23);
      this.cylinder(chair, this.darkLeather, side * 1.35, .25, 1.15, .18, .5);
    }
    for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) {
      const button = this.mesh(chair, new THREE.SphereGeometry(.075, 10, 8), this.darkLeather);
      button.position.set(-1.08 + column * .72, 1.95 + row * .65, .94); button.scale.z = .35;
    }
  }

  private television(): void {
    const tv = new THREE.Group(); tv.name = 'construct-television'; tv.position.set(CONSTRUCT_REVEAL.television.x, 0, CONSTRUCT_REVEAL.television.z); this.root.add(tv);
    this.box(tv, this.black, 0, 3.2, 0, 6.5, 4.7, 2.3, .38);
    this.box(tv, this.steel, 0, 3.2, 1.17, 5.35, 3.55, .12, .08);
    const screenMaterial = this.material(new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false }));
    const screen = this.mesh(tv, new THREE.PlaneGeometry(4.92, 3.12), screenMaterial, 'construct-television-screen'); screen.position.set(-.35, 3.25, 1.245);
    for (const y of [2.8, 3.25, 3.7]) this.cylinder(tv, this.steel, 2.65, y, 1.24, .18, .08).rotation.x = Math.PI / 2;
    for (const x of [-2.35, 2.35]) this.tube(tv, [new THREE.Vector3(x, 1, -.45), new THREE.Vector3(x * 1.1, .18, -.2)], .075);
    this.box(tv, this.steel, 0, .2, -.2, 6.2, .18, 2.3, .06);
    const aerial = this.tube(tv, [new THREE.Vector3(-.5, 5.6, 0), new THREE.Vector3(-1.6, 7.2, -.2)], .025, this.black); aerial.name = 'construct-tv-aerial';
    this.tube(tv, [new THREE.Vector3(.5, 5.6, 0), new THREE.Vector3(1.7, 7, -.2)], .025, this.black);
  }

  private lesson(): void {
    this.chair(CONSTRUCT_REVEAL.morpheus.x, 'construct-chair-morpheus');
    this.chair(CONSTRUCT_REVEAL.neo.x, 'construct-chair-neo');
    this.television();
    const table = new THREE.Group(); table.name = 'construct-side-table'; table.position.set(0, 0, -7.2); this.root.add(table);
    this.cylinder(table, this.black, 0, 1.3, 0, 1.35, .16); this.cylinder(table, this.steel, 0, .65, 0, .16, 1.3);
    const remote = this.box(table, this.black, .15, 1.47, 0, .42, .12, .92, .05, 'construct-remote'); remote.rotation.y = -.18;
    for (let i = 0; i < 3; i++) {
      const button = this.mesh(remote, new THREE.SphereGeometry(.035, 8, 6), this.steel);
      button.position.set(0, .07, -.23 + i * .19); button.scale.y = .35;
    }
  }

  private weapon(parent: THREE.Object3D, x: number, y: number, z: number, long = false): void {
    this.box(parent, this.black, x, y, z, .28, .34, long ? 3.9 : 2.35, .08);
    this.box(parent, this.black, x, y - .42, z + (long ? .65 : .35), .52, .9, .35, .08);
    this.cylinder(parent, this.steel, x, y, z - (long ? 2.1 : 1.35), .07, long ? 1.2 : .65).rotation.x = Math.PI / 2;
  }

  private armoury(): void {
    const racks = new THREE.Group(); racks.name = 'construct-weapon-racks'; this.root.add(racks);
    for (const side of [-1, 1]) for (const z of [-24, -8, 8, 24]) {
      const rack = new THREE.Group(); rack.position.set(side * 19, 0, z); rack.rotation.y = side * Math.PI / 2; racks.add(rack);
      this.box(rack, this.steel, 0, 3.4, 0, 8.5, 6.8, .48, .12);
      for (let i = 0; i < 7; i++) this.weapon(rack, -3.1 + i * 1.05, 4.2 - i % 2 * 2.2, .5, i % 3 === 0);
    }
    this.box(this.root, this.black, 0, .04, -31, 16, .08, .22);
  }

  private draw(elapsed: number, waiting: boolean): void {
    const ctx = this.canvas.getContext('2d')!; const width = this.canvas.width; const height = this.canvas.height;
    ctx.fillStyle = waiting ? '#080b0a' : elapsed > 9.2 ? '#e9ece6' : '#10201d'; ctx.fillRect(0, 0, width, height);
    if (waiting) {
      ctx.fillStyle = '#c9d6cf'; ctx.beginPath(); ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2); ctx.fill();
    } else if (elapsed < 2.4) {
      for (let y = 0; y < height; y += 5) {
        const shade = 55 + Math.floor((Math.sin(y * 3.7 + elapsed * 23) + 1) * 38);
        ctx.fillStyle = `rgb(${shade},${shade + 8},${shade + 4})`; ctx.fillRect(0, y, width, 3);
      }
    } else if (elapsed < 6.8) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height); gradient.addColorStop(0, '#8da39c'); gradient.addColorStop(.58, '#304b43'); gradient.addColorStop(1, '#111a18');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 18; i++) {
        const buildingWidth = 28 + i % 5 * 11; const buildingHeight = 90 + (i * 67) % 260; const x = i * 47 - 35;
        ctx.fillStyle = i % 3 ? '#182a26' : '#223933'; ctx.fillRect(x, height - 75 - buildingHeight, buildingWidth, buildingHeight);
        ctx.fillStyle = '#9eb6a5'; for (let y = height - 100; y > height - buildingHeight - 60; y -= 25) for (let wx = x + 7; wx < x + buildingWidth - 4; wx += 13) ctx.fillRect(wx, y, 5, 8);
      }
      ctx.fillStyle = '#b8c7bd'; ctx.font = '26px monospace'; ctx.fillText('CITY SIMULATION / 1999', 34, 48);
    } else if (elapsed < 9.2) {
      ctx.fillStyle = '#05100b'; ctx.fillRect(0, 0, width, height); ctx.font = '22px monospace';
      for (let column = 0; column < 31; column++) {
        ctx.fillStyle = column % 5 ? '#3fb66c' : '#c0ffd1';
        for (let row = 0; row < 18; row++) ctx.fillText(String.fromCharCode(0x30a0 + (column * 17 + row * 29) % 80), column * 25, (row * 34 + elapsed * (35 + column % 4 * 9)) % 570 - 25);
      }
      ctx.strokeStyle = '#d0ddd4'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(width * .7, height * .52, 95, 180, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff22'; for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    this.screenTexture.needsUpdate = true;
    this.screenLight.intensity = waiting ? 18 : elapsed > 9.2 ? 150 : 75 + Math.sin(elapsed * 9) * 10;
  }

  update(journey: FilmJourney | undefined): void {
    const beat = journey?.scene === 'm1_construct' && !journey.visiting && journey.awakening?.kind === 'construct' ? journey.awakening : undefined;
    const frame = beat ? Math.floor(beat.elapsed * 8) : -1;
    if (frame === this.lastFrame) return; this.lastFrame = frame;
    this.draw(beat?.elapsed ?? (this.sceneId === 'm1_guns' ? 9.3 : 4), beat?.started === false);
  }

  dispose(): void {
    this.root.clear(); this.geometries.forEach(value => value.dispose()); this.materials.forEach(value => value.dispose());
    this.textures.forEach(value => value.dispose()); this.lights.forEach(value => value.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.lights.clear();
  }
}
