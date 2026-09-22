import * as THREE from 'three';
import { CITY_CENTER, type Vector3 } from '@auto_matrix/shared';

export class CameraController {
  private target = new THREE.Vector3(CITY_CENTER.x, 25, CITY_CENTER.z);
  private desiredTarget = this.target.clone();
  private distance = 610;
  private desiredDistance = 610;
  private elevation = 0.62;
  private azimuth = 0.82;
  private drag: { x: number; y: number; button: number } | null = null;
  private following = false;
  private enabled = true;
  director = false;
  onManualControl?: () => void;

  constructor(private camera: THREE.PerspectiveCamera, private element: HTMLElement) {
    element.addEventListener('pointerdown', this.down);
    element.addEventListener('pointermove', this.move);
    element.addEventListener('pointerup', this.up);
    element.addEventListener('pointercancel', this.up);
    element.addEventListener('wheel', this.wheel, { passive: false });
    element.addEventListener('contextmenu', this.context);
    this.update(1);
  }

  private context = (event: Event): void => { event.preventDefault(); };
  private down = (event: PointerEvent): void => {
    if (!this.enabled) return;
    this.drag = { x: event.clientX, y: event.clientY, button: event.button };
    this.element.setPointerCapture(event.pointerId);
  };
  private move = (event: PointerEvent): void => {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.x;
    const dy = event.clientY - this.drag.y;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    this.following = false; this.director = false; this.onManualControl?.();
    if (this.drag.button === 2 || event.shiftKey) {
      this.azimuth -= dx * 0.006;
      this.elevation = THREE.MathUtils.clamp(this.elevation + dy * 0.004, 0.16, 1.4);
    } else {
      const factor = this.distance * 0.0015;
      this.desiredTarget.x += (-dx * Math.cos(this.azimuth) + dy * Math.sin(this.azimuth)) * factor;
      this.desiredTarget.z += (dx * Math.sin(this.azimuth) + dy * Math.cos(this.azimuth)) * factor;
    }
    this.drag.x = event.clientX; this.drag.y = event.clientY;
  };
  private up = (): void => { this.drag = null; };
  private wheel = (event: WheelEvent): void => {
    if (!this.enabled) return;
    event.preventDefault();
    this.desiredDistance = THREE.MathUtils.clamp(this.desiredDistance * Math.exp(event.deltaY * 0.001), 24, 1500);
  };

  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.drag = null; }

  focusOnPosition(position: Vector3): void {
    this.desiredTarget.set(position.x, position.y + 5, position.z);
    this.desiredDistance = 190;
    this.following = false;
  }
  setFollowTarget(position: Vector3): void {
    this.desiredTarget.set(position.x, position.y + 3, position.z);
    if (!this.following) this.desiredDistance = 105;
    this.following = true;
  }
  clearFollow(): void { this.following = false; }
  overview(matrix = true): void {
    this.following = false;
    this.director = false;
    this.desiredTarget.set(matrix ? CITY_CENTER.x : 2160, matrix ? 25 : -65, matrix ? CITY_CENTER.z : 2400);
    this.desiredDistance = matrix ? 610 : 460;
    this.elevation = 0.62;
  }
  update(delta: number): void {
    const smoothing = 1 - Math.exp(-3 * delta);
    this.target.lerp(this.desiredTarget, smoothing);
    this.distance += (this.desiredDistance - this.distance) * smoothing;
    if (this.director && !this.drag) this.azimuth += delta * 0.022;
    this.camera.position.set(this.target.x + Math.sin(this.azimuth) * Math.cos(this.elevation) * this.distance,
      this.target.y + Math.sin(this.elevation) * this.distance,
      this.target.z + Math.cos(this.azimuth) * Math.cos(this.elevation) * this.distance);
    this.camera.lookAt(this.target);
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.down);
    this.element.removeEventListener('pointermove', this.move);
    this.element.removeEventListener('pointerup', this.up);
    this.element.removeEventListener('pointercancel', this.up);
    this.element.removeEventListener('wheel', this.wheel);
    this.element.removeEventListener('contextmenu', this.context);
  }
}
