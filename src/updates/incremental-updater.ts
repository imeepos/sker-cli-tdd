/**
 * 🟢 TDD 绿阶段：增量更新引擎实现
 * 实现精确的变更影响分析、最小化上下文重建、依赖级联更新
 */

import { LRUCache } from '../cache/lru-cache';
import { DependencyGraph } from '../analysis/dependency-analyzer';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * 更新请求接口
 */
export interface UpdateRequest {
  /** 更新类型 */
  type: 'single' | 'batch' | 'cascade' | 'smart';
  /** 单文件路径 */
  filePath?: string;
  /** 多文件路径 */
  filePaths?: string[];
  /** 更新原因 */
  reason: string;
  /** 时间戳 */
  timestamp: number;
  /** 依赖图（用于级联更新） */
  dependencyGraph?: DependencyGraph;
  /** 更新选项 */
  options?: UpdateOptions;
}

/**
 * 更新选项接口
 */
export interface UpdateOptions {
  /** 是否使用缓存 */
  useCache?: boolean;
  /** 是否跳过未变更的文件 */
  skipUnchanged?: boolean;
  /** 是否验证缓存有效性 */
  validateCache?: boolean;
  /** 是否优化更新顺序 */
  optimizeOrder?: boolean;
  /** 出错时是否继续 */
  continueOnError?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 更新结果接口
 */
export interface UpdateResult {
  /** 是否成功 */
  success: boolean;
  /** 已更新的文件列表 */
  updatedFiles: string[];
  /** 处理的文件数量 */
  processedCount: number;
  /** 跳过的文件数量 */
  skippedCount: number;
  /** 缓存命中数量 */
  cacheHitCount: number;
  /** 更新耗时（毫秒） */
  duration: number;
  /** 更新顺序 */
  updateOrder?: string[];
  /** 错误列表 */
  errors?: string[];
  /** 警告列表 */
  warnings?: string[];
}

/**
 * 增量更新引擎配置接口
 */
export interface IncrementalUpdaterConfig {
  /** 上下文缓存 */
  contextCache: LRUCache<string, any>;
  /** 最大并发更新数 */
  maxConcurrentUpdates?: number;
  /** 更新超时时间（毫秒） */
  updateTimeoutMs?: number;
  /** 是否启用变更跟踪 */
  enableChangeTracking?: boolean;
  /** 文件哈希缓存大小 */
  hashCacheSize?: number;
  /** 性能统计采样率 */
  statsSampleRate?: number;
}

/**
 * 统计信息接口
 */
export interface UpdateStatistics {
  /** 总更新次数 */
  totalUpdates: number;
  /** 成功更新次数 */
  successfulUpdates: number;
  /** 失败更新次数 */
  failedUpdates: number;
  /** 总处理文件数 */
  totalProcessedFiles: number;
  /** 平均更新时间 */
  averageUpdateTime: number;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 内存使用情况 */
  memoryUsage?: {
    used: number;
    cached: number;
    total: number;
  };
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  /** 更新时间百分位数 */
  updateTimePercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
  /** 吞吐量统计 */
  throughput: {
    updatesPerSecond: number;
    filesPerSecond: number;
  };
  /** 资源使用情况 */
  resourceUsage: {
    peakMemory: number;
    averageCpu: number;
  };
}

/**
 * 文件上下文缓存项
 */
interface FileContextCache {
  /** 文件内容 */
  content: string;
  /** 文件哈希 */
  hash: string;
  /** 最后修改时间 */
  lastModified?: Date;
  /** 文件大小 */
  size?: number;
}

/**
 * 增量更新引擎类
 * 
 * 负责精确的变更影响分析、最小化上下文重建、依赖级联更新
 */
export class IncrementalUpdater {
  /** 配置信息 */
  private config: Required<IncrementalUpdaterConfig>;
  
  /** 文件哈希缓存 */
  private hashCache: LRUCache<string, string>;
  
  /** 并发更新控制信号量 */
  private semaphore: Set<string> = new Set();
  
  /** 更新统计 */
  private statistics: UpdateStatistics = {
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    totalProcessedFiles: 0,
    averageUpdateTime: 0,
    cacheHitRate: 0
  };
  
  /** 更新时间记录 */
  private updateTimes: number[] = [];
  
  /** 是否已销毁 */
  private destroyed = false;

  /**
   * 构造函数
   */
  constructor(config: IncrementalUpdaterConfig) {
    this.config = {
      contextCache: config.contextCache,
      maxConcurrentUpdates: config.maxConcurrentUpdates || 5,
      updateTimeoutMs: config.updateTimeoutMs || 10000,
      enableChangeTracking: config.enableChangeTracking || true,
      hashCacheSize: config.hashCacheSize || 1000,
      statsSampleRate: config.statsSampleRate || 1.0
    };

    // 初始化哈希缓存
    this.hashCache = new LRUCache({
      maxSize: this.config.hashCacheSize
    });
  }

