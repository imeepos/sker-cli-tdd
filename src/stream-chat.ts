/**
 * 🟢 TDD 绿阶段：流式聊天功能实现
 * 实现流式输出和实时聊天功能
 */

import { MCPAIClient } from './mcp-ai-client';
import { MCPServer } from './mcp-server';
import { UnifiedMessage } from './ai-clients/base/unified-types';
import { ChatStorage } from './chat-storage';

/**
 * 聊天结果接口
 */
export interface ChatResult {
  content: string;
  tokens: number;
  toolCalls?: ToolCallInfo[];
}

/**
 * 工具调用信息接口
 */
export interface ToolCallInfo {
  name: string;
  arguments: any;
  result: any;
}

/**
 * 统计信息接口
 */
export interface ChatStats {
  totalMessages: number;
  totalTokens: number;
  totalToolCalls: number;
}

/**
 * 流式聊天类
 */
export class StreamChat {
  private aiClient: MCPAIClient;
  private mcpServer: MCPServer;
  private conversationHistory: UnifiedMessage[] = [];
  private realTimeOutput: boolean = true;
  private chatStorage: ChatStorage;
  private currentSessionId: string | null = null;
  private stats: ChatStats = {
    totalMessages: 0,
    totalTokens: 0,
    totalToolCalls: 0
  };

  constructor(aiClient: MCPAIClient, mcpServer: MCPServer, chatStorage?: ChatStorage) {
    this.aiClient = aiClient;
    this.mcpServer = mcpServer;
    this.chatStorage = chatStorage || new ChatStorage();
  }

  /**
   * 获取 AI 客户端
   */
  getAIClient(): MCPAIClient {
    return this.aiClient;
  }

  /**
   * 获取 OpenAI 客户端 (向后兼容)
   */
  getOpenAIClient(): MCPAIClient {
    return this.aiClient;
  }

  /**
   * 获取 MCP 服务器
   */
  getMCPServer(): MCPServer {
    return this.mcpServer;
  }

  /**
   * 获取聊天存储实例
   */
  getChatStorage(): ChatStorage {
    return this.chatStorage;
  }

  /**
   * 初始化聊天存储
   */
  async initializeStorage(): Promise<void> {
    await this.chatStorage.initialize();
  }

  /**
   * 关闭聊天存储
   */
  async closeStorage(): Promise<void> {
    await this.chatStorage.close();
  }

  /**
   * 创建新会话
   */
  async createSession(name?: string): Promise<string> {
    const sessionId = await this.chatStorage.createSession(name);
    this.currentSessionId = sessionId;
    return sessionId;
  }

  /**
   * 设置当前会话
   */
  setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * 获取当前会话ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 从存储中加载会话历史
   */
  async loadSessionHistory(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) {
      throw new Error('没有指定会话ID');
    }

