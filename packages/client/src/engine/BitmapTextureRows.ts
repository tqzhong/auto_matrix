import * as THREE from 'three';

const ROWS_PER_UPLOAD = 256;

export function bitmapUploadImage(renderer: THREE.WebGLRenderer, texture: THREE.Texture): ImageBitmap | undefined {
  const image: unknown = texture.image;
  if (typeof ImageBitmap === 'undefined' || !(image instanceof ImageBitmap)
    || image.width < 2048 || image.height < 2048 || Math.max(image.width, image.height) > renderer.capabilities.maxTextureSize
    || texture.format !== THREE.RGBAFormat || texture.type !== THREE.UnsignedByteType
    || texture.flipY || texture.premultiplyAlpha || texture.mipmaps?.length !== 0
    || typeof texture.onUpdate === 'function' || !texture.source.dataReady) return;
  return image;
}

export function uploadBitmapRows(renderer: THREE.WebGLRenderer, texture: THREE.Texture, image: ImageBitmap, row: number): number | undefined {
  if (row === 0) {
    const source = texture.source;
    source.dataReady = false;
    try { renderer.initTexture(texture); }
    finally { source.dataReady = true; }
  }
  const { __webglTexture } = renderer.properties.get(texture) as { __webglTexture?: WebGLTexture };
  if (!__webglTexture) return;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const end = Math.min(row + ROWS_PER_UPLOAD, image.height);
  renderer.state.bindTexture(gl.TEXTURE_2D, __webglTexture);
  try {
    // The renderer keeps the unpack row offset at zero between uploads.
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, row);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, row, image.width, end - row, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if (end === image.height && texture.generateMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  } finally {
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    renderer.state.unbindTexture();
  }
  return end;
}

/** Prepare a shared texture offstage so a draw can still upload the original at any time. */
export function* stageBitmapTexture(renderer: THREE.WebGLRenderer, texture: THREE.Texture, image: ImageBitmap, stripsPerFrame = 1): Generator<void, boolean> {
  const { source, version } = texture, gpu = renderer.properties;
  const staging = new THREE.Texture(image, undefined, texture.wrapS, texture.wrapT, texture.magFilter,
    texture.minFilter, THREE.RGBAFormat, THREE.UnsignedByteType, texture.anisotropy, texture.colorSpace);
  staging.name = texture.name; staging.internalFormat = texture.internalFormat;
  staging.generateMipmaps = texture.generateMipmaps; staging.flipY = false; staging.unpackAlignment = texture.unpackAlignment;
  staging.needsUpdate = true;
  try {
    for (let row = 0, strips = 0; row < image.height;) {
      const { __webglTexture } = renderer.properties.get(texture) as { __webglTexture?: WebGLTexture };
      if (__webglTexture || gpu !== renderer.properties || texture.version !== version || texture.source !== source || texture.image !== image) return false;
      const end = uploadBitmapRows(renderer, staging, image, row);
      if (end === undefined) return false;
      row = end;
      if (row < image.height && ++strips % stripsPerFrame === 0) yield;
    }
    // Register the original sampler before releasing the staging reference to its populated allocation.
    texture.source = staging.source;
    renderer.initTexture(texture);
    return true;
  } catch (error) {
    if (texture.source === staging.source) texture.needsUpdate = true;
    throw error;
  } finally { staging.dispose(); }
}
