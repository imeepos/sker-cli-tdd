/**
 * 🟢 TDD 绿阶段：MCP OpenAI 集成功能实现
 * 与 OpenAI API 集成，支持工具调用和提示词
 */

import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';
import { MCPServer } from './mcp-server';

// 加载环境变量
dotenv.config({ debug: false, quiet: true });

/**
 * OpenAI 客户端配置接口
 */
export interface MCPOpenAIConfig {
  /** OpenAI API 密钥 */
  apiKey: string;
  /** 使用的模型名称 */
  model: string;
  /** API 基础 URL */
  baseURL?: string;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * OpenAI 工具调用格式
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * OpenAI 工具调用结果
 */
export interface OpenAIToolCallResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

/**
 * MCP OpenAI 客户端
 * 将 MCP 服务器与 OpenAI API 集成
 */
export class MCPOpenAIClient {
  private openai: OpenAI;
  private config: MCPOpenAIConfig;
  private mcpServer: MCPServer;

  constructor(config: MCPOpenAIConfig, mcpServer: MCPServer) {
    this.config = config;
    this.mcpServer = mcpServer;

    // 初始化 OpenAI 客户端
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 30000
    });
  }

  /**
   * 从环境变量加载配置
   */
  static loadConfigFromEnv(): MCPOpenAIConfig {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 环境变量未设置');
    }

    const config: MCPOpenAIConfig = {
      apiKey,
      model: process.env['OPENAI_MODEL'] || 'gpt-4'
    };

    if (process.env['OPENAI_BASE_URL']) {
      config.baseURL = process.env['OPENAI_BASE_URL'];
    }
    if (process.env['OPENAI_MAX_TOKENS']) {
      config.maxTokens = parseInt(process.env['OPENAI_MAX_TOKENS']);
    }
    if (process.env['OPENAI_TEMPERATURE']) {
      config.temperature = parseFloat(process.env['OPENAI_TEMPERATURE']);
    }

    return config;
  }

  /**
   * 获取配置信息
   */
  getConfig(): MCPOpenAIConfig {
    return { ...this.config };
  }

  /**
   * 设置 MCP 服务器
   */
  setMCPServer(server: MCPServer): void {
    this.mcpServer = server;
  }

  /**
   * 获取 MCP 服务器
   */
  getMCPServer(): MCPServer {
    return this.mcpServer;
  }

  /**
   * 将 MCP 工具转换为 OpenAI 函数格式
   */
  getOpenAITools(): OpenAITool[] {
    const mcpTools = this.mcpServer.getTools();
    return mcpTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema || {}
      }
    }));
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): Promise<OpenAIToolCallResult> {
    try {
      if (toolCall.type !== 'function') {
        throw new Error(`不支持的工具调用类型: ${toolCall.type}`);
      }

      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      const result = await this.mcpServer.executeTool(functionName, functionArgs);

      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify(result)
      };
    } catch (error) {
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify({
          error: error instanceof Error ? error.message : '工具执行失败'
        })
      };
    }
  }

  /**
   * 聊天完成
   */
  async chatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const params: any = {
      model: this.config.model,
      messages,
      stream: false,
      ...options
    };

    if (this.config.maxTokens !== undefined) {
      params.max_tokens = this.config.maxTokens;
    }
    if (this.config.temperature !== undefined) {
      params.temperature = this.config.temperature;
    }

    return await this.openai.chat.completions.create(params) as OpenAI.Chat.Completions.ChatCompletion;
  }

  /**
   * 带工具调用的聊天完成
   */
  async chatCompletionWithTools(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const tools = this.getOpenAITools();

    const params: any = {
      model: this.config.model,
      messages,
      stream: false,
      ...options
    };

    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = 'auto';
    }
    if (this.config.maxTokens !== undefined) {
      params.max_tokens = this.config.maxTokens;
    }
    if (this.config.temperature !== undefined) {
      params.temperature = this.config.temperature;
    }

    return await this.openai.chat.completions.create(params) as OpenAI.Chat.Completions.ChatCompletion;
  }

  /**
   * 使用提示词进行聊天完成
   */
  async chatCompletionWithPrompt(
    promptName: string,
    promptArgs: Record<string, any>,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const promptManager = this.mcpServer.getPromptManager();
    if (!promptManager) {
      throw new Error('Prompt 管理器未设置');
    }

    const renderedPrompt = await promptManager.renderPrompt(promptName, promptArgs);

    // 将渲染后的提示词添加到消息开头
    const systemMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: 'system',
      content: renderedPrompt
    };

    const allMessages = [systemMessage, ...messages];

    return await this.chatCompletionWithTools(allMessages, options);
  }

  /**
   * 流式聊天完成
   */
  async chatCompletionStream(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    const params: any = {
      model: this.config.model,
      messages,
      stream: true,
      ...options
    };

    if (this.config.maxTokens !== undefined) {
      params.max_tokens = this.config.maxTokens;
    }
    if (this.config.temperature !== undefined) {
      params.temperature = this.config.temperature;
    }

    return await this.openai.chat.completions.create(params) as any;
  }

  /**
   * 完整的对话处理（包含工具调用）
   */
  async processConversation(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    maxIterations: number = 5
  ): Promise<{
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    finalResponse: OpenAI.Chat.Completions.ChatCompletion;
    toolCallsExecuted: number;
  }> {
    const conversationMessages = [...messages];
    let toolCallsExecuted = 0;
    let finalResponse: OpenAI.Chat.Completions.ChatCompletion;

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.chatCompletionWithTools(conversationMessages);
      finalResponse = response;

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) break;

      conversationMessages.push(assistantMessage);

      // 检查是否有工具调用
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 执行所有工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          const toolResult = await this.executeToolCall(toolCall);
          conversationMessages.push(toolResult);
          toolCallsExecuted++;
        }
      } else {
        // 没有工具调用，对话结束
        break;
      }
    }

    return {
      messages: conversationMessages,
      finalResponse: finalResponse!,
      toolCallsExecuted
    };
  }
}
