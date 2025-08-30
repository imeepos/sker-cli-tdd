/**
 * 🔴 TDD 红阶段：ProjectWatcher 测试文件
 * 项目监听器的单元测试
 * 使用 memfs + unionfs 进行文件系统Mock
 */

import { ProjectWatcher, ProjectWatchConfig, FileChangeEvent } from './project-watcher';
import * as path from 'path';
import { Volume } from 'memfs';
import { Union } from 'unionfs';

// Mock fs 模块使用 memfs + unionfs
jest.mock('fs', () => {
  const fs = jest.requireActual('fs');
  return new Union().use(fs);
});

jest.mock('fs/promises', () => {
  const fs = jest.requireActual('fs/promises');
  const { Union } = require('unionfs');
  return new Union().use(fs).promises;
});

// Mock chokidar 模块
jest.mock('chokidar', () => {
  const mockWatcher: any = {
    on: jest.fn((event: string, callback: Function): any => {
      // 立即触发ready事件，避免测试超时
      if (event === 'ready') {
        setTimeout(() => callback(), 0);
      }
      return mockWatcher;
    }),
    close: jest.fn((): Promise<void> => Promise.resolve()),
    add: jest.fn(),
    unwatch: jest.fn()
  };
  
  return {
    watch: jest.fn(() => mockWatcher),
    __mockWatcher: mockWatcher
  };
});

import * as chokidar from 'chokidar';
import * as fs from 'fs';

describe('ProjectWatcher 项目监听器', () => {
  let tempDir: string;
  let watcher: ProjectWatcher;
  let vol: Volume;
  let mockedFs: any;
  
  beforeAll(() => {
    // 设置虚拟文件系统
    tempDir = '/test-project';
  });

  beforeEach(() => {
    // 在每个测试前重置虚拟文件系统
    vol = new Volume();
    mockedFs = require('fs');
    mockedFs.use(vol);
    
    // 创建虚拟测试目录
    vol.mkdirSync(tempDir, { recursive: true });
    
    // 清理之前的watcher
    if (watcher) {
      watcher.stop();
    }
    
    // 重置所有Mock
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // 清理watcher
    if (watcher) {
      await watcher.stop();
    }
    
    // 重置虚拟文件系统
    vol.reset();
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
      
      // 获取mock的chokidar实例
      const mockChokidar = (chokidar as any).__mockWatcher;
      
      // 查找add事件的回调函数
      let addCallback: Function | undefined;
      for (const call of mockChokidar.on.mock.calls) {
        if (call[0] === 'add') {
          addCallback = call[1];
          break;
        }
      }
      
      expect(addCallback).toBeDefined();
      
      // 模拟文件添加事件
      const testFile = path.join(tempDir, 'test.ts');
      const mockStats = { isFile: () => true, mtime: new Date() } as fs.Stats;
      addCallback!(testFile, mockStats);
      
      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(changeEvent).toBeTruthy();
      expect(changeEvent!.type).toBe('add');
      expect(path.relative(tempDir, changeEvent!.path)).toBe(path.relative(tempDir, testFile));
      expect(changeEvent!.projectId).toBeDefined();
    }, 5000);

    it('应该能够检测到文件修改', async () => {
      // 在虚拟文件系统中创建文件
      const testFile = path.join(tempDir, 'modify-test.ts');
      vol.writeFileSync(testFile, 'export const test = 1;');

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
      
      // 获取mock的chokidar实例
      const mockChokidar = (chokidar as any).__mockWatcher;
      
      // 查找change事件的回调函数
      let changeCallback: Function | undefined;
      for (const call of mockChokidar.on.mock.calls) {
        if (call[0] === 'change') {
          changeCallback = call[1];
          break;
        }
      }
      
      expect(changeCallback).toBeDefined();
      
      // 模拟文件修改事件
      const mockStats = { isFile: () => true, mtime: new Date() } as fs.Stats;
      changeCallback!(testFile, mockStats);
      
      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(changeEvent).toBeTruthy();
      expect(changeEvent!.type).toBe('change');
      expect(path.relative(tempDir, changeEvent!.path)).toBe(path.relative(tempDir, testFile));
    }, 5000);

    it('应该能够检测到文件删除', async () => {
      // 在虚拟文件系统中创建文件
      const testFile = path.join(tempDir, 'delete-test.ts');
      vol.writeFileSync(testFile, 'export const test = 1;');

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
      
      // 获取mock的chokidar实例
      const mockChokidar = (chokidar as any).__mockWatcher;
      
      // 查找unlink事件的回调函数
      let unlinkCallback: Function | undefined;
      for (const call of mockChokidar.on.mock.calls) {
        if (call[0] === 'unlink') {
          unlinkCallback = call[1];
          break;
        }
      }
      
      expect(unlinkCallback).toBeDefined();
      
      // 模拟文件删除事件
      unlinkCallback!(testFile);
      
      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(changeEvent).toBeTruthy();
      expect(changeEvent!.type).toBe('unlink');
      expect(path.relative(tempDir, changeEvent!.path)).toBe(path.relative(tempDir, testFile));
    }, 5000);
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
      const events: FileChangeEvent[] = [];
      
      watcher.on('change', (event: FileChangeEvent) => {
        events.push(event);
      });

      await watcher.start();
      
      // 获取mock的chokidar实例
      const mockChokidar = (chokidar as any).__mockWatcher;
      
      // 查找add事件的回调函数
      let addCallback: Function | undefined;
      for (const call of mockChokidar.on.mock.calls) {
        if (call[0] === 'add') {
          addCallback = call[1];
          break;
        }
      }
      
      expect(addCallback).toBeDefined();
      
      // 模拟添加.ts文件（应该被监听）
      const tsFile = path.join(tempDir, 'test.ts');
      const mockStats = { isFile: () => true, mtime: new Date() } as fs.Stats;
      addCallback!(tsFile, mockStats);
      
      // 等待事件处理
       await new Promise(resolve => setTimeout(resolve, 100));
       
       expect(events).toHaveLength(1);
       expect(events[0]!.type).toBe('add');
       expect(path.relative(tempDir, events[0]!.path)).toBe(path.relative(tempDir, tsFile));
     }, 5000);
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
    }, 5000);
  });
});