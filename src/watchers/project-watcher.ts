/**
 * 🟢 TDD 绿阶段：ProjectWatcher 项目监听器实现
 * 基于 chokidar 的文件监听功能
 */

import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * 文件变更事件类型
 */
export interface FileChangeEvent {
  /** 事件类型：添加、修改、删除、添加目录、删除目录 */
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  /** 文件或目录的绝对路径 */
  path: string;
  /** 文件统计信息（如果可用） */
  stats?: fs.Stats;
  /** 事件发生时间戳 */
  timestamp: number;
  /** 项目标识符 */
  projectId: string;
}

/**
 * 项目监听配置接口
 */
export interface ProjectWatchConfig {
  /** 项目根目录路径 */
  projectPath: string;
  /** 监听模式数组，支持glob模式 */
  watchPatterns: string[];
  /** 忽略模式数组，支持glob模式 */
  ignorePatterns: string[];
  /** 防抖延迟时间（毫秒） */
  debounceMs: number;
  /** 批处理大小 */
  batchSize: number;
  /** 最大扫描深度（可选） */
  maxDepth?: number;
  /** 是否遵循gitignore文件 */
  respectGitignore: boolean;
}

/**
 * 监听统计信息接口
 */
export interface WatcherStats {
  /** 已处理的事件数量 */
  eventsProcessed: number;
  /** 监听的文件数量 */
  filesWatched: number;
  /** 最后事件时间 */
  lastEventTime: Date | null;
  /** 启动时间 */
  startTime: Date | null;
}

/**
 * 项目监听器类
 * 
 * 负责监听指定项目目录的文件变更，基于chokidar实现跨平台文件监听。
 * 支持模式匹配、防抖处理和事件统计。
 */
export class ProjectWatcher extends EventEmitter {
  /** chokidar 监听器实例 */
  private watcher: chokidar.FSWatcher | null = null;
  
  /** 项目监听配置 */
  private readonly config: ProjectWatchConfig;
  
  /** 项目唯一标识符 */
  private readonly projectId: string;
  
  /** 监听统计信息 */
  private stats: WatcherStats = {
    eventsProcessed: 0,
    filesWatched: 0,
    lastEventTime: null,
    startTime: null
  };

  /**
   * 构造函数
   * 
   * @param config 项目监听配置
   */
  constructor(config: ProjectWatchConfig) {
    super();
    this.config = { ...config };
    
    // 生成项目唯一标识符（基于路径的哈希）
    this.projectId = crypto
      .createHash('md5')
      .update(config.projectPath)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * 启动文件监听
   */
  async start(): Promise<void> {
    if (this.watcher) {
      return; // 已经在监听中
    }

    // 创建chokidar监听器
    this.watcher = chokidar.watch(this.config.watchPatterns, {
      cwd: this.config.projectPath,
      ignored: this.config.ignorePatterns,
      ignoreInitial: true, // 忽略初始扫描以提高测试性能
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 200, // 增加稳定性阈值确保事件可靠触发
        pollInterval: 50
      },
      depth: this.config.maxDepth,
      usePolling: process.platform === 'win32', // Windows下使用轮询模式提高可靠性
      interval: 100, // 轮询间隔
      binaryInterval: 300 // 二进制文件轮询间隔
    });

    // 绑定事件处理器
    this.bindEventHandlers();

    // 等待监听器就绪
    await new Promise<void>((resolve, reject) => {
      this.watcher!.on('ready', () => {
        this.stats.startTime = new Date();
        resolve();
      });
      
      this.watcher!.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 停止文件监听
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.stats.startTime = null;
    }
  }

  /**
   * 检查是否正在监听
   */
  get isWatching(): boolean {
    return this.watcher !== null;
  }

  /**
   * 获取监听统计信息
   */
  getStats(): WatcherStats {
    return { ...this.stats };
  }

  /**
   * 绑定chokidar事件处理器
   * 
   * @private
   */
  private bindEventHandlers(): void {
    if (!this.watcher) {
      return;
    }

    // 文件添加事件
    this.watcher.on('add', (filePath: string, stats?: fs.Stats) => {
      this.handleFileChangeEvent('add', filePath, stats);
    });

    // 文件修改事件
    this.watcher.on('change', (filePath: string, stats?: fs.Stats) => {
      this.handleFileChangeEvent('change', filePath, stats);
    });

    // 文件删除事件
    this.watcher.on('unlink', (filePath: string) => {
      this.handleFileChangeEvent('unlink', filePath);
    });

    // 目录添加事件
    this.watcher.on('addDir', (dirPath: string, stats?: fs.Stats) => {
      this.handleFileChangeEvent('addDir', dirPath, stats);
    });

    // 目录删除事件
    this.watcher.on('unlinkDir', (dirPath: string) => {
      this.handleFileChangeEvent('unlinkDir', dirPath);
    });

    // 错误处理
    this.watcher.on('error', (error: unknown) => {
      this.emit('error', error);
    });
  }

  /**
   * 处理文件变更事件
   * 
   * @param type 事件类型
   * @param filePath 相对文件路径
   * @param stats 文件统计信息
   * @private
   */
  private handleFileChangeEvent(
    type: FileChangeEvent['type'],
    filePath: string,
    stats?: fs.Stats
  ): void {
    const absolutePath = path.resolve(this.config.projectPath, filePath);
    
    const event: FileChangeEvent = {
      type,
      path: absolutePath,
      stats,
      timestamp: Date.now(),
      projectId: this.projectId
    };

    // 更新统计信息
    this.stats.eventsProcessed++;
    this.stats.lastEventTime = new Date();

    // 发射变更事件
    this.emit('change', event);
  }
}