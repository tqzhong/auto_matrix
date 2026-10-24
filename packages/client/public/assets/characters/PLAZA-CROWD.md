# Red-dress plaza pedestrians

The twenty decorative pedestrians use two CC0 MakeHuman bodies fitted with the stock `male_elegantsuit01` business suit. These are approximate male/female extras, not reconstructions of individual film extras. Existing principal actors and club visitors are unchanged. Source licensing and pinned core revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482` are documented in [README.md](README.md#free-source-assets) and [LICENSE-MakeHuman.txt](LICENSE-MakeHuman.txt).

The two GLBs retain all source face/hand vertices and hair cards. Jacket, trousers, shoes and eyes use smaller meshes. Each contains grounded idle plus twenty matching position/normal samples around one walking cycle. Leg targets use actual bone lengths; runtime adjusts cadence for each person's scale. Six material surfaces per body become twelve instanced draws per pass for all twenty people, replacing 133 individually skinned surfaces. Saved training time drives both instance positions and pose weights, including after asynchronous loading, pause and restore. They still use dynamic shadows and ambient occlusion.

| Asset | Bytes | Triangles per person |
| --- | ---: | ---: |
| plaza-crowd-male.glb | 6,785,916 | 21,560 |
| plaza-crowd-female.glb | 6,830,504 | 21,734 |
| plaza-business-suit.png | 1,945,326 | — |

Keep these with the existing `choi-skin.png`, `dujour-skin.png`, `short04-hair.png` and `brown_eye.png`. The new suit map is from the same verified CC0 system-asset archive, SHA-256 `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`. No film image is embedded in these assets. Combined new files add 15,561,746 bytes; this exchanges asset/graphics memory for less per-frame CPU work, not a promise of 60 FPS.

Rebuild with the existing pinned source cache (core OBJ, default skeleton/weights, the Choi/Dujour morph targets and CC0 system clothing/skin/eyes/hair). Python requires the same NumPy authoring dependency as `build-characters.py`; it is not a game runtime dependency:

```sh
python3 scripts/build-plaza-bodies.py --source /path/to/makehuman-source --output /tmp/matrix-plaza-rigs
node --import tsx scripts/build-plaza-crowd.mts /tmp/matrix-plaza-rigs
cp /tmp/matrix-plaza-rigs/plaza-business-suit.png packages/client/public/assets/characters/plaza-business-suit.png
```

The Python output is intermediate and stays outside public assets. The Node script overwrites only the two plaza crowd GLBs and records each intermediate rig hash. Tests load the delivered assets, check texture dependencies, drawing count, frozen/cold-loaded frames, actual shoe contacts, stance sliding, waist overlap and late disposal. These finite checks do not certify all clothing/skin intersections or film-quality likeness. Faces, hairstyles, skirts, bags, independent crowd routes and close-up performance remain limited.
