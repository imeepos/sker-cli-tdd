/**
 * � TDD 重构阶段：命令执行器优化实现
 * 在绿灯状态下改进代码质量
 */

import { spawn } from 'child_process';
import * as iconv from 'iconv-lite';

/**
 * 命令执行结果接口
 */
export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  executionTime: number;
}

/**
 * 命令执行器类
 * 负责执行系统命令并返回结果
 */
export class CommandExecutor {
  /**
   * 获取系统默认编码
   * @returns 系统编码名称
   */
  private getSystemEncoding(): string {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows系统通常使用GBK编码
      return 'gbk';
    } else {
      // Unix-like系统通常使用UTF-8
      return 'utf8';
    }
  }

  /**
   * 转换编码
   * @param buffer 原始buffer
   * @param fromEncoding 源编码
   * @param toEncoding 目标编码
   * @returns 转换后的字符串
   */
  private convertEncoding(
    buffer: Buffer,
    fromEncoding: string,
    toEncoding: string = 'utf8'
  ): string {
    if (fromEncoding === toEncoding || fromEncoding === 'utf8') {
      return buffer.toString('utf8');
    }

    try {
      return iconv.decode(buffer, fromEncoding);
    } catch (error) {
      // 如果转换失败，回退到默认编码
      return buffer.toString('utf8');
    }
  }
  /**
   * 执行系统命令（带编码处理）
   * @param command 要执行的命令字符串
   * @returns Promise<CommandResult> 命令执行结果
   * @throws 不会抛出异常，所有错误都包装在结果中
   */
  async execute(command: string): Promise<CommandResult> {
    // 输入验证
    if (!command || typeof command !== 'string') {
      return this.createErrorResult(command, '命令不能为空', 0);
    }

    const startTime = Date.now();
    const systemEncoding = this.getSystemEncoding();

    return new Promise(resolve => {
      // 在Windows上使用cmd /c，在Unix上使用sh -c
      const shell = process.platform === 'win32' ? 'cmd' : 'sh';
      const shellFlag = process.platform === 'win32' ? '/c' : '-c';

      const child = spawn(shell, [shellFlag, command], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      // 收集stdout数据
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });

      // 收集stderr数据
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      // 处理进程结束
      child.on('close', code => {
        const executionTime = Date.now() - startTime;

        // 合并所有数据块
        const stdoutBuffer = Buffer.concat(stdoutChunks);
        const stderrBuffer = Buffer.concat(stderrChunks);

        // 转换编码
        const stdout = this.convertEncoding(stdoutBuffer, systemEncoding);
        const stderr = this.convertEncoding(stderrBuffer, systemEncoding);

        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
          command,
          executionTime,
        });
      });

      // 处理错误
      child.on('error', error => {
        const executionTime = Date.now() - startTime;
        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: 1,
          command,
          executionTime,
        });
      });
    });
  }

  /**
   * 创建错误结果的辅助方法
   * @param command 执行的命令
   * @param errorMessage 错误消息
   * @param executionTime 执行时间
   * @returns CommandResult 错误结果
   */
  private createErrorResult(
    command: string,
    errorMessage: string,
    executionTime: number
  ): CommandResult {
    return {
      success: false,
      stdout: '',
      stderr: errorMessage,
      exitCode: 1,
      command: command || '',
      executionTime,
    };
  }
}
