/**
 * 🔴 TDD 红阶段：文件I/O优化实现
 * 实现异步文件读取队列、读写操作合并、缓存预加载策略
 */

import * as fs from 'fs';
import { EventEmitter } from 'events';

/**
 * I/O优化器配置接口
 */
export interface IOOptimizerConfig {
  /** 并发读取限制 */
  maxConcurrentReads?: number;
  /** 队列大小限制 */
  maxQueueSize?: number;
  /** 合并操作时间窗口（毫秒） */
  batchWindowMs?: number;
  /** 预加载缓存大小 */
  preloadCacheSize?: number;
  /** 文件监控间隔 */
  watchInterval?: number;
  /** 重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
}

/**
 * 读取请求接口
 */
export interface ReadRequest {
  /** 请求ID */
  id: string;
  /** 文件路径 */
  filePath: string;
  /** 编码格式 */
  encoding?: BufferEncoding;
  /** 优先级（数字越小优先级越高） */
  priority?: number;
  /** 请求时间戳 */
  timestamp: number;
  /** 回调函数 */
  resolve: (result: ReadResult) => void;
  /** 错误回调 */
  reject: (error: Error) => void;
  /** 重试次数 */
  retries?: number;
}

/**
 * 写入请求接口
 */
export interface WriteRequest {
  /** 请求ID */
  id: string;
  /** 文件路径 */
  filePath: string;
  /** 写入内容 */
  content: string | Buffer;
  /** 编码格式 */
  encoding?: BufferEncoding;
  /** 追加模式 */
  append?: boolean;
  /** 优先级 */
  priority?: number;
  /** 时间戳 */
  timestamp: number;
  /** 回调函数 */
  resolve: (result: WriteResult) => void;
  /** 错误回调 */
  reject: (error: Error) => void;
  /** 重试次数 */
  retries?: number;
}

/**
 * 读取结果接口
 */
export interface ReadResult {
  /** 是否成功 */
  success: boolean;
  /** 文件路径 */
  filePath: string;
  /** 文件内容 */
  content?: string | Buffer;
  /** 文件大小 */
  size: number;
  /** 读取时间（毫秒） */
  readTime: number;
  /** 是否来自缓存 */
  fromCache?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 写入结果接口
 */
export interface WriteResult {
  /** 是否成功 */
  success: boolean;
  /** 文件路径 */
  filePath: string;
  /** 写入字节数 */
  bytesWritten: number;
  /** 写入时间（毫秒） */
  writeTime: number;
  /** 是否为合并操作 */
  batched?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 批处理操作接口
 */
export interface BatchOperation {
  /** 操作类型 */
  type: 'read' | 'write';
  /** 文件路径 */
  filePath: string;
  /** 请求列表 */
  requests: (ReadRequest | WriteRequest)[];
  /** 创建时间 */
  createTime: number;
}

/**
 * 预加载项接口
 */
export interface PreloadEntry {
  /** 文件路径 */
  filePath: string;
  /** 文件内容 */
  content: string | Buffer;
  /** 文件大小 */
  size: number;
  /** 最后访问时间 */
  lastAccessed: number;
  /** 最后修改时间 */
  lastModified: number;
  /** 访问次数 */
  accessCount: number;
}

/**
 * I/O统计信息接口
 */
export interface IOStats {
  /** 总读取次数 */
  totalReads: number;
  /** 总写入次数 */
  totalWrites: number;
  /** 缓存命中次数 */
  cacheHits: number;
  /** 批处理次数 */
  batchedOperations: number;
  /** 平均读取时间 */
  averageReadTime: number;
  /** 平均写入时间 */
  averageWriteTime: number;
  /** 错误次数 */
  errors: number;
  /** 重试次数 */
  retries: number;
  /** 队列当前长度 */
  queueLength: number;
  /** 预加载缓存大小 */
  preloadCacheSize: number;
}

/**
 * 异步文件读取队列
 */
export class AsyncFileReadQueue extends EventEmitter {
  private queue: ReadRequest[] = [];
  private activeReads = 0;
  private config: Required<IOOptimizerConfig>;

  constructor(config: IOOptimizerConfig) {
    super();
    this.config = {
      maxConcurrentReads: config.maxConcurrentReads || 10,
      maxQueueSize: config.maxQueueSize || 1000,
      batchWindowMs: config.batchWindowMs || 50,
      preloadCacheSize: config.preloadCacheSize || 100,
      watchInterval: config.watchInterval || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    };
  }

