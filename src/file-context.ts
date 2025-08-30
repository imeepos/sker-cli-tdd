/**
 * 🟢 TDD 绿阶段：FileContext 文件上下文实现
 * 提供文件上下文的完整功能
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as mimeTypes from 'mime-types';
import { Context } from './context-base';

/**
 * 文件上下文类
 *
 * 表示文件系统中单个文件的上下文信息。提供文件的基本属性
 * 和操作方法，包括路径解析、父子关系管理、文件统计信息、
 * 内容加载、hash计算等丰富功能。
 *
 * @example
 * ```typescript
 * const fileContext = new FileContext('/project/src/index.ts');
 * await fileContext.loadFileInfo();
 * await fileContext.loadContent();
 *
 * console.log(fileContext.name);      // 'index.ts'
 * console.log(fileContext.extension); // '.ts'
 * console.log(fileContext.size);      // 文件大小（字节）
 * console.log(fileContext.hash);      // 文件SHA256哈希
 * console.log(fileContext.mimeType);  // 'application/javascript'
 * ```
 */
export class FileContext implements Context {
  /** 文件的完整绝对路径 */
  public readonly path: string;

  /** 文件名（包含扩展名，不包含路径） */
  public readonly name: string;

  /** 上下文类型，固定为 'file' */
  public readonly type: 'file' = 'file';

  /** 父级文件夹上下文 */
  public parent?: Context | undefined;

  /** 文件扩展名（包含点号，如 '.ts'） */
  public readonly extension: string;

  /** MIME类型（基于文件扩展名推断） */
  public readonly mimeType: string | false;

  /** 文件大小（字节），需要调用loadFileInfo()后才有值 */
  public size?: number;

  /** 文件最后修改时间，需要调用loadFileInfo()后才有值 */
  public lastModified?: Date;

  /** 修改时间的别名，用于兼容旧版本API */
  public get modifiedTime(): Date | undefined {
    return this.lastModified;
  }

  /** 文件创建时间，需要调用loadFileInfo()后才有值 */
  public createdTime?: Date;

  /** 文件内容，需要调用loadContent()后才有值 */
  public content?: string;

  /** 文件内容的SHA256哈希值，需要调用loadContent()后才有值 */
  public hash?: string;

  /** 是否已加载内容的便捷属性，用于兼容旧版本API */
  public get hasContent(): boolean {
    return this.content !== undefined;
  }

  /** 是否为文本文件的同步属性，用于兼容旧版本API */
  public get isTextFile(): boolean {
    if (this.mimeType) {
      const mimeStr = this.mimeType.toString();
      return (
        mimeStr.startsWith('text/') ||
        mimeStr === 'application/json' ||
        mimeStr === 'application/javascript' ||
        mimeStr === 'application/xml'
      );
    }

    // 基于扩展名的简单判断
    const textExtensions = [
      '.txt',
      '.md',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.json',
      '.xml',
      '.html',
      '.css',
      '.scss',
      '.less',
      '.yaml',
      '.yml',
    ];
    return textExtensions.includes(this.extension.toLowerCase());
  }

