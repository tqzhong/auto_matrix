export class FrameRate {
  fps = 60;
  private frames = 0;
  private seconds = 0;
  update(seconds: number): void {
    if (seconds <= 0) return;
    this.frames++; this.seconds += seconds;
    if (this.seconds >= .5) {
      this.fps = this.frames / this.seconds;
      this.frames = 0; this.seconds = 0;
    }
  }
}
