import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** All shards sample one live reflection. Their seams and small optical offsets
 * close together; the glass itself never shrinks or slides during the repair. */
export function createMirrorSurface(): Reflector {
  const seeds = [[-.43, .75], [-.72, .03], [-.55, -.67], [.11, .22], [.63, .64], [.72, -.17], [.17, -.66], [.01, .94], [-.08, -.12]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const frame = [new THREE.Vector2(-1, -1), new THREE.Vector2(1, -1), new THREE.Vector2(1, 1), new THREE.Vector2(-1, 1)];
  const positions: number[] = [], fractures: number[] = [], edges: number[] = [];
  for (const [index, seed] of seeds.entries()) {
    let polygon = frame;
    // Clip the straight-sided glass against the perpendicular bisectors of each shard.
    for (const other of seeds) {
      if (other === seed) continue;
      const normal = other.clone().sub(seed); const offset = (other.lengthSq() - seed.lengthSq()) / 2;
      const clipped: THREE.Vector2[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const da = a.dot(normal) - offset, db = b.dot(normal) - offset;
        if (da <= 0) clipped.push(a);
        if ((da < 0) !== (db < 0)) clipped.push(a.clone().lerp(b, da / (da - db)));
      }
      polygon = clipped;
    }
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const edge = b.clone().sub(a); const toSeed = seed.clone().sub(a);
      const height = Math.abs(edge.cross(toSeed)) / edge.length();
      for (const [vertex, point] of [seed, a, b].entries()) {
        positions.push(point.x, point.y, 0);
        fractures.push(Math.sin(index * 2.7 + .4) * .045, Math.cos(index * 1.8 + .8) * .034, index % 3 * .12);
        edges.push(vertex === 0 ? height : 0);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('fracture', new THREE.Float32BufferAttribute(fractures, 3));
  geometry.setAttribute('edgeDistance', new THREE.Float32BufferAttribute(edges, 1));
  geometry.computeVertexNormals();
  const mirror = new Reflector(geometry, { color: 0x82918a, textureWidth: 768, textureHeight: 1024, clipBias: .003, multisample: 0 });
  const shader = mirror.material as THREE.ShaderMaterial;
  shader.uniforms.healProgress = { value: 0 };
  shader.uniforms.liquidTime = { value: -1 }; shader.uniforms.liquidAmount = { value: 0 };
  shader.uniforms.liquidContact = { value: new THREE.Vector2(.573, -.113) };
  shader.vertexShader = shader.vertexShader.replace('varying vec4 vUv;', `varying vec4 vUv;
    attribute vec3 fracture;
    attribute float edgeDistance;
    uniform float healProgress;
    varying vec2 vMirrorPoint;
    varying float vShardEdge;
    varying float vFracture;`)
    .replace('vUv = textureMatrix * vec4( position, 1.0 );', `vMirrorPoint = position.xy;
      vShardEdge = edgeDistance;
      vFracture = 1.0 - smoothstep(fracture.z, 1.0, healProgress);
      vUv = textureMatrix * vec4(position + vec3(fracture.xy * vFracture, 0.0), 1.0);`);
  shader.fragmentShader = shader.fragmentShader.replace('varying vec4 vUv;', `varying vec4 vUv;
    varying vec2 vMirrorPoint;
    varying float vShardEdge;
    varying float vFracture;
    uniform float liquidTime;
    uniform float liquidAmount;
    uniform vec2 liquidContact;`)
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `vec2 mirrorUv = vUv.xy / vUv.w;
      vec2 fromContact = vMirrorPoint - liquidContact;
      float radius = length(fromContact);
      float front = min(1.4, max(0.0, liquidTime) * .36);
      float ring = step(0.0, liquidTime) * exp(-pow((radius - front) * 12.0, 2.0)) * cos((radius - front) * 45.0) * (1.0 - smoothstep(2.8, 4.5, liquidTime));
      float spread = step(0.0, liquidTime) * (1.0 - smoothstep(front - .12, front + .04, radius));
      vec2 direction = normalize(fromContact + vec2(.0001));
      vec2 liquidOffset = direction * (ring * .012 + spread * sin(radius * 28.0 - liquidTime * 8.0) * .003);
      vec4 base = texture2D(tDiffuse, mirrorUv + liquidOffset);
      float aa = max(fwidth(vShardEdge), .0001);
      float seam = (1.0 - smoothstep(.0005 * vFracture, .0005 * vFracture + aa, vShardEdge)) * vFracture;
      float bevel = (1.0 - smoothstep(.0008 * vFracture, .0025 * vFracture + aa, vShardEdge)) * vFracture;
      base.rgb += vec3(.11, .13, .12) * bevel;
      base.rgb = mix(base.rgb, vec3(.016, .023, .019), seam * .92);
      base.rgb += vec3(.025, .03, .027) * max(0.0, ring);
      base.rgb = mix(base.rgb, vec3(.64, .7, .67), spread * liquidAmount * .14);`);
  return mirror;
}
