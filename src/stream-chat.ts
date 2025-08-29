/**
 * 🟢 TDD 绿阶段：流式聊天功能实现
 * 实现流式输出和实时聊天功能
 */

import { MCPOpenAIClient } from './mcp-openai';
import { MCPServer } from './mcp-server';
import { OpenAI } from 'openai';

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
  private openaiClient: MCPOpenAIClient;
  private mcpServer: MCPServer;
  private conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  private realTimeOutput: boolean = true;
  private stats: ChatStats = {
    totalMessages: 0,
    totalTokens: 0,
    totalToolCalls: 0
  };

  constructor(openaiClient: MCPOpenAIClient, mcpServer: MCPServer) {
    this.openaiClient = openaiClient;
    this.mcpServer = mcpServer;
  }

  /**
   * 获取 OpenAI 客户端
   */
  getOpenAIClient(): MCPOpenAIClient {
    return this.openaiClient;
  }

  /**
   * 获取 MCP 服务器
   */
  getMCPServer(): MCPServer {
    return this.mcpServer;
  }

  /**
   * 基础流式聊天
   */
  async chat(message: string): Promise<ChatResult> {
    const userMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: 'user',
      content: message
    };

    // 添加到对话历史
    this.conversationHistory.push(userMessage);
    this.stats.totalMessages++;

    try {
      const stream = await this.openaiClient.chatCompletionStream([...this.conversationHistory]);
      
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
      const assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
        role: 'assistant',
        content: fullContent
      };
      this.conversationHistory.push(assistantMessage);
      this.stats.totalMessages++;
      this.stats.totalTokens += tokenCount;

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
    const userMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: 'user',
      content: message
    };

    // 添加到对话历史
    this.conversationHistory.push(userMessage);
    this.stats.totalMessages++;

    try {
      // 首先进行带工具调用的聊天完成
      const response = await this.openaiClient.chatCompletionWithTools([...this.conversationHistory]);
      const assistantMessage = response.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error('没有收到助手响应');
      }

      // 添加助手消息到对话历史
      this.conversationHistory.push(assistantMessage);
      this.stats.totalMessages++;

      const toolCalls: ToolCallInfo[] = [];

      // 处理工具调用
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolResult = await this.openaiClient.executeToolCall(toolCall);
          this.conversationHistory.push(toolResult);
          this.stats.totalToolCalls++;

          if (toolCall.type === 'function') {
            toolCalls.push({
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments),
              result: JSON.parse(toolResult.content)
            });
          }
        }

        // 获取最终的流式响应
        const finalStream = await this.openaiClient.chatCompletionStream([...this.conversationHistory]);
        
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
        const finalMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
          role: 'assistant',
          content: finalContent
        };
        this.conversationHistory.push(finalMessage);
        this.stats.totalMessages++;
        this.stats.totalTokens += tokenCount;

        return {
          content: finalContent,
          tokens: tokenCount,
          toolCalls
        };
      } else {
        // 没有工具调用，直接返回助手消息
        const content = assistantMessage.content || '';
        this.stats.totalTokens += content.length;

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
  getConversationHistory(): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return [...this.conversationHistory];
  }

  /**
   * 清除对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
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
