# Zee / Charra dock assets

Added 2026-10-06. These are approximate game characters, not scans of Nona Gaye or Rachel Blackman and not film-quality likenesses.

- `zee-head.glb` and `charra-head.glb`: 17,323 vertices / 34,544 triangles each, continuous head and neck with a closed-eyelid morph. They attach to the existing performance joints.
- `zee-body.glb` and `charra-body.glb`: about 2.74 MiB each, continuous anatomical shoulders/arms/hands, separate work tops, sewn bindings, trousers, cargo pockets and boots. The 23 bind joints follow the existing performance hierarchy. Boot cuffs blend into the shin while the soles follow the feet.
- `digger-faces.png`: unmodified 1254 × 1254 front/profile atlas generated using the built-in imagegen tool in generation mode. Top row Zee; bottom row Charra. Exact input: [digger-generation-prompt.txt](digger-generation-prompt.txt). It is a generated reference, not a film frame or actor scan.
- Anatomy: the same CC0 MakeHuman base and morph targets pinned by `scripts/build-characters.py`, revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. The generator records the selected targets and atlas row in each GLB.
- Runtime: `EpilogueHeads.ts` loads the heads, preserves existing Oracle/Sati behavior and adds Zee's fitted cloth wrap/ties and Charra's cropped hair. `DiggerBodies.ts` loads the bodies, hides only the fallback body meshes and follows the current performance joints, including contact corrections after animation. The generated atlas is also sampled for the arm/hand skin. The old geometry remains a loading/error fallback.

Rebuild these heads and bodies with the existing authoring dependency, NumPy. Generate the heads first: the body builder reads the shipped `zee-head.glb` and `charra-head.glb` from `packages/client/public/assets/characters` to fit the upper neck, even when body output is staged elsewhere.

```sh
python3 scripts/build-epilogue-heads.py --source /path/to/pinned-makehuman-cache --output packages/client/public/assets/characters --roles zee charra
python3 scripts/build-digger-bodies.py --source /path/to/pinned-makehuman-cache --output packages/client/public/assets/characters
```

Facial landmarks register the portrait to anatomical geometry; lateral silhouette masking and runtime blending prevent the backdrop and a second set of photographed features from appearing on the temples. The cloth/hair boundary clips triangles instead of dropping entire triangles. The body builder fits the same pinned anatomy to the existing limb lengths and lofts garment sections across the chest; it does not download the full MakeHuman asset pack. No extra runtime or authoring dependency was added.

These approximations still have soft side texture, simplified ears, stiff expressions, basic clothing, and no actor-specific body proportions or physical cloth simulation. Finger curling still uses the existing four simplified finger controls. Zee's other everyday costumes remain to be authored.

Validation and actual game screenshots: [head record](../../../../../output/characters/digger-cast-2026-10-05/README.md), [body and contact record](../../../../../output/characters/digger-bodies-2026-10-06/README.md). These passes do not complete story group 3-07 or the trilogy.
