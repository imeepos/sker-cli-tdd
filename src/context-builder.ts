/**
 * 🟢 TDD 绿阶段：ContextBuilder 上下文构建器实现
 * 提供完整的上下文构建功能
 */

import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';
import * as JSON5 from 'json5';
import { FolderContext } from './folder-context';
import { FileContext } from './file-context';
import { ConfigManager } from './config-manager';

/**
 * 上下文构建器选项接口
 *
 * 定义构建上下文树时的各种配置选项，包括文件过滤、深度控制
 * 和.gitignore支持等功能。
 *
 * @example
 * ```typescript
 * const options: ContextBuilderOptions = {
 *   includeExtensions: ['.ts', '.js', '.json'],
 *   excludeExtensions: ['.log', '.tmp'],
 *   maxDepth: 3,
 *   respectGitignore: true
 * };
 * ```
 */
export interface ContextBuilderOptions {
  /**
   * 包含的文件扩展名列表
   * 如果指定，则只包含这些扩展名的文件
   * @example ['.ts', '.js', '.json']
   */
  includeExtensions?: string[];

  /**
   * 排除的文件扩展名列表
   * 指定的扩展名文件将被忽略
   * @example ['.log', '.tmp', '.cache']
   */
  excludeExtensions?: string[];

  /**
   * 最大扫描深度
   * 限制目录树的扫描深度，0表示只扫描子目录
   * @default undefined（无限制）
   */
  maxDepth?: number;

  /**
   * 是否遵循.gitignore文件的忽略规则
   * 如果为true，将读取.gitignore文件并忽略匹配的文件和目录
   * @default false
   */
  respectGitignore?: boolean;

  /**
   * 自定义ignore文件路径
   * 指定要使用的ignore文件名，相对于扫描的根目录
   * @default '.gitignore'
   * @example '.dockerignore', '.eslintignore'
   */
  ignoreFile?: string;
}

/**
 * 上下文构建器类
 *
 * 负责扫描文件系统并构建Context树结构。提供灵活的过滤选项
 * 和深度控制，支持大型项目的高效扫描。
 *
 * @example
 * ```typescript
 * const builder = new ContextBuilder();
 *
 * // 基本用法
 * const rootContext = await builder.buildFromDirectory('/project');
 *
 * // 带过滤选项
 * const filteredContext = await builder.buildFromDirectory('/project', {
 *   includeExtensions: ['.ts', '.js'],
 *   maxDepth: 2
 * });
 * ```
 */
export class ContextBuilder {
  /** ignore实例，用于处理.gitignore规则 */
  private ignoreInstance: ReturnType<typeof ignore> | null = null;

  /**
   * 从指定目录构建完整的上下文树
   *
   * 扫描指定目录及其子目录，根据提供的选项过滤文件，
   * 构建完整的Context树结构。支持.gitignore文件的忽略规则。
   *
   * @param directoryPath 要扫描的根目录路径
   * @param options 构建选项，用于控制扫描行为
   * @returns Promise，解析为根文件夹的FolderContext实例
   */
  async buildFromDirectory(
    directoryPath: string,
    options: ContextBuilderOptions = {}
  ): Promise<FolderContext> {
    const rootContext = new FolderContext(directoryPath);

    // 如果需要遵循gitignore规则，初始化ignore实例
    if (options.respectGitignore) {
      await this.initializeIgnore(
        directoryPath,
        options.ignoreFile || '.gitignore'
      );
    } else {
      this.ignoreInstance = null;
    }

    await this.scanDirectory(rootContext, options, 0);
    return rootContext;
  }

  /**
   * 初始化ignore实例
   *
   * 读取指定的ignore文件（如.gitignore）并创建ignore实例用于文件过滤。
   *
   * @param rootPath 根目录路径
   * @param ignoreFileName ignore文件名
   * @private
   */
  private async initializeIgnore(
    rootPath: string,
    ignoreFileName: string
  ): Promise<void> {
    const ignoreFilePath = path.join(rootPath, ignoreFileName);

    try {
      const ignoreContent = await fs.promises.readFile(ignoreFilePath, 'utf8');
      this.ignoreInstance = ignore().add(ignoreContent);
    } catch (error) {
      // 如果ignore文件不存在或无法读取，创建空的ignore实例
      this.ignoreInstance = ignore();
    }
  }

