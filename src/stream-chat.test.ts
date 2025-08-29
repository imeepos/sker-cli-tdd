/**
 * 🔴 TDD 红阶段：流式聊天功能测试
 * 测试流式输出和实时聊天功能
 */

import { StreamChat } from './stream-chat';
import { MCPOpenAIClient } from './mcp-openai';
import { MCPServer } from './mcp-server';
import { ChatStorage } from './chat-storage';

// Mock 依赖
jest.mock('./mcp-openai');
jest.mock('./mcp-server');
jest.mock('./chat-storage');

describe('流式聊天功能', () => {
  let streamChat: StreamChat;
  let mockOpenAIClient: jest.Mocked<MCPOpenAIClient>;
  let mockMCPServer: jest.Mocked<MCPServer>;
  let mockChatStorage: jest.Mocked<ChatStorage>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建 mock 对象
    mockMCPServer = {
      getTools: jest.fn().mockReturnValue([]),
      executeTool: jest.fn(),
      registerTool: jest.fn(),
      setWorkspaceManager: jest.fn(),
      setPromptManager: jest.fn()
    } as any;

    mockChatStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn().mockResolvedValue('test-session-123'),
      saveMessage: jest.fn().mockResolvedValue('test-message-123'),
      getSession: jest.fn().mockResolvedValue({
        id: 'test-session-123',
        name: 'Test Session',
        messageCount: 0,
        totalTokens: 0
      }),
      getConversationHistory: jest.fn().mockResolvedValue([]),
      listSessions: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue({
        totalMessages: 0,
        totalSessions: 0,
        dbSize: 0
      })
    } as any;

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

    streamChat = new StreamChat(mockOpenAIClient, mockMCPServer, mockChatStorage);
  });

  describe('初始化', () => {
    it('应该能够创建 StreamChat 实例', () => {
      expect(streamChat).toBeInstanceOf(StreamChat);
    });

    it('应该能够获取 OpenAI 客户端', () => {
      expect(streamChat.getOpenAIClient()).toBe(mockOpenAIClient);
    });

    it('应该能够获取 MCP 服务器', () => {
      expect(streamChat.getMCPServer()).toBe(mockMCPServer);
    });
  });

  describe('基础流式聊天', () => {
    it('应该能够进行基础流式聊天', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' World' } }] };
          yield { choices: [{ delta: { content: '!' } }] };
        }
      };

      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockStream as any);

      const result = await streamChat.chat('Hello');
      
      expect(result.content).toBe('Hello World!');
      expect(result.tokens).toBeGreaterThan(0);
      expect(mockOpenAIClient.chatCompletionStream).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello' }
      ]);
    });

    it('应该能够处理空的流式响应', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: {} }] };
        }
      };

      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockStream as any);

      const result = await streamChat.chat('Hello');
      
      expect(result.content).toBe('');
      expect(result.tokens).toBe(0);
    });

    it('应该能够处理流式聊天错误', async () => {
      mockOpenAIClient.chatCompletionStream.mockRejectedValue(new Error('API 错误'));

      await expect(streamChat.chat('Hello')).rejects.toThrow('API 错误');
    });
  });

  describe('带工具调用的流式聊天', () => {
    it('应该能够处理带工具调用的流式聊天', async () => {
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

      const mockFinalStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: '计算结果是 5' } }] };
        }
      };

      mockOpenAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      mockOpenAIClient.executeToolCall.mockResolvedValue(mockToolResult);
      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockFinalStream as any);

      const result = await streamChat.chatWithTools('计算 2 + 3');
      
      expect(result.content).toContain('计算结果是 5');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0]?.name).toBe('add');
      expect(mockOpenAIClient.executeToolCall).toHaveBeenCalled();
    });

    it('应该能够处理多个工具调用', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '我来帮你计算',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function' as const,
                function: { name: 'add', arguments: '{"a": 2, "b": 3}' }
              },
              {
                id: 'call_2',
                type: 'function' as const,
                function: { name: 'multiply', arguments: '{"a": 4, "b": 5}' }
              }
            ]
          }
        }]
      };

      const mockFinalStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: '计算完成' } }] };
        }
      };

      mockOpenAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      mockOpenAIClient.executeToolCall.mockResolvedValue({
        tool_call_id: 'call_1',
        role: 'tool' as const,
        content: '5'
      });
      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockFinalStream as any);

      const result = await streamChat.chatWithTools('计算一些数字');
      
      expect(result.toolCalls).toHaveLength(2);
      expect(mockOpenAIClient.executeToolCall).toHaveBeenCalledTimes(2);
    });
  });

  describe('多轮对话', () => {
    it('应该能够维护对话历史', async () => {
      const mockStream1 = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: '你好！' } }] };
        }
      };

      const mockStream2 = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: '我很好，谢谢！' } }] };
        }
      };

      mockOpenAIClient.chatCompletionStream
        .mockResolvedValueOnce(mockStream1 as any)
        .mockResolvedValueOnce(mockStream2 as any);

      // 第一轮对话
      await streamChat.chat('你好');
      
      // 第二轮对话
      await streamChat.chat('你好吗？');

      const history = streamChat.getConversationHistory();
      expect(history).toHaveLength(4); // 2 用户消息 + 2 助手响应
      expect(history[0]?.content).toBe('你好');
      expect(history[1]?.content).toBe('你好！');
      expect(history[2]?.content).toBe('你好吗？');
      expect(history[3]?.content).toBe('我很好，谢谢！');
    });

    it('应该能够清除对话历史', () => {
      streamChat.clearHistory();
      const history = streamChat.getConversationHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('流式输出控制', () => {
    it('应该能够启用实时输出', async () => {
      const consoleSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' World' } }] };
        }
      };

      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockStream as any);

      streamChat.setRealTimeOutput(true);
      await streamChat.chat('Hello');
      
      expect(consoleSpy).toHaveBeenCalledWith('Hello');
      expect(consoleSpy).toHaveBeenCalledWith(' World');
      
      consoleSpy.mockRestore();
    });

    it('应该能够禁用实时输出', async () => {
      const consoleSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
      
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] };
        }
      };

      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockStream as any);

      streamChat.setRealTimeOutput(false);
      await streamChat.chat('Hello');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('统计信息', () => {
    it('应该能够获取聊天统计信息', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello World' } }] };
        }
      };

      mockOpenAIClient.chatCompletionStream.mockResolvedValue(mockStream as any);

      await streamChat.chat('Hello');
      
      const stats = streamChat.getStats();
      expect(stats.totalMessages).toBe(2); // 用户 + 助手
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.totalToolCalls).toBe(0);
    });

    it('应该能够重置统计信息', () => {
      streamChat.resetStats();
      const stats = streamChat.getStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalToolCalls).toBe(0);
    });
  });
});
