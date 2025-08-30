/**
 * 🔄 TDD 重构阶段：统一配置管理器
 * 整合分散的配置逻辑，提供统一的配置验证和管理
 */

import { SkerError, ErrorFactory, ErrorCodes } from './sker-error';
import { DatabaseConfig } from './database-service';
import * as dotenv from 'dotenv';
import { UnifiedAIConfig } from './ai-clients/base/unified-types';

/**
 * OpenAI 配置接口
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  baseURL?: string;
}

/**
 * CLI 配置接口
 */
export interface CLIConfig extends OpenAIConfig {
  // CLI特定的配置可以在这里扩展
}

/**
 * MQ 配置接口
 */
export interface MQConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  taskQueue: string;
  resultQueue: string;
  agentId: string;
}

/**
 * 系统配置接口
 * 包含所有子系统的配置
 */
export interface SystemConfig {
  aiConfig: UnifiedAIConfig;
  database: DatabaseConfig;
  mq: MQConfig;
  cli: CLIConfig;
}

/**
 * 配置验证器接口
 */
interface ConfigValidator<T> {
  validate(config: T): void;
}

/**
 * OpenAI 配置验证器
 */
class OpenAIConfigValidator implements ConfigValidator<OpenAIConfig> {
  validate(config: OpenAIConfig): void {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw ErrorFactory.configError('apiKey', new Error('API密钥不能为空'));
    }

    if (!config.model || config.model.trim() === '') {
      throw ErrorFactory.configError('model', new Error('模型不能为空'));
    }

    if (
      config.temperature !== undefined &&
      (config.temperature < 0 || config.temperature > 2)
    ) {
      throw ErrorFactory.configError(
        'temperature',
        new Error('temperature必须在0-2之间')
      );
    }

    if (config.maxTokens !== undefined && config.maxTokens < 1) {
      throw ErrorFactory.configError(
        'maxTokens',
        new Error('maxTokens必须大于0')
      );
    }

    if (config.baseURL && !this.isValidURL(config.baseURL)) {
      throw ErrorFactory.configError('baseURL', new Error('baseURL格式无效'));
    }
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * MQ 配置验证器
 */
class MQConfigValidator implements ConfigValidator<MQConfig> {
  validate(config: MQConfig): void {
    if (!config.host || config.host.trim() === '') {
      throw ErrorFactory.configError('host', new Error('MQ主机地址不能为空'));
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      throw ErrorFactory.configError(
        'port',
        new Error('端口必须在1-65535之间')
      );
    }

    if (!config.agentId || config.agentId.trim() === '') {
      throw ErrorFactory.configError('agentId', new Error('Agent ID不能为空'));
    }

    if (!config.taskQueue || config.taskQueue.trim() === '') {
      throw ErrorFactory.configError(
        'taskQueue',
        new Error('任务队列名不能为空')
      );
    }

    if (!config.resultQueue || config.resultQueue.trim() === '') {
      throw ErrorFactory.configError(
        'resultQueue',
        new Error('结果队列名不能为空')
      );
    }
  }
}

/**
 * 统一配置管理器
 * 提供集中式的配置加载、验证和管理功能
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Partial<SystemConfig> = {};
  private validators: Map<string, ConfigValidator<any>> = new Map();

  private constructor() {
    // 注册验证器
    this.validators.set('aiConfig', new OpenAIConfigValidator());
    this.validators.set('mq', new MQConfigValidator());
    // 加载环境变量
    this.loadEnvironmentVariables();
  }

  /**
   * 获取配置管理器单例
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 重置单例（主要用于测试）
   */
  static reset(): void {
    ConfigManager.instance = new ConfigManager();
  }

  /**
   * 加载环境变量
   * 支持从.env文件和系统环境变量加载
   */
  private loadEnvironmentVariables(): void {
    // 在测试环境中跳过.env文件加载，避免干扰测试
    if (process.env['NODE_ENV'] === 'test') {
      return;
    }

    try {
      dotenv.config({ debug: false, quiet: true });
    } catch (error) {
      // 忽略dotenv错误，继续使用系统环境变量
    }
  }

  /**
   * 获取 OpenAI 配置
   * 从环境变量加载并验证配置
   */
  getAIConfig(): UnifiedAIConfig {
    if (!this.config.aiConfig) {
      this.config.aiConfig = this.loadAIConfigFromEnv();
      this.validateConfig('aiConfig', this.config.aiConfig!);
    }
    return this.config.aiConfig!;
  }

  /**
   * 获取 MQ 配置
   * 从环境变量加载并验证配置
   */
  getMQConfig(): MQConfig {
    if (!this.config.mq) {
      this.config.mq = this.loadMQConfigFromEnv();
      this.validateConfig('mq', this.config.mq);
    }
    return this.config.mq;
  }

  /**
   * 获取数据库配置
   * 提供默认配置，支持环境变量覆盖
   */
  getDatabaseConfig(): DatabaseConfig {
    if (!this.config.database) {
      this.config.database = {
        dbPath: process.env['DATABASE_PATH'] || './data/sker.db',
      };
    }
    return this.config.database;
  }

  /**
   * 获取 CLI 配置
   * 基于 OpenAI 配置，支持 CLI 特定的扩展
   */
  getCLIConfig(): CLIConfig {
    if (!this.config.cli) {
      const openaiConfig = this.getAIConfig();
      this.config.cli = {
        ...openaiConfig,
        // 这里可以添加CLI特定的配置项
      };
    }
    return this.config.cli;
  }

