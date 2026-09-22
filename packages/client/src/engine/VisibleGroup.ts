import * as THREE from 'three';

/** Render-only branches (worlds and character detail LODs), not shared skeleton roots. */
export class VisibleGroup extends THREE.Group {
  updateMatrixWorld(force?: boolean): void {
    if (this.visible) super.updateMatrixWorld(force);
  }
}
