import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const compress = promisify(gzip), decompress = promisify(gunzip);

export class CloudCheckpointConflictError extends Error {
  constructor() { super('Cloud checkpoint changed in another instance; stop this instance and reload the saved world'); }
}

/** One compressed, atomic snapshot; never expose the secret key to the client. */
export class SupabaseCheckpointStore {
  private endpoint: string;
  private revision = 0;
  private loaded = false;
  private previous: string | null = null;
  private uncertain?: { revision: number; payload: string; data: string };

  constructor(url: string, private secretKey: string) {
    const origin = new URL(url);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('SUPABASE_URL must be an HTTPS project origin');
    if (!secretKey.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY must be a server secret key');
    this.endpoint = new URL('/rest/v1/matrix_checkpoints', origin).href;
  }

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): SupabaseCheckpointStore | undefined {
    if (!env.MATRIX_CLOUD_SAVE) return undefined;
    if (env.MATRIX_CLOUD_SAVE !== 'supabase') throw new Error('Unsupported MATRIX_CLOUD_SAVE');
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error('Cloud saves require SUPABASE_URL and SUPABASE_SECRET_KEY');
    return new SupabaseCheckpointStore(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  }

  private async request(query: string, method = 'GET', body?: string): Promise<unknown> {
    const response = await fetch(`${this.endpoint}${query}`, {
      method, body, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { apikey: this.secretKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    });
    // Do not include the provider's response body or credentials in public logs.
    if (!response.ok) throw new Error(`Cloud checkpoint ${method} failed (HTTP ${response.status})`);
    return response.json();
  }

  async load(): Promise<string | null> {
    const rows = await this.request('?id=eq.world&select=payload,revision');
    if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid cloud checkpoint response');
    if (!rows.length) {
      this.loaded = true; this.revision = 0; this.previous = null;
      return null;
    }
    const row = rows[0];
    if (!row || typeof row.payload !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('Invalid cloud checkpoint response');
    const data = (await decompress(Buffer.from(row.payload, 'base64'), { maxOutputLength: 32 * 1024 * 1024 })).toString('utf8');
    this.revision = row.revision; this.previous = data; this.loaded = true;
    return data;
  }

  async save(data: string): Promise<void> {
    if (!this.loaded) throw new Error('Load the cloud checkpoint before saving');
    if (this.uncertain) {
      // A timed-out PATCH may already have committed. Verify that exact write
      // before advancing our revision; never adopt an unrelated writer's data.
      const rows = await this.request('?id=eq.world&select=payload,revision');
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid cloud checkpoint response');
      const row = rows[0], pending = this.uncertain;
      if (row?.revision === pending.revision && row.payload === pending.payload) {
        this.revision = pending.revision; this.previous = pending.data;
      } else if ((row?.revision ?? 0) !== this.revision) throw new CloudCheckpointConflictError();
      this.uncertain = undefined;
    }
    if (data === this.previous) return;
    const revision = this.revision + 1;
    const payload = (await compress(data)).toString('base64');
    const body = JSON.stringify({ id: 'world', revision, payload, updated_at: new Date().toISOString() });
    // An old process must not overwrite a newer instance's save during a deploy.
    this.uncertain = { revision, payload, data };
    const rows = await this.request(this.revision ? `?id=eq.world&revision=eq.${this.revision}&select=revision` : '?select=revision', this.revision ? 'PATCH' : 'POST', body);
    this.uncertain = undefined;
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.revision !== revision) throw new CloudCheckpointConflictError();
    this.revision = revision; this.previous = data;
  }
}
