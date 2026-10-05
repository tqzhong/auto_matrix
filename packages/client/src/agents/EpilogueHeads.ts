import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';

interface HeadEntry {
  role: 'oracle' | 'sati';
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

  track(rig: CharacterRig, role: 'oracle' | 'sati'): void {
    const fallback = new THREE.Group(); fallback.name = `${role}-fallback-head`;
    fallback.add(...rig.head.children); rig.head.add(fallback);
    this.entries.set(rig, { role, fallback, closed: { value: 0 }, loading: false, active: false, neck: rig.root.getObjectByName(`${role}-neck`) });
  }

  update(rig: CharacterRig, input: MotionInput): void {
    const entry = this.entries.get(rig); if (!entry) return;
    // Mary Alice's appearance belongs to Revolutions. Earlier Oracle scenes
    // retain their existing head until their own likeness asset is authored.
    entry.active = entry.role === 'sati' || Boolean(input.oracleRestored || input.parkOutfit || input.epilogue?.kind === 'dawn');
    entry.closed.value = input.oracleRestored ? 1 : 0;
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
    if (entry.eyes) entry.eyes.visible = !entry.closed.value;
  }

  private async load(rig: CharacterRig, entry: HeadEntry): Promise<void> {
    const role = entry.role === 'oracle' ? 'oracle-revolutions' : 'sati';
    const asset = await new GLTFLoader().loadAsync(`/assets/characters/${role}-head.glb`);
    const model = asset.scene, face = model.getObjectByName(`${role}-anatomical-head`) as THREE.Mesh;
    const metadata = asset.parser.json.extras;
    model.name = `${role}-detailed-head`;
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry); object.castShadow = object.receiveShadow = true;
      const material = object.material as THREE.MeshStandardMaterial; this.materials.add(material);
      if (material.map) { material.map.anisotropy = 8; this.textures.add(material.map); }
    });
    const material = face.material as THREE.MeshStandardMaterial;
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
          vec2 neckUv = vec2(.25 + vHeadRest.x * .10, ${entry.role === 'sati' ? '.945' : '.445'} + clamp(-vHeadRest.y - .30, 0.0, .2) * .12);
          vec3 neckColor = texture2D(map, neckUv).rgb;
          float profileWeight = smoothstep(.20, .70, abs(vHeadNormal.x)) * smoothstep(-.28, -.16, vHeadRest.y);
          vec3 profileColor = texture2D(map, vProfileUv).rgb;
          vec2 profilePx = vProfileUv * 1254.0 - vec2(627.0, ${entry.role === 'sati' ? '627.0' : '0.0'});
          // A projected reference ear/eye cannot also appear on the flat temple
          // beside the real anatomy. Use adjacent cheek detail in those regions.
          float photoEar = 1.0 - smoothstep(.75, 1.2, length((profilePx - vec2(365.0, 323.0)) / vec2(65.0, 92.0)));
          float earSurface = smoothstep(${entry.role === 'sati' ? '.235, .263' : '.209, .234'}, abs(vHeadRest.x));
          float photoEye = (1.0 - smoothstep(.7, 1.3, length((profilePx - vec2(151.0, 267.0)) / vec2(52.0, 37.0))))
            * smoothstep(.14, .18, abs(vHeadRest.x));
          vec3 cheek = texture2D(map, vec2(${entry.role === 'sati' ? '.697, .805' : '.697, .305'})).rgb;
          profileColor = mix(profileColor, cheek, max(photoEar * (1.0 - earSurface), photoEye));
          // Profile registration must not paint the neutral backdrop onto
          // the nose edge, ear or the underside of the chin.
          float profileSkin = smoothstep(.035, .085, profileColor.r - profileColor.b)
            * smoothstep(.015, .045, profileColor.r - profileColor.g);
          float shortHair = (1.0 - smoothstep(.12, .24, max(profileColor.r, max(profileColor.g, profileColor.b))))
            * smoothstep(-.16, -.06, vHeadRest.y) * (1.0 - smoothstep(.08, .16, vHeadRest.z));
          profileWeight *= max(profileSkin, shortHair);
          vec3 sideColor = mix(neckColor, profileColor, profileWeight);
          diffuseColor.rgb = mix(sideColor, diffuseColor.rgb, vFaceWeight);
          float lid = (1.0 - smoothstep(.035, .060, abs(abs(vHeadRest.x) - ${Number(metadata.eye[0]).toFixed(6)})))
            * (1.0 - smoothstep(.012, .038, abs(vHeadRest.y))) * smoothstep(.12, .18, vHeadRest.z);
          diffuseColor.rgb = mix(diffuseColor.rgb, headSkin * .91, lid * eyesClosed);`);
    };
    material.customProgramCacheKey = () => `${role}-registered-head-v1`;
    entry.face = face;
    entry.eyes = new THREE.Group(); entry.eyes.name = `${role}-eyes`; model.add(entry.eyes);
    const sclera = this.material(new THREE.MeshPhysicalMaterial({ color: '#c6b9a7', roughness: .3, clearcoat: .3 }));
    const iris = this.material(new THREE.MeshStandardMaterial({ color: '#352318', roughness: .48 }));
    const pupil = this.material(new THREE.MeshPhysicalMaterial({ color: '#080906', roughness: .19, clearcoat: .5 }));
    const sphere = this.geometry(new THREE.SphereGeometry(1, 24, 16));
    for (const side of [-1, 1]) {
      const [x, y, z] = metadata.eye as number[], r = metadata.eyeRadius as number;
      this.mesh(entry.eyes, sphere, sclera, [side * x, y, z], [r, r, r]);
      this.mesh(entry.eyes, sphere, iris, [side * x, y, z + r * .87], [r * .48, r * .48, r * .20]);
      this.mesh(entry.eyes, sphere, pupil, [side * x, y, z + r * 1.035], [r * .23, r * .23, r * .075]);
    }
    this.groom(model, face.geometry, entry.role);
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
    const vertices: number[] = [], normals: number[] = [], colors: number[] = [], uvs: number[] = [], triangles: number[] = [], roots: THREE.Vector3[] = [], directions: THREE.Vector3[] = [];
    const point = new THREE.Vector3(), direction = new THREE.Vector3();
    const boundary = (x: number, z: number) => {
      const front = Math.max(0, Math.cos(Math.atan2(x, z + .04)));
      const ear = Math.exp(-(((z + .045) / .24) ** 4)) * THREE.MathUtils.smoothstep(Math.abs(x), .10, .19);
      return Math.max(-.22 + front * (oracle ? .39 : .43), -.22 + .32 * ear);
    };
    for (let t = 0; t < indices.count; t += 3) {
      const ids = [indices.getX(t), indices.getX(t + 1), indices.getX(t + 2)];
      if (ids.some(i => position.getY(i) < boundary(position.getX(i), position.getZ(i)))) continue;
      for (const i of ids) {
        point.fromBufferAttribute(position, i); direction.fromBufferAttribute(normal, i);
        const curl = oracle ? .0025 * Math.sin(point.x * 200 + Math.sin(point.y * 180)) * Math.cos(point.z * 210) : 0;
        point.addScaledVector(direction, (oracle ? .035 + .025 * Math.max(0, -direction.z) : .009) + curl);
        vertices.push(...point.toArray()); normals.push(...direction.toArray()); triangles.push(triangles.length);
        const tone = .65 + .35 * (.5 + .5 * Math.sin(i * 13.27)); colors.push(tone, tone, tone);
        uvs.push((Math.atan2(point.x, point.z + .04) / Math.PI + 1) * 2, (point.y + .24) * 5);
        roots.push(point.clone()); directions.push(direction.clone());
      }
    }
    const cap = this.geometry(new THREE.BufferGeometry()); cap.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    cap.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); cap.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    cap.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); cap.setIndex(triangles);
    const atlas = ((parent.getObjectByName(`${oracle ? 'oracle-revolutions' : 'sati'}-anatomical-head`) as THREE.Mesh).material as THREE.MeshStandardMaterial).map!;
    const scalp = this.material(new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: oracle ? .84 : .7, side: THREE.DoubleSide }));
    scalp.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
        vec2 hairUv = vec2(${oracle ? '.766, .078' : '.81, .57'}) + (1.0 - abs(fract(vMapUv * .5) * 2.0 - 1.0)) * vec2(${oracle ? '.14, .14' : '.10, .12'});
        diffuseColor *= texture2D(map, hairUv);
      #endif`);
    };
    scalp.customProgramCacheKey = () => `${role}-scalp-detail-v1`;
    const hair = this.material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide }));
    this.mesh(parent, cap, scalp, [0, 0, 0]).name = `${role}-hair-scalp`;
    const strands: number[] = [], strandColors: number[] = [], strandIndices: number[] = [];
    for (let strand = 0; strand < 1600; strand++) {
      const index = (strand * 7919) % roots.length, root = roots[index], outward = directions[index];
      const sweep = new THREE.Vector3(Math.sign(root.x) * .22, .3, -1).addScaledVector(outward, -new THREE.Vector3(Math.sign(root.x) * .22, .3, -1).dot(outward)).normalize();
      const across = new THREE.Vector3().crossVectors(outward, sweep).normalize();
      const length = oracle ? .012 + (strand % 7) * .003 : .015 + (strand % 11) * .002;
      const silver = oracle && strand % 7 === 0, tone = silver ? .055 + (strand % 4) * .01 : oracle ? .016 : .005;
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
    if (!oracle) {
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
    } else {
      const gold = this.material(new THREE.MeshStandardMaterial({ color: '#b49b62', metalness: .7, roughness: .35 }));
      const stone = this.material(new THREE.MeshStandardMaterial({ color: '#c3b49e', roughness: .58 }));
      const loop = this.geometry(new THREE.TorusGeometry(.027, .003, 6, 24)), disc = this.geometry(new THREE.CylinderGeometry(.024, .024, .005, 24));
      for (const side of [-1, 1]) {
        this.mesh(parent, loop, gold, [side * .237, -.17, .03], [1, 1.55, 1]);
        this.mesh(parent, disc, stone, [side * .237, -.17, .03], [1, 1, 1.5]).rotation.x = Math.PI / 2;
      }
    }
  }

  private release(): void {
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear();
    this.materials.forEach(material => material.dispose()); this.materials.clear();
    this.textures.forEach(texture => texture.dispose()); this.textures.clear();
  }

  dispose(): void { this.disposed = true; this.entries.clear(); this.release(); }
}
