/**
 * 🔴 TDD 红阶段：聊天存储功能测试
 * 测试 LevelDB 聊天记录存储功能
 */

import { ChatStorage } from './chat-storage';
import { OpenAI } from 'openai';
import path from 'path';
import fs from 'fs/promises';

describe('ChatStorage', () => {
  let chatStorage: ChatStorage;
  let testDbPath: string;

  beforeEach(async () => {
    // 创建临时测试数据库路径
    testDbPath = path.join(__dirname, '..', 'test-db', `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
    chatStorage = new ChatStorage({ dbPath: testDbPath });
    await chatStorage.initialize();
  });

  afterEach(async () => {
    // 关闭数据库连接
    await chatStorage.close();
    
    // 清理测试数据库文件
    try {
      await fs.rm(testDbPath, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('初始化和关闭', () => {
    it('应该能够初始化数据库', async () => {
      // 数据库已在 beforeEach 中初始化，测试不会抛出错误
      expect(chatStorage).toBeDefined();
    });

    it('应该能够关闭数据库连接', async () => {
      await expect(chatStorage.close()).resolves.not.toThrow();
    });
  });

  describe('会话管理', () => {
    it('应该能够创建新会话', async () => {
      const sessionId = await chatStorage.createSession('测试会话');
      
      expect(sessionId).toMatch(/^session_\d+_\w+$/);
      
      const session = await chatStorage.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.name).toBe('测试会话');
      expect(session?.messageCount).toBe(0);
      expect(session?.totalTokens).toBe(0);
    });

    it('应该能够创建默认名称的会话', async () => {
      const sessionId = await chatStorage.createSession();
      
      const session = await chatStorage.getSession(sessionId);
      expect(session?.name).toMatch(/^对话 \d+/);
    });

    it('应该能够获取不存在的会话返回null', async () => {
      const session = await chatStorage.getSession('不存在的会话ID');
      expect(session).toBe(null);
    });

    it('应该能够列出所有会话', async () => {
      await chatStorage.createSession('会话1');
      await chatStorage.createSession('会话2');

      const sessions = await chatStorage.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.name)).toContain('会话1');
      expect(sessions.map(s => s.name)).toContain('会话2');
    });

    it('应该能够删除会话', async () => {
      const sessionId = await chatStorage.createSession('待删除会话');
      
      await chatStorage.deleteSession(sessionId);
      
      const session = await chatStorage.getSession(sessionId);
      expect(session).toBe(null);
    });
  });

  describe('消息存储', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await chatStorage.createSession('测试会话');
    });

    it('应该能够保存用户消息', async () => {
      const messageId = await chatStorage.saveMessage(
        'user',
        'Hello, world!',
        sessionId,
        { tokens: 3 }
      );

      expect(messageId).toMatch(/^msg_\d+_\w+$/);

      const message = await chatStorage.getMessage(messageId);
      expect(message).toBeDefined();
      expect(message?.role).toBe('user');
      expect(message?.content).toBe('Hello, world!');
      expect(message?.sessionId).toBe(sessionId);
      expect(message?.metadata?.tokens).toBe(3);
    });

    it('应该能够保存助手消息', async () => {
      const messageId = await chatStorage.saveMessage(
        'assistant',
        'Hello! How can I help you?',
        sessionId,
        { tokens: 7, model: 'gpt-3.5-turbo' }
      );

      const message = await chatStorage.getMessage(messageId);
      expect(message?.role).toBe('assistant');
      expect(message?.metadata?.model).toBe('gpt-3.5-turbo');
    });

    it('应该能够更新会话统计信息', async () => {
      await chatStorage.saveMessage('user', 'Hello', sessionId, { tokens: 3 });
      await chatStorage.saveMessage('assistant', 'Hi there!', sessionId, { tokens: 5 });

      const session = await chatStorage.getSession(sessionId);
      expect(session?.messageCount).toBe(2);
      expect(session?.totalTokens).toBe(8);
    });

    it('应该能够获取不存在的消息返回null', async () => {
      const message = await chatStorage.getMessage('不存在的消息ID');
      expect(message).toBe(null);
    });

    it('应该能够删除消息', async () => {
      const messageId = await chatStorage.saveMessage('user', 'Test message', sessionId);
      
      await chatStorage.deleteMessage(messageId);
      
      const message = await chatStorage.getMessage(messageId);
      expect(message).toBe(null);
    });
  });

  describe('对话历史管理', () => {
    let sessionId: string;

    beforeEach(async () => {
      await chatStorage.clear(); // 清空数据库
      sessionId = await chatStorage.createSession('历史测试会话');
    });

    it('应该能够保存OpenAI对话历史', async () => {
      const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'What is TypeScript?' },
        { role: 'assistant', content: 'TypeScript is a superset of JavaScript...' },
        { role: 'user', content: 'Give me an example' }
      ];

      // 逐个保存消息，确保时间戳顺序
      for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        if (msg) {
          await chatStorage.saveMessage(
            msg.role as 'user' | 'assistant' | 'system',
            typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            sessionId
          );
          if (i < history.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10)); // 10ms 延迟确保时间戳不同
          }
        }
      }

      const messages = await chatStorage.getSessionMessages(sessionId);
      expect(messages).toHaveLength(3);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('What is TypeScript?');
      expect(messages[1]?.role).toBe('assistant');
      expect(messages[2]?.role).toBe('user');
      expect(messages[2]?.content).toBe('Give me an example');
    });

    it('应该能够获取会话的对话历史', async () => {
      await chatStorage.saveMessage('user', 'Hello', sessionId);
      await chatStorage.saveMessage('assistant', 'Hi!', sessionId);

      const history = await chatStorage.getConversationHistory(sessionId);
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'Hi!' });
    });

    it('应该能够获取会话的所有消息', async () => {
      await chatStorage.saveMessage('user', '消息1', sessionId);
      await new Promise(resolve => setTimeout(resolve, 10));
      await chatStorage.saveMessage('assistant', '消息2', sessionId);
      await new Promise(resolve => setTimeout(resolve, 10));
      await chatStorage.saveMessage('user', '消息3', sessionId);

      const messages = await chatStorage.getSessionMessages(sessionId);
      expect(messages).toHaveLength(3);
      expect(messages[0]?.content).toBe('消息1');
      expect(messages[1]?.content).toBe('消息2');
      expect(messages[2]?.content).toBe('消息3');
    });
  });

  describe('消息查询', () => {
    let sessionId1: string;
    let sessionId2: string;

    beforeEach(async () => {
      await chatStorage.clear(); // 清空数据库
      sessionId1 = await chatStorage.createSession('会话1');
      sessionId2 = await chatStorage.createSession('会话2');

      // 添加测试数据
      await chatStorage.saveMessage('user', '会话1用户消息', sessionId1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await chatStorage.saveMessage('assistant', '会话1助手消息', sessionId1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await chatStorage.saveMessage('user', '会话2用户消息', sessionId2);
    });

    it('应该能够按会话ID查询消息', async () => {
      const messages = await chatStorage.queryMessages({ sessionId: sessionId1 });
      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe('会话1用户消息');
      expect(messages[1]?.content).toBe('会话1助手消息');
    });

    it('应该能够按角色查询消息', async () => {
      const userMessages = await chatStorage.queryMessages({ role: 'user' });
      expect(userMessages).toHaveLength(2);
      expect(userMessages.every(msg => msg.role === 'user')).toBe(true);
    });

    it('应该能够限制查询结果数量', async () => {
      const messages = await chatStorage.queryMessages({ limit: 2 });
      expect(messages.length).toBeLessThanOrEqual(2);
    });

    it('应该能够使用偏移量查询', async () => {
      const allMessages = await chatStorage.queryMessages();
      const offsetMessages = await chatStorage.queryMessages({ offset: 1, limit: 1 });
      
      expect(offsetMessages).toHaveLength(1);
      expect(offsetMessages[0]?.id).toBe(allMessages[1]?.id);
    });
  });

  describe('数据库统计', () => {
    it('应该能够获取数据库统计信息', async () => {
      const sessionId = await chatStorage.createSession('统计测试会话');
      await chatStorage.saveMessage('user', 'Test', sessionId);

      const stats = await chatStorage.getChatStats();
      expect(stats.totalMessages).toBeGreaterThanOrEqual(1);
      expect(stats.totalSessions).toBeGreaterThanOrEqual(1);

      // 测试原始getStats方法
      const rawStats = await chatStorage.getStats();
      expect(rawStats['messages']).toBeGreaterThanOrEqual(1);
      expect(rawStats['sessions']).toBeGreaterThanOrEqual(1);
    });

    it('应该能够清空所有数据', async () => {
      const sessionId = await chatStorage.createSession('待清空会话');
      await chatStorage.saveMessage('user', 'Test message', sessionId);

      await chatStorage.clear();

      const stats = await chatStorage.getChatStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalSessions).toBe(0);
    });
  });
});