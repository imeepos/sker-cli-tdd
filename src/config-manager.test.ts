/**
 * 🔴 TDD 红阶段：ConfigManager 测试
 * 测试统一配置管理系统
 */

import { UnifiedAIConfig } from './ai-clients/base/unified-types';
import { ConfigManager } from './config-manager';
import { SkerError } from './sker-error';

describe('ConfigManager', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };
    
    // 清除所有相关环境变量以避免.env文件干扰
    delete process.env['AI_API_KEY'];
    delete process.env['AI_MODEL'];
    delete process.env['AI_TEMPERATURE'];
    delete process.env['AI_MAX_TOKENS'];
    delete process.env['AI_BASE_URL'];
    delete process.env['MQ_HOST'];
    delete process.env['MQ_PORT'];
    delete process.env['AGENT_ID'];
    
    // 重置ConfigManager单例
    ConfigManager.reset();

    // 设置测试环境
    process.env['NODE_ENV'] = 'test';
    
    // 设置测试环境变量
    process.env['AI_API_KEY'] = 'test-api-key';
    process.env['AI_MODEL'] = 'gpt-3.5-turbo';
    process.env['AI_TEMPERATURE'] = '0.5';
    process.env['AI_MAX_TOKENS'] = '1500';
    process.env['MQ_HOST'] = 'test-host';
    process.env['MQ_PORT'] = '5672';
    process.env['AGENT_ID'] = 'test-agent';
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('reset方法应该创建新实例', () => {
      const instance1 = ConfigManager.getInstance();
      ConfigManager.reset();
      const instance2 = ConfigManager.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('OpenAI配置管理', () => {
    it('应该从环境变量加载OpenAI配置', () => {
      const manager = ConfigManager.getInstance();
      const config = manager.getAIConfig();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 1500,
        baseURL: undefined
      });
    });

    it('应该使用默认值', () => {
      delete process.env['AI_MODEL'];
      delete process.env['AI_TEMPERATURE'];
      delete process.env['AI_MAX_TOKENS'];

      const manager = ConfigManager.getInstance();
      const config = manager.getAIConfig();

      expect(config.model).toBe('gpt-4');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(2000);
    });

    it('应该在缺少API密钥时抛出SkerError', () => {
      delete process.env['AI_API_KEY'];
      
      const manager = ConfigManager.getInstance();
      
      expect(() => manager.getAIConfig()).toThrow(SkerError);
      expect(() => manager.getAIConfig()).toThrow(/AI_API_KEY/);
    });

    it('应该验证temperature范围', () => {
      const manager = ConfigManager.getInstance();
      
      expect(() => {
        manager.setConfig('aiConfig', {
          provider: `openai`,
          apiKey: 'test-key',
          model: 'gpt-4',
          temperature: 3.0 // 超出范围
        });
      }).toThrow(SkerError);
    });

    it('应该验证maxTokens', () => {
      const manager = ConfigManager.getInstance();
      
      expect(() => {
        manager.setConfig('aiConfig', {
          provider: `anthropic`,
          apiKey: 'test-key',
          model: 'gpt-4',
          maxTokens: -1 // 无效值
        });
      }).toThrow(SkerError);
    });

    it('应该验证baseURL格式', () => {
      const manager = ConfigManager.getInstance();
      
      expect(() => {
        manager.setConfig('aiConfig', {
          provider: `openai`,
          apiKey: 'test-key',
          model: 'gpt-4',
          baseURL: 'invalid-url'
        });
      }).toThrow(SkerError);
    });
  });

  describe('MQ配置管理', () => {
    it('应该从环境变量加载MQ配置', () => {
      process.env['MQ_USERNAME'] = 'test-user';
      process.env['MQ_PASSWORD'] = 'test-pass';
      
      const manager = ConfigManager.getInstance();
      const config = manager.getMQConfig();

      expect(config).toMatchObject({
        host: 'test-host',
        port: 5672,
        username: 'test-user',
        password: 'test-pass',
        agentId: 'test-agent'
      });
      expect(config.url).toContain('amqp://test-user:test-pass@test-host:5672');
    });

    it('应该使用默认值', () => {
      delete process.env['MQ_HOST'];
      delete process.env['MQ_PORT'];
      delete process.env['MQ_USERNAME'];
      delete process.env['MQ_PASSWORD'];

      const manager = ConfigManager.getInstance();
      const config = manager.getMQConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5672);
      expect(config.username).toBe('guest');
      expect(config.password).toBe('guest');
    });

    it('应该生成唯一的Agent ID', async () => {
      delete process.env['AGENT_ID'];
      
      const manager1 = ConfigManager.getInstance();
      const config1 = manager1.getMQConfig();
      
      // 添加小延迟确保不同的时间戳
      await new Promise(resolve => setTimeout(resolve, 5));
      
      ConfigManager.reset();
      delete process.env['AGENT_ID']; // 确保重置后还是没有AGENT_ID
      
      const manager2 = ConfigManager.getInstance();
      const config2 = manager2.getMQConfig();

      expect(config1.agentId).not.toBe(config2.agentId);
      expect(config1.agentId).toMatch(/^agent-\d+$/);
      expect(config2.agentId).toMatch(/^agent-\d+$/);
    });

    it('应该验证必需的配置项', () => {
      const manager = ConfigManager.getInstance();
      
      expect(() => {
        manager.setConfig('mq', {
          url: 'amqp://localhost',
          host: '', // 空值应该被拒绝
          port: 5672,
          username: 'user',
          password: 'pass',
          taskQueue: 'tasks',
          resultQueue: 'results',
          agentId: 'agent-1'
        });
      }).toThrow(SkerError);
    });

    it('应该验证端口范围', () => {
      const manager = ConfigManager.getInstance();
      
      expect(() => {
        manager.setConfig('mq', {
          url: 'amqp://localhost',
          host: 'localhost',
          port: 70000, // 超出范围
          username: 'user',
          password: 'pass',
          taskQueue: 'tasks',
          resultQueue: 'results',
          agentId: 'agent-1'
        });
      }).toThrow(SkerError);
    });
  });

  describe('数据库配置管理', () => {
    it('应该返回默认数据库配置', () => {
      const manager = ConfigManager.getInstance();
      const config = manager.getDatabaseConfig();

      expect(config.dbPath).toBe('./data/sker.db');
    });

    it('应该支持环境变量覆盖', () => {
      process.env['DATABASE_PATH'] = '/custom/path/db.sqlite';
      
      const manager = ConfigManager.getInstance();
      const config = manager.getDatabaseConfig();

      expect(config.dbPath).toBe('/custom/path/db.sqlite');
    });
  });

  describe('CLI配置管理', () => {
    it('应该基于OpenAI配置创建CLI配置', () => {
      const manager = ConfigManager.getInstance();
      const cliConfig = manager.getCLIConfig();
      const openaiConfig = manager.getAIConfig();

      expect(cliConfig).toMatchObject(openaiConfig);
    });
  });

  describe('配置合并和覆盖', () => {
    it('应该支持配置合并', () => {
      const manager = ConfigManager.getInstance();
      
      // 先获取原始配置
      const originalConfig = manager.getAIConfig();
      
      // 合并部分配置
      manager.mergeConfig('aiConfig', { 
        temperature: 0.9,
        maxTokens: 3000 
      });
      
      const mergedConfig = manager.getAIConfig();
      
      expect(mergedConfig.apiKey).toBe(originalConfig.apiKey);
      expect(mergedConfig.model).toBe(originalConfig.model);
      expect(mergedConfig.temperature).toBe(0.9);
      expect(mergedConfig.maxTokens).toBe(3000);
    });

    it('应该支持完整配置替换', () => {
      const manager = ConfigManager.getInstance();
      
      const newConfig: UnifiedAIConfig = {
        provider: `openai`,
        apiKey: 'new-key',
        model: 'gpt-4-turbo',
        temperature: 0.1,
        maxTokens: 4000
      };
      
      manager.setConfig('aiConfig', newConfig);
      const config = manager.getAIConfig();
      
      expect(config).toEqual(newConfig);
    });
  });

  describe('系统配置', () => {
    it('应该返回完整的系统配置', () => {
      const manager = ConfigManager.getInstance();
      const systemConfig = manager.getSystemConfig();

      expect(systemConfig).toHaveProperty('openai');
      expect(systemConfig).toHaveProperty('database');
      expect(systemConfig).toHaveProperty('mq');
      expect(systemConfig).toHaveProperty('cli');
    });
  });

  describe('环境检查', () => {
    it('应该通过有效环境的检查', () => {
      const manager = ConfigManager.getInstance();
      const check = manager.checkRequiredEnvironment();

      expect(check.valid).toBe(true);
      expect(check.errors).toHaveLength(0);
    });

    it('应该检测无效的环境配置', () => {
      delete process.env['AI_API_KEY'];
      
      const manager = ConfigManager.getInstance();
      const check = manager.checkRequiredEnvironment();

      expect(check.valid).toBe(false);
      expect(check.errors.length).toBeGreaterThan(0);
      expect(check.errors[0]).toContain('OpenAI配置错误');
    });
  });

  describe('配置摘要', () => {
    it('应该返回不包含敏感信息的配置摘要', () => {
      const manager = ConfigManager.getInstance();
      
      // 触发配置加载
      manager.getAIConfig();
      manager.getMQConfig();
      
      const summary = manager.getConfigSummary();

      expect(summary['openai']).toBeDefined();
      expect(summary['openai']['hasApiKey']).toBe(true);
      expect(summary['openai']['apiKey']).toBeUndefined(); // 不应该包含敏感信息
      expect(summary['openai']['model']).toBe('gpt-3.5-turbo');
      
      expect(summary['mq']).toBeDefined();
      expect(summary['mq']['host']).toBe('test-host');
      expect(summary['mq']['password']).toBeUndefined(); // 不应该包含敏感信息
    });
  });
});