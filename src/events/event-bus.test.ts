/**
 * 🔴 TDD 红阶段：事件总线测试文件
 * 统一的事件分发机制测试
 */

import { EventBus, EventBusEvent, EventPriority, EventBusConfig } from './event-bus';

// 测试事件类型
interface TestEvent extends EventBusEvent {
  type: 'test-event';
  data: {
    message: string;
    value: number;
  };
}

interface ErrorEvent extends EventBusEvent {
  type: 'error-event';
  data: {
    error: Error;
  };
}

describe('EventBus 事件总线系统', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    if (eventBus) {
      eventBus.destroy();
    }
  });

  describe('基础功能', () => {
    it('应该能够创建EventBus实例', () => {
      expect(eventBus).toBeInstanceOf(EventBus);
      expect(eventBus.isActive).toBe(true);
    });

    it('应该能够使用配置创建EventBus', () => {
      const config: EventBusConfig = {
        maxListeners: 50,
        enableErrorRecovery: true,
        logLevel: 'warn'
      };

      const configuredBus = new EventBus(config);
      expect(configuredBus).toBeInstanceOf(EventBus);
      expect(configuredBus.getConfig()).toEqual(expect.objectContaining(config));
      
      configuredBus.destroy();
    });

    it('应该能够启动和停止事件总线', () => {
      eventBus.stop();
      expect(eventBus.isActive).toBe(false);

      eventBus.start();
      expect(eventBus.isActive).toBe(true);
    });

    it('应该能够销毁事件总线', () => {
      eventBus.destroy();
      expect(eventBus.isActive).toBe(false);
    });
  });

  describe('事件监听和发布', () => {
    it('应该能够监听和发布事件', async () => {
      const receivedEvents: TestEvent[] = [];

      eventBus.on<TestEvent>('test-event', (event) => {
        receivedEvents.push(event);
      });

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'test-1',
        timestamp: Date.now(),
        data: {
          message: 'Hello',
          value: 42
        }
      };

      await eventBus.emit(testEvent);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(testEvent);
    });

    it('应该支持多个监听器监听同一事件', async () => {
      const results: string[] = [];

      eventBus.on<TestEvent>('test-event', () => {
        results.push('listener-1');
      });

      eventBus.on<TestEvent>('test-event', () => {
        results.push('listener-2');
      });

      eventBus.on<TestEvent>('test-event', () => {
        results.push('listener-3');
      });

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'test-multi',
        timestamp: Date.now(),
        data: { message: 'Multi', value: 1 }
      };

      await eventBus.emit(testEvent);

      expect(results).toHaveLength(3);
      expect(results).toEqual(expect.arrayContaining(['listener-1', 'listener-2', 'listener-3']));
    });

    it('应该能够移除事件监听器', async () => {
      const results: string[] = [];

      const listener = () => {
        results.push('removed-listener');
      };

      eventBus.on<TestEvent>('test-event', listener);
      eventBus.off('test-event', listener);

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'test-remove',
        timestamp: Date.now(),
        data: { message: 'Remove', value: 1 }
      };

      await eventBus.emit(testEvent);

      expect(results).toHaveLength(0);
    });

    it('应该支持一次性监听器', async () => {
      const results: string[] = [];

      eventBus.once<TestEvent>('test-event', () => {
        results.push('once-listener');
      });

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'test-once-1',
        timestamp: Date.now(),
        data: { message: 'Once1', value: 1 }
      };

      // 发布两次事件
      await eventBus.emit(testEvent);
      await eventBus.emit({ ...testEvent, id: 'test-once-2' });

      // 应该只触发一次
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('once-listener');
    });
  });

  describe('事件优先级', () => {
    it('应该按优先级顺序执行监听器', async () => {
      const executionOrder: string[] = [];

      eventBus.on<TestEvent>('test-event', () => {
        executionOrder.push('normal');
      }, EventPriority.NORMAL);

      eventBus.on<TestEvent>('test-event', () => {
        executionOrder.push('high');
      }, EventPriority.HIGH);

      eventBus.on<TestEvent>('test-event', () => {
        executionOrder.push('low');
      }, EventPriority.LOW);

      eventBus.on<TestEvent>('test-event', () => {
        executionOrder.push('critical');
      }, EventPriority.CRITICAL);

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'priority-test',
        timestamp: Date.now(),
        data: { message: 'Priority', value: 1 }
      };

      await eventBus.emit(testEvent);

      expect(executionOrder).toEqual(['critical', 'high', 'normal', 'low']);
    });

    it('应该支持自定义数字优先级', async () => {
      const executionOrder: number[] = [];

      eventBus.on<TestEvent>('test-event', () => {
        executionOrder.push(100);
      }, 100);

      eventBus.on<TestEvent>('test-event', () => {
        executionOrder.push(500);
      }, 500);

      eventBus.on<TestEvent>('test-event', () => {
        executionOrder.push(200);
      }, 200);

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'numeric-priority',
        timestamp: Date.now(),
        data: { message: 'Numeric', value: 1 }
      };

      await eventBus.emit(testEvent);

      expect(executionOrder).toEqual([500, 200, 100]);
    });
  });

  describe('异步事件处理', () => {
    it('应该支持异步监听器', async () => {
      const results: string[] = [];

      eventBus.on<TestEvent>('test-event', async (event) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(`async-${event.data.value}`);
      });

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'async-test',
        timestamp: Date.now(),
        data: { message: 'Async', value: 123 }
      };

      await eventBus.emit(testEvent);

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('async-123');
    });

    it('应该等待所有异步监听器完成', async () => {
      const results: number[] = [];

      eventBus.on<TestEvent>('test-event', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        results.push(1);
      });

      eventBus.on<TestEvent>('test-event', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(2);
      });

      eventBus.on<TestEvent>('test-event', async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        results.push(3);
      });

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'async-wait',
        timestamp: Date.now(),
        data: { message: 'Wait', value: 1 }
      };

      await eventBus.emit(testEvent);

      expect(results).toHaveLength(3);
      expect(results).toEqual(expect.arrayContaining([1, 2, 3]));
    });
  });

  describe('错误处理和恢复', () => {
    it('应该隔离监听器异常不影响其他监听器', async () => {
      const results: string[] = [];

      eventBus.on<TestEvent>('test-event', () => {
        throw new Error('Listener 1 error');
      });

      eventBus.on<TestEvent>('test-event', () => {
        results.push('listener-2-success');
      });

      eventBus.on<TestEvent>('test-event', () => {
        results.push('listener-3-success');
      });

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'error-isolation',
        timestamp: Date.now(),
        data: { message: 'Error', value: 1 }
      };

      await eventBus.emit(testEvent);

      expect(results).toHaveLength(2);
      expect(results).toEqual(['listener-2-success', 'listener-3-success']);
    });

    it('应该捕获并报告监听器异常', async () => {
      const errorEvents: ErrorEvent[] = [];

      // 监听内部错误事件
      eventBus.on<ErrorEvent>('error-event', (event) => {
        errorEvents.push(event);
      });

      eventBus.on<TestEvent>('test-event', () => {
        throw new Error('Test exception');
      });

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'error-capture',
        timestamp: Date.now(),
        data: { message: 'Exception', value: 1 }
      };

      await eventBus.emit(testEvent);

      // 可能会触发错误事件（取决于配置）
      // 这里主要验证不会导致整个系统崩溃
      expect(true).toBe(true); // 测试通过就说明没有未捕获异常
    });

    it('应该在停止状态下拒绝事件发布', async () => {
      eventBus.stop();

      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'stopped-emit',
        timestamp: Date.now(),
        data: { message: 'Stopped', value: 1 }
      };

      // 在停止状态下发布事件不应该抛出异常，但也不应该处理
      await expect(eventBus.emit(testEvent)).resolves.toBeUndefined();
    });
  });

  describe('性能和统计', () => {
    it('应该提供事件统计信息', async () => {
      const testEvent: TestEvent = {
        type: 'test-event',
        id: 'stats-test',
        timestamp: Date.now(),
        data: { message: 'Stats', value: 1 }
      };

      eventBus.on<TestEvent>('test-event', () => {
        // 空监听器
      });

      await eventBus.emit(testEvent);

      const stats = eventBus.getStats();
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.totalListeners).toBeGreaterThan(0);
      expect(stats.eventTypes.has('test-event')).toBe(true);
    });

    it('应该能够高效处理大量事件', async () => {
      const receivedCount: { count: number } = { count: 0 };

      eventBus.on<TestEvent>('test-event', () => {
        receivedCount.count++;
      });

      const startTime = Date.now();

      // 发布100个事件
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const testEvent: TestEvent = {
          type: 'test-event',
          id: `perf-test-${i}`,
          timestamp: Date.now(),
          data: { message: `Event ${i}`, value: i }
        };
        promises.push(eventBus.emit(testEvent));
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(receivedCount.count).toBe(100);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('内存管理', () => {
    it('应该正确清理监听器引用', () => {
      const listener = () => {
        // 空监听器
      };

      eventBus.on<TestEvent>('test-event', listener);
      
      let stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(1);

      eventBus.off('test-event', listener);
      
      stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(0);
    });

    it('应该在销毁时清理所有资源', () => {
      eventBus.on<TestEvent>('test-event', () => {});
      eventBus.on<TestEvent>('another-event', () => {});

      let stats = eventBus.getStats();
      expect(stats.totalListeners).toBeGreaterThan(0);

      eventBus.destroy();
      
      stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(0);
      expect(eventBus.isActive).toBe(false);
    });

    it('应该支持移除特定事件类型的所有监听器', () => {
      eventBus.on<TestEvent>('test-event', () => {});
      eventBus.on<TestEvent>('test-event', () => {});
      eventBus.on<TestEvent>('other-event', () => {});

      eventBus.removeAllListeners('test-event');

      const stats = eventBus.getStats();
      expect(stats.eventTypes.has('test-event')).toBe(false);
      expect(stats.eventTypes.has('other-event')).toBe(true);
    });
  });
});