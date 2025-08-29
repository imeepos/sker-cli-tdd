/**
 * 🔄 统一AI客户端类型定义
 * 为OpenAI和Anthropic提供统一的接口抽象
 */

/**
 * 统一的消息角色类型
 */
export type UnifiedRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 统一的消息格式
 */
export interface UnifiedMessage {
  role: UnifiedRole;
  content: string;
  toolCalls?: UnifiedToolCall[];
  toolCallId?: string;
}

/**
 * 统一的工具调用格式
 */
export interface UnifiedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 统一的工具定义格式
 */
export interface UnifiedTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * 统一的聊天完成响应
 */
export interface UnifiedResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: UnifiedChoice[];
  usage?: UnifiedUsage;
}

/**
 * 统一的选择项
 */
export interface UnifiedChoice {
  index: number;
  message: UnifiedMessage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

/**
 * 统一的使用统计
 */
export interface UnifiedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 统一的流式响应块
 */
export interface UnifiedChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: UnifiedStreamChoice[];
}

/**
 * 统一的流式选择项
 */
export interface UnifiedStreamChoice {
  index: number;
  delta: UnifiedMessage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

/**
 * 统一的AI配置接口
 */
export interface UnifiedAIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

/**
 * 统一的聊天完成参数
 */
export interface UnifiedChatCompletionParams {
  messages: UnifiedMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: UnifiedTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stream?: boolean;
}

/**
 * AI提供商类型
 */
export type AIProvider = 'openai' | 'anthropic';

/**
 * 错误类型定义
 */
export interface UnifiedError extends Error {
  code?: string;
  type?: string;
  status?: number;
}
