/**
 * 🟢 TDD 绿阶段：多项目管理器实现
 * 实现项目注册和注销、项目隔离和资源管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as JSON5 from 'json5';
import { EventEmitter } from 'events';
import { ContextBuilder } from '../context-builder';
import { FolderContext } from '../folder-context';
import { ProjectWatcher, ProjectWatchConfig, FileChangeEvent } from '../watchers/project-watcher';

/**
 * 项目状态枚举
 */
export enum ProjectStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
  SCANNING = 'scanning'
}

/**
 * 项目管理器配置接口
 */
export interface ProjectManagerConfig {
  /** 最大项目数量 */
  maxProjects?: number;
  /** 每个项目的最大内存限制（字节） */
  maxMemoryPerProject?: number;
  /** 是否启用文件监听 */
  enableWatching?: boolean;
  /** 监听器防抖延迟时间（毫秒） */
  watcherDebounceMs?: number;
}

/**
 * 项目配置接口
 */
export interface ProjectConfig {
  /** 项目唯一标识符 */
  id: string;
  /** 项目根路径 */
  rootPath: string;
  /** 项目名称 */
  name: string;
  /** 项目版本 */
  version?: string;
  /** 项目描述 */
  description?: string;
  /** 项目状态 */
  status: ProjectStatus;
  /** 注册时间 */
  registeredAt: Date;
  /** 最后活跃时间 */
  lastActiveAt: Date;
  /** 最后扫描时间 */
  lastScanAt?: Date;
  /** 内存限制 */
  memoryLimit?: number;
  /** 当前内存使用量 */
  memoryUsage: number;
  /** 最后一次错误 */
  lastError?: Error;
  /** 是否正在监听文件变化 */
  isWatching: boolean;
}

/**
 * 项目统计信息接口
 */
export interface ProjectStats {
  /** 项目ID */
  projectId: string;
  /** 项目状态 */
  status: ProjectStatus;
  /** 文件数量 */
  fileCount: number;
  /** 内存使用量（字节） */
  memoryUsage: number;
  /** 最后扫描时间 */
  lastScanTime?: Date;
  /** 扫描次数 */
  scanCount: number;
  /** 文件变更次数 */
  changeCount: number;
}

/**
 * 全局统计信息接口
 */
export interface GlobalStats {
  /** 总项目数 */
  totalProjects: number;
  /** 活跃项目数 */
  activeProjects: number;
  /** 暂停项目数 */
  pausedProjects: number;
  /** 错误项目数 */
  errorProjects: number;
  /** 总内存使用量 */
  totalMemoryUsage: number;
  /** 总文件数 */
  totalFiles: number;
}

/**
 * 项目扫描结果接口
 */
export interface ProjectScanResult {
  /** 扫描是否成功 */
  success: boolean;
  /** 文件数量 */
  fileCount: number;
  /** 扫描耗时（毫秒） */
  scanTime: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 项目资源接口
 */
interface ProjectResource {
  /** 项目配置 */
  config: ProjectConfig;
  /** 上下文构建器 */
  contextBuilder: ContextBuilder;
  /** 文件监听器 */
  watcher?: ProjectWatcher;
  /** 项目根上下文 */
  rootContext?: FolderContext;
  /** 统计信息 */
  stats: ProjectStats;
}

/**
 * 多项目管理器类
 * 
 * 负责管理多个项目的注册、注销、扫描和监听。
 * 提供项目隔离和资源管理功能。
 */
export class ProjectManager extends EventEmitter {
  /** 项目管理器配置 */
  private config: Required<ProjectManagerConfig>;
  
  /** 项目资源映射 */
  private projects: Map<string, ProjectResource> = new Map();
  
  /** 路径到项目ID的映射 */
  private pathToProjectMap: Map<string, string> = new Map();

  /**
   * 构造函数
   * 
   * @param config 项目管理器配置
   */
  constructor(config: ProjectManagerConfig = {}) {
    super();

    // 验证配置参数
    if (config.maxProjects !== undefined && config.maxProjects <= 0) {
      throw new Error('最大项目数量必须大于0');
    }

    this.config = {
      maxProjects: config.maxProjects ?? 100,
      maxMemoryPerProject: config.maxMemoryPerProject ?? 512 * 1024 * 1024, // 512MB
      enableWatching: config.enableWatching ?? true,
      watcherDebounceMs: config.watcherDebounceMs ?? 300
    };
  }

  /**
   * 获取最大项目数量
   */
  getMaxProjects(): number {
    return this.config.maxProjects;
  }

  /**
   * 获取当前项目数量
   */
  getProjectCount(): number {
    return this.projects.size;
  }

