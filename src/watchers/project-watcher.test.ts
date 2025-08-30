/**
 * 🔴 TDD 红阶段：ProjectWatcher 测试文件
 * 项目监听器的单元测试
 */

import { ProjectWatcher, ProjectWatchConfig, FileChangeEvent } from './project-watcher';
import * as path from 'path';
import * as fs from 'fs';

describe('ProjectWatcher 项目监听器', () => {
  let tempDir: string;
  let watcher: ProjectWatcher;
  
  beforeAll(async () => {
    // 创建临时测试目录
    tempDir = path.join(__dirname, '../../test-tmp-watcher');
    await fs.promises.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // 清理临时目录
    if (watcher) {
      await watcher.stop();
    }
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // 忽略删除错误
    }
  });

  beforeEach(() => {
    // 在每个测试前清理watcher
    if (watcher) {
      watcher.stop();
    }
  });

  describe('基础功能', () => {
    it('应该能够创建ProjectWatcher实例', () => {
      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts', '**/*.js'],
        ignorePatterns: ['**/node_modules/**'],
        debounceMs: 100,
        batchSize: 10,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      expect(watcher).toBeInstanceOf(ProjectWatcher);
      expect(watcher.isWatching).toBe(false);
    });

    it('应该能够启动文件监听', async () => {
      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'],
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      await watcher.start();
      
      expect(watcher.isWatching).toBe(true);
    });

    it('应该能够停止文件监听', async () => {
      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'],
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      await watcher.start();
      await watcher.stop();
      
      expect(watcher.isWatching).toBe(false);
    });
  });

  describe('文件变更检测', () => {
    it('应该能够检测到新文件创建', async () => {
      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'],
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      
      let changeEvent: FileChangeEvent | null = null;
      watcher.on('change', (event: FileChangeEvent) => {
        if (event.type === 'add') {
          changeEvent = event;
        }
      });

      await watcher.start();
      
      // 等待监听器稳定
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 创建测试文件
      const testFile = path.join(tempDir, 'test.ts');
      await fs.promises.writeFile(testFile, 'export const test = 1;');

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(changeEvent).toBeTruthy();
      expect((changeEvent as unknown as FileChangeEvent).type).toBe('add');
      expect((changeEvent as unknown as FileChangeEvent).path).toBe(testFile);
      expect((changeEvent as unknown as FileChangeEvent).projectId).toBeDefined();

      // 清理测试文件
      try {
        await fs.promises.unlink(testFile);
      } catch {
        // 忽略删除错误
      }
    }, 15000);

    it('应该能够检测到文件修改', async () => {
      // 先创建文件
      const testFile = path.join(tempDir, 'modify-test.ts');
      await fs.promises.writeFile(testFile, 'export const test = 1;');

      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'],
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      
      let changeEvent: FileChangeEvent | null = null;
      watcher.on('change', (event: FileChangeEvent) => {
        if (event.type === 'change') {
          changeEvent = event;
        }
      });

      await watcher.start();
      
      // 等待监听器稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 修改测试文件
      await fs.promises.writeFile(testFile, 'export const test = 2;');
      
      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(changeEvent).toBeTruthy();
      expect((changeEvent as unknown as FileChangeEvent).type).toBe('change');
      expect((changeEvent as unknown as FileChangeEvent).path).toBe(testFile);

      // 清理测试文件
      try {
        await fs.promises.unlink(testFile);
      } catch {
        // 忽略删除错误
      }
    }, 15000);

    it('应该能够检测到文件删除', async () => {
      // 先创建文件
      const testFile = path.join(tempDir, 'delete-test.ts');
      await fs.promises.writeFile(testFile, 'export const test = 1;');

      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'],
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      
      let changeEvent: FileChangeEvent | null = null;
      watcher.on('change', (event: FileChangeEvent) => {
        if (event.type === 'unlink') {
          changeEvent = event;
        }
      });

      await watcher.start();
      
      // 等待监听器稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 删除测试文件
      await fs.promises.unlink(testFile);
      
      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(changeEvent).toBeTruthy();
      expect((changeEvent as unknown as FileChangeEvent).type).toBe('unlink');
      expect((changeEvent as unknown as FileChangeEvent).path).toBe(testFile);
    }, 15000);
  });

  describe('模式匹配和过滤', () => {
    it('应该只监听匹配模式的文件', async () => {
      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'], // 只监听.ts文件
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      
      let changeCount = 0;
      watcher.on('change', () => {
        changeCount++;
      });

      await watcher.start();
      
      // 创建.ts文件（应该被监听）
      const tsFile = path.join(tempDir, 'pattern-test.ts');
      await fs.promises.writeFile(tsFile, 'export const test = 1;');
      
      // 创建.js文件（不应该被监听）
      const jsFile = path.join(tempDir, 'pattern-test.js');
      await fs.promises.writeFile(jsFile, 'const test = 1;');

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(changeCount).toBe(1); // 只有.ts文件的事件

      // 清理测试文件
      await fs.promises.unlink(tsFile);
      await fs.promises.unlink(jsFile);
    });
  });

  describe('统计信息', () => {
    it('应该能够获取监听统计信息', async () => {
      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'],
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      await watcher.start();

      const stats = watcher.getStats();
      expect(stats).toHaveProperty('eventsProcessed');
      expect(stats).toHaveProperty('filesWatched');
      expect(stats).toHaveProperty('lastEventTime');
      expect(stats.eventsProcessed).toBe(0);
    });
  });
});