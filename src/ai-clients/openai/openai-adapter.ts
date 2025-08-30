/**
 * 🤖 OpenAI API适配器
 * 将OpenAI API适配为统一接口
 */

import OpenAI from 'openai';
import { BaseAIClientAdapter } from '../base/unified-client.interface';
import {
  UnifiedMessage,
  UnifiedResponse,
  UnifiedChunk,
  UnifiedTool,
  UnifiedChatCompletionParams,
  UnifiedAIConfig,
  AIProvider,
} from '../base/unified-types';

/**
 * OpenAI客户端适配器
 */
export class OpenAIAdapter extends BaseAIClientAdapter {
  readonly provider: AIProvider = 'openai';
  readonly config: UnifiedAIConfig;
  private client: OpenAI;

  constructor(config: UnifiedAIConfig) {
    super();
    this.config = config;

    // 初始化OpenAI客户端
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
    });
  }

  /**
   * 标准聊天完成
   */
  async chatCompletion(
    params: UnifiedChatCompletionParams
  ): Promise<UnifiedResponse> {
    this.validateMessages(params.messages);

    try {
      const response = await this.client.chat.completions.create({
        model: params.model || this.config.model,
        messages: this.convertToOpenAIMessages(params.messages),
        max_tokens: params.maxTokens || this.config.maxTokens,
        temperature: params.temperature || this.config.temperature,
        tools: params.tools
          ? this.convertToOpenAITools(params.tools)
          : undefined,
        tool_choice: params.toolChoice
          ? this.convertToOpenAIToolChoice(params.toolChoice)
          : undefined,
        stream: false,
      });

      return this.convertFromOpenAIResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 流式聊天完成
   */
  async *chatCompletionStream(
    params: UnifiedChatCompletionParams
  ): AsyncIterable<UnifiedChunk> {
    this.validateMessages(params.messages);

    try {
      const stream = await this.client.chat.completions.create({
        model: params.model || this.config.model,
        messages: this.convertToOpenAIMessages(params.messages),
        max_tokens: params.maxTokens || this.config.maxTokens,
        temperature: params.temperature || this.config.temperature,
        tools: params.tools
          ? this.convertToOpenAITools(params.tools)
          : undefined,
        tool_choice: params.toolChoice
          ? this.convertToOpenAIToolChoice(params.toolChoice)
          : undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        yield this.convertFromOpenAIChunk(chunk);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 带工具调用的聊天完成
   */
  async chatCompletionWithTools(
    messages: UnifiedMessage[],
    tools: UnifiedTool[]
  ): Promise<UnifiedResponse> {
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
    // OpenAI不提供预定义工具列表，返回空数组
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
      await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
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
    try {
      // OpenAI API不直接提供模型详情，返回基本信息
      return {
        id: this.config.model,
        name: this.config.model,
        description: `OpenAI ${this.config.model} model`,
        maxTokens: this.config.maxTokens,
        supportsFunctions: true,
        supportsStreaming: true,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 转换为OpenAI消息格式
   */
  private convertToOpenAIMessages(
    messages: UnifiedMessage[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId || '',
        };
      }

      const baseMessage: any = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.toolCalls) {
        baseMessage.tool_calls = msg.toolCalls.map(call => ({
          id: call.id,
          type: call.type,
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        }));
      }

      return baseMessage;
    });
  }

  /**
   * 转换为OpenAI工具格式
   */
  private convertToOpenAITools(
    tools: UnifiedTool[]
  ): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * 转换工具选择
   */
  private convertToOpenAIToolChoice(toolChoice: any): any {
    if (typeof toolChoice === 'string') {
      return toolChoice;
    }
    return {
      type: 'function',
      function: { name: toolChoice.function.name },
    };
  }

  /**
   * 转换OpenAI响应为统一格式
   */
  private convertFromOpenAIResponse(
    response: OpenAI.Chat.Completions.ChatCompletion
  ): UnifiedResponse {
    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      choices: response.choices.map(choice => ({
        index: choice.index,
        message: this.convertFromOpenAIMessage(choice.message),
        finishReason: choice.finish_reason as any,
      })),
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * 转换OpenAI流式块为统一格式
   */
  private convertFromOpenAIChunk(
    chunk: OpenAI.Chat.Completions.ChatCompletionChunk
  ): UnifiedChunk {
    return {
      id: chunk.id,
      object: chunk.object,
      created: chunk.created,
      model: chunk.model,
      choices: chunk.choices.map(choice => ({
        index: choice.index,
        delta: this.convertFromOpenAIMessage(choice.delta as any),
        finishReason: choice.finish_reason as any,
      })),
    };
  }

  /**
   * 转换OpenAI消息为统一格式
   */
  private convertFromOpenAIMessage(message: any): UnifiedMessage {
    const result: UnifiedMessage = {
      role: message.role || 'assistant',
      content: message.content || '',
    };

    if (message.tool_calls) {
      result.toolCalls = message.tool_calls.map((call: any) => ({
        id: call.id,
        type: call.type,
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      }));
    }

    return result;
  }
}
