import * as fs from 'fs';
import * as path from 'path';
import { FileContext } from './context';

/**
 * 文件监控器接口
 */
export interface FileWatcher {
  /** 关闭监控器 */
  close(): void;
}

/**
 * 文件历史记录接口
 */
export interface FileHistoryEntry {
  /** 时间戳 */
  timestamp: Date;
  /** 操作类型 */
  operation: 'read' | 'write' | 'create' | 'delete' | 'modify';
  /** 文件大小 */
  size: number;
  /** 操作描述 */
  description?: string;
}

/**
 * 文件读取结果接口
 */
export interface FileReadResult {
  /** 文件路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 文件内容 */
  content: string;
  /** 文件大小 */
  size: number;
  /** 编码格式 */
  encoding: BufferEncoding;
}

/**
 * 批量写入操作接口
 */
export interface BatchWriteOperation {
  /** 文件路径 */
  path: string;
  /** 文件内容 */
  content: string;
  /** 编码格式 */
  encoding?: BufferEncoding;
}

/**
 * 文件读写操作管理工具
 *
 * 基于FileContext提供完整的文件读写操作功能，
 * 包括文本和二进制文件的读写、文件操作、监控和批量处理。
 *
 * @example
 * ```typescript
 * const manager = new FileOperationsManager();
 * const fileContext = new FileContext('/path/to/file.txt');
 *
 * // 读取文件
 * const content = await manager.readFile(fileContext);
 * const lines = await manager.readLines(fileContext, 1, 10);
 *
 * // 写入文件
 * await manager.writeFile(fileContext, 'new content');
 * await manager.appendFile(fileContext, 'appended content');
 *
 * // 文件操作
 * const copied = await manager.copyFile(fileContext, '/path/to/copy.txt');
 * await manager.moveFile(fileContext, '/path/to/moved.txt');
 *
 * // 监控文件
 * const watcher = await manager.watchFile(fileContext, (event) => {
 *   console.log('File changed:', event);
 * });
 * ```
 */
export class FileOperationsManager {
  private fileHistory: Map<string, FileHistoryEntry[]> = new Map();

