# Zion withdrawal workwear

Added 2026-10-11 for the third-film dock evacuation. These are approximate game costumes, not scanned actors or a verified reconstruction of every filmed extra.

`dock-male.glb` and `dock-female.glb` use the same pinned CC0 MakeHuman anatomy, 46-bone rig, hair, eyes, footwear and skin maps as the existing background characters. They have separately authored closed-neck long-sleeved work tops and trousers. The old club models remain unchanged. Runtime provides subdued earth-tone variations and a small woven bump pattern; no new runtime dependency is needed.

`colt-body.glb` adds a separate open brown woven vest and wine collar visible only during dock withdrawal. The existing Colt head is enabled for that scene, with a modeled radio headset and boom microphone. The cream undershirt uses its own material so it cannot recolor the trousers; medical scenes retain their previous outfit. The visible reference is the [unloading excerpt](https://clip.cafe/the-matrix-revolutions-2003/come-on-get-it-cut/), with local frames in `output/gameplay/trilogy-dock-evacuation-2026-10-06/`. Those frames support the officer's vest, light sleeves and radio, but not a precise costume attribution for each background person or the full lift layout.

Source revision and licenses are recorded in [README.md](README.md). The existing pipeline pins MakeHuman revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482` and verifies the CC0 system archive SHA-256 `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`. Skin/hair/eye texture filenames remain shared with Choi/Dujour. No movie frames or clips are shipped as game textures.

Rebuild with the existing NumPy authoring environment:

```sh
python3 scripts/build-dock-crowd.py --source output/gameplay/trilogy-dock-wardrobe-2026-10-11/source
python3 scripts/build-digger-bodies.py --source output/characters/epilogue-cast-2026-10-05/source --output packages/client/public/assets/characters --roles colt kid
```

The source cache is for authoring only; the browser loads the shipped GLBs and existing image maps. Actual mesh, saved pose, garment contact and native checkpoint evidence is recorded in `output/gameplay/trilogy-dock-wardrobe-2026-10-11/`. Face likeness, individually researched extras, natural cloth and facial performance, complete scene fidelity and sustained frame rate remain unfinished.
