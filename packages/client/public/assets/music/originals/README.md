# Don Davis — trilogy audio excerpts

The repository includes 14 original film score excerpts (21.14 minutes, 15.23 MB / 14.53 MiB) from [Don Davis's official audio page](https://www.dondavis.net/audio/), retrieved 2026-09-21. These are the composer's published promotional MP3 clips, not complete album tracks or re-created music. Source URLs, durations, byte counts and SHA-256 hashes are in `packages/client/src/engine/film-score.json`.

`npm run music:originals` restores missing local files and verifies their hashes. It skips verified files, preserves an existing file if download verification fails, and uses curl with normal certificate verification. The game loads local files and does not depend on a third-party player, account, or live streaming connection. These 14 recordings are the only BGM sources for all 26 music scenes. Missing/unplayable originals fade out the previous music; the sound panel reports the failure and offers retry. There is no synthesized fallback or browser import override.

Only the 14 game-used recordings are committed; duplicate listening compilations are not retained. The source's notice is **“© 2026 Don Davis, For Promotional Use Only”**; it is not an open-source or commercial game redistribution license. Game builds include these files. Review audio rights before distributing such a build.
