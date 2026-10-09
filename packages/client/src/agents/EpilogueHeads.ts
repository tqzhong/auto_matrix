import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { streetResetPose, upperDiggerFall } from '@auto_matrix/shared';
import type { CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';

interface HeadEntry {
  role: 'oracle' | 'sati' | 'zee' | 'charra' | 'niobe' | 'lock' | 'roland' | 'architect' | 'seraph' | 'keymaker' | 'rama_kandra' | 'kamala' | 'trainman';
  fallback: THREE.Group;
  model?: THREE.Group;
  face?: THREE.Mesh;
  eyes?: THREE.Group;
  closed: { value: number };
  loading: boolean;
  active: boolean;
  neck?: THREE.Object3D;
}

/** Detailed heads retain the existing performance joints and saved body poses. */
export class EpilogueHeads {
  private entries = new Map<CharacterRig, HeadEntry>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private disposed = false;

  track(rig: CharacterRig, role: HeadEntry['role']): void {
    const fallback = new THREE.Group(); fallback.name = `${role}-fallback-head`;
    fallback.add(...rig.head.children); rig.head.add(fallback);
    this.entries.set(rig, { role, fallback, closed: { value: 0 }, loading: false, active: false, neck: rig.root.getObjectByName(`${role}-neck`) });
  }

  update(rig: CharacterRig, input: MotionInput): void {
    const entry = this.entries.get(rig); if (!entry) return;
    // Mary Alice's appearance belongs to Revolutions. Earlier Oracle scenes
    // retain their existing head until their own likeness asset is authored.
    entry.active = entry.role === 'niobe' ? Boolean(input.realWorld) : entry.role !== 'oracle' || Boolean(input.oracleRevolutions || input.oracleRequest?.role === 'oracle' || input.oracleLast?.role === 'oracle' || input.oracleRestored || input.parkOutfit || input.epilogue?.kind === 'dawn');
    entry.closed.value = input.oracleRestored ? 1 : entry.role === 'sati' && input.epilogue?.kind === 'reset' ? streetResetPose(input.epilogue).closedEyes
      : entry.role === 'charra' && input.upperDigger ? upperDiggerFall(input.upperDigger) : 0;
    if (entry.active && !entry.loading) {
      entry.loading = true;
      this.load(rig, entry).catch(error => console.warn(`${entry.role} detailed head could not load; retaining its fallback.`, error));
    }
    const visible = entry.active && Boolean(entry.model);
    if (entry.fallback.visible === visible) rig.head.userData.surfaceVersion = (rig.head.userData.surfaceVersion ?? 0) + 1;
    entry.fallback.visible = !visible;
    if (entry.neck) entry.neck.visible = !visible;
    if (entry.model) entry.model.visible = visible;
    if (entry.face?.morphTargetInfluences) entry.face.morphTargetInfluences[0] = entry.closed.value;
    if (entry.eyes) entry.eyes.visible = entry.closed.value < .98;
  }

  private async load(rig: CharacterRig, entry: HeadEntry): Promise<void> {
    const role = entry.role === 'oracle' ? 'oracle-revolutions' : entry.role;
    const asset = await new GLTFLoader().loadAsync(`/assets/characters/${role}-head.glb`);
    const model = asset.scene, face = model.getObjectByName(`${role}-anatomical-head`) as THREE.Mesh;
    const metadata = asset.parser.json.extras;
    const row = metadata.atlasRow ?? (entry.role === 'sati' ? 1 : 0);
    model.name = `${role}-detailed-head`;
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry); object.castShadow = object.receiveShadow = true;
      const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
      if (material.map) { material.map.anisotropy = 8; this.textures.add(material.map); }
    });
    const material = face.material as THREE.MeshStandardMaterial;
    const digger = entry.role === 'zee' || entry.role === 'charra';
    const captain = ['niobe', 'lock', 'roland'].includes(entry.role);
    const program = entry.role === 'architect' || entry.role === 'seraph' || entry.role === 'keymaker' || entry.role === 'rama_kandra' || entry.role === 'kamala' || entry.role === 'trainman';
    const atlas = metadata.atlasSize ?? [1254, 1254], origin = metadata.profileOrigin ?? [627, row * 627];
    const neck = metadata.neckSample ?? [.25, .445 + row * .5], cheek = metadata.cheekSample ?? [.697, .305 + row * .5];
    const ear = metadata.profileEar ?? (digger ? [395, 300] : [365, 323]), eye = metadata.profileEye ?? [151, 267];
    material.onBeforeCompile = shader => {
      shader.uniforms.headSkin = { value: new THREE.Color().fromArray(metadata.skinColor) };
      shader.uniforms.eyesClosed = entry.closed;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        attribute float _face_weight;
        #ifndef USE_UV1
          attribute vec2 uv1;
        #endif
        varying vec2 vProfileUv;
        varying vec3 vHeadNormal;
        varying float vFaceWeight;
        varying vec3 vHeadRest;`).replace('#include <begin_vertex>', `#include <begin_vertex>
        vFaceWeight = _face_weight; vHeadRest = position; vProfileUv = uv1; vHeadNormal = normal;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform vec3 headSkin; uniform float eyesClosed;
        varying float vFaceWeight; varying vec3 vHeadRest; varying vec2 vProfileUv; varying vec3 vHeadNormal;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 neckUv = vec2(${Number(neck[0]).toFixed(6)} + vHeadRest.x * .10, ${Number(neck[1]).toFixed(6)} + clamp(-vHeadRest.y - .30, 0.0, .2) * ${captain || program ? '.03' : '.12'});
          vec3 neckColor = texture2D(map, neckUv).rgb;
          float profileWeight = smoothstep(.20, .70, abs(vHeadNormal.x)) * smoothstep(-.28, -.16, vHeadRest.y);
          vec3 profileColor = texture2D(map, vProfileUv).rgb;
          vec2 profilePx = vProfileUv * vec2(${Number(atlas[0]).toFixed(1)}, ${Number(atlas[1]).toFixed(1)}) - vec2(${Number(origin[0]).toFixed(1)}, ${Number(origin[1]).toFixed(1)});
          // A projected reference ear/eye cannot also appear on the flat temple
          // beside the real anatomy. Use adjacent cheek detail in those regions.
          float photoEar = 1.0 - smoothstep(.75, 1.2, length((profilePx - vec2(${Number(ear[0]).toFixed(1)}, ${Number(ear[1]).toFixed(1)})) / vec2(65.0, 92.0)));
          float earSurface = smoothstep(${entry.role === 'sati' ? '.235, .263' : digger ? '.238, .258' : '.209, .234'}, abs(vHeadRest.x));
          float photoEye = (1.0 - smoothstep(.7, 1.3, length((profilePx - vec2(${Number(eye[0]).toFixed(1)}, ${Number(eye[1]).toFixed(1)})) / vec2(52.0, 37.0))))
            * smoothstep(.14, .18, abs(vHeadRest.x));
          vec3 cheek = texture2D(map, vec2(${Number(cheek[0]).toFixed(6)}, ${Number(cheek[1]).toFixed(6)})).rgb;
          profileColor = mix(profileColor, cheek, max(photoEar * (1.0 - earSurface), photoEye));
          ${digger ? `float repeatedFeatures = (1.0 - smoothstep(205.0, 255.0, profilePx.x))
            * smoothstep(.11, .16, abs(vHeadRest.x)) * smoothstep(-.32, -.27, vHeadRest.y)
            * (1.0 - smoothstep(.13, .20, vHeadRest.y));
          profileColor = mix(profileColor, cheek, repeatedFeatures);` : ''}
          // Profile registration must not paint the neutral backdrop onto
          // the nose edge, ear or the underside of the chin.
          float profileSkin = smoothstep(.035, .085, profileColor.r - profileColor.b)
            * smoothstep(.015, .045, profileColor.r - profileColor.g);
          float shortHair = (1.0 - smoothstep(.12, .24, max(profileColor.r, max(profileColor.g, profileColor.b))))
            * smoothstep(-.16, -.06, vHeadRest.y) * (1.0 - smoothstep(.08, .16, vHeadRest.z));
          profileWeight *= max(profileSkin, shortHair);
          vec3 sideColor = mix(neckColor, profileColor, profileWeight);
          ${digger ? 'sideColor = mix(sideColor, neckColor, smoothstep(.227, .247, abs(vHeadRest.x)) * (1.0 - smoothstep(-.01, .09, vHeadRest.y)));' : ''}
          diffuseColor.rgb = mix(sideColor, diffuseColor.rgb, vFaceWeight);
          float lid = (1.0 - smoothstep(.035, .060, abs(abs(vHeadRest.x) - ${Number(metadata.eye[0]).toFixed(6)})))
            * (1.0 - smoothstep(.012, .038, abs(vHeadRest.y))) * smoothstep(.12, .18, vHeadRest.z);
          diffuseColor.rgb = mix(diffuseColor.rgb, headSkin * .91, lid * eyesClosed);`);
    };
    material.customProgramCacheKey = () => `${role}-registered-head-v1`;
    entry.face = face;
    entry.eyes = new THREE.Group(); entry.eyes.name = `${role}-eyes`; model.add(entry.eyes);
    const sclera = this.material(new THREE.MeshPhysicalMaterial({ color: '#c6b9a7', roughness: .3, clearcoat: .3 }));
    const iris = this.material(new THREE.MeshStandardMaterial({ color: entry.role === 'roland' || entry.role === 'architect' || entry.role === 'trainman' ? '#536064' : '#352318', roughness: .48 }));
    const pupil = this.material(new THREE.MeshPhysicalMaterial({ color: '#080906', roughness: .19, clearcoat: .5 }));
    const sphere = this.geometry(new THREE.SphereGeometry(1, 24, 16));
    for (const side of [-1, 1]) {
      const [x, y, z] = metadata.eye as number[], r = metadata.eyeRadius as number;
      this.mesh(entry.eyes, sphere, sclera, [side * x, y, z], [r, r, r]);
      this.mesh(entry.eyes, sphere, iris, [side * x, y, z + r * .87], [r * .48, r * .48, r * .20]);
      this.mesh(entry.eyes, sphere, pupil, [side * x, y, z + r * 1.035], [r * .23, r * .23, r * .075]);
    }
    this.groom(model, face.geometry, entry.role);
    if (entry.role === 'keymaker') this.readingGlasses(model, metadata.eye[0]);
    if (this.disposed) { this.release(); return; }
    entry.model = model; model.visible = entry.active; entry.fallback.visible = !entry.active; rig.head.add(model);
    rig.head.userData.surfaceVersion = (rig.head.userData.surfaceVersion ?? 0) + 1;
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: number[], scale?: number[]): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.fromArray(position);
    if (scale) mesh.scale.fromArray(scale);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private groom(parent: THREE.Group, skin: THREE.BufferGeometry, role: HeadEntry['role']): void {
    const oracle = role === 'oracle', position = skin.attributes.position, normal = skin.attributes.normal, indices = skin.index!;
    const digger = role === 'zee' || role === 'charra', captain = ['niobe', 'lock', 'roland'].includes(role);
    const program = role === 'architect' || role === 'seraph' || role === 'keymaker' || role === 'rama_kandra' || role === 'kamala' || role === 'trainman';
    const vertices: number[] = [], normals: number[] = [], colors: number[] = [], uvs: number[] = [], triangles: number[] = [], roots: THREE.Vector3[] = [], directions: THREE.Vector3[] = [];
    const point = new THREE.Vector3(), direction = new THREE.Vector3();
    const boundary = (x: number, z: number) => {
      const front = Math.max(0, Math.cos(Math.atan2(x, z + .04)));
      const ear = Math.exp(-(((z + .045) / .24) ** 4)) * THREE.MathUtils.smoothstep(Math.abs(x), .10, .19);
      if (role === 'rama_kandra' || role === 'kamala' || role === 'trainman') return Math.max(-.20 + front * (role === 'rama_kandra' ? .51 : role === 'kamala' ? .405 : .40), -.20 + .29 * ear);
      if (program) return Math.max(-.20 + front * (role === 'architect' ? .45 : role === 'keymaker' ? .46 : .385)
        + (role === 'architect' || role === 'keymaker' ? .045 * Math.exp(-(((Math.abs(x) - .13) / .07) ** 2)) * front : 0), -.20 + .29 * ear);
      if (captain) return Math.max(-.20 + front * (role === 'roland' ? .39 : role === 'lock' ? .36 : .34)
        + (role === 'roland' ? .05 * Math.exp(-(((Math.abs(x) - .13) / .08) ** 2)) * front : 0), -.20 + .32 * ear);
      return role === 'zee' ? Math.max(-.13 + front * .27, -.13 + .20 * ear)
        : Math.max(-.22 + front * (oracle ? .39 : role === 'charra' ? .405 : .43), -.22 + .32 * ear);
    };
    for (let t = 0; t < indices.count; t += 3) {
      const ids = [indices.getX(t), indices.getX(t + 1), indices.getX(t + 2)];
      if (!digger && !captain && !program && ids.some(i => position.getY(i) < boundary(position.getX(i), position.getZ(i)))) continue;
      let polygon = ids.map(i => ({ point: new THREE.Vector3().fromBufferAttribute(position, i), normal: new THREE.Vector3().fromBufferAttribute(normal, i), tone: .65 + .35 * (.5 + .5 * Math.sin(i * 13.27)) }));
      if (digger || captain || program) {
        const clipped: typeof polygon = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + polygon.length - 1) % polygon.length];
          const da = a.point.y - boundary(a.point.x, a.point.z), db = b.point.y - boundary(b.point.x, b.point.z);
          if ((da >= 0) !== (db >= 0)) {
            const f = db / (db - da);
            clipped.push({ point: b.point.clone().lerp(a.point, f), normal: b.normal.clone().lerp(a.normal, f).normalize(), tone: 1 });
          }
          if (da >= 0) clipped.push(a);
        }
        polygon = clipped;
      }
      const start = vertices.length / 3;
      for (const vertex of polygon) {
        point.copy(vertex.point); direction.copy(vertex.normal);
        const curl = oracle ? .0025 * Math.sin(point.x * 200 + Math.sin(point.y * 180)) * Math.cos(point.z * 210)
          : role === 'zee' ? .003 * Math.sin(point.y * 180 + point.z * 35) : role === 'charra' ? .003 * Math.sin(point.x * 80 + point.z * 110) : role === 'keymaker' ? .002 * Math.sin(point.x * 140 + point.y * 60) : role === 'lock' ? .002 * Math.sin(point.y * 320 + point.x * 70) * Math.cos(point.z * 260) : 0;
        point.addScaledVector(direction, (oracle ? .035 + .025 * Math.max(0, -direction.z) : role === 'zee' ? .025 : role === 'charra' ? .016 : role === 'roland' ? .021 : role === 'architect' ? .010 : role === 'seraph' ? .018 : .009) + curl);
        vertices.push(...point.toArray()); normals.push(...direction.toArray());
        const tone = role === 'zee' ? .91 + .06 * Math.sin(point.y * 450) * Math.cos(point.z * 370) : vertex.tone; colors.push(tone, tone, tone);
        uvs.push((Math.atan2(point.x, point.z + .04) / Math.PI + 1) * 2, (point.y + .24) * 5);
        roots.push(point.clone()); directions.push(direction.clone());
      }
      for (let i = 1; i < polygon.length - 1; i++) triangles.push(start, start + i, start + i + 1);
    }
    const cap = this.geometry(new THREE.BufferGeometry()); cap.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    cap.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); cap.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    cap.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); cap.setIndex(triangles);
    const atlas = ((parent.getObjectByName(`${oracle ? 'oracle-revolutions' : role}-anatomical-head`) as THREE.Mesh).material as THREE.MeshStandardMaterial).map!;
    const scalp = captain || program ? this.material(new THREE.MeshPhysicalMaterial({ color: role === 'architect' ? '#d7d5ca' : role === 'trainman' ? '#625e50' : role === 'roland' ? '#37322d' : '#12100e', vertexColors: true, roughness: .96, specularIntensity: .15, side: THREE.DoubleSide }))
      : this.material(new THREE.MeshStandardMaterial({ map: role === 'zee' ? null : atlas, color: role === 'zee' ? '#686c62' : '#ffffff', vertexColors: true, roughness: oracle ? .84 : role === 'zee' ? .94 : .7, side: THREE.DoubleSide }));
    scalp.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
        vec2 hairUv = vec2(${oracle ? '.766, .078' : role === 'charra' ? '.82, .545' : '.81, .57'}) + (1.0 - abs(fract(vMapUv * .5) * 2.0 - 1.0)) * vec2(${oracle ? '.14, .14' : role === 'charra' ? '.08, .07' : '.10, .12'});
        diffuseColor *= texture2D(map, hairUv);
      #endif`);
    };
    scalp.customProgramCacheKey = () => `${role}-scalp-detail-v1`;
    this.mesh(parent, cap, scalp, [0, 0, 0]).name = role === 'zee' ? 'zee-cloth-headwrap' : `${role}-hair-scalp`;
    if (role === 'zee') { this.headwrapTies(parent); return; }
    if (role === 'niobe') {
      const knots: THREE.BufferGeometry[] = [];
      for (const [angle, height] of [[0, .33], [-.8, .25], [.8, .25], [-1.6, .09], [1.6, .09], [-2.2, .17], [2.2, .17], [Math.PI, .31]]) {
        const target = new THREE.Vector3(Math.sin(angle) * .22, height, Math.cos(angle) * .21 - .06);
        let index = 0, nearest = Infinity;
        roots.forEach((root, i) => { const distance = root.distanceToSquared(target); if (distance < nearest) { nearest = distance; index = i; } });
        const knot = new THREE.SphereGeometry(.045, 20, 14); knot.scale(1, .9, 1); knot.translate(...roots[index].clone().addScaledVector(directions[index], .026).toArray()); knots.push(knot);
      }
      const geometry = this.geometry(mergeGeometries(knots)!); knots.forEach(knot => knot.dispose());
      this.mesh(parent, geometry, this.material(new THREE.MeshPhysicalMaterial({ color: '#12100e', roughness: .95, specularIntensity: .15 })), [0, 0, 0]).name = 'niobe-bantu-knots';
    }
    const hair = this.material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide }));
    const strands: number[] = [], strandColors: number[] = [], strandIndices: number[] = [];
    for (let strand = 0; strand < (role === 'charra' ? 900 : 1600); strand++) {
      const index = (strand * 7919) % roots.length, root = roots[index], outward = directions[index];
      const sweep = new THREE.Vector3(Math.sign(root.x) * .22, .3, -1).addScaledVector(outward, -new THREE.Vector3(Math.sign(root.x) * .22, .3, -1).dot(outward)).normalize();
      const across = new THREE.Vector3().crossVectors(outward, sweep).normalize();
      const length = role === 'lock' || role === 'niobe' ? .006 + (strand % 5) * .001 : oracle ? .012 + (strand % 7) * .003 : .015 + (strand % 11) * .002;
      const silver = oracle && strand % 7 === 0 || role === 'roland' && (Math.abs(root.x) > .15 || strand % 3 === 0) || role === 'keymaker' && strand % 6 === 0, tone = role === 'architect' ? .45 + (strand % 7) * .045 : silver ? .09 + (strand % 4) * .02 : oracle ? .016 : role === 'charra' ? .019 + (strand % 4) * .004 : .005;
      const start = strands.length / 3;
      for (let j = 0; j <= 5; j++) {
        const f = j / 5, curl = oracle ? Math.sin(f * Math.PI * 3 + strand) * .0018 : Math.sin(f * Math.PI) * .0006;
        const center = root.clone().addScaledVector(sweep, f * length).addScaledVector(outward, .001 + Math.sin(f * Math.PI) * .002).addScaledVector(across, curl);
        for (const side of [-1, 1]) {
          const p = center.clone().addScaledVector(across, side * .0006 * (1 - f * .85)); strands.push(...p.toArray());
          strandColors.push(tone, tone * .94, tone * .87);
        }
        if (j) { const a = start + (j - 1) * 2; strandIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    }
    const groom = this.geometry(new THREE.BufferGeometry()); groom.setAttribute('position', new THREE.Float32BufferAttribute(strands, 3));
    groom.setAttribute('color', new THREE.Float32BufferAttribute(strandColors, 3)); groom.setIndex(strandIndices); groom.computeVertexNormals();
    this.mesh(parent, groom, hair, [0, 0, 0]).name = `${role}-hair-strands`;
    if (role === 'architect' || role === 'rama_kandra' || role === 'trainman') this.beard(parent, skin, role);
    if (role === 'rama_kandra' || role === 'kamala' || role === 'trainman') this.mobilHair(parent, skin, role);
    if (role === 'sati') {
      const braids: THREE.BufferGeometry[] = [];
      for (const side of [-1, 1]) for (let lock = 0; lock < 3; lock++) {
        const points = Array.from({ length: 65 }, (_, i) => {
          const t = i / 64, phase = t * Math.PI * 12 + lock * Math.PI * 2 / 3, radius = .026 * (1 - t * .6);
          return new THREE.Vector3(side * (.21 + Math.sin(t * Math.PI) * .025) + Math.cos(phase) * radius,
            -.10 - t * .47, -.245 + Math.sin(phase) * radius - t * .035);
        });
        braids.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, .017, 6, false));
      }
      const merged = this.geometry(mergeGeometries(braids)!); braids.forEach(geometry => geometry.dispose());
      this.mesh(parent, merged, this.material(new THREE.MeshStandardMaterial({ color: '#14120e', roughness: .55 })), [0, 0, 0]).name = 'sati-braids';
    } else if (oracle) {
      const gold = this.material(new THREE.MeshStandardMaterial({ color: '#b49b62', metalness: .7, roughness: .35 }));
      const stone = this.material(new THREE.MeshStandardMaterial({ color: '#c3b49e', roughness: .58 }));
      const loop = this.geometry(new THREE.TorusGeometry(.027, .003, 6, 24)), disc = this.geometry(new THREE.CylinderGeometry(.024, .024, .005, 24));
      for (const side of [-1, 1]) {
        this.mesh(parent, loop, gold, [side * .237, -.17, .03], [1, 1.55, 1]);
        this.mesh(parent, disc, stone, [side * .237, -.17, .03], [1, 1, 1.5]).rotation.x = Math.PI / 2;
      }
    }
  }

  private readingGlasses(parent: THREE.Group, eyeX: number): void {
    const group = new THREE.Group(); group.name = 'keymaker-reading-glasses'; parent.add(group);
    const frame = this.material(new THREE.MeshStandardMaterial({ color: '#8e846c', metalness: .72, roughness: .36 }));
    const glass = this.material(new THREE.MeshPhysicalMaterial({ color: '#c5d5ca', transparent: true, opacity: .075, depthWrite: false, roughness: .12, side: THREE.DoubleSide }));
    const pieces: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const outline = [[-.060, -.018], [-.065, .014], [-.052, .030], [.046, .028], [.066, .010], [.061, -.024], [.046, -.034], [-.043, -.032]];
      const points = outline.map(([x, y]) => new THREE.Vector3(side * eyeX + x, y, .256 - Math.max(0, side * x) * .25));
      pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, .0018, 5, true));
      const lens = this.geometry(new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x * .94, y * .94))), 24));
      this.mesh(group, lens, glass, [side * eyeX, 0, .253]).name = `keymaker-clear-lens-${side}`;
      const temple = [[side * (eyeX + .064), .014, .239], [side * .206, .015, .10], [side * .226, .01, -.05], [side * .227, -.025, -.11]].map(p => new THREE.Vector3(...p as [number, number, number]));
      pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(temple), 32, .002, 5, false));
    }
    pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-.025, .015, .268], [0, .028, .278], [.025, .015, .268]].map(p => new THREE.Vector3(...p as [number, number, number]))), 20, .0018, 5, false));
    const geometry = this.geometry(mergeGeometries(pieces)!); pieces.forEach(piece => piece.dispose());
    this.mesh(group, geometry, frame, [0, 0, 0]).name = 'keymaker-wire-frames';
  }

  private mobilHair(parent: THREE.Group, skin: THREE.BufferGeometry, role: 'rama_kandra' | 'kamala' | 'trainman'): void {
    const position = skin.attributes.position, points: number[] = [], colors: number[] = [], indices: number[] = [];
    const root = new THREE.Vector3(), candidate = new THREE.Vector3();
    for (let lock = 0; lock < 144; lock++) {
      const angle = 1.04 + lock / 143 * (Math.PI * 2 - 2.08), target = new THREE.Vector3(Math.sin(angle) * .25, .09, Math.cos(angle) * .23 - .055);
      let distance = Infinity;
      for (let vertex = 0; vertex < position.count; vertex++) {
        candidate.fromBufferAttribute(position, vertex);
        const value = candidate.distanceToSquared(target);
        if (value < distance) { distance = value; root.copy(candidate); }
      }
      const start = points.length / 3, length = role === 'trainman' ? .83 + lock % 7 * .012 : role === 'kamala' ? .58 + lock % 3 * .009 : .29 + lock % 5 * .012;
      const shade = role === 'trainman' ? .10 + lock % 9 * .012 : .008 + lock % 6 * .003;
      for (let row = 0; row <= 24; row++) {
        const t = row / 24, clearance = .017 + .11 * t * t;
        const center = root.clone().add(new THREE.Vector3(Math.sin(angle) * clearance, -length * t, Math.cos(angle) * clearance));
        center.x += Math.sin(t * Math.PI * 4 + lock) * (role === 'trainman' ? .009 : .004) * t;
        for (const side of [-1, 1]) {
          const width = .011 * (1 - t * .45), point = center.clone().add(new THREE.Vector3(Math.cos(angle) * side * width, 0, -Math.sin(angle) * side * width));
          points.push(...point.toArray()); colors.push(shade, shade * .93, shade * .82);
        }
        if (row) { const a = start + (row - 1) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    }
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(parent, geometry, this.material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, side: THREE.DoubleSide })), [0, 0, 0]).name = `${role}-long-hair`;
  }

  private beard(parent: THREE.Group, skin: THREE.BufferGeometry, role: 'architect' | 'rama_kandra' | 'trainman'): void {
    const position = skin.attributes.position, normal = skin.attributes.normal, indices = skin.index!;
    const points: number[] = [], normals: number[] = [], uvs: number[] = [], profiles: number[] = [], weights: number[] = [], faces: number[] = [];
    const signed = (p: THREE.Vector3) => Math.min(p.y + .347, -.145 + Math.min(1, Math.abs(p.x) / .21) * .11 - p.y, p.z + .09,
      Math.max(.215 - Math.abs(p.x), p.z - .025),
      (p.x / .083) ** 2 + ((p.y + .211) / .026) ** 2 - 1, Math.max(Math.abs(p.x) - .07, -.162 - p.y));
    for (let triangle = 0; triangle < indices.count; triangle += 3) {
      const polygon = [0, 1, 2].map(i => {
        const vertex = indices.getX(triangle + i);
        return { p: new THREE.Vector3().fromBufferAttribute(position, vertex), n: new THREE.Vector3().fromBufferAttribute(normal, vertex),
          uv: new THREE.Vector2(skin.attributes.uv.getX(vertex), skin.attributes.uv.getY(vertex)),
          profile: new THREE.Vector2(skin.attributes.uv1.getX(vertex), skin.attributes.uv1.getY(vertex)),
          weight: skin.attributes._face_weight.getX(vertex) };
      });
      const clipped: typeof polygon = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + polygon.length - 1) % polygon.length], da = signed(a.p), db = signed(b.p);
        if ((da >= 0) !== (db >= 0)) {
          const t = db / (db - da); clipped.push({ p: b.p.clone().lerp(a.p, t), n: b.n.clone().lerp(a.n, t).normalize(),
            uv: b.uv.clone().lerp(a.uv, t), profile: b.profile.clone().lerp(a.profile, t), weight: THREE.MathUtils.lerp(b.weight, a.weight, t) });
        }
        if (da >= 0) clipped.push(a);
      }
      const start = points.length / 3;
      for (const vertex of clipped) {
        const p = vertex.p.clone().addScaledVector(vertex.n, .004 + .006 * Math.max(0, -.18 - vertex.p.y));
        points.push(...p.toArray()); normals.push(...vertex.n.toArray());
        uvs.push(...vertex.uv.toArray()); profiles.push(...vertex.profile.toArray()); weights.push(vertex.weight);
      }
      for (let i = 1; i < clipped.length - 1; i++) faces.push(start, start + i, start + i + 1);
    }
    const geometry = this.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(profiles, 2)); geometry.setAttribute('_face_weight', new THREE.Float32BufferAttribute(weights, 1)); geometry.setIndex(faces);
    const face = parent.getObjectByName(`${role}-anatomical-head`) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    this.mesh(parent, geometry, face.material, [0, 0, 0]).name = `${role}-fitted-beard`;
    const material = this.material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, side: THREE.DoubleSide }));
    const strands: number[] = [], colors: number[] = [], triangles: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const vertex = (i * 7919) % (points.length / 3), p = new THREE.Vector3().fromArray(points, vertex * 3), n = new THREE.Vector3().fromArray(normals, vertex * 3);
      const down = new THREE.Vector3(0, -1, .12).addScaledVector(n, n.y).normalize(), across = new THREE.Vector3().crossVectors(n, down).normalize();
      const start = strands.length / 3, tone = role === 'architect' ? .60 + i % 9 * .025 : role === 'trainman' ? .12 + i % 9 * .012 : .012 + i % 7 * .004;
      for (let row = 0; row <= 3; row++) for (const side of [-1, 1]) {
        const f = row / 3, point = p.clone().addScaledVector(down, f * (.007 + i % 5 * .001))
          .addScaledVector(n, .0015 + Math.sin(f * Math.PI) * .001).addScaledVector(across, side * .00045 * (1 - f * .85));
        strands.push(...point.toArray()); colors.push(tone, tone * .985, tone * .95);
        if (row && side === 1) { const a = start + (row - 1) * 2; triangles.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    }
    const groom = this.geometry(new THREE.BufferGeometry()); groom.setAttribute('position', new THREE.Float32BufferAttribute(strands, 3));
    groom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); groom.setIndex(triangles); groom.computeVertexNormals();
    this.mesh(parent, groom, material, [0, 0, 0]).name = `${role}-beard-strands`;
  }

  private headwrapTies(parent: THREE.Group): void {
    const pieces: THREE.BufferGeometry[] = [];
    // Folded fabric follows the skull; the two loose ends hang behind the ears.
    for (const side of [-1, 1]) {
      const positions: number[] = [], indices: number[] = [];
      for (let row = 0; row <= 16; row++) for (let column = 0; column <= 4; column++) {
        const t = row / 16, across = column / 4 - .5;
        positions.push(side * (.045 + t * .08) + across * .13 * (1 - t * .4),
          -.07 - t * .35, -.335 - Math.sin(t * Math.PI) * .035 + Math.sin(across * Math.PI * 2 + t * 2) * .012);
        if (row && column < 4) { const a = (row - 1) * 5 + column, b = row * 5 + column; indices.push(a, a + 1, b, b, a + 1, b + 1); }
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); pieces.push(geometry);
    }
    const ties = mergeGeometries(pieces)!; pieces.forEach(geometry => geometry.dispose());
    const material = this.material(new THREE.MeshStandardMaterial({ color: '#5e6259', roughness: .98, side: THREE.DoubleSide }));
    this.mesh(parent, this.geometry(ties), material, [0, 0, 0]).name = 'zee-headwrap-ties';
    const knot = this.geometry(new THREE.SphereGeometry(1, 16, 12));
    this.mesh(parent, knot, material, [0, -.07, -.33], [.10, .05, .055]).name = 'zee-headwrap-knot';
  }

  private release(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear();
    this.materials.forEach(material => material.dispose()); this.materials.clear();
    this.textures.forEach(texture => texture.dispose()); this.textures.clear();
  }

  dispose(): void { this.disposed = true; this.entries.clear(); this.release(); }
}
