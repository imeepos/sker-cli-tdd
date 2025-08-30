/**
 * 🟢 TDD 绿阶段：守护进程主体实现
 * 实现进程生命周期管理、信号处理和优雅关闭
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { IPCServer } from '../ipc/ipc-server';
import { IPCRequest, IPCResponse, createResponse, createErrorResponse } from '../ipc/ipc-protocol';
import { ConfigManager } from '../config-manager';

/**
 * 守护进程状态枚举
 */
export enum DaemonState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  FAILED = 'failed'
}

/**
 * 守护进程配置接口
 */
export interface DaemonConfig {
  /** Socket文件路径 */
  socketPath: string;
  /** 最大项目数量 */
  maxProjects?: number;
  /** 是否启用文件监听 */
  enableFileWatching?: boolean;
  /** 监听器防抖延迟时间（毫秒） */
  watcherDebounceMs?: number;
  /** 是否启用心跳检测 */
  enableHeartbeat?: boolean;
  /** 心跳间隔时间（毫秒） */
  heartbeatInterval?: number;
  /** PID文件路径 */
  pidFile?: string;
  /** 日志文件路径 */
  logFile?: string;
  /** 是否启用日志记录 */
  enableLogging?: boolean;
  /** 是否启用信号处理器 */
  enableSignalHandlers?: boolean;
  /** 优雅关闭超时时间（毫秒） */
  gracefulShutdownTimeout?: number;
}

/**
 * 守护进程统计信息接口
 */
export interface DaemonStats {
  /** 进程ID */
  pid: number;
  /** 启动时间 */
  startTime: Date | null;
  /** 运行时间（毫秒） */
  uptime: number;
  /** 当前状态 */
  state: DaemonState;
  /** 活跃连接数 */
  activeConnections: number;
  /** 总连接数 */
  totalConnections: number;
  /** 总请求数 */
  totalRequests: number;
  /** 总响应数 */
  totalResponses: number;
  /** 错误数量 */
  errorCount: number;
}

/**
 * 守护进程主体类
 * 
 * 提供完整的守护进程功能，包括：
 * - 进程生命周期管理
 * - 信号处理和优雅关闭
 * - IPC服务器集成
 * - 统计信息收集
 * - 日志记录
 * - 资源清理
 */
export class DaemonProcess extends EventEmitter {
  /** 守护进程配置 */
  private config: Required<DaemonConfig>;
  
  /** 当前状态 */
  private state: DaemonState = DaemonState.STOPPED;
  
  /** IPC服务器实例 */
  private ipcServer: IPCServer | null = null;
  
  /** 信号处理器映射 */
  private signalHandlers: Map<string, () => void> = new Map();
  
  /** 统计信息 */
  private stats: DaemonStats = {
    pid: process.pid,
    startTime: null,
    uptime: 0,
    state: DaemonState.STOPPED,
    activeConnections: 0,
    totalConnections: 0,
    totalRequests: 0,
    totalResponses: 0,
    errorCount: 0
  };
  
  /** 优雅关闭超时定时器 */
  private gracefulShutdownTimer?: NodeJS.Timeout;
  
  /** 日志写入流 */
  private logStream?: fs.WriteStream;

  /**
   * 构造函数
   * 
   * @param config 守护进程配置
   */
  constructor(config: DaemonConfig) {
    super();

    // 验证配置参数
    if (config.maxProjects !== undefined && config.maxProjects <= 0) {
      throw new Error('最大项目数量必须大于0');
    }
    
    if (config.watcherDebounceMs !== undefined && config.watcherDebounceMs < 0) {
      throw new Error('防抖延迟时间不能为负数');
    }

    this.config = {
      socketPath: config.socketPath,
      maxProjects: config.maxProjects ?? 100,
      enableFileWatching: config.enableFileWatching ?? true,
      watcherDebounceMs: config.watcherDebounceMs ?? 300,
      enableHeartbeat: config.enableHeartbeat ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      pidFile: config.pidFile || this.getDefaultPidFile(),
      logFile: config.logFile || this.getDefaultLogFile(),
      enableLogging: config.enableLogging ?? true,
      enableSignalHandlers: config.enableSignalHandlers ?? true,
      gracefulShutdownTimeout: config.gracefulShutdownTimeout ?? 10000
    };

    // 初始化日志
    this.initializeLogging();

    // 设置错误处理
    this.setupErrorHandlers();
  }

