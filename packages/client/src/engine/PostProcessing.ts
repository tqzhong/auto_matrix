export class PostProcessing {
  private canvas: HTMLCanvasElement;
  private scanlineOverlay: HTMLElement | null = null;
  private applied = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  apply(): void {
    if (this.applied) return;

    this.canvas.style.filter =
      'sepia(0.15) hue-rotate(80deg) saturate(1.3)';

    if (!this.scanlineOverlay) {
      this.scanlineOverlay = document.createElement('div');
      this.scanlineOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.06) 2px,
          rgba(0, 0, 0, 0.06) 4px
        );
      `;
      document.body.appendChild(this.scanlineOverlay);
    }

    this.applied = true;
  }

  remove(): void {
    this.canvas.style.filter = '';
    if (this.scanlineOverlay) {
      this.scanlineOverlay.remove();
      this.scanlineOverlay = null;
    }
    this.applied = false;
  }
}