  /**
   * 获取项目列表
   */
  getProjectList(): string[] {
    return Array.from(this.projects.keys());
  }

  /**
   * 检查项目是否存在
   */
  hasProject(projectId: string): boolean {
    return this.projects.has(projectId);
  }

  /**
   * 注册项目
   */
  async registerProject(rootPath: string): Promise<string> {
    // 验证项目目录
    const normalizedPath = path.resolve(rootPath);
    
    try {
      const stats = await fs.promises.stat(normalizedPath);
      if (!stats.isDirectory()) {
        throw new Error('项目路径必须是目录');
      }
    } catch (error) {
      throw new Error('项目目录不存在');
    }

    // 检查是否已经注册
    if (this.pathToProjectMap.has(normalizedPath)) {
      throw new Error('项目已存在');
    }

    // 检查项目数量限制
    if (this.projects.size >= this.config.maxProjects) {
      throw new Error('已达到最大项目数量限制');
    }

    // 检查项目配置文件
    const skerJsonPath = path.join(normalizedPath, 'sker.json');
    try {
      await fs.promises.access(skerJsonPath, fs.constants.F_OK);
    } catch (error) {
      throw new Error('项目配置文件不存在');
    }

    // 读取项目配置
    let projectInfo: any;
    try {
      const configContent = await fs.promises.readFile(skerJsonPath, 'utf8');
      projectInfo = JSON5.parse(configContent);
    } catch (error) {
      throw new Error(`无法解析项目配置: ${(error as Error).message}`);
    }

    // 生成项目ID
    const projectId = this.generateProjectId(normalizedPath, projectInfo.name || path.basename(normalizedPath));

    // 创建项目配置
    const projectConfig: ProjectConfig = {
      id: projectId,
      rootPath: normalizedPath,
      name: projectInfo.name || path.basename(normalizedPath),
      version: projectInfo.version,
      description: projectInfo.description,
      status: ProjectStatus.ACTIVE,
      registeredAt: new Date(),
      lastActiveAt: new Date(),
      memoryLimit: this.config.maxMemoryPerProject,
      memoryUsage: 0,
      isWatching: false
    };

    // 创建项目统计信息
    const projectStats: ProjectStats = {
      projectId,
      status: ProjectStatus.ACTIVE,
      fileCount: 0,
      memoryUsage: 0,
      scanCount: 0,
      changeCount: 0
    };

    // 创建项目资源
    const projectResource: ProjectResource = {
      config: projectConfig,
      contextBuilder: new ContextBuilder(),
      stats: projectStats
    };

    // 注册项目
    this.projects.set(projectId, projectResource);
    this.pathToProjectMap.set(normalizedPath, projectId);

    this.emit('project-registered', projectId, projectConfig);
    return projectId;
  }

  /**
   * 注销项目
   */
  async unregisterProject(projectId: string): Promise<void> {
    const resource = this.projects.get(projectId);
    if (!resource) {
      return; // 项目不存在，静默返回
    }

    // 停止文件监听
    if (resource.watcher) {
      await resource.watcher.stop();
    }

    // 清理资源
    await this.cleanupProject(projectId);

    // 从映射中移除
    this.pathToProjectMap.delete(resource.config.rootPath);
    this.projects.delete(projectId);

    this.emit('project-unregistered', projectId);
  }

  /**
   * 获取项目配置
   */
  getProjectConfig(projectId: string): ProjectConfig | undefined {
    const resource = this.projects.get(projectId);
    return resource ? { ...resource.config } : undefined;
  }

  /**
   * 获取项目状态
   */
  getProjectStatus(projectId: string): ProjectStatus | undefined {
    const resource = this.projects.get(projectId);
    return resource?.config.status;
  }

  /**
   * 暂停项目
   */
  async pauseProject(projectId: string): Promise<void> {
    const resource = this.projects.get(projectId);
    if (!resource) {
      throw new Error('项目不存在');
    }

    const oldStatus = resource.config.status;
    resource.config.status = ProjectStatus.PAUSED;
    resource.stats.status = ProjectStatus.PAUSED;

    // 停止文件监听
    if (resource.watcher) {
      await resource.watcher.stop();
      resource.config.isWatching = false;
    }

    this.emit('project-status-changed', projectId, oldStatus, ProjectStatus.PAUSED);
  }

  /**
   * 恢复项目
   */
  async resumeProject(projectId: string): Promise<void> {
    const resource = this.projects.get(projectId);
    if (!resource) {
      throw new Error('项目不存在');
    }

    const oldStatus = resource.config.status;
    resource.config.status = ProjectStatus.ACTIVE;
    resource.config.lastActiveAt = new Date();
    resource.config.lastError = undefined;
    resource.stats.status = ProjectStatus.ACTIVE;

    this.emit('project-status-changed', projectId, oldStatus, ProjectStatus.ACTIVE);
  }

