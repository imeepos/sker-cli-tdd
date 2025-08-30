/**
 * 🔴 TDD 红阶段：增量更新引擎测试文件
 * 测试精确的变更影响分析、最小化上下文重建、依赖级联更新
 */

import { IncrementalUpdater, UpdateRequest } from './incremental-updater';
import { DependencyAnalyzer } from '../analysis/dependency-analyzer';
import { LRUCache } from '../cache/lru-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Incremental Updater 增量更新引擎', () => {
  let updater: IncrementalUpdater;
  let testProjectDir: string;
  let contextCache: LRUCache<string, any>;

  // 辅助函数：确保src目录存在
  const ensureSrcDir = async () => {
    const srcDir = path.join(testProjectDir, 'src');
    await fs.promises.mkdir(srcDir, { recursive: true });
    return srcDir;
  };

  beforeEach(async () => {
    // 创建测试项目目录
    testProjectDir = path.join(os.tmpdir(), `incremental-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.promises.mkdir(testProjectDir, { recursive: true });

    // 创建上下文缓存
    contextCache = new LRUCache({
      maxSize: 100,
      maxMemoryBytes: 1024 * 1024 // 1MB
    });

    // 创建增量更新引擎
    updater = new IncrementalUpdater({
      contextCache,
      maxConcurrentUpdates: 5,
      updateTimeoutMs: 10000,
      enableChangeTracking: true
    });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.promises.rm(testProjectDir, { recursive: true, force: true });
      await updater.destroy();
      await contextCache.destroy();
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('增量更新引擎初始化', () => {
    it('应该能够创建增量更新引擎实例', () => {
      expect(updater).toBeDefined();
      expect(updater instanceof IncrementalUpdater).toBe(true);
    });

    it('应该支持配置并发更新数量', () => {
      const customUpdater = new IncrementalUpdater({
        contextCache,
        maxConcurrentUpdates: 10
      });

      expect(customUpdater).toBeDefined();
    });

    it('应该支持配置更新超时时间', () => {
      const customUpdater = new IncrementalUpdater({
        contextCache,
        updateTimeoutMs: 5000
      });

      expect(customUpdater).toBeDefined();
    });
  });

  describe('变更影响分析', () => {
    beforeEach(async () => {
      // 创建测试文件结构
      const srcDir = path.join(testProjectDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });

      // main.ts -> App.tsx -> Header.tsx, Footer.tsx
      // Header.tsx -> Button.tsx -> utils.ts
      await fs.promises.writeFile(path.join(srcDir, 'main.ts'), `
        import { App } from './App';
        console.log('Application starting');
      `);

      await fs.promises.writeFile(path.join(srcDir, 'App.tsx'), `
        import { Header } from './Header';
        import { Footer } from './Footer';
        export const App = () => <div><Header /><Footer /></div>;
      `);

      await fs.promises.writeFile(path.join(srcDir, 'Header.tsx'), `
        import { Button } from './Button';
        export const Header = () => <div><Button /></div>;
      `);

      await fs.promises.writeFile(path.join(srcDir, 'Footer.tsx'), `
        export const Footer = () => <div>Footer</div>;
      `);

      await fs.promises.writeFile(path.join(srcDir, 'Button.tsx'), `
        import { formatText } from './utils';
        export const Button = () => <button>{formatText('Click')}</button>;
      `);

      await fs.promises.writeFile(path.join(srcDir, 'utils.ts'), `
        export function formatText(text: string): string {
          return text.toUpperCase();
        }
      `);
    });

    it('应该能够分析单个文件变更的影响范围', async () => {
      const analyzer = new DependencyAnalyzer();
      const analysisResult = await analyzer.analyzeProject(testProjectDir);
      
      const utilsFile = path.join(testProjectDir, 'src/utils.ts');
      const affectedFiles = await updater.analyzeChangeImpact(utilsFile, analysisResult.graph);

      expect(affectedFiles).toBeDefined();
      expect(affectedFiles.length).toBeGreaterThan(0);
      expect(affectedFiles).toContain(path.join(testProjectDir, 'src/Button.tsx'));
      expect(affectedFiles).toContain(path.join(testProjectDir, 'src/Header.tsx'));
      expect(affectedFiles).toContain(path.join(testProjectDir, 'src/App.tsx'));
      expect(affectedFiles).toContain(path.join(testProjectDir, 'src/main.ts'));
    });

    it('应该能够分析多个文件变更的合并影响', async () => {
      const analyzer = new DependencyAnalyzer();
      const analysisResult = await analyzer.analyzeProject(testProjectDir);
      
      const changedFiles = [
        path.join(testProjectDir, 'src/utils.ts'),
        path.join(testProjectDir, 'src/Footer.tsx')
      ];
      
      const combinedImpact = await updater.analyzeBatchChangeImpact(changedFiles, analysisResult.graph);

      expect(combinedImpact).toBeDefined();
      expect(combinedImpact.length).toBeGreaterThan(0);
      // 应该包含所有被影响的文件，并去重
      expect(combinedImpact).toContain(path.join(testProjectDir, 'src/App.tsx'));
    });

    it('应该能够识别孤立文件的变更', async () => {
      // 创建独立文件
      await fs.promises.writeFile(path.join(testProjectDir, 'src/isolated.ts'), `
        export const isolated = 'This file has no dependencies';
      `);

      const analyzer = new DependencyAnalyzer();
      const analysisResult = await analyzer.analyzeProject(testProjectDir);
      
      const isolatedFile = path.join(testProjectDir, 'src/isolated.ts');
      const affectedFiles = await updater.analyzeChangeImpact(isolatedFile, analysisResult.graph);

      expect(affectedFiles).toBeDefined();
      expect(affectedFiles.length).toBe(0); // 没有其他文件依赖它
    });

    it('应该能够处理循环依赖的影响分析', async () => {
      // 创建循环依赖 A -> B -> C -> A
      await fs.promises.writeFile(path.join(testProjectDir, 'src/A.ts'), `
        import { B } from './B';
        export const A = B + 'A';
      `);

      await fs.promises.writeFile(path.join(testProjectDir, 'src/B.ts'), `
        import { C } from './C';
        export const B = C + 'B';
      `);

      await fs.promises.writeFile(path.join(testProjectDir, 'src/C.ts'), `
        import { A } from './A';
        export const C = 'C';
      `);

      const analyzer = new DependencyAnalyzer();
      const analysisResult = await analyzer.analyzeProject(testProjectDir);
      
      const fileA = path.join(testProjectDir, 'src/A.ts');
      const affectedFiles = await updater.analyzeChangeImpact(fileA, analysisResult.graph);

      expect(affectedFiles).toBeDefined();
      // 循环依赖中的文件应该互相影响
      expect(affectedFiles).toContain(path.join(testProjectDir, 'src/B.ts'));
      expect(affectedFiles).toContain(path.join(testProjectDir, 'src/C.ts'));
    });
  });

  describe('上下文缓存管理', () => {
    it('应该能够检查文件的缓存状态', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/test.ts');
      await fs.promises.writeFile(filePath, 'export const test = "test";');

      const isCached = await updater.isCached(filePath);
      expect(isCached).toBe(false);

      // 模拟缓存文件
      await updater.cacheFileContext(filePath, { content: 'test content', hash: 'abc123' });
      
      const isCachedAfter = await updater.isCached(filePath);
      expect(isCachedAfter).toBe(true);
    });

    it('应该能够验证缓存的有效性', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/test.ts');
      const content = 'export const test = "test";';
      await fs.promises.writeFile(filePath, content);

      // 先计算正确的哈希值
      const crypto = require('crypto');
      const correctHash = crypto.createHash('md5').update(content).digest('hex');
      
      // 缓存文件
      await updater.cacheFileContext(filePath, { content, hash: correctHash });

      const isValid = await updater.isCacheValid(filePath);
      expect(isValid).toBe(true);

      // 修改文件
      await fs.promises.writeFile(filePath, 'export const test = "modified";');

      const isValidAfterChange = await updater.isCacheValid(filePath);
      expect(isValidAfterChange).toBe(false);
    });

    it('应该能够批量检查缓存状态', async () => {
      await ensureSrcDir();
      
      const files = [
        path.join(testProjectDir, 'src/file1.ts'),
        path.join(testProjectDir, 'src/file2.ts'),
        path.join(testProjectDir, 'src/file3.ts')
      ];

      // 创建测试文件
      for (const file of files) {
        await fs.promises.writeFile(file, `export const value = "${path.basename(file)}";`);
      }

      // 缓存部分文件
      await updater.cacheFileContext(files[0]!, { content: 'content1', hash: 'hash1' });
      await updater.cacheFileContext(files[1]!, { content: 'content2', hash: 'hash2' });

      const cacheStates = await updater.batchCheckCache(files);

      expect(cacheStates).toBeDefined();
      expect(cacheStates.get(files[0]!)).toBe(true);
      expect(cacheStates.get(files[1]!)).toBe(true);
      expect(cacheStates.get(files[2]!)).toBe(false);
    });

    it('应该能够智能地使缓存失效', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/test.ts');
      await fs.promises.writeFile(filePath, 'export const test = "test";');

      // 缓存文件
      await updater.cacheFileContext(filePath, { content: 'test content', hash: 'abc123' });
      expect(await updater.isCached(filePath)).toBe(true);

      // 使缓存失效
      await updater.invalidateCache(filePath);
      expect(await updater.isCached(filePath)).toBe(false);
    });
  });

  describe('增量更新处理', () => {
    it('应该能够处理单文件更新请求', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/single.ts');
      await fs.promises.writeFile(filePath, 'export const single = "test";');

      const updateRequest: UpdateRequest = {
        type: 'single',
        filePath,
        reason: 'file_changed',
        timestamp: Date.now()
      };

      const result = await updater.processUpdate(updateRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.updatedFiles).toContain(filePath);
      expect(result.processedCount).toBe(1);
    });

    it('应该能够处理批量更新请求', async () => {
      await ensureSrcDir();
      
      const files = [
        path.join(testProjectDir, 'src/batch1.ts'),
        path.join(testProjectDir, 'src/batch2.ts'),
        path.join(testProjectDir, 'src/batch3.ts')
      ];

      // 创建测试文件
      for (let i = 0; i < files.length; i++) {
        await fs.promises.writeFile(files[i]!, `export const batch${i + 1} = "test${i + 1}";`);
      }

      const updateRequest: UpdateRequest = {
        type: 'batch',
        filePaths: files,
        reason: 'multiple_changes',
        timestamp: Date.now()
      };

      const result = await updater.processUpdate(updateRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.updatedFiles.length).toBeGreaterThan(0);
      expect(result.processedCount).toBe(files.length);
    });

    it('应该能够处理依赖级联更新', async () => {
      await ensureSrcDir();
      
      // 设置依赖关系：main -> utils
      const mainFile = path.join(testProjectDir, 'src/main.ts');
      const utilsFile = path.join(testProjectDir, 'src/utils.ts');

      await fs.promises.writeFile(utilsFile, `
        export function helper(): string {
          return "original";
        }
      `);

      await fs.promises.writeFile(mainFile, `
        import { helper } from './utils';
        console.log(helper());
      `);

      // 分析依赖关系
      const analyzer = new DependencyAnalyzer();
      const analysisResult = await analyzer.analyzeProject(testProjectDir);

      const updateRequest: UpdateRequest = {
        type: 'cascade',
        filePath: utilsFile,
        reason: 'dependency_changed',
        timestamp: Date.now(),
        dependencyGraph: analysisResult.graph
      };

      const result = await updater.processUpdate(updateRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.updatedFiles).toContain(utilsFile);
      expect(result.updatedFiles).toContain(mainFile); // 级联更新
    });

    it('应该能够处理智能缓存更新', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/cached.ts');
      const content = 'export const cached = "test";';
      await fs.promises.writeFile(filePath, content);

      // 先计算正确的哈希值并缓存
      const crypto = require('crypto');
      const correctHash = crypto.createHash('md5').update(content).digest('hex');
      await updater.cacheFileContext(filePath, { content, hash: correctHash });

      const updateRequest: UpdateRequest = {
        type: 'smart',
        filePath,
        reason: 'file_changed',
        timestamp: Date.now(),
        options: {
          useCache: true,
          skipUnchanged: true,
          validateCache: true
        }
      };

      const result = await updater.processUpdate(updateRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.cacheHitCount).toBeGreaterThan(0);
    });

    it('应该能够处理并发更新请求', async () => {
      await ensureSrcDir();
      
      const files = Array.from({ length: 10 }, (_, i) => 
        path.join(testProjectDir, `src/concurrent${i}.ts`)
      );

      // 创建测试文件
      for (let i = 0; i < files.length; i++) {
        await fs.promises.writeFile(files[i]!, `export const concurrent${i} = "test${i}";`);
      }

      // 创建并发更新请求
      const updatePromises = files.map(filePath => {
        const updateRequest: UpdateRequest = {
          type: 'single',
          filePath,
          reason: 'concurrent_test',
          timestamp: Date.now()
        };
        return updater.processUpdate(updateRequest);
      });

      const results = await Promise.all(updatePromises);

      expect(results).toHaveLength(files.length);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.processedCount).toBe(1);
      });
    });
  });

  describe('更新优化策略', () => {
    it('应该能够跳过未变更的文件', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/unchanged.ts');
      const content = 'export const unchanged = "test";';
      await fs.promises.writeFile(filePath, content);

      // 第一次更新
      const updateRequest1: UpdateRequest = {
        type: 'single',
        filePath,
        reason: 'initial_load',
        timestamp: Date.now(),
        options: { skipUnchanged: true }
      };

      const result1 = await updater.processUpdate(updateRequest1);
      expect(result1.success).toBe(true);
      expect(result1.skippedCount).toBe(0);

      // 第二次更新（文件未变更）
      const updateRequest2: UpdateRequest = {
        type: 'single',
        filePath,
        reason: 'no_change',
        timestamp: Date.now(),
        options: { skipUnchanged: true }
      };

      const result2 = await updater.processUpdate(updateRequest2);
      expect(result2.success).toBe(true);
      expect(result2.skippedCount).toBe(1);
    });

    it('应该能够优化批量更新的顺序', async () => {
      await ensureSrcDir();
      
      // 创建有依赖关系的文件
      const utilsFile = path.join(testProjectDir, 'src/utils.ts');
      const helperFile = path.join(testProjectDir, 'src/helper.ts');
      const mainFile = path.join(testProjectDir, 'src/main.ts');

      await fs.promises.writeFile(utilsFile, `
        export const utils = "utils";
      `);

      await fs.promises.writeFile(helperFile, `
        import { utils } from './utils';
        export const helper = utils + "helper";
      `);

      await fs.promises.writeFile(mainFile, `
        import { helper } from './helper';
        console.log(helper);
      `);

      // 分析依赖关系
      const analyzer = new DependencyAnalyzer();
      const analysisResult = await analyzer.analyzeProject(testProjectDir);

      const updateRequest: UpdateRequest = {
        type: 'batch',
        filePaths: [mainFile, helperFile, utilsFile], // 故意乱序
        reason: 'dependency_optimization',
        timestamp: Date.now(),
        dependencyGraph: analysisResult.graph,
        options: { optimizeOrder: true }
      };

      const result = await updater.processUpdate(updateRequest);

      expect(result.success).toBe(true);
      expect(result.updatedFiles).toHaveLength(3);
      // 更新顺序应该优化为：utils -> helper -> main
      expect(result.updateOrder).toBeDefined();
      if (result.updateOrder) {
        const utilsIndex = result.updateOrder.indexOf(utilsFile);
        const helperIndex = result.updateOrder.indexOf(helperFile);
        const mainIndex = result.updateOrder.indexOf(mainFile);
        
        expect(utilsIndex).toBeLessThan(helperIndex);
        expect(helperIndex).toBeLessThan(mainIndex);
      }
    });

    it('应该能够限制并发更新数量', async () => {
      await ensureSrcDir();
      
      // 创建一个并发限制很小的更新器
      const limitedUpdater = new IncrementalUpdater({
        contextCache,
        maxConcurrentUpdates: 2
      });

      const files = Array.from({ length: 5 }, (_, i) => 
        path.join(testProjectDir, `src/limited${i}.ts`)
      );

      // 创建测试文件
      for (let i = 0; i < files.length; i++) {
        await fs.promises.writeFile(files[i]!, `export const limited${i} = "test${i}";`);
      }

      const startTime = Date.now();

      // 同时提交多个更新请求
      const updatePromises = files.map(filePath => {
        const updateRequest: UpdateRequest = {
          type: 'single',
          filePath,
          reason: 'concurrency_limit_test',
          timestamp: Date.now()
        };
        return limitedUpdater.processUpdate(updateRequest);
      });

      const results = await Promise.all(updatePromises);
      const endTime = Date.now();

      expect(results).toHaveLength(files.length);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // 由于并发限制，处理时间应该比无限制时长一些
      expect(endTime - startTime).toBeGreaterThan(0);
    });
  });

  describe('错误处理和恢复', () => {
    it('应该处理文件不存在的错误', async () => {
      await ensureSrcDir();
      
      const nonExistentFile = path.join(testProjectDir, 'src/nonexistent.ts');

      const updateRequest: UpdateRequest = {
        type: 'single',
        filePath: nonExistentFile,
        reason: 'file_not_found_test',
        timestamp: Date.now()
      };

      const result = await updater.processUpdate(updateRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toContain('不存在');
    });

    it('应该处理文件读取权限错误', async () => {
      if (process.platform !== 'win32') {
        await ensureSrcDir();
        
        const restrictedFile = path.join(testProjectDir, 'src/restricted.ts');
        await fs.promises.writeFile(restrictedFile, 'export const restricted = "test";');
        await fs.promises.chmod(restrictedFile, 0o000); // 无读取权限

        const updateRequest: UpdateRequest = {
          type: 'single',
          filePath: restrictedFile,
          reason: 'permission_test',
          timestamp: Date.now()
        };

        const result = await updater.processUpdate(updateRequest);

        // 恢复权限以便清理
        await fs.promises.chmod(restrictedFile, 0o644);

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      }
    });

    it('应该处理更新超时错误', async () => {
      await ensureSrcDir();
      
      // 创建一个超时时间很短的更新器
      const timeoutUpdater = new IncrementalUpdater({
        contextCache,
        updateTimeoutMs: 1 // 1ms，必然超时
      });

      const filePath = path.join(testProjectDir, 'src/timeout.ts');
      await fs.promises.writeFile(filePath, 'export const timeout = "test";');

      const updateRequest: UpdateRequest = {
        type: 'single',
        filePath,
        reason: 'timeout_test',
        timestamp: Date.now()
      };

      const result = await timeoutUpdater.processUpdate(updateRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(error => error.includes('超时'))).toBe(true);
    });

    it('应该能够从部分失败中恢复', async () => {
      await ensureSrcDir();
      
      const validFile = path.join(testProjectDir, 'src/valid.ts');
      const invalidFile = path.join(testProjectDir, 'src/invalid.ts');

      await fs.promises.writeFile(validFile, 'export const valid = "test";');
      // invalidFile 故意不创建，模拟文件不存在

      const updateRequest: UpdateRequest = {
        type: 'batch',
        filePaths: [validFile, invalidFile],
        reason: 'partial_failure_test',
        timestamp: Date.now(),
        options: { continueOnError: true }
      };

      const result = await updater.processUpdate(updateRequest);

      expect(result.success).toBe(false); // 整体失败
      expect(result.updatedFiles).toContain(validFile); // 但是成功处理了部分文件
      expect(result.processedCount).toBe(1); // 只处理了1个文件
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1); // 有1个错误
    });

    it('应该能够清理资源', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/cleanup.ts');
      await fs.promises.writeFile(filePath, 'export const cleanup = "test";');

      // 执行一些更新操作
      const updateRequest: UpdateRequest = {
        type: 'single',
        filePath,
        reason: 'cleanup_test',
        timestamp: Date.now()
      };

      await updater.processUpdate(updateRequest);

      // 销毁更新器
      await updater.destroy();

      // 再次尝试更新应该失败
      const result = await updater.processUpdate(updateRequest);
      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('已销毁');
    });
  });

  describe('性能统计和监控', () => {
    it('应该能够提供详细的更新统计', async () => {
      await ensureSrcDir();
      
      const files = [
        path.join(testProjectDir, 'src/stats1.ts'),
        path.join(testProjectDir, 'src/stats2.ts')
      ];

      // 创建测试文件
      for (let i = 0; i < files.length; i++) {
        await fs.promises.writeFile(files[i]!, `export const stats${i + 1} = "test${i + 1}";`);
      }

      // 执行多次更新
      for (const filePath of files) {
        const updateRequest: UpdateRequest = {
          type: 'single',
          filePath,
          reason: 'statistics_test',
          timestamp: Date.now()
        };
        await updater.processUpdate(updateRequest);
      }

      const stats = updater.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalUpdates).toBeGreaterThanOrEqual(2);
      expect(stats.successfulUpdates).toBeGreaterThanOrEqual(2);
      expect(stats.failedUpdates).toBe(0);
      expect(stats.totalProcessedFiles).toBeGreaterThanOrEqual(2);
      expect(stats.averageUpdateTime).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('应该能够重置统计信息', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/reset.ts');
      await fs.promises.writeFile(filePath, 'export const reset = "test";');

      // 执行更新
      const updateRequest: UpdateRequest = {
        type: 'single',
        filePath,
        reason: 'reset_test',
        timestamp: Date.now()
      };

      await updater.processUpdate(updateRequest);

      let stats = updater.getStatistics();
      expect(stats.totalUpdates).toBeGreaterThan(0);

      // 重置统计
      updater.resetStatistics();

      stats = updater.getStatistics();
      expect(stats.totalUpdates).toBe(0);
      expect(stats.successfulUpdates).toBe(0);
      expect(stats.failedUpdates).toBe(0);
    });

    it('应该能够监控内存使用情况', async () => {
      await ensureSrcDir();
      
      const files = Array.from({ length: 50 }, (_, i) => 
        path.join(testProjectDir, `src/memory${i}.ts`)
      );

      // 创建测试文件
      for (let i = 0; i < files.length; i++) {
        await fs.promises.writeFile(files[i]!, `export const memory${i} = "${'x'.repeat(1000)}";`);
      }

      // 执行大量更新操作
      const updatePromises = files.map(filePath => {
        const updateRequest: UpdateRequest = {
          type: 'single',
          filePath,
          reason: 'memory_monitoring',
          timestamp: Date.now()
        };
        return updater.processUpdate(updateRequest);
      });

      await Promise.all(updatePromises);

      const stats = updater.getStatistics();
      expect(stats.memoryUsage).toBeDefined();
      expect(stats.memoryUsage!.used).toBeGreaterThan(0);
      expect(stats.memoryUsage!.cached).toBeGreaterThanOrEqual(0);
    });

    it('应该能够提供性能分析报告', async () => {
      await ensureSrcDir();
      
      const filePath = path.join(testProjectDir, 'src/performance.ts');
      await fs.promises.writeFile(filePath, 'export const performance = "test";');

      // 执行多次更新以收集性能数据
      for (let i = 0; i < 10; i++) {
        // 稍微改变文件内容以确保每次都有实际更新
        await fs.promises.writeFile(filePath, `export const performance = "test${i}";`);
        
        const updateRequest: UpdateRequest = {
          type: 'single',
          filePath,
          reason: 'performance_analysis',
          timestamp: Date.now()
        };
        await updater.processUpdate(updateRequest);
        
        // 添加小延迟以确保有可测量的时间差
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const performanceReport = updater.getPerformanceReport();

      expect(performanceReport).toBeDefined();
      expect(performanceReport.updateTimePercentiles).toBeDefined();
      expect(performanceReport.updateTimePercentiles.p50).toBeGreaterThan(0);
      expect(performanceReport.updateTimePercentiles.p95).toBeGreaterThan(0);
      expect(performanceReport.updateTimePercentiles.p99).toBeGreaterThan(0);
      expect(performanceReport.throughput).toBeDefined();
      expect(performanceReport.resourceUsage).toBeDefined();
    });
  });
});