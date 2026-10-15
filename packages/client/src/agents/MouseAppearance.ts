import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';

/** Mouse keeps one anatomical rig under his ship and Matrix wardrobes. */
export class MouseAppearance {
  private model: THREE.Group;
  private eyes = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private skin: THREE.SkinnedMesh;
  private masked: THREE.BufferGeometry;

  constructor(private rig: HeroRig, asset: GLTF, eye: THREE.Vector3) {
    const head = rig.bones.get('head')!;
    this.model = asset.scene.clone(true); this.model.name = 'mouse-detailed-head';
    this.skin = rig.root.getObjectByName('Anatomical_head_and_hands') as THREE.SkinnedMesh;
    const original = this.skin.geometry, headIndex = this.skin.skeleton.bones.indexOf(head);
    const metadata = asset.parser.json.extras, scale = Math.abs(eye.x) / metadata.eye[0];
    const offset = eye.clone().setX(0).sub(new THREE.Vector3(0, metadata.eye[1], metadata.eye[2]).multiplyScalar(scale));
    const toHead = this.skin.skeleton.boneInverses[headIndex].clone().multiply(this.skin.bindMatrix), fromHead = toHead.clone().invert();
    const transform = fromHead.clone().multiply(new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z)).multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    const face = this.model.getObjectByName('mouse-anatomical-head') as THREE.Mesh;
    const geometry = face.geometry.clone(), rest = geometry.attributes.position.clone(); this.geometries.add(geometry);
    geometry.setAttribute('_head_rest', rest); geometry.setAttribute('_head_normal', geometry.attributes.normal.clone());
    geometry.applyMatrix4(transform);
    const reference = (rig.root.getObjectByName('mouse-neck-reference') as THREE.SkinnedMesh).geometry;
    const sourceJoints = reference.attributes.skinIndex, sourceWeights = reference.attributes.skinWeight;
    const neck: { triangle: THREE.Triangle; vertices: number[] }[] = [], index = reference.index!;
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      neck.push({ triangle: new THREE.Triangle(...vertices.map(v => new THREE.Vector3().fromBufferAttribute(reference.attributes.position, v)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]), vertices });
    }
    const indices: number[] = [], weights: number[] = [], bodyUv: number[] = [], point = new THREE.Vector3(), sample = new THREE.Vector3(), nearestPoint = new THREE.Vector3();
    const barycentric = new THREE.Vector3(), ray = new THREE.Ray(), direction = new THREE.Matrix3().setFromMatrix4(fromHead);
    for (let i = 0; i < rest.count; i++) {
      let influences: [number, number][] = [[headIndex, 1]];
      const uv = new THREE.Vector2();
      if (rest.getY(i) < -.32) {
        point.fromBufferAttribute(geometry.attributes.position, i); sample.copy(point).applyMatrix4(toHead);
        ray.origin.set(0, sample.y, 0).applyMatrix4(fromHead); ray.direction.set(sample.x, 0, sample.z).applyMatrix3(direction).normalize();
        let nearest: typeof neck[number] | undefined, distance = Infinity;
        for (const source of neck) {
          if (!ray.intersectTriangle(source.triangle.a, source.triangle.b, source.triangle.c, false, sample)) continue;
          const d = ray.origin.distanceToSquared(sample); if (d < distance) { nearest = source; distance = d; nearestPoint.copy(sample); }
        }
        if (nearest) {
          nearest.triangle.getBarycoord(nearestPoint, barycentric);
          for (let corner = 0; corner < 3; corner++) {
            const vertex = nearest.vertices[corner], bodyMap = reference.attributes.uv;
            uv.addScaledVector(new THREE.Vector2(bodyMap.getX(vertex), bodyMap.getY(vertex)), barycentric.getComponent(corner));
          }
          const fade = THREE.MathUtils.smoothstep(rest.getY(i), -.38, -.32), projected = new Map<number, number>([[headIndex, fade]]);
          for (let corner = 0; corner < 3; corner++) for (let part = 0; part < 4; part++) {
            const vertex = nearest.vertices[corner], joint = sourceJoints.getComponent(vertex, part);
            projected.set(joint, (projected.get(joint) ?? 0) + sourceWeights.getComponent(vertex, part) * barycentric.getComponent(corner) * (1 - fade));
          }
          influences = [...projected].sort((a, b) => b[1] - a[1]).slice(0, 4);
          point.lerp(nearestPoint, 1 - THREE.MathUtils.smoothstep(rest.getY(i), -.44, -.32)); geometry.attributes.position.setXYZ(i, point.x, point.y, point.z);
        }
      }
      const total = influences.reduce((sum, entry) => sum + entry[1], 0);
      for (let j = 0; j < 4; j++) { indices.push(influences[j]?.[0] ?? 0); weights.push((influences[j]?.[1] ?? 0) / total); }
      bodyUv.push(uv.x, uv.y);
    }
    const normals = geometry.attributes.normal; geometry.deleteAttribute('normal'); geometry.computeVertexNormals();
    for (let i = 0; i < rest.count; i++) if (rest.getY(i) >= -.32) geometry.attributes.normal.setXYZ(i, normals.getX(i), normals.getY(i), normals.getZ(i));
    const linear = new THREE.Matrix3().setFromMatrix4(transform);
    geometry.morphAttributes.position?.forEach(attribute => { (attribute as THREE.BufferAttribute).applyMatrix3(linear); });
    const rotation = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().extractRotation(transform));
    geometry.morphAttributes.normal?.forEach(attribute => { (attribute as THREE.BufferAttribute).applyMatrix3(rotation); });
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    geometry.setAttribute('_body_uv', new THREE.Float32BufferAttribute(bodyUv, 2));
    const material = (face.material as THREE.MeshStandardMaterial).clone(); this.materials.add(material);
    const atlas = metadata.atlasSize, origin = metadata.profileOrigin, neckSample = metadata.neckSample, cheek = metadata.cheekSample;
    const ear = metadata.profileEar, profileEye = metadata.profileEye;
    material.onBeforeCompile = shader => {
      const skinMaterial = this.skin.material as THREE.MeshStandardMaterial;
      shader.uniforms.mouseBodyMap = { value: skinMaterial.map }; shader.uniforms.mouseBodyColor = { value: skinMaterial.color };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        attribute float _face_weight; attribute vec3 _head_rest; attribute vec3 _head_normal; attribute vec2 _body_uv;
        #ifndef USE_UV1
          attribute vec2 uv1;
        #endif
        varying vec2 vProfileUv; varying vec3 vHeadNormal; varying float vFaceWeight; varying vec3 vHeadRest; varying vec2 vBodyUv;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFaceWeight = _face_weight; vHeadRest = _head_rest; vProfileUv = uv1; vHeadNormal = _head_normal; vBodyUv = _body_uv;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D mouseBodyMap; uniform vec3 mouseBodyColor;
        varying float vFaceWeight; varying vec3 vHeadRest; varying vec2 vProfileUv; varying vec3 vHeadNormal; varying vec2 vBodyUv;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 neckUv = vec2(${Number(neckSample[0]).toFixed(6)} + vHeadRest.x * .10,
          ${Number(neckSample[1]).toFixed(6)} + clamp(-vHeadRest.y - .30, 0.0, .2) * .03);
        vec3 neckColor = texture2D(map, neckUv).rgb;
        float profileWeight = smoothstep(.20, .70, abs(vHeadNormal.x)) * smoothstep(-.28, -.16, vHeadRest.y);
        vec3 profileColor = texture2D(map, vProfileUv).rgb;
        vec2 profilePx = vProfileUv * vec2(${Number(atlas[0]).toFixed(1)}, ${Number(atlas[1]).toFixed(1)}) - vec2(${Number(origin[0]).toFixed(1)}, ${Number(origin[1]).toFixed(1)});
        float photoEar = 1.0 - smoothstep(.75, 1.2, length((profilePx - vec2(${Number(ear[0]).toFixed(1)}, ${Number(ear[1]).toFixed(1)})) / vec2(65.0, 92.0)));
        float earSurface = smoothstep(.209, .234, abs(vHeadRest.x));
        float photoEye = (1.0 - smoothstep(.7, 1.3, length((profilePx - vec2(${Number(profileEye[0]).toFixed(1)}, ${Number(profileEye[1]).toFixed(1)})) / vec2(52.0, 37.0))))
          * smoothstep(.14, .18, abs(vHeadRest.x));
        vec3 cheekColor = texture2D(map, vec2(${Number(cheek[0]).toFixed(6)}, ${Number(cheek[1]).toFixed(6)})).rgb;
        profileColor = mix(profileColor, cheekColor, max(photoEar * (1.0 - earSurface), photoEye));
        float profileSkin = smoothstep(.035, .085, profileColor.r - profileColor.b) * smoothstep(.015, .045, profileColor.r - profileColor.g);
        float shortHair = (1.0 - smoothstep(.12, .24, max(profileColor.r, max(profileColor.g, profileColor.b))))
          * smoothstep(-.16, -.06, vHeadRest.y) * (1.0 - smoothstep(.08, .16, vHeadRest.z));
        profileWeight *= max(profileSkin, shortHair);
        diffuseColor.rgb = mix(mix(neckColor, profileColor, profileWeight), diffuseColor.rgb, vFaceWeight);
        diffuseColor.rgb = mix(texture2D(mouseBodyMap, vBodyUv).rgb * mouseBodyColor, diffuseColor.rgb, smoothstep(-.48, -.32, vHeadRest.y));`);
    };
    material.customProgramCacheKey = () => 'mouse-registered-head-v1';
    const replacement = new THREE.SkinnedMesh(geometry, material); replacement.name = face.name;
    replacement.morphTargetDictionary = { ...face.morphTargetDictionary };
    replacement.bind(this.skin.skeleton, this.skin.bindMatrix); replacement.castShadow = replacement.receiveShadow = true;
    face.removeFromParent(); this.model.add(replacement); rig.root.add(this.model);
    rig.root.updateMatrixWorld(true); replacement.skeleton.update();
    const fittedVertices: number[] = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      replacement.getVertexPosition(i, point); replacement.localToWorld(point); head.worldToLocal(point); fittedVertices.push(point.x, point.y, point.z);
    }
    const cell = .02, sections = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; denominator: number }[]>();
    for (let i = 0; i < geometry.index!.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(corner => new THREE.Vector3().fromArray(fittedVertices, geometry.index!.getX(i + corner) * 3));
      const bottom = Math.min(a.y, b.y, c.y), top = Math.max(a.y, b.y, c.y);
      if (top < eye.y - .04 || bottom > eye.y + .04) continue;
      const denominator = (b.z - c.z) * (a.y - c.y) + (c.y - b.y) * (a.z - c.z); if (Math.abs(denominator) < 1e-10) continue;
      const section = { a, b, c, denominator };
      for (let y = Math.floor(bottom / cell); y <= Math.floor(top / cell); y++)
        for (let z = Math.floor(Math.min(a.z, b.z, c.z) / cell); z <= Math.floor(Math.max(a.z, b.z, c.z) / cell); z++) {
          const key = `${y},${z}`, entries = sections.get(key) ?? []; entries.push(section); sections.set(key, entries);
        }
    }
    // Index the actual head's narrow temple band in Y/Z, so asset arrival
    // does not repeat a full skinned-mesh raycast for every tube vertex.
    const surface = (y: number, z: number, side: number) => {
      let outer = -Infinity;
      for (const { a, b, c, denominator } of sections.get(`${Math.floor(y / cell)},${Math.floor(z / cell)}`) ?? []) {
        const u = ((b.z - c.z) * (y - c.y) + (c.y - b.y) * (z - c.z)) / denominator;
        const v = ((c.z - a.z) * (y - c.y) + (a.y - c.y) * (z - c.z)) / denominator, w = 1 - u - v;
        if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) outer = Math.max(outer, side * (u * a.x + v * b.x + w * c.x));
      }
      return outer;
    };
    for (const side of [-1, 1]) {
      const temple = rig.glasses.getObjectByName(`mouse-glasses-temple-${side}`) as THREE.Mesh<THREE.TubeGeometry>;
      const source = temple.geometry.parameters, rim = rig.glasses.children.find(part => part instanceof THREE.Mesh && part.geometry instanceof THREE.TubeGeometry
        && part.geometry.parameters.radius === .0028 && Math.sign(part.position.x) === side) as THREE.Mesh<THREE.TubeGeometry>;
      const anchor = rim.geometry.parameters.path.getPoints(128).map(point => head.worldToLocal(rim.localToWorld(point)))
        .sort((a, b) => side * (b.x - a.x))[0];
      const curve = new THREE.CatmullRomCurve3([anchor, ...source.path.getPoints(32)]), path: THREE.Vector3[] = [];
      for (let step = 0; step <= 96; step++) {
        const point = curve.getPointAt(step / 96);
        point.x = side * Math.max(side * point.x, surface(point.y, point.z, side) + source.radius + .003);
        path.push(point);
      }
      const fitted = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 128, source.radius, source.radialSegments), vertices = fitted.attributes.position;
      // Ear rims can protrude between centerline samples. Move each complete
      // tube ring outside that surface, preserving its round cross-section.
      const ring = source.radialSegments + 1;
      for (let first = 0; first < vertices.count; first += ring) {
        let clearance = 0;
        for (let i = first; i < first + ring; i++) {
          clearance = Math.max(clearance, surface(vertices.getY(i), vertices.getZ(i), side) - side * vertices.getX(i) + .003);
        }
        for (let i = first; i < first + ring; i++) vertices.setX(i, vertices.getX(i) + side * clearance);
      }
      fitted.computeVertexNormals(); fitted.computeBoundingSphere();
      this.geometries.add(fitted); temple.geometry = fitted;
    }

    this.masked = new THREE.BufferGeometry(); this.geometries.add(this.masked); this.masked.attributes = original.attributes;
    this.masked.morphAttributes = original.morphAttributes; this.masked.morphTargetsRelative = original.morphTargetsRelative;
    const retained: number[] = [], a = original.attributes, sourceIndex = original.index!;
    const skull = (v: number) => [0, 1, 2, 3].some(j => a.skinIndex.getComponent(v, j) === headIndex && a.skinWeight.getComponent(v, j) > .05)
      && point.fromBufferAttribute(a.position, v).applyMatrix4(toHead).y > offset.y - .50 * scale;
    for (let i = 0; i < sourceIndex.count; i += 3) {
      const triangle = [sourceIndex.getX(i), sourceIndex.getX(i + 1), sourceIndex.getX(i + 2)]; if (!triangle.some(skull)) retained.push(...triangle);
    }
    this.masked.setIndex(retained);
    this.eyes.name = 'mouse-eyes'; this.eyes.scale.setScalar(scale); this.eyes.position.copy(offset); head.add(this.eyes);
    const sphere = new THREE.SphereGeometry(1, 24, 16); this.geometries.add(sphere);
    const sclera = new THREE.MeshPhysicalMaterial({ color: '#c6c3b4', roughness: .3, clearcoat: .3 });
    const iris = new THREE.MeshStandardMaterial({ color: '#58717a', roughness: .48 }), pupil = new THREE.MeshPhysicalMaterial({ color: '#080b0c', roughness: .19, clearcoat: .5 });
    for (const material of [sclera, iris, pupil]) this.materials.add(material);
    const [x, y, z] = metadata.eye as number[], r = metadata.eyeRadius as number;
    for (const side of [-1, 1]) for (const [material, depth, width, height, thickness] of [[sclera, 0, r, r, r], [iris, r * .87, r * .48, r * .48, r * .20], [pupil, r * 1.035, r * .23, r * .23, r * .075]] as const) {
      const mesh = new THREE.Mesh(sphere, material); mesh.position.set(side * x, y, z + depth); mesh.scale.set(width, height, thickness); this.eyes.add(mesh);
    }
    this.update({ speed: 0, grounded: true, verticalVelocity: 0, turn: 0, realWorld: true });
  }

  update(input: MotionInput): void {
    const ship = Boolean(input.realWorld), firstPerson = Boolean(input.firstPerson);
    this.skin.geometry = this.masked; this.model.visible = this.eyes.visible = !firstPerson;
    for (const part of this.rig.wardrobe) {
      if (part.mesh.userData.mouseCostume) part.mesh.visible = ship && !(firstPerson && part.mesh.userData.mouseCap);
      else if (/Tailored.coat.upper|Black.crew.neck/.test(part.mesh.name)) part.mesh.visible = !ship;
      else if ((part.mesh.material as THREE.Material).name === 'Eyes') part.mesh.visible = false;
      else if (part.hair) part.mesh.visible = !firstPerson;
      const material = part.mesh.material as THREE.MeshStandardMaterial; material.color.copy(part.color);
    }
    this.rig.glasses.visible = !ship && !firstPerson && input.glasses !== false;
  }

  dispose(): void {
    this.model.removeFromParent(); this.eyes.removeFromParent();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
  }
}