    const history = await this.chatStorage.getConversationHistory(targetSessionId);
    this.conversationHistory = this.convertToUnifiedMessages(history);
    this.currentSessionId = targetSessionId;
  }

  /**
   * 基础流式聊天
   */
  async chat(message: string): Promise<ChatResult> {
    // 确保有当前会话
    if (!this.currentSessionId) {
      this.currentSessionId = await this.chatStorage.createSession();
    }

    const userMessage: UnifiedMessage = {
      role: 'user',
      content: message
    };

    // 添加到对话历史
    this.conversationHistory.push(userMessage);
    this.stats.totalMessages++;

    // 保存用户消息到数据库
    await this.chatStorage.saveMessage('user', message, this.currentSessionId);

    try {
      const stream = this.aiClient.chatCompletionStream([...this.conversationHistory]);
      
      let fullContent = '';
      let tokenCount = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullContent += content;
          tokenCount++;
          
          // 实时输出
          if (this.realTimeOutput) {
            process.stdout.write(content);
          }
        }
      }

      // 添加助手响应到对话历史
      const assistantMessage: UnifiedMessage = {
        role: 'assistant',
        content: fullContent
      };
      this.conversationHistory.push(assistantMessage);
      this.stats.totalMessages++;
      this.stats.totalTokens += tokenCount;

      // 保存助手消息到数据库
      await this.chatStorage.saveMessage('assistant', fullContent, this.currentSessionId, {
        tokens: tokenCount
      });

      return {
        content: fullContent,
        tokens: tokenCount
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 带工具调用的流式聊天
   */
  async chatWithTools(message: string): Promise<ChatResult> {
    // 确保有当前会话
    if (!this.currentSessionId) {
      this.currentSessionId = await this.chatStorage.createSession();
    }

    const userMessage: UnifiedMessage = {
      role: 'user',
      content: message
    };

    // 添加到对话历史
    this.conversationHistory.push(userMessage);
    this.stats.totalMessages++;

    // 保存用户消息到数据库
    await this.chatStorage.saveMessage('user', message, this.currentSessionId);

    try {
      // 首先进行带工具调用的聊天完成
      const response = await this.aiClient.chatCompletionWithTools([...this.conversationHistory]);
      const assistantMessage = response.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error('没有收到助手响应');
      }

      // 添加助手消息到对话历史
      this.conversationHistory.push(assistantMessage);
      this.stats.totalMessages++;

      const toolCalls: ToolCallInfo[] = [];

      // 处理工具调用
      if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
        for (const toolCall of assistantMessage.toolCalls) {
          const toolResult = await this.aiClient.executeToolCall(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );

          // 添加工具结果到对话历史
          const toolResultMessage: UnifiedMessage = {
            role: 'tool',
            content: JSON.stringify(toolResult),
            toolCallId: toolCall.id
          };
          this.conversationHistory.push(toolResultMessage);
          this.stats.totalToolCalls++;

          if (toolCall.type === 'function') {
            toolCalls.push({
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments),
              result: toolResult
            });
          }
        }

        // 获取最终的流式响应
        const finalStream = this.aiClient.chatCompletionStream([...this.conversationHistory]);
        
        let finalContent = '';
        let tokenCount = 0;

        for await (const chunk of finalStream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            finalContent += content;
            tokenCount++;
            
            if (this.realTimeOutput) {
              process.stdout.write(content);
            }
          }
        }

        // 添加最终响应到对话历史
        const finalMessage: UnifiedMessage = {
          role: 'assistant',
          content: finalContent
        };
        this.conversationHistory.push(finalMessage);
        this.stats.totalMessages++;
        this.stats.totalTokens += tokenCount;

        // 保存最终助手消息到数据库
        await this.chatStorage.saveMessage('assistant', finalContent, this.currentSessionId, {
          tokens: tokenCount,
          toolCalls
        });

        return {
          content: finalContent,
          tokens: tokenCount,
          toolCalls
        };
      } else {
        // 没有工具调用，直接返回助手消息
        const content = assistantMessage.content || '';
        this.stats.totalTokens += content.length;

        // 显示助手回复
        if (this.realTimeOutput && content) {
          process.stdout.write(content);
        }

        // 保存助手消息到数据库
        await this.chatStorage.saveMessage('assistant', content, this.currentSessionId, {
          tokens: content.length
        });

        return {
          content,
          tokens: content.length,
          toolCalls
        };
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(): UnifiedMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 转换消息格式为统一格式
   */
  private convertToUnifiedMessages(messages: any[]): UnifiedMessage[] {
    return messages.map(msg => {
      // 如果已经是统一格式，直接返回
      if (msg.role && msg.content && !msg.tool_calls && !msg.tool_call_id) {
        return msg as UnifiedMessage;
      }

      // 转换OpenAI格式到统一格式
      const unifiedMsg: UnifiedMessage = {
        role: msg.role === 'developer' ? 'system' : msg.role,
        content: msg.content || '',
      };

      // 处理工具调用
      if (msg.tool_calls) {
        unifiedMsg.toolCalls = msg.tool_calls.map((call: any) => ({
          id: call.id,
          type: call.type,
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        }));
      }

      // 处理工具调用ID
      if (msg.tool_call_id) {
        unifiedMsg.toolCallId = msg.tool_call_id;
      }

      return unifiedMsg;
    });
  }

  /**
   * 清除对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * 列出所有会话
   */
  async listSessions(limit?: number): Promise<any[]> {
    return await this.chatStorage.listSessions(limit);
  }

  /**
   * 获取会话信息
   */
  async getSessionInfo(sessionId: string): Promise<any> {
    return await this.chatStorage.getSession(sessionId);
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.chatStorage.deleteSession(sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
      this.conversationHistory = [];
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStorageStats(): Promise<any> {
    return await this.chatStorage.getStats();
  }

  /**
   * 设置实时输出
   */
  setRealTimeOutput(enabled: boolean): void {
    this.realTimeOutput = enabled;
  }

  /**
   * 获取统计信息
   */
  getStats(): ChatStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalMessages: 0,
      totalTokens: 0,
      totalToolCalls: 0
    };
  }
}
