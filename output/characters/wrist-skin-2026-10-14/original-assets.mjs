// Test-only original-asset baseline. Does not overwrite runtime files.
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
const read = fs.readFile;
fs.readFile = (path, ...args) => {
  const name = path instanceof URL ? fileURLToPath(path) : String(path);
  const role = /\/packages\/client\/public\/assets\/characters\/(neo|trinity|smith|morpheus)\.glb$/.exec(name)?.[1];
  return read(role ? new URL(`./original/${role}.glb`, import.meta.url) : path, ...args);
};
syncBuiltinESMExports();