  /**
   * 添加读取请求
   */
  async enqueue(filePath: string, encoding: BufferEncoding = 'utf8', priority = 5): Promise<ReadResult> {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('队列已满，无法添加更多请求');
    }

    return new Promise<ReadResult>((resolve, reject) => {
      const request: ReadRequest = {
        id: this.generateRequestId(),
        filePath,
        encoding,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
        retries: 0
      };

      // 按优先级插入队列
      this.insertByPriority(request);
      this.emit('enqueued', request);
      
      // 尝试处理队列
      this.processQueue();
    });
  }

  /**
   * 按优先级插入请求
   */
  private insertByPriority(request: ReadRequest): void {
    let insertIndex = this.queue.length;
    
    for (let i = 0; i < this.queue.length; i++) {
      if (request.priority! < this.queue[i]!.priority!) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    // 检查队列是否有空间处理新请求
    while (this.queue.length > 0 && this.activeReads < this.config.maxConcurrentReads) {
      const request = this.queue.shift()!;
      this.activeReads++;
      
      // 异步处理请求
      this.processRequest(request).finally(() => {
        this.activeReads--;
        // 继续处理队列
        setImmediate(() => this.processQueue());
      });
    }
  }

  /**
   * 处理单个请求
   */
  private async processRequest(request: ReadRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      const stats = await fs.promises.stat(request.filePath);
      const content = await fs.promises.readFile(request.filePath, request.encoding!);
      
      const result: ReadResult = {
        success: true,
        filePath: request.filePath,
        content,
        size: stats.size,
        readTime: Date.now() - startTime
      };
      
      request.resolve(result);
      this.emit('completed', result);
    } catch (error) {
      const shouldRetry = request.retries! < this.config.maxRetries;
      
      if (shouldRetry) {
        request.retries!++;
        setTimeout(() => {
          this.queue.unshift(request); // 重新加入队列头部
          this.processQueue();
        }, this.config.retryDelay);
        
        this.emit('retry', { request, error, attempt: request.retries });
      } else {
        const result: ReadResult = {
          success: false,
          filePath: request.filePath,
          size: 0,
          readTime: Date.now() - startTime,
          error: (error as Error).message
        };
        
        // 通过resolve返回失败结果，而不是reject
        request.resolve(result);
        this.emit('failed', { request, result, error });
      }
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取队列状态
   */
  getStatus(): { queueLength: number; activeReads: number } {
    return {
      queueLength: this.queue.length,
      activeReads: this.activeReads
    };
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue.forEach(request => {
      if (request.reject) {
        request.reject(new Error('队列已被清空'));
      }
    });
    this.queue = [];
  }
}

/**
 * 操作批处理器
 */
export class OperationBatcher extends EventEmitter {
  private batches: Map<string, BatchOperation> = new Map();
  private config: Required<IOOptimizerConfig>;
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: IOOptimizerConfig) {
    super();
    this.config = {
      maxConcurrentReads: config.maxConcurrentReads || 10,
      maxQueueSize: config.maxQueueSize || 1000,
      batchWindowMs: config.batchWindowMs || 50,
      preloadCacheSize: config.preloadCacheSize || 100,
      watchInterval: config.watchInterval || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    };
  }

  /**
   * 添加读取操作到批处理
   */
  addReadOperation(request: ReadRequest): void {
    const key = `read:${request.filePath}`;
    
    if (!this.batches.has(key)) {
      const batch: BatchOperation = {
        type: 'read',
        filePath: request.filePath,
        requests: [],
        createTime: Date.now()
      };
      this.batches.set(key, batch);
      
      // 设置批处理超时
      const timer = setTimeout(() => {
        this.processBatch(key);
      }, this.config.batchWindowMs);
      
      this.timers.set(key, timer);
    }
    
    this.batches.get(key)!.requests.push(request);
    this.emit('added', { type: 'read', filePath: request.filePath });
  }

  /**
   * 添加写入操作到批处理
   */
  addWriteOperation(request: WriteRequest): void {
    const key = `write:${request.filePath}`;
    
    if (!this.batches.has(key)) {
      const batch: BatchOperation = {
        type: 'write',
        filePath: request.filePath,
        requests: [],
        createTime: Date.now()
      };
      this.batches.set(key, batch);
      
      // 设置批处理超时
      const timer = setTimeout(() => {
        this.processBatch(key);
      }, this.config.batchWindowMs);
      
      this.timers.set(key, timer);
    }
    
    this.batches.get(key)!.requests.push(request);
    this.emit('added', { type: 'write', filePath: request.filePath });
  }

  /**
   * 处理批处理操作
   */
  private async processBatch(key: string): Promise<void> {
    const batch = this.batches.get(key);
    if (!batch) return;

    // 清理
    this.batches.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    try {
      if (batch.type === 'read') {
        await this.processBatchedReads(batch);
      } else {
        await this.processBatchedWrites(batch);
      }
    } catch (error) {
      this.emit('batchError', { batch, error });
    }
  }

  /**
   * 处理批量读取
   */
  private async processBatchedReads(batch: BatchOperation): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 由于读取同一个文件，只需要读取一次
      const stats = await fs.promises.stat(batch.filePath);
      const firstRequest = batch.requests[0] as ReadRequest;
      const content = await fs.promises.readFile(batch.filePath, firstRequest.encoding!);
      
      const readTime = Date.now() - startTime;
      
      // 将结果返回给所有请求
      batch.requests.forEach(req => {
        const request = req as ReadRequest;
        const result: ReadResult = {
          success: true,
          filePath: batch.filePath,
          content,
          size: stats.size,
          readTime,
          fromCache: batch.requests.length > 1 // 如果有多个请求，除第一个外都算缓存命中
        };
        request.resolve(result);
      });
      
      this.emit('batchCompleted', { 
        type: 'read', 
        filePath: batch.filePath, 
        count: batch.requests.length,
        duration: readTime
      });
    } catch (error) {
      // 所有请求都失败
      batch.requests.forEach(req => {
        const request = req as ReadRequest;
        request.reject(error as Error);
      });
    }
  }

