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
  boundMirrorReflection(mirror);
  return mirror;
}

function boundMirrorReflection(mirror: Reflector): void {
  mirror.geometry.computeBoundingBox();
  const bounds = mirror.geometry.boundingBox!;
  const fracture = mirror.geometry.getAttribute('fracture'); let offsetX = 0, offsetY = 0;
  for (let i = 0; i < fracture.count; i++) {
    offsetX = Math.max(offsetX, Math.abs(fracture.getX(i))); offsetY = Math.max(offsetY, Math.abs(fracture.getY(i)));
  }
  const corners = [bounds.min.x - offsetX, bounds.max.x + offsetX].flatMap(x =>
    [bounds.min.y - offsetY, bounds.max.y + offsetY].map(y => new THREE.Vector4(x, y, 0, 1)));
  const sample = new THREE.Vector4(), crop = new THREE.Matrix4();
  const target = mirror.getRenderTarget();
  const textureMatrix = (mirror.material as THREE.ShaderMaterial).uniforms.textureMatrix.value as THREE.Matrix4;
  const reflect = mirror.onBeforeRender.bind(mirror);
  mirror.onBeforeRender = (...args) => {
    const renderer = args[0], render = renderer.render;
    // Reflector computes its eye, oblique clip plane and texture coordinates
    // before calling render. Constrain that call while keeping its pixel map.
    renderer.render = (scene, camera) => {
      if (camera !== mirror.camera) return render.call(renderer, scene, camera);
      let left = 1, right = 0, bottom = 1, top = 0;
      for (const corner of corners) {
        sample.copy(corner).applyMatrix4(textureMatrix);
        // A very close grazing view can put a corner behind the eye. The
        // bounded perspective projection is then invalid; retain the full view.
        if (sample.w <= 0) return render.call(renderer, scene, camera);
        left = Math.min(left, sample.x / sample.w); right = Math.max(right, sample.x / sample.w);
        bottom = Math.min(bottom, sample.y / sample.w); top = Math.max(top, sample.y / sample.w);
      }
      // The liquid shader displaces UVs by up to .012 + .003. Two texels
      // beyond that keep bilinear edge samples inside the freshly painted area.
      const x = Math.max(0, Math.floor((left - .015) * target.width) - 2);
      const y = Math.max(0, Math.floor((bottom - .015) * target.height) - 2);
      const width = Math.min(target.width, Math.ceil((right + .015) * target.width) + 2) - x;
      const height = Math.min(target.height, Math.ceil((top + .015) * target.height) + 2) - y;
      if (width <= 0 || height <= 0) return render.call(renderer, scene, camera);
      const projection = camera.projectionMatrix.clone(), inverse = camera.projectionMatrixInverse.clone();
      const viewport = target.viewport.clone(), scissor = target.scissor.clone(), scissorTest = target.scissorTest;
      crop.set(target.width / width, 0, 0, (target.width - 2 * x - width) / width,
        0, target.height / height, 0, (target.height - 2 * y - height) / height,
        0, 0, 1, 0, 0, 0, 0, 1);
      camera.projectionMatrix.premultiply(crop); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      target.viewport.set(x, y, width, height); target.scissor.copy(target.viewport); target.scissorTest = true;
      renderer.setRenderTarget(target);
      try { render.call(renderer, scene, camera); }
      finally {
        camera.projectionMatrix.copy(projection); camera.projectionMatrixInverse.copy(inverse);
        target.viewport.copy(viewport); target.scissor.copy(scissor); target.scissorTest = scissorTest;
        renderer.setRenderTarget(target);
      }
    };
    try { reflect(...args); }
    finally { renderer.render = render; }
  };
}
