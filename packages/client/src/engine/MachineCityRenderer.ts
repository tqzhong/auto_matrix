import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Exterior below the audience platform. Its structures stay outside the walk and transport routes. */
export class MachineCityRenderer {
  private group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  // Distant structures keep diffuse lighting without per-pixel metal reflections.
  private metal = new THREE.MeshLambertMaterial({ color: 0x43516b, emissiveIntensity: 0 });
  private ribs = new THREE.MeshLambertMaterial({ color: 0x667893, emissiveIntensity: 0 });
  private circuits = new THREE.MeshBasicMaterial({ color: 0x739bda });
  private sky = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { subjective: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 direction;
      uniform float subjective;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
          mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      void main() {
        vec3 ray = normalize(direction);
        vec2 p = ray.xz / (.24 + abs(ray.y)) * 3.5;
        float cloud = noise(p) * .55 + noise(p * 2.1 + 4.3) * .28 + noise(p * 4.4) * .12 + noise(p * 9.1) * .05;
        float opening = smoothstep(.35, .73, cloud);
        float horizon = exp(-abs(ray.y) * 3.0);
        vec3 night = mix(vec3(.006, .01, .024), vec3(.047, .073, .145), opening);
        night += vec3(.009, .018, .044) * horizon;
        night = mix(vec3(.012, .024, .048), night, smoothstep(-.65, .08, ray.y));
        vec3 gold = vec3(.04, .022, .007) + vec3(.12, .055, .009) * opening * horizon;
        gl_FragColor = vec4(mix(night, gold, subjective), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  constructor(root: THREE.Group) {
    this.group.name = 'machine-city-exterior'; this.group.userData.distantBackdrop = true; root.add(this.group);
    [this.metal, this.ribs, this.circuits, this.sky].forEach(material => this.materials.add(material));
    const domeGeometry = new THREE.SphereGeometry(900, 32, 20); this.geometries.add(domeGeometry);
    const dome = new THREE.Mesh(domeGeometry, this.sky); dome.name = 'machine-city-clouds'; dome.renderOrder = -1000;
    this.group.add(dome);

    const towers: { x: number; z: number; base: number; height: number; radius: number; turn: number }[] = [];
    for (let layer = 0; layer < 3; layer++) {
      const count = [18, 32, 50][layer], distance = [106, 185, 295][layer];
      for (let i = 0; i < count; i++) {
        const angle = (i + layer * .37) / count * Math.PI * 2;
        const offset = Math.sin(i * 3.71 + layer) * 12, base = -135 - layer * 46;
        const height = 110 + layer * 58 + (Math.sin(i * 7.17 + layer * 2.9) + 1) * 31;
        towers.push({ x: Math.cos(angle) * (distance + offset), z: Math.sin(angle) * (distance + offset),
          base, height, radius: 6 + layer * 3 + (Math.sin(i * 2.1) + 1) * 2.2, turn: angle + .3 });
      }
    }
    const profile = [[.9, -1], [.84, 0], [.98, .12], [.84, .34], [1, .39], [.68, .53], [.73, .65], [.28, .82], [.11, 1], [.005, 1.09]];
    const trunks = this.batch(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 16), this.metal, towers.length, 'machine-city-towers');
    const collars = this.batch(new THREE.TorusGeometry(1, .045, 4, 12).rotateX(Math.PI / 2), this.ribs, towers.length * 15, 'machine-city-collars');
    const fins = this.batch(new THREE.CylinderGeometry(.035, .065, 1, 5), this.ribs, towers.length * 8, 'machine-city-spines');
    const modules = this.batch(new THREE.BoxGeometry(1, 1, 1), this.metal, towers.length * 48, 'machine-city-machinery');
    const lights = this.batch(new THREE.BoxGeometry(1, 1, 1), this.circuits, towers.length * 48, 'machine-city-running-lights');
    const transform = new THREE.Object3D(), tint = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    towers.forEach((tower, index) => {
      const { x, z, base, height, radius, turn } = tower;
      transform.position.set(x, base, z); transform.rotation.set(0, turn, 0); transform.scale.set(radius, height, radius);
      transform.updateMatrix(); trunks.setMatrixAt(index, transform.matrix);
      trunks.setColorAt(index, tint.setScalar(.67 + (Math.sin(index * 5.11) + 1) * .15));
      for (let band = 0; band < 15; band++) {
        const y = .05 + band * .052, r = radius * (y < .42 ? .92 : y < .63 ? .72 : .52 - (y - .63) * 1.1);
        transform.position.set(x, base + height * y, z); transform.rotation.set(0, turn, 0); transform.scale.set(r, 1.5, r);
        transform.updateMatrix(); collars.setMatrixAt(index * 15 + band, transform.matrix);
      }
      for (let side = 0; side < 8; side++) {
        const angle = turn + side / 8 * Math.PI * 2;
        const foot = new THREE.Vector3(x + Math.cos(angle) * radius * 1.07, base + height * .05, z + Math.sin(angle) * radius * 1.07);
        const tip = new THREE.Vector3(x + Math.cos(angle) * radius * .14, base + height * (1.01 + side % 3 * .026), z + Math.sin(angle) * radius * .14);
        const axis = tip.clone().sub(foot);
        transform.position.copy(foot).addScaledVector(axis, .5); transform.quaternion.setFromUnitVectors(up, axis.clone().normalize());
        transform.scale.set(radius, axis.length(), radius); transform.updateMatrix(); fins.setMatrixAt(index * 8 + side, transform.matrix);
        for (let row = 0; row < 6; row++) {
          const y = .08 + row * .103, r = radius * (y < .42 ? .92 : .72);
          const id = index * 48 + side * 6 + row;
          transform.position.set(x + Math.cos(angle) * r, base + height * y, z + Math.sin(angle) * r);
          transform.rotation.set(0, Math.PI / 2 - angle, .04 * Math.sin(id));
          transform.scale.set(radius * .38, height * .034, .9 + row % 3 * .6); transform.updateMatrix(); modules.setMatrixAt(id, transform.matrix);
          transform.position.x += Math.cos(angle) * 1.3; transform.position.z += Math.sin(angle) * 1.3;
          transform.position.y += height * .013;
          transform.scale.set(radius * .26, .1 + index % 3 * .06, .13); transform.updateMatrix(); lights.setMatrixAt(id, transform.matrix);
          lights.setColorAt(id, tint.setScalar(.24 + (Math.sin(id * 9.1) + 1) * .33));
        }
      }
    });
    const cables: THREE.BufferGeometry[] = [];
    // Heavy conduits join neighboring near towers below the open approach.
    for (let i = 0; i < 18; i++) for (let strand = 0; strand < 3; strand++) {
      const a = towers[i], b = towers[(i + 1) % 18], y = -32 - strand * 1.4;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(a.x, y, a.z), new THREE.Vector3(a.x * .67 + b.x * .33, y - 9, a.z * .67 + b.z * .33),
        new THREE.Vector3(a.x * .33 + b.x * .67, y - 10, a.z * .33 + b.z * .67), new THREE.Vector3(b.x, y, b.z),
      ]);
      cables.push(new THREE.TubeGeometry(curve, 16, .32 + strand * .11, 5, false));
    }
    const conduitGeometry = mergeGeometries(cables)!; cables.forEach(geometry => geometry.dispose()); this.geometries.add(conduitGeometry);
    const conduits = new THREE.Mesh(conduitGeometry, this.ribs); conduits.name = 'machine-city-conduits'; this.group.add(conduits);
  }

  private batch(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string): THREE.InstancedMesh {
    this.geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name; this.group.add(mesh); return mesh;
  }

  setPerception(subjective: boolean): void {
    this.sky.uniforms.subjective.value = subjective ? 1 : 0;
    this.circuits.color.setHex(subjective ? 0xeeb665 : 0x739bda);
    for (const material of [this.metal, this.ribs]) {
      material.emissive.setHex(subjective ? 0xff9b24 : 0);
      material.emissiveIntensity = subjective ? .085 : 0;
    }
  }

  dispose(): void {
    this.group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
  }
}
