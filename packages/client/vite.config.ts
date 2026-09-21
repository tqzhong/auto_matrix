import { defineConfig } from 'vite';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const recordingDirectory = fileURLToPath(new URL('../../output/gameplay/neo-longplay-2026-09-20/', import.meta.url));

export default defineConfig({
  plugins: [{ name: 'local-gameplay-recording', apply: 'serve', configureServer(server) {
    server.middlewares.use('/__recording', async (request, response, next) => {
      const file = request.url?.slice(1);
      if (!file || !/^neo-[0-9TZ-]+\.(webm|json)$/.test(file)) { next(); return; }
      const remote = request.socket.remoteAddress;
      if (request.method !== 'POST' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote ?? '') || request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
        response.statusCode = 403; response.end('Local recording requests only'); return;
      }
      try {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 16 * 1024 * 1024) { response.statusCode = 413; response.end('Recording chunk too large'); return; }
          chunks.push(Buffer.from(chunk));
        }
        await mkdir(recordingDirectory, { recursive: true });
        const output = `${recordingDirectory}${file}`;
        if (file.endsWith('.json')) await writeFile(output, Buffer.concat(chunks), { flag: 'wx' });
        else await appendFile(output, Buffer.concat(chunks));
        response.statusCode = 201; response.end('Saved');
      } catch { response.statusCode = 500; response.end('Could not save recording'); }
    });
  } }],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
      },
    },
  },
});
