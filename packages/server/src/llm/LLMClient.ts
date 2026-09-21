import OpenAI from 'openai';
import type { LLMRequest, LLMResponse, LLMConfig } from '@auto_matrix/shared';

interface CacheEntry {
  result: LLMResponse;
  timestamp: number;
}

export class LLMClient {
  readonly enabled: boolean;
  status: 'offline' | 'ready' | 'degraded';
  private retryAfter = 0;
  private inFlight = 0;
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs = 60_000;
  private lastCallTime = 0;
  private minCallIntervalMs = 200; // 5 req/sec max

  constructor(config: LLMConfig) {
    this.enabled = Boolean(config.apiKey && config.apiKey !== 'your-api-key-here');
    this.status = this.enabled ? 'ready' : 'offline';
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey || 'offline',
      timeout: 8000,
      maxRetries: 0,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.minCallIntervalMs = Math.max(1000, 60000 / config.maxRequestsPerMinute);
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const empty: LLMResponse = { content: '', usage: { promptTokens: 0, completionTokens: 0 } };
    if (!this.enabled || Date.now() < this.retryAfter || this.inFlight >= 2 || Date.now() - this.lastCallTime < this.minCallIntervalMs) return empty;
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.result;
    }

    this.lastCallTime = Date.now();
    this.inFlight++;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: request.messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? this.maxTokens,
        temperature: request.temperature ?? 0.7,
      });

      const choice = response.choices[0];
      const result: LLMResponse = {
        content: choice?.message?.content ?? '',
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
        },
      };

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      this.status = 'ready';
      this.pruneCache();
      return result;

    } catch (err: any) {
      this.status = 'degraded';
      const serverDelay = Number(err.headers?.['retry-after']);
      this.retryAfter = Date.now() + Math.max(60000, Number.isFinite(serverDelay) ? serverDelay * 1000 : 0);
      console.warn('[LLM] Request failed; using local behavior for at least 60 seconds.');
      // Fallback
      return {
        content: '',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    } finally {
      this.inFlight--;
    }
  }

  async batchComplete(requests: LLMRequest[], maxConcurrency: number): Promise<LLMResponse[]> {
    const results: LLMResponse[] = [];
    const executing = new Set<Promise<void>>();

    for (const req of requests) {
      const p = this.complete(req).then(r => { results.push(r); });
      const wrapped = p.then(() => { executing.delete(wrapped); });
      executing.add(wrapped);

      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minCallIntervalMs) {
      await new Promise(r => setTimeout(r, this.minCallIntervalMs - elapsed));
    }
    this.lastCallTime = Date.now();
  }

  private generateCacheKey(request: LLMRequest): string {
    return JSON.stringify(request);
  }

  private pruneCache(): void {
    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (now - entry.timestamp > this.cacheTtlMs * 2) {
          this.cache.delete(key);
        }
      }
    }
  }
}
