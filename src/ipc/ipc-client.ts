/**
 * 🟢 TDD 绿阶段：IPC 客户端实现
 * 实现连接池管理、自动重连机制和超时处理的IPC客户端
 */

import * as net from 'net';
// import * as os from 'os';
// import * as path from 'path';
import { EventEmitter } from 'events';
import { 
  IPCRequest, 
  IPCResponse, 
  IPCMessage, 
  validateMessage, 
  deserializeMessage, 
  serializeMessage,
  createRequest 
} from './ipc-protocol';

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

/**
 * IPC客户端配置接口
 */
export interface IPCClientConfig {
  /** Socket文件路径 */
  socketPath: string;
  /** 最大连接数 */
  maxConnections?: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout?: number;
  /** 请求超时时间（毫秒） */
  requestTimeout?: number;
  /** 重试次数 */
  retryAttempts?: number;
  /** 重试延迟时间（毫秒） */
  retryDelay?: number;
  /** 是否启用自动重连 */
  enableAutoReconnect?: boolean;
  /** 是否启用心跳检测 */
  enableHeartbeat?: boolean;
  /** 心跳间隔时间（毫秒） */
  heartbeatInterval?: number;
  /** 空闲连接超时时间（毫秒） */
  idleTimeout?: number;
}

/**
 * 连接池统计信息接口
 */
export interface ConnectionPoolStats {
  /** 总连接数 */
  totalConnections: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 空闲连接数 */
  idleConnections: number;
}

/**
 * 客户端统计信息接口
 */
export interface IPCClientStats {
  /** 总请求数 */
  totalRequests: number;
  /** 总响应数 */
  totalResponses: number;
  /** 连接尝试次数 */
  connectionAttempts: number;
  /** 重连尝试次数 */
  reconnectionAttempts: number;
  /** 错误数量 */
  errorCount: number;
  /** 心跳发送次数 */
  heartbeatsSent: number;
  /** 心跳接收次数 */
  heartbeatsReceived: number;
}

/**
 * 待处理请求接口
 */
interface PendingRequest {
  /** 请求对象 */
  request: IPCRequest;
  /** 成功回调 */
  resolve: (response: IPCResponse) => void;
  /** 失败回调 */
  reject: (error: Error) => void;
  /** 超时定时器 */
  timeoutTimer?: NodeJS.Timeout;
}

/**
 * 连接包装器接口
 */
interface ConnectionWrapper {
  /** 连接socket */
  socket: net.Socket;
  /** 是否正在使用 */
  inUse: boolean;
  /** 最后使用时间 */
  lastUsed: Date;
  /** 连接创建时间 */
  createdAt: Date;
}

/**
 * 连接池管理类
 */
export class ConnectionPool {
  /** 连接池 */
  private connections: ConnectionWrapper[] = [];
  
  /** 最大连接数 */
  private maxConnections: number;
  
  /** 空闲超时时间 */
  private idleTimeout: number;
  
  /** 清理定时器 */
  private cleanupTimer?: NodeJS.Timeout;

  constructor(maxConnections: number, idleTimeout: number = 30000) {
    this.maxConnections = maxConnections;
    this.idleTimeout = idleTimeout;
    
    // 启动定期清理
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, idleTimeout / 2);
  }

  /**
   * 获取可用连接
   */
  getConnection(socketPath: string): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      // 查找空闲连接
      const idleConnection = this.connections.find(conn => !conn.inUse);
      
      if (idleConnection) {
        idleConnection.inUse = true;
        idleConnection.lastUsed = new Date();
        resolve(idleConnection.socket);
        return;
      }

      // 如果达到最大连接数，等待或拒绝
      if (this.connections.length >= this.maxConnections) {
        reject(new Error('连接池已满'));
        return;
      }

      // 创建新连接
      const socket = net.createConnection(socketPath);
      
      socket.on('connect', () => {
        const wrapper: ConnectionWrapper = {
          socket,
          inUse: true,
          lastUsed: new Date(),
          createdAt: new Date()
        };
        
        this.connections.push(wrapper);
        resolve(socket);
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.on('close', () => {
        this.removeConnection(socket);
      });
    });
  }

  /**
   * 释放连接
   */
  releaseConnection(socket: net.Socket): void {
    const connection = this.connections.find(conn => conn.socket === socket);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = new Date();
    }
  }

  /**
   * 移除连接
   */
  removeConnection(socket: net.Socket): void {
    const index = this.connections.findIndex(conn => conn.socket === socket);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }
  }

  /**
   * 清理空闲连接
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    
    this.connections = this.connections.filter(conn => {
      if (!conn.inUse && (now - conn.lastUsed.getTime()) > this.idleTimeout) {
        conn.socket.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * 获取总连接数
   */
  getTotalConnections(): number {
    return this.connections.length;
  }

  /**
   * 获取活跃连接数
   */
  getActiveConnections(): number {
    return this.connections.filter(conn => conn.inUse).length;
  }

  /**
   * 获取空闲连接数
   */
  getIdleConnections(): number {
    return this.connections.filter(conn => !conn.inUse).length;
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.connections.forEach(conn => {
      conn.socket.destroy();
    });
    this.connections = [];
  }
}

