# Playable character assets

Neo, Trinity, Agent Smith and Morpheus now each have an anatomical, skinned GLB. The same assets are loaded by the game and the character inspector. Every character has 46 bones, including articulated fingers, and approximately 80–90k triangles for Trinity, Smith and Morpheus; Neo has about 154k after the separate grooming pass. The former primitive heads/bodies remain only as a loading fallback and for other residents; distant characters use the existing lightweight LOD.

The four heads use different MakeHuman morphs followed by image-constrained mesh fitting, with continuous ears/neck geometry. Facial contour, eyebrows, eye openings, nose and lips are fitted to the generated frontal portraits; the profile image constrains the central forehead/nose/lip/chin depth. Eye meshes follow the same deformation. Hair-card roots follow the reference hairline and are kept outside the fitted scalp. Clothes, skin, iris tone and glasses differ by character. Neo and Morpheus have simulated coat panels with leg collision; Trinity has a fitted leather outfit; Smith has a charcoal suit, white shirt and dark tie. All four support the inspector's glasses toggle and motion previews.

Neo has an additional local refinement pass: narrower eyelid openings, a slightly fuller lower face, a procedural short-hair scalp with 3,000 swept mesh ribbons, and a baked tangent-space skin normal map. The groom replaces his stock hair-card mesh and remains bound to the same head bone. The actor likeness is still weak; these changes address visible surface and silhouette defects, not film-quality reconstruction. The other three characters retain the previous assets.

The office, ledge and interrogation use `neo-office.glb`, an additional shirt and torso bound to Neo's existing 46-bone skeleton. It replaces the coat and black undershirt, keeps his trousers/head/hands, and uses `neo-office-skin.png` for the previously covered abdomen. The CC0 casual shirt is trimmed and lengthened to meet the shipped trouser waist while retaining its sleeves. The lowered hem is rebound to the nearby abdomen weights so leaning over the delivery form does not pull it through the body. The tie, opening shirt, mouth deformation and tracking device are driven by the saved interrogation timeline. Jones and Brown currently reuse Smith's rig with small head-shape variations; these are temporary stand-ins, not likenesses of their actors.

Rhineheart reuses Smith's rig with different suit/hair colors and no glasses. The courier reuses Neo's rig with a blue office shirt and cap. Their keyboard, clipboard, package and pen contacts follow the saved office workday timeline. They are temporary support-character assets, not new actor likenesses.

The apartment visitors use separate `choi.glb` and `dujour.glb` rigs built from the same pinned CC0 MakeHuman assets. Their height/head morphs and unprojected skin differ from the principal cast; Dujour's sleeveless top exposes the shoulder for the runtime white-rabbit tattoo. The saved apartment timeline drives knocking, disk/cash exchange and turning toward the clue. These are provisional supporting models, not likenesses of their actors. Clothes, hair, expressions and hand contact still need visual refinement.

The bridge/car encounter reuses the office torso beneath Neo's lifted black shirt and hides his outer coat panels while seated. Switch uses Trinity's rig with blond hair; Apoc uses Neo's rig. These two support characters are temporary stand-ins, with no new actor likeness assets. Their seated steering/guarding poses and Trinity's scanner contact are driven by the saved meeting timeline. A rest-space skin mask prevents shoulder skin from protruding through the leather outfit during the lean.

These are approximate film likenesses, not actor scans or complete photogrammetric reconstructions. The reference images are generated interpretations. Profile constraints cover the center of the face; ears, back of the head and hair volume still come from the anatomical base assets. Animation is driven by the existing motion solver, with no facial performance capture or lip sync. Geometric alignment scores do not establish perceptual likeness or film-quality fidelity.

## Editable Blender project

The finishing script can generate `output/characters/matrix-cast.blend` (relative to the repository root), containing all four rigs, outfits, editable glasses/coat counterparts, packed materials and the frontal reference atlas. Generated Blender projects, comparison captures and inspection renders are not retained or committed. In the game, glasses and coat panels are managed by `HeroModel.ts` so the cloth can keep responding to movement.

`matrix-faces.png` is the frontal atlas used by the game's loading fallback and by the authoring tools; its prompt is in `generation-prompt.txt`. The former `matrix-turnarounds.png` was an authoring-only front/profile reference sheet generated with the prompt in `turnaround-prompt.txt`. That unused runtime image has been removed; its measured profile constraints remain in `scripts/character-landmarks.json`, so normal rebuilds do not need the sheet. After deforming the mesh, Blender bakes the registered frontal atlas into each character's `*-albedo.png` using the mesh's proper UV layout. Stock skin is color-matched before blending to reduce face/neck seams. The finished models use these baked maps without depending on a face-projection shader.

GLB files in this directory reference their neighboring PNG textures. Keep the directory together when importing them elsewhere. The four character GLBs, Neo's office outfit, the two apartment visitors, their referenced textures and the runtime frontal atlas are retained here, alongside documentation and attribution. In particular, `choi-skin.png`, `dujour-skin.png` and `brown_eye.png` are runtime dependencies of the visitors. Other unused raw skin/eye/suit textures are intermediate files regenerated by the builder. Generated `.blend` projects pack their images internally.

## Free source assets