  /**
   * 获取当前状态
   */
  getState(): DaemonState {
    return this.state;
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.state === DaemonState.RUNNING;
  }

  /**
   * 获取进程ID
   */
  getPid(): number {
    return process.pid;
  }

  /**
   * 获取配置
   */
  getConfig(): Required<DaemonConfig> {
    return { ...this.config };
  }

  /**
   * 获取IPC服务器实例
   */
  getIPCServer(): IPCServer {
    if (!this.ipcServer) {
      throw new Error('IPC服务器尚未初始化');
    }
    return this.ipcServer;
  }

  /**
   * 获取信号处理器
   */
  getSignalHandlers(): Map<string, () => void> {
    return this.signalHandlers;
  }

  /**
   * 启动守护进程
   */
  async start(): Promise<void> {
    if (this.state !== DaemonState.STOPPED) {
      throw new Error('守护进程已在运行');
    }

    this.setState(DaemonState.STARTING);
    this.stats.startTime = new Date();

    try {
      // 创建PID文件
      await this.createPidFile();

      // 启动IPC服务器
      await this.startIPCServer();

      // 注册信号处理器
      this.registerSignalHandlers();

      this.setState(DaemonState.RUNNING);
      this.log('INFO', `Daemon started successfully, PID: ${this.getPid()}`);
      
      this.emit('started');
    } catch (error) {
      this.setState(DaemonState.FAILED);
      this.emit('internal-error', error as Error);
      throw error;
    }
  }

