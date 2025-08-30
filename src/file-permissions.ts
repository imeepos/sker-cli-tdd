import * as fs from 'fs';
import * as path from 'path';
import { FileContext, FolderContext } from './context';
import { ConfigManager } from './config-manager';

/**
 * 文件权限信息接口
 */
export interface FilePermissions {
  /** 是否可读 */
  readable: boolean;
  /** 是否可写 */
  writable: boolean;
  /** 是否可执行 */
  executable: boolean;
  /** 权限模式（八进制） */
  mode: number;
  /** 文件所有者 */
  owner: {
    uid: number;
    username?: string;
  };
  /** 文件组 */
  group: {
    gid: number;
    groupname?: string;
  };
  /** 文件大小 */
  size: number;
  /** 最后修改时间 */
  mtime: Date;
}

/**
 * 文件夹权限信息接口
 */
export interface FolderPermissions {
  /** 文件夹是否可读 */
  readable: boolean;
  /** 文件夹是否可写 */
  writable: boolean;
  /** 文件夹是否可执行（可进入） */
  executable: boolean;
  /** 文件列表及其权限 */
  files: Array<{
    name: string;
    path: string;
    permissions: FilePermissions;
  }>;
  /** 子文件夹列表及其权限 */
  folders: Array<{
    name: string;
    path: string;
    permissions: FolderPermissions;
  }>;
}

/**
 * 权限问题接口
 */
export interface PermissionIssue {
  /** 文件路径 */
  file: string;
  /** 问题描述 */
  issue: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high';
  /** 建议解决方案 */
  suggestion?: string;
}

/**
 * 文件权限管理工具
 *
 * 基于FileContext和FolderContext提供完整的文件权限管理功能，
 * 包括权限检查、修改、批量操作和分析报告。
 *
 * @example
 * ```typescript
 * const manager = new FilePermissionsManager();
 * const fileContext = new FileContext('/path/to/file.txt');
 *
 * // 检查权限
 * const isReadable = await manager.isReadable(fileContext);
 * const permissions = await manager.getPermissions(fileContext);
 *
 * // 修改权限
 * await manager.setReadOnly(fileContext);
 * await manager.setMode(fileContext, 0o755);
 *
 * // 批量操作
 * const folderContext = new FolderContext('/path/to/folder');
 * await manager.setFolderReadOnly(folderContext);
 *
 * // 生成报告
 * const report = await manager.generatePermissionsReport(folderContext);
 * ```
 */
