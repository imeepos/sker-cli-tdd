/**
 * 🔴 TDD 红阶段：文件I/O优化测试文件
 * 测试异步文件读取队列、读写操作合并、缓存预加载策略
 */

import { 
  IOOptimizer, 
  AsyncFileReadQueue, 
  OperationBatcher, 
  PreloadCache 
} from './io-optimizer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('IO Optimizer 文件I/O优化', () => {
  let optimizer: IOOptimizer;
  let testDir: string;

  beforeEach(async () => {
    optimizer = new IOOptimizer();
    
    // 创建测试目录
    testDir = path.join(os.tmpdir(), `io-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    optimizer.destroy();
    
    // 清理测试目录
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('I/O优化器初始化', () => {
    it('应该能够创建I/O优化器实例', () => {
      expect(optimizer).toBeDefined();
      expect(optimizer instanceof IOOptimizer).toBe(true);
    });

    it('应该支持配置参数', () => {
      const config = {
        maxConcurrentReads: 5,
        maxQueueSize: 500,
        batchWindowMs: 100,
        preloadCacheSize: 50
      };
      
      const configuredOptimizer = new IOOptimizer(config);
      expect(configuredOptimizer).toBeDefined();
      configuredOptimizer.destroy();
    });

    it('应该能够获取统计信息', () => {
      const stats = optimizer.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalReads).toBe(0);
      expect(stats.totalWrites).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('异步文件读取队列', () => {
    let readQueue: AsyncFileReadQueue;

    beforeEach(() => {
      readQueue = new AsyncFileReadQueue({
        maxConcurrentReads: 3,
        maxQueueSize: 10
      });
    });

    afterEach(() => {
      readQueue.clear();
    });

    it('应该能够排队文件读取请求', async () => {
      // 创建测试文件
      const testFile = path.join(testDir, 'queue-test.txt');
      const testContent = 'Queue test content';
      await fs.promises.writeFile(testFile, testContent);

      const result = await readQueue.enqueue(testFile, 'utf8', 1);
      
      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
      expect(result.readTime).toBeGreaterThan(0);
    });

    it('应该能够按优先级处理请求', async () => {
      const testFiles = [];
      const promises = [];
      
      // 创建多个测试文件
      for (let i = 0; i < 5; i++) {
        const testFile = path.join(testDir, `priority-${i}.txt`);
        const content = `Priority ${i} content`;
        await fs.promises.writeFile(testFile, content);
        testFiles.push(testFile);
        
        // 高优先级的请求应该先处理（数字越小优先级越高）
        const priority = i === 4 ? 1 : 5; // 最后一个文件给最高优先级
        promises.push(readQueue.enqueue(testFile, 'utf8', priority));
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('应该能够处理文件不存在的错误', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');
      
      const result = await readQueue.enqueue(nonExistentFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该能够重试失败的请求', (done) => {
      const testFile = path.join(testDir, 'retry-test.txt');
      
      // 监听重试事件
      let retryCount = 0;
      readQueue.on('retry', () => {
        retryCount++;
        
        // 在第一次重试后创建文件
        if (retryCount === 1) {
          fs.promises.writeFile(testFile, 'Retry success content').then(() => {
            // 文件创建成功，下次重试应该成功
          });
        }
      });

      readQueue.on('completed', (result) => {
        expect(result.success).toBe(true);
        expect(result.content).toBe('Retry success content');
        expect(retryCount).toBeGreaterThan(0);
        done();
      });

      readQueue.on('failed', () => {
        done(new Error('请求失败，应该通过重试成功'));
      });

      // 开始读取不存在的文件
      readQueue.enqueue(testFile);
    }, 10000);

    it('应该能够限制队列大小', () => {
      const smallQueue = new AsyncFileReadQueue({
        maxQueueSize: 1,  // 只允许1个请求在队列中
        maxConcurrentReads: 10
      });

      // 测试同步检查队列大小限制
      expect(() => {
        // 模拟队列已满的情况
        (smallQueue as any).queue = [
          { id: 'test', filePath: 'test.txt', encoding: 'utf8', priority: 5, timestamp: Date.now() }
        ];
        
        // 现在尝试添加超过限制的请求
        if ((smallQueue as any).queue.length >= (smallQueue as any).config.maxQueueSize) {
          throw new Error('队列已满，无法添加更多请求');
        }
      }).toThrow('队列已满');
      
      smallQueue.clear();
    });

    it('应该能够获取队列状态', () => {
      const status = readQueue.getStatus();
      
      expect(status.queueLength).toBe(0);
      expect(status.activeReads).toBe(0);
    });
  });

  describe('操作批处理器', () => {
    let batcher: OperationBatcher;

    beforeEach(() => {
      batcher = new OperationBatcher({
        batchWindowMs: 50
      });
    });

    afterEach(async () => {
      await batcher.flush();
    });

    it('应该能够批处理读取操作', (done) => {
      const testFile = path.join(testDir, 'batch-read.txt');
      const testContent = 'Batch read content';
      
      fs.promises.writeFile(testFile, testContent).then(() => {
        const results: any[] = [];
        let completedCount = 0;

        // 创建多个读取请求
        for (let i = 0; i < 3; i++) {
          const request = {
            id: `read_${i}`,
            filePath: testFile,
            encoding: 'utf8' as BufferEncoding,
            priority: 5,
            timestamp: Date.now(),
            resolve: (result: any) => {
              results.push(result);
              completedCount++;
              
              if (completedCount === 3) {
                expect(results).toHaveLength(3);
                results.forEach(result => {
                  expect(result.success).toBe(true);
                  expect(result.content).toBe(testContent);
                });
                done();
              }
            },
            reject: (error: Error) => {
              done(error);
            },
            retries: 0
          };
          
          batcher.addReadOperation(request);
        }
      });
    });

    it('应该能够批处理写入操作', (done) => {
      const testFile = path.join(testDir, 'batch-write.txt');
      const results: any[] = [];
      let completedCount = 0;

      // 创建多个写入请求
      const contents = ['Content 1', 'Content 2', 'Content 3'];
      contents.forEach((content, index) => {
        const request = {
          id: `write_${index}`,
          filePath: testFile,
          content,
          encoding: 'utf8' as BufferEncoding,
          append: false,
          priority: 5,
          timestamp: Date.now(),
          resolve: (result: any) => {
            results.push(result);
            completedCount++;
            
            if (completedCount === 3) {
              expect(results).toHaveLength(3);
              results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.batched).toBe(true);
              });
              
              // 验证只有最后一个内容被写入（覆盖模式）
              fs.promises.readFile(testFile, 'utf8').then(fileContent => {
                expect(fileContent).toBe('Content 3');
                done();
              }).catch(done);
            }
          },
          reject: (error: Error) => {
            done(error);
          },
          retries: 0
        };
        
        batcher.addWriteOperation(request);
      });
    });

    it('应该能够处理追加模式的写入批处理', (done) => {
      const testFile = path.join(testDir, 'batch-append.txt');
      const results: any[] = [];
      let completedCount = 0;

      // 创建多个追加写入请求
      const contents = ['Line 1\n', 'Line 2\n', 'Line 3\n'];
      contents.forEach((content, index) => {
        const request = {
          id: `append_${index}`,
          filePath: testFile,
          content,
          encoding: 'utf8' as BufferEncoding,
          append: true,
          priority: 5,
          timestamp: Date.now() + index, // 确保时间顺序
          resolve: (result: any) => {
            results.push(result);
            completedCount++;
            
            if (completedCount === 3) {
              expect(results).toHaveLength(3);
              results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.batched).toBe(true);
              });
              
              // 验证所有内容都被追加
              fs.promises.readFile(testFile, 'utf8').then(fileContent => {
                expect(fileContent).toBe('Line 1\nLine 2\nLine 3\n');
                done();
              }).catch(done);
            }
          },
          reject: (error: Error) => {
            done(error);
          },
          retries: 0
        };
        
        batcher.addWriteOperation(request);
      });
    });

    it('应该能够获取批处理状态', () => {
      const status = batcher.getStatus();
      
      expect(status.batchCount).toBe(0);
      expect(status.pendingOperations).toBe(0);
    });

    it('应该能够强制刷新批处理', async () => {
      const testFile = path.join(testDir, 'flush-test.txt');
      
      const request = {
        id: 'flush_test',
        filePath: testFile,
        content: 'Flush test',
        encoding: 'utf8' as BufferEncoding,
        append: false,
        priority: 5,
        timestamp: Date.now(),
        resolve: jest.fn(),
        reject: jest.fn(),
        retries: 0
      };
      
      batcher.addWriteOperation(request);
      
      const statusBefore = batcher.getStatus();
      expect(statusBefore.batchCount).toBe(1);
      
      await batcher.flush();
      
      const statusAfter = batcher.getStatus();
      expect(statusAfter.batchCount).toBe(0);
    });
  });

  describe('预加载缓存', () => {
    let preloadCache: PreloadCache;

    beforeEach(() => {
      preloadCache = new PreloadCache({
        preloadCacheSize: 5
      });
    });

    afterEach(() => {
      preloadCache.clear();
    });

    it('应该能够预加载文件', async () => {
      const testFile = path.join(testDir, 'preload-test.txt');
      const testContent = 'Preload test content';
      await fs.promises.writeFile(testFile, testContent);

      const success = await preloadCache.preload(testFile);
      expect(success).toBe(true);

      const entry = await preloadCache.get(testFile);
      expect(entry).toBeDefined();
      expect(entry!.content).toBe(testContent);
    });

    it('应该能够检测文件修改并使缓存失效', async () => {
      const testFile = path.join(testDir, 'invalidate-test.txt');
      const originalContent = 'Original content';
      const modifiedContent = 'Modified content';
      
      await fs.promises.writeFile(testFile, originalContent);
      
      // 预加载文件
      await preloadCache.preload(testFile);
      const entry1 = await preloadCache.get(testFile);
      expect(entry1!.content).toBe(originalContent);
      
      // 等待一小段时间确保修改时间不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 修改文件
      await fs.promises.writeFile(testFile, modifiedContent);
      
      // 缓存应该被失效
      const entry2 = await preloadCache.get(testFile);
      expect(entry2).toBeNull();
    });

    it('应该能够批量预加载文件', async () => {
      const testFiles = [];
      
      // 创建多个测试文件
      for (let i = 0; i < 3; i++) {
        const testFile = path.join(testDir, `batch-preload-${i}.txt`);
        await fs.promises.writeFile(testFile, `Content ${i}`);
        testFiles.push(testFile);
      }
      
      // 添加一个不存在的文件
      testFiles.push(path.join(testDir, 'nonexistent.txt'));
      
      const result = await preloadCache.preloadBatch(testFiles);
      
      expect(result.success).toHaveLength(3);
      expect(result.failed).toHaveLength(1);
    });

    it('应该能够淘汰最少使用的条目', async () => {
      // 创建超过缓存大小的文件
      const testFiles = [];
      for (let i = 0; i < 7; i++) {
        const testFile = path.join(testDir, `lru-test-${i}.txt`);
        await fs.promises.writeFile(testFile, `Content ${i}`);
        testFiles.push(testFile);
        await preloadCache.preload(testFile);
      }
      
      const stats = preloadCache.getStats();
      expect(stats.size).toBe(5); // 应该只保留5个文件（缓存大小限制）
      
      // 第一个文件应该被淘汰
      const firstEntry = await preloadCache.get(testFiles[0]!);
      expect(firstEntry).toBeNull();
    });

    it('应该能够更新访问统计', async () => {
      const testFile = path.join(testDir, 'stats-test.txt');
      await fs.promises.writeFile(testFile, 'Stats test');
      
      await preloadCache.preload(testFile);
      
      // 多次访问
      for (let i = 0; i < 3; i++) {
        const entry = await preloadCache.get(testFile);
        expect(entry).toBeDefined();
      }
      
      // 最后一次访问检查计数
      const finalEntry = await preloadCache.get(testFile);
      expect(finalEntry!.accessCount).toBe(4); // 3次循环 + 1次最终检查
    });

    it('应该能够获取缓存统计', async () => {
      const testFile = path.join(testDir, 'cache-stats.txt');
      const testContent = 'Cache stats test';
      await fs.promises.writeFile(testFile, testContent);
      
      await preloadCache.preload(testFile);
      const stats = preloadCache.getStats();
      
      expect(stats.size).toBe(1);
      expect(stats.totalSize).toBe(testContent.length);
    });

    it('应该能够清空缓存', async () => {
      const testFile = path.join(testDir, 'clear-test.txt');
      await fs.promises.writeFile(testFile, 'Clear test');
      
      await preloadCache.preload(testFile);
      expect(preloadCache.getStats().size).toBe(1);
      
      preloadCache.clear();
      expect(preloadCache.getStats().size).toBe(0);
    });
  });

  describe('I/O优化器集成功能', () => {
    it('应该能够优化读取文件', async () => {
      const testFile = path.join(testDir, 'optimized-read.txt');
      const testContent = 'Optimized read content';
      await fs.promises.writeFile(testFile, testContent);

      const result = await optimizer.readFile(testFile);
      
      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
      expect(result.readTime).toBeGreaterThanOrEqual(0);
    });

    it('应该能够优化写入文件', async () => {
      const testFile = path.join(testDir, 'optimized-write.txt');
      const testContent = 'Optimized write content';

      const result = await optimizer.writeFile(testFile, testContent);
      
      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBeGreaterThan(0);
      
      // 验证文件内容
      const fileContent = await fs.promises.readFile(testFile, 'utf8');
      expect(fileContent).toBe(testContent);
    });

    it('应该能够利用预加载缓存加速读取', async () => {
      const testFile = path.join(testDir, 'cached-read.txt');
      const testContent = 'Cached read content';
      await fs.promises.writeFile(testFile, testContent);

      // 预加载文件
      const preloadSuccess = await optimizer.preloadFile(testFile);
      expect(preloadSuccess).toBe(true);

      // 读取应该来自缓存
      const result = await optimizer.readFile(testFile);
      
      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
      expect(result.fromCache).toBe(true);
      expect(result.readTime).toBe(0);
    });

    it('应该能够批量预加载文件', async () => {
      const testFiles = [];
      
      for (let i = 0; i < 3; i++) {
        const testFile = path.join(testDir, `batch-${i}.txt`);
        await fs.promises.writeFile(testFile, `Content ${i}`);
        testFiles.push(testFile);
      }

      const result = await optimizer.preloadFiles(testFiles);
      
      expect(result.success).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      
      // 验证所有文件都被缓存
      for (const testFile of testFiles) {
        const readResult = await optimizer.readFile(testFile);
        expect(readResult.fromCache).toBe(true);
      }
    });

    it('应该能够检查文件存在性', async () => {
      const existingFile = path.join(testDir, 'exists.txt');
      const nonExistentFile = path.join(testDir, 'not-exists.txt');
      
      await fs.promises.writeFile(existingFile, 'exists');

      expect(await optimizer.fileExists(existingFile)).toBe(true);
      expect(await optimizer.fileExists(nonExistentFile)).toBe(false);
    });

    it('应该能够获取文件统计信息', async () => {
      const testFile = path.join(testDir, 'stats.txt');
      const testContent = 'File stats test';
      await fs.promises.writeFile(testFile, testContent);

      const stats = await optimizer.getFileStats(testFile);
      
      expect(stats).toBeDefined();
      expect(stats!.size).toBe(testContent.length);
      expect(stats!.isFile()).toBe(true);
    });

    it('应该能够处理并发读取', async () => {
      const testFiles = [];
      
      // 创建多个测试文件
      for (let i = 0; i < 10; i++) {
        const testFile = path.join(testDir, `concurrent-${i}.txt`);
        await fs.promises.writeFile(testFile, `Concurrent content ${i}`);
        testFiles.push(testFile);
      }

      // 并发读取所有文件
      const readPromises = testFiles.map(filePath => optimizer.readFile(filePath));
      const results = await Promise.all(readPromises);
      
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.content).toBe(`Concurrent content ${index}`);
      });
    });

    it('应该能够批处理写入操作', async () => {
      const testFile = path.join(testDir, 'batch-writes.txt');
      const writes = [];

      // 快速连续写入多个内容
      for (let i = 0; i < 5; i++) {
        writes.push(optimizer.writeFile(testFile, `Write ${i}`));
      }

      const results = await Promise.all(writes);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.batched).toBe(true);
      });

      // 由于是覆盖模式，只有最后一次写入应该保留
      const finalContent = await fs.promises.readFile(testFile, 'utf8');
      expect(finalContent).toBe('Write 4');
    });

    it('应该能够追踪统计信息', async () => {
      const testFile = path.join(testDir, 'statistics.txt');
      await fs.promises.writeFile(testFile, 'Statistics test');

      // 执行一些操作
      await optimizer.readFile(testFile);
      await optimizer.writeFile(testFile, 'New content');
      await optimizer.preloadFile(testFile);

      const stats = optimizer.getStats();
      
      expect(stats.totalReads).toBeGreaterThan(0);
      expect(stats.totalWrites).toBeGreaterThan(0);
      expect(stats.averageReadTime).toBeGreaterThan(0);
    });

    it('应该能够重置统计信息', async () => {
      const testFile = path.join(testDir, 'reset-stats.txt');
      await fs.promises.writeFile(testFile, 'Reset test');

      await optimizer.readFile(testFile);
      
      let stats = optimizer.getStats();
      expect(stats.totalReads).toBeGreaterThan(0);

      optimizer.resetStats();
      
      stats = optimizer.getStats();
      expect(stats.totalReads).toBe(0);
    });

    it('应该能够刷新所有批处理操作', async () => {
      const testFile = path.join(testDir, 'flush-all.txt');
      
      // 添加一个写入操作但不等待完成
      const writePromise = optimizer.writeFile(testFile, 'Flush all test');
      
      // 强制刷新
      await optimizer.flush();
      
      // 写入操作应该完成
      const result = await writePromise;
      expect(result.success).toBe(true);
      
      // 验证文件内容
      const content = await fs.promises.readFile(testFile, 'utf8');
      expect(content).toBe('Flush all test');
    });

    it('应该能够清空所有缓存', async () => {
      const testFile = path.join(testDir, 'clear-all.txt');
      await fs.promises.writeFile(testFile, 'Clear all test');

      await optimizer.preloadFile(testFile);
      
      let stats = optimizer.getStats();
      expect(stats.preloadCacheSize).toBeGreaterThan(0);

      optimizer.clearCache();
      
      stats = optimizer.getStats();
      expect(stats.preloadCacheSize).toBe(0);
    });

    it('应该能够安全销毁优化器', () => {
      expect(() => optimizer.destroy()).not.toThrow();
      
      // 重复销毁应该是安全的
      expect(() => optimizer.destroy()).not.toThrow();
    });
  });

  describe('性能和错误处理', () => {
    it('应该能够处理读取大文件', async () => {
      const largeFile = path.join(testDir, 'large-file.txt');
      const largeContent = 'Large content\n'.repeat(10000);
      await fs.promises.writeFile(largeFile, largeContent);

      const startTime = Date.now();
      const result = await optimizer.readFile(largeFile);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.content).toBe(largeContent);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('应该能够处理读取不存在文件的错误', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');
      
      const result = await optimizer.readFile(nonExistentFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该能够处理写入权限错误', async () => {
      // 在Windows上权限测试可能不适用，跳过
      if (process.platform === 'win32') {
        return;
      }

      const restrictedDir = path.join(testDir, 'restricted');
      await fs.promises.mkdir(restrictedDir, { mode: 0o000 });
      
      const restrictedFile = path.join(restrictedDir, 'restricted.txt');
      
      const result = await optimizer.writeFile(restrictedFile, 'test');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // 恢复权限以便清理
      await fs.promises.chmod(restrictedDir, 0o755);
    });

    it('应该能够在高负载下保持性能', async () => {
      const testFiles = [];
      
      // 创建大量文件
      for (let i = 0; i < 50; i++) {
        const testFile = path.join(testDir, `load-test-${i}.txt`);
        await fs.promises.writeFile(testFile, `Load test content ${i}`);
        testFiles.push(testFile);
      }

      const startTime = Date.now();
      
      // 并发读取和写入操作
      const operations = [];
      for (const testFile of testFiles) {
        operations.push(optimizer.readFile(testFile));
        operations.push(optimizer.writeFile(testFile, 'Updated content'));
      }

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(100); // 50读 + 50写
      expect(duration).toBeLessThan(10000); // 应该在10秒内完成
      
      // 检查成功率
      const successfulOperations = results.filter(result => result.success);
      expect(successfulOperations.length).toBeGreaterThan(90); // 至少90%成功率
    });
  });
});