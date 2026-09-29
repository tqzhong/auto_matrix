# Playable character assets

Neo, Trinity, Agent Smith and Morpheus now each have an anatomical, skinned GLB. The same assets are loaded by the game and the character inspector. Every character has 46 bones, including articulated fingers, and approximately 80–90k triangles for Trinity, Smith and Morpheus; Neo has about 154k after the separate grooming pass. The former primitive heads/bodies remain only as a loading fallback and for other residents; distant characters use the existing lightweight LOD.

The four heads use different MakeHuman morphs followed by image-constrained mesh fitting, with continuous ears/neck geometry. Facial contour, eyebrows, eye openings, nose and lips are fitted to the generated frontal portraits; the profile image constrains the central forehead/nose/lip/chin depth. Eye meshes follow the same deformation. Hair-card roots follow the reference hairline and are kept outside the fitted scalp. Clothes, skin, iris tone and glasses differ by character. Neo and Morpheus have simulated coat panels with leg collision; Trinity has a fitted leather outfit; Smith has a charcoal suit, white shirt and dark tie. All four support the inspector's glasses toggle and motion previews.

Neo has an additional local refinement pass: narrower eyelid openings, a slightly fuller lower face, a procedural short-hair scalp with 3,000 swept mesh ribbons, and a baked tangent-space skin normal map. The groom replaces his stock hair-card mesh and remains bound to the same head bone. The actor likeness is still weak; these changes address visible surface and silhouette defects, not film-quality reconstruction. The other three characters retain the previous assets.

The four principal characters also have corrected shoe bindings. The source proxy attached parts of the soles to the shin, bending the heel when the knee flexed. Soles now follow the ankle rigidly, with a smooth transition back to the original weights above the ankle. Only shoe joint indices/weights change; all geometry, faces, textures and other clothing remain intact. The hotel stair solver samples those actual soles against the shared treads, adjusts each leg independently and preserves the walking lift. Its in-game appearance and frame cost still await browser review.

The office, ledge and interrogation use `neo-office.glb`, an additional shirt and torso bound to Neo's existing 46-bone skeleton. It replaces the coat and black undershirt, keeps his trousers/head/hands, and uses `neo-office-skin.png` for the previously covered abdomen. The CC0 casual shirt is trimmed and lengthened to meet the shipped trouser waist while retaining its sleeves. The lowered hem is rebound to the nearby abdomen weights so leaning over the delivery form does not pull it through the body. The tie, opening shirt, mouth deformation and tracking device are driven by the saved interrogation timeline. Jones and Brown currently reuse Smith's rig with small head-shape variations; these are temporary stand-ins, not likenesses of their actors.

Rhineheart reuses Smith's rig with different suit/hair colors and no glasses. The courier reuses Neo's rig with a blue office shirt and cap. Their keyboard, clipboard, package and pen contacts follow the saved office workday timeline. They are temporary support-character assets, not new actor likenesses.

The apartment visitors use separate `choi.glb` and `dujour.glb` rigs built from the same pinned CC0 MakeHuman assets. Their height/head morphs and unprojected skin differ from the principal cast; Dujour's sleeveless top exposes the shoulder for the runtime white-rabbit tattoo. The saved apartment timeline drives knocking, disk/cash exchange and turning toward the clue. These are provisional supporting models, not likenesses of their actors. Clothes, hair, expressions and hand contact still need visual refinement.

The club uses `club-male.glb` and `club-female.glb`, lighter versions of those two CC0 rigs without surface subdivision. Sixteen dancers share their geometry and textures, with separate bone poses and clothing colors. The assets reuse `choi-skin.png`, `dujour-skin.png`, `brown_eye.png` and `short04-hair.png`; there are no new texture downloads at runtime. These extras are decorative and currently have no personal interaction or collision. Trinity's finished jacket has separate waist and shoulder corrections: the hem overlaps the trousers and follows her pelvis during the lean, and the shoulder caps have a small surface-normal offset instead of lying almost coincident with the skin. The shoulder pass changes only jacket positions/normals; her head, textures, skin weights and other meshes are preserved.

