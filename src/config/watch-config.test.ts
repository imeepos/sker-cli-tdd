/**
 * 🔴 TDD 红阶段：监听配置管理测试
 * 测试项目级和全局配置管理功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WatchConfigManager, ProjectWatchConfig, GlobalWatchConfig } from './watch-config';

describe('WatchConfigManager', () => {
  let tempDir: string;
  let configManager: WatchConfigManager;

  beforeEach(() => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sker-test-'));
    configManager = new WatchConfigManager();
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('项目级配置管理', () => {
    it('应该能够加载项目级配置文件 (sker.json)', () => {
      // 创建项目配置文件
      const projectConfig: ProjectWatchConfig = {
        name: 'test-project',
        contextWatcher: {
          enabled: true,
          watchPatterns: ['src/**/*.ts', 'docs/**/*.md'],
          ignorePatterns: ['**/*.log', 'tmp/**'],
          debounceMs: 150,
          batchSize: 40,
          maxDepth: 8,
          respectGitignore: true,
          cacheSize: '50MB',
          compressionLevel: 2
        }
      };

      const configPath = path.join(tempDir, 'sker.json');
      fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));

      const loadedConfig = configManager.loadProjectConfig(tempDir);
      expect(loadedConfig).toEqual(projectConfig);
    });

    it('应该在没有配置文件时返回默认配置', () => {
      const defaultConfig = configManager.loadProjectConfig(tempDir);
      
      expect(defaultConfig).toHaveProperty('contextWatcher');
      expect(defaultConfig.contextWatcher.enabled).toBe(true);
      expect(defaultConfig.contextWatcher.debounceMs).toBe(100);
      expect(defaultConfig.contextWatcher.batchSize).toBe(50);
    });

    it('应该验证项目配置的有效性', () => {
      const invalidConfig = {
        name: '',
        contextWatcher: {
          enabled: true,
          debounceMs: -1, // 无效值
          batchSize: 0 // 无效值
        }
      };

      expect(() => {
        configManager.validateProjectConfig(invalidConfig);
      }).toThrow('项目配置验证失败');
    });

    it('应该能够保存项目配置', () => {
      const projectConfig: ProjectWatchConfig = {
        name: 'test-project',
        contextWatcher: {
          enabled: true,
          watchPatterns: ['src/**/*.ts'],
          ignorePatterns: ['node_modules/**'],
          debounceMs: 200,
          batchSize: 30,
          maxDepth: 5,
          respectGitignore: true,
          cacheSize: '30MB',
          compressionLevel: 1
        }
      };

      configManager.saveProjectConfig(tempDir, projectConfig);

      const configPath = path.join(tempDir, 'sker.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(savedConfig).toEqual(projectConfig);
    });
  });

  describe('全局配置管理', () => {
    it('应该能够加载全局配置文件 (~/.skerrc.json)', () => {
      // 创建一个简单的配置文件内容用于测试
      const testConfig = {
        daemon: {
          enabled: true,
          autoStart: false,
          logLevel: 'debug' as const,
          logFile: '~/.sker/daemon.log',
          pidFile: '~/.sker/daemon.pid',
          socketPath: '~/.sker/daemon.sock'
        },
        defaults: {
          contextWatcher: {
            debounceMs: 120,
            batchSize: 60,
            maxDepth: 10,
            cacheSize: '200MB'
          }
        },
        performance: {
          maxMemoryMB: 150,
          maxCpuPercent: 8,
          gcInterval: 600000
        }
      };

      // 模拟全局配置文件路径
      const globalConfigPath = path.join(tempDir, '.skerrc.json');
      fs.writeFileSync(globalConfigPath, JSON.stringify(testConfig, null, 2));

      // 直接传入临时目录作为home目录
      const loadedConfig = configManager.loadGlobalConfig(tempDir);
      
      // 验证核心配置正确加载
      expect(loadedConfig.daemon.enabled).toBe(true);
      expect(loadedConfig.daemon.autoStart).toBe(false);
      expect(loadedConfig.daemon.logLevel).toBe('debug');
      expect(loadedConfig.defaults.contextWatcher.debounceMs).toBe(120);
      expect(loadedConfig.performance.maxMemoryMB).toBe(150);
    });

    it('应该在没有全局配置时返回默认配置', () => {
      const defaultConfig = configManager.loadGlobalConfig();
      
      expect(defaultConfig).toHaveProperty('daemon');
      expect(defaultConfig).toHaveProperty('defaults');
      expect(defaultConfig).toHaveProperty('performance');
      expect(defaultConfig.daemon.enabled).toBe(true);
      expect(defaultConfig.daemon.autoStart).toBe(true);
    });

    it('应该验证全局配置的有效性', () => {
      const invalidConfig = {
        daemon: {
          enabled: true,
          autoStart: true,
          logLevel: 'invalid-level', // 无效日志级别
        },
        performance: {
          maxMemoryMB: -1, // 无效值
          maxCpuPercent: 150 // 无效值
        }
      };

      expect(() => {
        configManager.validateGlobalConfig(invalidConfig);
      }).toThrow('全局配置验证失败');
    });
  });

  describe('配置合并和优先级', () => {
    it('应该正确合并全局配置和项目配置', () => {
      const globalConfig: GlobalWatchConfig = {
        daemon: {
          enabled: true,
          autoStart: true,
          logLevel: 'info',
          logFile: '~/.sker/daemon.log',
          pidFile: '~/.sker/daemon.pid',
          socketPath: '~/.sker/daemon.sock'
        },
        defaults: {
          contextWatcher: {
            debounceMs: 80,
            batchSize: 40,
            maxDepth: 6,
            cacheSize: '80MB'
          }
        },
        performance: {
          maxMemoryMB: 100,
          maxCpuPercent: 5,
          gcInterval: 300000
        }
      };

      const projectConfig: ProjectWatchConfig = {
        name: 'test-project',
        contextWatcher: {
          enabled: true,
          watchPatterns: ['src/**/*.ts'],
          ignorePatterns: ['node_modules/**'],
          debounceMs: 200, // 应该覆盖全局默认值
          batchSize: 30,   // 应该覆盖全局默认值
          maxDepth: 8,     // 应该覆盖全局默认值
          respectGitignore: true,
          cacheSize: '50MB', // 应该覆盖全局默认值
          compressionLevel: 1
        }
      };

      const mergedConfig = configManager.mergeConfigs(globalConfig, projectConfig);
      
      expect(mergedConfig.debounceMs).toBe(200); // 项目配置优先
      expect(mergedConfig.batchSize).toBe(30);   // 项目配置优先
      expect(mergedConfig.maxDepth).toBe(8);     // 项目配置优先
      expect(mergedConfig.cacheSize).toBe('50MB'); // 项目配置优先
      
      // 项目特有的配置应该保留
      expect(mergedConfig.watchPatterns).toEqual(['src/**/*.ts']);
      expect(mergedConfig.ignorePatterns).toEqual(['node_modules/**']);
      expect(mergedConfig.respectGitignore).toBe(true);
    });
  });

  describe('配置文件路径管理', () => {
    it('应该返回正确的项目配置文件路径', () => {
      const projectPath = '/path/to/project';
      const configPath = configManager.getProjectConfigPath(projectPath);
      
      expect(configPath).toBe(path.join(projectPath, 'sker.json'));
    });

    it('应该返回正确的全局配置文件路径', () => {
      const configPath = configManager.getGlobalConfigPath();
      const homeDir = os.homedir();
      
      expect(configPath).toBe(path.join(homeDir, '.skerrc.json'));
    });

    it('应该创建Sker配置目录如果不存在', () => {
      const skerDir = configManager.ensureSkerDirectory();
      
      expect(fs.existsSync(skerDir)).toBe(true);
      expect(path.basename(skerDir)).toBe('.sker');
    });
  });
});