/**
 * 🔄 统一AI客户端接口
 * 定义所有AI提供商必须实现的统一接口
 */

import {
  UnifiedMessage,
  UnifiedResponse,
  UnifiedChunk,
  UnifiedTool,
  UnifiedChatCompletionParams,
  UnifiedAIConfig,
  AIProvider
} from './unified-types.js';

/**
 * 统一AI客户端接口
 * 所有AI提供商适配器都必须实现此接口
 */
export interface UnifiedAIClient {
  /**
   * 获取提供商类型
   */
  readonly provider: AIProvider;

  /**
   * 获取配置信息
   */
  readonly config: UnifiedAIConfig;

  /**
   * 标准聊天完成
   * @param params 聊天参数
   * @returns 聊天响应
   */
  chatCompletion(params: UnifiedChatCompletionParams): Promise<UnifiedResponse>;

  /**
   * 流式聊天完成
   * @param params 聊天参数
   * @returns 流式响应迭代器
   */
  chatCompletionStream(params: UnifiedChatCompletionParams): AsyncIterable<UnifiedChunk>;

  /**
   * 带工具调用的聊天完成
   * @param messages 消息列表
   * @param tools 可用工具列表
   * @returns 聊天响应
   */
  chatCompletionWithTools(
    messages: UnifiedMessage[],
    tools: UnifiedTool[]
  ): Promise<UnifiedResponse>;

  /**
   * 获取可用的工具列表
   * @returns 工具列表
   */
  getAvailableTools(): UnifiedTool[];

  /**
   * 验证配置是否有效
   * @returns 是否有效
   */
  validateConfig(): boolean;

  /**
   * 测试连接
   * @returns 连接是否成功
   */
  testConnection(): Promise<boolean>;

  /**
   * 获取模型信息
   * @returns 模型信息
   */
  getModelInfo(): Promise<{
    id: string;
    name: string;
    description?: string;
    maxTokens?: number;
    supportsFunctions?: boolean;
    supportsStreaming?: boolean;
  }>;
}

/**
 * AI客户端适配器基类
 * 提供通用的实现和工具方法
 */
export abstract class BaseAIClientAdapter implements UnifiedAIClient {
  abstract readonly provider: AIProvider;
  abstract readonly config: UnifiedAIConfig;

  abstract chatCompletion(params: UnifiedChatCompletionParams): Promise<UnifiedResponse>;
  abstract chatCompletionStream(params: UnifiedChatCompletionParams): AsyncIterable<UnifiedChunk>;
  abstract chatCompletionWithTools(messages: UnifiedMessage[], tools: UnifiedTool[]): Promise<UnifiedResponse>;
  abstract getAvailableTools(): UnifiedTool[];
  abstract validateConfig(): boolean;
  abstract testConnection(): Promise<boolean>;
  abstract getModelInfo(): Promise<any>;

  /**
   * 生成唯一ID
   */
  protected generateId(): string {
    return `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取当前时间戳
   */
  protected getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * 验证消息格式
   */
  protected validateMessages(messages: UnifiedMessage[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }

    for (const message of messages) {
      if (!message.role || !message.content) {
        throw new Error('Each message must have role and content');
      }
    }
  }

  /**
   * 验证工具格式
   */
  protected validateTools(tools: UnifiedTool[]): void {
    if (!Array.isArray(tools)) {
      throw new Error('Tools must be an array');
    }

    for (const tool of tools) {
      if (!tool.function?.name || !tool.function?.description) {
        throw new Error('Each tool must have function name and description');
      }
    }
  }

  /**
   * 处理API错误
   */
  protected handleError(error: any): never {
    if (error.response) {
      // HTTP错误
      throw new Error(`API Error ${error.response.status}: ${error.response.data?.message || error.message}`);
    } else if (error.request) {
      // 网络错误
      throw new Error(`Network Error: ${error.message}`);
    } else {
      // 其他错误
      throw new Error(`Client Error: ${error.message}`);
    }
  }
}
