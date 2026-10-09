# Niobe / Lock / Roland reality assets

Added 2026-10-06. These are approximate game models, not actor scans or film-quality likenesses.

- `zion-captains-faces.png`: unmodified 1024 × 1536 portrait atlas generated with the built-in imagegen tool in generation mode. Front/profile rows: Niobe, Lock, Roland. The generated row boundaries are 0 / 485 / 974 / 1536; fitting uses those measured panels rather than assuming square tiles. Exact input: [zion-captains-generation-prompt.txt](zion-captains-generation-prompt.txt).
- `niobe-head.glb`, `lock-head.glb`, `roland-head.glb`: continuous head/neck meshes with frontal landmark registration, profile UVs, matched neck samples and eyelid morphs. Runtime adds fitted scalp geometry, Niobe's Bantu knots, Lock's cropped hair and Roland's receding hair with gray strands.
- `niobe-body.glb`, `lock-body.glb`, `roland-body.glb`: continuous anatomy, separate woven tops, seams, trousers, pockets and boots, following the established 23 performance joints. Niobe retains her burgundy sleeveless dock top and, added 2026-10-10, a separate long-sleeved sweater selected during the Hammer standing meeting, as seen in the [loaning Logos excerpt](https://clip.cafe/the-matrix-revolutions-2003/he-can-take-mine/). Lock and Roland have sleeved wrap tunics with layered V collars. These are authored approximations, not costumes extracted from the films.
- Anatomy uses the same CC0 MakeHuman base and targets pinned by `scripts/build-characters.py`, revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Role targets and provenance are recorded in the GLBs.
- Costume direction follows the [archival official interview with Kym Barrett](https://www.matrixfans.net/interview-with-kym-barrett-costume-designer-part-3-from-the-matrix-reloaded-and-revolutions-2003/) about handmade Zion textiles, captain colors and Niobe's exposed arms, plus the [personnel-gate scene preview](https://clip.cafe/the-matrix-revolutions-2003/three-captains-one-ship/). No film video is shipped with these assets.
- Runtime: `EpilogueHeads.ts` and `DiggerBodies.ts` retain the existing performance joints. Niobe's new reality model and existing Matrix appearance are selected by world state; a late body load respects the current visibility. Loading keeps saved positions and falls back to the previous geometry on failure. The existing Zee/Charra head and body files were not regenerated.

Rebuild using the bundled Python with the existing NumPy authoring dependency. Build heads first: the body generator fits its upper neck against the actual exported head section.

```sh
python3 scripts/build-epilogue-heads.py --source output/characters/epilogue-cast-2026-10-05/source --output packages/client/public/assets/characters --roles niobe lock roland
python3 scripts/build-digger-bodies.py --source output/characters/epilogue-cast-2026-10-05/source --output packages/client/public/assets/characters --roles niobe lock roland
```

The game needs neither Python, Blender nor a generation service. [Actual screenshots, tests and remaining work](../../../../../output/characters/zion-captains-2026-10-06/README.md) distinguish local verification from a complete trilogy or film-fidelity signoff. Likeness, natural cloth, facial performance and stable gameplay performance remain unfinished.
