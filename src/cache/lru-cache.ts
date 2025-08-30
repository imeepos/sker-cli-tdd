/**
 * 🟢 TDD 绿阶段：LRU缓存实现
 * 实现内存限制和淘汰策略、缓存命中率统计、序列化存储支持
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 缓存项配置接口
 */
export interface CacheItemOptions {
  /** TTL过期时间（毫秒） */
  ttl?: number;
}

/**
 * LRU缓存配置接口
 */
export interface LRUCacheConfig {
  /** 最大缓存项数量 */
  maxSize: number;
  /** 最大内存使用量（字节） */
  maxMemoryBytes?: number;
  /** 大小估算函数 */
  estimateSize?: (key: any, value: any) => number;
  /** 持久化文件路径 */
  persistFile?: string;
  /** 是否自动持久化 */
  autoPersist?: boolean;
  /** 自动持久化间隔（毫秒） */
  persistInterval?: number;
  /** 默认TTL时间（毫秒） */
  defaultTTL?: number;
  /** 序列化器 */
  serializer?: CacheSerializer<any, any>;
}

/**
 * 序列化器接口
 */
export interface CacheSerializer<K, V> {
  serialize(key: K, value: V): string;
  deserialize(key: K, data: string): V;
}

/**
 * 缓存统计信息接口
 */
export interface CacheStats {
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 设置次数 */
  sets: number;
  /** 删除次数 */
  deletes: number;
  /** 淘汰次数 */
  evictions: number;
  /** 命中率 */
  hitRate: number;
  /** 当前大小 */
  currentSize: number;
  /** 最大大小 */
  maxSize: number;
  /** 当前内存使用量 */
  currentMemoryUsage: number;
  /** 最大内存限制 */
  maxMemoryUsage?: number;
}

/**
 * 缓存节点类
 */
class CacheNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public size: number = 0,
    public expireTime?: number,
    public prev: CacheNode<K, V> | null = null,
    public next: CacheNode<K, V> | null = null
  ) {}

  /**
   * 检查节点是否已过期
   */
  isExpired(): boolean {
    if (!this.expireTime) return false;
    return Date.now() > this.expireTime;
  }
}

/**
 * LRU缓存类
 * 
 * 实现Least Recently Used缓存策略，支持：
 * - 基于数量和内存的淘汰策略
 * - TTL过期机制
 * - 缓存统计和监控
 * - 序列化持久化存储
 * - 高性能双向链表实现
 */
export class LRUCache<K, V> {
  /** 缓存配置 */
  private config: LRUCacheConfig & {
    maxSize: number;
    estimateSize: (key: any, value: any) => number;
    serializer: CacheSerializer<any, any>;
    autoPersist: boolean;
    persistInterval: number;
  };
  
  /** 缓存映射表 */
  private cache: Map<K, CacheNode<K, V>> = new Map();
  
  /** 双向链表头节点（最近使用） */
  private head: CacheNode<K, V>;
  
  /** 双向链表尾节点（最久未使用） */
  private tail: CacheNode<K, V>;
  
  /** 当前内存使用量 */
  private memoryUsage: number = 0;
  
