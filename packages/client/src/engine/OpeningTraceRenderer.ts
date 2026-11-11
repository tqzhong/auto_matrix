import * as THREE from 'three';
import { OPENING_HOTEL, openingHotelTraceLine } from '@auto_matrix/shared';

const origin = '3125550103';
const trace = OPENING_HOTEL.trace;

/** The intercepted call is part of the rendered frame, including in gameplay recordings. */
export class OpeningTraceRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  private surface?: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> };
  private frame = -1;

  constructor() { this.camera.position.z = 1; }

  render(renderer: THREE.WebGLRenderer, elapsed?: number): void {
    if (elapsed === undefined || elapsed >= trace.room) { this.dispose(); return; }
    if (!this.surface) {
      const canvas = document.createElement('canvas'), texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, depthTest: false, depthWrite: false }));
      this.scene.add(screen); this.surface = { canvas, texture, screen };
    }
    const { canvas, texture } = this.surface, frame = Math.floor(elapsed * 12);
    const aspect = renderer.domElement.width / Math.max(1, renderer.domElement.height);
    const height = Math.max(1, Math.min(540, Math.round(960 / aspect))), width = Math.min(960, Math.max(1, Math.round(height * aspect)));
    if (frame !== this.frame || canvas.width !== width || canvas.height !== height) {
      if (canvas.width !== width || canvas.height !== height) {
        // WebGL texture storage keeps its old dimensions until it is released.
        texture.dispose();
        canvas.width = width; canvas.height = height;
      }
      this.frame = frame;
      this.paint(canvas.getContext('2d')!, width, height, frame / 12);
      texture.needsUpdate = true;
    }
    renderer.render(this.scene, this.camera);
  }

  private paint(ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number): void {
    const { smoothstep } = THREE.MathUtils, m = width * .09, area = width - m * 2, cell = area / origin.length;
    const found = elapsed >= trace.located, connected = elapsed >= trace.pickup;
    const fade = 1 - smoothstep(elapsed, trace.room - .38, trace.room - .08);
    const push = 1 + 1.65 * smoothstep(elapsed, trace.located + .15, trace.room - .16);
    ctx.fillStyle = '#020605'; ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = fade;
    const glow = ctx.createRadialGradient(width * .5, height * .4, 1, width * .5, height * .4, Math.max(width, height) * .62);
    glow.addColorStop(0, '#0c271b'); glow.addColorStop(1, '#020605');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    ctx.translate(width * .5, height * .4); ctx.scale(push, push); ctx.translate(-width * .5, -height * .4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = `${Math.max(10, Math.min(21, cell * .28))}px monospace`;
    ctx.fillStyle = '#8cbda0'; ctx.fillText('CALL TRANSMISSION', m, height * .12, area);
    ctx.fillStyle = '#46725d'; ctx.fillRect(m, height * .185, area, 1);
    ctx.fillStyle = found ? '#b9f3c9' : '#80ba99';
    ctx.fillText(found ? 'TRACE COMPLETE' : connected ? 'TRACE PROGRAM / RUNNING' : 'INCOMING SIGNAL', m, height * .225, area);
    if (connected) {
      const fixed = found ? origin.length : Math.min(9, Math.floor((elapsed - trace.pickup) * 1.06));
      ctx.fillStyle = '#6fae8b'; ctx.fillText('CALL ORIGIN', m, height * .292, area);
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.min(height * .104, cell * .77)}px monospace`;
      for (let column = 0; column < origin.length; column++) {
        ctx.fillStyle = column < fixed ? '#d1f9dd' : '#69b38c';
        const digit = column < fixed ? origin[column] : String((this.frame * 7 + column * 3) % 10);
        ctx.fillText(digit, m + (column + .5) * cell, height * .355);
      }
      if (!found) {
        ctx.font = `${Math.min(height * .034, cell * .46)}px monospace`;
        for (let row = 0; row < 6; row++) {
          ctx.fillStyle = row % 2 ? '#325d45' : '#4e8367';
          for (let column = fixed; column < origin.length; column++) {
            const digit = String((this.frame * 3 + row * 7 + column * 11) % 10);
            ctx.fillText(digit, m + (column + .5) * cell, height * (.49 + row * .043));
          }
        }
      }
    } else if (Math.floor(elapsed * 3) % 2 === 0) {
      ctx.fillRect(m, height * .36, Math.min(27, cell * .5), height * .07);
    }
    ctx.restore();
    ctx.fillStyle = '#00000028';
    for (let row = 0; row < height; row += 3) ctx.fillRect(0, row, width, 1);

    const line = openingHotelTraceLine(elapsed);
    if (line) {
      const size = Math.min(height * .046, width * .051);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = `${Math.round(size * .64)}px system-ui, sans-serif`;
      ctx.fillStyle = '#a6cbb6'; ctx.fillText(line.speaker, width / 2, height * .785, area);
      ctx.font = `500 ${Math.round(size)}px system-ui, sans-serif`;
      ctx.fillStyle = '#e5eee7'; ctx.fillText(line.text, width / 2, height * .835, area);
    }
  }

  dispose(): void {
    if (!this.surface) return;
    const { screen, texture } = this.surface;
    screen.removeFromParent(); screen.geometry.dispose(); screen.material.dispose(); texture.dispose();
    this.surface = undefined; this.frame = -1;
  }
}
