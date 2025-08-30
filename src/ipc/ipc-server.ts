/**
 * 🟢 TDD 绿阶段：IPC 服务器实现
 * 实现基于Unix Socket/Named Pipe的IPC服务器，支持多客户端连接管理
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { IPCMessage, validateMessage, deserializeMessage, serializeMessage, createRequest } from './ipc-protocol';

/**
 * IPC服务器配置接口
 */
export interface IPCServerConfig {
  /** Socket文件路径 */
  socketPath?: string;
  /** 最大客户端连接数 */
  maxClients?: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout?: number;
  /** 是否启用心跳检测 */
  enableHeartbeat?: boolean;
  /** 心跳间隔时间（毫秒） */
  heartbeatInterval?: number;
  /** 最大消息大小（字节） */
  maxMessageSize?: number;
}

/**
 * 客户端连接信息接口
 */
export interface ClientConnection {
  /** 客户端唯一标识符 */
  id: string;
  /** 连接socket */
  socket: net.Socket;
  /** 连接建立时间 */
  connectedAt: Date;
  /** 最后活跃时间 */
  lastActiveAt: Date;
  /** 是否已认证 */
  authenticated: boolean;
  /** 客户端信息 */
  clientInfo?: Record<string, any>;
}

/**
 * 服务器统计信息接口
 */
export interface IPCServerStats {
  /** 服务器启动时间 */
  startTime: Date | null;
  /** 总连接数 */
  totalConnections: number;
  /** 当前活跃客户端数 */
  activeClients: number;
  /** 总消息数 */
  totalMessages: number;
  /** 错误数量 */
  errorCount: number;
  /** 心跳发送次数 */
  heartbeatsSent: number;
}

/**
 * IPC 服务器类
 * 
 * 实现基于Unix Socket/Named Pipe的IPC通信服务器，支持：
 * - 多客户端连接管理
 * - 消息路由和处理
 * - 心跳检测和超时处理
 * - 错误恢复和资源清理
 */
export class IPCServer extends EventEmitter {
  /** 服务器配置 */
  private config: Required<IPCServerConfig>;
  
  /** Node.js服务器实例 */
  private server: net.Server | null = null;
  
  /** 服务器运行状态 */
  private running: boolean = false;
  
  /** 客户端连接映射 */
  private clients: Map<string, ClientConnection> = new Map();
  
  /** 心跳定时器 */
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  /** 统计信息 */
  private stats: IPCServerStats = {
    startTime: null,
    totalConnections: 0,
    activeClients: 0,
    totalMessages: 0,
    errorCount: 0,
    heartbeatsSent: 0
  };

  /**
   * 构造函数
   * 
   * @param config 服务器配置
   */
  constructor(config: IPCServerConfig = {}) {
    super();

    // 验证配置参数
    if (config.maxClients !== undefined && config.maxClients <= 0) {
      throw new Error('最大客户端数量必须大于0');
    }
    
    if (config.connectionTimeout !== undefined && config.connectionTimeout <= 0) {
      throw new Error('连接超时时间必须大于0');
    }

    this.config = {
      socketPath: config.socketPath || this.getDefaultSocketPath(),
      maxClients: config.maxClients ?? 100,
      connectionTimeout: config.connectionTimeout ?? 30000,
      enableHeartbeat: config.enableHeartbeat ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 10000,
      maxMessageSize: config.maxMessageSize ?? 10 * 1024 * 1024 // 10MB
    };
  }

  /**
   * 获取默认socket路径
   * 
   * @returns 默认socket路径
   * @private
   */
  private getDefaultSocketPath(): string {
    if (process.platform === 'win32') {
      // Windows下使用Named Pipe
      return `\\\\.\\pipe\\sker-daemon-${process.pid}`;
    } else {
      // Unix系统使用Unix Socket
      const tmpDir = os.tmpdir();
      return path.join(tmpDir, `sker-daemon-${process.pid}.sock`);
    }
  }

  /**
   * 检查服务器是否正在运行
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * 获取服务器配置
   */
  getConfig(): Required<IPCServerConfig> {
    return { ...this.config };
  }

  /**
   * 获取当前客户端连接数量
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 启动IPC服务器
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('服务器已经在运行');
    }

    return new Promise((resolve, reject) => {
      try {
        // 清理可能存在的遗留socket文件
        this.cleanupSocketFile();

        this.server = net.createServer();
        
        this.server.on('connection', (socket) => {
          this.handleNewConnection(socket);
        });

        this.server.on('error', (error) => {
          this.handleServerError(error);
          reject(error);
        });

        this.server.listen(this.config.socketPath, () => {
          this.running = true;
          this.stats.startTime = new Date();
          
          // 启动心跳检测
          if (this.config.enableHeartbeat) {
            this.startHeartbeat();
          }
          
          this.emit('server-started', this.config.socketPath);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 停止IPC服务器
   */
  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      // 停止心跳检测
      this.stopHeartbeat();
      
      // 关闭所有客户端连接
      for (const [clientId] of this.clients) {
        this.disconnectClient(clientId, '服务器关闭');
      }

