/**
 * 🟢 TDD 绿阶段：变更事件防抖器实现
 * 批量处理文件变更事件，防止频繁更新
 */

import { EventEmitter } from 'events';
import { FileChangeEvent } from '../watchers/project-watcher';
import * as crypto from 'crypto';

/**
 * 防抖器配置接口
 */
export interface DebouncerConfig {
  /** 防抖延迟时间（毫秒） */
  debounceMs: number;
  /** 批处理大小，达到此大小时立即触发 */
  batchSize: number;
}

/**
 * 防抖批处理结果接口
 */
export interface DebouncedBatch {
  /** 批处理唯一标识符 */
  id: string;
  /** 批处理时间戳 */
  timestamp: number;
  /** 变更事件列表 */
  changes: FileChangeEvent[];
  /** 总变更数量 */
  totalChanges: number;
  /** 唯一文件数量 */
  uniqueFiles: number;
  /** 涉及的项目ID列表 */
  projectIds: string[];
}

/**
 * 变更事件防抖器类
 * 
 * 负责收集文件变更事件，进行去重和合并，然后批量发送给处理器。
 * 提供防抖功能以避免过于频繁的更新操作。
 */
export class ChangeDebouncer extends EventEmitter {
  /** 防抖器配置 */
  private config: DebouncerConfig;
  
  /** 防抖器是否处于活跃状态 */
  private active: boolean = false;
  
  /** 待处理的变更事件映射（文件路径 -> 事件） */
  private pendingChanges: Map<string, FileChangeEvent> = new Map();
  
  /** 防抖计时器 */
  private debounceTimer: NodeJS.Timeout | null = null;
  
  /** 批处理统计信息 */
  private batchCount: number = 0;

  /**
   * 构造函数
   * 
   * @param config 防抖器配置
   */
  constructor(config: DebouncerConfig) {
    super();
    this.config = { ...config };
  }

  /**
   * 启动防抖器
   */
  start(): void {
    this.active = true;
    this.emit('started');
  }

  /**
   * 停止防抖器
   */
  stop(): void {
    this.active = false;
    
    // 清除计时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // 如果有待处理的变更，立即处理
    if (this.pendingChanges.size > 0) {
      this.flushChanges();
    }
    
    this.emit('stopped');
  }

  /**
   * 检查防抖器是否处于活跃状态
   */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * 获取当前配置
   */
  getConfig(): DebouncerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   * 
   * @param config 新的配置
   */
  updateConfig(config: Partial<DebouncerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * 添加文件变更事件
   * 
   * @param event 文件变更事件
   */
  addChange(event: FileChangeEvent): void {
    if (!this.active) {
      return; // 防抖器未启动，忽略事件
    }

    // 合并同一文件的变更事件
    this.mergeChange(event);

    // 检查是否达到批处理大小
    if (this.pendingChanges.size >= this.config.batchSize) {
      this.flushChanges();
    } else {
      // 重置防抖计时器
      this.resetDebounceTimer();
    }
  }

  /**
   * 合并文件变更事件
   * 
   * @param event 新的变更事件
   * @private
   */
  private mergeChange(event: FileChangeEvent): void {
    const key = this.getChangeKey(event);
    const existing = this.pendingChanges.get(key);

    if (existing) {
      // 合并逻辑：后来的事件覆盖之前的事件，但保持时间戳为最新
      const mergedEvent: FileChangeEvent = {
        ...event,
        timestamp: Math.max(existing.timestamp, event.timestamp)
      };

      // 特殊处理：删除后添加 = 添加；添加后删除 = 删除
      if (existing.type === 'unlink' && event.type === 'add') {
        mergedEvent.type = 'add';
      } else if (existing.type === 'add' && event.type === 'unlink') {
        mergedEvent.type = 'unlink';
      }

      this.pendingChanges.set(key, mergedEvent);
    } else {
      this.pendingChanges.set(key, event);
    }
  }

  /**
   * 获取变更事件的唯一键
   * 
   * @param event 变更事件
   * @returns 唯一键
   * @private
   */
  private getChangeKey(event: FileChangeEvent): string {
    return `${event.projectId}:${event.path}`;
  }

  /**
   * 重置防抖计时器
   * 
   * @private
   */
  private resetDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushChanges();
    }, this.config.debounceMs);
  }

  /**
   * 清空待处理的变更并发送批处理事件
   * 
   * @private
   */
  private flushChanges(): void {
    if (this.pendingChanges.size === 0) {
      return;
    }

    // 清除计时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // 创建批处理对象
    const changes = Array.from(this.pendingChanges.values());
    const batch = this.createBatch(changes);

    // 清空待处理变更
    this.pendingChanges.clear();

    // 发送批处理事件 - 安全地调用所有监听器
    const listeners = this.listeners('batch');
    for (const listener of listeners) {
      try {
        if (typeof listener === 'function') {
          listener(batch);
        }
      } catch (error) {
        // 即使监听器抛出异常，也不应该影响防抖器的工作
        this.emit('error', error);
      }
    }
  }

  /**
   * 创建批处理对象
   * 
   * @param changes 变更事件列表
   * @returns 批处理对象
   * @private
   */
  private createBatch(changes: FileChangeEvent[]): DebouncedBatch {
    const uniqueFiles = new Set(changes.map(c => c.path)).size;
    const projectIds = Array.from(new Set(changes.map(c => c.projectId)));

    return {
      id: this.generateBatchId(),
      timestamp: Date.now(),
      changes,
      totalChanges: changes.length,
      uniqueFiles,
      projectIds
    };
  }

  /**
   * 生成批处理唯一标识符
   * 
   * @returns 唯一标识符
   * @private
   */
  private generateBatchId(): string {
    this.batchCount++;
    const timestamp = Date.now().toString();
    const counter = this.batchCount.toString();
    return crypto.createHash('md5')
      .update(timestamp + counter)
      .digest('hex')
      .substring(0, 8);
  }
}