All downloaded base geometry, morph targets, rigs, skin, eye, hair and clothing assets are **CC0 MakeHuman core/system assets**. There is no paid model, subscription or third-party request at game runtime. See the [official asset license](https://static.makehumancommunity.org/about/license.html) and [included CC0 text](LICENSE-MakeHuman.txt).

- [MakeHuman core assets](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data): base mesh, per-character targets, skeleton and skin weights. Pinned revision: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`.
- [MakeHuman system pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html): `short04` hair, high-poly eyes with brown/bluegreen/grey textures, young Caucasian male/female and middle-aged Caucasian/African male skin, `male_elegantsuit01`, `male_casualsuit01`, `female_casualsuit01`, and `shoes01`. Source credit: MakeHuman team, Data Collection AB, Joel Palmius and Jonas Hauquier.
- [Source archive](https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip), SHA-256 `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`.
- Blender authoring used [official Blender 4.5.9 LTS](https://download.blender.org/release/Blender4.5/), macOS arm64 DMG SHA-256 `e3a3d7aac381fb4e4d05197f99cd8899484d7e8bc4497c134066e6733f372238`.

## Rebuild

From the repository root, with Python 3/numpy/curl and Blender 4.5:

```sh
python3 scripts/build-characters.py --fetch
blender --background --factory-startup --python scripts/finish-characters.py
```

To reproduce the shipped Neo, follow those two commands with the refinement pass. It needs the freshly finished, **unrefined** Neo as input and a separate output directory; it rejects running on an already-refined asset. The optional `--cast` updates only Neo in the editable cast and preserves the other characters and bone-attached accessories.

```sh
blender --background --factory-startup --python scripts/refine-neo.py -- --source packages/client/public/assets/characters --output output/characters/neo-review/candidate --cast output/characters/matrix-cast.blend
cp output/characters/neo-review/candidate/neo-normal.png packages/client/public/assets/characters/
cp output/characters/neo-review/candidate/neo.glb packages/client/public/assets/characters/
```

The refinement also saves a packed standalone `neo-refined.blend` in its ignored output directory.

The separate office outfit does not use the facial finishing pass. Build it into staging and copy both its GLB and body texture together:

```sh
python3 scripts/build-characters.py --office --output output/characters/interrogation-staging
cp output/characters/interrogation-staging/neo-office.glb output/characters/interrogation-staging/neo-office-skin.png packages/client/public/assets/characters/
```

Build the apartment visitors separately, without the principal-cast facial finishing pass:

```sh
python3 scripts/build-characters.py --character choi --output output/characters/apartment-staging
python3 scripts/build-characters.py --character dujour --output output/characters/apartment-staging
```

Copy their GLBs, the two named skin maps and `brown_eye.png` together. Both also reference the existing `short04-hair.png`. The builder's default still rebuilds only the four principal characters.

The first command builds the meshes from the pinned sources, applies distinct morphs, subdivides anatomical surfaces, trims garment openings, fits hair outside the scalp and binds all four skeletons. `--fetch` downloads and verifies the 268 MB authoring pack into a temporary cache; later builds can omit it. `--source /path/to/cache` selects a cache. `--character neo` (or another ID) rebuilds one raw model for inspection.

The Blender pass fits the mesh using `scripts/character_fitting.py` and the checked-in `scripts/character-landmarks.json`, bakes 2K facial albedo, replaces the stock cropped-hair texture on Morpheus's scalp, tones the irises, finishes Smith's tie and saves the editable `.blend`. Run it on freshly rebuilt raw assets: it rejects an already-finished GLB and checks the source hash against the calibration. Original glTF bone axes/bind matrices are preserved so the game's animation remains consistent. Blender and Python are authoring tools only, not runtime dependencies.

For review before replacing game assets, pass `--output output/characters/staging` to the builder and `-- --assets output/characters/staging` to the Blender finishing command. `scripts/render-character-heads.py`, run through Blender with the same `--assets` option and `--output output/characters/inspection`, renders the actual GLBs from front and profile. Copy the reviewed GLBs and their referenced textures into this directory together. The finishing pass also writes per-character geometric diagnostics beside the `.blend`.

## Regenerating the facial calibration

Normal builds do not need MediaPipe. Recalibrate only after changing the raw head geometry or reference images. Use an isolated Python environment with `mediapipe==0.10.21`, `numpy<2`, `opencv-contrib-python<4.12`, and `pillow` (tested on macOS arm64/Python 3.12). Newer MediaPipe wheels encountered a native Metal graph-service crash on this machine.

Download the detector from the [official Face Landmarker model page](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker#models). Supply a new front/profile sheet in the layout described by `turnaround-prompt.txt`; this authoring input is not shipped with the game. Rebuild raw GLBs, then run:

```sh
blender --background --factory-startup --python scripts/render-character-heads.py
python3 scripts/calibrate-character-faces.py --model /path/to/face_landmarker.task --profile /path/to/matrix-turnarounds.png
blender --background --factory-startup --python scripts/finish-characters.py
```

Calibration detects 478 landmarks on each unprojected raw frontal render and on the generated front/profile references. It saves the measured points, cameras, source hashes and hairline boundaries locally. The fit uses a regularized smooth deformation with fixed neck/crown regions; it does not send photos to a cloud reconstruction service. The frontal reference is square and the profile crop is 3:4; their separate pixel aspect ratios are retained.

## Validation

`tests/character-asset.test.mts` loads the shipped character and office-outfit GLBs with Three.js. It checks bones, normalized weights, transparent eye surfaces, hand articulation, ground contact and finite mesh deformation through running, landing and punches. Office checks cover replacing the coat, sleeve/waist coverage, the posed mesh clearing the interrogation table, and Smith's arm/release-point contact. Meeting checks cover cabin headroom, scanner grips, suction contact with Neo's actual skinned torso, the scanner clearing Trinity's head at the window, and hands returning to the lap after the device is hidden. Browser inspection covers front/profile views, UV seams, hair, glasses, outfits and motion; these visual properties are not proven by the unit tests.
