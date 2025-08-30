/**
 * 🔴 TDD 红阶段：StreamChat 测试用例
 * 测试流式聊天功能的所有核心方法
 */

import { StreamChat } from './stream-chat';
import { MCPAIClient } from './mcp-ai-client';
import { MCPServer } from './mcp-server';
import { ChatStorage } from './chat-storage';

// Mock 依赖
jest.mock('./mcp-ai-client');
jest.mock('./mcp-server');
jest.mock('./chat-storage');

describe('StreamChat', () => {
  let streamChat: StreamChat;
  let mockAIClient: jest.Mocked<MCPAIClient>;
  let mockMCPServer: jest.Mocked<MCPServer>;
  let mockChatStorage: jest.Mocked<ChatStorage>;

  beforeEach(() => {
    // 创建 mock 实例
    mockAIClient = {
      chatCompletionStream: jest.fn(),
      chatCompletionWithTools: jest.fn(),
      executeToolCall: jest.fn(),
      provider: 'openai',
      configuration: {},
      client: {},
      chatCompletion: jest.fn(),
      getAvailableTools: jest.fn(),
      validateConfig: jest.fn(),
      testConnection: jest.fn(),
      getModelInfo: jest.fn(),
      switchProvider: jest.fn(),
    } as any;

    mockMCPServer = {
      getTools: jest.fn().mockReturnValue([]),
    } as any;

    mockChatStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn().mockResolvedValue('session-123'),
      saveMessage: jest.fn().mockResolvedValue('msg-123'),
      getConversationHistory: jest.fn().mockResolvedValue([]),
      listSessions: jest.fn().mockResolvedValue([]),
      getSession: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({ totalMessages: 0, totalSessions: 0 }),
    } as any;

    // 创建 StreamChat 实例
    streamChat = new StreamChat(mockAIClient, mockMCPServer, mockChatStorage);
  });

  describe('构造函数和基础方法', () => {
    it('应该正确初始化 StreamChat 实例', () => {
      expect(streamChat).toBeInstanceOf(StreamChat);
      expect(streamChat.getAIClient()).toBe(mockAIClient);
      expect(streamChat.getMCPServer()).toBe(mockMCPServer);
      expect(streamChat.getChatStorage()).toBe(mockChatStorage);
    });

    it('应该使用默认 ChatStorage 当未提供时', () => {
      const streamChatWithoutStorage = new StreamChat(mockAIClient, mockMCPServer);
      expect(streamChatWithoutStorage.getChatStorage()).toBeInstanceOf(ChatStorage);
    });

    it('应该正确获取当前会话ID', () => {
      expect(streamChat.getCurrentSessionId()).toBeNull();
      streamChat.setCurrentSession('test-session');
      expect(streamChat.getCurrentSessionId()).toBe('test-session');
    });
  });

  describe('存储管理', () => {
    it('应该初始化聊天存储', async () => {
      await streamChat.initializeStorage();
      expect(mockChatStorage.initialize).toHaveBeenCalledTimes(1);
    });

    it('应该关闭聊天存储', async () => {
      await streamChat.closeStorage();
      expect(mockChatStorage.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('会话管理', () => {
    it('应该创建新会话', async () => {
      const sessionId = await streamChat.createSession('测试会话');
      expect(sessionId).toBe('session-123');
      expect(mockChatStorage.createSession).toHaveBeenCalledWith('测试会话');
      expect(streamChat.getCurrentSessionId()).toBe('session-123');
    });

    it('应该创建无名称的新会话', async () => {
      const sessionId = await streamChat.createSession();
      expect(sessionId).toBe('session-123');
      expect(mockChatStorage.createSession).toHaveBeenCalledWith(undefined);
    });

    it('应该加载会话历史', async () => {
      const mockHistory = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
      ] as any[];
      mockChatStorage.getConversationHistory.mockResolvedValue(mockHistory);
      
      streamChat.setCurrentSession('session-123');
      await streamChat.loadSessionHistory();
      
      expect(mockChatStorage.getConversationHistory).toHaveBeenCalledWith('session-123');
      expect(streamChat.getConversationHistory()).toHaveLength(2);
    });

    it('应该在没有会话ID时抛出错误', async () => {
      await expect(streamChat.loadSessionHistory()).rejects.toThrow('没有指定会话ID');
    });

    it('应该列出所有会话', async () => {
      const mockSessions = [{ 
        id: 'session-1', 
        name: '会话1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
        totalTokens: 0
      }];
      mockChatStorage.listSessions.mockResolvedValue(mockSessions);
      
      const sessions = await streamChat.listSessions(10);
      expect(sessions).toBe(mockSessions);
      expect(mockChatStorage.listSessions).toHaveBeenCalledWith(10);
    });

    it('应该获取会话信息', async () => {
      const mockSession = { 
        id: 'session-123', 
        name: '测试会话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
        totalTokens: 0
      };
      mockChatStorage.getSession.mockResolvedValue(mockSession);
      
      const session = await streamChat.getSessionInfo('session-123');
      expect(session).toBe(mockSession);
      expect(mockChatStorage.getSession).toHaveBeenCalledWith('session-123');
    });

    it('应该删除会话', async () => {
      streamChat.setCurrentSession('session-123');
      await streamChat.deleteSession('session-123');
      
      expect(mockChatStorage.deleteSession).toHaveBeenCalledWith('session-123');
      expect(streamChat.getCurrentSessionId()).toBeNull();
      expect(streamChat.getConversationHistory()).toHaveLength(0);
    });

    it('应该删除非当前会话而不影响当前状态', async () => {
      streamChat.setCurrentSession('session-123');
      await streamChat.deleteSession('session-456');
      
      expect(mockChatStorage.deleteSession).toHaveBeenCalledWith('session-456');
      expect(streamChat.getCurrentSessionId()).toBe('session-123');
    });
  });

  describe('基础聊天功能', () => {
    it('应该进行基础流式聊天', async () => {
      // Mock 流式响应
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: '你好' } }] };
          yield { choices: [{ delta: { content: '！' } }] };
        },
      };
      mockAIClient.chatCompletionStream.mockReturnValue(mockStream as any);
      
      const result = await streamChat.chat('你好');
      
      expect(result.content).toBe('你好！');
      expect(result.tokens).toBe(2);
      expect(mockChatStorage.saveMessage).toHaveBeenCalledTimes(2); // 用户消息 + 助手消息
      expect(streamChat.getConversationHistory()).toHaveLength(2);
    });

    it('应该在没有当前会话时自动创建会话', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: '测试' } }] };
        },
      };
      mockAIClient.chatCompletionStream.mockReturnValue(mockStream as any);
      
      await streamChat.chat('测试消息');
      
      expect(mockChatStorage.createSession).toHaveBeenCalledTimes(1);
    });

    it('应该处理聊天过程中的错误', async () => {
      const mockError = new Error('API 错误');
      mockAIClient.chatCompletionStream = jest.fn().mockImplementation(() => {
        throw mockError;
      });
      
      await expect(streamChat.chat('测试')).rejects.toThrow('API 错误');
    });
  });

  describe('带工具调用的聊天功能', () => {
    it('应该进行带工具调用的聊天', async () => {
      // Mock 工具调用响应
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            toolCalls: [{
              id: 'call-123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "北京"}',
              },
            }],
          },
        }],
      };
      mockAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      mockAIClient.executeToolCall.mockResolvedValue({ temperature: '25°C' });
      
      // Mock 最终流式响应
      const mockFinalStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: '北京今天的温度是25°C' } }] };
        },
      };
      mockAIClient.chatCompletionStream.mockReturnValue(mockFinalStream as any);
      
      const result = await streamChat.chatWithTools('北京天气如何？');
      
      expect(result.content).toBe('北京今天的温度是25°C');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0]?.name).toBe('get_weather');
      expect(mockAIClient.executeToolCall).toHaveBeenCalledWith('get_weather', { location: '北京' });
    });

    it('应该处理没有工具调用的情况', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: '这是一个普通回复',
            toolCalls: null,
          },
        }],
      };
      mockAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      
      const result = await streamChat.chatWithTools('普通问题');
      
      expect(result.content).toBe('这是一个普通回复');
      expect(result.toolCalls).toHaveLength(0);
    });

    it('应该处理空的助手响应', async () => {
      const mockResponse = {
        choices: [],
      };
      mockAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      
      await expect(streamChat.chatWithTools('测试')).rejects.toThrow('没有收到助手响应');
    });
  });

  describe('对话历史管理', () => {
    it('应该获取对话历史副本', () => {
      const history = streamChat.getConversationHistory();
      expect(Array.isArray(history)).toBe(true);
      
      // 修改返回的历史不应影响原始历史
      history.push({ role: 'user', content: '测试' });
      expect(streamChat.getConversationHistory()).toHaveLength(0);
    });

    it('应该清除对话历史', () => {
      // 先添加一些历史
      streamChat.getConversationHistory().push({ role: 'user', content: '测试' });
      streamChat.clearHistory();
      expect(streamChat.getConversationHistory()).toHaveLength(0);
    });
  });

  describe('消息格式转换', () => {
    it('应该正确转换统一格式消息', async () => {
      const messages = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！' },
      ] as any[];
      mockChatStorage.getConversationHistory.mockResolvedValue(messages);
      
      // 通过加载会话历史来测试转换
      streamChat.setCurrentSession('session-123');
      await streamChat.loadSessionHistory();
      
      const history = streamChat.getConversationHistory();
      expect(history[0]?.role).toBe('user');
      expect(history[0]?.content).toBe('你好');
    });

    it('应该正确转换带工具调用的消息', async () => {
      const messages = [
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call-123',
            type: 'function',
            function: { name: 'test_tool', arguments: '{}' },
          }],
        },
      ] as any[];
      mockChatStorage.getConversationHistory.mockResolvedValue(messages);
      
      streamChat.setCurrentSession('session-123');
      await streamChat.loadSessionHistory();
      
      const history = streamChat.getConversationHistory();
      expect(history[0]?.toolCalls).toBeDefined();
      expect(history[0]?.toolCalls?.[0]?.function.name).toBe('test_tool');
    });

    it('应该正确处理 developer 角色转换为 system', async () => {
      const messages = [
        { role: 'developer', content: '系统提示' },
      ] as any[];
      mockChatStorage.getConversationHistory.mockResolvedValue(messages);
      
      streamChat.setCurrentSession('session-123');
      await streamChat.loadSessionHistory();
      
      const history = streamChat.getConversationHistory();
      expect(history[0]?.role).toBe('system');
    });
  });

  describe('统计信息管理', () => {
    it('应该获取统计信息', () => {
      const stats = streamChat.getStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalToolCalls).toBe(0);
    });

    it('应该重置统计信息', () => {
      streamChat.resetStats();
      const stats = streamChat.getStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalToolCalls).toBe(0);
    });

    it('应该获取存储统计信息', async () => {
      const mockStats = { totalMessages: 100, totalSessions: 5 };
      mockChatStorage.getStats.mockResolvedValue(mockStats);
      
      const stats = await streamChat.getStorageStats();
      expect(stats).toBe(mockStats);
      expect(mockChatStorage.getStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('实时输出控制', () => {
    it('应该设置实时输出状态', () => {
      streamChat.setRealTimeOutput(false);
      // 由于 realTimeOutput 是私有属性，我们通过行为来测试
      // 这里主要测试方法不会抛出错误
      expect(() => streamChat.setRealTimeOutput(true)).not.toThrow();
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理空的流式响应', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: {} }] }; // 没有 content
        },
      };
      mockAIClient.chatCompletionStream.mockReturnValue(mockStream as any);
      
      const result = await streamChat.chat('测试');
      expect(result.content).toBe('');
      expect(result.tokens).toBe(0);
    });

    it('应该处理多个工具调用', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            toolCalls: [
              {
                id: 'call-1',
                type: 'function',
                function: { name: 'tool1', arguments: '{}' },
              },
              {
                id: 'call-2', 
                type: 'function',
                function: { name: 'tool2', arguments: '{}' },
              },
            ],
          },
        }],
      };
      mockAIClient.chatCompletionWithTools.mockResolvedValue(mockResponse as any);
      mockAIClient.executeToolCall.mockResolvedValue({ result: 'success' });
      
      const mockFinalStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: '完成' } }] };
        },
      };
      mockAIClient.chatCompletionStream.mockReturnValue(mockFinalStream as any);
      
      const result = await streamChat.chatWithTools('多工具测试');
      
      expect(result.toolCalls).toHaveLength(2);
      expect(mockAIClient.executeToolCall).toHaveBeenCalledTimes(2);
    });
  });
});