Trinity now wears `trinity-club.glb` in `film_white_rabbit_club`: a separate strapless black bodice with bare shoulders, back and arms. The reference is the first encounter's [front view, frame 0690](https://www.cap-that.com/the-matrix/index.php?image=matrix%281999%29_0690.jpg) and [back view, frame 0710](https://www.cap-that.com/the-matrix/index.php?image=matrix%281999%29_0710.jpg). Film images are authoring references only and are not shipped. The bodice bridges smoothed convex torso sections, has a folded upper edge and small panel joins, overlaps the trousers and uses glTF clearcoat. The new skin complements the finished head/hands at their existing boundary rings; matching boundary normals and a measured skin-color multiplier avoid hard shoulder seams. It reuses `dujour-skin.png`, the same CC0 female body map. The 890,976-byte GLB adds 21,206 triangles while hiding the 16,736-triangle jacket, a net 4,470 visible triangles. All 46 bones are shared with the existing performance rig. Scene location selects the costume on cold load; leaving restores the jacket, and support characters keep their own outfits. Neutral Blender views and exported game poses have been inspected. Film-costume details, cloth movement, likeness, nightclub lighting and actual browser frame cost remain unverified; this is not a scanned or film-quality costume.

The bridge/car encounter reuses the office torso beneath Neo's lifted black shirt and hides his outer coat panels while seated. Switch uses Trinity's rig with blond hair; Apoc uses Neo's rig. These two support characters are temporary stand-ins, with no new actor likeness assets. Their seated steering/guarding poses and Trinity's scanner contact are driven by the saved meeting timeline. A rest-space skin mask prevents shoulder skin from protruding through the leather outfit during the lean.

These are approximate film likenesses, not actor scans or complete photogrammetric reconstructions. The reference images are generated interpretations. Profile constraints cover the center of the face; ears, back of the head and hair volume still come from the anatomical base assets. Animation is driven by the existing motion solver, with no facial performance capture or lip sync. Geometric alignment scores do not establish perceptual likeness or film-quality fidelity.

The tracking-chair and mirror performance use `neo-tracking.glb`: a black short-sleeved cotton shirt, exposed arms and a separate complete patient body, bound to the same 46 bones. It reuses `neo-office-skin.png`; no new texture or runtime dependency is required. The CC0 `male_casualsuit06` shirt is fitted to Neo and its hem overlaps the trousers. Hem lengthening is limited to torso vertices: the source A-pose puts some cuffs at the same height as the hem, so using height alone lowered 149 sleeve vertices and rebound them to the abdomen. Correcting that authoring step keeps the original arm weights and removes the hanging flaps. The former final sleeve-rebinding workaround is no longer needed and must not be applied to the corrected mesh. The anatomical arms, patient body, skeleton, UVs and triangle count are unchanged. Covered skin is removed using the source garment's mask, while the wrist rings meet the existing hands. The finished head/hands mesh also has a separate index selection that hides shoulder caps beneath this shirt without modifying the facial vertices. The saved `touch` performance selects the outfit, including a cold resume. The pod, drainage, rescue and recovery use the unmasked anatomical body, with complete arms, legs and feet; it replaces the partial office torso and skin-colored trousers. Office and later scenes restore their own clothing. Only the relevant meshes render in each phase. Coat removal is currently an outfit transition, not an acted undressing sequence. The shirt has no cloth simulation or scanned film-costume detail, and the patient still uses Neo's existing proportions rather than the film's emaciated body. Full-cuff deformation, skin coverage and wrist continuity have geometry regression coverage. The corrected sleeve silhouette has also been checked at the same resumed mirror pose in first and third person; this local review does not establish film-quality clothing or performance.

## Editable Blender project

