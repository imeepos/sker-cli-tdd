/**
 * 🔴 TDD 红阶段：MCP OpenAI 集成功能测试
 * 这些测试最初会失败 - 这是正确的 TDD 行为！
 */

import { MCPServer } from './mcp-server';
import { MCPOpenAIClient, MCPOpenAIConfig } from './mcp-openai'; // ❌ 这会失败 - 正确的！
import { MCPWorkspaceManager } from './mcp-workspace';
import { MCPPromptManager } from './mcp-prompts';

// Mock OpenAI SDK
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('MCP OpenAI 集成功能', () => {
  describe('OpenAI 客户端配置', () => {
    it('应该定义 MCPOpenAIConfig 接口', () => {
      const config: MCPOpenAIConfig = { // ❌ 会失败 - 接口不存在
        apiKey: 'test-api-key',
        model: 'gpt-4',
        baseURL: 'https://api.openai.com/v1',
        maxTokens: 1000,
        temperature: 0.7
      };
      
      expect(config.apiKey).toBe('test-api-key');
      expect(config.model).toBe('gpt-4');
      expect(config.maxTokens).toBe(1000);
    });

    it('应该支持从环境变量加载配置', () => {
      // 模拟环境变量
      process.env['OPENAI_API_KEY'] = 'env-api-key';
      process.env['OPENAI_MODEL'] = 'gpt-3.5-turbo';
      process.env['OPENAI_BASE_URL'] = 'https://custom.openai.com/v1';

      const config = MCPOpenAIClient.loadConfigFromEnv();
      expect(config.apiKey).toBe('env-api-key');
      expect(config.model).toBe('gpt-3.5-turbo');
      expect(config.baseURL).toBe('https://custom.openai.com/v1');

      // 清理环境变量
      delete process.env['OPENAI_API_KEY'];
      delete process.env['OPENAI_MODEL'];
      delete process.env['OPENAI_BASE_URL'];
    });
  });

  describe('OpenAI 客户端', () => {
    let openaiClient: MCPOpenAIClient;
    let mcpServer: MCPServer;

    beforeEach(() => {
      mcpServer = new MCPServer();
      const config: MCPOpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.7
      };
      openaiClient = new MCPOpenAIClient(config, mcpServer); // ❌ 会失败 - 类不存在
    });

    it('应该创建 OpenAI 客户端实例', () => {
      expect(openaiClient).toBeInstanceOf(MCPOpenAIClient);
    });

    it('应该获取配置信息', () => {
      const config = openaiClient.getConfig(); // ❌ 会失败
      expect(config.apiKey).toBe('test-api-key');
      expect(config.model).toBe('gpt-4');
    });

    it('应该设置 MCP 服务器', () => {
      const newServer = new MCPServer();
      openaiClient.setMCPServer(newServer); // ❌ 会失败
      expect(openaiClient.getMCPServer()).toBe(newServer);
    });
  });

  describe('工具调用集成', () => {
    let openaiClient: MCPOpenAIClient;
    let mcpServer: MCPServer;
    let workspaceManager: MCPWorkspaceManager;

    beforeEach(() => {
      mcpServer = new MCPServer();
      workspaceManager = new MCPWorkspaceManager();
      mcpServer.setWorkspaceManager(workspaceManager);
      
      // 注册测试工具
      mcpServer.registerTool({
        name: 'add',
        description: '两数相加',
        schema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: '第一个数' },
            b: { type: 'number', description: '第二个数' }
          },
          required: ['a', 'b']
        },
        handler: async (params) => ({ result: params.a + params.b })
      });

      const config: MCPOpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4'
      };
      openaiClient = new MCPOpenAIClient(config, mcpServer);
    });

    it('应该将 MCP 工具转换为 OpenAI 函数格式', () => {
      const openaiTools = openaiClient.getOpenAITools(); // ❌ 会失败
      expect(openaiTools).toHaveLength(1);
      expect(openaiTools[0]).toEqual({
        type: 'function',
        function: {
          name: 'add',
          description: '两数相加',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number', description: '第一个数' },
              b: { type: 'number', description: '第二个数' }
            },
            required: ['a', 'b']
          }
        }
      });
    });

    it('应该执行工具调用', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'add',
          arguments: '{"a": 5, "b": 3}'
        }
      };

      const result = await openaiClient.executeToolCall(toolCall); // ❌ 会失败
      expect(result).toEqual({
        tool_call_id: 'call_123',
        role: 'tool',
        content: JSON.stringify({ result: 8 })
      });
    });

    it('应该处理工具调用错误', async () => {
      const toolCall = {
        id: 'call_456',
        type: 'function' as const,
        function: {
          name: 'nonexistent',
          arguments: '{}'
        }
      };

      const result = await openaiClient.executeToolCall(toolCall);
      expect(result.tool_call_id).toBe('call_456');
      expect(result.role).toBe('tool');
      expect(JSON.parse(result.content)).toEqual({
        error: '工具 "nonexistent" 未找到'
      });
    });
  });

  describe('聊天完成集成', () => {
    let openaiClient: MCPOpenAIClient;
    let mcpServer: MCPServer;

    beforeEach(() => {
      mcpServer = new MCPServer();
      const config: MCPOpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4'
      };
      openaiClient = new MCPOpenAIClient(config, mcpServer);

      // Mock OpenAI 响应
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            role: 'assistant',
            content: '你好！我可以帮助你进行计算。',
            tool_calls: null
          }
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      });
    });

    it('应该发送聊天完成请求', async () => {
      const messages = [
        { role: 'user' as const, content: '你好' }
      ];

      const response = await openaiClient.chatCompletion(messages);
      expect(response.choices[0]?.message?.content).toBe('你好！我可以帮助你进行计算。');
    });

    it('应该支持工具调用的聊天完成', async () => {
      // Mock 带工具调用的响应
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'add',
                arguments: '{"a": 5, "b": 3}'
              }
            }]
          }
        }]
      });

      const messages = [
        { role: 'user' as const, content: '计算 5 + 3' }
      ];

      const response = await openaiClient.chatCompletionWithTools(messages);
      expect(response.choices[0]?.message?.tool_calls).toHaveLength(1);
      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      expect(toolCall?.type).toBe('function');
      if (toolCall?.type === 'function') {
        expect(toolCall.function.name).toBe('add');
      }
    });
  });

  describe('提示词集成', () => {
    let openaiClient: MCPOpenAIClient;
    let mcpServer: MCPServer;
    let promptManager: MCPPromptManager;

    beforeEach(() => {
      mcpServer = new MCPServer();
      promptManager = new MCPPromptManager();
      mcpServer.setPromptManager(promptManager);

      // 注册测试提示词
      promptManager.registerPrompt({
        name: 'greeting',
        description: '问候提示词',
        template: '你好，{{name}}！我是 {{role}}，可以帮助你 {{task}}。',
        arguments: [
          { name: 'name', description: '用户名称', required: true },
          { name: 'role', description: '角色', required: false, default: 'AI助手' },
          { name: 'task', description: '任务', required: false, default: '解决问题' }
        ]
      });

      const config: MCPOpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4'
      };
      openaiClient = new MCPOpenAIClient(config, mcpServer);
    });

    it('应该使用提示词进行聊天完成', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            role: 'assistant',
            content: '你好，张三！我是 AI助手，可以帮助你解决问题。'
          }
        }]
      });

      const response = await openaiClient.chatCompletionWithPrompt(
        'greeting',
        { name: '张三' },
        [{ role: 'user', content: '请介绍一下自己' }]
      );

      expect(response.choices[0]?.message?.content).toContain('张三');
      expect(response.choices[0]?.message?.content).toContain('AI助手');
    });

    it('应该处理提示词渲染错误', async () => {
      await expect(openaiClient.chatCompletionWithPrompt(
        'nonexistent',
        {},
        [{ role: 'user', content: '测试' }]
      )).rejects.toThrow('Prompt "nonexistent" 不存在');
    });
  });

  describe('流式响应', () => {
    let openaiClient: MCPOpenAIClient;
    let mcpServer: MCPServer;

    beforeEach(() => {
      mcpServer = new MCPServer();
      const config: MCPOpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4'
      };
      openaiClient = new MCPOpenAIClient(config, mcpServer);
    });

    it('应该支持流式聊天完成', async () => {
      // Mock 流式响应
      const mockCreate = require('openai').OpenAI().chat.completions.create;
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: '你好' } }] };
          yield { choices: [{ delta: { content: '！' } }] };
        }
      };
      mockCreate.mockResolvedValue(mockStream);

      const messages = [
        { role: 'user' as const, content: '你好' }
      ];

      const stream = await openaiClient.chatCompletionStream(messages);
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.choices?.[0]?.delta?.content).toBe('你好');
      expect(chunks[1]?.choices?.[0]?.delta?.content).toBe('！');
    });
  });
});
