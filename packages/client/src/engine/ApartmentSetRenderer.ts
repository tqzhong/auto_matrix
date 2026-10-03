import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { APARTMENT, APARTMENT_BOOK, APARTMENT_CHAIR, APARTMENT_NETWORK, APARTMENT_ROOM, MORNING, apartmentAfter, apartmentDoor, computerNetworkPull, wakeCallDoor, wakeCallHandsetHeld, type ComputerInvestigation, type FilmJourney, type NeoLifeState } from '@auto_matrix/shared';
import { apartmentDisc } from '../agents/ApartmentDisc.js';

/** Anderson's workroom and the shared landing. Props use the shared interaction layout. */
export class ApartmentSetRenderer {
  private root = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private door = new THREE.Group();
  private cover = new THREE.Group();
  private book = new THREE.Group();
  private disk = apartmentDisc();
  private phoneBase = new THREE.Group();
  private phoneHandset = new THREE.Group();
  private phoneCord: THREE.Line;
  private canvas = document.createElement('canvas');
  private screen: THREE.CanvasTexture;
  private screenKey = '';
  private networkPlug = new THREE.Group();
  private networkLed = new THREE.MeshBasicMaterial({ color: 0x94bb77, toneMapped: false });
  private networkCord: THREE.Line;
  private clockCanvas = document.createElement('canvas');
  private clockScreen: THREE.CanvasTexture;
  private clockKey = '';
  private clockButton: THREE.Mesh;
  private glow = new THREE.PointLight(0x8bba81, 14, 10, 2);
  private windowGlass: THREE.MeshStandardMaterial;
  private windowLights: THREE.PointLight[] = [];
  private roomLights: THREE.Light[] = [];
  constructor(parent: THREE.Group) {
    this.root.name = 'anderson-shared-apartment'; parent.add(this.root);
    const wood = this.mat(0x82765b, .88, 0, 'old_wood_floor');
    const plaster = this.mat(0x8a8b73, .94, 0, 'white_plaster_02');
    const dark = this.mat(0x131919, .65); const metal = this.mat(0x696e5e, .39, .64);
    const trim = this.mat(0x3a4137, .8); const paper = this.mat(0xbdb699, .96);
    const plastic = this.mat(0x747767, .68); const walnut = this.mat(0x443c2e, .8);
    this.box(wood, 0, -.17, 0, 34, .3, 40);
    this.box(plaster, 0, 4.4, -20, 34, 8.8, .32);
    for (const x of [-17, 17]) {
      this.box(plaster, x, 4.4, 0, .3, 8.8, 40);
      this.box(trim, x - Math.sign(x) * .18, .2, 0, .18, .4, 40);
      this.box(trim, x - Math.sign(x) * .18, 8.1, 0, .16, .3, 40);
    }
    const frontWidth = (APARTMENT_ROOM.width - APARTMENT_ROOM.exitWidth) / 2;
    for (const side of [-1, 1]) this.box(plaster, side * (APARTMENT_ROOM.exitWidth + frontWidth) / 2, 4.4, 20, frontWidth, 8.8, .3);
    this.box(plaster, 0, 7.95, 20, APARTMENT_ROOM.exitWidth, 1.7, .3);
    for (const side of [-1, 1]) this.box(trim, side * 5, 3.55, 20, .18, 7.1, .4);
    const exit = this.label('STREET', 2, .5, '#c6cebd', '#35413b', 256); exit.rotation.y = Math.PI; exit.position.set(0, 7.6, 19.8); this.root.add(exit);
    this.box(this.mat(0x5f6354, .94), 0, 8.8, 0, 34, .25, 40);
    for (const x of [-9.5, 9.5]) this.box(plaster, x, 4.4, APARTMENT.doorZ, 15, 8.8, .4);
    this.box(plaster, 0, 7.7, APARTMENT.doorZ, 4, 2.2, .4);
    for (const x of [-2, 2]) this.box(trim, x, 3.35, 12, .22, 6.7, .65);
    this.box(trim, 0, 6.67, 12, 4.25, .24, .65);
    this.door.name = 'apartment-101-door'; this.door.position.set(-1.9, 0, 12); this.door.userData.dynamic = true; this.root.add(this.door);
    this.mesh(new RoundedBoxGeometry(3.8, 6.45, .21, 2, .025), walnut, 1.9, 3.25, 0, this.door);
    for (const z of [-.12, .12]) for (const y of [1.7, 4.6]) this.mesh(new THREE.BoxGeometry(3.18, 2.35, .035), trim, 1.9, y, z, this.door);
    const plate = this.label('101', 1.1, .47, '#c8c4a5', '#2a3028', 256); plate.position.set(1.9, 5.67, .151); this.door.add(plate);
    for (const z of [-.26, .26]) this.mesh(new THREE.SphereGeometry(.1, 16, 12), metal, 3.3, 2.85, z, this.door);
    this.mesh(new THREE.CylinderGeometry(.044, .044, .42, 8), metal, 3.3, 2.85, 0, this.door).rotation.x = Math.PI / 2;
    for (const y of [.8, 3.2, 5.7]) this.mesh(new THREE.CylinderGeometry(.055, .055, .28, 10), metal, .02, y, .12, this.door);
    this.mesh(new THREE.CylinderGeometry(.025, .025, .26, 12), metal, 1.9, 4.43, 0, this.door).rotation.x = Math.PI / 2;
    for (const x of [-10.5, 10.5]) {
      this.box(trim, x, 3.2, 19.8, 3.8, 6.4, .16);
      this.box(walnut, x, 3.17, 19.68, 3.38, 6.08, .14);
      const number = this.label(x < 0 ? '102' : '103', .8, .4, '#ada68a', '#252c27', 128); number.rotation.y = Math.PI; number.position.set(x, 5.3, 19.56); this.root.add(number);
    }
    // Three tall windows, dirty glazing, venetian slats and old heating pipes.
    const glass = this.windowGlass = this.mat(0x223331, .28, .3);
    glass.emissive.setHex(0xabc8d4);
    for (const x of [-11, -1.4, 8.2]) {
      this.box(trim, x, 5.05, -19.65, 6.2, 5.6, .25);
      this.box(glass, x, 5.05, -19.46, 5.7, 5.1, .06);
      this.box(walnut, x, 5.05, -19.34, .12, 5.2, .12);
      for (let y = 2.6; y < 7.6; y += .27) this.box(plastic, x, y, -19.17, 5.8, .075, .26).rotation.x = -.28;
      this.box(walnut, x, 2.24, -19.05, 6.3, .22, .9);
      for (let fin = 0; fin < 14; fin++) this.box(metal, x - 2.3 + fin * .35, 1.04, -19.2, .16, 1.7, .4, .04);
      const daylight = new THREE.PointLight(0xd8e6ec, 0, 24, 2); daylight.name = 'apartment-window-daylight';
      daylight.position.set(x, 6, -17.7); this.root.add(daylight); this.windowLights.push(daylight);
    }
    this.tube([[-16.5, .6, -19], [-16.5, .6, 10], [-16.5, 7.9, 10], [16.5, 7.9, 10]], metal, .055);
    // Workbench: tower, bulky CRT, keyboard, floppy drive and stacks of jewel cases.
    this.box(walnut, -9, 2.25, -12, 8, .3, 3.4, .035);
    for (const x of [-12.6, -5.4]) for (const z of [-13.3, -10.7]) this.box(metal, x, 1.07, z, .11, 2.15, .11);
    this.box(plastic, -6, 1.05, -12, 1.3, 2.05, 2.5, .07);
    for (let y = .35; y < 1.65; y += .12) this.box(dark, -6, y, -10.73, .98, .025, .018);
    this.box(dark, -6, 1.82, -10.72, .94, .12, .04);
    this.box(plastic, -9, 2.57, -12.7, 1.1, .32, 1.1, .1);
    this.box(plastic, -9, 3.25, -12.7, 2.55, 1.68, 2, .17);
    this.box(dark, -9, 3.31, -11.65, 2.19, 1.42, .08, .09);
    this.canvas.width = 1024; this.canvas.height = 640;
    this.screen = new THREE.CanvasTexture(this.canvas); this.screen.colorSpace = THREE.SRGBColorSpace; this.textures.add(this.screen);
    const crt = new THREE.MeshBasicMaterial({ map: this.screen, toneMapped: false }); this.materials.add(crt);
    const monitor = this.mesh(new THREE.PlaneGeometry(2.055, 1.275, 32, 16), crt, APARTMENT_NETWORK.screen.x, APARTMENT_NETWORK.screen.y, APARTMENT_NETWORK.screen.z);
    const vertices = monitor.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) vertices.setZ(i, .045 * (1 - (vertices.getX(i) / 1.4) ** 2 - (vertices.getY(i) / .9) ** 2));
    monitor.geometry.computeVertexNormals();
    this.box(plastic, -9, 2.47, -10.75, 3.5, .16, .79, .055);
    for (let row = 0; row < 5; row++) for (let col = 0; col < 17; col++) this.box(paper, -10.5 + col * .18, 2.57, -11.03 + row * .135, .152, .062, .112, .018);
    this.box(dark, -7.2, 2.42, -10.77, .22, .07, .32, .045);
    this.tube([[-9, 2.4, -13], [-9, 1.1, -14], [-7, .1, -14.3], [-5.8, .12, -12.8]], dark, .035);
    this.tube([[-9.8, 2.5, -10.7], [-10, 2.46, -12], [-8.1, 2.41, -12.7]], dark, .018);
    const modem = new THREE.Group(); modem.name = 'apartment-network-modem'; modem.userData.dynamic = true; this.root.add(modem);
    this.mesh(new RoundedBoxGeometry(.8, .2, .44, 2, .04), plastic, -6.9, 2.52, -10.45, modem);
    this.mesh(new THREE.BoxGeometry(.22, .09, .018), dark, -6.9, 2.65, -10.21, modem);
    this.materials.add(this.networkLed);
    this.mesh(new THREE.BoxGeometry(.04, .04, .022), this.networkLed, -6.65, 2.56, -10.218, modem);
    this.networkPlug.name = 'apartment-network-plug'; this.networkPlug.userData.dynamic = true; this.root.add(this.networkPlug);
    this.mesh(new THREE.BoxGeometry(.16, .08, .2), metal, 0, 0, 0, this.networkPlug);
    this.mesh(new RoundedBoxGeometry(.18, .095, .12, 2, .015), dark, 0, 0, .14, this.networkPlug);
    const networkGeometry = new THREE.BufferGeometry(); networkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(25 * 3), 3)); this.geometries.add(networkGeometry);
    const networkMaterial = new THREE.LineBasicMaterial({ color: 0x161c18 }); this.materials.add(networkMaterial);
    this.networkCord = new THREE.Line(networkGeometry, networkMaterial); this.networkCord.name = 'apartment-network-cable'; this.networkCord.frustumCulled = false; this.root.add(this.networkCord);
    this.glow.position.set(-9, 3.8, -10.9); this.root.add(this.glow);
    for (let i = 0; i < 12; i++) {
      this.box(i % 3 ? plastic : dark, -12.25, 2.45 + i * .06, -12, 1.15, .048, 1.03);
      this.box(paper, -12.25, 2.44 + i * .06, -11.478, .96, .018, .015);
    }
    // Open components and loose wiring make the workbench feel lived in without narrowing the route to the phone.
    const circuit = this.mat(0x315649, .8, .15);
    this.box(metal, -7.1, 2.52, -11.65, 1.2, .08, .82);
    this.box(circuit, -7.1, 2.59, -11.65, 1.1, .045, .72);
    for (const [x, z, w, d] of [[-7.35, -11.79, .28, .22], [-7, -11.55, .37, .3], [-6.75, -11.87, .16, .15]] as const)
      this.box(dark, x, 2.65, z, w, .09, d);
    for (let i = 0; i < 6; i++) this.mesh(new THREE.CylinderGeometry(.035, .035, .13, 8), metal, -7.55 + i * .17, 2.66, -11.4);
    for (const shift of [0, .14, .3]) this.tube([[-7.5 + shift, 2.63, -11.9], [-7.7 + shift, 2.26, -12.3],
      [-8 + shift, 1.3, -12.9], [-8.4 + shift, .18, -13.4], [-8.55 + shift, .13, -12.9]], dark, .024);
    // The corded apartment telephone is the physical bridge between the two office outcomes and Adams Street.
    this.phoneBase.name = 'apartment-landline-base'; this.phoneBase.userData.dynamic = true;
    this.phoneBase.position.set(APARTMENT.phone.x, APARTMENT.phone.y, APARTMENT.phone.z); this.root.add(this.phoneBase);
    this.mesh(new RoundedBoxGeometry(1.7, .3, .78, 3, .12), dark, 0, 0, 0, this.phoneBase);
    this.mesh(new THREE.BoxGeometry(1.28, .08, .48), plastic, 0, .18, .05, this.phoneBase).rotation.x = -.16;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) this.mesh(new RoundedBoxGeometry(.18, .045, .12, 2, .018), paper,
      -.3 + col * .2, .25 + row * .002, .28 - row * .16, this.phoneBase).rotation.x = -.16;
    for (const x of [-.66, .66]) this.mesh(new RoundedBoxGeometry(.22, .16, .34, 2, .04), plastic, x, .3, -.24, this.phoneBase);
    this.phoneHandset.name = 'apartment-landline-handset'; this.phoneHandset.userData.dynamic = true;
    this.phoneHandset.position.set(APARTMENT.phone.x, APARTMENT.phone.y + .48, APARTMENT.phone.z + .22); this.root.add(this.phoneHandset);
    this.mesh(new RoundedBoxGeometry(.94, .17, .22, 3, .07), dark, 0, 0, 0, this.phoneHandset);
    for (const x of [-.56, .56]) this.mesh(new RoundedBoxGeometry(.34, .3, .38, 3, .1), dark, x, .01, 0, this.phoneHandset);
    const cordGeometry = new THREE.BufferGeometry(); cordGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(25 * 3), 3)); this.geometries.add(cordGeometry);
    const cordMaterial = new THREE.LineBasicMaterial({ color: 0x111716 }); this.materials.add(cordMaterial);
    this.phoneCord = new THREE.Line(cordGeometry, cordMaterial); this.phoneCord.name = 'apartment-landline-cord'; this.phoneCord.frustumCulled = false; this.root.add(this.phoneCord);
    this.mesh(new THREE.CylinderGeometry(.28, .28, .08, 16), metal, -6.8, 2.47, -12.75);
    this.tube([[-6.8, 2.5, -12.75], [-6.8, 3.75, -12.75], [-5.95, 4.13, -11.42]], metal, .045);
    const phoneShade = this.mesh(new THREE.ConeGeometry(.6, .5, 24, 1, true), dark, -5.95, 3.86, -11.42);
    phoneShade.name = 'apartment-phone-task-shade'; phoneShade.userData.dynamic = true;
    const phoneBulb = new THREE.MeshBasicMaterial({ color: 0xffe6b3, toneMapped: false }); this.materials.add(phoneBulb);
    this.mesh(new THREE.SphereGeometry(.15, 16, 12), phoneBulb, -5.95, 3.62, -11.42);
    const phoneLight = new THREE.PointLight(0xffd69c, 75, 9, 2);
    phoneLight.name = 'apartment-phone-task-light'; phoneLight.position.set(-5.95, 3.6, -11.42); this.root.add(phoneLight);
    const chair = this.mat(0x292f2b, .92);
    chair.name = 'apartment-computer-chair';
    this.box(chair, APARTMENT_CHAIR.x, APARTMENT_CHAIR.seatY, APARTMENT_CHAIR.z, APARTMENT_CHAIR.width, .3, APARTMENT_CHAIR.seatDepth, .14);
    this.box(chair, APARTMENT_CHAIR.x, APARTMENT_CHAIR.height - .75, APARTMENT_CHAIR.backZ, APARTMENT_CHAIR.width - .06, 1.5, .24, .13);
    this.box(metal, APARTMENT_CHAIR.x, (APARTMENT_CHAIR.seatY - .1) / 2, APARTMENT_CHAIR.z, .14, APARTMENT_CHAIR.seatY - .1, .14);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4; this.tube([[APARTMENT_CHAIR.x, .3, APARTMENT_CHAIR.z], [APARTMENT_CHAIR.x + Math.sin(a), .15, APARTMENT_CHAIR.z + Math.cos(a)]], metal, .045); }
    // Mattress and creased blanket; the book has an actual hollow cavity.
    const sheet = this.mat(0x777c69, .98); const blanket = this.mat(0x3c4a43, .99);
    this.box(walnut, 10.2, .45, -9, 6.2, .75, 10, .05);
    this.box(sheet, 10.2, 1.09, -9, 6.05, .59, 9.85, .2);
    const cloth = new THREE.PlaneGeometry(6.18, 7.2, 28, 34); cloth.rotateX(-Math.PI / 2);
    const folds = cloth.attributes.position;
    for (let i = 0; i < folds.count; i++) { const x = folds.getX(i); const z = folds.getZ(i); folds.setY(i, .055 * Math.sin(x * 6 + z * 1.7) + .035 * Math.sin(z * 9) - Math.max(0, Math.abs(x) - 2.65) * .95); }
    cloth.computeVertexNormals(); blanket.side = THREE.DoubleSide; this.mesh(cloth, blanket, 10.2, 1.44, -7.5);
    this.box(sheet, 10.2, 1.56, -12.3, 3.8, .36, 1.95, .18).rotation.y = -.13;
    // The clock sits on an actual cabinet within the reclining actor's reach.
    this.box(walnut, 6.35, .79, -10.75, 1.45, 1.58, 1.1, .05);
    this.box(trim, 6.35, 1.01, -10.17, 1.19, .53, .08, .025);
    this.box(metal, 6.35, 1.03, -10.09, .45, .045, .08, .018);
    const clock = new THREE.Group(); clock.name = 'apartment-alarm-clock'; clock.userData.dynamic = true;
    clock.position.set(MORNING.alarm.x, MORNING.alarm.y, MORNING.alarm.z); this.root.add(clock);
    this.mesh(new RoundedBoxGeometry(1.05, .46, .56, 3, .065), dark, 0, 0, 0, clock);
    this.clockButton = this.mesh(new RoundedBoxGeometry(.43, .06, .22, 2, .025), plastic, 0, .25, 0, clock);
    this.clockButton.name = 'apartment-alarm-button';
    this.clockCanvas.width = 256; this.clockCanvas.height = 96;
    this.clockScreen = new THREE.CanvasTexture(this.clockCanvas); this.clockScreen.colorSpace = THREE.SRGBColorSpace; this.textures.add(this.clockScreen);
    const clockMaterial = new THREE.MeshBasicMaterial({ map: this.clockScreen, toneMapped: false }); this.materials.add(clockMaterial);
    this.mesh(new THREE.PlaneGeometry(.88, .33), clockMaterial, 0, -.015, .285, clock);
    this.box(walnut, 6, 1.68, 6.2, 2.8, .22, 1.8, .035);
    for (const x of [4.85, 7.15]) for (const z of [5.45, 6.95]) this.box(metal, x, .78, z, .1, 1.55, .1);
    const book = this.mat(0x403b31, .96);
    this.book.name = 'apartment-hollow-book'; this.book.userData.dynamic = true; this.root.add(this.book);
    this.mesh(new THREE.BoxGeometry(1.65, .08, 2.05), book, 0, 0, 0, this.book);
    for (const x of [-.69, .69]) this.mesh(new THREE.BoxGeometry(.23, .31, 1.92), paper, x, .2, 0, this.book);
    for (const z of [-.85, .85]) this.mesh(new THREE.BoxGeometry(1.4, .31, .23), paper, 0, .2, z, this.book);
    this.cover.position.set(-.84, .39, 0); this.cover.userData.dynamic = true; this.book.add(this.cover);
    this.mesh(new THREE.BoxGeometry(1.65, .06, 2.05), book, .84, 0, 0, this.cover);
    const title = this.label('SIMULACRA\nAND SIMULATION', 1.42, 1.65, '#c0b799', '#403b31', 256); title.position.set(.84, .035, 0); title.rotation.x = -Math.PI / 2; this.cover.add(title);
    this.disk.name = 'apartment-book-disc'; this.disk.userData.dynamic = true; this.root.add(this.disk);
    this.disk.traverse(object => { if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material as THREE.Material); } });
    for (let shelf = 0; shelf < 5; shelf++) {
      this.box(walnut, -15.7, .3 + shelf * 1.2, -4, 1.6, .12, 8);
      for (let i = 0; i < 20; i++) this.box(i % 3 ? paper : trim, -15.5, .77 + shelf * 1.2, -7.55 + i * .36, .94, .8 + (i % 3) * .08, .21);
    }
    for (const z of [-7.9, -.1]) this.box(walnut, -15.7, 2.7, z, 1.6, 5.4, .12);
    // The daily breakfast uses a small kitchenette clear of the book and visitor route.
    this.box(trim, -10, 1.35, 6.8, 8, 2.7, 2.8, .06);
    this.box(paper, -10, 2.8, 6.8, 8.1, .18, 2.9, .04);
    for (const x of [-12.8, -10.9, -9, -7.1]) {
      this.box(walnut, x, 1.4, 5.35, 1.7, 2.2, .12, .04);
      this.box(metal, x, 2.15, 5.22, .7, .055, .1, .025);
    }
    this.box(metal, -12, 2.91, 6.8, 2.4, .04, 1.7, .12);
    this.box(dark, -12, 2.94, 6.8, 1.9, .04, 1.2, .12);
    this.tube([[-12, 2.92, 7.65], [-12, 3.8, 7.65], [-12, 3.8, 6.8], [-12, 3.55, 6.8]], metal, .06);
    for (const x of [-8.4, -7.1]) this.mesh(new THREE.CylinderGeometry(.43, .43, .04, 24), dark, x, 2.93, 6.8);
    this.mesh(new THREE.CylinderGeometry(.36, .36, .32, 24), metal, -8.4, 3.1, 6.8);
    this.box(dark, -9.04, 3.14, 6.8, .75, .1, .15, .04);
    this.mesh(new THREE.CylinderGeometry(.19, .16, .36, 24), paper, -10.2, 3.08, 6.1);
    // Warm household lamp against the cooler CRT and landing fluorescents.
    this.box(metal, 13, 3, 4, .08, 6, .08);
    this.mesh(new THREE.ConeGeometry(.9, 1.1, 32, 1, true), paper, 13, 6, 4);
    const lamp = new THREE.PointLight(0xffce8b, 80, 23, 2); lamp.position.set(13, 5.65, 4); this.root.add(lamp);
    const light = new THREE.SpotLight(0xc9d2a3, 180, 30, 1.05, .65, 2); light.position.set(0, 8.3, 16); light.target.position.set(0, 0, 11); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.normalBias = .035; this.root.add(light, light.target);
    const luminous = new THREE.MeshBasicMaterial({ color: 0xc2cba1, toneMapped: false }); this.materials.add(luminous);
    const hallBounce = new THREE.PointLight(0xd7d0a7, 82, 20, 2); hallBounce.position.set(0, 5.8, 15.5); this.root.add(hallBounce);
    const doorwayFill = new THREE.PointLight(0xc3c8aa, 105, 14, 2); doorwayFill.name = 'apartment-doorway-fill'; doorwayFill.position.set(2, 4.8, 8.4); this.root.add(doorwayFill);
    this.box(trim, 0, 8.55, 16, 3.4, .16, .7); this.box(luminous, 0, 8.42, 16, 3.1, .08, .32);
    this.root.traverse(object => { if (object instanceof THREE.Light) this.roomLights.push(object); });
    this.batch(); this.update();
  }
  private mat(color: number, roughness: number, metalness = 0, source?: string): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material);
    if (source) for (const [key, suffix] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']] as const) {
      const texture = new THREE.TextureLoader().load(`/assets/film-materials/${source}-${suffix}.jpg`); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 4); texture.anisotropy = 4;
      if (key === 'map') texture.colorSpace = THREE.SRGBColorSpace; material[key] = texture; this.textures.add(texture);
    }
    return material;
  }
  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent = this.root): THREE.Mesh {
    this.geometries.add(geo); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius = 0) {
    return this.mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }
  private tube(points: number[][], mat: THREE.Material, radius: number) {
    return this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), points.length * 12, radius, 8, false), mat, 0, 0, 0);
  }
  private label(text: string, w: number, h: number, color: string, background: string, size: number) {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = Math.round(size * h / w); const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${text.length > 8 ? size / 12 : size / 3}px Georgia`;
    text.split('\n').forEach((line, i, lines) => ctx.fillText(line, size / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * size / 8));
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const mat = new THREE.MeshStandardMaterial({ map, roughness: .8 }); this.materials.add(mat); return this.mesh(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0);
  }
  update(journey?: FilmJourney, time = 22000, nearby = true, contactSignal = false, life?: NeoLifeState, check: ComputerInvestigation | undefined = life?.computerCheck): void {
    const daylight = Math.max(0, Math.sin((time / 24000 - .25) * Math.PI * 2));
    this.windowGlass.emissiveIntensity = .025 + daylight * .55;
    for (const light of this.roomLights) light.visible = nearby;
    for (const light of this.windowLights) light.intensity = daylight * 100;
    const morning = journey?.scene === 'm1_morning' && !journey.visiting ? journey.morning : undefined;
    const alarm = morning?.phase === 'alarm' || morning?.phase === 'stopping' && morning.elapsed < .55;
    this.clockButton.position.y = morning?.phase === 'stopping' && morning.elapsed >= .5 && morning.elapsed < .8 ? .225 : .25;
    const minutes = Math.floor(time * .06); const clockText = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const blink = alarm && Math.floor((morning?.elapsed ?? 0) * 4) % 2 === 0;
    const clockKey = `${clockText}:${blink}`;
    if (clockKey !== this.clockKey) {
      this.clockKey = clockKey; const ctx = this.clockCanvas.getContext('2d')!;
      ctx.fillStyle = '#090b09'; ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = '#dc725b'; ctx.font = '62px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(clockText, 128, 45);
      if (blink) { ctx.font = '14px monospace'; ctx.fillText('ALARM', 128, 83); }
      this.clockScreen.needsUpdate = true;
    }
    const contact = journey?.scene === 'm1_wake_up' && !journey.visiting ? journey.contact : undefined;
    const call = journey?.scene === 'm1_wake_again' && !journey.visiting ? journey.wakeCall : undefined;
    this.door.rotation.y = (contact ? apartmentDoor(contact) : 1) * 1.42;
    if (journey?.scene === 'm1_wake_again') this.door.rotation.y = (journey.visiting || journey.step >= 2 ? 1 : wakeCallDoor(call)) * 1.42;
    else if (journey?.visiting) this.door.rotation.y = 1.42;
    const legacyBook = contact?.phase === 'retrieving' && contact.propMotion !== 'minidisc';
    this.book.position.set(6, legacyBook ? 1.85 : APARTMENT_BOOK.y, legacyBook ? 6.2 : APARTMENT_BOOK.z);
    this.book.scale.setScalar(legacyBook ? 1 : APARTMENT_BOOK.scale);
    this.disk.position.set(6, legacyBook ? 1.94 : APARTMENT_BOOK.y + .09 * APARTMENT_BOOK.scale, legacyBook ? 6.2 : APARTMENT_BOOK.z);
    const opening = contact?.phase === 'retrieving' ? THREE.MathUtils.smoothstep(contact.elapsed, legacyBook ? .3 : .35, legacyBook ? 1.65 : 1.35) : contact && apartmentAfter(contact, 'disk') ? 1 : 0;
    this.cover.rotation.z = opening * 2.88;
    this.disk.visible = !(contact && (apartmentAfter(contact, 'disk') || contact.phase === 'retrieving' && contact.elapsed >= (legacyBook ? 2.3 : APARTMENT_BOOK.pickup)));
    const held = wakeCallHandsetHeld(call); this.phoneHandset.visible = !held;
    this.phoneHandset.position.set(APARTMENT.phone.x, APARTMENT.phone.y + .48, APARTMENT.phone.z + .22);
    this.phoneHandset.rotation.set(0, 0, call?.phase === 'ringing' ? Math.sin(call.elapsed * 52) * .045 : 0);
    if (call?.phase === 'ringing') this.phoneHandset.position.y += Math.abs(Math.sin(call.elapsed * 26)) * .025;
    const cord = this.phoneCord.geometry.attributes.position as THREE.BufferAttribute;
    const start = new THREE.Vector3(APARTMENT.phone.x + .72, APARTMENT.phone.y + .08, APARTMENT.phone.z + .05);
    const end = held ? new THREE.Vector3(APARTMENT.phone.approachX - .28, 3.62, APARTMENT.phone.approachZ - .08)
      : new THREE.Vector3(APARTMENT.phone.x + .55, APARTMENT.phone.y + .47, APARTMENT.phone.z + .18);
    for (let i = 0; i < cord.count; i++) {
      const t = i / (cord.count - 1); const sag = Math.sin(t * Math.PI) * (held ? -.55 : -.18);
      cord.setXYZ(i, THREE.MathUtils.lerp(start.x, end.x, t) + Math.sin(t * Math.PI * 12) * (held ? .06 : .025),
        THREE.MathUtils.lerp(start.y, end.y, t) + sag, THREE.MathUtils.lerp(start.z, end.z, t));
    }
    cord.needsUpdate = true;
    const pull = computerNetworkPull(check);
    this.networkPlug.position.set(APARTMENT_NETWORK.plug.x, APARTMENT_NETWORK.plug.y - .16 * pull, APARTMENT_NETWORK.plug.z + .31 * pull);
    this.networkLed.color.setHex(pull >= .9 ? 0x293329 : 0x94bb77);
    const networkCord = this.networkCord.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < networkCord.count; i++) {
      const t = i / (networkCord.count - 1), plug = this.networkPlug.position;
      networkCord.setXYZ(i, THREE.MathUtils.lerp(plug.x, -6, t), THREE.MathUtils.lerp(plug.y, 1.82, t) - Math.sin(t * Math.PI) * .5, THREE.MathUtils.lerp(plug.z + .2, -10.72, t));
    }
    networkCord.needsUpdate = true;
    let text = contact || contactSignal ? 'SEARCH: MORPHEUS\n\nconnection waiting_' : 'THOMAS ANDERSON\n\nMAIL / WORK / CONTACTS\n2 unread messages_';
    if (!contact && !contactSignal && !journey) {
      if (life?.anomaly?.id === 'screen' && life.anomaly.location === 'neo_apartment') text = 'MAIL / WORK / CONTACTS\n\nUNREGISTERED WINDOW\nNo sender. No process._';
      if (check?.phase === 'reading') text = 'ACTIVE TASKS / 03\nMAIL   WORK   SYSTEM\n\nUNREGISTERED WINDOW\nSender: --  Process: --';
      else if (check?.phase === 'offline' || check?.phase === 'evidence') {
        const echo = check.phase === 'evidence' ? 'STILL HERE.' : 'STILL HERE.'.slice(0, Math.max(0, Math.floor((check.elapsed - 1.6) * 8)));
        text = `NETWORK: DISCONNECTED\n\n${echo ? 'unregistered> ' + echo : 'No matching task_'}${check.phase === 'evidence' ? '\nLOCAL LOG / 101\ntask: -- / sender: --' : ''}`;
      } else if (check?.phase === 'saved') text = 'LOCAL FRAME SAVED / 101\nNETWORK: DISCONNECTED\n\nMAIL / WORK / CONTACTS\ncached inbox_';
    }
    if (contact?.phase === 'signal') {
      const t = contact.elapsed; const start = t < 2.8 ? 0 : t < 5.6 ? 2.8 : 5.6;
      const line = start === 0 ? 'Wake up, Neo.' : start === 2.8 ? 'The Matrix has you.' : 'Follow the white rabbit.';
      text = line.slice(0, Math.floor((t - start) * 18));
    } else if (contact?.phase === 'reply') text = 'Follow the white rabbit.';
    else if (contact && apartmentAfter(contact, 'knocking')) text = contact.phase === 'knocking' && contact.elapsed < 2.2 ? 'Knock, knock, Neo.' : '';
    this.glow.intensity = text ? 100 - daylight * 65 : 2;
    if (text === this.screenKey) return;
    this.screenKey = text;
    const ctx = this.canvas.getContext('2d')!; ctx.fillStyle = '#050a07'; ctx.fillRect(0, 0, 1024, 640);
    ctx.font = '52px monospace'; ctx.fillStyle = '#a9b48e'; ctx.shadowColor = '#6b8b59'; ctx.shadowBlur = 4;
    text.split('\n').forEach((line, i) => ctx.fillText(line, 48, 92 + i * 65)); ctx.shadowBlur = 0;
    if (text) ctx.fillRect(48, 280, 22, 4);
    ctx.fillStyle = '#00000026'; for (let y = 0; y < 640; y += 4) ctx.fillRect(0, y, 1024, 1);
    this.screen.needsUpdate = true;
  }
  private batch(): void {
    this.root.updateWorldMatrix(true, true); const inverse = this.root.matrixWorld.clone().invert(); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const removed: THREE.Mesh[] = [];
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      for (let node: THREE.Object3D | null = object; node && node !== this.root; node = node.parent) if (node.userData.dynamic) return;
      let geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
      const list = batches.get(object.material) ?? []; list.push(geometry); batches.set(object.material, list); removed.push(object);
    });
    removed.forEach(mesh => mesh.removeFromParent());
    for (const [mat, parts] of batches) { this.mesh(mergeGeometries(parts)!, mat, 0, 0, 0); parts.forEach(p => p.dispose()); }
    const live = new Set<THREE.BufferGeometry>(); this.root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) live.add(object.geometry); });
    for (const geo of this.geometries) if (!live.has(geo)) { geo.dispose(); this.geometries.delete(geo); }
  }
  dispose(): void {
    this.root.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.removeFromParent();
  }
}
