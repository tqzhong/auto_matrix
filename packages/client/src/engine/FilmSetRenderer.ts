import * as THREE from 'three';
import { workdayLocked, type OfficeWorkday } from '@auto_matrix/shared';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { FILM_SETS, FILM_SCENE_BY_ID, PILL_ROOM, pillLocked, pillPose, lafayetteWelcomeLocked, interludeLocked, type PillGesture, FREEWAY_FINISH, ORACLE_FURNITURE, awakeningLocked, trainingLocked, phoneLocked, windowOpening, filmPosition, filmSetAt, filmObstacles, filmStepPosition, type Vector3, type FilmSet, type AgentState, type SandboxState, type CombatImpact } from '@auto_matrix/shared';
import { LobbySetRenderer } from './LobbySetRenderer.js';
import { OfficeSetRenderer } from './OfficeSetRenderer.js';
import { FreewaySetRenderer } from './FreewaySetRenderer.js';
import { PodSetRenderer } from './PodSetRenderer.js';
import { NebDeckRenderer } from './NebDeckRenderer.js';
import { ConstructRenderer } from './ConstructRenderer.js';
import { DesertRenderer } from './DesertRenderer.js';
import { TrainingSetRenderer } from './TrainingSetRenderer.js';
import { OracleVase } from './OracleVase.js';
import { AmbushSetRenderer } from './AmbushSetRenderer.js';
import { createPillGlass } from '../agents/PillPerformance.js';
import { InterrogationSetRenderer } from './InterrogationSetRenderer.js';
import { interrogationLocked } from '@auto_matrix/shared';
import { MEETING_DESTINATION, meetingLocked, type MeetingGesture } from '@auto_matrix/shared';
import { MeetingSetRenderer } from './MeetingSetRenderer.js';
import { LafayetteApproachRenderer } from './LafayetteApproachRenderer.js';
import { LAFAYETTE } from '@auto_matrix/shared';
import { ApartmentSetRenderer } from './ApartmentSetRenderer.js';
import { apartmentLocked } from '@auto_matrix/shared';
import { clubLocked } from '@auto_matrix/shared';
import { ClubSetRenderer } from './ClubSetRenderer.js';
import { SentinelSetRenderer } from './SentinelSetRenderer.js';
import { CypherRestaurantRenderer } from './CypherRestaurantRenderer.js';
import { betrayalLocked, rescueLocked } from '@auto_matrix/shared';

const outdoor = new Set(['rooftop', 'plaza', 'bridge', 'street', 'courtyard', 'freeway', 'machine', 'rain', 'garden', 'desert', 'pods']);
const palettes = {
  day: { sky: 0xb8c9cd, fog: .001, ambient: 1.25, sun: 2.3, color: 0xffedcf },
  night: { sky: 0x121b21, fog: .009, ambient: .55, sun: .35, color: 0xaabdc3 },
  warm: { sky: 0x191512, fog: .003, ambient: 1.05, sun: .9, color: 0xffca8f },
  cold: { sky: 0x131e25, fog: .006, ambient: .95, sun: .85, color: 0xb3d8e0 },
  white: { sky: 0xe4e6e0, fog: .003, ambient: 1.7, sun: 1.1, color: 0xffffff },
  storm: { sky: 0x0d181d, fog: .009, ambient: .48, sun: .55, color: 0xa5c6cd },
  sunrise: { sky: 0xb8d1dc, fog: .0015, ambient: 1.3, sun: 2.6, color: 0xffdba0 },
};

/** Only the current film set is resident; static meshes are merged by material.
 * Texture/geometry ownership is scoped to a set and released on every transition. */
export class FilmSetRenderer {
  readonly root = new THREE.Group();
  private current?: FilmSet;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private materialCache = new Map<string, THREE.MeshStandardMaterial>();
  private marker: THREE.Mesh;
  private markerLight: THREE.PointLight;
  private moving: { object: THREE.Object3D; update: (time: number) => void }[] = [];
  private metal!: THREE.MeshStandardMaterial;
  private brass!: THREE.MeshStandardMaterial;
  private black!: THREE.MeshStandardMaterial;
  private plaster!: THREE.MeshStandardMaterial;
  private wood!: THREE.MeshStandardMaterial;
  private marble!: THREE.MeshStandardMaterial;
  private leather!: THREE.MeshStandardMaterial;
  private glass!: THREE.MeshPhysicalMaterial;
  private white!: THREE.MeshStandardMaterial;
  private glow!: THREE.MeshBasicMaterial;
  private lobby?: LobbySetRenderer;
  private office?: OfficeSetRenderer;
  private apartment?: ApartmentSetRenderer;
  private club?: ClubSetRenderer;
  private freeway?: FreewaySetRenderer;
  private pods?: PodSetRenderer;
  private neb?: NebDeckRenderer;
  private construct?: ConstructRenderer;
  private desert?: DesertRenderer;
  private training?: TrainingSetRenderer;
  private currentScene?: string;
  private mirror?: Reflector;
  private mirrorCracks?: THREE.Group;
  private oracleVase?: OracleVase;
  private ambush?: AmbushSetRenderer;
  private pillGlass?: THREE.Group;
  private interrogation?: InterrogationSetRenderer;
  private meeting?: MeetingSetRenderer;
  private hotel?: LafayetteApproachRenderer;
  private approach?: { root: THREE.Group; renderer: MeetingSetRenderer };
  private sentinel?: SentinelSetRenderer;
  private restaurant?: CypherRestaurantRenderer;

