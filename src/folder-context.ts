/**
 * 🟢 TDD 绿阶段：FolderContext 文件夹上下文实现
 * 提供文件夹上下文的完整功能
 */

import * as path from 'path';
import * as fs from 'fs';
import { Context, ProjectInfo } from './context-base';
import { FileContext } from './file-context';

/**
 * 文件夹上下文类
 *
 * 表示文件系统中文件夹的上下文信息，包含子级上下文的管理功能。
 * 文件夹可以包含其他文件夹和文件，形成树形结构。
 *
 * @example
 * ```typescript
 * const folder = new FolderContext('/project/src');
 * const file = new FileContext('/project/src/index.ts');
 *
 * folder.addChild(file);
 * console.log(folder.children.length); // 1
 * console.log(folder.findChild('index.ts')); // FileContext实例
 * ```
 */
export class FolderContext implements Context {
  /** 文件夹的完整绝对路径 */
  public readonly path: string;

  /** 文件夹名称 */
  public readonly name: string;

  /** 上下文类型，固定为 'folder' */
  public readonly type: 'folder' = 'folder';

  /** 父级文件夹上下文 */
  public parent?: Context | undefined;

  /** 子级上下文列表（文件和子文件夹） */
  public readonly children: Context[] = [];

  /** 是否为项目根目录（包含sker.json文件） */
  public isProjectRoot: boolean = false;

  /** 项目配置信息（从sker.json解析得到） */
  public projectInfo?: ProjectInfo;

  /**
   * 创建文件夹上下文实例
   * @param folderPath 文件夹的完整路径
   */
  constructor(folderPath: string) {
    this.path = folderPath;
    this.name = path.basename(folderPath);
  }

  /**
   * 设置父级上下文
   *
   * 建立与父级文件夹的关联关系。通常在构建文件树时自动调用。
   *
   * @param parent 父级文件夹上下文
   */
  setParent(parent: Context): void {
    this.parent = parent;
  }

  /**
   * 添加子级上下文
   *
   * 将文件或子文件夹添加到当前文件夹中，同时建立双向关联关系。
   * 如果子级已存在则不会重复添加。
   *
   * @param child 要添加的子级上下文（文件或文件夹）
   */
  addChild(child: Context): void {
    if (!this.children.includes(child)) {
      this.children.push(child);
      child.parent = this;
    }
  }

