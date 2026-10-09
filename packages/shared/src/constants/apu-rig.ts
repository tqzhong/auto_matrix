/** Model-space contacts shared by the APU, its seated operator and authoritative camera. */
export const APU_RIG = {
  floor: .04,
  pilot: { x: 0, y: 4.2, z: 0 },
  eye: { x: 0, y: 7.705, z: -.275 },
  cannon: { x: 3.25, y: 6.2, z: -.4 },
  footX: 1.55,
  // The forked sole is extruded from this actual outline, without a hidden box collider.
  sole: [[-.96, .95], [.96, .95], [.96, -.5], [.76, -1.95], [.4, -1.95], [.32, -.65],
    [.18, -.65], [.18, -2.05], [-.18, -2.05], [-.18, -.65], [-.32, -.65], [-.4, -1.95], [-.76, -1.95], [-.96, -.5]],
} as const;

export const APU_CONTACTS = [-1, 1].flatMap(side => [
  ...APU_RIG.sole.flatMap(([x, z]) => [0, .24].map(y => ({ x: side * APU_RIG.footX + x, y, z }))),
  ...[-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => ({
    x: side * APU_RIG.cannon.x + x * .7, y: APU_RIG.cannon.y + y * .7, z: APU_RIG.cannon.z + z * .95,
  })))),
]);
