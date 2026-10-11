import * as THREE from 'three';
import { farewellPose, newFarewell, LOGOS_WRECK, type FarewellEncounter } from '@auto_matrix/shared';
import { LogosCabinFrame } from './LogosCabinFrame.js';
import { LogosImpactRenderer } from './LogosImpactRenderer.js';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The crushed Logos cockpit after it has bored into the Machine City tower. */
export class LogosWreckRenderer {
  private group = new THREE.Group();
  private cabinFrame!: LogosCabinFrame;
  private impact!: LogosImpactRenderer;
  private fire = new THREE.Group();
  private golden = new THREE.Group();
  private sparks: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private fireLights: THREE.PointLight[] = [];
  private fireMaterial!: THREE.ShaderMaterial;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private lights: THREE.Light[] = [];

  constructor(root: THREE.Group) {
    root.add(this.group); this.group.add(this.fire, this.golden);
    this.buildWreck(); this.buildMachineSight();
    batchStaticGeometry(this.group, new Set([...this.sparks, ...this.flames])).forEach(geometry => this.geometries.add(geometry));
    this.impact = new LogosImpactRenderer(this.group, this.cabinFrame.group);
    this.impact.showWreck({ x: LOGOS_WRECK.cabin.x, y: LOGOS_WRECK.cabin.y, z: LOGOS_WRECK.cabin.z - 9.77 });
    this.update(undefined, 0, false);
  }