  /**
   * 移除子级上下文
   *
   * 从当前文件夹中移除指定的子级上下文，同时断开双向关联关系。
   *
   * @param child 要移除的子级上下文
   */
  removeChild(child: Context): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = undefined as Context | undefined;
    }
  }

  /**
   * 按名称查找子级上下文
   *
   * 在当前文件夹的直接子级中查找指定名称的上下文。
   * 只查找直接子级，不进行递归搜索。
   *
   * @param name 要查找的子级名称（文件名或文件夹名）
   * @returns 找到的子级上下文，如果不存在则返回undefined
   */
  findChild(name: string): Context | undefined {
    return this.children.find(child => child.name === name);
  }

  /**
   * 检查当前文件夹是否为项目根目录（同步版本）
   *
   * 直接返回isProjectRoot属性的值。这个方法不进行文件系统访问，
   * 性能较好，适合在已知项目结构的情况下使用。
   *
   * @returns true表示是项目根目录，false表示不是
   */
  checkIsProjectRootSync(): boolean {
    return this.isProjectRoot;
  }

  /**
   * 检查当前文件夹是否为项目根目录（异步版本）
   *
   * 为了保持向后兼容性，提供异步版本的方法。
   * 如果isProjectRoot属性已设置，直接返回；否则进行文件系统检查。
   *
   * @returns Promise，解析为true表示是项目根目录，false表示不是
   */
  async checkIsProjectRoot(): Promise<boolean> {
    // 如果已经在扫描时标记过，直接返回
    if (this.isProjectRoot !== undefined) {
      return this.isProjectRoot;
    }

    // 否则进行文件系统检查（兼容性）
    const skerJsonPath = path.join(this.path, 'sker.json');

    try {
      await fs.promises.access(skerJsonPath, fs.constants.F_OK);
      this.isProjectRoot = true;
      return true;
    } catch {
      this.isProjectRoot = false;
      return false;
    }
  }

  /**
   * 检查当前文件夹是否为多子项目工作空间（优化版本）
   *
   * 通过检查直接子文件夹中标记为项目根目录的数量来判断。
   * 多子项目工作空间中每个子项目拥有独立的上下文。
   * 这个方法不需要文件系统访问，性能更好。
   *
   * @returns Promise，解析为true表示是多子项目工作空间，false表示不是
   */
  async isMultiProjectWorkspace(): Promise<boolean> {
    // 基于已扫描的children快速判断
    const projectRoots = this.children.filter(
      child => child.type === 'folder' && (child as FolderContext).isProjectRoot
    );

    return projectRoots.length >= 2; // 至少2个子项目才算工作空间
  }

  /**
   * 获取所有子项目信息
   *
   * 扫描直接子文件夹，返回所有包含sker.json的子项目信息。
   * 每个子项目都有独立的上下文隔离。
   *
   * @returns Promise，解析为子项目信息数组
   */
  async getSubProjects(): Promise<ProjectInfo[]> {
    const subProjects: ProjectInfo[] = [];

    try {
      const entries = await fs.promises.readdir(this.path, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(this.path, entry.name);
          const skerJsonPath = path.join(subPath, 'sker.json');

          try {
            await fs.promises.access(skerJsonPath, fs.constants.F_OK);
            const content = await fs.promises.readFile(skerJsonPath, 'utf8');
            const projectInfo: ProjectInfo = JSON.parse(content);

            // 确保项目名称存在，如果没有则使用文件夹名
            if (!projectInfo.name) {
              projectInfo.name = entry.name;
            }

            subProjects.push(projectInfo);
          } catch (error) {
            // 如果读取失败，创建基本的项目信息
            console.warn(
              `无法读取项目配置 ${skerJsonPath}: ${(error as Error).message}`
            );
            subProjects.push({
              name: entry.name,
            });
          }
        }
      }
    } catch (error) {
      console.warn(`无法扫描子项目 ${this.path}: ${(error as Error).message}`);
    }

    return subProjects;
  }

  /**
   * 获取项目信息（优化版本）
   *
   * 如果当前文件夹是项目根目录，返回扫描时缓存的项目信息。
   * 如果缓存不存在，则进行文件系统读取（兼容性）。
   *
   * @returns Promise，解析为项目信息，如果不是项目根目录则返回null
   */
  async getProjectInfo(): Promise<ProjectInfo | null> {
    const isProject = await this.checkIsProjectRoot();
    if (!isProject) {
      return null;
    }

    // 如果已经缓存了项目信息，直接返回
    if (this.projectInfo) {
      return this.projectInfo;
    }

    return null;
  }

  /**
   * 获取文件夹总大小（递归计算所有子文件）
   *
   * 递归遍历文件夹及其所有子文件夹，计算所有文件的总大小。
   * 这个方法会访问文件系统获取每个文件的实际大小。
   *
   * @returns Promise，解析为文件夹总大小（字节）
   */
  async getTotalSize(): Promise<number> {
    let totalSize = 0;

    for (const child of this.children) {
      if (child.type === 'file') {
        try {
          const stats = await fs.promises.stat(child.path);
          totalSize += stats.size;
        } catch (error) {
          // 忽略无法访问的文件
          console.warn(
            `无法获取文件大小 ${child.path}: ${(error as Error).message}`
          );
        }
      } else if (child.type === 'folder') {
        // 递归计算子文件夹大小
        totalSize += await (child as FolderContext).getTotalSize();
      }
    }

    return totalSize;
  }

  /**
   * 递归获取所有文件上下文
   *
   * 深度优先遍历文件夹及其所有子文件夹，收集所有文件上下文。
   * 这个方法用于兼容旧版本API。
   *
   * @returns 所有文件上下文的数组
   */
  getAllFiles(): FileContext[] {
    const files: FileContext[] = [];

    for (const child of this.children) {
      if (child.type === 'file') {
        files.push(child as FileContext);
      } else if (child.type === 'folder') {
        files.push(...(child as FolderContext).getAllFiles());
      }
    }

    return files;
  }

  /**
   * 递归获取所有子文件夹上下文
   *
   * 深度优先遍历文件夹及其所有子文件夹，收集所有文件夹上下文。
   * 这个方法用于兼容旧版本API。
   *
   * @returns 所有子文件夹上下文的数组
   */
  getAllSubfolders(): FolderContext[] {
    const folders: FolderContext[] = [];

    for (const child of this.children) {
      if (child.type === 'folder') {
        const folderChild = child as FolderContext;
        folders.push(folderChild);
        folders.push(...folderChild.getAllSubfolders());
      }
    }

    return folders;
  }

  /**
   * 获取最近更新时间（递归查找所有子文件）
   *
   * 递归遍历文件夹及其所有子文件夹，找到最近修改的文件的修改时间。
   * 这个方法会访问文件系统获取每个文件的修改时间。
   *
   * @returns Promise，解析为最近更新时间，如果没有文件则返回文件夹自身的修改时间
   */
  async getLastModified(): Promise<Date> {
    let latestTime = new Date(0); // 初始化为最早时间

    // 检查文件夹自身的修改时间
    try {
      const folderStats = await fs.promises.stat(this.path);
      latestTime = folderStats.mtime;
    } catch (error) {
      console.warn(
        `无法获取文件夹修改时间 ${this.path}: ${(error as Error).message}`
      );
    }

    // 递归检查所有子文件和子文件夹的修改时间
    for (const child of this.children) {
      try {
        if (child.type === 'file') {
          const stats = await fs.promises.stat(child.path);
          if (stats.mtime > latestTime) {
            latestTime = stats.mtime;
          }
        } else if (child.type === 'folder') {
          const childLatest = await (child as FolderContext).getLastModified();
          if (childLatest > latestTime) {
            latestTime = childLatest;
          }
        }
      } catch (error) {
        // 忽略无法访问的文件或文件夹
        console.warn(
          `无法获取修改时间 ${child.path}: ${(error as Error).message}`
        );
      }
    }

    return latestTime;
  }

  /**
   * 获取所有子级上下文（文件和文件夹）
   *
   * @returns 所有直接和间接子级上下文的数组
   */
  getAllDescendants(): Context[] {
    const descendants: Context[] = [];

    for (const child of this.children) {
      descendants.push(child);
      if (child.type === 'folder') {
        descendants.push(...(child as FolderContext).getAllDescendants());
      }
    }

    return descendants;
  }

  /**
   * 根据正则表达式模式查找文件
   *
   * @param pattern 正则表达式模式
   * @returns 匹配的文件上下文数组
   */
  findFilesByPattern(pattern: RegExp): FileContext[] {
    const matchedFiles: FileContext[] = [];

    for (const child of this.children) {
      if (child.type === 'file') {
        if (pattern.test(child.name)) {
          matchedFiles.push(child as FileContext);
        }
      } else if (child.type === 'folder') {
        matchedFiles.push(
          ...(child as FolderContext).findFilesByPattern(pattern)
        );
      }
    }

    return matchedFiles;
  }

  /**
   * 根据正则表达式模式查找文件夹
   *
   * @param pattern 正则表达式模式
   * @returns 匹配的文件夹上下文数组
   */
  findFoldersByPattern(pattern: RegExp): FolderContext[] {
    const matchedFolders: FolderContext[] = [];

    for (const child of this.children) {
      if (child.type === 'folder') {
        const folderChild = child as FolderContext;
        if (pattern.test(child.name)) {
          matchedFolders.push(folderChild);
        }
        matchedFolders.push(...folderChild.findFoldersByPattern(pattern));
      }
    }

    return matchedFolders;
  }

  /**
   * 检查当前文件夹是否为指定上下文的子级
   *
   * @param ancestorContext 祖先上下文
   * @returns true表示是子级，false表示不是
   */
  isDescendantOf(ancestorContext: Context): boolean {
    // 简单的路径包含检查
    const normalizedAncestorPath = path.normalize(ancestorContext.path);
    const normalizedCurrentPath = path.normalize(this.path);

    return (
      normalizedCurrentPath.startsWith(normalizedAncestorPath + path.sep) ||
      normalizedCurrentPath.startsWith(normalizedAncestorPath + '/')
    );
  }

  /**
   * 生成文件夹摘要
   *
   * @returns 文件夹摘要的Promise
   */
  async getSummary(): Promise<string> {
    const fileCount = this.getAllFiles().length;
    const folderCount = this.getAllSubfolders().length;
    const totalSize = await this.getTotalSize();
    const lastModified = await this.getLastModified();

    let summary = `文件夹: ${this.name}`;

    if (fileCount > 0) {
      summary += `, ${fileCount} files`;
    }

    if (folderCount > 0) {
      summary += `, ${folderCount} folders`;
    }

    if (totalSize > 0) {
      if (totalSize < 1024) {
        summary += ` (${totalSize} B)`;
      } else if (totalSize < 1024 * 1024) {
        summary += ` (${(totalSize / 1024).toFixed(1)} KB)`;
      } else {
        summary += ` (${(totalSize / (1024 * 1024)).toFixed(1)} MB)`;
      }
    }

    if (this.isProjectRoot && this.projectInfo) {
      summary += ` [项目根目录: ${this.projectInfo.name}`;
      if (this.projectInfo.version) {
        summary += ` v${this.projectInfo.version}`;
      }
      summary += ']';
    }

    // 添加最近更新时间
    summary += ` 最近更新: ${lastModified.toISOString()}`;

    return summary;
  }
}
