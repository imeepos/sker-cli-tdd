/**
 * 🔴 TDD 红阶段：CLI 工具测试
 * 测试命令行工具的核心功能
 */

import { CLI } from './cli';
import { MCPOpenAIClient } from './mcp-openai';

// Mock 外部依赖
jest.mock('./mcp-openai');
jest.mock('fs');
jest.mock('inquirer');

describe('CLI 工具', () => {
  let cli: CLI;
  let mockOpenAIClient: jest.Mocked<MCPOpenAIClient>;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    
    // 创建 mock OpenAI 客户端
    mockOpenAIClient = {
      chatCompletionStream: jest.fn(),
      chatCompletionWithTools: jest.fn(),
      executeToolCall: jest.fn(),
      processConversation: jest.fn(),
      getOpenAITools: jest.fn().mockReturnValue([]),
      getConfig: jest.fn().mockReturnValue({
        apiKey: 'test-key',
        model: 'gpt-4'
      })
    } as any;

    // 创建 CLI 实例
    cli = new CLI();
  });

  describe('初始化', () => {
    it('应该能够创建 CLI 实例', () => {
      expect(cli).toBeInstanceOf(CLI);
    });

    it('应该能够设置 OpenAI 客户端', () => {
      cli.setOpenAIClient(mockOpenAIClient);
      expect(cli.getOpenAIClient()).toBe(mockOpenAIClient);
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
      process.env['OPENAI_API_KEY'] = 'test-api-key';
      process.env['OPENAI_MODEL'] = 'gpt-3.5-turbo';

      const config = cli.loadConfigFromEnv();
      expect(config.apiKey).toBe('test-api-key');
      expect(config.model).toBe('gpt-3.5-turbo');

      // 清理环境变量
      delete process.env['OPENAI_API_KEY'];
      delete process.env['OPENAI_MODEL'];
    });

    it('应该在缺少 API 密钥时抛出错误', () => {
      delete process.env['OPENAI_API_KEY'];
      expect(() => cli.loadConfigFromEnv()).toThrow('OPENAI_API_KEY 环境变量未设置');
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

      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockStream as any);
      cli.setOpenAIClient(mockOpenAIClient);

      const result = await cli.streamChat('Hello');
      
      expect(mockOpenAIClient.chatCompletionStream).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello' }
      ]);
      expect(result).toContain('Hello World');
    });

    it('应该能够处理流式聊天错误', async () => {
      mockOpenAIClient.chatCompletionStream.mockRejectedValue(new Error('API 错误'));
      cli.setOpenAIClient(mockOpenAIClient);

      await expect(cli.streamChat('Hello')).rejects.toThrow('API 错误');
    });
  });

  describe('工具调用功能', () => {
    it('应该能够获取可用工具列表', () => {
      const mockTools = [
        {
          type: 'function' as const,
          function: {
            name: 'calculator',
            description: '计算器工具',
            parameters: {}
          }
        }
      ];

      mockOpenAIClient.getOpenAITools.mockReturnValue(mockTools);
      cli.setOpenAIClient(mockOpenAIClient);

      const tools = cli.getAvailableTools();
      expect(tools).toEqual(mockTools);
      expect(mockOpenAIClient.getOpenAITools).toHaveBeenCalled();
    });

    it('应该能够执行带工具调用的对话', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '我来帮你计算',
            tool_calls: [{
              id: 'call_123',
              type: 'function' as const,
              function: {
                name: 'add',
                arguments: '{"a": 2, "b": 3}'
              }
            }]
          }
        }]
      };

      const mockToolResult = {
        tool_call_id: 'call_123',
        role: 'tool' as const,
        content: '5'
      };

      mockOpenAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      mockOpenAIClient.executeToolCall.mockResolvedValue(mockToolResult);
      cli.setOpenAIClient(mockOpenAIClient);

      const result = await cli.chatWithTools('计算 2 + 3');
      
      expect(mockOpenAIClient.chatCompletionWithTools).toHaveBeenCalled();
      expect(mockOpenAIClient.executeToolCall).toHaveBeenCalled();
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

      mockOpenAIClient.chatCompletionStream.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hi there!' } }] };
        }
      } as any);

      cli.setOpenAIClient(mockOpenAIClient);

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
      mockOpenAIClient.chatCompletionStream.mockRejectedValue(new Error('网络错误'));
      cli.setOpenAIClient(mockOpenAIClient);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await cli.handleError(new Error('网络错误'));
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('网络错误'));
      consoleSpy.mockRestore();
    });
  });
});
