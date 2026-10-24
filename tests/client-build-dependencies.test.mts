import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';

const exec = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'matrix-client-build-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const put = async (path: string, text: string) => {
    const target = join(directory, path); await mkdir(join(target, '..'), { recursive: true }); await writeFile(target, text);
  };
  await put('package.json', JSON.stringify({ private: true, workspaces: ['packages/*'] }));
  for (const name of ['client', 'shared']) {
    const source = JSON.parse(await readFile(join(root, 'packages', name, 'package.json'), 'utf8'));
    await put(`packages/${name}/package.json`, JSON.stringify({ name: source.name, type: source.type, main: source.main, types: source.types, exports: source.exports, scripts: source.scripts }));
    await put(`packages/${name}/tsconfig.json`, await readFile(join(root, 'packages', name, 'tsconfig.json'), 'utf8'));
  }
  await put('tsconfig.base.json', await readFile(join(root, 'tsconfig.base.json'), 'utf8'));
  await put('packages/shared/src/index.ts', 'export const release = .95;\n');
  await put('packages/shared/dist/index.js', 'export const release = .55;\n');
  await put('packages/shared/dist/index.d.ts', 'export declare const release = .55;\n');
  await put('packages/client/src/main.ts', "import { release } from '@auto_matrix/shared'; document.body.dataset.release = String(release);\n");
  await put('packages/client/index.html', '<body><script type="module" src="/src/main.ts"></script></body>');
  await put('packages/client/vite.config.mjs', 'export default { build: { modulePreload: { polyfill: false }, minify: false } };\n');
  await mkdir(join(directory, 'node_modules/@auto_matrix'), { recursive: true });
  await symlink(join(directory, 'packages/shared'), join(directory, 'node_modules/@auto_matrix/shared'), 'dir');
  await mkdir(join(directory, 'node_modules/.bin'), { recursive: true });
  for (const [name, path] of [['tsc', 'typescript/bin/tsc'], ['vite', 'vite/bin/vite.js']])
    await symlink(join(root, 'node_modules', path), join(directory, 'node_modules/.bin', name), 'file');
  const build = () => exec('npm', ['run', 'build', '--workspace', '@auto_matrix/client'], { cwd: directory });
  const renderedRelease = async () => {
    const assets = join(directory, 'packages/client/dist/assets'), script = (await readdir(assets)).find(name => name.endsWith('.js'))!;
    const document = { body: { dataset: {} as { release?: string } } };
    runInNewContext(await readFile(join(assets, script), 'utf8'), { document });
    return document.body.dataset.release;
  };
  return { directory, put, build, renderedRelease };
}

test('a standalone client build bundles current shared source after stale, changed and missing outputs', async t => {
  const h = await fixture(t);
  await h.build(); assert.equal(await h.renderedRelease(), '0.95', 'the delivered browser bundle cannot keep the stale .55-second release');
  await h.put('packages/shared/src/index.ts', 'export const release = .8;\n');
  await h.build(); assert.equal(await h.renderedRelease(), '0.8', 'a later source edit must reach the next client bundle');
  await rm(join(h.directory, 'packages/shared/dist'), { recursive: true });
  await h.build(); assert.equal(await h.renderedRelease(), '0.8', 'a clean standalone client build also builds its shared dependency');
});

test('a shared compile failure stops the client build before replacing its last usable output', async t => {
  const h = await fixture(t);
  await h.put('packages/client/dist/index.html', 'previous usable build');
  await h.put('packages/shared/src/index.ts', "export const release: number = 'invalid';\n");
  await assert.rejects(h.build, 'shared source errors cannot silently publish an older compiled value');
  assert.equal(await readFile(join(h.directory, 'packages/client/dist/index.html'), 'utf8'), 'previous usable build');
});