      this.server!.close(() => {
        this.running = false;
        this.server = null;
        
        // 清理socket文件
        this.cleanupSocketFile();
        
        this.emit('server-stopped');
        resolve();
      });
    });
  }

  /**
   * 向指定客户端发送消息
   * 
   * @param clientId 客户端ID
   * @param message 消息对象
   */
  async sendToClient(clientId: string, message: IPCMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`客户端 ${clientId} 不存在`);
    }

    try {
      const serialized = serializeMessage(message);
      const messageData = serialized + '\n';
      
      client.socket.write(messageData);
      client.lastActiveAt = new Date();
    } catch (error) {
      this.handleClientError(clientId, error as Error);
      throw error;
    }
  }

  /**
   * 向所有客户端广播消息
   * 
   * @param message 消息对象
   */
  async broadcastToAll(message: IPCMessage): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const clientId of this.clients.keys()) {
      promises.push(
        this.sendToClient(clientId, message).catch((error) => {
          // 忽略单个客户端的发送错误，继续广播给其他客户端
          this.emit('broadcast-error', clientId, error);
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * 获取服务器统计信息
   */
  getStats(): IPCServerStats {
    this.stats.activeClients = this.clients.size;
    return { ...this.stats };
  }

  /**
   * 获取客户端连接信息
   * 
   * @param clientId 客户端ID
   */
  getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  /**
   * 获取所有客户端连接信息
   */
  getAllClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  /**
   * 断开指定客户端连接
   * 
   * @param clientId 客户端ID
   * @param reason 断开原因
   */
  disconnectClient(clientId: string, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    client.socket.destroy();
    this.clients.delete(clientId);
    
    this.emit('client-disconnected', clientId, reason);
  }

  /**
   * 处理新的客户端连接
   * 
   * @param socket 客户端socket
   * @private
   */
  private handleNewConnection(socket: net.Socket): void {
    // 检查客户端数量限制
    if (this.clients.size >= this.config.maxClients) {
      this.emit('client-rejected', '超过最大客户端连接数');
      socket.destroy();
      return;
    }

    const clientId = this.generateClientId();
    const client: ClientConnection = {
      id: clientId,
      socket,
      connectedAt: new Date(),
      lastActiveAt: new Date(),
      authenticated: false
    };

    this.clients.set(clientId, client);
    this.stats.totalConnections++;

    // 设置socket事件处理器
    socket.on('data', (data) => {
      this.handleClientData(clientId, data);
    });

    socket.on('error', (error) => {
      this.handleClientError(clientId, error);
    });

    socket.on('close', () => {
      this.handleClientDisconnect(clientId, '客户端断开连接');
    });

    // 设置连接超时
    socket.setTimeout(this.config.connectionTimeout, () => {
      this.disconnectClient(clientId, 'connection timeout');
    });

    this.emit('client-connected', client);
  }

  /**
   * 处理客户端数据
   * 
   * @param clientId 客户端ID
   * @param data 接收到的数据
   * @private
   */
  private handleClientData(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      const messages = data.toString().trim().split('\n');
      
      for (const messageStr of messages) {
        if (!messageStr) continue;

        // 检查消息大小
        if (Buffer.byteLength(messageStr, 'utf8') > this.config.maxMessageSize) {
          throw new Error('Message too large');
        }

        const message = deserializeMessage(messageStr);
        
        if (!validateMessage(message)) {
          throw new Error('Invalid message format');
        }

        client.lastActiveAt = new Date();
        this.stats.totalMessages++;

        this.emit('message', clientId, message);
      }
    } catch (error) {
      this.handleMessageError(clientId, error as Error);
    }
  }

  /**
   * 处理客户端错误
   * 
   * @param clientId 客户端ID
   * @param error 错误对象
   * @private
   */
  private handleClientError(clientId: string, error: Error): void {
    this.stats.errorCount++;
    this.emit('client-error', clientId, error);
    this.handleClientDisconnect(clientId, `error: ${error.message}`);
  }

  /**
   * 处理消息错误
   * 
   * @param clientId 客户端ID
   * @param error 错误对象
   * @private
   */
  private handleMessageError(clientId: string, error: Error): void {
    this.stats.errorCount++;
    this.emit('message-error', clientId, error);
  }

  /**
   * 处理客户端断开连接
   * 
   * @param clientId 客户端ID
   * @param reason 断开原因
   * @private
   */
  private handleClientDisconnect(clientId: string, reason: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      this.emit('client-disconnected', clientId, reason);
    }
  }

  /**
   * 处理服务器错误
   * 
   * @param error 错误对象
   * @private
   */
  private handleServerError(error: Error): void {
    this.stats.errorCount++;
    this.emit('server-error', error);
  }

  /**
   * 生成客户端唯一标识符
   * 
   * @returns 客户端ID
   * @private
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 启动心跳检测
   * 
   * @private
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.checkClientTimeouts();
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳检测
   * 
   * @private
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 发送心跳消息
   * 
   * @private
   */
  private async sendHeartbeat(): Promise<void> {
    if (this.clients.size === 0) {
      return;
    }

    const heartbeatMessage = createRequest('ping', {
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });

    for (const clientId of this.clients.keys()) {
      try {
        await this.sendToClient(clientId, heartbeatMessage);
        this.stats.heartbeatsSent++;
      } catch (error) {
        // 心跳发送失败，客户端可能已断开
      }
    }
  }

  /**
   * 检查客户端超时
   * 
   * @private
   */
  private checkClientTimeouts(): void {
    const now = Date.now();
    const timeout = this.config.connectionTimeout;

    for (const [clientId, client] of this.clients) {
      const lastActive = client.lastActiveAt.getTime();
      if (now - lastActive > timeout) {
        this.disconnectClient(clientId, 'heartbeat timeout');
      }
    }
  }

  /**
   * 清理socket文件
   * 
   * @private
   */
  private cleanupSocketFile(): void {
    try {
      // Windows Named Pipe不需要清理文件，只有Unix Socket需要
      if (process.platform !== 'win32' && fs.existsSync(this.config.socketPath)) {
        fs.unlinkSync(this.config.socketPath);
      }
    } catch (error) {
      // 忽略清理错误
    }
  }
}