  /**
   * 递归扫描目录的私有方法
   *
   * 深度优先遍历目录结构，根据选项过滤文件和控制扫描深度。
   * 对于每个发现的文件和子目录，创建相应的Context实例并建立关系。
   * 支持.gitignore规则的文件过滤。
   *
   * @param folderContext 当前正在扫描的文件夹上下文
   * @param options 构建选项，包含过滤和深度限制
   * @param currentDepth 当前扫描深度（从0开始）
   * @private
   */
  private async scanDirectory(
    folderContext: FolderContext,
    options: ContextBuilderOptions,
    currentDepth: number
  ): Promise<void> {
    // 检查深度限制
    if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) {
      return;
    }

    try {
      const entries = await fs.promises.readdir(folderContext.path, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(folderContext.path, entry.name);

        // 检查是否应该被ignore规则忽略
        if (this.shouldIgnoreByGitignore(fullPath, entry.isDirectory())) {
          continue;
        }

        if (entry.isDirectory()) {
          const subfolderContext = new FolderContext(fullPath);
          folderContext.addChild(subfolderContext);

          // 递归扫描子目录
          await this.scanDirectory(subfolderContext, options, currentDepth + 1);
        } else if (entry.isFile()) {
          // 检查是否为sker.json文件，如果是则标记父文件夹为项目根目录并读取配置
          if (entry.name === 'sker.json') {
            folderContext.isProjectRoot = true;

            // 读取并解析sker.json文件
            try {
              const skerJsonContent = await fs.promises.readFile(
                fullPath,
                'utf8'
              );
              const projectInfo = JSON5.parse(skerJsonContent);

              // 确保项目名称存在，如果没有则使用文件夹名
              if (!projectInfo.name) {
                projectInfo.name = folderContext.name;
              }

              folderContext.projectInfo = projectInfo;
            } catch (error) {
              // 如果解析失败，创建基本的项目信息
              // 在测试环境下不输出警告，避免测试噪音
              const configManager = ConfigManager.getInstance();
              if (!configManager.isTestEnvironment()) {
                console.warn(
                  `无法解析项目配置 ${fullPath}: ${(error as Error).message}`
                );
              }
              folderContext.projectInfo = {
                name: folderContext.name,
              };
            }
          }

          // 检查文件扩展名过滤
          const ext = path.extname(entry.name);

          if (this.shouldIncludeFile(ext, options)) {
            const fileContext = new FileContext(fullPath);
            folderContext.addChild(fileContext);
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
      // 在测试环境下不输出警告，避免测试噪音
      const configManager = ConfigManager.getInstance();
      if (!configManager.isTestEnvironment()) {
        console.warn(
          `无法扫描目录 ${folderContext.path}: ${(error as Error).message}`
        );
      }
    }
  }

  /**
   * 检查文件或目录是否应该被.gitignore规则忽略
   *
   * 使用ignore实例检查指定路径是否匹配ignore规则。
   *
   * @param fullPath 文件或目录的完整路径
   * @param isDirectory 是否为目录
   * @returns 如果应该被忽略则返回true，否则返回false
   * @private
   */
  private shouldIgnoreByGitignore(
    fullPath: string,
    isDirectory: boolean
  ): boolean {
    if (!this.ignoreInstance) {
      return false; // 没有ignore实例，不忽略任何文件
    }

    // 获取相对路径用于ignore检查
    // ignore库期望使用相对路径，并且目录路径应该以/结尾
    const relativePath = path.relative(process.cwd(), fullPath);
    const normalizedPath = relativePath.replace(/\\/g, '/'); // 统一使用正斜杠

    // 对于目录，添加尾部斜杠以确保正确匹配
    const pathToCheck = isDirectory ? `${normalizedPath}/` : normalizedPath;

    return this.ignoreInstance.ignores(pathToCheck);
  }

  /**
   * 检查文件是否应该被包含在Context树中
   *
   * 根据构建选项中的扩展名过滤规则，判断指定扩展名的文件
   * 是否应该被包含。优先级：includeExtensions > excludeExtensions > 默认包含。
   *
   * @param extension 文件扩展名（包含点号，如 '.ts'）
   * @param options 构建选项，包含过滤规则
   * @returns 如果文件应该被包含则返回true，否则返回false
   * @private
   */
  private shouldIncludeFile(
    extension: string,
    options: ContextBuilderOptions
  ): boolean {
    // 如果指定了包含扩展名列表，只包含列表中的扩展名
    if (options.includeExtensions && options.includeExtensions.length > 0) {
      return options.includeExtensions.includes(extension);
    }

    // 如果指定了排除扩展名列表，排除列表中的扩展名
    if (options.excludeExtensions && options.excludeExtensions.length > 0) {
      return !options.excludeExtensions.includes(extension);
    }

    // 默认情况下包含所有文件
    return true;
  }
}
