/**
 * 🔴 TDD 红阶段：CLI 工具测试
 * 测试命令行工具的核心功能
 */

import { CLI } from './cli';
import { MCPAIClient } from './mcp-ai-client';

// Mock 外部依赖
jest.mock('./mcp-ai-client');
jest.mock('fs');
jest.mock('inquirer');

describe('CLI 工具', () => {
  let cli: CLI;
  let mockAIClient: jest.Mocked<MCPAIClient>;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();

    // 创建 mock AI 客户端
    mockAIClient = {
      provider: 'openai',
      configuration: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4096
      },
      client: {} as any,
      chatCompletion: jest.fn(),
      chatCompletionStream: jest.fn().mockReturnValue(Promise.resolve({
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'test' } }] };
        }
      })),
      chatCompletionWithTools: jest.fn(),
      executeToolCall: jest.fn(),
      getAvailableTools: jest.fn().mockReturnValue([]),
      validateConfig: jest.fn().mockReturnValue(true),
      testConnection: jest.fn().mockResolvedValue(true),
      getModelInfo: jest.fn().mockResolvedValue({}),
      switchProvider: jest.fn()
    } as any;

    // 创建 CLI 实例
    cli = new CLI();
  });

  describe('初始化', () => {
    it('应该能够创建 CLI 实例', () => {
      expect(cli).toBeInstanceOf(CLI);
    });

    it('应该能够设置 AI 客户端', () => {
      cli.setAIClient(mockAIClient);
      expect(cli.getAIClient()).toBe(mockAIClient);
    });
  });

  describe('配置管理', () => {
    it('应该能够加载默认配置', () => {
      const config = cli.getDefaultConfig();
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('temperature');
      expect(config).toHaveProperty('maxTokens');
    });

    it('应该能够从环境变量加载配置', () => {
      process.env['AI_API_KEY'] = 'test-api-key';
      process.env['AI_MODEL'] = 'gpt-3.5-turbo';

      const config = cli.loadConfigFromEnv();
      expect(config.apiKey).toBe('test-api-key');
      expect(config.model).toBe('gpt-3.5-turbo');

      // 清理环境变量
      delete process.env['AI_API_KEY'];
      delete process.env['AI_MODEL'];
    });

    it('应该在缺少 API 密钥时抛出错误', () => {
      delete process.env['AI_API_KEY'];
      expect(() => cli.loadConfigFromEnv()).toThrow('AI_API_KEY 环境变量未设置');
    });
  });

  describe('命令行参数解析', () => {
    it('应该能够解析基本命令行参数', () => {
      const args = ['--model', 'gpt-4', '--temperature', '0.7'];
      const options = cli.parseArgs(args);
      
      expect(options.model).toBe('gpt-4');
      expect(options.temperature).toBe(0.7);
    });

    it('应该能够解析流式输出选项', () => {
      const args = ['--stream'];
      const options = cli.parseArgs(args);
      
      expect(options.stream).toBe(true);
    });

    it('应该能够解析交互式模式选项', () => {
      const args = ['--interactive'];
      const options = cli.parseArgs(args);
      
      expect(options.interactive).toBe(true);
    });
  });

  describe('流式聊天功能', () => {
    it('应该能够启动流式聊天', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' World' } }] };
        }
      };

      (mockAIClient.chatCompletionStream as jest.Mock).mockReturnValue(mockStream);
      cli.setAIClient(mockAIClient);

      const result = await cli.streamChat('Hello');
      
      expect(mockAIClient.chatCompletionStream).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello' }
      ]);
      expect(result).toContain('Hello World');
    });

    it('应该能够处理流式聊天错误', async () => {
      const mockError = new Error('API 错误');
      (mockAIClient.chatCompletionStream as jest.Mock).mockImplementation(() => {
        throw mockError;
      });
      cli.setAIClient(mockAIClient);

      await expect(cli.streamChat('Hello')).rejects.toThrow('API 错误');
    });
  });

  describe('工具调用功能', () => {
    it('应该能够获取可用工具列表', () => {
      const mockTools = [
        {
          name: 'calculator',
          description: '计算器工具',
          handler: jest.fn(),
          schema: {}
        }
      ];

      mockAIClient.getAvailableTools.mockReturnValue(mockTools);
      cli.setAIClient(mockAIClient);

      const tools = cli.getAvailableTools();
      expect(tools).toEqual(mockTools);
      expect(mockAIClient.getAvailableTools).toHaveBeenCalled();
    });

    it('应该能够执行带工具调用的对话', async () => {
      const mockResponse = {
        id: 'test-response',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '我来帮你计算',
            toolCalls: [{
              id: 'call_123',
              type: 'function' as const,
              function: {
                name: 'add',
                arguments: '{"a": 2, "b": 3}'
              }
            }]
          },
          finishReason: 'tool_calls' as const
        }]
      };

      const mockToolResult = {
        tool_call_id: 'call_123',
        role: 'tool' as const,
        content: '5'
      };

      mockAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      mockAIClient.executeToolCall.mockResolvedValue(mockToolResult);
      cli.setAIClient(mockAIClient);

      const result = await cli.chatWithTools('计算 2 + 3');
      
      expect(mockAIClient.chatCompletionWithTools).toHaveBeenCalled();
      expect(mockAIClient.executeToolCall).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('交互式模式', () => {
    it('应该能够启动交互式模式', async () => {
      // Mock inquirer
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn()
        .mockResolvedValueOnce({ message: 'Hello' })
        .mockResolvedValueOnce({ message: '/exit' });

      (mockAIClient.chatCompletionStream as jest.Mock).mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hi there!' } }] };
        }
      });

      cli.setAIClient(mockAIClient);

      await cli.startInteractiveMode();
      
      expect(inquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('帮助和版本信息', () => {
    it('应该能够显示帮助信息', () => {
      const help = cli.getHelpText();
      expect(help).toContain('使用方法');
      expect(help).toContain('选项');
      expect(help).toContain('示例');
    });

    it('应该能够显示版本信息', () => {
      const version = cli.getVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('应该能够处理无效的配置', () => {
      expect(() => {
        cli.validateConfig({} as any);
      }).toThrow('配置无效');
    });

    it('应该能够处理网络错误', async () => {
      (mockAIClient.chatCompletionStream as jest.Mock).mockImplementation(() => {
        throw new Error('网络错误');
      });
      cli.setAIClient(mockAIClient);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await cli.handleError(new Error('网络错误'));
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('网络错误'));
      consoleSpy.mockRestore();
    });
  });
});
