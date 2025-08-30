/**
 * 🟢 TDD 绿阶段：监听配置管理实现
 * 实现项目级和全局配置管理功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkerError } from '../sker-error';

/**
 * 项目监听配置接口
 */
export interface ProjectWatchConfig {
  /** 项目名称 */
  name: string;
  /** 上下文监听配置 */
  contextWatcher: {
    /** 是否启用监听 */
    enabled: boolean;
    /** 监听模式数组 */
    watchPatterns: string[];
    /** 忽略模式数组 */
    ignorePatterns: string[];
    /** 防抖延迟时间（毫秒） */
    debounceMs: number;
    /** 批处理大小 */
    batchSize: number;
    /** 最大扫描深度 */
    maxDepth?: number;
    /** 是否遵循gitignore */
    respectGitignore: boolean;
    /** 缓存大小 */
    cacheSize: string;
    /** 压缩级别 */
    compressionLevel: number;
  };
}

/**
 * 全局监听配置接口
 */
export interface GlobalWatchConfig {
  /** 守护进程配置 */
  daemon: {
    /** 是否启用 */
    enabled: boolean;
    /** 是否自动启动 */
    autoStart: boolean;
    /** 日志级别 */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** 日志文件路径 */
    logFile: string;
    /** PID文件路径 */
    pidFile: string;
    /** Socket路径 */
    socketPath: string;
  };
  /** 默认配置 */
  defaults: {
    /** 默认监听配置 */
    contextWatcher: {
      /** 防抖延迟时间（毫秒） */
      debounceMs: number;
      /** 批处理大小 */
      batchSize: number;
      /** 最大扫描深度 */
      maxDepth: number;
      /** 缓存大小 */
      cacheSize: string;
    };
  };
  /** 性能配置 */
  performance: {
    /** 最大内存限制（MB） */
    maxMemoryMB: number;
    /** 最大CPU占用率 */
    maxCpuPercent: number;
    /** 垃圾回收间隔 */
    gcInterval: number;
  };
}

/**
 * 合并后的运行时配置
 */
export interface RuntimeWatchConfig {
  /** 是否启用监听 */
  enabled: boolean;
  /** 监听模式数组 */
  watchPatterns: string[];
  /** 忽略模式数组 */
  ignorePatterns: string[];
  /** 防抖延迟时间（毫秒） */
  debounceMs: number;
  /** 批处理大小 */
  batchSize: number;
  /** 最大扫描深度 */
  maxDepth?: number;
  /** 是否遵循gitignore */
  respectGitignore: boolean;
  /** 缓存大小 */
  cacheSize: string;
  /** 压缩级别 */
  compressionLevel: number;
}

/**
 * 监听配置管理器
 */
export class WatchConfigManager {
  private static readonly PROJECT_CONFIG_FILE = 'sker.json';
  private static readonly GLOBAL_CONFIG_FILE = '.skerrc.json';
  private static readonly SKER_DIR = '.sker';