  /**
   * 停止守护进程
   */
  async stop(): Promise<void> {
    if (this.state === DaemonState.STOPPED) {
      return;
    }

    this.setState(DaemonState.STOPPING);
    this.log('INFO', 'Daemon stopping...');

    try {
      // 停止IPC服务器
      if (this.ipcServer) {
        await this.ipcServer.stop();
        this.ipcServer = null;
      }

      // 注销信号处理器
      this.unregisterSignalHandlers();

      // 清理PID文件
      await this.cleanupPidFile();

      // 关闭日志流
      this.closeLogging();

      this.setState(DaemonState.STOPPED);
      this.log('INFO', 'Daemon stopped successfully');
      
      this.emit('stopped');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * 优雅关闭
   */
  async gracefulShutdown(): Promise<void> {
    if (this.state === DaemonState.STOPPED) {
      return;
    }

    this.log('INFO', 'Initiating graceful shutdown...');
    this.emit('shutdown-initiated', 'manual');

    return new Promise<void>((resolve) => {
      // 设置超时定时器
      this.gracefulShutdownTimer = setTimeout(() => {
        this.log('WARN', 'Graceful shutdown timeout, forcing shutdown');
        this.emit('force-shutdown');
        this.forceCleanup().then(resolve);
      }, this.config.gracefulShutdownTimeout);

      // 开始优雅关闭流程
      this.performGracefulShutdown()
        .then(() => {
          if (this.gracefulShutdownTimer) {
            clearTimeout(this.gracefulShutdownTimer);
          }
          resolve();
        })
        .catch((error) => {
          this.handleError(error);
          if (this.gracefulShutdownTimer) {
            clearTimeout(this.gracefulShutdownTimer);
          }
          this.forceCleanup().then(resolve);
        });
    });
  }

  /**
   * 强制清理资源
   */
  async forceCleanup(): Promise<void> {
    try {
      // 强制关闭IPC服务器
      if (this.ipcServer) {
        await this.ipcServer.stop();
        this.ipcServer = null;
      }

      // 清理文件
      await this.cleanupPidFile();
      this.closeLogging();

      // 注销信号处理器
      this.unregisterSignalHandlers();

      this.setState(DaemonState.STOPPED);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): DaemonStats {
    this.stats.state = this.state;
    this.stats.uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    
    if (this.ipcServer && this.ipcServer.isRunning) {
      try {
        const serverStats = this.ipcServer.getStats();
        this.stats.activeConnections = serverStats.activeClients;
        this.stats.totalConnections = serverStats.totalConnections;
        this.stats.totalRequests = serverStats.totalMessages;
      } catch (error) {
        // 如果获取统计信息失败，保持原有值
      }
    }

    return { ...this.stats };
  }

  /**
   * 获取默认PID文件路径
   * 
   * @private
   */
  private getDefaultPidFile(): string {
    return path.join(os.tmpdir(), `sker-daemon-${process.pid}.pid`);
  }

  /**
   * 获取默认日志文件路径
   * 
   * @private
   */
  private getDefaultLogFile(): string {
    return path.join(os.tmpdir(), `sker-daemon-${process.pid}.log`);
  }

  /**
   * 初始化日志系统
   * 
   * @private
   */
  private initializeLogging(): void {
    if (!this.config.enableLogging) {
      return;
    }

    try {
      this.logStream = fs.createWriteStream(this.config.logFile, { flags: 'a' });
      this.logStream.on('error', (error) => {
        console.error('日志写入错误:', error);
      });
    } catch (error) {
      console.warn('无法初始化日志系统:', error);
    }
  }

  /**
   * 记录日志
   * 
   * @param level 日志级别
   * @param message 日志消息
   * @private
   */
  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
    if (!this.config.enableLogging || !this.logStream) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;

    try {
      this.logStream.write(logLine);
    } catch (error) {
      // 忽略日志写入错误
    }
  }

  /**
   * 关闭日志系统
   * 
   * @private
   */
  private closeLogging(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = undefined;
    }
  }

  /**
   * 设置错误处理
   * 
   * @private
   */
  private setupErrorHandlers(): void {
    this.on('internal-error', (error: Error) => {
      this.handleError(error);
      // 转发到error事件以保持兼容性
      this.emit('error', error);
    });

    this.on('error', (error: Error) => {
      this.handleError(error);
    });
  }

  /**
   * 处理错误
   * 
   * @param error 错误对象
   * @private
   */
  private handleError(error: Error): void {
    this.stats.errorCount++;
    this.log('ERROR', `Error: ${error.message}\nStack: ${error.stack}`);
    
    // 在测试环境下不输出错误日志，避免测试噪音
    const configManager = ConfigManager.getInstance();
    if (!configManager.isTestEnvironment()) {
      console.error('守护进程错误:', error);
    }
  }

  /**
   * 设置状态
   * 
   * @param newState 新状态
   * @private
   */
  private setState(newState: DaemonState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.emit('state-changed', newState, oldState);
    }
  }

  /**
   * 创建PID文件
   * 
   * @private
   */
  private async createPidFile(): Promise<void> {
    try {
      await fs.promises.writeFile(this.config.pidFile, process.pid.toString());
    } catch (error) {
      throw new Error(`无法创建PID文件: ${(error as Error).message}`);
    }
  }

  /**
   * 清理PID文件
   * 
   * @private
   */
  private async cleanupPidFile(): Promise<void> {
    try {
      if (fs.existsSync(this.config.pidFile)) {
        await fs.promises.unlink(this.config.pidFile);
      }
    } catch (error) {
      // 忽略清理错误
    }
  }

  /**
   * 启动IPC服务器
   * 
   * @private
   */
  private async startIPCServer(): Promise<void> {
    this.ipcServer = new IPCServer({
      socketPath: this.config.socketPath,
      enableHeartbeat: this.config.enableHeartbeat,
      heartbeatInterval: this.config.heartbeatInterval
    });

    // 设置消息处理器
    this.ipcServer.on('message', (clientId: string, request: IPCRequest) => {
      this.handleIPCMessage(clientId, request);
    });

    await this.ipcServer.start();
  }