  /**
   * 处理批量写入
   */
  private async processBatchedWrites(batch: BatchOperation): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 合并所有写入内容
      const writeRequests = batch.requests as WriteRequest[];
      const hasAppendMode = writeRequests.some(req => req.append);
      
      if (hasAppendMode) {
        // 如果有追加模式，按时间顺序执行
        writeRequests.sort((a, b) => a.timestamp - b.timestamp);
        
        let totalBytes = 0;
        for (const request of writeRequests) {
          const content = request.content;
          const bytesWritten = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, request.encoding);
          
          await fs.promises.appendFile(request.filePath, content, { encoding: request.encoding });
          totalBytes += bytesWritten;
        }
        
        const writeTime = Date.now() - startTime;
        
        writeRequests.forEach(request => {
          const result: WriteResult = {
            success: true,
            filePath: request.filePath,
            bytesWritten: totalBytes,
            writeTime,
            batched: true
          };
          request.resolve(result);
        });
      } else {
        // 覆盖模式，只执行最后一个写入
        const lastRequest = writeRequests[writeRequests.length - 1]!;
        const content = lastRequest.content;
        const bytesWritten = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, lastRequest.encoding);
        
        await fs.promises.writeFile(lastRequest.filePath, content, { encoding: lastRequest.encoding });
        
        const writeTime = Date.now() - startTime;
        
        // 只有最后一个请求成功，其他请求被合并
        writeRequests.forEach((request, index) => {
          const result: WriteResult = {
            success: true,
            filePath: request.filePath,
            bytesWritten: index === writeRequests.length - 1 ? bytesWritten : 0,
            writeTime,
            batched: true
          };
          request.resolve(result);
        });
      }
      
      this.emit('batchCompleted', { 
        type: 'write', 
        filePath: batch.filePath, 
        count: batch.requests.length,
        duration: Date.now() - startTime
      });
    } catch (error) {
      // 所有请求都失败
      batch.requests.forEach(req => {
        const request = req as WriteRequest;
        request.reject(error as Error);
      });
    }
  }

  /**
   * 强制处理所有批次
   */
  flush(): Promise<void[]> {
    const promises: Promise<void>[] = [];
    
    for (const key of this.batches.keys()) {
      promises.push(this.processBatch(key));
    }
    
    return Promise.all(promises);
  }

  /**
   * 获取批处理状态
   */
  getStatus(): { batchCount: number; pendingOperations: number } {
    let pendingOperations = 0;
    for (const batch of this.batches.values()) {
      pendingOperations += batch.requests.length;
    }
    
    return {
      batchCount: this.batches.size,
      pendingOperations
    };
  }
}

/**
 * 预加载缓存
 */
export class PreloadCache extends EventEmitter {
  private cache: Map<string, PreloadEntry> = new Map();
  private config: Required<IOOptimizerConfig>;