  /**
   * 加载项目级配置
   */
  loadProjectConfig(projectPath: string): ProjectWatchConfig {
    const configPath = this.getProjectConfigPath(projectPath);
    
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent) as ProjectWatchConfig;
        this.validateProjectConfig(config);
        return config;
      } catch (error) {
        throw new SkerError(
          'CONFIG_PARSE_ERROR',
          `无法加载项目配置文件: ${error instanceof Error ? error.message : '未知错误'}`
        );
      }
    }

    // 返回默认项目配置
    return this.getDefaultProjectConfig();
  }

  /**
   * 保存项目级配置
   */
  saveProjectConfig(projectPath: string, config: ProjectWatchConfig): void {
    this.validateProjectConfig(config);
    
    const configPath = this.getProjectConfigPath(projectPath);
    
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      throw new SkerError(
        'FILE_OPERATION_FAILED',
        `无法保存项目配置文件: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 加载全局配置
   */
  loadGlobalConfig(homeDir?: string): GlobalWatchConfig {
    const configPath = this.getGlobalConfigPath(homeDir);
    
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent) as GlobalWatchConfig;
        this.validateGlobalConfig(config);
        return config;
      } catch (error) {
        throw new SkerError(
          'CONFIG_PARSE_ERROR',
          `无法加载全局配置文件: ${error instanceof Error ? error.message : '未知错误'}`
        );
      }
    }

    // 返回默认全局配置
    return this.getDefaultGlobalConfig();
  }

  /**
   * 保存全局配置
   */
  saveGlobalConfig(config: GlobalWatchConfig): void {
    this.validateGlobalConfig(config);
    
    // 确保配置目录存在
    this.ensureSkerDirectory();
    
    const configPath = this.getGlobalConfigPath();
    
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      throw new SkerError(
        'FILE_OPERATION_FAILED',
        `无法保存全局配置文件: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 合并全局配置和项目配置
   */
  mergeConfigs(globalConfig: GlobalWatchConfig, projectConfig: ProjectWatchConfig): RuntimeWatchConfig {
    const defaults = globalConfig.defaults.contextWatcher;
    const project = projectConfig.contextWatcher;

    return {
      enabled: project.enabled,
      watchPatterns: project.watchPatterns,
      ignorePatterns: project.ignorePatterns,
      debounceMs: project.debounceMs ?? defaults.debounceMs,
      batchSize: project.batchSize ?? defaults.batchSize,
      maxDepth: project.maxDepth ?? defaults.maxDepth,
      respectGitignore: project.respectGitignore,
      cacheSize: project.cacheSize ?? defaults.cacheSize,
      compressionLevel: project.compressionLevel
    };
  }

  /**
   * 验证项目配置
   */
  validateProjectConfig(config: any): void {
    const errors: string[] = [];

    if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
      errors.push('项目名称不能为空');
    }

    if (!config.contextWatcher || typeof config.contextWatcher !== 'object') {
      errors.push('contextWatcher配置必须是对象');
    } else {
      const watcher = config.contextWatcher;

      if (typeof watcher.enabled !== 'boolean') {
        errors.push('enabled必须是布尔值');
      }

      if (!Array.isArray(watcher.watchPatterns)) {
        errors.push('watchPatterns必须是数组');
      }

      if (!Array.isArray(watcher.ignorePatterns)) {
        errors.push('ignorePatterns必须是数组');
      }

      if (typeof watcher.debounceMs !== 'number' || watcher.debounceMs < 0) {
        errors.push('debounceMs必须是非负数');
      }

      if (typeof watcher.batchSize !== 'number' || watcher.batchSize <= 0) {
        errors.push('batchSize必须是正数');
      }

      if (watcher.maxDepth !== undefined && (typeof watcher.maxDepth !== 'number' || watcher.maxDepth < 0)) {
        errors.push('maxDepth必须是非负数');
      }

      if (typeof watcher.respectGitignore !== 'boolean') {
        errors.push('respectGitignore必须是布尔值');
      }

      if (typeof watcher.cacheSize !== 'string' || !watcher.cacheSize) {
        errors.push('cacheSize必须是非空字符串');
      }

      if (typeof watcher.compressionLevel !== 'number' || watcher.compressionLevel < 0 || watcher.compressionLevel > 9) {
        errors.push('compressionLevel必须是0-9的整数');
      }
    }

    if (errors.length > 0) {
      throw new SkerError('VALIDATION_ERROR', `项目配置验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 验证全局配置
   */
  validateGlobalConfig(config: any): void {
    const errors: string[] = [];

    if (!config.daemon || typeof config.daemon !== 'object') {
      errors.push('daemon配置必须是对象');
    } else {
      const daemon = config.daemon;

      if (typeof daemon.enabled !== 'boolean') {
        errors.push('daemon.enabled必须是布尔值');
      }

      if (typeof daemon.autoStart !== 'boolean') {
        errors.push('daemon.autoStart必须是布尔值');
      }

      const validLogLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLogLevels.includes(daemon.logLevel)) {
        errors.push(`daemon.logLevel必须是以下之一: ${validLogLevels.join(', ')}`);
      }
    }

    if (!config.performance || typeof config.performance !== 'object') {
      errors.push('performance配置必须是对象');
    } else {
      const perf = config.performance;

      if (typeof perf.maxMemoryMB !== 'number' || perf.maxMemoryMB < 0) {
        errors.push('performance.maxMemoryMB必须是非负数');
      }

      if (typeof perf.maxCpuPercent !== 'number' || perf.maxCpuPercent < 0 || perf.maxCpuPercent > 100) {
        errors.push('performance.maxCpuPercent必须是0-100的数字');
      }
    }

    if (errors.length > 0) {
      throw new SkerError('VALIDATION_ERROR', `全局配置验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 获取项目配置文件路径
   */
  getProjectConfigPath(projectPath: string): string {
    return path.join(projectPath, WatchConfigManager.PROJECT_CONFIG_FILE);
  }

  /**
   * 获取全局配置文件路径
   */
  getGlobalConfigPath(homeDir?: string): string {
    const home = homeDir || os.homedir();
    return path.join(home, WatchConfigManager.GLOBAL_CONFIG_FILE);
  }

  /**
   * 确保Sker配置目录存在
   */
  ensureSkerDirectory(): string {
    const skerDir = path.join(os.homedir(), WatchConfigManager.SKER_DIR);
    
    if (!fs.existsSync(skerDir)) {
      fs.mkdirSync(skerDir, { recursive: true });
    }
    
    return skerDir;
  }

  /**
   * 获取默认项目配置
   */
  private getDefaultProjectConfig(): ProjectWatchConfig {
    return {
      name: 'untitled-project',
      contextWatcher: {
        enabled: true,
        watchPatterns: [
          '**/*.{ts,js,tsx,jsx}',
          '**/*.{py,java,go,rs}',
          '**/*.{md,txt,json,yaml,yml}',
          '**/*.{html,css,scss,less}'
        ],
        ignorePatterns: [
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          '**/*.log',
          'tmp/**',
          '.cache/**'
        ],
        debounceMs: 100,
        batchSize: 50,
        maxDepth: 10,
        respectGitignore: true,
        cacheSize: '100MB',
        compressionLevel: 1
      }
    };
  }

  /**
   * 获取默认全局配置
   */
  private getDefaultGlobalConfig(): GlobalWatchConfig {
    const homeDir = os.homedir();
    const skerDir = path.join(homeDir, WatchConfigManager.SKER_DIR);

    return {
      daemon: {
        enabled: true,
        autoStart: true,
        logLevel: 'info',
        logFile: path.join(skerDir, 'daemon.log'),
        pidFile: path.join(skerDir, 'daemon.pid'),
        socketPath: path.join(skerDir, 'daemon.sock')
      },
      defaults: {
        contextWatcher: {
          debounceMs: 100,
          batchSize: 50,
          maxDepth: 8,
          cacheSize: '100MB'
        }
      },
      performance: {
        maxMemoryMB: 200,
        maxCpuPercent: 10,
        gcInterval: 300000
      }
    };
  }
}