  /**
   * 创建文件上下文实例
   *
   * @param filePath 文件的完整路径
   */
  constructor(filePath: string) {
    this.path = filePath;
    this.name = path.basename(filePath);
    this.extension = path.extname(filePath);
    this.mimeType = mimeTypes.lookup(filePath);
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
   * 加载文件统计信息
   *
   * 从文件系统读取文件的基本信息，包括大小和修改时间。
   * 这个方法不会读取文件内容，适合在需要文件元数据但不需要内容时使用。
   *
   * @throws 如果文件不存在或无法访问
   * @example
   * ```typescript
   * const file = new FileContext('/project/package.json');
   * await file.loadFileInfo();
   * console.log(`文件大小: ${file.size} bytes`);
   * console.log(`修改时间: ${file.lastModified?.toISOString()}`);
   * ```
   */
  async loadFileInfo(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.path);
      this.size = stats.size;
      this.lastModified = stats.mtime;
      this.createdTime = stats.birthtime;
    } catch (error) {
      throw new Error(
        `无法加载文件信息 ${this.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 加载文件内容
   *
   * 读取文件的完整内容并计算SHA256哈希值。适用于文本文件，
   * 对于大文件建议先检查文件大小。
   *
   * @param encoding 文件编码，默认为 'utf8'
   * @throws 如果文件不存在、无法访问或编码错误
   * @example
   * ```typescript
   * const file = new FileContext('/project/src/index.ts');
   * await file.loadContent();
   * console.log(`文件内容行数: ${file.content?.split('\n').length}`);
   * console.log(`文件哈希: ${file.hash}`);
   * ```
   */
  async loadContent(encoding: BufferEncoding = 'utf8'): Promise<void> {
    try {
      this.content = await fs.promises.readFile(this.path, encoding);

      // 计算文件内容的SHA256哈希
      if (this.content !== undefined) {
        const hash = crypto.createHash('sha256');
        hash.update(this.content, encoding);
        this.hash = hash.digest('hex');
      }
    } catch (error) {
      throw new Error(
        `无法加载文件内容 ${this.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 检查文件是否为文本文件（异步版本）
   *
   * 通过读取文件前512字节并检查是否包含null字节来判断是否为文本文件。
   * 这是一个启发式方法，适用于大多数情况下的文本/二进制文件判断。
   *
   * @returns Promise，解析为true表示是文本文件，false表示是二进制文件
   */
  async isTextFileAsync(): Promise<boolean> {
    try {
      // 检查MIME类型是否为已知的文本类型
      if (this.mimeType) {
        const mimeStr = this.mimeType.toString();
        if (
          mimeStr.startsWith('text/') ||
          mimeStr === 'application/json' ||
          mimeStr === 'application/javascript' ||
          mimeStr === 'application/xml'
        ) {
          return true;
        }
      }

      // 读取文件前512字节检查是否包含null字节
      const buffer = await fs.promises.readFile(this.path, { encoding: null });
      const sampleSize = Math.min(512, buffer.length);
      const sample = buffer.subarray(0, sampleSize);

      // 如果包含null字节，很可能是二进制文件
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn(
        `无法检查文件类型 ${this.path}: ${(error as Error).message}`
      );
      return false;
    }
  }

  /**
   * 获取文件类型描述
   *
   * 根据文件扩展名返回友好的文件类型描述。
   *
   * @returns 文件类型描述字符串
   */
  getFileTypeDescription(): string {
    const ext = this.extension.toLowerCase();

    const typeMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'React JSX',
      '.tsx': 'React TSX',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.txt': '文本',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'LESS',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C头文件',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.sh': 'Shell脚本',
      '.bat': '批处理',
      '.ps1': 'PowerShell',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.ini': '配置文件',
      '.conf': '配置文件',
      '.log': '日志文件',
      '.sql': 'SQL',
      '.dockerfile': 'Dockerfile',
      '.gitignore': 'Git忽略文件',
      '.env': '环境变量文件',
    };

    return typeMap[ext] || '未知类型';
  }

  /**
   * 生成文件摘要
   *
   * 基于文件类型和内容生成简短的描述性摘要。
   *
   * @returns 文件摘要字符串
   */
  generateSummary(): string {
    const typeDesc = this.getFileTypeDescription();
    let summary = `${typeDesc}文件: ${this.name}`;

    if (this.size !== undefined) {
      if (this.size < 1024) {
        summary += ` (${this.size} bytes)`;
      } else if (this.size < 1024 * 1024) {
        summary += ` (${(this.size / 1024).toFixed(1)} KB)`;
      } else {
        summary += ` (${(this.size / (1024 * 1024)).toFixed(1)} MB)`;
      }
    }

    if (this.content) {
      const lines = this.content.split('\n').length;
      summary += `, ${lines} 行`;

      // 对于代码文件，尝试提取更多信息
      if (
        this.extension === '.ts' ||
        this.extension === '.js' ||
        this.extension === '.tsx' ||
        this.extension === '.jsx'
      ) {
        const functions = (
          this.content.match(/function\s+\w+|=>\s*{|:\s*\([^)]*\)\s*=>/g) || []
        ).length;
        const classes = (this.content.match(/class\s+\w+/g) || []).length;
        if (functions > 0) summary += `, ${functions} 个函数`;
        if (classes > 0) summary += `, ${classes} 个类`;
      }
    }

    return summary;
  }

  /**
   * 获取文件的完整路径
   *
   * @returns 文件的完整绝对路径
   */
  getFullPath(): string {
    return this.path;
  }

  /**
   * 获取相对于指定上下文的相对路径
   *
   * @param baseContext 基础上下文
   * @returns 相对路径
   */
  getRelativePath(baseContext: Context): string {
    return path.relative(baseContext.path, this.path);
  }

  /**
   * 检查当前文件是否为指定上下文的子级
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
}
