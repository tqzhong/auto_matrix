import * as THREE from 'three';

export function createRenderEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const environmentScene = new THREE.Scene();
  const sky = new THREE.SphereGeometry(500, 32, 16); const skyColors: number[] = [];
  const horizon = new THREE.Color(0xc6c8c5); const zenith = new THREE.Color(0xb8d3e6); const ground = new THREE.Color(0x514c42);
  for (let i = 0; i < sky.attributes.position.count; i++) {
    const elevation = sky.attributes.position.getY(i) / 500;
    const color = horizon.clone().lerp(elevation > 0 ? zenith : ground, Math.abs(elevation) ** .5);
    skyColors.push(color.r, color.g, color.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const skyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  environmentScene.add(new THREE.Mesh(sky, skyMaterial));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, 0.04, .1, 1000);
  sky.dispose(); skyMaterial.dispose(); pmrem.dispose();
  return environment;
}
