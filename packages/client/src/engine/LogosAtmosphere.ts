import * as THREE from 'three';
import { logosCloudTop, type LogosFlight } from '@auto_matrix/shared';

/** One cloud layer, viewed from below, inside and above the continuous flight path. */
export class LogosAtmosphere {
  private panorama?: THREE.Texture;
  private disposed = false;
  private material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { eye: { value: new THREE.Vector3() }, cloudTop: { value: 62 }, time: { value: 0 },
      panorama: { value: null }, hasPanorama: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 eye;
      uniform float cloudTop;
      uniform float time;
      uniform sampler2D panorama;
      uniform float hasPanorama;
      varying vec3 direction;
      float hash(vec3 p) {
        p = fract(p * .1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float noise(vec3 p) {
        vec3 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(cell), hash(cell + vec3(1,0,0)), f.x),
          mix(hash(cell + vec3(0,1,0)), hash(cell + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(cell + vec3(0,0,1)), hash(cell + vec3(1,0,1)), f.x),
          mix(hash(cell + vec3(0,1,1)), hash(cell + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float density(vec3 p) {
        float h = (p.y - cloudTop + 28.0) / 28.0;
        vec3 q = p * vec3(.035, .05, .035) + vec3(time * .012, 0, time * .007);
        float billows = noise(q) * .68 + noise(q * 2.87 + 17.4) * .32;
        float crown = .94 + billows * .06;
        float edge = smoothstep(0.0, .12, h) * (1.0 - smoothstep(crown - .13, crown, h));
        return edge * (.09 + smoothstep(.22, .72, billows) * .2);
      }
      void main() {
        vec3 ray = normalize(direction), sun = normalize(vec3(-.44, .18, -.87));
        float daylight = smoothstep(cloudTop - 1.5, cloudTop + 2.5, eye.y);
        float horizon = exp(-max(0.0, ray.y) * 4.0);
        vec3 sky = mix(vec3(.075, .17, .31), vec3(.71, .64, .48), horizon);
        float alignment = max(0.0, dot(ray, sun));
        sky += vec3(1.0, .67, .29) * pow(alignment, 38.0) * .24;
        sky += vec3(1.0, .78, .47) * pow(alignment, 560.0) * .8;
        sky += vec3(7.0, 5.8, 4.1) * smoothstep(.99972, .99988, alignment);
        vec2 uv = vec2(fract(.5 + (atan(ray.x, -ray.z) + .468) / 6.283185), .5 + asin(clamp(ray.y, -1.0, 1.0)) / 3.141593);
        sky = mix(sky, texture2D(panorama, uv).rgb, hasPanorama);
        vec3 storm = mix(vec3(.012, .019, .029), vec3(.027, .039, .057), smoothstep(-.08, .08, ray.y));
        sky = mix(storm, sky, daylight);
        float dy = abs(ray.y) < .001 ? (ray.y < 0.0 ? -.001 : .001) : ray.y;
        float a = (cloudTop - 28.0 - eye.y) / dy, b = (cloudTop - eye.y) / dy;
        float entry = max(0.0, min(a, b)), exit = min(1100.0, max(a, b));
        float length = max(0.0, exit - entry), stride = min(18.0, length / 24.0);
        float offset = hash(vec3(floor(gl_FragCoord.xy), 7.0));
        vec3 light = vec3(0.0); float transmission = 1.0;
        for (int i = 0; i < 24; i++) {
          if (length <= 0.0 || transmission < .015) break;
          float distance = entry + (float(i) + offset) * stride;
          vec3 p = eye + ray * distance;
          float d = density(p), opacity = 1.0 - exp(-d * stride);
          float topLight = smoothstep(cloudTop - 19.0, cloudTop - 1.0, p.y);
          float silver = pow(alignment, 12.0) * topLight;
          vec3 shade = mix(vec3(.027, .039, .057), vec3(.85, .73, .53), topLight);
          shade += vec3(.22, .17, .1) * silver;
          shade *= .74 + (1.0 - clamp(d * 3.0, 0.0, 1.0)) * .4;
          shade *= mix(.24, 1.0, daylight);
          shade = mix(shade, sky, (.65 + smoothstep(25.0, 100.0, distance) * .25) * daylight);
          light += transmission * opacity * shade;
          transmission *= 1.0 - opacity;
        }
        gl_FragColor = vec4(light + sky * transmission, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  private dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), this.material);

  constructor(root: THREE.Group) {
    if (typeof document !== 'undefined') {
      this.panorama = new THREE.TextureLoader().load('/assets/environments/logos-cloud-sea.png', texture => {
        if (this.disposed) { texture.dispose(); return; }
        this.material.uniforms.hasPanorama.value = 1;
      });
      this.panorama.colorSpace = THREE.SRGBColorSpace; this.panorama.wrapS = THREE.RepeatWrapping;
      this.material.uniforms.panorama.value = this.panorama;
    }
    this.dome.name = 'logos-atmosphere'; this.dome.frustumCulled = false; this.dome.renderOrder = -1000;
    this.dome.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldPosition(this.material.uniforms.eye.value);
      root.worldToLocal(this.material.uniforms.eye.value);
      this.dome.position.copy(this.material.uniforms.eye.value);
      this.dome.updateMatrixWorld();
      this.dome.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, this.dome.matrixWorld);
    };
    root.add(this.dome);
  }

  update(flight: LogosFlight): void {
    this.material.uniforms.cloudTop.value = logosCloudTop(flight);
    this.material.uniforms.time.value = flight.elapsed;
  }

  dispose(): void {
    this.disposed = true; this.panorama?.dispose();
    this.dome.removeFromParent(); this.dome.geometry.dispose(); this.material.dispose();
  }
}