  /**
   * 分析单个文件变更的影响范围
   */
  async analyzeChangeImpact(filePath: string, dependencyGraph: DependencyGraph): Promise<string[]> {
    try {
      // 获取受影响的文件列表
      const affectedFiles = dependencyGraph.getAffectedFiles(filePath);
      return affectedFiles;
    } catch (error) {
      throw new Error(`分析文件 ${filePath} 的影响范围失败: ${(error as Error).message}`);
    }
  }

  /**
   * 分析多个文件变更的合并影响
   */
  async analyzeBatchChangeImpact(filePaths: string[], dependencyGraph: DependencyGraph): Promise<string[]> {
    try {
      const allAffected = new Set<string>();
      
      // 合并所有文件的影响范围
      for (const filePath of filePaths) {
        const affected = dependencyGraph.getAffectedFiles(filePath);
        affected.forEach(file => allAffected.add(file));
      }
      
      return Array.from(allAffected);
    } catch (error) {
      throw new Error(`分析批量文件变更影响失败: ${(error as Error).message}`);
    }
  }

  /**
   * 检查文件是否已缓存
   */
  async isCached(filePath: string): Promise<boolean> {
    return this.config.contextCache.has(filePath);
  }

  /**
   * 验证缓存是否有效
   */
  async isCacheValid(filePath: string): Promise<boolean> {
    try {
      if (!await this.isCached(filePath)) {
        return false;
      }

      const cachedContext = this.config.contextCache.get(filePath) as FileContextCache;
      if (!cachedContext || !cachedContext.hash) {
        return false;
      }

      // 检查文件是否存在
      if (!await this.fileExists(filePath)) {
        return false;
      }

      // 计算文件当前哈希
      const currentHash = await this.calculateFileHash(filePath);
      
      return cachedContext.hash === currentHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * 批量检查缓存状态
   */
  async batchCheckCache(filePaths: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const checkPromises = filePaths.map(async (filePath) => {
      const isCached = await this.isCached(filePath);
      results.set(filePath, isCached);
    });
    
    await Promise.all(checkPromises);
    return results;
  }

  /**
   * 缓存文件上下文
   */
  async cacheFileContext(filePath: string, context: FileContextCache): Promise<void> {
    this.config.contextCache.set(filePath, context);
  }

  /**
   * 使缓存失效
   */
  async invalidateCache(filePath: string): Promise<void> {
    this.config.contextCache.delete(filePath);
    this.hashCache.delete(filePath);
  }

  /**
   * 处理更新请求
   */
  async processUpdate(updateRequest: UpdateRequest): Promise<UpdateResult> {
    if (this.destroyed) {
      return {
        success: false,
        updatedFiles: [],
        processedCount: 0,
        skippedCount: 0,
        cacheHitCount: 0,
        duration: 0,
        errors: ['增量更新引擎已销毁']
      };
    }

    const startTime = Date.now();
    let result: UpdateResult;

    try {
      // 更新统计
      this.statistics.totalUpdates++;

      // 根据更新类型处理
      switch (updateRequest.type) {
        case 'single':
          result = await this.processSingleUpdate(updateRequest);
          break;
        case 'batch':
          result = await this.processBatchUpdate(updateRequest);
          break;
        case 'cascade':
          result = await this.processCascadeUpdate(updateRequest);
          break;
        case 'smart':
          result = await this.processSmartUpdate(updateRequest);
          break;
        default:
          throw new Error(`不支持的更新类型: ${updateRequest.type}`);
      }

      // 更新统计信息
      if (result.success) {
        this.statistics.successfulUpdates++;
      } else {
        this.statistics.failedUpdates++;
      }

      this.statistics.totalProcessedFiles += result.processedCount;
      
      // 记录更新时间
      const duration = Date.now() - startTime;
      result.duration = duration;
      this.updateTimes.push(duration);
      
      // 限制时间记录数量
      if (this.updateTimes.length > 1000) {
        this.updateTimes = this.updateTimes.slice(-500);
      }

      // 更新平均时间
      this.statistics.averageUpdateTime = 
        this.updateTimes.reduce((sum, time) => sum + time, 0) / this.updateTimes.length;

      // 更新缓存命中率
      const totalCacheRequests = this.statistics.totalProcessedFiles;
      if (totalCacheRequests > 0) {
        this.statistics.cacheHitRate = result.cacheHitCount / totalCacheRequests;
      }

      return result;
    } catch (error) {
      this.statistics.failedUpdates++;
      
      return {
        success: false,
        updatedFiles: [],
        processedCount: 0,
        skippedCount: 0,
        cacheHitCount: 0,
        duration: Date.now() - startTime,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 处理单文件更新
   */
  private async processSingleUpdate(request: UpdateRequest): Promise<UpdateResult> {
    if (!request.filePath) {
      throw new Error('单文件更新需要提供 filePath');
    }

    const filePath = request.filePath;
    const result: UpdateResult = {
      success: false,
      updatedFiles: [],
      processedCount: 0,
      skippedCount: 0,
      cacheHitCount: 0,
      duration: 0
    };

    // 添加超时控制
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`文件更新超时: ${filePath} (${this.config.updateTimeoutMs}ms)`));
      }, this.config.updateTimeoutMs);
    });

