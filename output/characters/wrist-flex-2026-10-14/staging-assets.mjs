// Test-only staging assets; no runtime files are overwritten.
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
const read = fs.readFile;
fs.readFile = (path, ...args) => {
  const name = path instanceof URL ? fileURLToPath(path) : String(path);
  const asset = /\/packages\/client\/public\/assets\/characters\/((?:neo|trinity|smith|morpheus)(?:\.glb|-wrist-skin\.png))$/.exec(name)?.[1];
  return read(asset ? new URL(`./staging-final/${asset}`, import.meta.url) : path, ...args);
};
syncBuiltinESMExports();
