# Combat implementation references

## Original Matrix trilogy audio excerpts

The game soundtrack includes 14 promotional film-score MP3 excerpts published by composer Don Davis at https://www.dondavis.net/audio/ (retrieved 2026-09-21). Site notice: “© 2026 Don Davis, For Promotional Use Only”. These recordings are not covered by the code licenses below. Their source URLs and SHA-256 hashes are recorded in `packages/client/src/engine/film-score.json`; the game-used MP3 files are included in `packages/client/public/assets/music/originals/`. No open-source or commercial redistribution license is claimed.

## Adapted code: Snaiel / Godot4ThirdPersonCombatPrototype

Source: https://github.com/Snaiel/Godot4ThirdPersonCombatPrototype/tree/cbfecf427f9a703ebf7e940fd067ed31a729d637

The dodge direction selection, short invulnerability state, attack interruption on dodge and 0.8-second recovery are adapted from `scripts/components/movement/dodge_component.gd` and `scripts/player/player_dodge_state.gd` into `packages/shared/src/constants/combat.ts` and `packages/server/src/player/PlayerController.ts`. Changes: TypeScript/Three.js client prediction, server authority, backward neutral dodge, swept building collision, 0.22-second duration. The melee component's contact/recovery and interrupted-attack rules also informed the attack lifecycle; Godot scenes and plugins are not imported.

MIT License

Copyright (c) 2023 Snaiel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Design/code reference: GDQuest third-person controller

Source: https://github.com/gdquest-demos/godot-4-3d-third-person-controller/tree/b3bd6e81084f568be8aa44a69a0c2b1e52e806b3

Reviewed `player/player.gd` and `player/melee_attack_area.gd` for separating vertical gravity from planar acceleration, animation-driven attack activation, and impact direction. Our movement, hit detection and animation implementations use the existing TypeScript architecture. No GDQuest models, textures, audio or scene assets are included. The upstream code license is reproduced below for attribution; its art has a separate license.

Copyright (c) 2023-present GDQuest

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
