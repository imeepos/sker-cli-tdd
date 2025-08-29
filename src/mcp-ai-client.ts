/**
 * 🔄 统一MCP AI客户端
 * 替换原有的MCPOpenAIClient，支持多种AI提供商
 */

import { MCPServer } from './mcp-server';
import { UnifiedAIClient } from './ai-clients/base/unified-client.interface';
import { AIClientFactory } from './ai-clients/base/client-factory';
import {
  UnifiedAIConfig,
  UnifiedMessage,
  UnifiedResponse,
  UnifiedChunk,
  AIProvider
} from './ai-clients/base/unified-types';

/**
 * MCP AI客户端配置接口
 * 兼容原有的MCPOpenAIConfig
 */
export interface MCPAIConfig extends UnifiedAIConfig {
  // 保持向后兼容
}

/**
 * 统一的MCP AI客户端
 * 支持OpenAI、Anthropic等多种AI提供商
 */
export class MCPAIClient {
  private aiClient: UnifiedAIClient;
  private mcpServer: MCPServer;
  private config: MCPAIConfig;

  constructor(config: MCPAIConfig, mcpServer: MCPServer) {
    this.config = config;
    this.mcpServer = mcpServer;
    
    // 使用工厂创建AI客户端
    this.aiClient = AIClientFactory.create(config);
  }

  /**
   * 获取AI提供商类型
   */
  get provider(): AIProvider {
    return this.aiClient.provider;
  }

  /**
   * 获取配置信息
   */
  get configuration(): MCPAIConfig {
    return this.config;
  }

  /**
   * 获取AI客户端实例
   */
  get client(): UnifiedAIClient {
    return this.aiClient;
  }

  /**
   * 标准聊天完成
   */
  async chatCompletion(messages: UnifiedMessage[]): Promise<UnifiedResponse> {
    return this.aiClient.chatCompletion({
      messages,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });
  }

  /**
   * 流式聊天完成
   */
  async* chatCompletionStream(messages: UnifiedMessage[]): AsyncIterable<UnifiedChunk> {
    const stream = this.aiClient.chatCompletionStream({
      messages,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * 带工具调用的聊天完成
   */
  async chatCompletionWithTools(messages: UnifiedMessage[]): Promise<UnifiedResponse> {
    const tools = this.mcpServer.getTools().map((tool: any) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema || {},
      },
    }));

    return this.aiClient.chatCompletionWithTools(messages, tools);
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(toolName: string, parameters: Record<string, unknown>): Promise<any> {
    return this.mcpServer.executeTool(toolName, parameters);
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    return this.mcpServer.getTools();
  }

  /**
   * 验证配置
   */
  validateConfig(): boolean {
    return this.aiClient.validateConfig();
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    return this.aiClient.testConnection();
  }

  /**
   * 获取模型信息
   */
  async getModelInfo() {
    return this.aiClient.getModelInfo();
  }

  /**
   * 切换AI提供商
   * @param newConfig 新的配置
   */
  switchProvider(newConfig: MCPAIConfig): void {
    this.config = newConfig;
    this.aiClient = AIClientFactory.create(newConfig);
  }

  /**
   * 创建带故障转移的客户端
   */
  static createWithFailover(
    primaryConfig: MCPAIConfig,
    fallbackConfigs: MCPAIConfig[],
    mcpServer: MCPServer
  ): MCPAIClientWithFailover {
    return new MCPAIClientWithFailover(primaryConfig, fallbackConfigs, mcpServer);
  }

  /**
   * 从环境变量创建客户端
   */
  static createFromEnv(mcpServer: MCPServer, provider?: AIProvider): MCPAIClient {
    const aiClient = AIClientFactory.createFromEnv(provider);
    return new MCPAIClient(aiClient.config as MCPAIConfig, mcpServer);
  }
}

/**
 * 带故障转移功能的MCP AI客户端
 */
export class MCPAIClientWithFailover extends MCPAIClient {
  private fallbackClients: MCPAIClient[];
  private currentClientIndex: number = 0;

  constructor(
    primaryConfig: MCPAIConfig,
    fallbackConfigs: MCPAIConfig[],
    mcpServer: MCPServer
  ) {
    super(primaryConfig, mcpServer);
    
    // 创建故障转移客户端
    this.fallbackClients = [
      this,
      ...fallbackConfigs.map(config => new MCPAIClient(config, mcpServer))
    ];
  }

  /**
   * 带故障转移的聊天完成
   */
  override async chatCompletion(messages: UnifiedMessage[]): Promise<UnifiedResponse> {
    return this.executeWithFailover(client => client.chatCompletion(messages));
  }

  /**
   * 带故障转移的流式聊天完成
   */
  override async* chatCompletionStream(messages: UnifiedMessage[]): AsyncIterable<UnifiedChunk> {
    const currentClient = this.getCurrentClient();
    try {
      const stream = currentClient.chatCompletionStream(messages);
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      // 流式请求失败时切换到下一个客户端
      if (this.switchToNextClient()) {
        const fallbackStream = this.getCurrentClient().chatCompletionStream(messages);
        for await (const chunk of fallbackStream) {
          yield chunk;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * 带故障转移的工具调用聊天完成
   */
  override async chatCompletionWithTools(messages: UnifiedMessage[]): Promise<UnifiedResponse> {
    return this.executeWithFailover(client => client.chatCompletionWithTools(messages));
  }

  /**
   * 执行带故障转移的操作
   */
  private async executeWithFailover<T>(operation: (client: MCPAIClient) => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.fallbackClients.length; i++) {
      const client = this.fallbackClients[(this.currentClientIndex + i) % this.fallbackClients.length]!;
      
      try {
        const result = await operation(client);
        // 成功后更新当前客户端索引
        this.currentClientIndex = (this.currentClientIndex + i) % this.fallbackClients.length;
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`AI provider ${client.provider} failed, trying next...`, error);
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  /**
   * 获取当前客户端
   */
  private getCurrentClient(): MCPAIClient {
    return this.fallbackClients[this.currentClientIndex]!;
  }

  /**
   * 切换到下一个客户端
   */
  private switchToNextClient(): boolean {
    if (this.currentClientIndex < this.fallbackClients.length - 1) {
      this.currentClientIndex++;
      return true;
    }
    return false;
  }

  /**
   * 获取所有客户端状态
   */
  async getClientsStatus(): Promise<Array<{ provider: AIProvider; available: boolean }>> {
    const results = await Promise.allSettled(
      this.fallbackClients.map(client => client.testConnection())
    );

    return this.fallbackClients.map((client, index) => ({
      provider: client.provider,
      available: results[index]!.status === 'fulfilled' && (results[index] as PromiseFulfilledResult<boolean>).value,
    }));
  }
}

// 向后兼容的类型别名
export type MCPOpenAIClient = MCPAIClient;
export type MCPOpenAIConfig = MCPAIConfig;
