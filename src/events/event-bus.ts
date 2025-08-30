/**
 * 🟢 TDD 绿阶段：事件总线系统实现
 * 统一的事件分发机制
 */

import { EventEmitter } from 'events';

/**
 * 基础事件接口
 */
export interface EventBusEvent {
  /** 事件类型 */
  type: string;
  /** 事件唯一标识符 */
  id: string;
  /** 事件时间戳 */
  timestamp: number;
  /** 事件数据 */
  data?: any;
}

/**
 * 事件优先级枚举
 */
export enum EventPriority {
  CRITICAL = 1000,
  HIGH = 500,
  NORMAL = 100,
  LOW = 50
}

/**
 * 事件总线配置接口
 */
export interface EventBusConfig {
  /** 最大监听器数量 */
  maxListeners?: number;
  /** 是否启用错误恢复 */
  enableErrorRecovery?: boolean;
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 监听器包装器接口
 */
interface ListenerWrapper {
  /** 原始监听器函数 */
  listener: (event: any) => void | Promise<void>;
  /** 优先级 */
  priority: number;
  /** 是否为一次性监听器 */
  once: boolean;
}

/**
 * 事件总线统计信息接口
 */
export interface EventBusStats {
  /** 总事件数量 */
  totalEvents: number;
  /** 总监听器数量 */
  totalListeners: number;
  /** 事件类型集合 */
  eventTypes: Set<string>;
  /** 错误数量 */
  errorCount: number;
  /** 启动时间 */
  startTime: Date | null;
}

/**
 * 事件总线类
 * 
 * 提供统一的事件分发机制，支持优先级、异步处理、错误恢复等功能。
 * 用于在文件监听系统的各个组件之间进行解耦的通信。
 */
export class EventBus {
  /** 内部事件发射器 */
  private emitter: EventEmitter;
  
  /** 事件总线配置 */
  private config: Required<EventBusConfig>;
  
  /** 事件总线是否处于活跃状态 */
  private active: boolean = true;
  
  /** 监听器映射（事件类型 -> 监听器包装器数组） */
  private listeners: Map<string, ListenerWrapper[]> = new Map();
  
  /** 统计信息 */
  private stats: EventBusStats = {
    totalEvents: 0,
    totalListeners: 0,
    eventTypes: new Set(),
    errorCount: 0,
    startTime: new Date()
  };

  /**
   * 构造函数
   * 
   * @param config 事件总线配置
   */
  constructor(config: EventBusConfig = {}) {
    this.config = {
      maxListeners: config.maxListeners ?? 100,
      enableErrorRecovery: config.enableErrorRecovery ?? true,
      logLevel: config.logLevel ?? 'error'
    };

    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(this.config.maxListeners);
  }

  /**
   * 检查事件总线是否处于活跃状态
   */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * 获取事件总线配置
   */
  getConfig(): Required<EventBusConfig> {
    return { ...this.config };
  }

  /**
   * 启动事件总线
   */
  start(): void {
    this.active = true;
    this.stats.startTime = new Date();
  }

  /**
   * 停止事件总线
   */
  stop(): void {
    this.active = false;
  }

  /**
   * 销毁事件总线
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.emitter.removeAllListeners();
    this.stats = {
      totalEvents: 0,
      totalListeners: 0,
      eventTypes: new Set(),
      errorCount: 0,
      startTime: null
    };
  }

  /**
   * 监听事件
   * 
   * @param eventType 事件类型
   * @param listener 监听器函数
   * @param priority 优先级
   */
  on<T extends EventBusEvent>(
    eventType: string,
    listener: (event: T) => void | Promise<void>,
    priority: number | EventPriority = EventPriority.NORMAL
  ): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const wrapper: ListenerWrapper = {
      listener,
      priority: typeof priority === 'number' ? priority : priority,
      once: false
    };

    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.push(wrapper);
    
    // 按优先级排序（高优先级在前）
    eventListeners.sort((a, b) => b.priority - a.priority);

    this.stats.totalListeners++;
    this.stats.eventTypes.add(eventType);
  }

