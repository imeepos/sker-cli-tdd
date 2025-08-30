/**
 * 🟢 TDD 绿阶段：MQ Agent 系统最小实现
 * 只写刚好让测试通过的代码
 */

import { ToolManager } from './tool-manager';
import { MCPServer } from './mcp-server';
import { MCPWorkspaceManager } from './mcp-workspace';
import { FileToolsProvider } from './file-tools';
import { CommandToolsProvider } from './command-tools';
import { FetchToolsProvider } from './fetch-tools';
import { SystemContextToolsProvider } from './system-context-tools';
import { MCPAIClient } from './mcp-ai-client';
import { UnifiedMessage } from './ai-clients/base/unified-types';
import { ConfigManager } from './config-manager';

/**
 * MQ配置接口
 */
export interface MQConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  taskQueue: string;
  resultQueue: string;
  agentId: string;
}

/**
 * 任务消息接口
 */
export interface TaskMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: string;
}

/**
 * 任务结果接口
 */
export interface TaskResult {
  id: string;
  taskId: string;
  from: string;
  to: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: string;
}

/**
 * MQ连接接口
 */
export interface MQConnection {
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  subscribe(queue: string, callback: (message: string) => void): void;
  publish(queue: string, message: string): Promise<boolean>;
  isConnected(): boolean;
}

/**
 * MQ Agent 系统
 * 负责监听MQ任务、执行工具、返回结果
 */
export class MQAgent {
  private config: MQConfig;
  private mqConnection: MQConnection | null = null;
  private toolManager!: ToolManager;
  private aiClient: MCPAIClient | null = null;
  private isListening = false;
  private configManager: ConfigManager;

  constructor(customAgentId?: string) {
    this.configManager = ConfigManager.getInstance();
    this.config = this.loadConfig(customAgentId);
    this.initializeToolManager();
  }

  /**
   * 加载MQ配置
   * 从ConfigManager获取MQ连接配置
   */
  loadConfig(customAgentId?: string): MQConfig {
    const config = this.configManager.getMQConfig();
    if (customAgentId) {
      config.agentId = customAgentId;
    }
    return config;
  }

  /**
   * 初始化工具管理器
   */
  private initializeToolManager(): void {
    const server = new MCPServer();
    const workspaceManager = new MCPWorkspaceManager();
    this.toolManager = new ToolManager(server, workspaceManager);

    // 注册所有工具提供者
    const fileToolsProvider = new FileToolsProvider();
    const commandToolsProvider = new CommandToolsProvider();
    const fetchToolsProvider = new FetchToolsProvider();
    const systemContextToolsProvider = new SystemContextToolsProvider();

    this.toolManager.registerToolProvider(fileToolsProvider);
    this.toolManager.registerToolProvider(commandToolsProvider);
    this.toolManager.registerToolProvider(fetchToolsProvider);
    this.toolManager.registerToolProvider(systemContextToolsProvider);
  }

  /**
   * 设置MQ连接（用于测试）
   */
  setMQConnection(connection: MQConnection): void {
    this.mqConnection = connection;
  }

  /**
   * 设置AI客户端
   */
  setAIClient(client: MCPAIClient): void {
    this.aiClient = client;
  }

  /**
   * 获取AI客户端
   */
  getAIClient(): MCPAIClient | null {
    return this.aiClient;
  }

  /**
   * 连接到MQ服务器
   */
  async connect(): Promise<boolean> {
    if (!this.mqConnection) {
      throw new Error('MQ connection not initialized');
    }
    return await this.mqConnection.connect();
  }

  /**
   * 断开MQ连接
   */
  async disconnect(): Promise<boolean> {
    if (!this.mqConnection) {
      return true;
    }
    return await this.mqConnection.disconnect();
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    if (!this.mqConnection) {
      return false;
    }
    return this.mqConnection.isConnected();
  }

  /**
   * 解析任务消息
   */
  parseTaskMessage(messageData: string): TaskMessage {
    try {
      const message = JSON.parse(messageData);
      return message as TaskMessage;
    } catch (error) {
      throw new Error(
        `Failed to parse task message: ${(error as Error).message}`
      );
    }
  }

  /**
   * 验证任务消息格式
   */
  validateTaskMessage(message: TaskMessage): boolean {
    return !!(
      message &&
      message.id &&
      message.from &&
      message.to &&
      message.type &&
      message.payload !== undefined &&
      message.timestamp
    );
  }

