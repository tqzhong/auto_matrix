import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONSOLE_OPERATOR, CONSOLE_SERVICE, INTERLUDE_ROOTS, consoleOperatorPose, interludeAge, type InterludeEncounter } from '@auto_matrix/shared';

/** Independent CRT bank; the later Link relay retains its existing terminal. */
export class CypherConsoleRenderer {
  readonly root = new THREE.Group();
  private bank = new THREE.Group();
  private chair = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private texture?: THREE.CanvasTexture;
  private frame = '';

  constructor(parent: THREE.Group) {
    this.root.name = 'neb-cypher-operator-station'; parent.add(this.root);
    this.bank.name = 'neb-cypher-crt-bank'; this.root.add(this.bank);
    const metal = this.material(new THREE.MeshStandardMaterial({ color: 0x3a4140, metalness: .65, roughness: .58 }));
    const dark = this.material(new THREE.MeshStandardMaterial({ color: 0x171c1d, metalness: .35, roughness: .7 }));
    const plastic = this.material(new THREE.MeshStandardMaterial({ color: 0x434a47, roughness: .78 }));
    const keys = this.material(new THREE.MeshStandardMaterial({ color: 0x707971, roughness: .86 }));
    const d = CONSOLE_OPERATOR.desk, k = CONSOLE_OPERATOR.keyboard;
    this.box(this.root, metal, d.x, d.height - .12, d.z, d.width, .24, d.depth, 'neb-cypher-console-desk');
    for (const z of [d.z - 1.9, d.z + 1.9]) {
      this.box(this.root, dark, d.x + .2, .81, z, 1.8, 1.62, .16);
      this.box(this.root, metal, d.x + .2, .1, z, 2.1, .2, .55);
    }
    this.chair.name = 'neb-cypher-operator-chair'; this.chair.position.set(INTERLUDE_ROOTS.console.cypher.x, 0, INTERLUDE_ROOTS.console.cypher.z);
    this.chair.visible = false; this.root.add(this.chair);
    const cushion = this.box(this.chair, dark, 0, 1.25, -.25, 1.8, .3, 1.75); cushion.rotation.x = .15;
    const back = new THREE.Mesh(this.geometry(new RoundedBoxGeometry(1.6, 1.15, .18, 3, .08)), dark);
    back.position.set(0, 1.94, -1.05); back.rotation.x = .15; back.castShadow = true; this.chair.add(back);
    const pedestal = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.09, .13, .9, 16)), metal);
    pedestal.position.set(0, .65, -.23); this.chair.add(pedestal);
    for (let leg = 0; leg < 5; leg++) {
      const angle = leg * Math.PI * .4, foot = this.box(this.chair, metal, Math.sin(angle) * .42, .16, -.23 + Math.cos(angle) * .42, .09, .1, 1);
      foot.rotation.y = angle;
      const wheel = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.1, .1, .14, 12)), dark);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(Math.sin(angle) * .86, .1, -.23 + Math.cos(angle) * .86); this.chair.add(wheel);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(this.geometry(new RoundedBoxGeometry(.2, .12, .9, 2, .045)), dark);
      arm.position.set(side * .94, 2.12, .02); this.chair.add(arm);
      for (const z of [-.3, .32]) this.box(this.chair, metal, side * .94, 1.65, z, .06, .86, .06);
    }
    const cup = CONSOLE_SERVICE.cup;
    this.box(this.chair, metal, cup.x, 2.09, (cup.z + .02) / 2, .16, .08, Math.abs(cup.z - .02) + .2);
    const tray = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.23, .23, .02, 32)), metal);
    tray.name = 'neb-cypher-cup-tray'; tray.position.set(cup.x, cup.y - .25, cup.z); this.chair.add(tray);
    this.box(this.chair, metal, 0, .16, 1.45, 1.75, .1, 1, 'neb-cypher-operator-chair-footrest');
    for (const side of [-1, 1]) {
      const start = new THREE.Vector3(side * .45, .65, .05), end = new THREE.Vector3(side * .45, .16, 1.45), direction = end.clone().sub(start);
      const strut = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.025, .025, direction.length(), 8)), metal);
      strut.position.copy(start).add(end).multiplyScalar(.5); strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); this.chair.add(strut);
    }
    this.box(this.bank, plastic, k.x, k.y - .055, k.z, k.width, .11, k.depth, 'neb-cypher-operator-keyboard');
    const keycaps = new THREE.InstancedMesh(this.geometry(new THREE.BoxGeometry(.12, .028, .096)), keys, 51);
    keycaps.name = 'neb-cypher-keycaps'; keycaps.castShadow = true;
    for (let row = 0; row < 3; row++) for (let column = 0; column < 17; column++)
      keycaps.setMatrixAt(row * 17 + column, new THREE.Matrix4().makeTranslation(k.x + (row - 1) * .16, k.y + .014, k.z + (column - 8) * .135));
    this.bank.add(keycaps);
    this.box(this.bank, keys, k.x - .28, k.y + .014, k.z, .08, .028, .8);
    const phosphor = this.material(new THREE.MeshBasicMaterial({ color: 0xc7e6ca, toneMapped: false }));
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 720;
      this.texture = new THREE.CanvasTexture(canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.wrapS = THREE.RepeatWrapping;
      phosphor.map = this.texture;
    }
    for (const [side, z] of [['left', 4.8], ['right', 7.2]] as const) {
      const crt = new THREE.Group(); crt.name = `neb-cypher-crt-${side}`; crt.position.set(9.55, d.height + 1.53 * .72, z);
      crt.rotation.y = -Math.PI / 2; crt.scale.setScalar(.72);
      this.bank.add(crt);
      const casing = new THREE.Mesh(this.geometry(new RoundedBoxGeometry(2.27, 2.12, 1.6, 3, .12)), dark);
      casing.castShadow = casing.receiveShadow = true; crt.add(casing);
      this.box(crt, metal, 0, -1.25, -.12, .28, .42, .28);
      this.box(crt, metal, 0, -1.47, -.12, 1.36, .12, 1.2);
      for (const x of [-1.035, 1.035]) this.box(crt, plastic, x, .075, .83, .2, 1.78, .18);
      this.box(crt, plastic, 0, .97, .83, 2.05, .16, .18);
      this.box(crt, plastic, 0, -.87, .83, 2.05, .3, .18);
      const glass = this.geometry(new THREE.PlaneGeometry(1.87, 1.58, 20, 16));
      const vertices = glass.attributes.position;
      for (let i = 0; i < vertices.count; i++) vertices.setZ(i, .045 * (1 - (vertices.getX(i) / .935) ** 2) * (1 - (vertices.getY(i) / .79) ** 2));
      if (side === 'right') for (let i = 0; i < glass.attributes.uv.count; i++) glass.attributes.uv.setX(i, glass.attributes.uv.getX(i) + .31);
      glass.computeVertexNormals();
      const screen = new THREE.Mesh(glass, phosphor); screen.name = `neb-cypher-crt-${side}-glass`; screen.position.set(0, .1, .925); crt.add(screen);
      for (let i = 0; i < 2; i++) {
        const dial = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.075, .075, .07, 16)), plastic);
        dial.rotation.x = Math.PI / 2; dial.position.set(-.34 + i * .32, -.86, .965); crt.add(dial);
      }
      const led = this.material(new THREE.MeshBasicMaterial({ color: 0x88c5a0, toneMapped: false }));
      this.box(crt, led, .78, -.86, .966, .035, .025, .025);
      const vents = new THREE.InstancedMesh(this.geometry(new THREE.BoxGeometry(.8, .024, .018)), dark, 10);
      for (let i = 0; i < 10; i++) vents.setMatrixAt(i, new THREE.Matrix4().makeTranslation(.5, -.2 + i * .055, -.81));
      crt.add(vents);
    }
  }

  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name?: string): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(w, h, d)), material); mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; if (name) mesh.name = name; parent.add(mesh); return mesh;
  }

  update(encounter?: InterludeEncounter, relay = false): void {
    this.chair.visible = Boolean(encounter);
    if (encounter) this.chair.rotation.y = consoleOperatorPose(encounter).yaw;
    this.bank.visible = !relay; if (relay || !this.texture) return;
    const age = encounter ? interludeAge(encounter) : 0, frame = Math.floor(age * 8), privateBuffer = encounter?.phase === 'ready';
    const key = `${frame}:${privateBuffer}`; if (key === this.frame) return; this.frame = key;
    const ctx = (this.texture.image as HTMLCanvasElement).getContext('2d')!;
    ctx.fillStyle = '#02090a'; ctx.fillRect(0, 0, 960, 720); ctx.font = '20px monospace';
    const symbols = '012345789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽ';
    for (let column = 0; column < 42; column++) for (let row = 0; row < 33; row++) {
      const head = (column * 13 + Math.floor(frame * (1 + column % 3) / 3)) % 45;
      const distance = (head - row + 45) % 45; if (distance > 19) continue;
      ctx.fillStyle = distance < 2 ? '#b5e5c2' : distance < 8 ? '#479c73' : '#184b38';
      const index = (column * 97 + row * 37 + Math.floor(frame / 5)) % symbols.length;
      ctx.fillText(symbols[index], 24 + column * 22, 30 + row * 21);
    }
    if (privateBuffer) {
      ctx.fillStyle = '#061311'; ctx.fillRect(170, 260, 618, 182); ctx.fillStyle = '#599379'; ctx.font = '17px monospace';
      for (let row = 0; row < 6; row++) ctx.fillText(`> ${(0x3a109c + row * 197).toString(16)}  [ ${row % 2 ? '10 01 00 11' : '01 11 10 00'} ]`, 192, 288 + row * 25);
    }
    ctx.fillStyle = '#06100e'; for (let y = 0; y < 720; y += 4) ctx.fillRect(0, y, 960, 1);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture?.dispose(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.root.removeFromParent();
  }
}