export class FilePermissionsManager {
  /**
   * 检查文件是否可读
   *
   * @param context 文件上下文
   * @returns Promise，解析为是否可读
   */
  async isReadable(context: FileContext): Promise<boolean> {
    try {
      await fs.promises.access(context.path, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查文件是否可写
   *
   * @param context 文件上下文
   * @returns Promise，解析为是否可写
   */
  async isWritable(context: FileContext): Promise<boolean> {
    try {
      await fs.promises.access(context.path, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查文件是否可执行
   *
   * @param context 文件上下文
   * @returns Promise，解析为是否可执行
   */
  async isExecutable(context: FileContext): Promise<boolean> {
    try {
      await fs.promises.access(context.path, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件的详细权限信息
   *
   * @param context 文件上下文
   * @returns Promise，解析为权限信息
   */
  async getPermissions(context: FileContext): Promise<FilePermissions> {
    const stats = await fs.promises.stat(context.path);

    return {
      readable: await this.isReadable(context),
      writable: await this.isWritable(context),
      executable: await this.isExecutable(context),
      mode: stats.mode,
      owner: {
        uid: stats.uid,
        username: this.getUsername(stats.uid),
      },
      group: {
        gid: stats.gid,
        groupname: this.getGroupname(stats.gid),
      },
      size: stats.size,
      mtime: stats.mtime,
    };
  }

  /**
   * 设置文件为只读
   *
   * @param context 文件上下文
   */
  async setReadOnly(context: FileContext): Promise<void> {
    const stats = await fs.promises.stat(context.path);
    const newMode = stats.mode & ~0o200; // 移除写权限
    await fs.promises.chmod(context.path, newMode);
  }

  /**
   * 设置文件为可写
   *
   * @param context 文件上下文
   */
  async setWritable(context: FileContext): Promise<void> {
    const stats = await fs.promises.stat(context.path);
    const newMode = stats.mode | 0o200; // 添加写权限
    await fs.promises.chmod(context.path, newMode);
  }

  /**
   * 设置文件为可执行
   *
   * @param context 文件上下文
   */
  async setExecutable(context: FileContext): Promise<void> {
    const stats = await fs.promises.stat(context.path);
    const newMode = stats.mode | 0o111; // 添加执行权限
    await fs.promises.chmod(context.path, newMode);
  }

  /**
   * 使用八进制模式设置权限
   *
   * @param context 文件上下文
   * @param mode 八进制权限模式
   */
  async setMode(context: FileContext, mode: number): Promise<void> {
    await fs.promises.chmod(context.path, mode);
  }

  /**
   * 批量检查文件夹中所有文件的权限
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为文件夹权限信息
   */
  async checkFolderPermissions(
    context: FolderContext
  ): Promise<FolderPermissions> {
    const files: Array<{
      name: string;
      path: string;
      permissions: FilePermissions;
    }> = [];
    const folders: Array<{
      name: string;
      path: string;
      permissions: FolderPermissions;
    }> = [];

    // 检查文件夹自身权限
    const folderReadable = await this.isFolderReadable(context);
    const folderWritable = await this.isFolderWritable(context);
    const folderExecutable = await this.isFolderExecutable(context);

    // 检查所有文件
    const allFiles = context.getAllFiles();
    for (const file of allFiles) {
      try {
        const permissions = await this.getPermissions(file);
        files.push({
          name: file.name,
          path: file.path,
          permissions,
        });
      } catch (error) {
        console.warn(
          `无法获取文件权限 ${file.path}: ${(error as Error).message}`
        );
      }
    }

    // 递归检查子文件夹
    const allFolders = context.getAllSubfolders();
    for (const folder of allFolders) {
      try {
        const permissions = await this.checkFolderPermissions(folder);
        folders.push({
          name: folder.name,
          path: folder.path,
          permissions,
        });
      } catch (error) {
        console.warn(
          `无法获取文件夹权限 ${folder.path}: ${(error as Error).message}`
        );
      }
    }

    return {
      readable: folderReadable,
      writable: folderWritable,
      executable: folderExecutable,
      files,
      folders,
    };
  }

  /**
   * 批量设置文件夹中所有文件为只读
   *
   * @param context 文件夹上下文
   */
  async setFolderReadOnly(context: FolderContext): Promise<void> {
    const allFiles = context.getAllFiles();

    for (const file of allFiles) {
      try {
        await this.setReadOnly(file);
      } catch (error) {
        console.warn(
          `无法设置文件只读 ${file.path}: ${(error as Error).message}`
        );
      }
    }
  }

  /**
   * 生成权限分析报告
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为权限报告字符串
   */
  async generatePermissionsReport(context: FolderContext): Promise<string> {
    const folderPermissions = await this.checkFolderPermissions(context);
    const lines: string[] = [];

    lines.push('📋 权限分析报告');
    lines.push('='.repeat(50));
    lines.push(`📁 目录: ${context.path}`);
    lines.push(`📊 文件总数: ${folderPermissions.files.length}`);

    // 统计权限分布
    const readableFiles = folderPermissions.files.filter(
      f => f.permissions.readable
    ).length;
    const writableFiles = folderPermissions.files.filter(
      f => f.permissions.writable
    ).length;
    const executableFiles = folderPermissions.files.filter(
      f => f.permissions.executable
    ).length;

    lines.push(`👁️  可读文件: ${readableFiles}`);
    lines.push(`✏️  可写文件: ${writableFiles}`);
    lines.push(`⚡ 可执行文件: ${executableFiles}`);

    // 权限问题
    const issues = await this.findPermissionIssues(context);
    if (issues.length > 0) {
      lines.push('');
      lines.push('⚠️  权限问题:');
      for (const issue of issues) {
        lines.push(
          `  ${issue.severity.toUpperCase()}: ${issue.file} - ${issue.issue}`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * 识别权限异常文件
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为权限问题数组
   */
  async findPermissionIssues(
    context: FolderContext
  ): Promise<PermissionIssue[]> {
    const issues: PermissionIssue[] = [];
    const allFiles = context.getAllFiles();

    for (const file of allFiles) {
      try {
        const permissions = await this.getPermissions(file);

        // 检查常见权限问题
        if (!permissions.readable) {
          issues.push({
            file: file.path,
            issue: '文件不可读',
            severity: 'high',
            suggestion: '检查文件权限设置',
          });
        }

        // 检查可执行的非脚本文件
        if (permissions.executable && !this.isScriptFile(file.name)) {
          issues.push({
            file: file.path,
            issue: '非脚本文件具有执行权限',
            severity: 'medium',
            suggestion: '移除不必要的执行权限',
          });
        }

        // 检查权限过于宽松的文件
        if ((permissions.mode & 0o777) === 0o777) {
          issues.push({
            file: file.path,
            issue: '文件权限过于宽松 (777)',
            severity: 'high',
            suggestion: '限制文件权限',
          });
        }
      } catch (error) {
        issues.push({
          file: file.path,
          issue: `无法检查权限: ${(error as Error).message}`,
          severity: 'low',
        });
      }
    }

    return issues;
  }

  /**
   * 检查文件夹是否可读
   * @private
   */
  private async isFolderReadable(context: FolderContext): Promise<boolean> {
    try {
      await fs.promises.access(context.path, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查文件夹是否可写
   * @private
   */
  private async isFolderWritable(context: FolderContext): Promise<boolean> {
    try {
      await fs.promises.access(context.path, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查文件夹是否可执行（可进入）
   * @private
   */
  private async isFolderExecutable(context: FolderContext): Promise<boolean> {
    try {
      await fs.promises.access(context.path, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取用户名（简化实现）
   * @private
   */
  private getUsername(uid: number): string | undefined {
    // 在实际实现中，可以通过系统调用获取用户名
    const configManager = ConfigManager.getInstance();
    return process.getuid && process.getuid() === uid
      ? configManager.getCurrentUser()
      : undefined;
  }

  /**
   * 获取组名（简化实现）
   * @private
   */
  private getGroupname(gid: number): string | undefined {
    // 在实际实现中，可以通过系统调用获取组名
    return process.getgid && process.getgid() === gid ? 'users' : undefined;
  }

  /**
   * 判断是否为脚本文件
   * @private
   */
  private isScriptFile(filename: string): boolean {
    const scriptExtensions = [
      '.sh',
      '.bat',
      '.cmd',
      '.ps1',
      '.py',
      '.js',
      '.ts',
    ];
    const ext = path.extname(filename).toLowerCase();
    return scriptExtensions.includes(ext);
  }
}
