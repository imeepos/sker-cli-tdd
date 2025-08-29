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
  private isListening = false;

  constructor() {
    this.config = this.loadConfig();
    this.initializeToolManager();
  }

  /**
   * 从环境变量加载MQ配置
   */
  loadConfig(): MQConfig {
    // 优先使用 MQ_URL，如果没有则使用分离的配置
    const mqUrl = process.env['MQ_URL'];
    let host = 'localhost';
    let port = 5672;
    let username = 'guest';
    let password = 'guest';

    if (mqUrl) {
      // 解析 MQ_URL (格式: amqp://username:password@host:port)
      try {
        const url = new URL(mqUrl);
        host = url.hostname;
        port = parseInt(url.port) || 5672;
        username = url.username || 'guest';
        password = url.password || 'guest';
      } catch (error) {
        console.warn('Invalid MQ_URL format, using default values');
      }
    } else {
      // 使用分离的环境变量
      host = process.env['MQ_HOST'] || 'localhost';
      port = parseInt(process.env['MQ_PORT'] || '5672');
      username = process.env['MQ_USERNAME'] || 'guest';
      password = process.env['MQ_PASSWORD'] || 'guest';
    }

    const finalUrl = mqUrl || `amqp://${username}:${password}@${host}:${port}`;

    return {
      url: finalUrl,
      host,
      port,
      username,
      password,
      taskQueue: process.env['MQ_TASK_QUEUE'] || 'task_queue',
      resultQueue: process.env['MQ_RESULT_QUEUE'] || 'result_queue',
      agentId: process.env['AGENT_ID'] || `agent-${Date.now()}`
    };
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
      throw new Error(`Failed to parse task message: ${(error as Error).message}`);
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

      // 执行工具
      const toolResult = await this.toolManager.executeTool(taskMessage.type, taskMessage.payload);
      
      return {
        id: `result-${Date.now()}`,
        taskId: taskMessage.id,
        from: this.config.agentId,
        to: taskMessage.from,
        success: true,
        result: toolResult,
        timestamp: startTime
      };
    } catch (error) {
      return {
        id: `result-${Date.now()}`,
        taskId: taskMessage.id,
        from: this.config.agentId,
        to: taskMessage.from,
        success: false,
        error: (error as Error).message,
        timestamp: startTime
      };
    }
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
      return await this.mqConnection.publish(this.config.resultQueue, messageData);
    } catch (error) {
      console.error('Failed to send result:', error);
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
      this.mqConnection.subscribe(this.config.taskQueue, async (messageData: string) => {
        try {
          const taskMessage = this.parseTaskMessage(messageData);
          await this.processTask(taskMessage);
        } catch (error) {
          console.error('Failed to process task:', error);
        }
      });
      
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
      config: this.config
    };
  }
}