  constructor(config: IOOptimizerConfig) {
    super();
    this.config = {
      maxConcurrentReads: config.maxConcurrentReads || 10,
      maxQueueSize: config.maxQueueSize || 1000,
      batchWindowMs: config.batchWindowMs || 50,
      preloadCacheSize: config.preloadCacheSize || 100,
      watchInterval: config.watchInterval || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    };
  }

  /**
   * 预加载文件
   */
  async preload(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      const content = await fs.promises.readFile(filePath, encoding);
      
      const entry: PreloadEntry = {
        filePath,
        content,
        size: stats.size,
        lastAccessed: Date.now(),
        lastModified: stats.mtime.getTime(),
        accessCount: 0
      };
      
      // 检查缓存大小限制
      if (this.cache.size >= this.config.preloadCacheSize) {
        this.evictLeastUsed();
      }
      
      this.cache.set(filePath, entry);
      this.emit('preloaded', { filePath, size: stats.size });
      
      return true;
    } catch (error) {
      this.emit('preloadError', { filePath, error });
      return false;
    }
  }

  /**
   * 从缓存获取文件
   */
  async get(filePath: string): Promise<PreloadEntry | null> {
    const entry = this.cache.get(filePath);
    if (!entry) return null;

    // 检查文件是否被修改
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.mtime.getTime() > entry.lastModified) {
        // 文件已被修改，移除缓存
        this.cache.delete(filePath);
        this.emit('invalidated', { filePath, reason: 'modified' });
        return null;
      }
    } catch (error) {
      // 文件不存在或无法访问，移除缓存
      this.cache.delete(filePath);
      this.emit('invalidated', { filePath, reason: 'not_found' });
      return null;
    }

    // 更新访问信息
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    
    this.emit('hit', { filePath, accessCount: entry.accessCount });
    return entry;
  }

  /**
   * 批量预加载
   */
  async preloadBatch(filePaths: string[], encoding: BufferEncoding = 'utf8'): Promise<{ success: string[]; failed: string[] }> {
    const results = await Promise.allSettled(
      filePaths.map(filePath => this.preload(filePath, encoding))
    );
    
    const success: string[] = [];
    const failed: string[] = [];
    
    results.forEach((result, index) => {
      const filePath = filePaths[index]!;
      if (result.status === 'fulfilled' && result.value) {
        success.push(filePath);
      } else {
        failed.push(filePath);
      }
    });
    
    this.emit('batchPreloadCompleted', { success: success.length, failed: failed.length });
    return { success, failed };
  }

  /**
   * 淘汰最少使用的条目
   */
  private evictLeastUsed(): void {
    let leastUsed: PreloadEntry | null = null;
    let leastUsedPath = '';
    
    for (const [filePath, entry] of this.cache) {
      if (!leastUsed || entry.lastAccessed < leastUsed.lastAccessed) {
        leastUsed = entry;
        leastUsedPath = filePath;
      }
    }
    
    if (leastUsedPath) {
      this.cache.delete(leastUsedPath);
      this.emit('evicted', { filePath: leastUsedPath, reason: 'lru' });
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.emit('cleared', { entriesRemoved: size });
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; totalSize: number; hitRate: number } {
    let totalSize = 0;
    let totalAccesses = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      totalAccesses += entry.accessCount;
    }
    
    return {
      size: this.cache.size,
      totalSize,
      hitRate: totalAccesses > 0 ? this.cache.size / totalAccesses : 0
    };
  }
}

/**
 * I/O优化器主类
 */
export class IOOptimizer extends EventEmitter {
  private config: Required<IOOptimizerConfig>;
  private readQueue: AsyncFileReadQueue;
  private batcher: OperationBatcher;
  private preloadCache: PreloadCache;
  private stats: IOStats = {
    totalReads: 0,
    totalWrites: 0,
    cacheHits: 0,
    batchedOperations: 0,
    averageReadTime: 0,
    averageWriteTime: 0,
    errors: 0,
    retries: 0,
    queueLength: 0,
    preloadCacheSize: 0
  };
  private readTimes: number[] = [];
  private writeTimes: number[] = [];