  /**
   * 执行任务
   */
  async executeTask(taskMessage: TaskMessage): Promise<TaskResult> {
    const startTime = new Date().toISOString();

    try {
      // 验证消息格式
      if (!this.validateTaskMessage(taskMessage)) {
        throw new Error('Invalid task message format');
      }

      let result: any;

      // 检查是否是AI任务
      if (taskMessage.type === 'ai_task' && this.aiClient) {
        // 使用AI处理任务
        result = await this.processAITask(taskMessage);
      } else {
        // 直接执行工具
        result = await this.toolManager.executeTool(
          taskMessage.type,
          taskMessage.payload
        );
      }

      return {
        id: `result-${Date.now()}`,
        taskId: taskMessage.id,
        from: this.config.agentId,
        to: taskMessage.from,
        success: true,
        result: result,
        timestamp: startTime,
      };
    } catch (error) {
      return {
        id: `result-${Date.now()}`,
        taskId: taskMessage.id,
        from: this.config.agentId,
        to: taskMessage.from,
        success: false,
        error: (error as Error).message,
        timestamp: startTime,
      };
    }
  }

  /**
   * 使用AI处理任务
   */
  private async processAITask(taskMessage: TaskMessage): Promise<any> {
    if (!this.aiClient) {
      throw new Error('AI客户端未设置');
    }

    const { instruction, context } = taskMessage.payload;

    // 构建AI对话消息
    const messages: UnifiedMessage[] = [
      {
        role: 'system',
        content: `你是一个智能Agent，可以调用各种工具来完成任务。
当前可用的工具包括：文件操作、命令执行、网络请求、系统信息查询等。
请根据用户的指令，智能选择合适的工具来完成任务。`,
      },
      {
        role: 'user',
        content: `任务指令：${instruction}${context ? `\n上下文：${context}` : ''}`,
      },
    ];

    // 使用AI处理对话并执行工具调用
    const response = await this.aiClient.chatCompletionWithTools(messages);
    const assistantMessage = response.choices[0]?.message;

    if (!assistantMessage) {
      throw new Error('没有收到AI响应');
    }

    let toolCallsExecuted = 0;
    const conversationMessages: UnifiedMessage[] = [...messages];

    // 添加助手消息到对话历史
    conversationMessages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      toolCalls: assistantMessage.toolCalls,
    });

    // 处理工具调用
    if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
      for (const toolCall of assistantMessage.toolCalls) {
        try {
          const toolResult = await this.aiClient.executeToolCall(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );

          // 添加工具结果到对话历史
          conversationMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            toolCallId: toolCall.id,
          });

          toolCallsExecuted++;
        } catch (error) {
          // 添加工具执行错误到对话历史
          conversationMessages.push({
            role: 'tool',
            content: JSON.stringify({ error: (error as Error).message }),
            toolCallId: toolCall.id,
          });
        }
      }

      // 如果有工具调用，获取最终响应
      if (toolCallsExecuted > 0) {
        const finalResponse =
          await this.aiClient.chatCompletion(conversationMessages);
        const finalMessage = finalResponse.choices[0]?.message;

        if (finalMessage) {
          conversationMessages.push({
            role: 'assistant',
            content: finalMessage.content || '',
          });
        }

        return {
          aiResponse:
            finalMessage?.content || assistantMessage.content || 'AI处理完成',
          toolCallsExecuted,
          conversationMessages,
        };
      }
    }

    return {
      aiResponse: assistantMessage.content || 'AI处理完成',
      toolCallsExecuted,
      conversationMessages,
    };
  }

  /**
   * 发送任务结果
   */
  async sendResult(taskResult: TaskResult): Promise<boolean> {
    if (!this.mqConnection) {
      return false;
    }

    try {
      const messageData = JSON.stringify(taskResult);
      return await this.mqConnection.publish(
        this.config.resultQueue,
        messageData
      );
    } catch (error) {
      // 在测试环境下不输出错误，避免测试噪音
      if (!this.configManager.isTestEnvironment()) {
        console.error('Failed to send result:', error);
      }
      return false;
    }
  }

  /**
   * 开始监听任务队列
   */
  async startListening(): Promise<boolean> {
    if (!this.mqConnection) {
      return false;
    }

    try {
      this.mqConnection.subscribe(
        this.config.taskQueue,
        async (messageData: string) => {
          try {
            const taskMessage = this.parseTaskMessage(messageData);
            await this.processTask(taskMessage);
          } catch (error) {
            console.error('Failed to process task:', error);
          }
        }
      );

      this.isListening = true;
      return true;
    } catch (error) {
      console.error('Failed to start listening:', error);
      return false;
    }
  }

  /**
   * 停止监听任务队列
   */
  async stopListening(): Promise<boolean> {
    this.isListening = false;
    return true;
  }

  /**
   * 处理单个任务（完整流程）
   */
  async processTask(taskMessage: TaskMessage): Promise<boolean> {
    try {
      // 执行任务
      const result = await this.executeTask(taskMessage);

      // 发送结果
      const sent = await this.sendResult(result);

      return sent;
    } catch (error) {
      console.error('Failed to process task:', error);
      return false;
    }
  }

  /**
   * 获取Agent状态
   */
  getStatus(): {
    agentId: string;
    isConnected: boolean;
    isListening: boolean;
    config: MQConfig;
  } {
    return {
      agentId: this.config.agentId,
      isConnected: this.isConnected(),
      isListening: this.isListening,
      config: this.config,
    };
  }
}
