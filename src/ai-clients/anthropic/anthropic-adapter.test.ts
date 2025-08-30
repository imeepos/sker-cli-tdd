/**
 * 🧠 Anthropic Claude API适配器测试套件
 * 遵循TDD原则，测试所有核心功能
 */

import { AnthropicAdapter } from './anthropic-adapter';
import { UnifiedAIConfig, UnifiedChunk, UnifiedMessage, UnifiedTool } from '../base/unified-types';

// Mock fetch globally
global.fetch = jest.fn();

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  let mockConfig: UnifiedAIConfig;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.log to prevent Jest from capturing unexpected output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    mockConfig = {
      provider: 'anthropic',
      apiKey: 'test-api-key',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      temperature: 0.7,
    };
    
    adapter = new AnthropicAdapter(mockConfig);
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  afterEach(() => {
    // Restore console.log
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  describe('构造函数', () => {
    it('应该正确初始化适配器配置', () => {
      expect(adapter.provider).toBe('anthropic');
      expect(adapter.config).toEqual(mockConfig);
    });

    it('应该设置默认的baseURL', () => {
      const adapterWithoutBaseURL = new AnthropicAdapter(mockConfig);
      expect((adapterWithoutBaseURL as any).baseURL).toBe('https://api.anthropic.com');
    });

    it('应该使用自定义baseURL', () => {
      const customConfig = { ...mockConfig, baseURL: 'https://custom.api.com' };
      const customAdapter = new AnthropicAdapter(customConfig);
      expect((customAdapter as any).baseURL).toBe('https://custom.api.com');
    });

    it('应该设置正确的请求头', () => {
      const headers = (adapter as any).headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['x-api-key']).toBe('test-api-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');
    });
  });

  describe('chatCompletion', () => {
    const mockMessages: UnifiedMessage[] = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
      { role: 'user', content: '请介绍一下你自己' }
    ];

    const mockAnthropicResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '我是Claude，一个AI助手。' }],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 15
      }
    };

    it('应该成功发送聊天完成请求', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      } as Response);

      const result = await adapter.chatCompletion({ messages: mockMessages });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
          }),
          body: expect.stringContaining('claude-3-sonnet-20240229'),
        })
      );

      expect(result.choices[0]?.message?.content).toBe('我是Claude，一个AI助手。');
      expect(result.usage?.totalTokens).toBe(25);
    });

    it('应该正确处理系统消息', async () => {
      const messagesWithSystem: UnifiedMessage[] = [
        { role: 'system', content: '你是一个友好的助手' },
        ...mockMessages
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      } as Response);

      await adapter.chatCompletion({ messages: messagesWithSystem });

      const requestBody = JSON.parse((mockFetch.mock.calls[0]![1] as any)?.body as string);
      expect(requestBody.system).toBe('你是一个友好的助手');
      expect(requestBody.messages).not.toContainEqual(
        expect.objectContaining({ role: 'system' })
      );
    });

    it('应该正确处理工具调用', async () => {
      const tools: UnifiedTool[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: '获取天气信息',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: '城市名称' }
              },
              required: ['location']
            }
          }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      } as Response);

      await adapter.chatCompletion({ messages: mockMessages, tools });

      const requestBody = JSON.parse((mockFetch.mock.calls[0]![1] as any)?.body as string);
      expect(requestBody.tools).toHaveLength(1);
      expect(requestBody.tools[0].name).toBe('get_weather');
      expect(requestBody.tools[0].description).toBe('获取天气信息');
    });

    it('应该处理API错误响应', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      } as Response);

      await expect(adapter.chatCompletion({ messages: mockMessages }))
        .rejects.toThrow('Anthropic API Error 401');
    });

    it('应该验证消息格式', async () => {
      const invalidMessages = [] as UnifiedMessage[];

      await expect(adapter.chatCompletion({ messages: invalidMessages }))
        .rejects.toThrow();
    });
  });

  describe('chatCompletionStream', () => {
    const mockMessages: UnifiedMessage[] = [
      { role: 'user', content: '请写一首诗' }
    ];

    it('应该成功处理流式响应', async () => {
      const mockStreamData = [
        'data: {"type":"message_start","message":{"id":"msg_123"}}\n',
        'data: {"type":"content_block_delta","delta":{"text":"春"}}\n',
        'data: {"type":"content_block_delta","delta":{"text":"天"}}\n',
        'data: {"type":"message_stop"}\n',
        'data: [DONE]\n'
      ];

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockStreamData[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockStreamData[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockStreamData[2]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockStreamData[3]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: jest.fn()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      } as any);

      const chunks: UnifiedChunk[] = [];
      for await (const chunk of adapter.chatCompletionStream({ messages: mockMessages })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2); // 只有content_block_delta会产生chunk
      expect(chunks[0]?.choices?.[0]?.delta?.content).toBe('春');
      expect(chunks[1]?.choices?.[0]?.delta?.content).toBe('天');
    });

    it('应该处理流式请求错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal server error' } }),
      } as Response);

      const streamGenerator = adapter.chatCompletionStream({ messages: mockMessages });
      await expect(async () => {
         for await (const chunk of streamGenerator) {
           console.log(chunk); // 使用chunk变量避免警告
         }
       }).rejects.toThrow('Anthropic API Error 500');
    });
  });

  describe('chatCompletionWithTools', () => {
    const mockMessages: UnifiedMessage[] = [
      { role: 'user', content: '今天天气怎么样？' }
    ];

    const mockTools: UnifiedTool[] = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: '获取天气信息',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            }
          }
        }
      }
    ];

    it('应该成功调用带工具的聊天完成', async () => {
      const mockResponse = {
        id: 'msg_123',
        content: [{ type: 'text', text: '我来帮你查询天气。' }],
        stop_reason: 'tool_use'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await adapter.chatCompletionWithTools(mockMessages, mockTools);

      expect(result.choices[0]?.message?.content).toBe('我来帮你查询天气。');
      expect(result.choices[0]?.finishReason).toBe('tool_calls');
    });

    it('应该验证工具格式', async () => {
      const invalidTools = [] as UnifiedTool[];

      await expect(adapter.chatCompletionWithTools(mockMessages, invalidTools))
        .rejects.toThrow();
    });
  });

  describe('getAvailableTools', () => {
    it('应该返回空数组（Anthropic不提供预定义工具）', () => {
      const tools = adapter.getAvailableTools();
      expect(tools).toEqual([]);
    });
  });

  describe('validateConfig', () => {
    it('应该验证有效配置', () => {
      expect(adapter.validateConfig()).toBe(true);
    });

    it('应该拒绝缺少apiKey的配置', () => {
      const invalidAdapter = new AnthropicAdapter({
        ...mockConfig,
        apiKey: ''
      });
      expect(invalidAdapter.validateConfig()).toBe(false);
    });

    it('应该拒绝缺少model的配置', () => {
      const invalidAdapter = new AnthropicAdapter({
        ...mockConfig,
        model: ''
      });
      expect(invalidAdapter.validateConfig()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('应该在连接成功时返回true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test' }),
      } as Response);

      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('应该在连接失败时返回false', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('getModelInfo', () => {
    it('应该返回正确的模型信息', async () => {
      const modelInfo = await adapter.getModelInfo();

      expect(modelInfo.id).toBe('claude-3-sonnet-20240229');
      expect(modelInfo.name).toBe('claude-3-sonnet-20240229');
      expect(modelInfo.description).toContain('Anthropic');
      expect(modelInfo.maxTokens).toBe(4096);
      expect(modelInfo.supportsFunctions).toBe(true);
      expect(modelInfo.supportsStreaming).toBe(true);
    });
  });

  describe('私有方法测试', () => {
    describe('convertToAnthropicMessages', () => {
      it('应该正确转换消息格式', () => {
        const messages: UnifiedMessage[] = [
          { role: 'system', content: '系统消息' },
          { role: 'user', content: '用户消息' },
          { role: 'assistant', content: '助手消息' }
        ];

        const converted = (adapter as any).convertToAnthropicMessages(messages);

        expect(converted).toHaveLength(2); // system消息被过滤
        expect(converted[0]).toEqual({ role: 'user', content: '用户消息' });
        expect(converted[1]).toEqual({ role: 'assistant', content: '助手消息' });
      });
    });

    describe('extractSystemMessage', () => {
      it('应该正确提取系统消息', () => {
        const messages: UnifiedMessage[] = [
          { role: 'system', content: '你是一个助手' },
          { role: 'user', content: '用户消息' }
        ];

        const systemMessage = (adapter as any).extractSystemMessage(messages);
        expect(systemMessage).toBe('你是一个助手');
      });

      it('应该在没有系统消息时返回undefined', () => {
        const messages: UnifiedMessage[] = [
          { role: 'user', content: '用户消息' }
        ];

        const systemMessage = (adapter as any).extractSystemMessage(messages);
        expect(systemMessage).toBeUndefined();
      });
    });

    describe('convertToAnthropicTools', () => {
      it('应该正确转换工具格式', () => {
        const tools: UnifiedTool[] = [
          {
            type: 'function',
            function: {
              name: 'test_tool',
              description: '测试工具',
              parameters: { type: 'object' }
            }
          }
        ];

        const converted = (adapter as any).convertToAnthropicTools(tools);

        expect(converted).toHaveLength(1);
        expect(converted[0]).toEqual({
          name: 'test_tool',
          description: '测试工具',
          input_schema: { type: 'object' }
        });
      });
    });

    describe('mapAnthropicStopReason', () => {
      it('应该正确映射停止原因', () => {
        expect((adapter as any).mapAnthropicStopReason('end_turn')).toBe('stop');
        expect((adapter as any).mapAnthropicStopReason('max_tokens')).toBe('length');
        expect((adapter as any).mapAnthropicStopReason('tool_use')).toBe('tool_calls');
        expect((adapter as any).mapAnthropicStopReason('unknown')).toBe('stop');
      });
    });

    describe('extractContentFromAnthropicResponse', () => {
      it('应该从数组内容中提取文本', () => {
        const response = {
          content: [
            { type: 'text', text: '第一部分' },
            { type: 'text', text: '第二部分' }
          ]
        };

        const content = (adapter as any).extractContentFromAnthropicResponse(response);
        expect(content).toBe('第一部分第二部分');
      });

      it('应该处理字符串内容', () => {
        const response = { content: '直接字符串内容' };

        const content = (adapter as any).extractContentFromAnthropicResponse(response);
        expect(content).toBe('直接字符串内容');
      });

      it('应该处理空内容', () => {
        const response = {};

        const content = (adapter as any).extractContentFromAnthropicResponse(response);
        expect(content).toBe('');
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.chatCompletion({ messages: [{ role: 'user', content: 'test' }] }))
        .rejects.toThrow();
    });

    it('应该处理JSON解析错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => { throw new Error('Invalid JSON'); },
        statusText: 'Bad Request'
      } as any);

      await expect(adapter.chatCompletion({ messages: [{ role: 'user', content: 'test' }] }))
        .rejects.toThrow('Anthropic API Error 400: Bad Request');
    });
  });
});