import * as THREE from 'three';
import { cityNoise } from '@auto_matrix/shared';

export class UrbanMaterials {
  private textures: THREE.Texture[] = [];
  private facades = new Map<number, THREE.MeshStandardMaterial>();
  private surfaces: THREE.MeshPhysicalMaterial[] = [];

  surface(id: 'asphalt_02' | 'concrete_pavement_03', width: number, height: number, tile = 10): THREE.MeshPhysicalMaterial {
    const load = (kind: string) => {
      const texture = new THREE.TextureLoader().load(`/assets/surfaces/${id}-${kind}.jpg`);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(width / tile, height / tile); texture.anisotropy = 8;
      if (kind === 'color') texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.push(texture); return texture;
    };
    const material = new THREE.MeshPhysicalMaterial({ map: load('color'), normalMap: load('normal'), roughnessMap: load('roughness'),
      color: id === 'asphalt_02' ? 0xa4a7aa : 0xc4bcaa, normalScale: new THREE.Vector2(.6, .6),
      roughness: .65, metalness: .03, clearcoat: .4, clearcoatRoughness: id === 'asphalt_02' ? .25 : .4 });
    this.surfaces.push(material); return material;
  }

  setWet(wet: boolean): void {
    for (const surface of this.surfaces) { surface.roughness = wet ? .5 : .95; surface.clearcoat = wet ? .75 : .06; }
  }

  facade(variant: number): THREE.MeshStandardMaterial {
    const index = ((variant % 4) + 4) % 4;
    const existing = this.facades.get(index); if (existing) return existing;
    const canvases = Array.from({ length: 4 }, () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512; return canvas; });
    const [color, emission, roughness, relief] = canvases.map(canvas => canvas.getContext('2d')!);
    color.fillStyle = ['#4b514b', '#56504a', '#404b4b', '#67665b'][index]; color.fillRect(0, 0, 512, 512);
    emission.fillStyle = '#000'; emission.fillRect(0, 0, 512, 512);
    roughness.fillStyle = '#dbdbdb'; roughness.fillRect(0, 0, 512, 512);
    relief.fillStyle = '#a4a4a4'; relief.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) {
      const x = cityNoise(i, index) * 512; const y = cityNoise(index + 5, i) * 512;
      color.fillStyle = i % 2 ? '#ffffff09' : '#00000010'; color.fillRect(x, y, 1.5, 1.5);
    }
    for (let row = 0; row < 4; row++) {
      const y = row * 128;
      color.fillStyle = '#252c28'; color.fillRect(0, y + 119, 512, 3);
      color.fillStyle = '#73766b'; color.fillRect(0, y + 123, 512, 5);
      relief.fillStyle = '#dadada'; relief.fillRect(0, y + 121, 512, 7);
      for (let column = 0; column < 4; column++) {
        const x = column * 128 + 26; const lit = cityNoise(column + index * 9, row + 5);
        color.fillStyle = '#171f1e'; color.fillRect(x - 5, y + 17, 84, 91);
        color.fillStyle = '#839087'; color.fillRect(x - 3, y + 17, 80, 3);
        const gradient = color.createLinearGradient(x, y + 22, x + 73, y + 100);
        gradient.addColorStop(0, lit > .72 ? '#746e55' : '#31423f'); gradient.addColorStop(1, lit > .72 ? '#aaa181' : '#0e1b1c');
        color.fillStyle = gradient; color.fillRect(x, y + 22, 74, 79);
        roughness.fillStyle = '#303030'; roughness.fillRect(x, y + 22, 74, 79);
        relief.fillStyle = '#424242'; relief.fillRect(x, y + 22, 74, 79);
        if (lit > .72) {
          emission.fillStyle = lit > .9 ? '#b7c9ad' : '#d2b88c'; emission.fillRect(x, y + 22, 74, 79);
          emission.fillStyle = '#070a09'; emission.fillRect(x + 11, y + 68, 15, 33); emission.fillRect(x + 55, y + 80, 12, 21);
        }
        for (const ctx of [color, emission, relief]) {
          ctx.fillStyle = ctx === relief ? '#a0a0a0' : '#1e2623'; ctx.fillRect(x + 35, y + 22, 4, 79); ctx.fillRect(x, y + 58, 74, 4);
        }
        color.fillStyle = '#75796c'; color.fillRect(x - 6, y + 104, 86, 5);
      }
    }
    const maps = canvases.map((canvas, i) => {
      const map = new THREE.CanvasTexture(canvas); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
      if (i < 2) map.colorSpace = THREE.SRGBColorSpace;
      this.textures.push(map); return map;
    });
    const material = new THREE.MeshStandardMaterial({ map: maps[0], emissiveMap: maps[1], roughnessMap: maps[2], bumpMap: maps[3],
      bumpScale: .14, emissive: 0xffffff, emissiveIntensity: .52, roughness: .95, metalness: .12 });
    // World-space facade coordinates keep storeys and windows the same size on
    // both instanced towers and differently sized named buildings.
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vec4 facadeWorld = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 facadeWorld = modelMatrix * vec4(position, 1.0);
        #endif
        vec2 facadeUv = vec2(abs(normal.x) > 0.5 ? facadeWorld.z : facadeWorld.x, facadeWorld.y) / 27.2;
        vMapUv = facadeUv; vEmissiveMapUv = facadeUv; vRoughnessMapUv = facadeUv; vBumpMapUv = facadeUv;
      `);
    };
    this.facades.set(index, material); return material;
  }

  dispose(): void { this.textures.forEach(texture => texture.dispose()); }
}
