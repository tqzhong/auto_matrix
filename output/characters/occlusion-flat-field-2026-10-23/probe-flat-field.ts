import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { PoissonDenoiseShader } from 'three/addons/shaders/PoissonDenoiseShader.js';
import { WorldOcclusionPass } from './src/engine/PostProcessing.js';

const width = 160, height = 96;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1); renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);
const status = document.querySelector('[role="status"]')!;
const button = document.querySelector('button')!;
const camera = new THREE.PerspectiveCamera(48, width / height, .5, 5000);
const pass = new WorldOcclusionPass(new THREE.Scene(), camera, width, height);
const reference = pass.pdMaterial.clone();
reference.fragmentShader = PoissonDenoiseShader.fragmentShader;
const quad = new FullScreenQuad(pass.pdMaterial);
const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, depthBuffer: false });
const original = new Float32Array(width * height * 4), candidate = original.slice();

function texture(data: Float32Array | Uint16Array | Uint8Array, type: THREE.TextureDataType) {
  const value = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, type);
  value.needsUpdate = true; return value;
}

const patterns = ['white', 'faint-seam', 'hard-edge', 'checkerboard', 'radial-contact', 'border-seam', 'invalid-centers', 'colored-input'];
button.onclick = async () => {
  button.disabled = true;
  const rows: { pattern: string; filter: string; radius: number; index: number; maxDelta: number; differences: number; finite: boolean; originalRange: number[]; candidateRange: number[] }[] = [];
  const compilerErrors: string[] = [];
  const oldError = console.error;
  console.error = (...args) => { compilerErrors.push(args.map(String).join(' ')); oldError(...args); };
  try {
    if (!renderer.extensions.has('EXT_color_buffer_float')) throw new Error('Float color targets unavailable');
    for (const pattern of patterns) {
      status.textContent = `正在检查 ${pattern}…`;
      const ao = new Uint16Array(width * height * 4), normals = new Uint8Array(width * height * 4), depths = new Float32Array(width * height * 4), noise = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const value = pattern === 'faint-seam' && x === 80 ? .9995
          : pattern === 'hard-edge' && x < 80 ? .2
          : pattern === 'checkerboard' && ((x >> 3) + (y >> 3)) % 2 ? .35
          : pattern === 'radial-contact' ? 1 - .8 * Math.max(0, 1 - Math.hypot(x - 80, y - 48) / 18)
          : pattern === 'border-seam' && (x === 0 || x === 159 || y === 0 || y === 95) ? .1 : 1;
        for (let c = 0; c < 3; c++) ao[i + c] = THREE.DataUtils.toHalfFloat(pattern === 'colored-input' && x < 80 ? [.3, .6, .9][c] : value);
        ao[i + 3] = THREE.DataUtils.toHalfFloat(1);
        normals[i] = x < 80 ? 128 : 168; normals[i + 1] = 128; normals[i + 2] = 250; normals[i + 3] = 255;
        depths[i] = .4 + (x / width) * .1; depths[i + 3] = depths[i];
        if (pattern === 'invalid-centers' && (x < 60 || y < 30)) { depths[i] = depths[i + 3] = 1; normals[i] = normals[i + 1] = normals[i + 2] = 128; }
        for (let c = 0; c < 4; c++) noise[i + c] = (x * 73 + y * 37 + c * 51) % 256;
      }
      const diffuse = texture(ao, THREE.HalfFloatType), normal = texture(normals, THREE.UnsignedByteType), depth = texture(depths, THREE.FloatType), noiseTexture = texture(noise, THREE.UnsignedByteType);
      for (const material of [reference, pass.pdMaterial]) {
        material.uniforms.tDiffuse.value = diffuse; material.uniforms.tNormal.value = normal;
        material.uniforms.tDepth.value = depth; material.uniforms.tNoise.value = noiseTexture;
        material.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
      }
      try {
        for (const filter of [THREE.NearestFilter, THREE.LinearFilter]) {
          diffuse.minFilter = diffuse.magFilter = filter; diffuse.needsUpdate = true;
          for (const radius of [1, 8]) for (const index of [0, 1, 2, 3]) {
            for (const [material, buffer] of [[reference, original], [pass.pdMaterial, candidate]] as const) {
              material.uniforms.radius.value = radius; material.uniforms.index.value = index;
              renderer.setRenderTarget(target); renderer.setClearColor(0xffffff); renderer.clear();
              quad.material = material; quad.render(renderer);
              renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
            }
            let maxDelta = 0, differences = 0, finite = true, minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
            for (let i = 0; i < original.length; i++) {
              const delta = Math.abs(original[i] - candidate[i]);
              finite &&= Number.isFinite(original[i]) && Number.isFinite(candidate[i]);
              maxDelta = Math.max(maxDelta, delta); if (delta > 1e-6) differences++;
              if (i % 4 !== 3) { minA = Math.min(minA, original[i]); maxA = Math.max(maxA, original[i]); minB = Math.min(minB, candidate[i]); maxB = Math.max(maxB, candidate[i]); }
            }
            rows.push({ pattern, filter: filter === THREE.LinearFilter ? 'linear' : 'nearest', radius, index, maxDelta, differences, finite, originalRange: [minA, maxA], candidateRange: [minB, maxB] });
          }
        }
      } finally { diffuse.dispose(); normal.dispose(); depth.dispose(); noiseTexture.dispose(); }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    renderer.setRenderTarget(null); renderer.setClearColor(0x14291b); renderer.clear();
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    const report = { measuredAt: new Date().toISOString(), width, height, outputType: 'RGBA32F', inputAoType: 'RGBA16F', tolerance: 1e-6,
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable', glError: gl.getError(), compilerErrors,
      cases: rows.length, rgbaComparisons: rows.length * original.length, rows,
      passed: compilerErrors.length === 0 && rows.every(row => row.finite && row.differences === 0) };
    if (report.glError) report.passed = false;
    const filename = `neo-${report.measuredAt.replace(/[:.]/g, '-')}.json`;
    const saved = await fetch(`/__recording/${filename}`, { method: 'POST', body: JSON.stringify(report, null, 2) });
    if (!saved.ok) throw new Error(`Report save failed ${saved.status}`);
    status.textContent = `${report.passed ? '通过' : '失败'}：${report.cases} 组 / ${report.rgbaComparisons.toLocaleString()} 通道比较\n最大误差 ${Math.max(...rows.map(row => row.maxDelta))}\nGL错误 ${report.glError}，编译错误 ${compilerErrors.length}\n报告 ${filename}\n${JSON.stringify(rows.filter(row => !row.finite || row.differences), null, 2)}`;
  } catch (error) { status.textContent = `检查失败：${String(error)}`; }
  finally { console.error = oldError; button.disabled = false; }
};
