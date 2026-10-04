# Street surface textures

1K JPEG color, OpenGL normal and roughness maps from Poly Haven:

- [Asphalt 02](https://polyhaven.com/a/asphalt_02)
- [Concrete Pavement 03](https://polyhaven.com/a/concrete_pavement_03)

These assets are available under [CC0](https://polyhaven.com/license). Original download URLs and verified source MD5 values are recorded in [sources.json](sources.json). Downloaded on 2026-09-19, unchanged apart from filenames. Files are served locally; gameplay does not contact Poly Haven.

`UrbanMaterials.ts` tiles the maps in world units, reads the color map as sRGB and the normal/roughness maps as linear data. Rain adjusts material roughness and clearcoat. Building facades are generated separately in code.

`MeetingSetRenderer.ts` also uses these maps for the Adams Street–Lafayette road and pavement, with an eight-world-unit tile. Shallow bridge puddles are a separate, fixed reflection layer; they do not replace the asphalt or cover the raised pavement.

`SmithFinaleRenderer.ts` uses the 2K color, OpenGL normal and roughness maps from [Seaside Rock](https://polyhaven.com/a/seaside_rock), by Dimitrios Savva / Poly Haven, for the exposed road bed and rubble of the Revolutions crater. These three CC0 maps were downloaded unchanged on 2026-10-04 (10,092,418 bytes total); their original URLs and verified MD5 values are also in `sources.json`. They are served locally with the game.