/**
 * IPC 客户端类
 * 
 * 提供完整的IPC客户端功能，包括：
 * - 连接池管理
 * - 自动重连机制
 * - 请求超时处理
 * - 心跳检测
 * - 错误恢复
 */
export class IPCClient extends EventEmitter {
  /** 客户端配置 */
  private config: Required<IPCClientConfig>;
  
  /** 连接池 */
  private connectionPool: ConnectionPool;
  
  /** 当前连接状态 */
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  
  /** 待处理请求映射 */
  private pendingRequests: Map<string, PendingRequest> = new Map();
  
  /** 主连接socket */
  private primarySocket: net.Socket | null = null;
  
  /** 重连定时器 */
  private reconnectTimer?: NodeJS.Timeout;
  
  /** 心跳定时器 */
  private heartbeatTimer?: NodeJS.Timeout;
  
  /** 统计信息 */
  private stats: IPCClientStats = {
    totalRequests: 0,
    totalResponses: 0,
    connectionAttempts: 0,
    reconnectionAttempts: 0,
    errorCount: 0,
    heartbeatsSent: 0,
    heartbeatsReceived: 0
  };
  
  /** 重连尝试计数 */
  private reconnectAttempts: number = 0;

  /**
   * 构造函数
   * 
   * @param config 客户端配置
   */
  constructor(config: IPCClientConfig) {
    super();

    // 验证配置参数
    if (!config.socketPath) {
      throw new Error('Socket路径不能为空');
    }
    if (config.maxConnections !== undefined && config.maxConnections <= 0) {
      throw new Error('最大连接数必须大于0');
    }
    
    if (config.connectionTimeout !== undefined && config.connectionTimeout <= 0) {
      throw new Error('连接超时时间必须大于0');
    }
    
    if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
      throw new Error('重试次数不能为负数');
    }

    this.config = {
      socketPath: config.socketPath,
      maxConnections: config.maxConnections ?? 10,
      connectionTimeout: config.connectionTimeout ?? 10000,
      requestTimeout: config.requestTimeout ?? 30000,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableAutoReconnect: config.enableAutoReconnect ?? true,
      enableHeartbeat: config.enableHeartbeat ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      idleTimeout: config.idleTimeout ?? 60000
    };

