/**
 * 🧪 AI客户端工厂测试
 * 测试统一AI客户端工厂的功能
 */

import { AIClientFactory } from './base/client-factory.js';
import { UnifiedAIConfig } from './base/unified-types.js';

describe('AIClientFactory', () => {
  describe('创建客户端', () => {
    it('应该能够创建OpenAI客户端', () => {
      const config: UnifiedAIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      };

      const client = AIClientFactory.create(config);
      expect(client.provider).toBe('openai');
      expect(client.config.provider).toBe('openai');
      expect(client.config.model).toBe('gpt-3.5-turbo');
    });

    it('应该能够创建Anthropic客户端', () => {
      const config: UnifiedAIConfig = {
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-sonnet-20240229',
      };

      const client = AIClientFactory.create(config);
      expect(client.provider).toBe('anthropic');
      expect(client.config.provider).toBe('anthropic');
      expect(client.config.model).toBe('claude-3-sonnet-20240229');
    });

    it('应该在不支持的提供商时抛出错误', () => {
      const config = {
        provider: 'unsupported',
        apiKey: 'test-key',
        model: 'test-model',
      } as any;

      expect(() => AIClientFactory.create(config)).toThrow('Unsupported AI provider: unsupported');
    });
  });

  describe('配置验证', () => {
    it('应该验证必需的配置项', () => {
      const invalidConfig = {
        provider: 'openai',
        // 缺少 apiKey
        model: 'gpt-3.5-turbo',
      } as any;

      expect(() => AIClientFactory.create(invalidConfig)).toThrow('API key is required');
    });

    it('应该验证温度范围', () => {
      const invalidConfig: UnifiedAIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 3.0, // 超出范围
      };

      expect(() => AIClientFactory.create(invalidConfig)).toThrow('Temperature must be between 0 and 2');
    });

    it('应该验证最大令牌数', () => {
      const invalidConfig: UnifiedAIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        maxTokens: -100, // 负数
      };

      expect(() => AIClientFactory.create(invalidConfig)).toThrow('Max tokens must be positive');
    });
  });

  describe('环境变量支持', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该从环境变量检测OpenAI提供商', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.OPENAI_MODEL = 'gpt-4';
      
      const client = AIClientFactory.createFromEnv();
      expect(client.provider).toBe('openai');
      expect(client.config.model).toBe('gpt-4');
    });

    it('应该从环境变量检测Anthropic提供商', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.ANTHROPIC_MODEL = 'claude-3-sonnet-20240229';
      
      const client = AIClientFactory.createFromEnv();
      expect(client.provider).toBe('anthropic');
      expect(client.config.model).toBe('claude-3-sonnet-20240229');
    });

    it('应该优先使用AI_PROVIDER环境变量', () => {
      process.env.AI_PROVIDER = 'anthropic';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      
      const client = AIClientFactory.createFromEnv();
      expect(client.provider).toBe('anthropic');
    });

    it('应该在没有API密钥时抛出错误', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_PROVIDER;
      
      expect(() => AIClientFactory.createFromEnv()).toThrow('No AI provider detected');
    });
  });

  describe('工厂管理', () => {
    it('应该返回已注册的提供商列表', () => {
      const providers = AIClientFactory.getRegisteredProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
    });

    it('应该检查提供商是否已注册', () => {
      expect(AIClientFactory.isProviderRegistered('openai')).toBe(true);
      expect(AIClientFactory.isProviderRegistered('anthropic')).toBe(true);
      expect(AIClientFactory.isProviderRegistered('unsupported' as any)).toBe(false);
    });

    it('应该能够创建多个客户端实例', () => {
      const configs: UnifiedAIConfig[] = [
        {
          provider: 'openai',
          apiKey: 'test-openai-key',
          model: 'gpt-3.5-turbo',
        },
        {
          provider: 'anthropic',
          apiKey: 'test-anthropic-key',
          model: 'claude-3-sonnet-20240229',
        },
      ];

      const clients = AIClientFactory.createMultiple(configs);
      expect(clients).toHaveLength(2);
      expect(clients[0].provider).toBe('openai');
      expect(clients[1].provider).toBe('anthropic');
    });

    it('应该能够创建带故障转移的客户端', () => {
      const primaryConfig: UnifiedAIConfig = {
        provider: 'openai',
        apiKey: 'test-openai-key',
        model: 'gpt-4',
      };

      const fallbackConfigs: UnifiedAIConfig[] = [
        {
          provider: 'anthropic',
          apiKey: 'test-anthropic-key',
          model: 'claude-3-sonnet-20240229',
        },
      ];

      const clients = AIClientFactory.createWithFailover(primaryConfig, fallbackConfigs);
      expect(clients).toHaveLength(2);
      expect(clients[0].provider).toBe('openai');
      expect(clients[1].provider).toBe('anthropic');
    });
  });
});
