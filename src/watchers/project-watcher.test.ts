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
    it.skip('应该能够检测到新文件创建', async () => {
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

    it.skip('应该能够检测到文件修改', async () => {
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

    it.skip('应该能够检测到文件删除', async () => {
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
      
      // 使用Promise来等待删除事件
      const deleteEventPromise = new Promise<FileChangeEvent>((resolve) => {
        watcher.on('change', (event: FileChangeEvent) => {
          if (event.type === 'unlink') {
            resolve(event);
          }
        });
      });

      await watcher.start();
      
      // 等待监听器稳定
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 删除测试文件
      await fs.promises.unlink(testFile);
      
      // 等待删除事件（最多等待5秒）
      const changeEvent = await Promise.race([
        deleteEventPromise,
        new Promise<FileChangeEvent>((_, reject) => 
          setTimeout(() => reject(new Error('删除事件超时')), 5000)
        )
      ]);

      expect(changeEvent).toBeTruthy();
      expect(changeEvent!.type).toBe('unlink');
      expect(changeEvent!.path).toBe(testFile);
    }, 15000);
  });

  describe('模式匹配和过滤', () => {
    it.skip('应该只监听匹配模式的文件', async () => {
      const config: ProjectWatchConfig = {
        projectPath: tempDir,
        watchPatterns: ['**/*.ts'], // 只监听.ts文件
        ignorePatterns: [],
        debounceMs: 50,
        batchSize: 5,
        respectGitignore: false
      };

      watcher = new ProjectWatcher(config);
      
      const events: FileChangeEvent[] = [];
      
      // 使用Promise来等待至少一个事件
      const eventPromise = new Promise<void>((resolve) => {
        watcher.on('change', (event: FileChangeEvent) => {
          events.push(event);
          // 当收到第一个事件时resolve
          if (events.length === 1) {
            setTimeout(resolve, 200); // 给一点时间让其他可能的事件也被捕获
          }
        });
      });

      await watcher.start();
      
      // 等待监听器稳定
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 创建.ts文件（应该被监听）
      const tsFile = path.join(tempDir, 'pattern-test.ts');
      await fs.promises.writeFile(tsFile, 'export const test = 1;');
      
      // 创建.js文件（不应该被监听）
      const jsFile = path.join(tempDir, 'pattern-test.js');
      await fs.promises.writeFile(jsFile, 'const test = 1;');

      // 等待事件或超时
      await Promise.race([
        eventPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('没有收到任何文件变更事件')), 3000)
        )
      ]);

      expect(events.length).toBe(1); // 只有.ts文件的事件
      expect(events[0]!.path).toBe(tsFile);
      expect(events[0]!.type).toBe('add');

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