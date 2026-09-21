import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILM_TRACKS } from '../packages/client/src/engine/OriginalScore.js';

// Public promotional excerpts from the composer's own site, not full albums.
// Verify or restore the committed game assets; attribution is in film-score.json.
for (const track of FILM_TRACKS) {
  const file = fileURLToPath(new URL(`../packages/client/public${track.file}`, import.meta.url));
  const matches = (path: string) => existsSync(path) && createHash('sha256').update(readFileSync(path)).digest('hex') === track.sha256;
  if (matches(file)) { console.log(`Ready: ${track.title}`); continue; }
  mkdirSync(dirname(file), { recursive: true });
  const pending = `${file}.download`;
  try {
    execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '90', '--output', pending, track.url], { stdio: 'inherit' });
    if (!matches(pending)) throw new Error(`Source changed: ${track.title}; review the recording before updating its hash.`);
    renameSync(pending, file); console.log(`Installed: ${track.title}`);
  } finally { rmSync(pending, { force: true }); }
}