  /**
   * 一次性监听事件
   * 
   * @param eventType 事件类型
   * @param listener 监听器函数
   * @param priority 优先级
   */
  once<T extends EventBusEvent>(
    eventType: string,
    listener: (event: T) => void | Promise<void>,
    priority: number | EventPriority = EventPriority.NORMAL
  ): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const wrapper: ListenerWrapper = {
      listener,
      priority: typeof priority === 'number' ? priority : priority,
      once: true
    };

    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.push(wrapper);
    
    // 按优先级排序（高优先级在前）
    eventListeners.sort((a, b) => b.priority - a.priority);

    this.stats.totalListeners++;
    this.stats.eventTypes.add(eventType);
  }

  /**
   * 移除事件监听器
   * 
   * @param eventType 事件类型
   * @param listener 监听器函数
   */
  off(eventType: string, listener: Function): void {
    const eventListeners = this.listeners.get(eventType);
    if (!eventListeners) {
      return;
    }

    const index = eventListeners.findIndex(wrapper => wrapper.listener === listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
      this.stats.totalListeners--;

      // 如果该事件类型没有监听器了，移除映射
      if (eventListeners.length === 0) {
        this.listeners.delete(eventType);
        this.stats.eventTypes.delete(eventType);
      }
    }
  }

  /**
   * 移除特定事件类型的所有监听器
   * 
   * @param eventType 事件类型
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      const eventListeners = this.listeners.get(eventType);
      if (eventListeners) {
        this.stats.totalListeners -= eventListeners.length;
        this.listeners.delete(eventType);
        this.stats.eventTypes.delete(eventType);
      }
    } else {
      // 移除所有监听器
      this.listeners.clear();
      this.stats.totalListeners = 0;
      this.stats.eventTypes.clear();
    }
  }

  /**
   * 发布事件
   * 
   * @param event 事件对象
   */
  async emit<T extends EventBusEvent>(event: T): Promise<void> {
    if (!this.active) {
      return; // 总线未启动，忽略事件
    }

    this.stats.totalEvents++;
    this.stats.eventTypes.add(event.type);

    const eventListeners = this.listeners.get(event.type);
    if (!eventListeners || eventListeners.length === 0) {
      return; // 没有监听器
    }

    // 执行所有监听器
    const promises: Promise<void>[] = [];
    const listenersToRemove: ListenerWrapper[] = [];

    for (const wrapper of eventListeners) {
      try {
        const result = wrapper.listener(event);
        
        if (result instanceof Promise) {
          promises.push(
            result.catch((error: Error) => {
              this.handleListenerError(error, event.type);
            })
          );
        }

        // 标记一次性监听器待移除
        if (wrapper.once) {
          listenersToRemove.push(wrapper);
        }
      } catch (error) {
        this.handleListenerError(error as Error, event.type);
      }
    }

    // 移除一次性监听器
    if (listenersToRemove.length > 0) {
      const eventListenerArray = this.listeners.get(event.type)!;
      for (const wrapper of listenersToRemove) {
        const index = eventListenerArray.indexOf(wrapper);
        if (index !== -1) {
          eventListenerArray.splice(index, 1);
          this.stats.totalListeners--;
        }
      }

      // 如果没有监听器了，清理映射
      if (eventListenerArray.length === 0) {
        this.listeners.delete(event.type);
        this.stats.eventTypes.delete(event.type);
      }
    }

    // 等待所有异步监听器完成
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): EventBusStats {
    return {
      ...this.stats,
      eventTypes: new Set(this.stats.eventTypes) // 返回副本
    };
  }

  /**
   * 处理监听器异常
   * 
   * @param error 异常对象
   * @param eventType 事件类型
   * @private
   */
  private handleListenerError(error: Error, eventType: string): void {
    this.stats.errorCount++;

    if (this.config.enableErrorRecovery) {
      // 可以在这里实现错误恢复逻辑，比如重试或记录日志
      if (this.config.logLevel === 'debug' || this.config.logLevel === 'error') {
        console.error(`EventBus监听器异常 [${eventType}]:`, error);
      }
    }

    // 发布内部错误事件（避免递归）
    if (eventType !== 'error-event') {
      const errorEvent = {
        type: 'error-event',
        id: `error-${Date.now()}`,
        timestamp: Date.now(),
        data: { error, originalEventType: eventType }
      };

      // 异步发布错误事件，避免阻塞
      setImmediate(() => {
        this.emit(errorEvent).catch(() => {
          // 忽略错误事件的异常，防止无限递归
        });
      });
    }
  }
}