  /**
   * 处理IPC消息
   * 
   * @param clientId 客户端ID
   * @param request 请求消息
   * @private
   */
  private async handleIPCMessage(clientId: string, request: IPCRequest): Promise<void> {
    try {
      let response: IPCResponse;

      switch (request.command) {
        case 'ping':
          response = createResponse(request.id, { pong: true });
          break;

        case 'status':
          response = createResponse(request.id, {
            state: this.state,
            pid: this.getPid(),
            uptime: this.getStats().uptime
          });
          break;

        case 'shutdown':
          response = createResponse(request.id, { shutdownInitiated: true });
          // 异步执行关闭
          setImmediate(() => {
            this.gracefulShutdown();
          });
          break;

        default:
          response = createErrorResponse(request.id, {
            code: 'INVALID_COMMAND',
            message: `未知命令: ${request.command}`
          });
      }

      await this.ipcServer!.sendToClient(clientId, response);
      this.stats.totalResponses++;
    } catch (error) {
      this.handleError(error as Error);
      
      try {
        const errorResponse = createErrorResponse(request.id, {
          code: 'INTERNAL_ERROR',
          message: '处理请求时发生内部错误'
        });
        await this.ipcServer!.sendToClient(clientId, errorResponse);
      } catch {
        // 忽略响应发送错误
      }
    }
  }

  /**
   * 注册信号处理器
   * 
   * @private
   */
  private registerSignalHandlers(): void {
    if (!this.config.enableSignalHandlers) {
      return;
    }

    // SIGTERM - 优雅关闭
    const sigtermHandler = () => {
      this.log('INFO', 'Received SIGTERM, initiating graceful shutdown');
      this.emit('graceful-shutdown');
      this.emit('shutdown-initiated', 'SIGTERM');
      // 异步执行优雅关闭，避免阻塞信号处理
      setImmediate(() => {
        this.gracefulShutdown();
      });
    };

    // SIGINT - 立即关闭
    const sigintHandler = () => {
      this.log('INFO', 'Received SIGINT, initiating shutdown');
      this.emit('shutdown-initiated', 'SIGINT');
      // 异步执行关闭，避免阻塞信号处理
      setImmediate(() => {
        this.stop();
      });
    };

    // SIGHUP - 重新加载配置
    const sighupHandler = () => {
      this.log('INFO', 'Received SIGHUP, reloading configuration');
      this.emit('config-reloaded');
    };

    this.signalHandlers.set('SIGTERM', sigtermHandler);
    this.signalHandlers.set('SIGINT', sigintHandler);
    this.signalHandlers.set('SIGHUP', sighupHandler);

    process.on('SIGTERM', sigtermHandler);
    process.on('SIGINT', sigintHandler);
    process.on('SIGHUP', sighupHandler);
  }

  /**
   * 注销信号处理器
   * 
   * @private
   */
  private unregisterSignalHandlers(): void {
    for (const [signal, handler] of this.signalHandlers) {
      process.off(signal as NodeJS.Signals, handler);
    }
    this.signalHandlers.clear();
  }

  /**
   * 执行优雅关闭流程
   * 
   * @private
   */
  private async performGracefulShutdown(): Promise<void> {
    this.emit('graceful-shutdown');
    
    // 等待所有连接关闭
    if (this.ipcServer) {
      // 发送关闭通知给所有客户端
      try {
        const shutdownMessage = {
          id: `shutdown-${Date.now()}`,
          type: 'request' as const,
          version: '1.0',
          timestamp: Date.now(),
          command: 'shutdown' as const,
          data: { reason: 'server_shutdown' }
        };
        await this.ipcServer.broadcastToAll(shutdownMessage);
      } catch {
        // 忽略广播错误
      }
    }

    // 等待一小段时间让客户端处理关闭通知
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 正常停止
    await this.stop();
  }
}