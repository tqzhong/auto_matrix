import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface ServerConfig {
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens: number;
    maxRequestsPerMinute: number;
    maxTokensPerMinute: number;
  };
  server: {
    port: number;
    host: string;
  };
  simulation: {
    tickRateMs: number;
    agentDecisionIntervalTicks: number;
    reflectionIntervalTicks: number;
    stateSyncIntervalTicks: number;
  };
  database: {
    path: string;
  };
}

export const config: ServerConfig = {
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? '1024', 10),
    maxRequestsPerMinute: parseInt(process.env.LLM_MAX_RPM ?? '60', 10),
    maxTokensPerMinute: parseInt(process.env.LLM_MAX_TPM ?? '100000', 10),
  },
  server: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    host: process.env.HOST ?? '0.0.0.0',
  },
  simulation: {
    tickRateMs: parseInt(process.env.TICK_RATE_MS ?? '1000', 10),
    agentDecisionIntervalTicks: parseInt(process.env.AGENT_DECISION_INTERVAL ?? '5', 10),
    reflectionIntervalTicks: parseInt(process.env.REFLECTION_INTERVAL ?? '300', 10),
    stateSyncIntervalTicks: parseInt(process.env.STATE_SYNC_INTERVAL ?? '3', 10),
  },
  database: {
    path: process.env.DATABASE_PATH ?? path.resolve(__dirname, '../../data/auto_matrix.db'),
  },
};
