# Zion temple audience

Added 2026-10-06–07. These are approximate background people, not film extras reconstructed from footage or new autonomous agents.

`zion-crowd-male.glb` and `zion-crowd-female.glb` reuse the shipped `club-male.glb` / `club-female.glb` anatomical bases. Their CC0 MakeHuman geometry, clothing, hair, eye and skin sources are credited in [README.md](README.md#free-source-assets) and [LICENSE-MakeHuman.txt](LICENSE-MakeHuman.txt). The pinned core revision is `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`; each export records the input GLB's SHA-256. No new download or paid asset is required.

| Asset | Bytes | Triangles | Surfaces |
| --- | ---: | ---: | ---: |
| Male | 661,872 | 6,393 | 6 |
| Female | 662,752 | 6,652 | 6 |

Keep these GLBs with `choi-skin.png`, `dujour-skin.png`, `short04-hair.png` and `brown_eye.png`. Each model has separate skin, top, trousers, boots, eyes and hair surfaces. Tops are lengthened into the trouser waist after removing the source coat. Runtime provides earthy colors and one small procedural cotton texture; no new image file is shipped.

Rebuild from the repository root with the installed Node/Three.js dependencies:

```sh
node --import tsx scripts/build-zion-crowd.mts
```

This overwrites only the two audience GLBs. The build bakes the existing rig into a neutral standing pose and four matching arm morphs: half/full lift for each side. It simplifies the neutral topology once and recovers all poses from the surviving vertex IDs. There are no runtime skeletons or individually animated crowd objects. `ZionCrowdRenderer.ts` instantiates the six surfaces of each body, retains a passage for the player and space for the named reunion characters, and drives the ceasefire response from the saved announcement/embrace clock. Male and female assets become visible independently as they load; leaving releases instance/morph textures and late-loaded resources.

`tests/zion-crowd.test.mts` loads the actual GLBs to check hands, separate legs, planted soles, waist coverage at sampled arm poses, matching morph topology, budgets, saved-clock stability and disposal. Native first/third-person report views and a real server restart were inspected; [evidence and limits](../../../../../output/gameplay/trilogy-temple-crowd-2026-10-06/README.md) retain the failures as well as the final results. Faces, clothing variety, natural crowd performance and frame rate still need work. The second-film dance continues to use the existing scene clock and has not received a new live playthrough or persistent dance-clock validation here.
