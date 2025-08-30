/**
 * 聊天记录存储功能
 * 基于通用数据库服务实现聊天记录的存储和检索
 */

import { DatabaseService, DatabaseConfig } from './database-service';
import { OpenAI } from 'openai';

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  id: string;
  timestamp: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  sessionId: string;
  metadata?: {
    tokens?: number;
    toolCalls?: any[];
    model?: string;
  };
}

/**
 * 聊天会话接口
 */
export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens: number;
}

/**
 * 查询选项接口
 */
export interface QueryOptions {
  sessionId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
  role?: string;
}

/**
 * 聊天存储类
 * 继承通用数据库服务，专门处理聊天记录相关操作
 */
export class ChatStorage extends DatabaseService {
  private messagesDb: any;
  private sessionsDb: any;

  constructor(config: DatabaseConfig = {}) {
    // 设置默认路径和子级数据库
    const chatConfig = {
      ...config,
      dbPath:
        config.dbPath ||
        require('path').join(require('os').homedir(), '.sker-ai', 'chat-db'),
      sublevels: ['messages', 'sessions'],
    };

    super(chatConfig);

    this.messagesDb = this.getSublevel('messages');
    this.sessionsDb = this.getSublevel('sessions');
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return this.generateId('msg');
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return this.generateId('session');
  }

  /**
   * 创建新会话
   */
  async createSession(name?: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: ChatSession = {
      id: sessionId,
      name: name || `对话 ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      totalTokens: 0,
    };

    await this.sessionsDb.put(sessionId, session);
    return sessionId;
  }

  /**
   * 保存消息
   */
  async saveMessage(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    sessionId: string,
    metadata?: ChatMessage['metadata']
  ): Promise<string> {
    const messageId = this.generateMessageId();
    const message: ChatMessage = {
      id: messageId,
      timestamp: Date.now(),
      role,
      content,
      sessionId,
      metadata,
    };

    // 保存消息
    await this.messagesDb.put(messageId, message);

    // 更新会话统计
    try {
      const session = await this.sessionsDb.get(sessionId);
      session.messageCount++;
      session.totalTokens += metadata?.tokens || 0;
      session.updatedAt = Date.now();
      await this.sessionsDb.put(sessionId, session);
    } catch (error) {
      // 如果会话不存在，创建一个新会话
      await this.createSession();
    }

    return messageId;
  }

  /**
   * 保存对话历史
   */
  async saveConversationHistory(
    history: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    sessionId: string
  ): Promise<void> {
    for (const message of history) {
      await this.saveMessage(
        message.role as 'user' | 'assistant' | 'system',
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
        sessionId
      );
    }
  }

  /**
   * 获取消息
   */
  async getMessage(messageId: string): Promise<ChatMessage | null> {
    try {
      const result = await this.messagesDb.get(messageId);
      return result || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取会话信息
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const result = await this.sessionsDb.get(sessionId);
      return result || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 查询消息
   */
  async queryMessages(options: QueryOptions = {}): Promise<ChatMessage[]> {
    const {
      sessionId,
      startTime,
      endTime,
      limit = 100,
      offset = 0,
      role,
    } = options;

    // 先获取所有消息并按时间戳排序，然后应用过滤条件
    const allMessages: ChatMessage[] = [];
    for await (const [, message] of this.messagesDb.iterator()) {
      allMessages.push(message);
    }

    // 按时间戳排序
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    // 应用过滤条件
    const filteredMessages = allMessages.filter(message => {
      if (sessionId && message.sessionId !== sessionId) return false;
      if (startTime && message.timestamp < startTime) return false;
      if (endTime && message.timestamp > endTime) return false;
      if (role && message.role !== role) return false;
      return true;
    });

    // 应用 offset 和 limit
    const startIndex = offset;
    const endIndex = startIndex + limit;
    return filteredMessages.slice(startIndex, endIndex);
  }

  /**
   * 获取会话的所有消息
   */
  async getSessionMessages(
    sessionId: string,
    limit?: number
  ): Promise<ChatMessage[]> {
    return this.queryMessages({ sessionId, limit });
  }

  /**
   * 获取对话历史（转换为 OpenAI 格式）
   */
  async getConversationHistory(
    sessionId: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const messages = await this.getSessionMessages(sessionId);

    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: msg.role,
          content: msg.content,
          tool_call_id: 'default_tool_call_id',
        };
      }
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
    });
  }

  /**
   * 列出所有会话
   */
  async listSessions(limit: number = 50): Promise<ChatSession[]> {
    const sessions: ChatSession[] = [];
    let count = 0;

    for await (const [, session] of this.sessionsDb.iterator()) {
      sessions.push(session);
      count++;
      if (count >= limit) break;
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 删除消息
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.messagesDb.del(messageId);
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    // 删除会话中的所有消息
    const messages = await this.getSessionMessages(sessionId);
    for (const message of messages) {
      await this.deleteMessage(message.id);
    }

    // 删除会话记录
    await this.sessionsDb.del(sessionId);
  }

  /**
   * 清空所有聊天数据
   */
  async clear(): Promise<void> {
    await this.clearAll();
  }

  /**
   * 获取聊天数据统计信息
   */
  async getChatStats(): Promise<{
    totalMessages: number;
    totalSessions: number;
  }> {
    const stats = await this.getStats();
    return {
      totalMessages: stats['messages'] || 0,
      totalSessions: stats['sessions'] || 0,
    };
  }
}
