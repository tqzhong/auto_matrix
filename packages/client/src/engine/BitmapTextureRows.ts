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
