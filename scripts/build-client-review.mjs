import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2];
const output = path.resolve(root, target ?? '');
if (!target || !output.startsWith(path.join(root, 'output') + path.sep)) {
  throw new Error('Usage: npm run build:review -- output/<review>/client-dist (a new directory)');
}
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
// Keep independent snapshots while sharing unchanged blocks where supported.
// Node 22's clone flag silently falls back to full copies on macOS.
const publicDir = path.join(root, 'packages/client/public');
if (process.platform === 'darwin') {
  await promisify(execFile)('/usr/bin/ditto', ['--clone', publicDir, output]);
} else {
  await cp(publicDir, output, { recursive: true, dereference: true, mode: constants.COPYFILE_FICLONE });
}
await build({
  root: path.join(root, 'packages/client'),
  configFile: path.join(root, 'packages/client/vite.config.ts'),
  build: { outDir: output, copyPublicDir: false, emptyOutDir: false },
});
