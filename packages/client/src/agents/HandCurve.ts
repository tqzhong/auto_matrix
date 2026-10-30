import * as THREE from 'three';

interface Span {
  length: number; start: THREE.Vector3; direction: THREE.Vector3;
  axis?: THREE.Vector3; angle?: number; normal?: THREE.Vector3;
  integral?: THREE.Vector2[]; rotations?: THREE.Vector2[];
}
export interface HandSample { p: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; k: number }
const sample = (): HandSample => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), k: 0 });

/** Curvature fades to zero where each rounded joint meets a straight phalanx. */
export class HandCurve {
  private spans: Span[] = [];
  length = 0;
  anchors = [0];

  constructor(points: THREE.Vector3[], radii: number[]) {
    const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    const axes = points.slice(1).map((p, i) => p.clone().sub(points[i]).normalize());
    const angles = [0, ...axes.slice(1).map((axis, i) => axes[i].angleTo(axis)), 0];
    // A shallow bend still spans the soft tissue around the joint. Shrinking
    // that span with the angle retains fist-level curvature on a relaxed hand.
    const cuts = angles.map((angle, i) => i === 0 || i === axes.length || angle < 1e-6 ? 0 : radii[i - 1] * Math.max(.5, Math.tan(angle / 2)));
    for (let i = 0; i < lengths.length; i++) {
      const total = cuts[i] + cuts[i + 1], limit = .98 * lengths[i];
      if (total > limit) { cuts[i] *= limit / total; cuts[i + 1] *= limit / total; }
    }
    for (let i = 0; i < lengths.length; i++) {
      const start = points[i].clone().addScaledVector(axes[i], cuts[i]), length = lengths[i] - cuts[i] - cuts[i + 1];
      this.spans.push({ length, start, direction: axes[i] }); this.length += length;
      if (i === lengths.length - 1 || angles[i + 1] < 1e-6) { this.anchors.push(this.length); continue; }
      const angle = angles[i + 1], axis = new THREE.Vector3().crossVectors(axes[i], axes[i + 1]).normalize();
      const normal = new THREE.Vector3().crossVectors(axis, axes[i]), integral = [new THREE.Vector2()], rotations = [new THREE.Vector2(1, 0)];
      for (let j = 0; j < 64; j++) {
        integral.push(integral[j].clone().add(this.integrate(angle, j / 64, (j + 1) / 64)));
        const u = (j + 1) / 64, turn = angle * u * u * (3 - 2 * u); rotations.push(new THREE.Vector2(Math.cos(turn), Math.sin(turn)));
      }
      const value = integral[64], projection = value.x * Math.cos(angle / 2) + value.y * Math.sin(angle / 2);
      const arcLength = 2 * cuts[i + 1] * Math.cos(angle / 2) / projection;
      this.spans.push({ length: arcLength, start: points[i + 1].clone().addScaledVector(axes[i], -cuts[i + 1]), direction: axes[i], axis, normal, angle, integral, rotations });
      this.anchors.push(this.length + arcLength / 2); this.length += arcLength;
    }
  }

  private integrate(angle: number, lo: number, hi: number): THREE.Vector2 {
    const result = new THREE.Vector2();
    for (const [u, weight] of [[lo, 1], [(lo + hi) / 2, 4], [hi, 1]]) {
      const a = angle * u * u * (3 - 2 * u); result.x += weight * Math.cos(a); result.y += weight * Math.sin(a);
    }
    return result.multiplyScalar((hi - lo) / 6);
  }

  private arc(span: Span, s: number, out = sample()): HandSample {
    const u = THREE.MathUtils.clamp(s / span.length, 0, 1), part = Math.min(64, Math.floor(u * 64)), lo = part / 64, mid = (lo + u) / 2;
    const endTurn = span.angle! * u * u * (3 - 2 * u), midTurn = span.angle! * mid * mid * (3 - 2 * mid);
    const ce = Math.cos(endTurn), se = Math.sin(endTurn), rotation = span.rotations![part], scale = (u - lo) / 6;
    const ix = span.integral![part].x + scale * (rotation.x + 4 * Math.cos(midTurn) + ce);
    const iy = span.integral![part].y + scale * (rotation.y + 4 * Math.sin(midTurn) + se);
    out.p.copy(span.start).addScaledVector(span.direction, span.length * ix).addScaledVector(span.normal!, span.length * iy);
    out.t.copy(span.direction).multiplyScalar(ce).addScaledVector(span.normal!, se); out.n.crossVectors(span.axis!, out.t);
    out.k = span.angle! * 6 * u * (1 - u) / span.length;
    return out;
  }

  sample(distance: number, out = sample()): HandSample {
    let s = distance;
    for (const [i, span] of this.spans.entries()) {
      if (s <= span.length || i === this.spans.length - 1) {
        if (span.axis) return this.arc(span, s, out);
        out.p.copy(span.start).addScaledVector(span.direction, s); out.t.copy(span.direction); out.n.set(0, 0, 0); out.k = 0;
        return out;
      }
      s -= span.length;
    }
    throw new Error('Empty hand curve');
  }

  closest(point: THREE.Vector3): number {
    let offset = 0, best = 0, minimum = Infinity;
    for (const span of this.spans) {
      let s = 0;
      if (span.axis) {
        let distance = Infinity;
        for (let i = 0; i <= 32; i++) { const at = span.length * i / 32, gap = this.arc(span, at).p.distanceToSquared(point); if (gap < distance) { distance = gap; s = at; } }
        for (let i = 0; i < 5; i++) {
          const value = this.arc(span, s), delta = value.p.sub(point), denominator = 1 + value.k * delta.dot(value.n);
          if (Math.abs(denominator) < 1e-6) break;
          s = THREE.MathUtils.clamp(s - delta.dot(value.t) / denominator, 0, span.length);
        }
      } else s = THREE.MathUtils.clamp(point.clone().sub(span.start).dot(span.direction), 0, span.length);
      const distance = offset + s, squared = this.sample(distance).p.distanceToSquared(point);
      if (squared < minimum) { minimum = squared; best = distance; } offset += span.length;
    }
    return best;
  }
}