  constructor(private scene: THREE.Scene) {
    scene.add(this.root);
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(1.2, .035, 8, 48), new THREE.MeshBasicMaterial({ color: 0xeac987, transparent: true, opacity: .8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; scene.add(this.marker);
    this.markerLight = new THREE.PointLight(0xf6d99c, 5, 5); scene.add(this.markerLight);
  }
  get active(): FilmSet | undefined { return this.current; }
  update(player: AgentState | undefined, sandbox: SandboxState | undefined, elapsed: number, playerPosition?: Vector3, cameraPosition?: Vector3, workday?: OfficeWorkday): FilmSet | undefined {
    let set = player ? filmSetAt(player.position, player.isInMatrix) : undefined;
    if (set?.id === 'film_extraction_car' && player?.currentLocation === 'film_adams_bridge') set = FILM_SETS.film_adams_bridge;
    if (set?.id === 'film_adams_bridge' && player?.currentLocation === 'film_extraction_car') set = FILM_SETS.film_extraction_car;
    const journey = sandbox?.neoLife?.journey;
    const sceneId = journey?.visiting ?? journey?.scene;
    if (this.office && set && ['film_metacortex_floor', 'film_office_ledge'].includes(set.id)) { this.current = set; this.currentScene = sceneId; }
    if (this.meeting && set && ['film_adams_bridge', 'film_extraction_car'].includes(set.id)) { this.current = set; this.currentScene = sceneId; }
    if (set?.id !== this.current?.id || sceneId !== this.currentScene) {
      this.clear(); this.current = set; this.currentScene = sceneId;
      if (set) {
        this.root.position.set(set.center.x, set.center.y - 1, set.center.z);
        if (['film_metacortex_floor', 'film_office_ledge'].includes(set.id)) this.office = new OfficeSetRenderer(this.root, set);
        else if (set.id === 'film_anderson_flat') this.apartment = new ApartmentSetRenderer(this.root);
        else if (set.id === 'film_white_rabbit_club') { this.club = new ClubSetRenderer(this.root); void this.club.ready.catch(error => console.error('夜店人群加载失败', error)); }
        else if (set.architecture === 'lobby') this.lobby = new LobbySetRenderer(this.root, set);
        else if (set.architecture === 'freeway') this.freeway = new FreewaySetRenderer(this.root, set);
        else if (set.architecture === 'pods') this.pods = new PodSetRenderer(this.root);
        else if (set.id === 'film_neb_deck') this.neb = new NebDeckRenderer(this.root);
        else if (set.id === 'film_cypher_restaurant') this.restaurant = new CypherRestaurantRenderer(this.root);
        else if (set.id === 'film_white_construct') this.construct = new ConstructRenderer(this.root, sceneId);
        else if (set.id === 'film_real_desert') this.desert = new DesertRenderer(this.root);
        else if (['m1_dojo', 'm1_jump', 'm1_red_dress'].includes(sceneId ?? '')) this.training = new TrainingSetRenderer(this.root, sceneId!);
        else if (sceneId === 'm1_sentinels') this.sentinel = new SentinelSetRenderer(this.root);
        else if (set.id === 'film_ambush_house') this.ambush = new AmbushSetRenderer(this.root);
        else if (set.id === 'film_agent_interrogation') this.interrogation = new InterrogationSetRenderer(this.root);
        else if (set.id === 'film_adams_bridge' || set.id === 'film_extraction_car') this.meeting = new MeetingSetRenderer(this.root);
        else {
          this.build(set); this.batch();
          if (set.id === 'film_lafayette') {
            this.hotel = new LafayetteApproachRenderer(this.root, new THREE.Vector3(0, -LAFAYETTE.upper, 0));
            const root = new THREE.Group(); root.position.set(-MEETING_DESTINATION.x, -LAFAYETTE.upper, 0); this.root.add(root);
            this.approach = { root, renderer: new MeetingSetRenderer(root, false) };
          }
        }
      }
    }
    if (this.mirrorCracks) {
      const healing = journey?.scene === 'm1_mirror' && !journey.visiting;
      const progress = !healing ? 0 : journey!.step > 0 ? 1 : Math.min(1, (journey?.awakening?.elapsed ?? 0) / 2);
      this.mirrorCracks.visible = progress < 1;
      this.mirrorCracks.scale.y = Math.max(.001, 1 - progress);
      const shader = this.mirror!.material as THREE.ShaderMaterial;
      shader.uniforms.liquidTime.value = elapsed; shader.uniforms.liquidAmount.value = healing ? progress * .003 : 0;
    }
    if (this.pillGlass) {
      const gesture = sceneId === 'm1_pills' && !journey?.visiting ? player?.currentAction?.parameters.pills as PillGesture | undefined : undefined;
      const pose = gesture ? pillPose(gesture) : undefined;
      this.pillGlass.visible = !pose?.holdingCup;
      const used = pose?.cupUsed || journey?.pills?.phase === 'done';
      const water = this.pillGlass.getObjectByName('pill-water-level')!;
      water.scale.y = used ? .45 : 1; water.position.y = used ? -.12 : -.04;
    }
    this.lobby?.update(journey, elapsed);
    this.interrogation?.update(journey);
    this.meeting?.update(journey, elapsed, player?.id === journey?.actor ? player?.currentAction?.parameters.meeting as MeetingGesture | undefined : undefined);
    this.hotel?.update(journey?.visiting ? undefined : journey?.hotel, (playerPosition?.y ?? 1) - 1);
    if (this.approach) {
      this.approach.root.visible = (playerPosition?.y ?? 1) < 15;
      if (this.approach.root.visible) this.approach.renderer.update(journey, elapsed, { phase: 'parked', elapsed: 0, role: 'neo', bugged: false });
    }
    this.office?.update(journey, cameraPosition, playerPosition, workday);
    this.apartment?.update(journey);
    this.club?.update(elapsed);
    this.freeway?.update(journey, elapsed, playerPosition);
    this.pods?.update(journey, elapsed);
    this.neb?.update(journey, elapsed);
    this.construct?.update(journey);
    this.desert?.update(journey, elapsed);
    this.training?.update(journey, elapsed);
    this.sentinel?.update(journey, elapsed);
    this.restaurant?.update(journey, elapsed);
    this.ambush?.update(journey, sandbox?.structures ?? [], elapsed);
    this.oracleVase?.update(sceneId === 'm1_oracle' ? journey?.visiting || journey!.step > 0 ? 4.5 : journey?.oracle?.vase : undefined);
    const scene = journey && FILM_SCENE_BY_ID[journey.scene]; const step = scene?.steps[journey!.step];
    this.marker.visible = Boolean(set && scene?.set === set.id && step && !journey?.visiting && journey?.actor === player?.id);
    if (journey?.scene === 'm1_lobby' && journey.fighting) this.marker.visible = false;
    if (journey && pillLocked(journey)) this.marker.visible = false;
    if (journey && interrogationLocked(journey)) this.marker.visible = false;
    if (journey && meetingLocked(journey)) this.marker.visible = false;
    if (journey && lafayetteWelcomeLocked(journey)) this.marker.visible = false;
    if (journey?.hotel && !journey.hotel.entered) this.marker.visible = false;
    if (journey && awakeningLocked(journey)) this.marker.visible = false;
    if (journey && trainingLocked(journey)) this.marker.visible = false;
    if (journey && workdayLocked(journey)) this.marker.visible = false;
    if (journey && apartmentLocked(journey)) this.marker.visible = false;
    if (journey && clubLocked(journey)) this.marker.visible = false;
    if (journey?.scene === 'm1_sentinels' && journey.sentinel && !['ready', 'verify', 'done'].includes(journey.sentinel.phase)) this.marker.visible = false;
    if (journey && interludeLocked(journey)) this.marker.visible = false;
    if (journey && betrayalLocked(journey)) this.marker.visible = false;
    if (journey && (rescueLocked(journey) || journey.scene === 'm1_guns' && journey.rescue?.phase === 'selecting')) this.marker.visible = false;
    if (journey && phoneLocked(journey)) this.marker.visible = false;
    if (journey && windowOpening(journey)) this.marker.visible = false;
    if (journey?.scene === 'm1_dejavu' && journey.step === 0 && journey.ambush) this.marker.visible = false;
    if (this.marker.visible && step && scene) {
      const position = step.kind === 'drive' && journey?.ride ? filmPosition(scene.set, 14, FREEWAY_FINISH) : filmStepPosition(scene, step);
      if (scene.id === 'm1_ledge' && journey?.office?.climbed !== undefined) position.y -= 32;
      this.marker.position.set(position.x, position.y - .82, position.z);
      this.marker.scale.setScalar(1 + Math.sin(elapsed * 2) * .07); this.markerLight.position.copy(this.marker.position).y += 1.5;
    }
    this.markerLight.visible = this.marker.visible;
    for (const item of this.moving) item.update(elapsed);
    return set;
  }
  atmosphere(): { color: number; ambient: number; sun: number } | undefined {
    if (!this.current) return;
    const palette = palettes[this.current.light];
    (this.scene.background as THREE.Color).setHex(palette.sky);
    const fog = this.scene.fog as THREE.FogExp2; fog.color.setHex(palette.sky); fog.density = palette.fog;
    this.scene.environmentIntensity = outdoor.has(this.current.architecture) ? .8 : .6;
    if (this.lobby) {
      (this.scene.fog as THREE.FogExp2).density = .003; (this.scene.fog as THREE.FogExp2).color.setHex(0x182820);
      this.scene.environmentIntensity = .75;
      return { color: 0xdce7d2, ambient: .6, sun: .2 };
    }
    if (this.office) return { color: 0xe8e8d7, ambient: .65, sun: .3 };
    if (this.apartment) { fog.density = .001; this.scene.environmentIntensity = .42; return { color: 0xcbd2b8, ambient: .52, sun: .06 }; }
    if (this.club) { fog.density = .005; fog.color.setHex(0x111913); this.scene.environmentIntensity = .28; return { color: 0xc1c8ac, ambient: .38, sun: .025 }; }
    if (this.interrogation) { fog.density = .001; this.scene.environmentIntensity = .38; return { color: 0xdce4ce, ambient: .48, sun: .08 }; }
    if (this.meeting) { fog.density = .007; fog.color.setHex(0x111b1d); (this.scene.background as THREE.Color).copy(fog.color); this.scene.environmentIntensity = .7; return { color: 0xb8cdc6, ambient: .62, sun: .15 }; }
    if (this.hotel) { fog.density = .001; this.scene.environmentIntensity = .42; return { color: 0xd4d1b2, ambient: .62, sun: .12 }; }
    if (this.ambush) { this.scene.environmentIntensity = .4; return { color: 0xd4ddbe, ambient: .52, sun: .15 }; }
    if (this.pods) {
      (this.scene.background as THREE.Color).setHex(0x080f14); fog.color.setHex(0x080f14); fog.density = .005;
      this.scene.environmentIntensity = .45;
      return { color: 0xb2cdd7, ambient: .4, sun: .35 };
    }
    if (this.neb) {
      (this.scene.background as THREE.Color).setHex(0x101918); fog.color.setHex(0x101918); fog.density = .0035;
      this.scene.environmentIntensity = .52;
      return { color: 0xc7ddd3, ambient: .68, sun: .18 };
    }
    if (this.construct) {
      (this.scene.background as THREE.Color).setHex(0xeeeeea); fog.color.setHex(0xeeeeea); fog.density = .0012;
      this.scene.environmentIntensity = .82;
      return { color: 0xffffff, ambient: 1.08, sun: .28 };
    }
    if (this.desert) {
      (this.scene.background as THREE.Color).setHex(0x303b3e); fog.color.setHex(0x303b3e); fog.density = .0055;
      this.scene.environmentIntensity = .55;
      return { color: 0xb4c7c6, ambient: .7, sun: .48 };
    }
    if (this.training) {
      if (this.training.sceneId === 'm1_dojo') {
        (this.scene.background as THREE.Color).setHex(0xb7c6bd); fog.color.setHex(0xb7c6bd); fog.density = .002;
        this.scene.environmentIntensity = .78; return { color: 0xffe9c2, ambient: .88, sun: .58 };
      }
      if (this.training.sceneId === 'm1_jump') {
        (this.scene.background as THREE.Color).setHex(0x9db2b5); fog.color.setHex(0x9db2b5); fog.density = .0042;
        this.scene.environmentIntensity = .7; return { color: 0xf2dfbf, ambient: .78, sun: 1.05 };
      }
      (this.scene.background as THREE.Color).setHex(0xb8c3bd); fog.color.setHex(0xb8c3bd); fog.density = .0025;
      this.scene.environmentIntensity = .74; return { color: 0xffead0, ambient: .9, sun: .9 };
    }
    if (this.sentinel) {
      (this.scene.background as THREE.Color).setHex(0x07100f); fog.color.setHex(0x07100f); fog.density = .008;
      this.scene.environmentIntensity = .28; return { color: 0xa9c9bc, ambient: .34, sun: .04 };
    }
    if (this.restaurant) {
      (this.scene.background as THREE.Color).setHex(0x090d12); fog.color.setHex(0x090d12); fog.density = .0018;
      this.scene.environmentIntensity = .32; return { color: 0xffd5a8, ambient: .38, sun: .05 };
    }
    return palette;
  }
  impact(hit: CombatImpact): void { this.lobby?.impact(hit); }
  private own<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private mat(color: number, roughness = .65, metalness = 0): THREE.MeshStandardMaterial {
    const key = `${color}:${roughness}:${metalness}`; const cached = this.materialCache.get(key); if (cached) return cached;
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); this.materialCache.set(key, material); return material;
  }
  private pbr(id: string, color = 0xffffff, repeat = 4, roughness = .85, metalness = 0): THREE.MeshStandardMaterial {
    const loader = new THREE.TextureLoader();
    const texture = (kind: string) => {
      const map = loader.load(`/assets/film-materials/${id}-${kind}.jpg`); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat); map.anisotropy = 8;
      if (kind === 'color') map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map); return map;
    };
    const material = new THREE.MeshStandardMaterial({ color, map: texture('color'), normalMap: texture('normal'), roughnessMap: texture('roughness'), roughness, metalness, normalScale: new THREE.Vector2(.4, .4) });
    this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(this.own(geometry), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, bevel = 0): THREE.Mesh {
    return this.mesh(bevel ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  private cylinder(material: THREE.Material, x: number, y: number, z: number, radius: number, height: number, top = radius): THREE.Mesh {
    return this.mesh(new THREE.CylinderGeometry(top, radius, height, 20), material, x, y, z);
  }
  private sphere(material: THREE.Material, x: number, y: number, z: number, r: number): THREE.Mesh { return this.mesh(new THREE.SphereGeometry(r, 24, 16), material, x, y, z); }
  private pipe(points: number[][], radius = .12, material: THREE.Material = this.metal): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    return this.mesh(new THREE.TubeGeometry(curve, 20, radius, 8, false), material, 0, 0, 0);
  }
  private label(text: string, x: number, y: number, z: number, width = 10, color = '#dadace', background = '#182422'): THREE.Mesh {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(16, 16, 992, 160); ctx.fillStyle = color; ctx.font = '46px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 98, 942);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const material = new THREE.MeshStandardMaterial({ map, roughness: .72 }); this.materials.add(material);
    return this.mesh(new THREE.PlaneGeometry(width, width * 192 / 1024), material, x, y, z);
  }
  private lamp(x: number, y: number, z: number, warm = true, hanging = false): void {
    if (hanging) this.cylinder(this.metal, x, y + 1.8, z, .035, 3.6);
    this.mesh(new THREE.CylinderGeometry(.75, 1.15, .55, 24, 1, true), this.brass, x, y + .15, z);
    this.sphere(this.glow, x, y, z, .18);
    const light = new THREE.PointLight(warm ? 0xffd6a1 : 0xc7e4e2, warm ? 135 : 185, 30, 2); light.position.set(x, y - .3, z); this.root.add(light);
  }
  private table(x: number, z: number, w = 6, d = 3, material = this.wood, y = 2.6): void {
    this.box(material, x, y, z, w, .28, d, .07);
    for (const dx of [-w / 2 + .3, w / 2 - .3]) for (const dz of [-d / 2 + .3, d / 2 - .3]) this.box(this.black, x + dx, y / 2, z + dz, .23, y, .23);
  }
  private chair(x: number, z: number, angle = 0, red = false): void {
    const start = this.root.children.length; const mat = red ? this.leather : this.black;
    this.box(mat, 0, 1.5, 0, 2.5, .6, 2.5, .16); this.box(mat, 0, 2.8, -1, 2.5, 2.6, .5, .2);
    for (const dx of [-1, 1]) for (const dz of [-.9, .9]) this.cylinder(this.wood, dx, .65, dz, .13, 1.3);
    if (red) for (const dx of [-1.2, 1.2]) this.box(mat, dx, 2.1, 0, .48, .9, 2.7, .2);
    const group = new THREE.Group(); const children = this.root.children.slice(start); children.forEach(child => group.add(child)); group.scale.setScalar(red ? .85 : .68); group.position.set(x, 0, z); group.rotation.y = angle; this.root.add(group);
  }
  private loungeChair(x: number, z: number, angle: number): void {
    const start = this.root.children.length;
    const seam = this.mat(0x43221c, .68); const trim = this.mat(0x856747, .38, .65);
    for (const dx of [-1.35, 1.35]) for (const dz of [-1.05, 1.05]) {
      this.cylinder(this.wood, dx, .48, dz, .16, .92, .22); this.sphere(this.wood, dx, .19, dz, .22);
    }
    this.box(this.leather, 0, 1.02, 0, 3.65, .6, 3.05, .22);
    this.box(this.leather, 0, 1.48, .1, 2.8, .55, 2.65, .25);
    this.pipe([[-1.3, 1.55, 1.36], [0, 1.56, 1.4], [1.3, 1.55, 1.36]], .018, seam);
    this.box(this.leather, 0, 3.23, -1.23, 3.7, 3.65, .65, .3).rotation.x = -.09;
    const buttons: [number, number][] = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
      const bx = -1.44 + col * .72 + row % 2 * .36;
      if (bx < 1.6) buttons.push([bx, 2 + row * .62]);
    }
    const positions: number[] = []; const uv: number[] = []; const indices: number[] = [];
    const surface = (sx: number, sy: number) => {
      const v = (sy - 1.65) / 3.3;
      const radius = Math.min(...buttons.map(([bx, by]) => ((sx - bx) / .65) ** 2 + ((sy - by) / .55) ** 2));
      return -.8 - v * .2 + sx * sx * .095 + .19 * Math.min(1, radius * 3) - .13 * Math.exp(-radius * 20);
    };
    for (let row = 0; row <= 48; row++) for (let col = 0; col <= 48; col++) {
      const sx = (col / 48 - .5) * 3.4; const sy = 1.65 + row / 48 * 3.3;
      positions.push(sx, sy, surface(sx, sy)); uv.push(col / 48, row / 48);
      if (row < 48 && col < 48) { const a = row * 49 + col; indices.push(a, a + 1, a + 49, a + 1, a + 50, a + 49); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(geometry, this.leather, 0, 0, 0);
    for (const [bx, by] of buttons) this.sphere(seam, bx, by, surface(bx, by) + .035, .065).scale.z = .45;
    for (const side of [-1, 1]) {
      this.box(this.leather, side * 1.58, 2.04, 0, .65, 1.85, 2.9, .3);
      this.cylinder(this.leather, side * 1.6, 2.78, .1, .42, 2.8).rotation.x = Math.PI / 2;
      this.sphere(this.leather, side * 1.6, 2.78, 1.5, .43).scale.z = .5;
      for (let i = 0; i < 11; i++) this.sphere(trim, side * 1.86, 1.1 + i * .32, -1.17, .033);
      this.pipe([[side * 1.9, 1.2, 1.43], [side * 1.9, 2.6, 1.43], [side * 1.6, 3.17, 1.43], [side * 1.25, 2.65, 1.43]], .025, seam);
    }
    for (let i = 0; i < 26; i++) this.sphere(trim, -1.72 + i * .138, .89, 1.55, .033);
    const group = new THREE.Group(); this.root.children.slice(start).forEach(child => group.add(child)); group.scale.setScalar(.65); group.position.set(x, 0, z); group.rotation.y = angle; this.root.add(group);
  }
  private rug(x: number, z: number, width: number, depth: number): void {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#4d3631'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = i % 2 ? '#8b7760' : '#303c35'; ctx.lineWidth = i % 2 ? 3 : 7; ctx.strokeRect(9 + i * 5, 9 + i * 5, 494 - i * 10, 494 - i * 10); }
    for (let row = 0; row < 12; row++) for (let col = 0; col < 11; col++) {
      const px = 53 + col * 40 + row % 2 * 10; const py = 42 + row * 39;
      ctx.strokeStyle = '#887257'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py - 9); ctx.lineTo(px + 6, py); ctx.lineTo(px, py + 9); ctx.lineTo(px - 6, py); ctx.closePath(); ctx.stroke();
    }
    for (const size of [135, 111, 91, 67]) {
      ctx.fillStyle = size === 135 || size === 91 ? '#a28b69' : '#3d4840'; ctx.beginPath(); ctx.moveTo(256, 256 - size); ctx.lineTo(256 + size * .72, 256); ctx.lineTo(256, 256 + size); ctx.lineTo(256 - size * .72, 256); ctx.closePath(); ctx.fill();
    }
    for (let y = 0; y < 512; y += 2) { ctx.fillStyle = y % 4 ? '#00000014' : '#d6c1990a'; ctx.fillRect(0, y, 512, 1); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; this.textures.add(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }); this.materials.add(material);
    this.box(material, x, .025, z, width, .04, depth);
  }
  private crt(x: number, y: number, z: number, scale = 1, blue = false): void {
    this.box(this.black, x, y + .25 * scale, z, 2.5 * scale, 2 * scale, 1.8 * scale, .18);
    const screen = this.box(this.mat(blue ? 0x587888 : 0x354b35, .25), x, y + .3 * scale, z + .92 * scale, 2.1 * scale, 1.5 * scale, .08, .12);
    (screen.material as THREE.MeshStandardMaterial).emissive.setHex(blue ? 0x315367 : 0x1b452e); (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = .7;
    for (let i = 0; i < 6; i++) this.box(this.glow, x - .3 * scale, y + (.7 - i * .18) * scale, z + .971 * scale, (i % 3 + 1) * .4 * scale, .024 * scale, .01);
    this.box(this.metal, x, y - scale, z, 1.2 * scale, .15, 1.1 * scale);
  }
  private window(x: number, y: number, z: number, w: number, h: number, side = false): void {
    const start = this.root.children.length;
    this.box(this.glass, 0, 0, 0, w, h, .12);
    for (const dx of [-w / 2, 0, w / 2]) this.box(this.wood, dx, 0, .1, .16, h + .4, .4);
    for (const dy of [-h / 2, 0, h / 2]) this.box(this.wood, 0, dy, .1, w + .4, .16, .4);
    this.box(this.marble, 0, -h / 2 - .2, .3, w + .8, .35, 1.1, .07);
    const group = new THREE.Group(); this.root.children.slice(start).forEach(c => group.add(c)); group.position.set(x, y, z); if (side) group.rotation.y = Math.PI / 2; this.root.add(group);
  }
  private door(x: number, z: number, number?: string): void {
    this.box(this.wood, x, 4, z, 4.8, 8, .35, .08);
    for (const dx of [-2.65, 2.65]) this.box(this.white, x + dx, 4.3, z + .1, .35, 8.6, .6);
    this.box(this.white, x, 8.5, z + .1, 5.6, .3, .6);
    for (const y of [2, 5.6]) { this.box(this.black, x, y, z + .19, 3.8, 2.6, .06); this.box(this.wood, x, y, z + .24, 3.6, 2.4, .07, .04); }
    this.sphere(this.brass, x + 1.7, 3.6, z + .45, .16);
    if (number) this.label(number, x, 6.4, z + .32, 1.6, '#d8bf7b', '#342f21');
  }
  private phone(x: number, z: number, booth = false): void {
    this.box(this.metal, x, 3.8, z, 1.45, 2.4, .8, .12); this.box(this.black, x, 4.3, z + .43, .75, .7, .08);
    for (let i = 0; i < 12; i++) this.box(this.white, x - .28 + i % 3 * .23, 3.8 - Math.floor(i / 3) * .18, z + .46, .13, .1, .05);
    this.pipe([[x - .67, 4.5, z + .55], [x - .9, 4.1, z + .7], [x - .65, 3.5, z + .55]], .12, this.black);
    this.pipe([[x - .7, 3.7, z + .4], [x - .4, 2.7, z + .5], [x, 3.1, z + .4]], .04, this.black);
    if (booth) {
      for (const dx of [-1.8, 1.8]) for (const dz of [-1.4, 1.4]) this.box(this.metal, x + dx, 3.8, z + dz, .15, 7.6, .15);
      for (const dx of [-1.8, 1.8]) this.box(this.glass, x + dx, 3.8, z, .06, 7, 2.8);
      this.box(this.metal, x, 7.7, z, 3.8, .5, 3.1); this.label('TELEPHONE', x, 7.7, z + 1.57, 3.4);
    }
  }
  private car(x: number, z: number, color = 0x182622, truck = false): THREE.Group {
    const start = this.root.children.length; const paint = this.mat(color, .26, .62);
    this.box(paint, 0, 1.9, 0, 4.2, 1.9, truck ? 15 : 9, .5);
    this.box(this.glass, 0, 3.3, -.4, 3.7, 1.7, truck ? 4 : 4.7, .45);
    this.box(paint, 0, 4.2, -.5, 3.9, .18, truck ? 4.2 : 4.8, .1);
    if (truck) this.box(this.white, 0, 4.3, 7, 5.6, 7, 13, .15);
    for (const dx of [-2.1, 2.1]) for (const dz of [-2.9, 2.9]) this.cylinder(this.black, dx, 1.2, dz, 1, .6).rotation.z = Math.PI / 2;
    for (const dx of [-1.35, 1.35]) this.box(this.glow, dx, 2, -4.52, .8, .45, .08, .12);
    this.box(this.metal, 0, 1.3, -4.57, 4.1, .32, .13, .1);
    const group = new THREE.Group(); this.root.children.slice(start).forEach(c => group.add(c)); group.position.set(x, 0, z); this.root.add(group); return group;
  }
  private shell(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set; const exterior = outdoor.has(set.architecture);
    const lavish = ['chateau', 'lobby', 'restaurant', 'hel', 'architect'].includes(set.architecture);
    const industrial = ['ship', 'engineering', 'garage', 'power', 'zion', 'temple', 'pods', 'machine'].includes(set.architecture);
    const floor = lavish ? this.marble : industrial ? this.metal : ['construct', 'mobil', 'backdoors'].includes(set.architecture) ? this.white : exterior ? this.pbr('damaged_plaster', set.architecture === 'garden' ? 0x6f7851 : 0x6f7879, 14) : this.wood;
    if (set.id === 'film_jump_roofs') {
      this.box(floor, 0, -.3, (-13 + d / 2) / 2, w, .6, d / 2 + 13);
      this.box(floor, 0, -.3, (-30 - d / 2) / 2, w, .6, d / 2 - 30);
      this.box(this.plaster, 0, -22.6, -12.8, w, 45, .5); this.box(this.plaster, 0, -22.6, -30.2, w, 45, .5);
      this.box(this.black, 0, -45, -21.5, w + 50, .7, 17);
      this.box(this.white, 0, .05, -10, 12, .04, .15);
    } else this.box(floor, 0, -.3, 0, w, .6, d);
    if (exterior || set.architecture === 'construct') return;
    const wall = industrial ? this.metal : lavish || ['oracle', 'dojo', 'teahouse', 'mobil', 'backdoors'].includes(set.architecture) ? this.white : this.plaster;
    for (const x of [-w / 2, w / 2]) {
      if (set.architecture === 'lafayette' && x > 0) continue;
      this.box(wall, x, h / 2, 0, .7, h, d);
      for (const y of [.7, 3.7, h - .6]) this.box(lavish ? this.marble : this.wood, x - Math.sign(x) * .45, y, 0, .35, y === 3.7 ? .18 : .7, d);
    }
    this.box(wall, 0, h / 2, -d / 2, w, h, .7);
    this.box(wall, 0, h / 2, d / 2, w, h, .7);
    if (set.architecture === 'lafayette') {
      this.box(this.plaster, 0, h, 0, w, .5, d);
      for (const y of [.2, .55, 3.7, h - 1.1, h - .8, h - .4]) {
        const trim = y > 4 ? this.white : this.wood;
        for (const side of [-1, 1]) { if (side < 0) this.box(trim, side * (w / 2 - .45), y, 0, .35, .15, d); this.box(trim, 0, y, side * (d / 2 - .45), w, .15, .35); }
      }
      for (let z = -d / 2 + 3; z < d / 2; z += 6) for (const side of [-1, 1]) if (side < 0 || Math.abs(z) > 3.3) this.box(this.wood, side * (w / 2 - .4), 1.9, z, .12, 3.2, .12);
      return;
    }
    // Coffers instead of a solid ceiling retain daylight and a readable close camera.
    for (let z = -d / 2; z <= d / 2; z += 12) this.box(industrial ? this.metal : this.white, 0, h - .4, z, w, .6, .7);
    for (const x of [-w * .24, w * .24]) this.box(this.white, x, h, 0, .6, .5, d);
    for (const o of filmObstacles(set)) {
      if (set.architecture === 'oracle') continue;
      const column = set.architecture === 'lobby' ? this.mat(0x2d4038, .28, .08) : lavish ? this.marble : this.metal;
      this.box(column, o.x, h / 2, o.z, o.width, h, o.depth, .08);
      for (const y of [.35, h - .5]) this.box(lavish ? this.marble : this.metal, o.x, y, o.z, 2.5, .7, 2.5, .06);
    }
    if (['day', 'warm'].includes(set.light) && !['dojo', 'teahouse'].includes(set.architecture)) for (let z = -d / 2 + 9; z < d / 2 - 6; z += 13) this.window(-w / 2 + .45, h * .58, z, 7, h * .53, true);
    for (let z = -d / 2 + 12; z < d / 2 - 4; z += 22) for (const x of [-w * .25, w * .25]) this.lamp(x, h - 2, z, set.light === 'warm' || lavish, true);
  }
  private build(set: FilmSet): void {
    this.metal = this.pbr('metal_plate', 0x9caaa9, 3, .7, .28);
    this.wood = this.pbr('old_wood_floor', 0x96826b, 3); this.marble = this.pbr('marble_01', 0xbdcbd1, 4, .25);
    this.plaster = this.pbr('damaged_plaster', 0xadae9c, 5); this.leather = this.pbr('leather_red_03', 0x71413a, 1, .48);
    this.white = this.pbr('white_plaster_02', 0xd8d9ce, 3); this.black = this.mat(0x161b1a, .44); this.brass = this.mat(0x8e7951, .32, .8);
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0xb3c9c7, metalness: .12, roughness: .12, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }); this.materials.add(this.glass);
    this.glow = new THREE.MeshBasicMaterial({ color: 0xffdb9e, toneMapped: false }); this.materials.add(this.glow);
    this.shell(set);
    const a = set.architecture;
    if (['hotel', 'apartment', 'oracle', 'lafayette', 'tenement'].includes(a)) this.domestic(set);
    if (['office', 'interrogation', 'power', 'workshop', 'backdoors', 'architect'].includes(a)) this.workplace(set);
    if (['chateau', 'restaurant', 'club', 'hel'].includes(a)) this.publicInterior(set);
    if (['ship', 'engineering', 'zion', 'temple', 'pods', 'machine', 'desert'].includes(a)) this.realWorld(set);
    if (['subway', 'mobil'].includes(a)) this.station(set);
    if (['rooftop', 'street', 'rain', 'bridge', 'freeway', 'garage', 'car'].includes(a)) this.transport(set);
    if (['dojo', 'teahouse', 'construct', 'plaza', 'courtyard', 'garden'].includes(a)) this.special(set);
    if (outdoor.has(a) && !['pods', 'machine', 'desert'].includes(a)) this.skyline(set);
    if (!outdoor.has(a)) {
      const fill = new THREE.HemisphereLight(set.light === 'warm' ? 0xeed9b7 : 0xc7d3d3, 0x3e3830, .5); this.root.add(fill);
      const spot = new THREE.SpotLight(set.light === 'warm' ? 0xffd8b1 : 0xe5eee9, 2100, 120, Math.PI / 3, .7, 2);
      spot.position.set(-set.width * .28, set.architecture === 'lafayette' ? set.height - 2 : set.height + 5, 10); spot.target.position.set(0, 0, -5); spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0002; spot.shadow.normalBias = .05;
      this.root.add(spot, spot.target);
    }
  }
  private domestic(set: FilmSet): void {
    const { architecture: a, width: w, depth: d } = set;
    if (a === 'hotel' || a === 'tenement') {
      for (let z = -d / 2 + 6; z < d / 2 - 6; z += 12) {
        for (const side of [-1, 1]) { const start = this.root.children.length; this.door(0, 0, String(301 + Math.round((z + d / 2) / 12))); const group = new THREE.Group(); this.root.children.slice(start).forEach(c => group.add(c)); group.rotation.y = side * Math.PI / 2; group.position.set(side * (w / 2 - .5), 0, z); this.root.add(group); }
        this.box(this.mat(0x6c332a), 0, .05, z, 9, .08, 11.8);
      }
      this.table(-10, -13, 5, 3); this.crt(-10, 3.6, -13); this.phone(-6, -d / 2 + .8);
      this.label(a === 'hotel' ? 'HEART O’ THE CITY / 303' : 'FIRE EXIT', 0, 9.4, -d / 2 + .4, 14);
      if (a === 'tenement') { this.box(this.white, 13, 1, -19, 8, 1.5, 4, .3); for (let i = 0; i < 9; i++) this.box(this.wood, -w / 2 + 5, i * .6, 15 - i * 1.1, 6, .6, 1.2); }
    }
    if (a === 'apartment') {
      this.table(-10, -11, 8, 4); this.crt(-11, 3.7, -11, 1.1); this.crt(-7.5, 3.3, -12, .75);
      this.box(this.black, -11, 1.2, -14, 2, 2.4, 1.6, .12); this.chair(-10, -6, Math.PI);
      for (let i = 0; i < 6; i++) this.pipe([[-12 + i * .2, 1, -12], [-8 + i * .6, .1, -8], [-13, .1, 4 + i]], .04, this.black);
      this.box(this.wood, 9, .7, 7, 8, 1.4, 11, .2); this.box(this.white, 9, 1.6, 7, 7.7, .8, 10.6, .3);
      this.box(this.mat(set.world === 'real' ? 0x7b7364 : 0x5d6053), 9, 2.05, 8.5, 7.5, .2, 7.3, .1); this.box(this.white, 9, 2.2, 3.4, 5.8, .55, 2, .25);
      this.table(11, -11, 4, 3); this.lamp(11, 5, -11); this.door(0, d / 2 - .4, '101');
    }
    if (a === 'lafayette') {
      this.rug(0, -6, 19, 22);
      this.loungeChair(-PILL_ROOM.seat, PILL_ROOM.z, Math.PI / 2); this.loungeChair(PILL_ROOM.seat, PILL_ROOM.z, -Math.PI / 2);
      this.table(0, PILL_ROOM.tableZ, 3.2, 1.8, this.wood, PILL_ROOM.tableY);
      this.box(this.black, -.65, PILL_ROOM.tableY + .21, PILL_ROOM.tableZ, .5, .12, .35, .04);
      this.pillGlass = createPillGlass(); this.pillGlass.position.set(PILL_ROOM.cup.x, PILL_ROOM.cup.y, PILL_ROOM.cup.z); this.root.add(this.pillGlass);
      this.pillGlass.traverse(object => { if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material as THREE.Material); } });
      this.box(this.marble, 0, 4, -d / 2 + 1, 14, 8, 1.5, .08); this.box(this.black, 0, 2.8, -d / 2 + 2, 8, 5, .2); this.box(this.wood, 0, 8.2, -d / 2 + 1, 15, .6, 2, .06);
      for (const x of [-5.5, 5.5]) for (const y of [1.8, 4.3, 6.8]) this.box(this.white, x, y, -d / 2 + 1.9, 1.9, 2.1, .14, .04);
      this.box(this.brass, -10, 5, -18, 6.4, 9.6, .4, .12);
      this.box(this.wood, -10, 5, -17.75, 5.95, 9.15, .16, .08);
      this.mirror = new Reflector(this.own(new THREE.PlaneGeometry(5.6, 8.8)), { color: 0xb4beb8, textureWidth: 768, textureHeight: 1024, clipBias: .003, multisample: 0 });
      this.mirror.position.set(-10, 5, -17.62); this.mirror.userData.dynamic = true; this.root.add(this.mirror);
      const shader = this.mirror.material as THREE.ShaderMaterial;
      shader.uniforms.liquidTime = { value: 0 }; shader.uniforms.liquidAmount = { value: 0 };
      shader.fragmentShader = shader.fragmentShader.replace('void main()', 'uniform float liquidTime;\nuniform float liquidAmount;\nvoid main()')
        .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `vec2 mirrorUv = vUv.xy / vUv.w;
          vec2 liquidOffset = vec2(sin(mirrorUv.y * 28.0 - liquidTime * 2.0), cos(mirrorUv.x * 24.0 + liquidTime * 1.6)) * liquidAmount;
          vec4 base = texture2D(tDiffuse, mirrorUv + liquidOffset);`);
      const crackStart = this.root.children.length;
      for (let i = 0; i < 7; i++) this.pipe([[-12.5 + i * .75, 1.4, -17.58], [-10.2 + (i % 2) * .9, 4.2, -17.58], [-12.4 + i * .76, 8.9, -17.58]], .014, this.black);
      this.mirrorCracks = new THREE.Group(); this.root.children.slice(crackStart).forEach(c => this.mirrorCracks!.add(c)); this.mirrorCracks.userData.dynamic = true; this.root.add(this.mirrorCracks);
      this.table(13, 10); this.crt(13, 3.7, 10); this.crt(10, 3.3, 11, .7); this.lamp(-13, 7, -18);
      this.chair(8, 5, Math.PI); this.lamp(7, 6, -17); this.lamp(-15, 10, 9, false);
      for (const z of [-13, 1, 15]) {
        this.window(-w / 2 + .5, 8, z, 8, 9, true);
        for (let i = 0; i < 12; i++) this.box(this.wood, -w / 2 + 1, 8, z - 3.8 + i * .69, .16, 8.7, .35).rotation.y = .2;
        this.box(this.wood, -w / 2 + .9, 12.9, z, .6, .4, 9.5);
      }
      this.door(0, d / 2 - .4);
    }
    if (a === 'oracle') {
      const green = this.mat(0x566e4b, .5); const cream = this.mat(0xc8c2a1, .6);
      const paperCanvas = document.createElement('canvas'); paperCanvas.width = paperCanvas.height = 256;
      const ctx = paperCanvas.getContext('2d')!; ctx.fillStyle = '#bdc0a0'; ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
        ctx.strokeStyle = '#899271'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + 32, y + 32, 14, 27, 0, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#929779' : '#77816a'; ctx.beginPath(); ctx.ellipse(x + 32, y + 20 + i * 8, 6, 3, i % 2 ? .5 : -.5, 0, Math.PI * 2); ctx.fill(); }
      }
      const map = new THREE.CanvasTexture(paperCanvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(5, 2); this.textures.add(map);
      const paper = new THREE.MeshStandardMaterial({ map, roughness: .95 }); this.materials.add(paper);
      for (const o of filmObstacles(set).filter(o => !ORACLE_FURNITURE.includes(o))) this.box(paper, o.x, o.height / 2, o.z, o.width, o.height, o.depth);
      for (const side of [-1, 1]) {
        this.box(cream, side * 12.25, .22, -19, .3, .44, 21.6); this.box(cream, side * 12.25, 7.4, -19, .3, .22, 21.6);
        this.box(cream, side * 13, .22, -7.7, 16, .44, .3);
      }
      const tiles = document.createElement('canvas'); tiles.width = tiles.height = 128; const tc = tiles.getContext('2d')!;
      tc.fillStyle = '#b4ad88'; tc.fillRect(0, 0, 128, 128); tc.fillStyle = '#757a5a'; tc.fillRect(0, 0, 64, 64); tc.fillRect(64, 64, 64, 64);
      tc.strokeStyle = '#716f57'; tc.lineWidth = 1; for (const v of [0, 64, 128]) { tc.beginPath(); tc.moveTo(v, 0); tc.lineTo(v, 128); tc.moveTo(0, v); tc.lineTo(128, v); tc.stroke(); }
      const tileMap = new THREE.CanvasTexture(tiles); tileMap.colorSpace = THREE.SRGBColorSpace; tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping; tileMap.repeat.set(8, 7); this.textures.add(tileMap);
      const tileMaterial = new THREE.MeshStandardMaterial({ map: tileMap, roughness: .68, normalMap: this.marble.normalMap, normalScale: new THREE.Vector2(.08, .08) }); this.materials.add(tileMaterial);
      const tileFloor = this.mesh(new THREE.PlaneGeometry(23.6, 21.6), tileMaterial, 0, .015, -19); tileFloor.rotation.x = -Math.PI / 2;
      for (const x of [-w / 2 + .42, w / 2 - .42]) this.box(paper, x, 3.2, 8, .08, 6.4, d - 18);
      for (const x of [-5, 5]) this.box(cream, x, 3.3, -7.7, .35, 6.6, .6);
      this.box(cream, 0, 7.2, -8, 10.4, 1.2, .7); this.box(this.white, 0, 7.9, -19, 24, .3, 22);
      this.label('TEMET NOSCE', 0, 7.15, -7.6, 6, '#675c3e', '#c7c4a8');
      for (let x = -9; x <= 6; x += 3) {
        this.box(green, x, 1.15, -27.5, 2.96, 2.3, 2.7, .05); this.box(this.marble, x, 2.4, -27.5, 3, .18, 2.9);
        this.box(green, x, 5.3, -28.5, 2.96, 2.2, 1.3, .05); this.box(this.brass, x + .8, 1.4, -26.09, .4, .06, .1);
        for (const y of [1.18, 5.3]) {
          const z = y < 3 ? -26.12 : -27.81;
          this.box(this.mat(0x81916c), x, y, z, 2.6, 1.92, .045, .025); this.box(green, x, y, z + .03, 2.27, 1.59, .04, .02);
          this.sphere(this.brass, x + 1, y, z + .08, .065);
        }
      }
      for (let x = -11; x < 9; x++) for (let y = 2.7; y < 4.2; y += .5) this.box(green, x, y, -d / 2 + .47, .97, .47, .08);
      this.box(cream, 9, 2.45, -25.5, 3.4, 4.9, 3.5, .15); this.box(this.brass, 7.8, 2.8, -23.7, .08, .8, .09);
      this.box(this.black, -6, 1.3, -26.07, 2.4, 1.5, .08); this.box(this.glass, -6, 1.4, -25.99, 1.9, .8, .04);
      for (const x of [-6.7, -5.4]) for (const z of [-28.1, -27]) this.cylinder(this.black, x, 2.54, z, .38, .04);
      this.cylinder(this.metal, -6.7, 2.86, -28.1, .43, .65); this.sphere(this.black, -6.7, 3.21, -28.1, .13);
      this.window(-11.72, 4.8, -17, 5.6, 4.6, true);
      const windowLight = new THREE.SpotLight(0xf0e5c9, 450, 30, .85, .7, 2); windowLight.position.set(-10.8, 6.2, -17); windowLight.target.position.set(3, 1.5, -18); this.root.add(windowLight, windowLight.target);
      for (let z = -19.8; z <= -14.2; z += .22) this.box(cream, -11.4, 6.7, z, .16, .9 + Math.sin(z * 12) * .05, .18);
      this.table(3, -17, 5, 3, this.wood, 1.9); this.box(this.metal, 3, 2.09, -17, 2, .06, 1.3, .04);
      for (const x of [2.5, 3, 3.5]) this.cylinder(this.mat(0xb99260), x, 2.16, -17, .18, .06);
      this.chair(3, -13.7); this.chair(3, -20.3, Math.PI);
      for (const x of [-12, -6, 6, 12]) this.chair(x, 11, 0, x === -12);
      this.table(8, -11, 2.7, 2.2, this.wood, 1.8); this.oracleVase = new OracleVase(this.root);
      this.rug(-6, 10, 12, 9);
      this.lamp(0, 6.6, -19, true);
    }
  }
  private workplace(set: FilmSet): void {
    const a = set.architecture; const w = set.width; const d = set.depth;
    if (a === 'office') {
      for (const x of [-w * .32, w * .32]) for (let z = -d / 2 + 12; z < d / 2 - 6; z += 12) {
        this.table(x, z, 8, 4, this.mat(0xb0b0a2)); this.crt(x, 3.7, z); this.chair(x, z + 4, Math.PI);
        this.box(this.mat(0x778477), x, 3, z - 3, 10, 6, .25); this.box(this.mat(0x778477), x - Math.sign(x) * 5, 3, z, .25, 6, 6);
      }
      for (let z = -d / 2 + 8; z < d / 2; z += 12) for (let y = 6; y < set.height - 1; y += .65) this.box(this.white, -w / 2 + 1, y, z, .2, .12, 8);
      this.label(set.id.includes('metacortex') ? 'METACORTEX' : 'FEDERAL BUILDING', 0, 10, -d / 2 + .6, 17);
    } else if (a === 'backdoors') {
      for (let z = -d / 2 + 8; z < d / 2; z += 12) for (const x of [-w / 2 + .5, w / 2 - .5]) {
        const start = this.root.children.length; this.door(0, 0); const g = new THREE.Group(); this.root.children.slice(start).forEach(c => g.add(c)); g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; g.position.set(x, 0, z); this.root.add(g);
      }
      this.door(0, -d / 2 + .5); this.phone(4, -d / 2 + .6);
      for (let z = -d / 2 + 6; z < d / 2; z += 10) this.box(this.glow, 0, set.height - .6, z, 3, .1, 1.5);
    } else if (a === 'architect') {
      for (let row = 0; row < 4; row++) for (let i = 0; i < 23; i++) {
        const theta = Math.PI + i / 22 * Math.PI; const x = Math.cos(theta) * 24; const z = Math.sin(theta) * 25 - 2;
        const start = this.root.children.length; this.crt(0, 0, 0, .95, true); const g = new THREE.Group(); this.root.children.slice(start).forEach(c => g.add(c)); g.position.set(x, 2 + row * 3.6, z); g.rotation.y = -theta - Math.PI / 2; this.root.add(g);
      }
      this.chair(0, -14); this.door(-8, -d / 2 + .6); this.door(8, -d / 2 + .6);
    } else if (a === 'workshop') {
      for (const x of [-w / 2 + 2, w / 2 - 2]) {
        for (const y of [1, 4, 7, 10, 13]) this.box(this.wood, x, y, 0, 3.5, .4, d - 5);
        for (let z = -d / 2 + 4; z < d / 2 - 3; z += .9) for (const y of [2.5, 5.5, 8.5, 11.5]) this.box(this.mat([0x504b3c, 0x43302a, 0x4f5651, 0x6c624d][Math.abs(Math.round(z * 3)) % 4]), x, y, z, 2, 2.5, .6);
      }
      this.table(0, -21, 9, 4); for (let i = 0; i < 28; i++) { const x = -11 + i % 14 * 1.6; const y = 7 + Math.floor(i / 14) * 2; this.mesh(new THREE.TorusGeometry(.22, .045, 6, 12), this.brass, x, y, -d / 2 + 1); this.box(this.brass, x, y - .5, -d / 2 + 1, .07, .7, .08); }
      this.door(0, -d / 2 + .5);
    } else if (a === 'power') {
      for (const x of [-w * .3, w * .3]) for (let z = -d / 2 + 10; z < d / 2 - 5; z += 12) {
        this.box(this.metal, x, 4.5, z, 7, 9, 5, .15); for (const y of [3, 5, 7]) { this.box(this.black, x, y, z + 2.6, 5.8, .45, .1); this.sphere(this.mat(0x829a5b), x + 2, y + .6, z + 2.65, .12); }
        this.pipe([[x, 9, z], [x, 12, z], [x * .7, 12, z - 5]], .3);
      }
      this.label('DANGER — HIGH VOLTAGE', 0, 10, -d / 2 + .5, 16, '#201d16', '#ba9e51');
      this.box(this.metal, 0, 3, -d / 2 + 6, 8, 6, 3); this.box(this.brass, 0, 4, -d / 2 + 7.6, .35, 2, .4);
    }
  }
  private publicInterior(set: FilmSet): void {
    const { architecture: a, width: w, depth: d, height: h } = set;
    if (a === 'chateau') {
      // Two stair wings, a landing, balustrades and a weapons wall define the film's composition.
      for (const side of [-1, 1]) {
        for (let i = 0; i < 18; i++) {
          const x = side * (14 + i * .65); const z = -4 - i * 1.45; const y = i * .55;
          this.box(this.marble, x, y / 2, z, 10, y + .5, 1.6, .04);
          for (const edge of [-4.6, 4.6]) { this.cylinder(this.marble, x + edge, y + 1.7, z, .14, 2.7); this.sphere(this.marble, x + edge, y + 3.1, z, .22); }
        }
        this.pipe([[side * 9.4, 3.3, -4], [side * 15, 8, -16], [side * 20.5, 12.6, -29]], .19, this.wood);
      }
      this.box(this.marble, 0, 9.5, -d / 2 + 7, w - 4, 1, 12, .1);
      this.box(this.mat(0x745744), 0, 16, -d / 2 + .5, 16, 12, .2);
      // A geometric terrazzo inlay and classical busts distinguish the hall from a generic lobby.
      const inlay = this.mat(0x47483d, .3);
      for (const radius of [6, 6.4, 11, 11.4]) this.mesh(new THREE.TorusGeometry(radius, .06, 6, 80), inlay, 0, .065, 3).rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) { const theta = i * Math.PI / 4; this.box(inlay, Math.sin(theta) * 8.5, .065, 3 + Math.cos(theta) * 8.5, .12, .025, 5).rotation.y = theta; }
      for (const x of [-27, 27]) for (const z of [7, 25]) {
        this.box(this.marble, x, 2, z, 2.8, 4, 2.8, .06); this.cylinder(this.marble, x, 4.8, z, .9, 1.5, 1.4);
        const head = this.sphere(this.marble, x, 6.3, z, 1); head.scale.set(.8, 1.25, .8); this.sphere(this.marble, x, 6.15, z + .7, .2);
        this.box(this.marble, x, 5.25, z, 2.6, .5, 1.6, .2);
      }
      for (const side of [-1, 1]) for (let z = 4; z < d / 2 - 5; z += 10) {
        const x = side * (w / 2 - .8); this.box(this.wood, x, 6, z, .4, 10, 6.5);
        this.pipe([[x - side * .4, 3, z - 2], [x - side * .4, 9, z + 2]], .09, this.metal);
        this.pipe([[x - side * .5, 3, z + 2], [x - side * .5, 9, z - 2]], .09, this.metal);
      }
      for (const z of [7, 24]) { this.cylinder(this.brass, 0, h - 3, z, 3, .3); for (let i = 0; i < 10; i++) this.lamp(Math.sin(i * Math.PI / 5) * 3, h - 3, z + Math.cos(i * Math.PI / 5) * 3); }
    } else if (a === 'restaurant') {
      const cloth = this.mat(0xe1ddd0, .9);
      for (const x of [-w * .29, w * .29]) for (let z = -d / 2 + 12; z < d / 2 - 8; z += 15) {
        this.table(x, z, 9, 5, cloth); for (const dz of [-4, 4]) this.chair(x, z + dz, dz > 0 ? Math.PI : 0, true);
        for (const dx of [-2.7, 2.7]) {
          this.cylinder(this.white, x + dx, 2.83, z, 1, .08); this.cylinder(this.glass, x + dx, 3.3, z - 1.6, .25, .65);
          this.cylinder(this.brass, x + dx, 2.95, z - 1.6, .04, .3); this.cylinder(this.white, x + dx, 2.83, z - 1.6, .22, .03);
        }
        this.cylinder(this.brass, x, 3.5, z, .16, 1.6); this.sphere(this.glow, x, 4.3, z, .1);
      }
      this.table(0, -d / 2 + 10, 12, 5, cloth); this.chair(0, -d / 2 + 6, 0, true);
      for (const x of [-w / 2 + 1, w / 2 - 1]) this.box(this.mat(0x42382f), x, h * .65, 0, .4, h * .65, d - 6);
      this.label(set.id.includes('le_vrai') ? 'LE VRAI' : 'FORTY ONE', 0, h - 3, -d / 2 + .6, 12, '#d5bd88', '#27312d');
    } else {
      const red = this.mat(a === 'hel' ? 0x492325 : 0x242c2c, .8);
      for (const side of [-1, 1]) for (let z = -d / 2 + 8; z < d / 2 - 4; z += 13) {
        this.box(red, side * (w / 2 - 2), h / 2, z, 3, h - 1, 9, .2); this.lamp(side * (w / 2 - 4), 8, z, true);
      }
      this.table(-w / 2 + 7, 8, 8, d * .4, this.mat(0x242a29), 3.8);
      for (let i = 0; i < 12; i++) this.cylinder(this.mat(i % 2 ? 0x293e32 : 0x51362b, .2), -w / 2 + 7, 4.4, -8 + i * 2.1, .23, 1.1, .12);
      for (const x of [-w * .3, w * .3]) { this.box(this.black, x, 4, -d / 2 + 4, 4, 8, 3, .1); for (const y of [2.2, 5.4]) this.cylinder(this.mat(0x363b37), x, y, -d / 2 + 5.6, 1.3, .12).rotation.x = Math.PI / 2; }
      if (a === 'hel') { for (let i = 0; i < 7; i++) this.box(this.marble, 0, i * .3, -d / 2 + 9 - i, 26, .5, 1.2); for (const x of [-7, 0, 7]) this.chair(x, -d / 2 + 3, 0, true); }
      const light = new THREE.PointLight(a === 'hel' ? 0xb22324 : 0x2855b3, 1100, 70); light.position.set(0, 9, -12); this.root.add(light);
      this.label(a === 'hel' ? 'HEL' : 'EXIT', 0, h - 2, -d / 2 + .5, 7, '#c59878', '#201513');
    }
  }
  private station(set: FilmSet): void {
    const { width: w, depth: d, height: h } = set; const mobil = set.architecture === 'mobil';
    const tile = this.mat(mobil ? 0xd0d7d2 : 0x839c92, .35); const border = this.mat(mobil ? 0x313d3b : 0x526a60, .4);
    for (const side of [-1, 1]) for (let z = -d / 2; z < d / 2; z += 3.5) {
      this.box(tile, side * (w / 2 - .45), h / 2, z, .15, h - .6, 3.44);
      for (let y = .4; y < h; y += 1) this.box(border, side * (w / 2 - .55), y, z, .02, .025, 3.5);
    }
    for (const z of [-d / 2 + 9, -5, d / 2 - 12]) {
      this.label(mobil ? 'MOBIL AVE' : 'SUBWAY / PLATFORM 1', 0, h - 3.4, z, 14, mobil ? '#202626' : '#d9dfc5', mobil ? '#daddd3' : '#263831');
      this.table(-9, z + 3, 10, 2, this.wood, 1.4); this.box(this.wood, -9, 2.5, z + 2.2, 10, 1.8, .25);
      for (const x of [-w * .32, w * .32]) for (const y of [2, 4, 6, 8, 10]) this.sphere(this.metal, x, y, z + .94, .09);
    }
    const trackX = w * .43;
    this.box(this.black, trackX, .02, 0, 4.5, .12, d);
    for (const dx of [-1.7, 1.7]) this.box(this.metal, trackX + dx, .21, 0, .14, .22, d);
    for (let z = -d / 2; z < d / 2; z += 2.5) this.box(this.wood, trackX, .13, z, 4.2, .2, .35);
    this.box(this.mat(0xbeb67c), trackX - 3, .07, 0, .6, .07, d);
    this.phone(-7, -d / 2 + 1);
    if (mobil) {
      for (const side of [-1, 1]) {
        this.box(this.black, 0, 5.4, side * (d / 2 - .42), 8, 10.8, .08);
        for (const x of [-4.2, 4.2]) this.box(border, x, 5.5, side * (d / 2 - 3), .35, 11, 5.3);
        this.box(border, 0, 11, side * (d / 2 - 3), 8.6, .3, 5.3);
        this.box(this.black, 0, .04, side * (d / 2 - 3), 8, .06, 5.3);
      }
    }
    // The moving train stays beyond the walkable platform aisle.
    const start = this.root.children.length; this.box(this.metal, 0, 3.4, 0, 4, 6, 35, .5);
    for (let z = -13; z <= 13; z += 5) { this.box(this.black, -2.02, 4, z, .06, 2.5, 3.3); this.box(this.glass, -2.06, 4, z, .03, 2.3, 3.1); }
    const train = new THREE.Group(); this.root.children.slice(start).forEach(c => train.add(c)); train.position.x = trackX; train.userData.dynamic = true; this.root.add(train);
    this.moving.push({ object: train, update: t => { train.position.z = ((t * 11) % (d + 90)) - d / 2 - 45; } });
    if (!mobil) for (let z = -d / 2; z < d / 2; z += 13) {
      const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.absellipse(0, 0, w / 2, 7, Math.PI, 0, true, 0); shape.lineTo(w / 2, .6); shape.absellipse(0, .6, w / 2 + .6, 7.6, 0, Math.PI, false, 0); shape.closePath();
      this.mesh(new THREE.ExtrudeGeometry(shape, { depth: .4, bevelEnabled: false, curveSegments: 24 }), border, 0, h - 7.6, z);
    }
  }
  private realWorld(set: FilmSet): void {
    const { architecture: a, width: w, depth: d, height: h } = set;
    if (a === 'ship' || a === 'engineering') {
      for (let z = -d / 2 + 5; z < d / 2; z += 10) {
        this.pipe([[-w / 2 + 1, 0, z], [-w / 2 + 2, h - 4, z], [-w / 2 + 6, h - 1, z], [w / 2 - 6, h - 1, z], [w / 2 - 2, h - 4, z], [w / 2 - 1, 0, z]], .3);
        for (const x of [-w * .4, w * .4]) this.box(this.black, x, .06, z, 4, .12, 9.9);
      }
      for (const x of [-w / 2 + 2, w / 2 - 2]) for (let i = 0; i < 4; i++) this.pipe([[x, 4 + i * 1.4, -d / 2], [x, 4 + i * 1.4, d / 2]], .18 + i * .035, i % 2 ? this.brass : this.metal);
      const logistics = set.id.includes('logos'); const hammer = set.id.includes('hammer');
      if (a === 'ship') {
        for (const x of logistics ? [-6, 6] : [-12, 12]) for (const z of logistics ? [-d / 2 + 14] : [-14, 8, 28]) {
          this.chair(x, z, 0); this.box(this.black, x, 1.3, z + 2.5, 3, .5, 5, .2).rotation.x = -.25;
          this.pipe([[x, 4, z - 1], [x, 7, z - 2], [x + 2, h - 2, z - 5], [w / 2 - 3, h - 2, z - 5]], .08, this.black);
        }
        this.table(0, -d / 2 + 8, 14, 5, this.metal); for (const x of [-4.6, 0, 4.6]) this.crt(x, 4.2, -d / 2 + 8, 1.1, hammer);
        if (logistics) { this.window(0, 9, -d / 2 + .5, w - 7, 9); for (const x of [-w / 2 + 5, w / 2 - 5]) for (const z of [9, 22]) this.box(this.metal, x, 2.1, z, 6, 4.2, 7, .15); }
        if (hammer) for (const x of [-10, 10]) { this.table(x, -25, 4, 9, this.white, 2); this.crt(x + 3, 5, -28, .8, true); }
        if (set.id.includes('wreck')) { for (let i = 0; i < 7; i++) this.box(this.metal, -15 + i * 5, 4, -20 + i % 2 * 7, .4, 15, .4).rotation.z = -.6 + i * .2; this.lamp(10, 4, -16); }
        this.label(logistics ? 'LOGOS' : hammer ? 'HAMMER / MJÖLNIR' : 'NEBUCHADNEZZAR', 0, h - 2, -d / 2 + .5, 17, '#bbb9a3', '#29302d');
      } else {
        for (const x of [-w * .31, w * .31]) for (let z = -d / 2 + 8; z < d / 2; z += 17) {
          this.cylinder(this.metal, x, 5, z, 3, 10); this.pipe([[x, 10, z], [x, 13, z - 4], [x / 2, 13, z - 4]], .65);
          this.mesh(new THREE.TorusGeometry(1, .12, 8, 24), this.brass, x, 4.5, z + 3.1);
        }
      }
    } else if (a === 'zion' || a === 'temple') {
      const rock = this.pbr('damaged_plaster', 0x8e7760, 8);
      for (let i = 0; i < 36; i++) {
        const theta = i / 36 * Math.PI * 2; const r = Math.cos(theta) * w * .51; const z = Math.sin(theta) * d * .51;
        const stone = this.mesh(new THREE.DodecahedronGeometry(1, 1), rock, r, h * .5, z); stone.scale.set(7 + i % 4, h * .62, 8 + i % 3); stone.rotation.y = i;
      }
      if (a === 'temple') {
        for (let i = 0; i < 9; i++) this.box(rock, 0, i * .35, -d / 2 + 8 + i * 1.5, 42 - i, .8, 2);
        for (const x of [-w * .34, w * .34]) for (const z of [-d * .3, 0, d * .3]) { this.cylinder(this.black, x, 2.2, z, 1.8, 3, 2.2); this.sphere(this.glow, x, 4, z, .65); this.lamp(x, 5, z); }
      } else {
        for (const side of [-1, 1]) for (let y = 9; y < h - 7; y += 10) {
          this.box(this.metal, side * (w / 2 - 5), y, 0, 10, .6, d - 15);
          for (let z = -d / 2 + 10; z < d / 2 - 5; z += 4) this.cylinder(this.metal, side * (w / 2 - 10), y + 1.4, z, .06, 2.8);
          this.pipe([[side * (w / 2 - 10), y + 2.8, -d / 2 + 8], [side * (w / 2 - 10), y + 2.8, d / 2 - 8]], .08);
          if (set.id.includes('residences')) for (let z = -d / 2 + 13; z < d / 2 - 8; z += 14) this.lamp(side * (w / 2 - 6), y + 6, z);
        }
        this.box(this.metal, 0, h * .38, -d / 2 + 1, w * .4, h * .76, 1);
        this.label('GATE 03', 0, h * .55, -d / 2 + 1.6, 19, '#bd9f6c', '#262923');
        for (const side of [-1, 1]) { const x = side * w * .31; this.box(this.metal, x, 4, 5, 6, 6, 4, .7); for (const dx of [-2, 2]) { this.box(this.metal, x + dx, 1.5, 5, 1.4, 3, 2, .2); this.pipe([[x + dx, 5, 5], [x + dx * 2, 4, 3], [x + dx * 2, 5, 0]], .45); } this.crt(x, 6, 5, .6); }
      }
    } else if (a === 'pods') {
      const pod = new THREE.MeshPhysicalMaterial({ color: 0x944b42, transparent: true, opacity: .55, roughness: .22, side: THREE.DoubleSide, depthWrite: false }); this.materials.add(pod);
      for (const x of [-w * .4, w * .4]) for (let z = -d / 2; z <= d / 2; z += 14) {
        this.cylinder(this.metal, x, h / 2, z, 3, h);
        for (let y = 4; y < h; y += 7) { const shell = this.sphere(pod, x - Math.sign(x) * 4, y, z, 2.4); shell.scale.set(.9, .7, 1.7); this.pipe([[x, y + 1, z], [x - Math.sign(x) * 4, y + 2, z], [x - Math.sign(x) * 5, y, z + 1]], .2); this.sphere(this.glow, x, y, z + 3, .3); }
      }
      const shell = this.sphere(pod, 0, 1.6, -15, 4); shell.scale.set(1, .5, 1.8); for (let i = 0; i < 5; i++) this.pipe([[-4 + i * 2, 1, -15], [-8 + i * 3, 2, -22], [-w / 2, 3, -28 + i]], .16, this.black);
    } else {
      const gold = this.mat(0x947954, .34, .75);
      if (set.id.includes('above_clouds')) {
        const clouds = this.mat(0xeee7d6, 1); for (let i = 0; i < 35; i++) { const sphere = this.sphere(clouds, Math.sin(i * 7) * 90, -12 + Math.cos(i) * 3, Math.cos(i * 5) * 100, 10 + i % 6); sphere.scale.set(2, .5, 1.5); }
        this.box(this.metal, 0, .3, -4, 17, .8, 27, .2); this.window(0, 7, -19, 20, 12);
      } else {
        for (let i = 0; i < 45; i++) {
          const side = i % 2 ? 1 : -1; const x = side * (w * .3 + i % 4 * 5); const z = -d / 2 + (i * 17) % d; const height = 12 + (i * 11) % h;
          this.box(a === 'desert' ? this.plaster : this.metal, x, height / 2, z, 4 + i % 7, height, 5 + i % 4, .1);
          for (let y = 3; y < height; y += 5) this.box(gold, x, y, z + 3.4, 3, .13, .08);
        }
      }
      if (set.id.includes('machine_core')) {
        const light = new THREE.PointLight(0xffbb77, 16000, 180, 2); light.position.set(0, 25, -d / 2 + 40); this.root.add(light);
        const face = new THREE.Group(); const start = this.root.children.length;
        const skull = this.sphere(this.metal, 0, 20, -d / 2 + 7, 13); skull.scale.set(1, 1.2, .5);
        for (const x of [-5, 5]) { this.sphere(this.black, x, 23, -d / 2 + 14, 2.5).scale.set(1.3, .6, .6); this.sphere(this.glow, x, 23, -d / 2 + 15, 1).scale.set(1.6, .45, .2); }
        this.box(this.black, 0, 14, -d / 2 + 14, 9, 1.1, 1, .4); this.sphere(gold, 0, 19, -d / 2 + 15, 1.9).scale.set(.7, 1.6, 1);
        for (let i = 0; i < 170; i++) { const theta = i * 2.399; const r = Math.sqrt(i / 170) * 12; this.box(i % 7 === 0 ? this.glow : gold, Math.cos(theta) * r, 20 + Math.sin(theta) * r, -d / 2 + 14.2, .5, .45, .8).rotation.z = theta; }
        this.root.children.slice(start).forEach(c => face.add(c)); this.root.add(face);
      }
    }
  }
  private transport(set: FilmSet): void {
    const { architecture: a, width: w, depth: d } = set;
    if (a === 'rooftop') {
      for (const side of [-1, 1]) this.box(this.plaster, side * (w / 2 - .5), 1.7, 0, .7, 3.4, d);
      for (const z of [-d / 2 + .5, d / 2 - .5]) this.box(this.plaster, 0, 1.7, z, w, 3.4, .7);
      for (const x of [-w * .34, w * .34]) for (const z of [-d * .26, d * .23]) {
        this.box(this.metal, x, 2.2, z, 6, 4.4, 8, .1); for (let i = 0; i < 7; i++) this.box(this.black, x, 4.45, z - 2.7 + i * .8, 5, .06, .3);
        this.cylinder(this.metal, x, 5.4, z + 2, 1.1, 2); this.cylinder(this.metal, x, 6.4, z + 2, 1.5, .3);
      }
      if (set.id.includes('government_roof')) {
        this.mesh(new THREE.TorusGeometry(11, .14, 8, 64), this.white, 0, .05, -15).rotation.x = Math.PI / 2;
        const hull = this.sphere(this.black, 12, 4, -22, 4); hull.scale.set(1, 1, 2.2); this.sphere(this.glass, 12, 4.7, -28, 3.2).scale.set(1, 1, .7);
        this.box(this.metal, 12, 8.2, -22, .2, 1.6, .2); this.box(this.black, 12, 9, -22, 24, .18, .8); this.box(this.black, 12, 9.2, -22, .8, .18, 24);
        this.pipe([[12, 4, -16], [12, 4.5, -7], [12, 6, -3]], .5); for (const x of [9, 15]) this.pipe([[x, 2, -29], [x, .8, -26], [x, .8, -16]], .17);
      }
      if (set.id.includes('office_ledge')) { this.box(this.black, -w / 2, 18, 0, 1, 36, d); for (let z = -d / 2 + 5; z < d / 2; z += 10) this.window(-w / 2 + 1, 12, z, 9, 18, true); }
    } else if (a === 'car') {
      this.car(0, -6); this.chair(-7, 2, Math.PI / 2); this.chair(7, 2, -Math.PI / 2); this.crt(6, 3.5, -7, .65);
      for (const side of [-1, 1]) this.window(side * (w / 2 - 1), 6, 0, d - 6, 6, true);
    } else {
      const road = this.mat(a === 'rain' ? 0x263b3c : 0x333d3e, a === 'rain' ? .16 : .83, a === 'rain' ? .35 : .08);
      this.box(road, 0, .01, 0, a === 'garage' ? w : w * .58, .1, d);
      for (const x of [-w * .19, w * .19]) for (let z = -d / 2; z < d / 2; z += 12) this.box(this.mat(0xb5b4a0), x, .08, z, .18, .04, 5);
      if (a === 'freeway') {
        for (const side of [-1, 1]) { this.box(this.metal, side * w * .39, 2, 0, .5, 1, d); for (let z = -d / 2; z < d / 2; z += 8) this.box(this.metal, side * w * .39, 1, z, .25, 2, .3); }
        for (const z of [-45, 10, 60]) { this.car(-15, z, 0x687773, true); this.car(15, z + 14, 0x292f2e); }
        this.label('101 NORTH / DOWNTOWN', 0, 16, -d / 2 + 10, 27, '#e0dfcc', '#345a46'); for (const x of [-w / 2 + 2, w / 2 - 2]) this.box(this.metal, x, 8, -d / 2 + 10, .6, 16, .6);
      } else if (a === 'bridge') {
        this.box(this.plaster, 0, 19, -15, w + 25, 6, 20); for (const x of [-w / 2 + 3, w / 2 - 3]) this.box(this.plaster, x, 8, -15, 5, 18, 12, .1); this.car(0, -19);
      } else if (a === 'garage') { this.car(-15, -14); this.car(15, 15, 0x606b66); this.label('EXIT →', 0, 10, -d / 2 + .5, 10); }
      else {
        for (const x of [-w * .34, w * .34]) { this.box(this.marble, x, .2, 0, w * .15, .45, d); for (let z = -d / 2 + 8; z < d / 2; z += 23) { this.cylinder(this.metal, x, 7, z, .14, 14); this.lamp(x, 14, z, false); } }
        if (a !== 'rain') this.phone(0, -d * .32, true);
        if (set.id.includes('wells')) this.car(12, -10, 0x555e58, true);
        if (a === 'rain') {
          // Repeated silhouettes read as the occupied avenue without adding hundreds of animated rigs.
          for (const x of [-w * .31, w * .31]) for (let z = -d / 2 + 5; z < d / 2; z += 4.2) {
            this.box(this.black, x, 2.3, z, 1.35, 2.8, .75, .2); this.sphere(this.mat(0x9f9986), x, 4.25, z, .5);
            for (const dx of [-.35, .35]) this.box(this.black, x + dx, .75, z, .4, 1.5, .6, .1);
            this.box(this.black, x, 4.36, z + (x < 0 ? 0 : .44), .7, .16, .06);
          }
          this.mesh(new THREE.TorusGeometry(10, .6, 8, 48), this.plaster, 0, .18, -45).rotation.x = Math.PI / 2;
        }
      }
    }
  }
  private special(set: FilmSet): void {
    const { architecture: a, width: w, depth: d, height: h } = set;
    if (a === 'dojo' || a === 'teahouse') {
      const tatami = this.mat(0x9b9874, 1); const trim = this.mat(0x474c3b);
      for (let x = -w / 2 + 4; x < w / 2; x += 8) for (let z = -d / 2 + 4; z < d / 2; z += 8) { this.box(tatami, x, .04, z, 7.8, .08, 7.8); this.box(trim, x - 3.7, .1, z, .2, .02, 7.8); }
      for (const side of [-1, 1]) for (let z = -d / 2 + 5; z < d / 2; z += 10) {
        this.box(this.white, side * (w / 2 - .6), 6, z, .2, 10, 9.5);
        for (let y = 1; y <= 11; y += 2) this.box(this.wood, side * (w / 2 - .8), y, z, .3, .09, 10);
        for (const dz of [-4.8, -2.4, 0, 2.4, 4.8]) this.box(this.wood, side * (w / 2 - .8), 6, z + dz, .3, 10, .1);
      }
      for (let x = -w / 2 + 1; x < w / 2; x += 8) {
        this.box(this.wood, x, 6, -d / 2 + .6, .35, 12, .5);
        for (const y of [1, 3, 5, 7, 9, 11]) this.box(this.wood, x + 3.8, y, -d / 2 + .6, 7.6, .1, .3);
      }
      for (const side of [-1, 1]) for (let z = -d / 2 + 1; z < d / 2; z += 10) this.box(this.wood, side * (w / 2 - .9), h / 2, z, .5, h, .6);
      this.box(this.wood, 0, 12, -d / 2 + .6, w, .5, .6);
      if (a === 'teahouse') this.label('茶', 0, 13.5, -d / 2 + .5, 3, '#20281c', '#cac7a9');
      if (a === 'teahouse') for (const x of [-15, 15]) for (const z of [-16, 0, 16]) { this.table(x, z, 7, 5); this.chair(x, z + 4, Math.PI); this.chair(x, z - 4); this.sphere(this.mat(0x765843), x, 3.2, z, .55); this.cylinder(this.white, x + 1.2, 2.95, z, .25, .35); }
    } else if (a === 'construct') {
      this.box(this.white, 0, -.6, 0, w * 3, .5, d * 3); this.loungeChair(-5, -10, -.2); this.loungeChair(5, -10, .2); this.crt(0, 3.1, -18, 2);
      if (this.currentScene === 'm1_guns') for (const x of [-w * .36, w * .36]) for (const z of [-22, 0, 22]) { this.box(this.metal, x, 3.3, z, 5, 6.6, 1); for (let i = 0; i < 5; i++) { this.box(this.black, x - 2 + i, 4.2, z + .6, .25, 3.1, .35); this.box(this.black, x - 2 + i, 2.8, z + .6, .55, .8, .4); } }
    } else {
      if (a === 'garden' || a === 'plaza') {
        const water = new THREE.MeshPhysicalMaterial({ color: a === 'garden' ? 0x608b94 : 0x588578, roughness: .13, metalness: .45, clearcoat: 1 }); this.materials.add(water);
        if (a === 'plaza') { this.cylinder(this.marble, 12, .4, 2, 9, .8); this.cylinder(water, 12, .87, 2, 8.5, .08); this.cylinder(this.marble, 12, 2, 2, 2, 3, 1.7); this.sphere(water, 12, 3.6, 2, 2.5).scale.y = .17; }
        else { this.box(water, w * .28, .05, -d * .15, w * .33, .1, d * .7, .1); this.box(this.marble, w * .1, .15, -d * .15, .5, .4, d * .72); }
      }
      const leaf = this.mat(a === 'garden' ? 0x496e42 : 0x465a3f, .9);
      for (const x of [-w * .36, w * .36]) for (let z = -d / 2 + 10; z < d / 2; z += 20) {
        this.cylinder(this.wood, x, 4.5, z, .5, 9, .28);
        for (let i = 0; i < 8; i++) { const sphere = this.sphere(leaf, x + Math.sin(i * 4) * 2.8, 10 + i % 3, z + Math.cos(i * 3) * 2.5, 2.6); sphere.scale.y = 1.2; }
      }
      for (const z of [-20, 14]) { this.table(-9, z, 10, 2.4, this.wood, 1.5); this.box(this.wood, -9, 2.6, z - .9, 10, 2, .2); for (const x of [-14, -4]) this.pipe([[x, 0, z - 1], [x, 3, z - 1], [x, 2.3, z + 1]], .08); }
      if (a === 'courtyard') {
        this.box(this.plaster, 0, 4, -d / 2 + 2, 10, 7, .3); this.box(this.white, 0, 10, -d / 2 + 3, 7, 4, .25); this.mesh(new THREE.TorusGeometry(1, .06, 8, 24), this.brass, 0, 8.2, -d / 2 + 4).rotation.x = Math.PI / 2;
        for (const x of [-w / 2 + 3, w / 2 - 3]) { this.box(this.black, x, 5, 0, .2, 10, d - 5); for (let z = -d / 2; z < d / 2; z += 2) this.cylinder(this.metal, x, 5, z, .08, 10); }
      }
    }
  }
  private skyline(set: FilmSet): void {
    const windows = this.mat(set.light === 'night' || set.light === 'storm' ? 0x6f837a : 0x5a737a, .25, .3);
    for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
      const x = side * (set.width / 2 + 12 + i % 2 * 9); const z = -set.depth / 2 - 5 + i * (set.depth + 20) / 9; const height = 30 + (i * 17 + set.id.length * 3) % 50;
      this.box(this.plaster, x, height / 2, z, 19, height, 15);
      for (let y = 6; y < height - 3; y += 5) for (const dz of [-4.8, 0, 4.8]) {
        this.box(windows, x - side * 9.56, y, z + dz, .08, 3.2, 2.8); this.box(this.white, x - side * 9.66, y - 1.8, z + dz, .35, .2, 3.3);
      }
      this.box(this.white, x, height, z, 20, .5, 16); this.box(this.black, x - side * 9.6, 2.8, z, .1, 5.6, 4.8);
    }
  }
  private batch(): void {
    this.root.updateMatrixWorld(true);
    const inverse = this.root.matrixWorld.clone().invert(); const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const remove: THREE.Object3D[] = [];
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      let ancestor: THREE.Object3D | null = object; while (ancestor && ancestor !== this.root) { if (ancestor.userData.dynamic) return; ancestor = ancestor.parent; }
      const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
      if (normalized !== geometry) geometry.dispose();
      // All generated mesh primitives carry position, normal and uv. Extraneous attributes are not needed.
      for (const name of Object.keys(normalized.attributes)) if (!['position', 'normal', 'uv'].includes(name)) normalized.deleteAttribute(name);
      const list = batches.get(object.material) ?? []; list.push(normalized); batches.set(object.material, list); remove.push(object);
    });
    for (const object of remove) object.removeFromParent();
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (!geometry) throw new Error('Film set geometry could not be merged');
      const mesh = new THREE.Mesh(this.own(geometry), material); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    }
    const live = new Set<THREE.BufferGeometry>(); this.root.traverse(object => { if (object instanceof THREE.Mesh) live.add(object.geometry); });
    for (const geometry of this.geometries) if (!live.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
  }
  private clear(): void {
    this.club?.dispose(); this.club = undefined;
    this.apartment?.dispose(); this.apartment = undefined;
    this.approach?.renderer.dispose(); this.approach = undefined;
    this.hotel?.dispose(); this.hotel = undefined;
    this.meeting?.dispose(); this.meeting = undefined;
    this.interrogation?.dispose(); this.interrogation = undefined;
    this.pillGlass = undefined;
    this.ambush?.dispose(); this.ambush = undefined;
    this.oracleVase?.dispose(); this.oracleVase = undefined;
    this.mirror?.dispose(); this.mirror = undefined; this.mirrorCracks = undefined;
    this.pods?.dispose(); this.pods = undefined;
    this.neb?.dispose(); this.neb = undefined;
    this.construct?.dispose(); this.construct = undefined;
    this.desert?.dispose(); this.desert = undefined;
    this.training?.dispose(); this.training = undefined;
    this.sentinel?.dispose(); this.sentinel = undefined;
    this.restaurant?.dispose(); this.restaurant = undefined;
    this.office?.dispose(); this.office = undefined;
    this.freeway?.dispose(); this.freeway = undefined;
    this.lobby?.dispose(); this.lobby = undefined;
    this.root.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose(); });
    this.root.clear(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.materialCache.clear(); this.moving = [];
  }
  dispose(): void { this.clear(); this.root.removeFromParent(); this.marker.removeFromParent(); this.markerLight.removeFromParent(); this.marker.geometry.dispose(); (this.marker.material as THREE.Material).dispose(); this.markerLight.dispose(); }
}
