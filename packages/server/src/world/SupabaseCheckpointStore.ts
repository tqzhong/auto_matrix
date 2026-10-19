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
  private leaseUntil?: number;
  private uncertain?: { revision: number; payload: string; data: string; leaseUntil: number };

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
    if (this.leaseUntil !== undefined) return this.previous;
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

  /** A standby may read the world, but must acquire it before starting time or accepting players. */
  async acquire(): Promise<boolean> {
    if (!this.loaded) throw new Error('Load the cloud checkpoint before acquiring its lease');
    const rows = await this.request('?id=eq.world&select=payload,revision,lease_until,updated_at');
    if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid cloud checkpoint response');
    const now = Date.now(), lease = now + 45000;
    if (!rows.length) {
      // The initial POST still arbitrates simultaneous first boots. Save before serving players.
      this.revision = 0; this.previous = null; this.leaseUntil = lease;
      return true;
    }
    const row = rows[0];
    if (!row || typeof row.payload !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 1
      || row.lease_until !== null && typeof row.lease_until !== 'string') throw new Error('Invalid cloud checkpoint response');
    // During the first rollout the old version has no lease and saves every 30s.
    const expires = row.lease_until === null ? Date.parse(row.updated_at) + 45000 : Date.parse(row.lease_until);
    if (!Number.isFinite(expires)) throw new Error('Invalid cloud checkpoint lease');
    if (expires > now) return false;
    const leaseFilter = row.lease_until === null ? 'is.null' : `eq.${row.lease_until}`;
    const claimed = await this.request(`?id=eq.world&revision=eq.${row.revision}&lease_until=${encodeURIComponent(leaseFilter)}&select=revision`, 'PATCH',
      JSON.stringify({ revision: row.revision + 1, lease_until: new Date(lease).toISOString() }));
    if (!Array.isArray(claimed) || claimed.length > 1) throw new Error('Invalid cloud checkpoint response');
    if (!claimed.length) return false;
    if (claimed[0]?.revision !== row.revision + 1) throw new Error('Invalid cloud checkpoint response');
    this.previous = (await decompress(Buffer.from(row.payload, 'base64'), { maxOutputLength: 32 * 1024 * 1024 })).toString('utf8');
    this.revision = row.revision + 1; this.leaseUntil = lease;
    return true;
  }

  async release(): Promise<void> {
    if (this.leaseUntil === undefined) return;
    this.leaseUntil = undefined;
    if (this.revision) await this.request(`?id=eq.world&revision=eq.${this.revision}&select=revision`, 'PATCH', JSON.stringify({ lease_until: new Date(0).toISOString() }));
  }

  async save(data: string): Promise<void> {
    if (!this.loaded) throw new Error('Load the cloud checkpoint before saving');
    if (this.leaseUntil === undefined) throw new Error('Acquire the cloud checkpoint lease before saving');
    if (this.uncertain) {
      // A timed-out PATCH may already have committed. Verify that exact write
      // before advancing our revision; never adopt an unrelated writer's data.
      const rows = await this.request('?id=eq.world&select=payload,revision');
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid cloud checkpoint response');
      const row = rows[0], pending = this.uncertain;
      if (row?.revision === pending.revision && row.payload === pending.payload) {
        this.revision = pending.revision; this.previous = pending.data;
        this.leaseUntil = pending.leaseUntil;
      } else if ((row?.revision ?? 0) !== this.revision) throw new CloudCheckpointConflictError();
      this.uncertain = undefined;
    }
    if (Date.now() >= this.leaseUntil) throw new CloudCheckpointConflictError();
    const lease = Date.now() + 45000;
    if (data === this.previous) {
      if (this.leaseUntil - Date.now() > 30000) return;
      const rows = await this.request(`?id=eq.world&revision=eq.${this.revision}&select=revision`, 'PATCH', JSON.stringify({ lease_until: new Date(lease).toISOString() }));
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.revision !== this.revision) throw new CloudCheckpointConflictError();
      this.leaseUntil = lease;
      return;
    }
    const revision = this.revision + 1;
    const payload = (await compress(data)).toString('base64');
    const body = JSON.stringify({ id: 'world', revision, payload, updated_at: new Date(Date.now()).toISOString(), lease_until: new Date(lease).toISOString() });
    // An old process must not overwrite a newer instance's save during a deploy.
    this.uncertain = { revision, payload, data, leaseUntil: lease };
    const rows = await this.request(this.revision ? `?id=eq.world&revision=eq.${this.revision}&select=revision` : '?select=revision', this.revision ? 'PATCH' : 'POST', body);
    this.uncertain = undefined;
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.revision !== revision) throw new CloudCheckpointConflictError();
    this.revision = revision; this.previous = data; this.leaseUntil = lease;
  }
}