  /**
   * 标记项目错误状态
   */
  async markProjectError(projectId: string, error: Error): Promise<void> {
    const resource = this.projects.get(projectId);
    if (!resource) {
      return;
    }

    const oldStatus = resource.config.status;
    resource.config.status = ProjectStatus.ERROR;
    resource.config.lastError = error;
    resource.stats.status = ProjectStatus.ERROR;

    this.emit('project-status-changed', projectId, oldStatus, ProjectStatus.ERROR);
    this.emit('project-error', projectId, error);
  }

  /**
   * 获取上下文构建器
   */
  getContextBuilder(projectId: string): ContextBuilder | undefined {
    const resource = this.projects.get(projectId);
    return resource?.contextBuilder;
  }

  /**
   * 扫描项目
   */
  async scanProject(projectId: string): Promise<ProjectScanResult> {
    const resource = this.projects.get(projectId);
    if (!resource) {
      throw new Error('项目不存在');
    }

    const startTime = Date.now();
    resource.config.status = ProjectStatus.SCANNING;
    resource.stats.status = ProjectStatus.SCANNING;

    try {
      // 先检查目录是否存在
      try {
        const stats = await fs.promises.stat(resource.config.rootPath);
        if (!stats.isDirectory()) {
          throw new Error('项目路径不是目录');
        }
      } catch (error) {
        throw new Error(`项目目录不存在或无法访问: ${(error as Error).message}`);
      }
      
      // 使用上下文构建器扫描项目
      const rootContext = await resource.contextBuilder.buildFromDirectory(resource.config.rootPath, {
        respectGitignore: false, // 暂时禁用gitignore以调试
        includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md']
      });

      resource.rootContext = rootContext;
      resource.config.lastScanAt = new Date();
      resource.config.status = ProjectStatus.ACTIVE;
      resource.stats.status = ProjectStatus.ACTIVE;
      resource.stats.lastScanTime = new Date();
      resource.stats.scanCount++;

      // 计算文件数量和内存使用量
      const fileCount = this.calculateFileCount(rootContext);
      const memoryUsage = this.estimateMemoryUsage(fileCount);

      resource.stats.fileCount = fileCount;
      resource.stats.memoryUsage = memoryUsage;
      resource.config.memoryUsage = memoryUsage;

      const scanTime = Date.now() - startTime;

      this.emit('project-scanned', projectId, { fileCount, scanTime });

      return {
        success: true,
        fileCount,
        scanTime
      };
    } catch (error) {
      resource.config.status = ProjectStatus.ERROR;
      resource.config.lastError = error as Error;
      resource.stats.status = ProjectStatus.ERROR;

      const scanTime = Date.now() - startTime;

      this.emit('project-error', projectId, error as Error);

      return {
        success: false,
        fileCount: 0,
        scanTime,
        error: (error as Error).message
      };
    }
  }

  /**
   * 启动项目文件监听
   */
  async startWatching(projectId: string): Promise<void> {
    const resource = this.projects.get(projectId);
    if (!resource) {
      throw new Error('项目不存在');
    }

    if (!this.config.enableWatching) {
      return;
    }

    if (resource.watcher) {
      return; // 已经在监听
    }

    try {
      const watchConfig: ProjectWatchConfig = {
        projectPath: resource.config.rootPath,
        watchPatterns: ['**/*'],
        ignorePatterns: ['**/node_modules/**', '**/.git/**'],
        debounceMs: this.config.watcherDebounceMs,
        batchSize: 50,
        respectGitignore: true
      };
      resource.watcher = new ProjectWatcher(watchConfig);

      resource.watcher.on('change', (event: FileChangeEvent) => {
        resource.stats.changeCount++;
        this.emit('file-changed', projectId, event.path, event.type);
      });

      resource.watcher.on('error', (error) => {
        const projectError = error instanceof Error ? error : new Error(String(error));
        this.markProjectError(projectId, projectError);
      });

      await resource.watcher.start();
      resource.config.isWatching = true;

      this.emit('project-watching-started', projectId);
    } catch (error) {
      await this.markProjectError(projectId, error as Error);
      throw error;
    }
  }

  /**
   * 停止项目文件监听
   */
  async stopWatching(projectId: string): Promise<void> {
    const resource = this.projects.get(projectId);
    if (!resource || !resource.watcher) {
      return;
    }

    await resource.watcher.stop();
    resource.watcher = undefined;
    resource.config.isWatching = false;

    this.emit('project-watching-stopped', projectId);
  }

