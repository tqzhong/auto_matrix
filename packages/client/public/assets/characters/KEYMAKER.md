# The Keymaker assets

Added 2026-10-08. These are approximate game models, not an actor scan or a film-fidelity signoff.

- `keymaker-face-reference.png`: the unmodified **1254 × 1254** output of the built-in imagegen tool, in generation mode. It contains front and right-facing profile panels of an older East Asian face. The [exact prompt](../../../../../output/gameplay/trilogy-keymaker-cast-2026-10-07/generation-prompt.txt) is retained. This generated reference is used as the runtime head/neck atlas; it is not a movie frame or proof of the game render.
- `keymaker-head.glb`: a continuous anatomical head and neck, with registered front/profile UVs and an eyelid morph. The right-facing profile uses its own registration direction; older character assets were not regenerated. Runtime adds short swept-back graying hair and thin reading glasses with transparent lenses instead of a generic bald head and dark sunglasses.
- `keymaker-body.glb`: a continuous body and fitted olive-brown work jacket, pale shirt, dark work apron, waist keys, trousers and low shoes. The six brass keys share one mesh. The apron and jacket use the existing 23 performance joints, and the character is shorter than Morpheus. This is fitted geometry, not cloth simulation or motion capture.
- Anatomy, targets and weights reuse the CC0 MakeHuman source pinned by `scripts/build-characters.py`, revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Targets and joints are recorded in the GLBs. Existing characters were not rebuilt for this addition.
- Costume direction was checked against the public [Movieclips Truck Stop excerpt](https://www.youtube.com/watch?v=wSPAPeO17Zk), especially the two characters on the truck at about 48 seconds. No movie footage is shipped with the assets. The likeness, hair, clothing folds and performance remain approximations.
- Runtime loading uses the existing `EpilogueHeads.ts`, `DiggerBodies.ts` and `CharacterModel.ts` paths. The actual new body is included in motorcycle handoff and Neo carry contact checks; the browser verifies materials separately from Node's geometry-only loader.

Build the head before the body because the body generator reads the exported neck section. Use an authoring Python environment with NumPy; no Python, Blender or image-generation service is required to run the game.

```sh
python3 scripts/build-epilogue-heads.py --source output/gameplay/trilogy-keymaker-cast-2026-10-07/makehuman-source --output packages/client/public/assets/characters --roles keymaker
python3 scripts/build-digger-bodies.py --source output/gameplay/trilogy-keymaker-cast-2026-10-07/makehuman-source --output packages/client/public/assets/characters --roles keymaker
```

The local source cache includes the pinned nose target needed for this role. [Asset sizes, hashes and topology](../../../../../output/gameplay/trilogy-keymaker-cast-2026-10-07/asset-manifest.json) and [actual screenshots, failures and bounded verification](../../../../../output/gameplay/trilogy-keymaker-cast-2026-10-07/README.md) distinguish this addition from completed freeway or trilogy production. Actor likeness, natural animation, complete contact coverage, world detail, sound, continuous manual play and stable performance remain unfinished.