  /**
   * 读取文件内容
   *
   * @param context 文件上下文
   * @param encoding 编码格式，默认为utf8
   * @returns Promise，解析为文件内容
   */
  async readFile(
    context: FileContext,
    encoding: BufferEncoding = 'utf8'
  ): Promise<string> {
    try {
      const content = await fs.promises.readFile(context.path, encoding);
      this.addHistoryEntry(context.path, 'read', content.length);
      return content;
    } catch (error) {
      throw new Error(
        `无法读取文件 ${context.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 读取文件的指定行数
   *
   * @param context 文件上下文
   * @param startLine 起始行号（从1开始）
   * @param endLine 结束行号（包含）
   * @param encoding 编码格式，默认为utf8
   * @returns Promise，解析为行数组
   */
  async readLines(
    context: FileContext,
    startLine: number,
    endLine: number,
    encoding: BufferEncoding = 'utf8'
  ): Promise<string[]> {
    const content = await this.readFile(context, encoding);
    const allLines = content.split('\n');
    return allLines.slice(startLine - 1, endLine);
  }

  /**
   * 读取文件的所有行
   *
   * @param context 文件上下文
   * @param encoding 编码格式，默认为utf8
   * @returns Promise，解析为行数组
   */
  async readAllLines(
    context: FileContext,
    encoding: BufferEncoding = 'utf8'
  ): Promise<string[]> {
    const content = await this.readFile(context, encoding);
    return content.split('\n');
  }

  /**
   * 读取二进制文件
   *
   * @param context 文件上下文
   * @returns Promise，解析为Buffer
   */
  async readBinary(context: FileContext): Promise<Buffer> {
    try {
      const buffer = await fs.promises.readFile(context.path);
      this.addHistoryEntry(context.path, 'read', buffer.length);
      return buffer;
    } catch (error) {
      throw new Error(
        `无法读取二进制文件 ${context.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 写入文件内容
   *
   * @param context 文件上下文
   * @param content 文件内容
   * @param encoding 编码格式，默认为utf8
   */
  async writeFile(
    context: FileContext,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    try {
      await fs.promises.writeFile(context.path, content, encoding);
      this.addHistoryEntry(context.path, 'write', content.length);
    } catch (error) {
      throw new Error(
        `无法写入文件 ${context.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 追加文件内容
   *
   * @param context 文件上下文
   * @param content 要追加的内容
   * @param encoding 编码格式，默认为utf8
   */
  async appendFile(
    context: FileContext,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    try {
      await fs.promises.appendFile(context.path, content, encoding);
      this.addHistoryEntry(context.path, 'modify', content.length);
    } catch (error) {
      throw new Error(
        `无法追加文件 ${context.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 写入多行内容
   *
   * @param context 文件上下文
   * @param lines 行数组
   * @param encoding 编码格式，默认为utf8
   */
  async writeLines(
    context: FileContext,
    lines: string[],
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    const content = lines.join('\n');
    await this.writeFile(context, content, encoding);
  }

  /**
   * 写入二进制数据
   *
   * @param filePath 文件路径
   * @param data 二进制数据
   */
  async writeBinary(filePath: string, data: Buffer): Promise<void> {
    try {
      await fs.promises.writeFile(filePath, data);
      this.addHistoryEntry(filePath, 'write', data.length);
    } catch (error) {
      throw new Error(
        `无法写入二进制文件 ${filePath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 创建新文件
   *
   * @param filePath 文件路径
   * @param content 文件内容
   * @param encoding 编码格式，默认为utf8
   * @returns Promise，解析为新创建的FileContext
   */
  async createFile(
    filePath: string,
    content: string = '',
    encoding: BufferEncoding = 'utf8'
  ): Promise<FileContext> {
    try {
      await fs.promises.writeFile(filePath, content, encoding);
      this.addHistoryEntry(filePath, 'create', content.length);

      // 创建并返回FileContext
      const fileContext = new FileContext(filePath);
      return fileContext;
    } catch (error) {
      throw new Error(`无法创建文件 ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * 复制文件
   *
   * @param sourceContext 源文件上下文
   * @param destPath 目标路径
   * @returns Promise，解析为目标FileContext
   */
  async copyFile(
    sourceContext: FileContext,
    destPath: string
  ): Promise<FileContext> {
    try {
      await fs.promises.copyFile(sourceContext.path, destPath);

      const stats = await fs.promises.stat(destPath);
      this.addHistoryEntry(destPath, 'create', stats.size);

      return new FileContext(destPath);
    } catch (error) {
      throw new Error(
        `无法复制文件 ${sourceContext.path} 到 ${destPath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 移动文件
   *
   * @param sourceContext 源文件上下文
   * @param destPath 目标路径
   * @returns Promise，解析为目标FileContext
   */
  async moveFile(
    sourceContext: FileContext,
    destPath: string
  ): Promise<FileContext> {
    try {
      await fs.promises.rename(sourceContext.path, destPath);

      this.addHistoryEntry(sourceContext.path, 'delete', 0);
      const stats = await fs.promises.stat(destPath);
      this.addHistoryEntry(destPath, 'create', stats.size);

      return new FileContext(destPath);
    } catch (error) {
      throw new Error(
        `无法移动文件 ${sourceContext.path} 到 ${destPath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 删除文件
   *
   * @param context 文件上下文
   */
  async deleteFile(context: FileContext): Promise<void> {
    try {
      await fs.promises.unlink(context.path);
      this.addHistoryEntry(context.path, 'delete', 0);
    } catch (error) {
      throw new Error(
        `无法删除文件 ${context.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 重命名文件
   *
   * @param context 文件上下文
   * @param newName 新文件名
   * @returns Promise，解析为重命名后的FileContext
   */
  async renameFile(
    context: FileContext,
    newName: string
  ): Promise<FileContext> {
    const newPath = path.join(path.dirname(context.path), newName);
    return this.moveFile(context, newPath);
  }

  /**
   * 监控文件变化
   *
   * @param context 文件上下文
   * @param callback 变化回调函数
   * @returns Promise，解析为文件监控器
   */
  async watchFile(
    context: FileContext,
    callback: (event: string, filename?: string) => void
  ): Promise<FileWatcher> {
    try {
      const watcher = fs.watch(context.path, (event, filename) => {
        callback(event, filename || undefined);
      });

      return {
        close: () => watcher.close(),
      };
    } catch (error) {
      throw new Error(
        `无法监控文件 ${context.path}: ${(error as Error).message}`
      );
    }
  }

  /**
   * 获取文件变化历史
   *
   * @param context 文件上下文
   * @returns Promise，解析为历史记录数组
   */
  async getFileHistory(context: FileContext): Promise<FileHistoryEntry[]> {
    const history = this.fileHistory.get(context.path) || [];

    // 如果没有历史记录，创建一个基于文件统计的记录
    if (history.length === 0) {
      try {
        const stats = await fs.promises.stat(context.path);
        history.push({
          timestamp: stats.mtime,
          operation: 'modify',
          size: stats.size,
          description: '文件最后修改时间',
        });
        this.fileHistory.set(context.path, history);
      } catch (error) {
        // 文件不存在或无法访问
      }
    }

    return [...history]; // 返回副本
  }

  /**
   * 批量读取多个文件
   *
   * @param contexts 文件上下文数组
   * @param encoding 编码格式，默认为utf8
   * @returns Promise，解析为读取结果数组
   */
  async readMultipleFiles(
    contexts: FileContext[],
    encoding: BufferEncoding = 'utf8'
  ): Promise<FileReadResult[]> {
    const results: FileReadResult[] = [];

    for (const context of contexts) {
      try {
        const content = await this.readFile(context, encoding);
        const stats = await fs.promises.stat(context.path);

        results.push({
          path: context.path,
          name: context.name,
          content,
          size: stats.size,
          encoding,
        });
      } catch (error) {
        console.warn(
          `无法读取文件 ${context.path}: ${(error as Error).message}`
        );
      }
    }

    return results;
  }

  /**
   * 批量写入多个文件
   *
   * @param operations 批量写入操作数组
   * @returns Promise，解析为创建的FileContext数组
   */
  async writeMultipleFiles(
    operations: BatchWriteOperation[]
  ): Promise<FileContext[]> {
    const results: FileContext[] = [];

    for (const operation of operations) {
      try {
        const fileContext = await this.createFile(
          operation.path,
          operation.content,
          operation.encoding || 'utf8'
        );
        results.push(fileContext);
      } catch (error) {
        console.warn(
          `无法写入文件 ${operation.path}: ${(error as Error).message}`
        );
      }
    }

    return results;
  }

  /**
   * 添加文件历史记录
   * @private
   */
  private addHistoryEntry(
    filePath: string,
    operation: FileHistoryEntry['operation'],
    size: number
  ): void {
    const history = this.fileHistory.get(filePath) || [];
    history.push({
      timestamp: new Date(),
      operation,
      size,
      description: `${operation} operation`,
    });
    this.fileHistory.set(filePath, history);
  }
}
