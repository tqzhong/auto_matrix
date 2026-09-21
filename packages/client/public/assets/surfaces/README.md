# Street surface textures

1K JPEG color, OpenGL normal and roughness maps from Poly Haven:

- [Asphalt 02](https://polyhaven.com/a/asphalt_02)
- [Concrete Pavement 03](https://polyhaven.com/a/concrete_pavement_03)

These assets are available under [CC0](https://polyhaven.com/license). Original download URLs and verified source MD5 values are recorded in [sources.json](sources.json). Downloaded on 2026-09-19, unchanged apart from filenames. Files are served locally; gameplay does not contact Poly Haven.

`UrbanMaterials.ts` tiles the maps in world units, reads the color map as sRGB and the normal/roughness maps as linear data. Rain adjusts material roughness and clearcoat. Building facades are generated separately in code.
