/**
 * 🟢 TDD 绿阶段：文件过滤引擎实现
 * 支持 gitignore 规则解析和扩展名过滤
 */

import ignore from 'ignore';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件过滤引擎类
 * 
 * 提供文件和目录的过滤功能，支持：
 * - 基于扩展名的包含/排除规则
 * - gitignore 风格的模式匹配
 * - 高性能的路径匹配算法
 */
export class FileFilterEngine {
  /** ignore 实例，用于处理 gitignore 风格的规则 */
  private ignoreInstance: ReturnType<typeof ignore> | null = null;
  
  /** 忽略模式数组 */
  private ignorePatterns: string[] = [];
  
  /** 包含的文件扩展名列表 */
  private includeExtensions: string[] = [];
  
  /** 排除的文件扩展名列表 */
  private excludeExtensions: string[] = [];

  /**
   * 构造函数
   */
  constructor() {
    // 初始化时不设置任何规则
  }

  /**
   * 设置忽略模式
   * 
   * @param patterns 忽略模式数组，支持 glob 风格模式
   */
  setIgnorePatterns(patterns: string[]): void {
    this.ignorePatterns = [...patterns];
    this.updateIgnoreInstance();
  }

  /**
   * 获取当前的忽略模式
   */
  getIgnorePatterns(): string[] {
    return [...this.ignorePatterns];
  }

  /**
   * 设置包含的文件扩展名
   * 
   * @param extensions 扩展名数组，如 ['.ts', '.js', '.json']
   */
  setIncludeExtensions(extensions: string[]): void {
    this.includeExtensions = [...extensions];
  }

  /**
   * 获取包含的文件扩展名
   */
  getIncludeExtensions(): string[] {
    return [...this.includeExtensions];
  }

  /**
   * 设置排除的文件扩展名
   * 
   * @param extensions 扩展名数组，如 ['.log', '.tmp', '.cache']
   */
  setExcludeExtensions(extensions: string[]): void {
    this.excludeExtensions = [...extensions];
  }

  /**
   * 获取排除的文件扩展名
   */
  getExcludeExtensions(): string[] {
    return [...this.excludeExtensions];
  }

  /**
   * 从 gitignore 内容设置忽略规则
   * 
   * @param content gitignore 文件的内容
   */
  setGitignoreContent(content: string): void {
    const lines = content.split(/[\n\r]+/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // 过滤空行和注释

    this.setIgnorePatterns(lines);
  }

  /**
   * 从文件加载 gitignore 规则
   * 
   * @param filePath gitignore 文件路径
   */
  async loadGitignoreFromFile(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      this.setGitignoreContent(content);
    } catch (error) {
      // 文件不存在或无法读取时，不设置任何规则
      this.setIgnorePatterns([]);
    }
  }

  /**
   * 检查文件是否应该被包含
   * 
   * @param filePath 文件路径（相对或绝对）
   * @returns 如果文件应该被包含则返回 true
   */
  shouldIncludeFile(filePath: string): boolean {
    // 首先检查扩展名过滤规则
    if (!this.passesExtensionFilter(filePath)) {
      return false;
    }

    // 然后检查 gitignore 规则
    if (!this.passesIgnoreFilter(filePath)) {
      return false;
    }

    return true;
  }

  /**
   * 检查目录是否应该被忽略
   * 
   * @param dirPath 目录路径（相对或绝对）
   * @returns 如果目录应该被忽略则返回 true
   */
  shouldIgnoreDirectory(dirPath: string): boolean {
    if (!this.ignoreInstance) {
      return false;
    }

    const relativePath = this.getRelativePath(dirPath);
    const normalizedPath = this.normalizePath(relativePath);
    
    // 对于目录，添加尾部斜杠以确保正确匹配
    const pathToCheck = `${normalizedPath}/`;
    
    return this.ignoreInstance.ignores(pathToCheck);
  }

  /**
   * 更新 ignore 实例
   * 
   * @private
   */
  private updateIgnoreInstance(): void {
    if (this.ignorePatterns.length === 0) {
      this.ignoreInstance = null;
      return;
    }

    this.ignoreInstance = ignore().add(this.ignorePatterns);
  }

  /**
   * 检查文件是否通过扩展名过滤
   * 
   * @param filePath 文件路径
   * @returns 是否通过扩展名过滤
   * @private
   */
  private passesExtensionFilter(filePath: string): boolean {
    const extension = path.extname(filePath);

    // 如果指定了包含扩展名列表，只包含列表中的扩展名
    if (this.includeExtensions.length > 0) {
      return this.includeExtensions.includes(extension);
    }

    // 如果指定了排除扩展名列表，排除列表中的扩展名
    if (this.excludeExtensions.length > 0) {
      return !this.excludeExtensions.includes(extension);
    }

    // 默认情况下包含所有文件
    return true;
  }

  /**
   * 检查文件是否通过忽略规则过滤
   * 
   * @param filePath 文件路径
   * @returns 是否通过忽略规则过滤
   * @private
   */
  private passesIgnoreFilter(filePath: string): boolean {
    if (!this.ignoreInstance) {
      return true; // 没有忽略规则，通过过滤
    }

    const relativePath = this.getRelativePath(filePath);
    const normalizedPath = this.normalizePath(relativePath);

    return !this.ignoreInstance.ignores(normalizedPath);
  }

  /**
   * 获取相对路径
   * 
   * @param filePath 文件路径（可能是绝对路径）
   * @returns 相对于当前工作目录的路径
   * @private
   */
  private getRelativePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.relative(process.cwd(), filePath);
    }
    return filePath;
  }

  /**
   * 标准化路径分隔符
   * 
   * @param filePath 文件路径
   * @returns 使用正斜杠的标准化路径
   * @private
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }
}