/**
 * 🔴 TDD 红阶段：变更事件防抖器测试文件
 * 测试变更事件防抖器的批量处理功能
 */

import { ChangeDebouncer, DebouncedBatch } from './change-debouncer';
import { FileChangeEvent } from '../watchers/project-watcher';

describe('ChangeDebouncer 变更事件防抖器', () => {
  let debouncer: ChangeDebouncer;

  beforeEach(() => {
    debouncer = new ChangeDebouncer({
      debounceMs: 100,
      batchSize: 5
    });
  });

  // 助手函数：验证批处理结果
  const expectBatch = (events: DebouncedBatch[], index: number = 0) => {
    expect(events.length).toBeGreaterThan(index);
    const batch = events[index];
    expect(batch).toBeDefined();
    return batch as DebouncedBatch;
  };

  afterEach(() => {
    if (debouncer) {
      debouncer.stop();
    }
  });

  describe('基础功能', () => {
    it('应该能够创建ChangeDebouncer实例', () => {
      expect(debouncer).toBeInstanceOf(ChangeDebouncer);
      expect(debouncer.isActive).toBe(false);
    });

    it('应该能够启动和停止防抖器', () => {
      debouncer.start();
      expect(debouncer.isActive).toBe(true);

      debouncer.stop();
      expect(debouncer.isActive).toBe(false);
    });

    it('应该能够获取当前配置', () => {
      const config = debouncer.getConfig();
      expect(config.debounceMs).toBe(100);
      expect(config.batchSize).toBe(5);
    });

    it('应该能够更新配置', () => {
      debouncer.updateConfig({
        debounceMs: 200,
        batchSize: 10
      });

      const config = debouncer.getConfig();
      expect(config.debounceMs).toBe(200);
      expect(config.batchSize).toBe(10);
    });
  });

  describe('事件防抖处理', () => {
    it('应该能够接收文件变更事件', async () => {
      const event: FileChangeEvent = {
        type: 'add',
        path: '/test/file.ts',
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      debouncer.start();
      
      // 应该不抛出异常
      expect(() => {
        debouncer.addChange(event);
      }).not.toThrow();
    });

    it('应该在防抖时间后触发批处理事件', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      // 添加测试事件
      const event: FileChangeEvent = {
        type: 'add',
        path: '/test/file1.ts',
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      debouncer.addChange(event);

      // 等待防抖时间
      await new Promise(resolve => setTimeout(resolve, 150));

      const batch = expectBatch(events);
      expect(batch.changes).toHaveLength(1);
      expect(batch.changes[0]).toEqual(event);
    });

    it('应该合并同一文件的多次变更', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      const filePath = '/test/same-file.ts';
      
      // 同一文件的多次变更
      debouncer.addChange({
        type: 'add',
        path: filePath,
        timestamp: Date.now(),
        projectId: 'test-project'
      });

      debouncer.addChange({
        type: 'change',
        path: filePath,
        timestamp: Date.now() + 10,
        projectId: 'test-project'
      });

      debouncer.addChange({
        type: 'change',
        path: filePath,
        timestamp: Date.now() + 20,
        projectId: 'test-project'
      });

      // 等待防抖时间
      await new Promise(resolve => setTimeout(resolve, 150));

      const batch = expectBatch(events);
      expect(batch.changes).toHaveLength(1);
      expect(batch.changes[0]?.type).toBe('change'); // 应该保留最后的变更类型
      expect(batch.changes[0]?.path).toBe(filePath);
    });

    it('应该在达到批大小时立即触发批处理', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      // 添加足够的事件以触发批处理（批大小为5）
      for (let i = 0; i < 5; i++) {
        debouncer.addChange({
          type: 'add',
          path: `/test/file${i}.ts`,
          timestamp: Date.now(),
          projectId: 'test-project'
        });
      }

      // 应该立即触发，不需要等待防抖时间
      await new Promise(resolve => setTimeout(resolve, 10));

      const batch = expectBatch(events);
      expect(batch.changes).toHaveLength(5);
    });
  });

  describe('事件去重和合并', () => {
    it('应该去重相同的事件', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      const identicalEvent: FileChangeEvent = {
        type: 'add',
        path: '/test/duplicate.ts',
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 添加相同的事件多次
      debouncer.addChange(identicalEvent);
      debouncer.addChange(identicalEvent);
      debouncer.addChange(identicalEvent);

      await new Promise(resolve => setTimeout(resolve, 150));

      const batch = expectBatch(events);
      expect(batch.changes).toHaveLength(1);
    });

    it('应该正确处理文件删除后添加的情况', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      const filePath = '/test/delete-then-add.ts';

      // 先删除后添加
      debouncer.addChange({
        type: 'unlink',
        path: filePath,
        timestamp: Date.now(),
        projectId: 'test-project'
      });

      debouncer.addChange({
        type: 'add',
        path: filePath,
        timestamp: Date.now() + 10,
        projectId: 'test-project'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const batch = expectBatch(events);
      expect(batch.changes).toHaveLength(1);
      expect(batch.changes[0]?.type).toBe('add'); // 应该只保留最终的添加事件
    });

    it('应该正确处理文件添加后删除的情况', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      const filePath = '/test/add-then-delete.ts';

      // 先添加后删除
      debouncer.addChange({
        type: 'add',
        path: filePath,
        timestamp: Date.now(),
        projectId: 'test-project'
      });

      debouncer.addChange({
        type: 'unlink',
        path: filePath,
        timestamp: Date.now() + 10,
        projectId: 'test-project'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const batch = expectBatch(events);
      expect(batch.changes).toHaveLength(1);
      expect(batch.changes[0]?.type).toBe('unlink'); // 应该只保留最终的删除事件
    });
  });

  describe('批处理信息', () => {
    it('批处理应该包含正确的元数据', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      debouncer.addChange({
        type: 'add',
        path: '/test/metadata-test.ts',
        timestamp: Date.now(),
        projectId: 'test-project'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const batch = expectBatch(events);
      
      expect(batch.id).toBeDefined();
      expect(batch.timestamp).toBeDefined();
      expect(batch.totalChanges).toBe(1);
      expect(batch.uniqueFiles).toBe(1);
      expect(batch.projectIds).toEqual(['test-project']);
    });

    it('批处理应该统计多个项目的变更', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      debouncer.addChange({
        type: 'add',
        path: '/project1/file.ts',
        timestamp: Date.now(),
        projectId: 'project-1'
      });

      debouncer.addChange({
        type: 'change',
        path: '/project2/file.js',
        timestamp: Date.now(),
        projectId: 'project-2'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const batch = expectBatch(events);
      
      expect(batch.totalChanges).toBe(2);
      expect(batch.uniqueFiles).toBe(2);
      expect(batch.projectIds).toEqual(expect.arrayContaining(['project-1', 'project-2']));
    });
  });

  describe('性能测试', () => {
    it('应该能够高效处理大量事件', async () => {
      const events: DebouncedBatch[] = [];
      
      debouncer.on('batch', (batch: DebouncedBatch) => {
        events.push(batch);
      });

      debouncer.start();

      const startTime = Date.now();
      
      // 添加1000个事件
      for (let i = 0; i < 1000; i++) {
        debouncer.addChange({
          type: 'add',
          path: `/test/file${i}.ts`,
          timestamp: Date.now(),
          projectId: `project-${i % 10}` // 10个不同项目
        });
      }

      const addTime = Date.now() - startTime;

      // 等待所有批处理完成
      await new Promise(resolve => setTimeout(resolve, 200));

      // 添加1000个事件应该很快（少于100ms）
      expect(addTime).toBeLessThan(100);
      
      // 验证所有事件都被处理了
      const totalProcessedChanges = events.reduce((sum, batch) => sum + batch.totalChanges, 0);
      expect(totalProcessedChanges).toBe(1000);
    });
  });

  describe('错误处理', () => {
    it('应该在未启动时优雅拒绝事件', () => {
      const event: FileChangeEvent = {
        type: 'add',
        path: '/test/not-started.ts',
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 不启动防抖器，直接添加事件
      expect(() => {
        debouncer.addChange(event);
      }).not.toThrow(); // 不应该抛出异常，但也不应该处理事件
    });

    it('应该在监听器抛出异常时继续工作', async () => {
      const normalEvents: DebouncedBatch[] = [];
      const errors: Error[] = [];

      // 添加错误监听器来捕获异常
      debouncer.on('error', (error: Error) => {
        errors.push(error);
      });

      // 添加一个会抛出异常的监听器
      debouncer.on('batch', () => {
        throw new Error('测试异常');
      });

      // 添加一个正常的监听器
      debouncer.on('batch', (batch: DebouncedBatch) => {
        normalEvents.push(batch);
      });

      debouncer.start();

      debouncer.addChange({
        type: 'add',
        path: '/test/error-test.ts',
        timestamp: Date.now(),
        projectId: 'test-project'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      // 正常监听器应该仍然收到事件
      expect(normalEvents.length).toBe(1);
      // 应该捕获到异常
      expect(errors.length).toBe(1);
      expect(errors[0]!.message).toBe('测试异常');
    });
  });
});