  constructor(config: IOOptimizerConfig = {}) {
    super();
    
    this.config = {
      maxConcurrentReads: config.maxConcurrentReads || 10,
      maxQueueSize: config.maxQueueSize || 1000,
      batchWindowMs: config.batchWindowMs || 50,
      preloadCacheSize: config.preloadCacheSize || 100,
      watchInterval: config.watchInterval || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    };

    this.readQueue = new AsyncFileReadQueue(this.config);
    this.batcher = new OperationBatcher(this.config);
    this.preloadCache = new PreloadCache(this.config);

    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    this.readQueue.on('completed', (result: ReadResult) => {
      this.stats.totalReads++;
      this.readTimes.push(result.readTime);
      this.updateAverageReadTime();
      
      if (result.fromCache) {
        this.stats.cacheHits++;
      }
    });

    this.readQueue.on('failed', () => {
      this.stats.errors++;
    });

    this.readQueue.on('retry', () => {
      this.stats.retries++;
    });

    this.batcher.on('batchCompleted', (data: any) => {
      this.stats.batchedOperations++;
      
      if (data.type === 'write') {
        this.stats.totalWrites++;
        this.writeTimes.push(data.duration);
        this.updateAverageWriteTime();
      }
    });

    this.preloadCache.on('hit', () => {
      this.stats.cacheHits++;
    });
  }

  /**
   * 优化读取文件
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf8', priority = 5): Promise<ReadResult> {
    // 首先检查预加载缓存
    const cachedEntry = await this.preloadCache.get(filePath);
    if (cachedEntry) {
      this.stats.cacheHits++;
      return {
        success: true,
        filePath,
        content: cachedEntry.content,
        size: cachedEntry.size,
        readTime: 0,
        fromCache: true
      };
    }

    // 使用队列进行读取
    return await this.readQueue.enqueue(filePath, encoding, priority);
  }

  /**
   * 优化写入文件
   */
  async writeFile(
    filePath: string, 
    content: string | Buffer, 
    options: { encoding?: BufferEncoding; append?: boolean; priority?: number } = {}
  ): Promise<WriteResult> {
    return new Promise<WriteResult>((resolve, reject) => {
      const request: WriteRequest = {
        id: this.generateRequestId(),
        filePath,
        content,
        encoding: options.encoding || 'utf8',
        append: options.append || false,
        priority: options.priority || 5,
        timestamp: Date.now(),
        resolve,
        reject,
        retries: 0
      };

      // 添加到批处理器
      this.batcher.addWriteOperation(request);
    });
  }

  /**
   * 预加载文件
   */
  async preloadFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<boolean> {
    return await this.preloadCache.preload(filePath, encoding);
  }

  /**
   * 批量预加载文件
   */
  async preloadFiles(filePaths: string[], encoding: BufferEncoding = 'utf8'): Promise<{ success: string[]; failed: string[] }> {
    return await this.preloadCache.preloadBatch(filePaths, encoding);
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileStats(filePath: string): Promise<fs.Stats | null> {
    try {
      return await fs.promises.stat(filePath);
    } catch {
      return null;
    }
  }

  /**
   * 刷新批处理器
   */
  async flush(): Promise<void> {
    await this.batcher.flush();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.preloadCache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): IOStats {
    const readStatus = this.readQueue.getStatus();
    const cacheStats = this.preloadCache.getStats();
    
    return {
      ...this.stats,
      queueLength: readStatus.queueLength,
      preloadCacheSize: cacheStats.size
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalReads: 0,
      totalWrites: 0,
      cacheHits: 0,
      batchedOperations: 0,
      averageReadTime: 0,
      averageWriteTime: 0,
      errors: 0,
      retries: 0,
      queueLength: 0,
      preloadCacheSize: 0
    };
    this.readTimes = [];
    this.writeTimes = [];
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `io_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新平均读取时间
   */
  private updateAverageReadTime(): void {
    if (this.readTimes.length > 1000) {
      this.readTimes = this.readTimes.slice(-500);
    }
    this.stats.averageReadTime = this.readTimes.reduce((sum, time) => sum + time, 0) / this.readTimes.length;
  }

  /**
   * 更新平均写入时间
   */
  private updateAverageWriteTime(): void {
    if (this.writeTimes.length > 1000) {
      this.writeTimes = this.writeTimes.slice(-500);
    }
    this.stats.averageWriteTime = this.writeTimes.reduce((sum, time) => sum + time, 0) / this.writeTimes.length;
  }

  /**
   * 销毁优化器
   */
  destroy(): void {
    this.readQueue.clear();
    this.preloadCache.clear();
    this.removeAllListeners();
    this.readQueue.removeAllListeners();
    this.batcher.removeAllListeners();
    this.preloadCache.removeAllListeners();
  }
}