  /**
   * 获取完整的系统配置
   */
  getSystemConfig(): SystemConfig {
    return {
      aiConfig: this.getAIConfig(),
      database: this.getDatabaseConfig(),
      mq: this.getMQConfig(),
      cli: this.getCLIConfig(),
    };
  }

  /**
   * 设置配置项
   * 允许程序动态修改配置
   */
  setConfig<K extends keyof SystemConfig>(
    key: K,
    config: SystemConfig[K]
  ): void {
    this.validateConfig(key, config);
    this.config[key] = config;
  }

  /**
   * 合并配置
   * 用于从命令行参数或其他源合并配置
   */
  mergeConfig<K extends keyof SystemConfig>(
    key: K,
    partialConfig: Partial<SystemConfig[K]>
  ): void {
    const currentConfig = this.config[key] || ({} as SystemConfig[K]);
    const mergedConfig = { ...currentConfig, ...partialConfig };
    this.setConfig(key, mergedConfig);
  }

  /**
   * 验证配置
   * 使用对应的验证器验证配置格式和内容
   */
  private validateConfig<K extends keyof SystemConfig>(
    key: K,
    config: SystemConfig[K]
  ): void {
    const validator = this.validators.get(key as string);
    if (validator) {
      try {
        validator.validate(config);
      } catch (error) {
        if (error instanceof SkerError) {
          throw error;
        }
        throw ErrorFactory.configError(key as string, error as Error);
      }
    }
  }

  /**
   * 从环境变量加载 OpenAI 配置
   */
  private loadAIConfigFromEnv(): UnifiedAIConfig {
    const apiKey = process.env['AI_API_KEY'];
    if (!apiKey) {
      throw new SkerError(
        ErrorCodes.CONFIG_MISSING,
        'AI_API_KEY 环境变量未设置',
        { context: { operation: 'load_AI_config' } }
      );
    }

    return {
      provider: (process.env['AI_PROVIDER'] as any) || 'openai',
      apiKey,
      model: process.env['AI_MODEL'] || 'gpt-4',
      maxTokens: process.env['AI_MAX_TOKENS']
        ? parseInt(process.env['AI_MAX_TOKENS'])
        : 2000,
      temperature: process.env['AI_TEMPERATURE']
        ? parseFloat(process.env['AI_TEMPERATURE'])
        : 0.7,
      baseURL: process.env['AI_BASE_URL'],
    };
  }

  /**
   * 从环境变量加载 MQ 配置
   */
  private loadMQConfigFromEnv(): MQConfig {
    const host = process.env['MQ_HOST'] || 'localhost';
    const port = parseInt(process.env['MQ_PORT'] || '5672');
    const username = process.env['MQ_USERNAME'] || 'guest';
    const password = process.env['MQ_PASSWORD'] || 'guest';
    const agentId = process.env['AGENT_ID'] || `agent-${Date.now()}`;

    return {
      url:
        process.env['MQ_URL'] ||
        `amqp://${username}:${password}@${host}:${port}`,
      host,
      port,
      username,
      password,
      taskQueue: process.env['MQ_TASK_QUEUE'] || `tasks-${agentId}`,
      resultQueue: process.env['MQ_RESULT_QUEUE'] || `results-${agentId}`,
      agentId,
    };
  }

  /**
   * 检查必需的环境变量
   * 用于启动时的健康检查
   */
  checkRequiredEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.getAIConfig();
    } catch (error) {
      if (error instanceof SkerError) {
        errors.push(`OpenAI配置错误: ${error.getUserMessage()}`);
      } else {
        errors.push(`OpenAI配置错误: ${(error as Error).message}`);
      }
    }

    try {
      this.getMQConfig();
    } catch (error) {
      if (error instanceof SkerError) {
        errors.push(`MQ配置错误: ${error.getUserMessage()}`);
      } else {
        errors.push(`MQ配置错误: ${(error as Error).message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取环境变量值
   * 提供统一的环境变量访问接口
   */
  getEnvVar(key: string, defaultValue?: string): string | undefined {
    return process.env[key] || defaultValue;
  }

  /**
   * 检查是否为测试环境
   */
  isTestEnvironment(): boolean {
    return process.env['NODE_ENV'] === 'test';
  }

  /**
   * 获取当前用户名
   */
  getCurrentUser(): string | undefined {
    return process.env['USER'] || process.env['USERNAME'];
  }

  /**
   * 获取Shell环境信息
   */
  getShellInfo(): { shell: string; comSpec: string } {
    return {
      shell: process.env['SHELL'] || 'unknown',
      comSpec: process.env['ComSpec'] || 'unknown',
    };
  }

  /**
   * 获取配置摘要
   * 用于日志记录和调试，不包含敏感信息
   */
  getConfigSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    if (this.config.aiConfig) {
      summary['aiConfig'] = {
        provider: this.config.aiConfig.provider,
        model: this.config.aiConfig.model,
        temperature: this.config.aiConfig.temperature,
        maxTokens: this.config.aiConfig.maxTokens,
        hasApiKey: !!this.config.aiConfig.apiKey,
        baseURL: this.config.aiConfig.baseURL,
      };
    }

    if (this.config.mq) {
      summary['mq'] = {
        host: this.config.mq.host,
        port: this.config.mq.port,
        agentId: this.config.mq.agentId,
        taskQueue: this.config.mq.taskQueue,
        resultQueue: this.config.mq.resultQueue,
      };
    }

    if (this.config.database) {
      summary['database'] = {
        dbPath: this.config.database.dbPath,
      };
    }

    return summary;
  }
}
