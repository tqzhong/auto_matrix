# Film environment materials

Six 1K PBR material sets from [Poly Haven](https://polyhaven.com/), used by the film-set renderers. CC0: https://polyhaven.com/license. Source URLs and verified MD5 checksums are recorded in sources.json. Only runtime diffuse, OpenGL normal and roughness maps are included.

Lafayette also uses two original generated color textures (1254 × 1254), created with the built-in imagegen tool on 2026-09-28 and encoded as JPEG at quality 90 for the game:

- `lafayette-wallpaper-v1.jpg`: aged olive damask paper, subtle peeling and damp marks, flat diffuse illumination. Repeated at a fixed world scale on the meeting-room partitions.
- `lafayette-rug-v1.jpg`: worn burgundy Persian carpet with floral borders, a central medallion and threadbare areas. Mapped once onto each room rug.

These are generated interpretations, not extracted film stills, scans of the original set, or Poly Haven CC0 assets. The material direction follows the [archived interview with production designer Owen Paterson](https://www.matrixfans.net/interview-with-production-designer-owen-paterson/amp/), which describes distressing the Lafayette walls, carpets and curtains. The images contain no baked room lighting; the game supplies the lighting, 3D trim, drapery and furniture. Normal/roughness maps from the six existing sets retain their source attribution above.

SHA-256:

```text
ab1491644b21ac3d0c1d90baed4117314c30b361f1ecf4724fd1ad576ad3a4b0  lafayette-wallpaper-v1.jpg
57bd57cfd7102b4c2ae409a00814277edaae7cbc7488a07e664d5f5fed13f1d8  lafayette-rug-v1.jpg
```
