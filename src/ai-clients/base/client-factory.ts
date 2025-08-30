/**
 * 🏭 AI客户端工厂
 * 根据配置自动创建合适的AI客户端实例
 */

import { UnifiedAIClient } from './unified-client.interface';
import { UnifiedAIConfig, AIProvider } from './unified-types';
import { OpenAIAdapter } from '../openai/openai-adapter';
import { AnthropicAdapter } from '../anthropic/anthropic-adapter';
import { ConfigManager } from '../../config-manager';

/**
 * AI客户端工厂类
 */
export class AIClientFactory {
  private static registeredAdapters = new Map<
    AIProvider,
    new (config: UnifiedAIConfig) => UnifiedAIClient
  >();

  // 静态初始化：注册内置适配器
  static {
    this.registerAdapter('openai', OpenAIAdapter);
    this.registerAdapter('anthropic', AnthropicAdapter);
  }

  /**
   * 注册AI客户端适配器
   * @param provider 提供商类型
   * @param adapterClass 适配器类
   */
  static registerAdapter(
    provider: AIProvider,
    adapterClass: new (config: UnifiedAIConfig) => UnifiedAIClient
  ): void {
    this.registeredAdapters.set(provider, adapterClass);
  }

  /**
   * 创建AI客户端实例
   * @param config AI配置
   * @returns AI客户端实例
   */
  static create(config: UnifiedAIConfig): UnifiedAIClient {
    const AdapterClass = this.registeredAdapters.get(config.provider);

    if (!AdapterClass) {
      throw new Error(`Unsupported AI provider: ${config.provider}`);
    }

    // 验证配置
    this.validateConfig(config);

    return new AdapterClass(config);
  }

  /**
   * 从环境变量创建AI客户端
   * @param provider 可选的提供商类型，如果不提供则从环境变量读取
   * @returns AI客户端实例
   */
  static createFromEnv(): UnifiedAIClient {
    const config = this.loadConfigFromEnv();
    return this.create(config);
  }

  /**
   * 从ConfigManager加载配置
   */
  private static loadConfigFromEnv(): UnifiedAIConfig {
    const configManager = ConfigManager.getInstance();
    return configManager.getAIConfig();
  }

  /**
   * 验证配置
   */
  private static validateConfig(config: UnifiedAIConfig): void {
    if (!config.provider) {
      throw new Error('Provider is required');
    }

    if (!config.apiKey) {
      throw new Error(`API key is required for ${config.provider}`);
    }

    if (!config.model) {
      throw new Error(`Model is required for ${config.provider}`);
    }

    // 验证温度范围
    if (
      config.temperature !== undefined &&
      (config.temperature < 0 || config.temperature > 2)
    ) {
      throw new Error('Temperature must be between 0 and 2');
    }

    // 验证最大令牌数
    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      throw new Error('Max tokens must be positive');
    }

    // 验证超时时间
    if (config.timeout !== undefined && config.timeout <= 0) {
      throw new Error('Timeout must be positive');
    }
  }

  /**
   * 获取已注册的提供商列表
   */
  static getRegisteredProviders(): AIProvider[] {
    return Array.from(this.registeredAdapters.keys());
  }

  /**
   * 检查提供商是否已注册
   */
  static isProviderRegistered(provider: AIProvider): boolean {
    return this.registeredAdapters.has(provider);
  }

  /**
   * 创建多个客户端实例（用于负载均衡）
   */
  static createMultiple(configs: UnifiedAIConfig[]): UnifiedAIClient[] {
    return configs.map(config => this.create(config));
  }

  /**
   * 创建带故障转移的客户端
   */
  static createWithFailover(
    primaryConfig: UnifiedAIConfig,
    fallbackConfigs: UnifiedAIConfig[]
  ): UnifiedAIClient[] {
    const clients = [this.create(primaryConfig)];
    clients.push(...fallbackConfigs.map(config => this.create(config)));
    return clients;
  }
}
