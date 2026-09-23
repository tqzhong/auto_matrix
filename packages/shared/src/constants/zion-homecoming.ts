// Physical anchors shared by the six homecoming sets, collision and cast staging.
export const ZION_HOMECOMING = ['m2_dock', 'm2_lock', 'm2_residents', 'm2_temple', 'm2_room', 'm2_hamann'] as const;
export const ZION_OBSTACLES: Record<string, { x: number; z: number; width: number; depth: number; height: number }[]> = {
  film_zion_hangar: [{ x: 18, z: -15, width: 9, depth: 13, height: 9 }, { x: -24, z: -30, width: 9, depth: 13, height: 8 }],
  film_zion_council: [{ x: 0, z: -27, width: 13, depth: 3, height: 3 }, { x: -18, z: -7, width: 3, depth: 12, height: 4 }],
  film_zion_residences: [{ x: 0, z: -34, width: 7, depth: 3, height: 3 }, ...[-1, 1].map(side => ({ x: side * 24, z: -21, width: 7, depth: 12, height: 8 }))],
  film_zion_temple: [{ x: 0, z: -41, width: 10, depth: 4, height: 4 }, ...[-1, 1].flatMap(side => [-28, -4, 20].map(z => ({ x: side * 31, z, width: 3, depth: 3, height: 40 })))],
  film_zion_bedroom: [{ x: -7, z: -10, width: 9, depth: 7, height: 2 }],
  film_zion_engineering: [{ x: -17, z: -25, width: 8, depth: 5, height: 5 }, { x: 17, z: -25, width: 8, depth: 6, height: 5 }, ...[-1, 1].map(side => ({ x: side * 22, z: 6, width: 7, depth: 11, height: 13 }))],
};
export const ZION_CAST: Record<string, Record<string, { x: number; z: number; yaw: number }>> = {
  m2_dock: { kid: { x: -5, z: -28, yaw: 1.2 }, morpheus: { x: 3, z: -34, yaw: 0 }, trinity: { x: 7, z: -31, yaw: -1 }, link: { x: 11, z: -14, yaw: -1.5 } },
  m2_lock: { lock: { x: -7, z: -23, yaw: .3 }, niobe: { x: 9, z: -23, yaw: -.5 } },
  m2_residents: { zion_parent: { x: -9, z: -23, yaw: .4 }, zion_neighbor: { x: 9, z: -23, yaw: -.4 }, trinity: { x: 4, z: -13, yaw: -1 } },
  m2_temple: { niobe: { x: -10, z: -34, yaw: 0 }, lock: { x: 11, z: -34, yaw: 0 }, hamann: { x: -15, z: -30, yaw: 0 } },
  m2_room: { trinity: { x: 2, z: -8, yaw: -1 } },
  m2_hamann: { hamann: { x: -7, z: -23, yaw: 1 } },
};
