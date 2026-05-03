// LLM 请求/响应类型
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMRequest {
  messages: LLMMessage[];
  functions?: LLMFunction[];
  functionCall?: { name: string } | 'auto' | 'none';
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
}