  private material(color: number, metalness: number, roughness: number, emissive = 0, intensity = 0,
    transparent = false, opacity = 1): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity,
      transparent, opacity, depthWrite: !transparent, side: THREE.DoubleSide });
    this.materials.add(material); return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group,
    name?: string): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); if (name) mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  private buildWreck(): void {
    const hull = this.material(0x222d30, .9, .38);
    const torn = this.material(0x596164, .82, .46);
    const black = this.material(0x0d1517, .62, .68);
    const deadScreen = this.material(0x263438, .28, .3, 0x102b2b, .28);
    const ember = this.material(0xff7a22, .1, .42, 0xff5b16, 5.2, true, .82);

    this.cabinFrame = new LogosCabinFrame(this.group, true);
    this.cabinFrame.group.position.set(LOGOS_WRECK.cabin.x, LOGOS_WRECK.cabin.y, LOGOS_WRECK.cabin.z);
    this.cabinFrame.group.name = 'logos-wreck-hull';
    this.cabinFrame.group.getObjectByName('logos-cabin-windscreen')!.name = 'logos-wreck-windshield';
    // Preserve the supported bodies and tilted deck. The broken aft deck also
    // remains reachable by characters saved at the former distant entry.
    const deck = this.mesh(new THREE.BoxGeometry(8.9, .7, 46), black, this.group, 'logos-wreck-deck');
    deck.position.set(0, -.35, 2); deck.rotation.z = -.035;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const x = LOGOS_WRECK.cabin.x + side * (3.05 + Math.sin(i * 1.7) * .2), z = -7.5 + i * 3.4;
        const rib = this.mesh(new THREE.CylinderGeometry(.09, .09, 3.4, 8), torn);
        rib.position.set(x, 1.55, z); rib.rotation.z = side * (.12 + i % 3 * .06);
        const panel = this.mesh(new THREE.BoxGeometry(.18, 1.25, 3.05), hull);
        panel.position.set(x + side * .2, .55, z); panel.rotation.z = side * .17;
      }
      // Cabling ripped out of the roof and stopped instruments keep the old
      // flight cabin recognisable even though the upper skin is torn open.
      for (const z of [-14.28, -12.53]) {
        const frame = this.mesh(new THREE.BoxGeometry(.74, .74, .5), black);
        frame.position.set(LOGOS_WRECK.cabin.x + side * 2.57, 2.83, z);
        const screen = this.mesh(new THREE.BoxGeometry(.61, .52, .025), deadScreen);
        screen.position.copy(frame.position); screen.position.z -= .263;
      }
      for (let i = 0; i < 4; i++) {
        const x = LOGOS_WRECK.cabin.x + side * (2.8 + i * .09);
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 4.18, -19.8),
          new THREE.Vector3(x + side * .1, 3.7, -18.5), new THREE.Vector3(x, 2.8 - i * .17, -17.7)]);
        this.mesh(new THREE.TubeGeometry(curve, 18, .028, 6, false), black);
      }
    }
    // Two small consoles replace the unrelated room-wide desk.
    const console = this.mesh(new THREE.BoxGeometry(1.38, .68, .65), hull, this.group, 'logos-wreck-console');
    console.position.set(0, 1.8, -18.13); console.rotation.x = -.16;
    const second = this.mesh(console.geometry.clone(), hull); second.position.set(2.7, 1.55, -18); second.rotation.set(-.24, 0, .17);
    for (const x of [0, 2.7]) {
      const screen = this.mesh(new THREE.BoxGeometry(.92, .48, .035), deadScreen);
      screen.position.set(x, 1.89, -17.78); screen.rotation.x = -.16;
    }
    // The displaced pilot chair supports Trinity's actual pelvis and upper back.
    // Its short front edge leaves her bent thighs and Neo's approach unobstructed.
    const chair = this.mesh(new THREE.BoxGeometry(1.65, .3, .85), black, this.group, 'logos-wreck-trinity-seat'); chair.position.set(0, 1.2, -15.98);
    const back = this.mesh(new THREE.BoxGeometry(1.65, 1.45, .25), black, this.group, 'logos-wreck-trinity-back'); back.position.set(.08, 2.55, -16.5); back.rotation.x = -.18;
    const mount = this.mesh(new THREE.BoxGeometry(1.1, 1.05, .62), hull, this.group, 'logos-wreck-chair-mount'); mount.position.set(0, .525, -16.05);
    const otherSeat = this.mesh(new THREE.BoxGeometry(1.35, .42, 3.2), black); otherSeat.position.set(2.65, .55, -12.8); otherSeat.rotation.x = -.18;
    const otherBack = this.mesh(new THREE.BoxGeometry(1.23, 3.2, .42), black); otherBack.position.set(2.65, 2.05, -11.55); otherBack.rotation.x = -.28;

    for (const x of [0, 2.65]) {
      const headrest = this.mesh(new THREE.TorusGeometry(.45, .045, 8, 32), torn);
      headrest.position.set(x + .08, 3.48, x ? -11.83 : -16.7); headrest.rotation.x = -.18;
      for (let i = -4; i <= 4; i++) {
        const offset = i * .09, length = Math.sqrt(.44 ** 2 - offset ** 2) * 2;
        const net = this.mesh(new THREE.BoxGeometry(.014, length, .014), black);
        net.position.copy(headrest.position); net.position.x += offset; net.rotation.x = -.18;
      }
    }

    const rebar = new THREE.Group(); rebar.name = 'logos-wreck-rebar'; this.group.add(rebar);
    // Intrusions from the broken windscreen remain fixed around the actual seated torso.
    // Keep their exposed ends behind the hands Neo reaches for, not across the kiss.
    const shafts = [
      [[-2.8, 4.8, -20.5], [-.42, 2.18, -15.62]],
      [[2.9, 4.1, -21], [.37, 2.68, -15.82]],
      [[.8, 3.8, -20], [.05, 2, -15.85]],
    ];
    for (const [index, [start, end]] of shafts.entries()) {
      const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), direction = b.clone().sub(a);
      const shaft = this.mesh(new THREE.CylinderGeometry(.075, .085, direction.length(), 10), torn, rebar, `logos-wreck-shaft-${index}`);
      shaft.position.copy(a).add(b).multiplyScalar(.5);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }

    this.fire.name = 'logos-wreck-fire';
    this.fireMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { time: { value: 0 } },
      vertexShader: `varying vec2 uvFire; void main() { uvFire = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec2 uvFire; uniform float time;
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453),f.x),
            mix(fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453),f.x),f.y); }
        void main() { float y=uvFire.y, n=noise(vec2(uvFire.x*5.,y*8.-time*3.));
          float x=abs(uvFire.x-.5+(n-.5)*.2*y), width=.31*(1.-y)+.018;
          float a=(1.-smoothstep(width-.045,width+.055,x))*smoothstep(0.,.08,y)*(1.-smoothstep(.65,1.,y+n*.18));
          vec3 color=mix(vec3(1.,.19,.018),vec3(1.,.77,.27),max(0.,1.-x/max(.02,width)-y*.45));
          gl_FragColor=vec4(color,a*.72); }` });
    this.materials.add(this.fireMaterial);
    for (let i = 0; i < 7; i++) {
      for (let cross = 0; cross < 2; cross++) {
        const flame = this.mesh(new THREE.PlaneGeometry(.85 + i % 3 * .2, 1.6 + i % 4 * .24), this.fireMaterial, this.fire);
        flame.position.set(i % 2 ? -2.15 : 4.85, .85 + i % 4 * .12, -19 + i * 4.8); flame.rotation.y = cross * Math.PI / 2;
        flame.castShadow = false; this.flames.push(flame);
      }
      if (i % 3 === 0) {
        const light = new THREE.PointLight(0xff6b24, 18, 12, 2); light.position.set(i % 2 ? -2.15 : 4.85, 1.5, -19 + i * 4.8);
        this.fire.add(light); this.fireLights.push(light); this.lights.push(light);
      }
    }
    for (let i = 0; i < 22; i++) {
      const spark = this.mesh(new THREE.SphereGeometry(.035 + i % 3 * .018, 5, 4), ember, this.fire);
      spark.position.set(i % 2 ? -1.8 : 4.5, .7 + i % 5 * .45, -19 + Math.floor(i / 4) * 7 + i % 3);
      this.sparks.push(spark);
    }

    const cold = new THREE.HemisphereLight(0x78969a, 0x090d0e, .6); this.group.add(cold); this.lights.push(cold);
    const slit = new THREE.DirectionalLight(0x94b7cc, 1.1); slit.position.set(-8, 18, -24); slit.target.position.set(0, 1.8, -15);
    this.group.add(slit, slit.target); this.lights.push(slit);
  }

  private buildMachineSight(): void {
    this.golden.name = 'logos-wreck-golden-vision';
    const gold = this.material(0xffbd43, .2, .18, 0xff9d17, 4.8, true, .72);
    const dim = this.material(0xa76519, .38, .3, 0x8d4d0b, 1.8, true, .46);
    for (let i = 0; i < 26; i++) {
      const row = Math.floor(i / 9);
      const ring = this.mesh(new THREE.TorusGeometry(.75 + i % 4 * .32, .025 + i % 2 * .012, 5, 18, Math.PI * (1.25 + i % 3 * .2)), i % 4 ? gold : dim, this.golden);
      ring.position.set(-9 + i % 9 * 2.25, .5 + i % 6 * 1.45, (row === 1 ? -18 : -24 + row * 18) + Math.sin(i * 1.7) * 3);
      ring.rotation.set(Math.PI / 2 + (i % 3 - 1) * .4, i * .27, i * .19);
    }
    for (let i = 0; i < 10; i++) {
      const filament = this.mesh(new THREE.CylinderGeometry(.018, .045, 9 + i % 4 * 3, 5), i % 2 ? gold : dim, this.golden);
      filament.position.set(-10 + i * 2.2, 5 + i % 3 * 2, 8 + Math.sin(i) * 6);
      filament.rotation.set(.45 + i % 3 * .18, 0, -.9 + i * .18);
    }
  }

  update(encounter: FarewellEncounter | undefined, elapsed: number, firstPerson = false, neoFirstPerson = false): void {
    const state = encounter ?? newFarewell(); const pose = farewellPose(state);
    const time = encounter?.total ?? elapsed;
    this.fireMaterial.uniforms.time.value = time;
    this.golden.visible = Boolean(encounter && neoFirstPerson);
    this.golden.rotation.y = Math.sin(time * .13) * .025;
    this.golden.children.forEach((child, index) => {
      child.scale.setScalar(.92 + Math.sin(time * 2.2 + index * .7) * .08);
    });
    const quiet = state.phase === 'still' ? .32 : 1;
    this.flames.forEach((flame, index) => {
      flame.scale.set(.8 + Math.sin(time * 9 + index) * .2, quiet * (.72 + Math.sin(time * 12 + index * 2) * .24), .8);
    });
    this.fireLights.forEach((light, index) => { light.intensity = quiet * (15 + Math.sin(time * 11 + index) * 5); });
    this.sparks.forEach((spark, index) => {
      const cycle = (time * (.7 + index % 4 * .12) + index * .37) % 1;
      spark.position.y = .7 + cycle * (3.5 + index % 5); spark.visible = cycle < quiet * .88;
    });
    this.fire.position.y = pose.trinity.breath * .03;
  }

  dispose(): void {
    this.impact.dispose();
    this.cabinFrame.dispose();
    this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
