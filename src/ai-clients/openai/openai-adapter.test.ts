/**
 * 🧪 OpenAI适配器测试套件
 * 遵循TDD原则，测试OpenAIAdapter类的所有功能
 */

import { OpenAIAdapter } from './openai-adapter';
import { UnifiedAIConfig, UnifiedChunk, UnifiedMessage, UnifiedTool } from '../base/unified-types';
import OpenAI from 'openai';

// Mock OpenAI模块
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockConfig: UnifiedAIConfig;
  let mockOpenAIClient: jest.Mocked<OpenAI>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // Mock console.log to prevent Jest from capturing unexpected output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // 创建mock配置
    mockConfig = {
      provider: 'openai',
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      baseURL: 'https://api.openai.com/v1',
      maxTokens: 1000,
      temperature: 0.7,
      timeout: 30000,
    };

    // 创建mock OpenAI客户端
    mockOpenAIClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;

    // 确保create方法是jest mock函数
    (mockOpenAIClient.chat.completions.create as jest.Mock) = jest.fn();

    // 设置OpenAI构造函数mock
    MockedOpenAI.mockImplementation(() => mockOpenAIClient);

    // 创建适配器实例
    adapter = new OpenAIAdapter(mockConfig);
  });

  afterEach(() => {
    // Restore console.log
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  describe('构造函数', () => {
    it('应该正确初始化OpenAI客户端', () => {
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        baseURL: 'https://api.openai.com/v1',
        timeout: 30000,
      });
      expect(adapter.provider).toBe('openai');
      expect(adapter.config).toEqual(mockConfig);
    });

    it('应该使用默认超时时间', () => {
      const configWithoutTimeout = { ...mockConfig };
      delete configWithoutTimeout.timeout;
      
      new OpenAIAdapter(configWithoutTimeout);
      
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        baseURL: 'https://api.openai.com/v1',
        timeout: 30000,
      });
    });
  });

  describe('chatCompletion', () => {
    it('应该成功完成聊天对话', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '你好！我是AI助手。',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      (mockOpenAIClient.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '你好' },
      ];

      const result = await adapter.chatCompletion({ messages });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 1000,
        temperature: 0.7,
        tools: undefined,
        tool_choice: undefined,
        stream: false,
      });

      expect(result.choices[0]?.message?.content).toBe('你好！我是AI助手。');
      expect(result.usage?.totalTokens).toBe(30);
    });

    it('应该处理带工具的聊天对话', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "北京"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      };

      (mockOpenAIClient.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '北京天气如何？' },
      ];

      const tools: UnifiedTool[] = [{
        type: 'function',
        function: {
          name: 'get_weather',
          description: '获取天气信息',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: '城市名称' },
            },
            required: ['location'],
          },
        },
      }];

      const result = await adapter.chatCompletion({ messages, tools, toolChoice: 'auto' });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: '北京天气如何？' }],
        max_tokens: 1000,
        temperature: 0.7,
        tools: [{
          type: 'function',
          function: {
            name: 'get_weather',
            description: '获取天气信息',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: '城市名称' },
              },
              required: ['location'],
            },
          },
        }],
        tool_choice: 'auto',
        stream: false,
      });

      expect(result.choices[0]?.message?.toolCalls?.[0]?.function.name).toBe('get_weather');
    });

    it('应该处理API错误', async () => {
      (mockOpenAIClient.chat.completions.create as jest.Mock).mockRejectedValue(new Error('API 错误'));

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '测试' },
      ];

      await expect(adapter.chatCompletion({ messages })).rejects.toThrow('API 错误');
    });
  });

  describe('chatCompletionStream', () => {
    it('应该成功处理流式响应', async () => {
      const mockChunks = [
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: { role: 'assistant', content: '你好' },
            finish_reason: null,
          }],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: { content: '！' },
            finish_reason: 'stop',
          }],
        },
      ];

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      (mockOpenAIClient.chat.completions.create as jest.Mock).mockResolvedValue(mockStream as any);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '你好' },
      ];

      const chunks: UnifiedChunk[] = [];
      for await (const chunk of adapter.chatCompletionStream({ messages })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.choices?.[0]?.delta?.content).toBe('你好');
      expect(chunks[1]?.choices?.[0]?.delta?.content).toBe('！');
    });

    it('应该处理流式API错误', async () => {
      (mockOpenAIClient.chat.completions.create as jest.Mock).mockRejectedValue(new Error('流式API错误'));

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '测试' },
      ];

      const streamGenerator = adapter.chatCompletionStream({ messages });
      
      await expect(async () => {
        for await (const chunk of streamGenerator) {
          console.log(chunk);
        }
      }).rejects.toThrow('流式API错误');
    });
  });

  describe('chatCompletionWithTools', () => {
    it('应该调用chatCompletion方法处理工具', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '已调用工具',
          },
          finish_reason: 'stop',
        }],
      };

      (mockOpenAIClient.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '使用工具' },
      ];

      const tools: UnifiedTool[] = [{
        type: 'function',
        function: {
          name: 'test_tool',
          description: '测试工具',
          parameters: { type: 'object', properties: {} },
        },
      }];

      const result = await adapter.chatCompletionWithTools(messages, tools);

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: '使用工具' }],
        max_tokens: 1000,
        temperature: 0.7,
        tools: [{
          type: 'function',
          function: {
            name: 'test_tool',
            description: '测试工具',
            parameters: { type: 'object', properties: {} },
          },
        }],
        tool_choice: 'auto',
        stream: false,
      });

      expect(result.choices[0]?.message?.content).toBe('已调用工具');
    });
  });

  describe('getAvailableTools', () => {
    it('应该返回空数组', () => {
      const tools = adapter.getAvailableTools();
      expect(tools).toEqual([]);
    });
  });

  describe('validateConfig', () => {
    it('应该验证有效配置', () => {
      expect(adapter.validateConfig()).toBe(true);
    });

    it('应该拒绝缺少apiKey的配置', () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      const invalidAdapter = new OpenAIAdapter(invalidConfig);
      expect(invalidAdapter.validateConfig()).toBe(false);
    });

    it('应该拒绝缺少model的配置', () => {
      const invalidConfig = { ...mockConfig, model: '' };
      const invalidAdapter = new OpenAIAdapter(invalidConfig);
      expect(invalidAdapter.validateConfig()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('应该成功测试连接', async () => {
      (mockOpenAIClient.chat.completions.create as jest.Mock).mockResolvedValue({} as any);

      const result = await adapter.testConnection();

      expect(result).toBe(true);
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
    });

    it('应该处理连接失败', async () => {
      (mockOpenAIClient.chat.completions.create as jest.Mock).mockRejectedValue(new Error('连接失败'));

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('getModelInfo', () => {
    it('应该返回模型信息', async () => {
      const modelInfo = await adapter.getModelInfo();

      expect(modelInfo).toEqual({
        id: 'gpt-3.5-turbo',
        name: 'gpt-3.5-turbo',
        description: 'OpenAI gpt-3.5-turbo model',
        maxTokens: 1000,
        supportsFunctions: true,
        supportsStreaming: true,
      });
    });
  });

  describe('私有方法测试', () => {
    describe('convertToOpenAIMessages', () => {
      it('应该转换基本消息', () => {
        const messages: UnifiedMessage[] = [
          { role: 'user', content: '用户消息' },
          { role: 'assistant', content: '助手回复' },
        ];

        const result = (adapter as any).convertToOpenAIMessages(messages);

        expect(result).toEqual([
          { role: 'user', content: '用户消息' },
          { role: 'assistant', content: '助手回复' },
        ]);
      });

      it('应该转换工具消息', () => {
        const messages: UnifiedMessage[] = [
          {
            role: 'tool',
            content: '工具结果',
            toolCallId: 'call_123',
          },
        ];

        const result = (adapter as any).convertToOpenAIMessages(messages);

        expect(result).toEqual([
          {
            role: 'tool',
            content: '工具结果',
            tool_call_id: 'call_123',
          },
        ]);
      });

      it('应该转换带工具调用的消息', () => {
        const messages: UnifiedMessage[] = [
          {
            role: 'assistant',
            content: '',
            toolCalls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "北京"}',
              },
            }],
          },
        ];

        const result = (adapter as any).convertToOpenAIMessages(messages);

        expect(result[0].tool_calls).toEqual([{
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "北京"}',
          },
        }]);
      });
    });

    describe('convertToOpenAITools', () => {
      it('应该转换工具定义', () => {
        const tools: UnifiedTool[] = [{
          type: 'function',
          function: {
            name: 'test_function',
            description: '测试函数',
            parameters: {
              type: 'object',
              properties: {
                param1: { type: 'string' },
              },
            },
          },
        }];

        const result = (adapter as any).convertToOpenAITools(tools);

        expect(result).toEqual([{
          type: 'function',
          function: {
            name: 'test_function',
            description: '测试函数',
            parameters: {
              type: 'object',
              properties: {
                param1: { type: 'string' },
              },
            },
          },
        }]);
      });
    });

    describe('convertToOpenAIToolChoice', () => {
      it('应该处理字符串工具选择', () => {
        const result = (adapter as any).convertToOpenAIToolChoice('auto');
        expect(result).toBe('auto');
      });

      it('应该处理对象工具选择', () => {
        const toolChoice = {
          function: { name: 'specific_function' },
        };

        const result = (adapter as any).convertToOpenAIToolChoice(toolChoice);

        expect(result).toEqual({
          type: 'function',
          function: { name: 'specific_function' },
        });
      });
    });

    describe('convertFromOpenAIResponse', () => {
      it('应该转换OpenAI响应', () => {
        const openaiResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '测试回复',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        };

        const result = (adapter as any).convertFromOpenAIResponse(openaiResponse);

        expect(result).toEqual({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '测试回复',
            },
            finishReason: 'stop',
          }],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        });
      });

      it('应该处理没有usage的响应', () => {
        const openaiResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '测试回复',
            },
            finish_reason: 'stop',
          }],
        };

        const result = (adapter as any).convertFromOpenAIResponse(openaiResponse);

        expect(result.usage).toBeUndefined();
      });
    });

    describe('convertFromOpenAIChunk', () => {
      it('应该转换OpenAI流式块', () => {
        const openaiChunk = {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: {
              role: 'assistant',
              content: '流式内容',
            },
            finish_reason: null,
          }],
        };

        const result = (adapter as any).convertFromOpenAIChunk(openaiChunk);

        expect(result).toEqual({
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: {
              role: 'assistant',
              content: '流式内容',
            },
            finishReason: null,
          }],
        });
      });
    });

    describe('convertFromOpenAIMessage', () => {
      it('应该转换基本消息', () => {
        const openaiMessage = {
          role: 'assistant',
          content: '助手消息',
        };

        const result = (adapter as any).convertFromOpenAIMessage(openaiMessage);

        expect(result).toEqual({
          role: 'assistant',
          content: '助手消息',
        });
      });

      it('应该转换带工具调用的消息', () => {
        const openaiMessage = {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "北京"}',
            },
          }],
        };

        const result = (adapter as any).convertFromOpenAIMessage(openaiMessage);

        expect(result).toEqual({
          role: 'assistant',
          content: '',
          toolCalls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "北京"}',
            },
          }],
        });
      });

      it('应该处理空消息', () => {
        const openaiMessage = {};

        const result = (adapter as any).convertFromOpenAIMessage(openaiMessage);

        expect(result).toEqual({
          role: 'assistant',
          content: '',
        });
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      (mockOpenAIClient.chat.completions.create as jest.Mock).mockRejectedValue(new Error('网络连接失败'));

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '测试' },
      ];

      await expect(adapter.chatCompletion({ messages })).rejects.toThrow('网络连接失败');
    });

    it('应该处理认证错误', async () => {
      const authError = new Error('认证失败');
      (authError as any).status = 401;
      (mockOpenAIClient.chat.completions.create as jest.Mock).mockRejectedValue(authError);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: '测试' },
      ];

      await expect(adapter.chatCompletion({ messages })).rejects.toThrow('认证失败');
    });
  });
});