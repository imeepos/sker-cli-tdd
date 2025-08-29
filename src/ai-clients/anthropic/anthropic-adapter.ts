/**
 * 🧠 Anthropic Claude API适配器
 * 将Anthropic API适配为统一接口
 */

import { BaseAIClientAdapter } from '../base/unified-client.interface.js';
import {
  UnifiedMessage,
  UnifiedResponse,
  UnifiedChunk,
  UnifiedTool,
  UnifiedChatCompletionParams,
  UnifiedAIConfig,
  AIProvider
} from '../base/unified-types.js';

/**
 * Anthropic客户端适配器
 */
export class AnthropicAdapter extends BaseAIClientAdapter {
  readonly provider: AIProvider = 'anthropic';
  readonly config: UnifiedAIConfig;
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(config: UnifiedAIConfig) {
    super();
    this.config = config;
    
    // 设置API基础URL和请求头
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
    this.headers = {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  /**
   * 标准聊天完成
   */
  async chatCompletion(params: UnifiedChatCompletionParams): Promise<UnifiedResponse> {
    this.validateMessages(params.messages);

    try {
      const anthropicMessages = this.convertToAnthropicMessages(params.messages);
      const systemMessage = this.extractSystemMessage(params.messages);

      const requestBody = {
        model: params.model || this.config.model,
        max_tokens: params.maxTokens || this.config.maxTokens || 4096,
        temperature: params.temperature || this.config.temperature,
        messages: anthropicMessages,
        ...(systemMessage && { system: systemMessage }),
        ...(params.tools && { tools: this.convertToAnthropicTools(params.tools) }),
        stream: false,
      };

      const response = await this.makeRequest('/v1/messages', requestBody);
      return this.convertFromAnthropicResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 流式聊天完成
   */
  async* chatCompletionStream(params: UnifiedChatCompletionParams): AsyncIterable<UnifiedChunk> {
    this.validateMessages(params.messages);

    try {
      const anthropicMessages = this.convertToAnthropicMessages(params.messages);
      const systemMessage = this.extractSystemMessage(params.messages);

      const requestBody = {
        model: params.model || this.config.model,
        max_tokens: params.maxTokens || this.config.maxTokens || 4096,
        temperature: params.temperature || this.config.temperature,
        messages: anthropicMessages,
        ...(systemMessage && { system: systemMessage }),
        ...(params.tools && { tools: this.convertToAnthropicTools(params.tools) }),
        stream: true,
      };

      const stream = await this.makeStreamRequest('/v1/messages', requestBody);
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' || chunk.type === 'message_delta') {
          yield this.convertFromAnthropicChunk(chunk);
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 带工具调用的聊天完成
   */
  async chatCompletionWithTools(messages: UnifiedMessage[], tools: UnifiedTool[]): Promise<UnifiedResponse> {
    this.validateMessages(messages);
    this.validateTools(tools);

    return this.chatCompletion({
      messages,
      tools,
      toolChoice: 'auto',
    });
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): UnifiedTool[] {
    // Anthropic不提供预定义工具列表，返回空数组
    return [];
  }

  /**
   * 验证配置
   */
  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.model);
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/v1/messages', {
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取模型信息
   */
  async getModelInfo(): Promise<any> {
    return {
      id: this.config.model,
      name: this.config.model,
      description: `Anthropic ${this.config.model} model`,
      maxTokens: this.config.maxTokens,
      supportsFunctions: true,
      supportsStreaming: true,
    };
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest(endpoint: string, body: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Anthropic API Error ${response.status}: ${(error as Error).message || (error as any).error?.message}`);
    }

    return response.json();
  }

  /**
   * 发送流式HTTP请求
   */
  private async* makeStreamRequest(endpoint: string, body: any): AsyncIterable<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Anthropic API Error ${response.status}: ${error.message || error.error?.message}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              yield JSON.parse(data);
            } catch {
              // 忽略解析错误的行
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 转换为Anthropic消息格式
   */
  private convertToAnthropicMessages(messages: UnifiedMessage[]): any[] {
    return messages
      .filter(msg => msg.role !== 'system') // system消息单独处理
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
  }

  /**
   * 提取系统消息
   */
  private extractSystemMessage(messages: UnifiedMessage[]): string | undefined {
    const systemMessage = messages.find(msg => msg.role === 'system');
    return systemMessage?.content;
  }

  /**
   * 转换为Anthropic工具格式
   */
  private convertToAnthropicTools(tools: UnifiedTool[]): any[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
  }

  /**
   * 转换Anthropic响应为统一格式
   */
  private convertFromAnthropicResponse(response: any): UnifiedResponse {
    return {
      id: response.id || this.generateId(),
      object: 'chat.completion',
      created: this.getCurrentTimestamp(),
      model: response.model || this.config.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: this.extractContentFromAnthropicResponse(response),
        },
        finishReason: this.mapAnthropicStopReason(response.stop_reason),
      }],
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens || 0,
        completionTokens: response.usage.output_tokens || 0,
        totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
      } : undefined,
    };
  }

  /**
   * 转换Anthropic流式块为统一格式
   */
  private convertFromAnthropicChunk(chunk: any): UnifiedChunk {
    return {
      id: chunk.id || this.generateId(),
      object: 'chat.completion.chunk',
      created: this.getCurrentTimestamp(),
      model: this.config.model,
      choices: [{
        index: 0,
        delta: {
          role: 'assistant',
          content: chunk.delta?.text || '',
        },
        finishReason: chunk.type === 'message_stop' ? 'stop' : null,
      }],
    };
  }

  /**
   * 从Anthropic响应中提取内容
   */
  private extractContentFromAnthropicResponse(response: any): string {
    if (response.content && Array.isArray(response.content)) {
      return response.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('');
    }
    return response.content || '';
  }

  /**
   * 映射Anthropic停止原因
   */
  private mapAnthropicStopReason(stopReason: string): any {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}