    this.connectionPool = new ConnectionPool(
      this.config.maxConnections,
      this.config.idleTimeout
    );
  }

  /**
   * 检查是否已连接
   */
  get isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED && 
           this.primarySocket !== null && 
           !this.primarySocket.destroyed;
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 获取客户端配置
   */
  getConfig(): Required<IPCClientConfig> {
    return { ...this.config };
  }

  /**
   * 获取连接池
   */
  getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);
    this.stats.connectionAttempts++;

    try {
      this.primarySocket = await this.createConnection();
      this.setupSocketHandlers(this.primarySocket);
      this.setConnectionState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;

      // 初始化连接池中的第一个连接
      await this.connectionPool.getConnection(this.config.socketPath).catch(() => {
        // 忽略连接池初始化错误，主连接已建立
      });

      if (this.config.enableHeartbeat) {
        this.startHeartbeat();
      }

      this.emit('connected');
    } catch (error) {
      this.setConnectionState(ConnectionState.FAILED);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.setConnectionState(ConnectionState.DISCONNECTED);
    
    this.stopHeartbeat();
    this.stopReconnectTimer();
    
    if (this.primarySocket) {
      this.primarySocket.destroy();
      this.primarySocket = null;
    }
    
    this.connectionPool.closeAll();
    this.clearPendingRequests();
    
    this.emit('disconnected');
  }

  /**
   * 强制断开连接
   */
  async forceDisconnect(): Promise<void> {
    await this.disconnect();
  }

  /**
   * 发送请求
   */
  async sendRequest(request: IPCRequest): Promise<IPCResponse> {
    if (!this.isConnected) {
      throw new Error('客户端未连接');
    }

    return new Promise((resolve, reject) => {
      const pending: PendingRequest = {
        request,
        resolve,
        reject
      };

      // 设置超时
      pending.timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error('请求超时'));
      }, this.config.requestTimeout);

      this.pendingRequests.set(request.id, pending);
      
      try {
        const message = serializeMessage(request) + '\n';
        this.primarySocket!.write(message);
        this.stats.totalRequests++;
      } catch (error) {
        this.pendingRequests.delete(request.id);
        if (pending.timeoutTimer) {
          clearTimeout(pending.timeoutTimer);
        }
        reject(error);
      }
    });
  }

  /**
   * 获取统计信息
   */
  getStats(): IPCClientStats {
    return { ...this.stats };
  }

  /**
   * 创建连接
   * 
   * @private
   */
  private createConnection(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.config.socketPath);
      
      const timeoutTimer = setTimeout(() => {
        socket.destroy();
        reject(new Error('连接超时'));
      }, this.config.connectionTimeout);

      socket.on('connect', () => {
        clearTimeout(timeoutTimer);
        resolve(socket);
      });

      socket.on('error', (error) => {
        clearTimeout(timeoutTimer);
        reject(error);
      });
    });
  }

  /**
   * 设置socket事件处理器
   * 
   * @param socket Socket实例
   * @private
   */
  private setupSocketHandlers(socket: net.Socket): void {
    socket.on('data', (data) => {
      this.handleSocketData(data);
    });

    socket.on('error', (error) => {
      this.handleError(error);
    });

    socket.on('close', () => {
      this.handleSocketClose();
    });
  }

  /**
   * 处理socket数据
   * 
   * @param data 接收的数据
   * @private
   */
  private handleSocketData(data: Buffer): void {
    try {
      const messages = data.toString().trim().split('\n');
      
      for (const messageStr of messages) {
        if (!messageStr) continue;
        
        const message = deserializeMessage(messageStr);
        
        if (!validateMessage(message)) {
          continue;
        }

        this.handleMessage(message);
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理接收的消息
   * 
   * @param message IPC消息
   * @private
   */
  private handleMessage(message: IPCMessage): void {
    if (message.type === 'response') {
      this.handleResponse(message as IPCResponse);
    } else if (message.type === 'request') {
      this.handleRequest(message as IPCRequest);
    }
  }

  /**
   * 处理响应消息
   * 
   * @param response 响应消息
   * @private
   */
  private handleResponse(response: IPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);
    
    if (pending.timeoutTimer) {
      clearTimeout(pending.timeoutTimer);
    }

    this.stats.totalResponses++;
    pending.resolve(response);
  }

  /**
   * 处理请求消息（如心跳）
   * 
   * @param request 请求消息
   * @private
   */
  private handleRequest(request: IPCRequest): void {
    if (request.command === 'ping') {
      this.stats.heartbeatsReceived++;
      this.emit('heartbeat-received');
      
      // 响应心跳
      const response: IPCResponse = {
        id: request.id,
        type: 'response',
        version: '1.0',
        timestamp: Date.now(),
        success: true,
        data: { pong: true }
      };

      try {
        const message = serializeMessage(response) + '\n';
        this.primarySocket!.write(message);
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  /**
   * 处理socket关闭
   * 
   * @private
   */
  private handleSocketClose(): void {
    if (this.connectionState === ConnectionState.DISCONNECTED) {
      return;
    }

    this.primarySocket = null;
    
    if (this.config.enableAutoReconnect && 
        this.connectionState !== ConnectionState.FAILED) {
      this.startReconnect();
    } else {
      this.setConnectionState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * 开始重连
   * 
   * @private
   */
  private startReconnect(): void {
    if (this.reconnectAttempts >= this.config.retryAttempts) {
      this.setConnectionState(ConnectionState.FAILED);
      this.emit('reconnect-failed');
      return;
    }

    this.setConnectionState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;
    this.stats.reconnectionAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected');
      } catch (error) {
        this.startReconnect();
      }
    }, this.config.retryDelay);
  }

  /**
   * 停止重连定时器
   * 
   * @private
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * 开始心跳检测
   * 
   * @private
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
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
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 发送心跳
   * 
   * @private
   */
  private sendHeartbeat(): void {
    if (!this.isConnected) {
      return;
    }

    const heartbeat = createRequest('ping', {
      timestamp: Date.now()
    });

    this.sendRequest(heartbeat).catch(() => {
      // 心跳失败，可能需要重连
    });

    this.stats.heartbeatsSent++;
    this.emit('heartbeat-sent');
  }

  /**
   * 设置连接状态
   * 
   * @param state 新状态
   * @private
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('state-changed', state);
    }
  }

  /**
   * 处理错误
   * 
   * @param error 错误对象
   * @private
   */
  private handleError(error: Error): void {
    this.stats.errorCount++;
    this.emit('error', error);
  }

  /**
   * 清理待处理请求
   * 
   * @private
   */
  private clearPendingRequests(): void {
    for (const [, pending] of this.pendingRequests) {
      if (pending.timeoutTimer) {
        clearTimeout(pending.timeoutTimer);
      }
      pending.reject(new Error('连接已断开'));
    }
    this.pendingRequests.clear();
  }
}