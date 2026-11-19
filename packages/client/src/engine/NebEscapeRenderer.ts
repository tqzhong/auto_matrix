import * as THREE from 'three';
import { NEB_ESCAPE, type ShipLossEncounter } from '@auto_matrix/shared';

/** Exterior, blast and falling hull panels use the saved evacuation clock. */
export class NebEscapeRenderer {
  readonly root = new THREE.Group();
  private hull = new THREE.Group();
  private blast = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures: THREE.Texture[] = [];
  private fragments: { mesh: THREE.Mesh; origin: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  private fire: THREE.Mesh[] = [];
  private bomb = new THREE.Group();
  private wreckFloor: THREE.Mesh;
  private lamp = new THREE.PointLight(0xffa452, 0, 100, 2);
  private flame = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { age: { value: 0 }, fade: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float age; uniform float fade;
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+1.,vec2(127.1,311.7))))*43758.5453);
        return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}
      void main(){vec2 q=(vUv-.5)*2.;float n=noise(vUv*8.-vec2(0,age*1.4))*.6+noise(vUv*19.-vec2(age*.3,age*2.))*.4;
        float plume=(1.-smoothstep(.35,1.,length(q*vec2(1.,.7))))*smoothstep(.15,.7,n);
        float heat=exp(-age*.85)*smoothstep(.15,.8,n);
        vec3 c=mix(vec3(.075,.08,.07),mix(vec3(1.,.12,.009),vec3(1.,.63,.13),n),heat);
        gl_FragColor=vec4(c,plume*fade*.78);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  private metal = this.material(new THREE.MeshStandardMaterial({ color: 0x303735, metalness: .78, roughness: .67 }));
  private edge = this.material(new THREE.MeshStandardMaterial({ color: 0x68736c, metalness: .72, roughness: .52 }));
  private concrete = this.material(new THREE.MeshStandardMaterial({ color: 0x404440, roughness: .97 }));
  private black = this.material(new THREE.MeshStandardMaterial({ color: 0x121917, roughness: .88 }));
  private glow = this.material(new THREE.MeshBasicMaterial({ color: 0x94c7bc, toneMapped: false }));
  constructor(parent: THREE.Group) {
    this.root.name = 'neb-escape-exterior'; this.root.visible = false; parent.add(this.root);
    this.hull.name = 'neb-exterior-hull'; this.root.add(this.hull);
    this.blast.name = 'neb-destruction'; this.root.add(this.blast); this.materials.add(this.flame);
    if (typeof document !== 'undefined') {
      const load = (kind: string) => {
        const texture = new THREE.TextureLoader().load(`/assets/surfaces/seaside_rock-${kind}.jpg`);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 5); texture.anisotropy = 4;
        if (kind === 'color') texture.colorSpace = THREE.SRGBColorSpace;
        this.textures.push(texture); return texture;
      };
      this.concrete.map = load('color'); this.concrete.normalMap = load('normal'); this.concrete.roughnessMap = load('roughness');
      this.concrete.normalScale.set(.5, .5); this.concrete.color.setHex(0x777e71); this.concrete.needsUpdate = true;
    }
    this.tunnel(); this.ship(); this.destruction();
    this.wreckFloor = this.box(this.blast, this.black, 0, -.35, 0, 44, .7, 90, 'neb-charred-deck-floor');
    this.bomb.name = 'neb-incoming-bomb'; this.root.add(this.bomb);
    this.mesh(this.bomb, new THREE.SphereGeometry(.8, 20, 12), this.metal, 'neb-bomb-shell');
    for (let index = 0; index < 3; index++) {
      const ring = this.mesh(this.bomb, new THREE.TorusGeometry(.86, .12, 8, 24), this.edge, `neb-bomb-ring-${index}`);
      ring.rotation.set(index * 1.1, index * .8, 0);
    }
    this.lamp.name = 'neb-blast-light'; this.lamp.position.set(0, 9, 34); this.root.add(this.lamp);
  }
  private material<T extends THREE.Material>(material: T): T { this.materials.add(material); return material; }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, name: string): THREE.Mesh {
    const mesh = this.mesh(parent, new THREE.BoxGeometry(w, h, d), material, name); mesh.position.set(x, y, z); return mesh;
  }
  private tunnel(): void {
    const route = NEB_ESCAPE;
    this.box(this.root, this.concrete, 0, -.35, 57.5, route.routeHalfWidth * 2, .7, 25, 'neb-outside-floor');
    for (const side of [-1, 1]) {
      const rock = new THREE.BoxGeometry(1, 14, 25, 1, 18, 32), vertices = rock.getAttribute('position');
      for (let index = 0; index < vertices.count; index++) {
        const y = vertices.getY(index), z = vertices.getZ(index);
        const relief = (1 + Math.sin(y * .63 + Math.sin(z * .41)) * Math.cos(z * .72)) * .22;
        vertices.setX(index, vertices.getX(index) + side * relief);
      }
      rock.computeVertexNormals();
      const wall = this.mesh(this.root, rock, this.concrete, `neb-tunnel-wall-${side}`); wall.position.set(side * (route.routeHalfWidth + .5), 7, 57.5);
      for (let y = 2; y < 11; y += 3) {
        const pipe = this.mesh(this.root, new THREE.CylinderGeometry(.17, .17, 25, 12), this.edge, `neb-tunnel-conduit-${side}-${y}`);
        pipe.position.set(side * 7.55, y, 57.5); pipe.rotation.x = Math.PI / 2;
      }
      for (let z = 47; z <= 68; z += 7) {
        this.box(this.root, this.metal, side * 7.8, 6, z, .35, 12, .4, `neb-tunnel-rib-${side}-${z}`);
        this.box(this.root, this.glow, side * 7.5, 8.5, z, .1, .25, 1.4, `neb-tunnel-lamp-${side}-${z}`);
        const light = new THREE.PointLight(0x9eafa1, 90, 16, 2); light.position.set(side * 6.8, 8, z); this.root.add(light);
      }
    }
    this.box(this.root, this.concrete, 0, 14.2, 57.5, 17, .6, 25, 'neb-tunnel-ceiling');
    this.box(this.root, this.concrete, 0, 7, route.routeEnd + .5, 17, 14, 1, 'neb-tunnel-end');
    for (let z = 46; z < 70; z += 1.2) this.box(this.root, this.edge, 0, .025, z, 15.6, .045, .035, `neb-tunnel-floor-joint-${z}`);
    for (const side of [-1, 1]) this.box(this.root, this.edge, side * 5.9, .18, 42.5, .22, .35, 5.8, `neb-hatch-sill-${side}`);
  }
  private ship(): void {
    // An armored octagonal shell retains an actual aperture at the stern.
    for (const side of [-1, 1]) {
      this.box(this.hull, this.metal, side * 22.3, 7, 0, .7, 12, 89, `neb-outer-side-${side}`);
      const shoulder = this.box(this.hull, this.edge, side * 19.4, 14.4, 0, 7, .55, 89, `neb-outer-shoulder-${side}`); shoulder.rotation.z = side * -.52;
      this.box(this.hull, this.metal, side * 14.2, 7.5, NEB_ESCAPE.sternZ + .45, 16.6, 15, .65, `neb-outer-stern-${side}`);
      for (let z = -32; z <= 31; z += 21) {
        const pad = this.mesh(this.hull, new THREE.CylinderGeometry(3.5, 3.9, 1.4, 28), this.metal, `neb-hover-pad-${side}-${z}`);
        pad.position.set(side * 24, 1.2, z); pad.rotation.z = side * -.23;
        const ring = this.mesh(this.hull, new THREE.TorusGeometry(2.75, .2, 8, 32), this.glow, `neb-hover-ring-${side}-${z}`);
        ring.position.copy(pad.position).add(new THREE.Vector3(side * .15, -.75, 0)); ring.rotation.x = Math.PI / 2;
        this.box(this.hull, this.edge, side * 21.5, 3, z, 6.5, .7, .8, `neb-hover-strut-${side}-${z}`);
      }
      for (let z = -39; z < 40; z += 10) {
        this.box(this.hull, this.edge, side * 22.75, 7, z, .12, 10.8, .24, `neb-outer-seam-${side}-${z}`);
        for (let y = 2; y < 13; y += 2.5) {
          const bolt = this.mesh(this.hull, new THREE.CylinderGeometry(.1, .1, .15, 8), this.edge, `neb-outer-bolt-${side}-${z}-${y}`);
          bolt.rotation.z = Math.PI / 2; bolt.position.set(side * 22.85, y, z);
        }
      }
    }
    this.box(this.hull, this.metal, 0, 16.15, 0, 33, .7, 89, 'neb-armored-roof');
    this.box(this.hull, this.metal, 0, 12.5, NEB_ESCAPE.sternZ + .45, NEB_ESCAPE.hatch.width, 7, .65, 'neb-outer-stern-lintel');
    for (let z = -35; z <= 35; z += 14) this.box(this.hull, this.edge, 0, 16.6, z, 31, .15, .25, `neb-roof-seam-${z}`);
    this.box(this.hull, this.black, 0, 5, -45, 34, 10, 2, 'neb-forward-engine-block');
    for (const side of [-1, 1]) {
      const antenna = this.mesh(this.hull, new THREE.CylinderGeometry(.1, .25, 7, 12), this.edge, `neb-aerial-${side}`);
      antenna.position.set(side * 9, 19, -29); antenna.rotation.z = side * .4;
    }
  }
  private destruction(): void {
    for (let index = 0; index < 36; index++) {
      const angle = index * 2.39996, z = -35 + index % 9 * 8;
      const mesh = this.box(this.blast, index % 3 ? this.metal : this.edge, 0, 0, 0, 1.4 + index % 4, .16, 2.1 + index % 3, `neb-hull-fragment-${index}`);
      this.fragments.push({ mesh, origin: new THREE.Vector3(Math.sin(angle) * 19, 7 + Math.cos(angle) * 6, z),
        velocity: new THREE.Vector3(Math.sin(angle) * (3 + index % 4), 6 + index % 5, Math.cos(angle) * 2.5),
        spin: new THREE.Vector3(.7 + index % 3, Math.sin(angle), .4 + index % 2) });
    }
    for (let index = 0; index < 7; index++) {
      const plume = this.mesh(this.blast, new THREE.PlaneGeometry(26, 30), this.flame, `neb-fire-plume-${index}`);
      plume.position.set(index % 2 ? -7 : 7, 9, -24 + index * 10); plume.rotation.y = index * .7;
      plume.castShadow = plume.receiveShadow = false;
      this.fire.push(plume);
    }
  }
  update(loss: ShipLossEncounter | undefined): void {
    this.root.visible = Boolean(loss);
    if (!loss) { this.lamp.intensity = 0; return; }
    const destroyed = ['destroying', 'mourning', 'escaped', 'failed'].includes(loss.phase);
    const t = loss.phase === 'failed' ? NEB_ESCAPE.blastSeconds : loss.elapsed ?? 0;
    this.hull.visible = !destroyed || t < .85; this.blast.visible = destroyed;
    this.wreckFloor.visible = destroyed && t >= .85;
    this.bomb.visible = loss.phase === 'destroying' && t < .55;
    this.bomb.position.lerpVectors(new THREE.Vector3(28, 24, 45), new THREE.Vector3(0, 9, 25), Math.min(1, t / .55));
    this.bomb.rotation.set(t * 5, t * 4, t * 2);
    const fireAge = Math.max(0, t - .55);
    this.flame.uniforms.age.value = fireAge; this.flame.uniforms.fade.value = destroyed ? Math.min(1, fireAge * 3) : 0;
    this.lamp.intensity = destroyed && t >= .55 ? 1400 * Math.exp(-fireAge * 1.15) + 90 : 0;
    for (const [index, fragment] of this.fragments.entries()) {
      const a = Math.max(0, t - .2 - index % 4 * .06);
      fragment.mesh.visible = destroyed && a > 0;
      fragment.mesh.position.copy(fragment.origin).addScaledVector(fragment.velocity, a);
      fragment.mesh.position.y = Math.max(.12, fragment.origin.y + fragment.velocity.y * a - 4.5 * a * a);
      const rotation = Math.min(a, 2.5);
      fragment.mesh.rotation.set(rotation * fragment.spin.x, rotation * fragment.spin.y, rotation * fragment.spin.z);
    }
  }
  dispose(): void {
    this.root.removeFromParent(); this.root.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); this.root.clear();
  }
}