The finishing script can generate `output/characters/matrix-cast.blend` (relative to the repository root), containing all four rigs, outfits, editable glasses/coat counterparts, packed materials and the frontal reference atlas. Generated Blender projects and intermediate meshes are not retained or committed. Local inspection captures under `output/` are not shipped with the game. In the game, glasses and coat panels are managed by `HeroModel.ts` so the cloth can keep responding to movement.

`matrix-faces.png` is the frontal atlas used by the game's loading fallback and by the authoring tools; its prompt is in `generation-prompt.txt`. The former `matrix-turnarounds.png` was an authoring-only front/profile reference sheet generated with the prompt in `turnaround-prompt.txt`. That unused runtime image has been removed; its measured profile constraints remain in `scripts/character-landmarks.json`, so normal rebuilds do not need the sheet. After deforming the mesh, Blender bakes the registered frontal atlas into each character's `*-albedo.png` using the mesh's proper UV layout. Stock skin is color-matched before blending to reduce face/neck seams. The finished models use these baked maps without depending on a face-projection shader.

GLB files in this directory reference their neighboring PNG textures. Keep the directory together when importing them elsewhere. The four character GLBs, Neo's office outfit, the two apartment visitors, their referenced textures and the runtime frontal atlas are retained here, alongside documentation and attribution. In particular, `choi-skin.png`, `dujour-skin.png` and `brown_eye.png` are runtime dependencies of the visitors. Other unused raw skin/eye/suit textures are intermediate files regenerated by the builder. Generated `.blend` projects pack their images internally.

## Free source assets

