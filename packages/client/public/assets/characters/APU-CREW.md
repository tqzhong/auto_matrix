# Mifune and Kid — Zion APU crew

Added 2026-10-11. These are approximate film-inspired game characters, not actor scans or verified film-quality likenesses.

- `apu-crew-faces.png` is the unmodified 1,254 × 1,254 atlas generated with the built-in image tool. Mifune occupies the top row and Kid the bottom row; front/profile panels are 627 pixels square. The exact generation prompt is in [apu-crew-generation-prompt.txt](apu-crew-generation-prompt.txt). It is a generated interpretation of the two characters, not extracted film texture data.
- `mifune-head.glb` and `kid-head.glb` contain continuous head/ear/neck geometry, fitted frontal/profile UVs and eyelid morphs. Runtime supplies fitted short hair, eyes and Mifune's gray temple strands. Mifune closes his eyelids according to the saved last-stand state, including after a late asset load.
- `mifune-body.glb` and `kid-body.glb` contain continuous anatomy, clothing, trousers and work boots bound to the existing 23 performance joints. Mifune has a light shirt with rolled sleeves, a separate open dark vest and wine-colored neckline; Kid has a light crew-neck top with a procedural waffle-knit bump texture. No new runtime package, remote service, Blender installation or Python runtime is required.
- Anatomy and morph targets use the existing CC0 MakeHuman sources pinned in `scripts/build-characters.py` at revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Source credits and license references remain in [README.md](README.md). The role targets and source revision are recorded in the GLBs.
- Costume and action references were the visible frames in the [reload excerpt](https://clip.cafe/the-matrix-revolutions-2003/reload-s5/) and [Kid at the loader excerpt](https://clip.cafe/the-matrix-revolutions-2003/forget-it-kid-get-out-of-here/). Those short excerpts do not establish the complete filmed space or every costume detail. No film video is included in the assets.

Build heads first, then bodies, using Python with the existing NumPy authoring dependency. Limit roles to these two so existing delivered assets remain unchanged.

```sh
python3 scripts/build-epilogue-heads.py --source output/characters/epilogue-cast-2026-10-05/source --output packages/client/public/assets/characters --roles mifune kid
python3 scripts/build-digger-bodies.py --source output/characters/epilogue-cast-2026-10-05/source --output packages/client/public/assets/characters --roles mifune kid
```

The actual shipped geometry is tested against APU controls, pedals, seat, ammunition case and dock floor. Native screenshots and checkpoint recovery evidence are in `output/gameplay/trilogy-apu-cast-2026-10-11/`. These finite checks do not establish arbitrary-pose clearance, actor likeness, natural cloth/facial performance, stable frame rate or a complete trilogy playthrough. The existing APU and dock remain simplified approximations.