  /** 统计信息 */
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    hitRate: 0,
    currentSize: 0,
    maxSize: 0,
    currentMemoryUsage: 0,
    maxMemoryUsage: 0
  };
  
  /** 自动持久化定时器 */
  private persistTimer?: NodeJS.Timeout;

  /**
   * 构造函数
   */
  constructor(config: LRUCacheConfig) {
    // 验证配置
    if (config.maxSize <= 0) {
      throw new Error('最大大小必须大于0');
    }

    this.config = {
      maxSize: config.maxSize,
      maxMemoryBytes: config.maxMemoryBytes,
      estimateSize: config.estimateSize || this.defaultSizeEstimator,
      persistFile: config.persistFile,
      autoPersist: config.autoPersist || false,
      persistInterval: config.persistInterval || 5000,
      defaultTTL: config.defaultTTL,
      serializer: config.serializer || this.defaultSerializer
    };

    // 初始化双向链表
    this.head = new CacheNode<K, V>(null as any, null as any);
    this.tail = new CacheNode<K, V>(null as any, null as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;

    // 初始化统计信息
    this.stats.maxSize = this.config.maxSize;
    this.stats.maxMemoryUsage = this.config.maxMemoryBytes;

    // 启动自动持久化
    if (this.config.autoPersist && this.config.persistFile) {
      this.startAutoPersist();
    }
  }

  /**
   * 获取最大缓存大小
   */
  get maxSize(): number {
    return this.config.maxSize;
  }

  /**
   * 获取当前缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 获取最大内存限制
   */
  get maxMemoryBytes(): number | undefined {
    return this.config.maxMemoryBytes;
  }

  /**
   * 获取当前内存使用量
   */
  get currentMemoryUsage(): number {
    return this.memoryUsage;
  }

  /**
   * 设置缓存项
   */
  set(key: K, value: V, options?: CacheItemOptions): void {
    this.stats.sets++;

    // 计算TTL
    let expireTime: number | undefined;
    if (options?.ttl) {
      expireTime = Date.now() + options.ttl;
    } else if (this.config.defaultTTL) {
      expireTime = Date.now() + this.config.defaultTTL;
    }

    // 计算大小
    const size = this.config.estimateSize(key, value);

    const existingNode = this.cache.get(key);
    if (existingNode) {
      // 更新已存在的节点
      this.memoryUsage -= existingNode.size;
      existingNode.value = value;
      existingNode.size = size;
      existingNode.expireTime = expireTime;
      this.memoryUsage += size;
      
      // 移动到头部
      this.moveToHead(existingNode);
    } else {
      // 创建新节点
      const newNode = new CacheNode(key, value, size, expireTime);
      
      // 检查是否需要淘汰
      this.evictIfNeeded(size);
      
      // 添加到头部
      this.cache.set(key, newNode);
      this.addToHead(newNode);
      this.memoryUsage += size;
    }

    this.updateStats();
  }

  /**
   * 获取缓存项
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    
    if (!node) {
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    // 检查是否过期
    if (node.isExpired()) {
      this.delete(key);
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    this.stats.hits++;
    
    // 移动到头部（更新使用时间）
    this.moveToHead(node);
    this.updateStats();
    
    return node.value;
  }

  /**
   * 检查键是否存在
   */
  has(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    
    // 检查是否过期
    if (node.isExpired()) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 删除缓存项
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.stats.deletes++;
    
    // 从链表中移除
    this.removeNode(node);
    
    // 从映射中删除
    this.cache.delete(key);
    
    // 更新内存使用量
    this.memoryUsage -= node.size;
    
    this.updateStats();
    return true;
  }

  /**
   * 清空所有缓存项
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.memoryUsage = 0;
    this.updateStats();
  }

  /**
   * 获取所有键
   */
  keys(): K[] {
    this.cleanExpiredItems();
    return Array.from(this.cache.keys());
  }

  /**
   * 获取所有值
   */
  values(): V[] {
    this.cleanExpiredItems();
    return Array.from(this.cache.values()).map(node => node.value);
  }

  /**
   * 获取所有键值对
   */
  entries(): [K, V][] {
    this.cleanExpiredItems();
    return Array.from(this.cache.entries()).map(([key, node]) => [key, node.value]);
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;
    this.stats.evictions = 0;
    this.updateStats();
  }

  /**
   * 持久化缓存到文件
   */
  async persist(): Promise<void> {
    if (!this.config.persistFile) {
      return;
    }

    try {
      const data = {
        config: {
          maxSize: this.config.maxSize,
          maxMemoryBytes: this.config.maxMemoryBytes,
          defaultTTL: this.config.defaultTTL
        },
        entries: this.entries().map(([key, value]) => ({
          key: JSON.stringify(key),
          value: this.config.serializer.serialize(key, value),
          timestamp: Date.now()
        })),
        stats: this.stats,
        timestamp: Date.now()
      };

      // 确保目录存在
      const dir = path.dirname(this.config.persistFile);
      await fs.promises.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.promises.writeFile(
        this.config.persistFile,
        JSON.stringify(data, null, 2),
        'utf8'
      );
    } catch (error) {
      throw new Error(`持久化失败: ${(error as Error).message}`);
    }
  }

  /**
   * 从文件加载缓存
   */
  async load(): Promise<void> {
    if (!this.config.persistFile || !fs.existsSync(this.config.persistFile)) {
      return;
    }

    try {
      const fileContent = await fs.promises.readFile(this.config.persistFile, 'utf8');
      const data = JSON.parse(fileContent);

      if (data.entries && Array.isArray(data.entries)) {
        await this.clear();
        
        for (const entry of data.entries) {
          try {
            const key = JSON.parse(entry.key) as K;
            const value = this.config.serializer.deserialize(key, entry.value);
            this.set(key, value);
          } catch (serializeError) {
            // 跳过无法反序列化的项
            continue;
          }
        }
      }

      // 恢复统计信息（部分）
      if (data.stats) {
        this.stats.sets = data.stats.sets || 0;
        this.stats.deletes = data.stats.deletes || 0;
        this.stats.evictions = data.stats.evictions || 0;
      }
    } catch (error) {
      // 加载失败时静默处理，保持空缓存状态
    }
  }

  /**
   * 默认大小估算器
   */
  private defaultSizeEstimator(key: any, value: any): number {
    // 简单估算：字符串长度 * 2（假设Unicode字符）
    const keySize = typeof key === 'string' ? key.length * 2 : 50;
    const valueSize = typeof value === 'string' ? value.length * 2 : 100;
    return keySize + valueSize;
  }

  /**
   * 默认序列化器
   */
  private defaultSerializer: CacheSerializer<any, any> = {
    serialize: (_key: any, value: any) => {
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    },
    deserialize: (_key: any, data: string) => {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
  };

  /**
   * 添加节点到头部
   */
  private addToHead(node: CacheNode<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }

  /**
   * 移除节点
   */
  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
  }

  /**
   * 移动节点到头部
   */
  private moveToHead(node: CacheNode<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * 移除尾部节点
   */
  private removeTail(): CacheNode<K, V> | null {
    const lastNode = this.tail.prev;
    if (lastNode && lastNode !== this.head) {
      this.removeNode(lastNode);
      return lastNode;
    }
    return null;
  }

  /**
   * 在需要时进行淘汰
   */
  private evictIfNeeded(newItemSize: number): void {
    // 首先清理过期项
    this.cleanExpiredItems();

    // 检查内存限制（优先级更高）
    if (this.config.maxMemoryBytes) {
      while (this.memoryUsage + newItemSize > this.config.maxMemoryBytes && this.cache.size > 0) {
        const evicted = this.removeTail();
        if (evicted) {
          this.cache.delete(evicted.key);
          this.memoryUsage -= evicted.size;
          this.stats.evictions++;
        } else {
          break;
        }
      }
    }

    // 检查数量限制
    while (this.cache.size >= this.config.maxSize) {
      const evicted = this.removeTail();
      if (evicted) {
        this.cache.delete(evicted.key);
        this.memoryUsage -= evicted.size;
        this.stats.evictions++;
      } else {
        break;
      }
    }
  }

  /**
   * 清理过期项
   */
  private cleanExpiredItems(): void {
    const expiredKeys: K[] = [];
    
    for (const [key, node] of this.cache) {
      if (node.isExpired()) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.currentSize = this.cache.size;
    this.stats.currentMemoryUsage = this.memoryUsage;
    
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 启动自动持久化
   */
  private startAutoPersist(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
    }

    this.persistTimer = setInterval(async () => {
      try {
        await this.persist();
      } catch (error) {
        // 自动持久化失败时静默处理
      }
    }, this.config.persistInterval);
  }

  /**
   * 停止自动持久化
   */
  private stopAutoPersist(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = undefined;
    }
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    this.stopAutoPersist();
    await this.clear();
  }
}