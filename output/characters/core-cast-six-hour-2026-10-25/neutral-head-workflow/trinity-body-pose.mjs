export function poseReviewHead(head, yawDegrees, pitchDegrees) {
  head.rotateY(yawDegrees * Math.PI / 180);
  head.rotateX(pitchDegrees * Math.PI / 180);
}