All downloaded base geometry, morph targets, rigs, skin, eye, hair and clothing assets are **CC0 MakeHuman core/system assets**. There is no paid model, subscription or third-party request at game runtime. See the [official asset license](https://static.makehumancommunity.org/about/license.html) and [included CC0 text](LICENSE-MakeHuman.txt).

- [MakeHuman core assets](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data): base mesh, per-character targets, skeleton and skin weights. Pinned revision: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`.
- [MakeHuman system pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html): `short04` hair, high-poly eyes with brown/bluegreen/grey textures, young Caucasian male/female and middle-aged Caucasian/African male skin, `male_elegantsuit01`, `male_casualsuit01`, `female_casualsuit01`, and `shoes01`. Source credit: MakeHuman team, Data Collection AB, Joel Palmius and Jonas Hauquier.
- [Source archive](https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip), SHA-256 `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`.
- Blender authoring used [official Blender 4.5.9 LTS](https://download.blender.org/release/Blender4.5/), macOS arm64 DMG SHA-256 `e3a3d7aac381fb4e4d05197f99cd8899484d7e8bc4497c134066e6733f372238`.

The tracking shirt comes from `male_casualsuit06` in that same verified CC0 system archive, with the same source credits. Its source clothing texture and jeans are not shipped.

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

Build the tracking outfit without rebuilding the finished face. Copy only the GLB; it references the existing full-body skin from the office outfit:

```sh
python3 scripts/build-characters.py --tracking --output output/characters/tracking-staging
cp output/characters/tracking-staging/neo-tracking.glb packages/client/public/assets/characters/
```

Build the apartment visitors separately, without the principal-cast facial finishing pass:

```sh
python3 scripts/build-characters.py --character choi --output output/characters/apartment-staging
python3 scripts/build-characters.py --character dujour --output output/characters/apartment-staging
```

Copy their GLBs, the two named skin maps and `brown_eye.png` together. Both also reference the existing `short04-hair.png`. The builder's default still rebuilds only the four principal characters.

Build only the lighter club extras from the same cached sources, without Blender:

```sh
python3 scripts/build-club-crowd.py
```

Build Trinity's club outfit without rebuilding her finished head. Keep the shipped `trinity.glb` available: its shoulder/wrist boundary normals are used to join the new surfaces. Review staging before copying only the costume GLB:

```sh
python3 scripts/build-characters.py --trinity-club --output output/characters/club-costume-staging
cp packages/client/public/assets/characters/dujour-skin.png output/characters/club-costume-staging/dujour-skin.png
blender --background --factory-startup --python-exit-code 1 --python scripts/render-trinity-club.py -- --costume output/characters/club-costume-staging/trinity-club.glb --output output/characters/club-costume-inspection
cp output/characters/club-costume-staging/trinity-club.glb packages/client/public/assets/characters/trinity-club.glb
node --import tsx scripts/export-club-pose.mts output/characters/club-costume-poses
blender --background --factory-startup --python-exit-code 1 --python scripts/render-trinity-club.py -- --pose output/characters/club-costume-poses/whisper.json --output output/characters/club-costume-inspection
```

The last two commands export the actual game solver's introduction/whisper/question surfaces and render the selected pose offline. They do not run the browser, simulate the nightclub lighting or establish performance. Delete intermediate staging meshes and pose JSON after review; the costume references the already shipped body texture.

After rebuilding the finished Trinity, apply the waist and shoulder corrections once, into staging. Each script rejects an already-corrected input; review and copy only the final GLB:

```sh
python3 scripts/fit-trinity-waist.py --output output/characters/club-staging/trinity.glb
python3 scripts/fit-trinity-shoulders.py --source output/characters/club-staging/trinity.glb --output output/characters/shoulder-staging/trinity.glb
cp output/characters/shoulder-staging/trinity.glb packages/client/public/assets/characters/trinity.glb
```

After all four principal-character finishing passes, correct the shoe bindings once. The script rejects already-corrected inputs:

```sh
for character in neo trinity smith morpheus; do
  python3 scripts/fit-character-soles.py --source "packages/client/public/assets/characters/$character.glb" --output "output/characters/sole-staging/$character.glb"
  cp "output/characters/sole-staging/$character.glb" "packages/client/public/assets/characters/$character.glb"
done
```

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

Club checks load the actual new costume, verify cold scene entry and repeated outfit restoration, preserve the finished face/hands and trousers, and probe waist coverage in the three conversation phases. Every exposed shoulder/wrist boundary is matched to the original skin and checked for coincident animated positions and matching normals. Neutral front, back and three-quarter Blender views also inspect the real exported whisper pose. The nightclub's in-game lighting, shadows, camera and frame cost still require browser review.

Shoe checks load all four shipped rigs, bend their knees and verify that the soles retain their shape. Hotel checks cover standing across two treads, real shoe clearance at heel/toe edges, paused poses, Neo/Trinity walking both directions on both flights at low/middle/high floors, and releasing the correction when jumping, fighting, sitting or leaving the stairwell. These geometric checks do not establish natural-looking gait, film likeness or acceptable in-game performance.

The tracking-outfit checks use the shipped GLB to verify wrist continuity, shared animated bones, exposed forearms, sleeve coverage, bounds and silver arrival through the reaching poses. Outfit checks cover entering directly at a saved mirror time and restoring office, pod and normal clothing. Patient checks probe both forearms and calves in pod, floating and recovery poses, confirm feet are present and that trousers no longer substitute for skin. Actual material appearance and the reflection still require browser review.

`tests/character-asset.test.mts` loads the shipped character and office-outfit GLBs with Three.js. It checks bones, normalized weights, transparent eye surfaces, hand articulation, ground contact and finite mesh deformation through running, landing and punches. Office checks cover replacing the coat, sleeve/waist coverage, the posed mesh clearing the interrogation table, and Smith's arm/release-point contact. Meeting checks cover cabin headroom, scanner grips, suction contact with Neo's actual skinned torso, the scanner clearing Trinity's head at the window, and hands returning to the lap after the device is hidden. Browser inspection covers front/profile views, UV seams, hair, glasses, outfits and motion; these visual properties are not proven by the unit tests.