  /**
   * 检查项目是否正在监听
   */
  isWatching(projectId: string): boolean {
    const resource = this.projects.get(projectId);
    return resource?.config.isWatching ?? false;
  }

  /**
   * 获取项目上下文
   */
  async getProjectContext(projectId: string): Promise<FolderContext | undefined> {
    const resource = this.projects.get(projectId);
    return resource?.rootContext;
  }

  /**
   * 清理项目资源
   */
  async cleanupProject(projectId: string): Promise<void> {
    const resource = this.projects.get(projectId);
    if (!resource) {
      return;
    }

    // 停止监听
    if (resource.watcher) {
      await resource.watcher.stop();
      resource.watcher = undefined;
    }

    // 清理上下文
    resource.rootContext = undefined;

    // 重置统计信息
    resource.stats.fileCount = 0;
    resource.stats.memoryUsage = 0;
    resource.config.memoryUsage = 0;

    this.emit('project-cleaned', projectId);
  }

  /**
   * 获取项目统计信息
   */
  getProjectStats(projectId: string): ProjectStats {
    const resource = this.projects.get(projectId);
    if (!resource) {
      throw new Error('项目不存在');
    }

    return { ...resource.stats };
  }

  /**
   * 获取全局统计信息
   */
  getGlobalStats(): GlobalStats {
    let totalProjects = 0;
    let activeProjects = 0;
    let pausedProjects = 0;
    let errorProjects = 0;
    let totalMemoryUsage = 0;
    let totalFiles = 0;

    for (const [, resource] of this.projects) {
      totalProjects++;
      
      switch (resource.config.status) {
        case ProjectStatus.ACTIVE:
        case ProjectStatus.SCANNING:
          activeProjects++;
          break;
        case ProjectStatus.PAUSED:
          pausedProjects++;
          break;
        case ProjectStatus.ERROR:
          errorProjects++;
          break;
      }

      totalMemoryUsage += resource.stats.memoryUsage;
      totalFiles += resource.stats.fileCount;
    }

    return {
      totalProjects,
      activeProjects,
      pausedProjects,
      errorProjects,
      totalMemoryUsage,
      totalFiles
    };
  }

  /**
   * 关闭项目管理器
   */
  async shutdown(): Promise<void> {
    // 停止所有项目的监听
    const stopPromises = Array.from(this.projects.keys()).map(projectId => 
      this.stopWatching(projectId)
    );
    await Promise.all(stopPromises);

    // 清理所有项目
    this.projects.clear();
    this.pathToProjectMap.clear();

    this.emit('shutdown');
  }

  /**
   * 强制清理所有资源
   */
  async forceCleanup(): Promise<void> {
    // 强制停止所有监听器
    for (const [, resource] of this.projects) {
      if (resource.watcher) {
        try {
          await resource.watcher.stop();
        } catch (error) {
          // 忽略强制清理时的错误
        }
      }
    }

    // 清理所有映射
    this.projects.clear();
    this.pathToProjectMap.clear();

    this.emit('force-cleanup');
  }

  /**
   * 生成项目唯一ID
   * 
   * @param rootPath 项目根路径
   * @param projectName 项目名称
   * @returns 项目唯一ID
   * @private
   */
  private generateProjectId(rootPath: string, projectName: string): string {
    const hash = this.simpleHash(rootPath);
    const timestamp = Date.now();
    return `${projectName}-${hash}-${timestamp}`.replace(/[^a-zA-Z0-9-]/g, '-');
  }

  /**
   * 简单哈希函数
   * 
   * @param str 输入字符串
   * @returns 哈希值
   * @private
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 计算文件数量
   * 
   * @param context 文件夹上下文
   * @returns 文件数量
   * @private
   */
  private calculateFileCount(context: FolderContext): number {
    let count = 0;
    
    const countFiles = (ctx: FolderContext): void => {
      for (const child of ctx.children) {
        // 使用更可靠的方法检查文件类型
        if (child.constructor.name === 'FileContext') {
          count++;
        } else if (child.constructor.name === 'FolderContext') {
          countFiles(child as FolderContext);
        }
      }
    };

    countFiles(context);
    return count;
  }

  /**
   * 估算内存使用量
   * 
   * @param fileCount 文件数量
   * @returns 估算的内存使用量（字节）
   * @private
   */
  private estimateMemoryUsage(fileCount: number): number {
    // 简单估算：每个文件上下文约占用1KB内存
    return fileCount * 1024;
  }
}