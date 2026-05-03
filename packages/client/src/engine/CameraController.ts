import * as THREE from 'three';
import type { Vector3 } from '@auto_matrix/shared';

const MIN_DISTANCE = 30;
const MAX_DISTANCE = 200;
const DEFAULT_DISTANCE = 80;
const DEFAULT_ELEVATION = 1.1;
const DEFAULT_AZIMUTH = Math.PI * 0.25;
const ROTATE_SPEED = 0.005;
const PAN_SPEED = 0.3;
const ZOOM_SPEED = 5;
const LERP_SPEED = 3;

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private distance: number;
  private elevation: number;
  private azimuth: number;

  private isRotating = false;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private followTarget: THREE.Vector3 | null = null;
  private followLerp = 0;
  private domElement: HTMLElement;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(256, 0, 256);
    this.distance = DEFAULT_DISTANCE;
    this.elevation = DEFAULT_ELEVATION;
    this.azimuth = DEFAULT_AZIMUTH;

    this.bindEvents();
    this.updateCameraPosition();
  }

  private bindEvents(): void {
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.distance += e.deltaY * 0.01 * ZOOM_SPEED;
    this.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, this.distance));
    this.followTarget = null;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.isRotating = true;
    } else if (e.button === 1) {
      this.isPanning = true;
    }
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent): void => {
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;

    if (this.isRotating) {
      this.azimuth -= dx * ROTATE_SPEED;
      this.elevation += dy * ROTATE_SPEED;
      this.elevation = Math.max(0.2, Math.min(Math.PI * 0.45, this.elevation));
      this.followTarget = null;
    }

    if (this.isPanning) {
      const forward = new THREE.Vector3(
        -Math.sin(this.azimuth),
        0,
        -Math.cos(this.azimuth),
      ).normalize();
      const right = new THREE.Vector3().crossVectors(
        new THREE.Vector3(0, 1, 0),
        forward,
      ).normalize();

      this.target.addScaledVector(right, dx * PAN_SPEED);
      this.target.addScaledVector(forward, -dy * PAN_SPEED);
      this.followTarget = null;
    }

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) this.isRotating = false;
    if (e.button === 1) this.isPanning = false;
  };

  focusOnPosition(pos: Vector3): void {
    this.followTarget = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.followLerp = 0;
  }

  setFollowTarget(pos: Vector3): void {
    this.followTarget = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.followLerp = 0;
  }

  clearFollow(): void {
    this.followTarget = null;
  }

  update(delta: number): void {
    if (this.followTarget) {
      this.followLerp = Math.min(1, this.followLerp + delta * LERP_SPEED);
      this.target.lerp(this.followTarget, this.followLerp * 0.05);
    }
    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const x = this.target.x + Math.sin(this.azimuth) * Math.cos(this.elevation) * this.distance;
    const y = this.target.y + Math.sin(this.elevation) * this.distance;
    const z = this.target.z + Math.cos(this.azimuth) * Math.cos(this.elevation) * this.distance;

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  dispose(): void {
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
  }
}