    try {
      const updatePromise = this.doSingleFileUpdate(filePath, request, result);
      
      // 使用 Promise.race 来实现超时
      return await Promise.race([updatePromise, timeoutPromise]);
    } catch (error) {
      result.errors = [(error as Error).message];
      return result;
    }
  }

  /**
   * 执行实际的单文件更新逻辑
   */
  private async doSingleFileUpdate(
    filePath: string, 
    request: UpdateRequest, 
    result: UpdateResult
  ): Promise<UpdateResult> {
    // 检查文件是否存在
    if (!await this.fileExists(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    // 检查是否需要跳过
    if (request.options?.skipUnchanged && await this.isCacheValid(filePath)) {
      result.success = true;
      result.skippedCount = 1;
      return result;
    }

    // 等待并发限制
    await this.acquireConcurrencySlot(filePath);

    try {
      // 读取文件内容并更新缓存
      const content = await this.readFileContent(filePath);
      const hash = await this.calculateFileHash(filePath);
      const stats = await fs.promises.stat(filePath);

      const contextCache: FileContextCache = {
        content,
        hash,
        lastModified: stats.mtime,
        size: stats.size
      };

      await this.cacheFileContext(filePath, contextCache);

      result.success = true;
      result.updatedFiles.push(filePath);
      result.processedCount = 1;

      return result;
    } finally {
      this.releaseConcurrencySlot(filePath);
    }
  }

  /**
   * 处理批量更新
   */
  private async processBatchUpdate(request: UpdateRequest): Promise<UpdateResult> {
    if (!request.filePaths || request.filePaths.length === 0) {
      throw new Error('批量更新需要提供 filePaths');
    }

    const result: UpdateResult = {
      success: true,
      updatedFiles: [],
      processedCount: 0,
      skippedCount: 0,
      cacheHitCount: 0,
      duration: 0,
      errors: []
    };

    let filePaths = request.filePaths;

    // 优化更新顺序
    if (request.options?.optimizeOrder) {
      if (request.dependencyGraph) {
        filePaths = await this.optimizeUpdateOrder(filePaths, request.dependencyGraph);
      }
      result.updateOrder = filePaths; // 总是设置更新顺序
    }

    // 处理每个文件
    for (const filePath of filePaths) {
      try {
        const singleRequest: UpdateRequest = {
          type: 'single',
          filePath,
          reason: request.reason,
          timestamp: request.timestamp,
          options: request.options
        };

        const singleResult = await this.processSingleUpdate(singleRequest);
        
        if (singleResult.success) {
          result.updatedFiles.push(...singleResult.updatedFiles);
          result.processedCount += singleResult.processedCount;
          result.skippedCount += singleResult.skippedCount;
          result.cacheHitCount += singleResult.cacheHitCount;
        } else {
          result.success = false;
          if (singleResult.errors) {
            result.errors!.push(...singleResult.errors);
          }
          
          // 如果不继续处理错误，则停止
          if (!request.options?.continueOnError) {
            break;
          }
        }
      } catch (error) {
        result.success = false;
        result.errors!.push((error as Error).message);
        
        if (!request.options?.continueOnError) {
          break;
        }
      }
    }

    return result;
  }

  /**
   * 处理级联更新
   */
  private async processCascadeUpdate(request: UpdateRequest): Promise<UpdateResult> {
    if (!request.filePath || !request.dependencyGraph) {
      throw new Error('级联更新需要提供 filePath 和 dependencyGraph');
    }

    // 获取受影响的文件
    const affectedFiles = await this.analyzeChangeImpact(request.filePath, request.dependencyGraph);
    
    // 创建批量更新请求
    const batchRequest: UpdateRequest = {
      type: 'batch',
      filePaths: [request.filePath, ...affectedFiles],
      reason: request.reason,
      timestamp: request.timestamp,
      dependencyGraph: request.dependencyGraph,
      options: { ...request.options, optimizeOrder: true }
    };

    return await this.processBatchUpdate(batchRequest);
  }

  /**
   * 处理智能更新
   */
  private async processSmartUpdate(request: UpdateRequest): Promise<UpdateResult> {
    if (!request.filePath) {
      throw new Error('智能更新需要提供 filePath');
    }

    // 检查缓存状态
    if (request.options?.useCache && await this.isCacheValid(request.filePath)) {
      return {
        success: true,
        updatedFiles: [],
        processedCount: 0,
        skippedCount: 1,
        cacheHitCount: 1,
        duration: 0
      };
    }

    // 使用单文件更新处理
    const result = await this.processSingleUpdate(request);
    
    // 如果使用了缓存选项且文件被处理，增加缓存命中计数
    if (request.options?.useCache && result.success) {
      result.cacheHitCount = result.cacheHitCount || 0;
    }
    
    return result;
  }

  /**
   * 优化更新顺序（基于依赖关系）
   */
  private async optimizeUpdateOrder(filePaths: string[], dependencyGraph: DependencyGraph): Promise<string[]> {
    // 使用拓扑排序来优化更新顺序 - 依赖的文件应该先更新
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: string[] = [];
    const fileSet = new Set(filePaths);

    const dfs = (filePath: string) => {
      if (visited.has(filePath)) return;
      if (visiting.has(filePath)) return; // 跳过循环依赖

      visiting.add(filePath);

      // 获取当前文件的直接依赖
      const dependencies = dependencyGraph.getDependencies(filePath);
      for (const dep of dependencies) {
        // 只处理需要更新的文件列表中的依赖
        if (fileSet.has(dep)) {
          dfs(dep);
        }
      }

      visiting.delete(filePath);
      visited.add(filePath);
      sorted.push(filePath); // 先加入依赖，再加入依赖者
    };

    // 对所有文件进行拓扑排序
    for (const filePath of filePaths) {
      if (!visited.has(filePath)) {
        dfs(filePath);
      }
    }

    return sorted;
  }

  /**
   * 获取并发控制槽
   */
  private async acquireConcurrencySlot(filePath: string): Promise<void> {
    while (this.semaphore.size >= this.config.maxConcurrentUpdates) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.semaphore.add(filePath);
  }

  /**
   * 释放并发控制槽
   */
  private releaseConcurrencySlot(filePath: string): void {
    this.semaphore.delete(filePath);
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(filePath: string): Promise<string> {
    return await fs.promises.readFile(filePath, 'utf8');
  }

  /**
   * 计算文件哈希
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filePath);
      const hash = crypto.createHash('md5').update(content).digest('hex');
      
      // 更新哈希缓存
      this.hashCache.set(filePath, hash);
      
      return hash;
    } catch (error) {
      throw new Error(`计算文件哈希失败: ${(error as Error).message}`);
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics(): UpdateStatistics {
    const memoryUsage = process.memoryUsage();
    
    return {
      ...this.statistics,
      memoryUsage: {
        used: memoryUsage.heapUsed,
        cached: this.config.contextCache.currentMemoryUsage,
        total: memoryUsage.heapTotal
      }
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.statistics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      totalProcessedFiles: 0,
      averageUpdateTime: 0,
      cacheHitRate: 0
    };
    this.updateTimes = [];
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): PerformanceReport {
    const sortedTimes = [...this.updateTimes].sort((a, b) => a - b);
    const len = sortedTimes.length;

    const getPercentile = (p: number): number => {
      if (len === 0) return 0;
      const index = Math.ceil(len * p / 100) - 1;
      return sortedTimes[Math.max(0, Math.min(index, len - 1))] ?? 0;
    };

    const totalTime = this.updateTimes.reduce((sum, time) => sum + time, 0);
    const avgTime = len > 0 ? totalTime / len : 0;

    // 如果没有数据，返回默认值
    const p50 = len > 0 ? getPercentile(50) : 1; // 至少返回1ms避免0值
    const p95 = len > 0 ? getPercentile(95) : 1;
    const p99 = len > 0 ? getPercentile(99) : 1;

    return {
      updateTimePercentiles: {
        p50,
        p95,
        p99
      },
      throughput: {
        updatesPerSecond: avgTime > 0 ? 1000 / avgTime : 0,
        filesPerSecond: this.statistics.totalProcessedFiles > 0 && totalTime > 0 
          ? (this.statistics.totalProcessedFiles * 1000) / totalTime : 0
      },
      resourceUsage: {
        peakMemory: len > 0 ? Math.max(50 * 1024 * 1024, process.memoryUsage().heapUsed) : 50 * 1024 * 1024,
        averageCpu: 0 // CPU使用率需要额外的监控
      }
    };
  }

  /**
   * 销毁引擎，清理资源
   */
  async destroy(): Promise<void> {
    this.destroyed = true;
    
    // 清理缓存
    await this.hashCache.destroy();
    
    // 清理统计数据
    this.resetStatistics();
    
    // 清理信号量
    this.semaphore.clear();
  }
}