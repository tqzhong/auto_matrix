export type GraphicsQuality = 'high' | 'balanced' | 'smooth';

export function graphicsPixelRatio(quality: GraphicsQuality, width: number, height: number, devicePixelRatio: number): number {
  if (quality === 'high') return Math.min(devicePixelRatio, 1.5);
  const maxPixels = quality === 'balanced' ? 1920 * 1080 : 1280 * 720;
  return Math.min(devicePixelRatio, quality === 'balanced' ? 1 : .75, Math.sqrt(maxPixels / Math.max(1, width * height)));
}

export function readGraphicsQuality(): GraphicsQuality {
  try {
    const quality = localStorage.getItem('matrix:graphics-quality');
    if (quality === 'balanced' || quality === 'smooth') return quality;
  } catch { /* Browser storage may be unavailable; preserve the original quality. */ }
  return 'high';
}

export function saveGraphicsQuality(quality: GraphicsQuality): boolean {
  try { localStorage.setItem('matrix:graphics-quality', quality); return true; }
  catch { return false; }
}
