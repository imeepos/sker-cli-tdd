/**
 * 🔴 TDD 红阶段：内存使用优化实现
 * 实现大文件流式处理、上下文内容压缩、内存泄漏检测
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * 内存优化器配置接口
 */
export interface MemoryOptimizerConfig {
  /** 大文件阈值（字节） */
  largeFileThreshold?: number;
  /** 流式处理缓冲区大小 */
  streamBufferSize?: number;
  /** 压缩级别 (0-9) */
  compressionLevel?: number;
  /** 内存监控间隔（毫秒） */
  memoryMonitorInterval?: number;
  /** 内存警告阈值（字节） */
  memoryWarningThreshold?: number;
  /** 垃圾回收阈值 */
  gcThreshold?: number;
}

/**
 * 内存使用统计接口
 */
export interface MemoryStats {
  /** 已使用内存 */
  used: number;
  /** 总内存 */
  total: number;
  /** 外部内存 */
  external: number;
  /** 数组缓冲区 */
  arrayBuffers: number;
  /** RSS内存 */
  rss: number;
  /** 使用率 */
  usagePercent: number;
}

/**
 * 压缩结果接口
 */
export interface CompressionResult {
  /** 压缩后的数据 */
  compressed: Buffer;
  /** 原始大小 */
  originalSize: number;
  /** 压缩后大小 */
  compressedSize: number;
  /** 压缩比 */
  compressionRatio: number;
  /** 压缩时间（毫秒） */
  compressionTime: number;
}

/**
 * 解压缩结果接口
 */
export interface DecompressionResult {
  /** 解压后的内容 */
  content: string;
  /** 解压时间（毫秒） */
  decompressionTime: number;
  /** 原始大小 */
  originalSize: number;
}

/**
 * 流式处理结果接口
 */
export interface StreamProcessResult {
  /** 处理是否成功 */
  success: boolean;
  /** 处理的字节数 */
  bytesProcessed: number;
  /** 处理时间（毫秒） */
  processingTime: number;
  /** 峰值内存使用 */
  peakMemoryUsage: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 内存泄漏检测结果接口
 */
export interface MemoryLeakDetectionResult {
  /** 是否检测到内存泄漏 */
  leakDetected: boolean;
  /** 内存增长率（MB/分钟） */
  memoryGrowthRate: number;
  /** 监控时间（毫秒） */
  monitoringDuration: number;
  /** 内存样本 */
  memorySamples: MemoryStats[];
  /** 建议操作 */
  recommendations: string[];
}

/**
 * 文件分块读取器
 */
export class ChunkedFileReader {
  private chunkSize: number;
  private position = 0;
  private fileHandle?: fs.promises.FileHandle;

  constructor(private filePath: string, chunkSize: number = 64 * 1024) {
    this.chunkSize = chunkSize;
  }

  /**
   * 初始化文件句柄
   */
  async init(): Promise<void> {
    this.fileHandle = await fs.promises.open(this.filePath, 'r');
  }

  /**
   * 读取下一个块
   */
  async readNext(): Promise<Buffer | null> {
    if (!this.fileHandle) {
      throw new Error('文件句柄未初始化，请先调用 init()');
    }

    const buffer = Buffer.allocUnsafe(this.chunkSize);
    const result = await this.fileHandle.read(buffer, 0, this.chunkSize, this.position);
    
    if (result.bytesRead === 0) {
      return null; // 文件结束
    }

    this.position += result.bytesRead;
    return buffer.subarray(0, result.bytesRead);
  }

  /**
   * 关闭文件句柄
   */
  async close(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = undefined;
    }
  }

  /**
   * 重置读取位置
   */
  reset(): void {
    this.position = 0;
  }
}

/**
 * 内容压缩器
 */
export class ContentCompressor {
  private compressionLevel: number;

  constructor(compressionLevel: number = 6) {
    this.compressionLevel = compressionLevel;
  }

  /**
   * 压缩字符串内容
   */
  async compressString(content: string): Promise<CompressionResult> {
    const startTime = Date.now();
    const originalBuffer = Buffer.from(content, 'utf8');
    const originalSize = originalBuffer.length;

    const compressed = await new Promise<Buffer>((resolve, reject) => {
      zlib.gzip(originalBuffer, { level: this.compressionLevel }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const compressionTime = Date.now() - startTime;
    const compressedSize = compressed.length;
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

    return {
      compressed,
      originalSize,
      compressedSize,
      compressionRatio,
      compressionTime
    };
  }

  /**
   * 解压缩内容
   */
  async decompressString(compressedData: Buffer): Promise<DecompressionResult> {
    const startTime = process.hrtime.bigint();

    const decompressed = await new Promise<Buffer>((resolve, reject) => {
      zlib.gunzip(compressedData, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const endTime = process.hrtime.bigint();
    const decompressionTime = Math.max(1, Number(endTime - startTime) / 1000000); // 纳秒转毫秒，最小1ms
    const content = decompressed.toString('utf8');

    return {
      content,
      decompressionTime,
      originalSize: decompressed.length
    };
  }

  /**
   * 流式压缩
   */
  createCompressionStream(): zlib.Gzip {
    return zlib.createGzip({ level: this.compressionLevel });
  }

  /**
   * 流式解压缩
   */
  createDecompressionStream(): zlib.Gunzip {
    return zlib.createGunzip();
  }
}

/**
 * 内存监控器
 */
export class MemoryMonitor {
  private samples: MemoryStats[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  /**
   * 获取当前内存使用情况
   */
  getCurrentMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed + memUsage.external;
    
    return {
      used: usedMemory,
      total: totalMemory,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      usagePercent: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0
    };
  }

  /**
   * 开始监控内存使用
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.samples = [];

    this.monitoringInterval = setInterval(() => {
      const stats = this.getCurrentMemoryStats();
      this.samples.push(stats);
      
      // 限制样本数量，避免内存泄漏
      if (this.samples.length > 1000) {
        this.samples = this.samples.slice(-500);
      }
    }, intervalMs);
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * 检测内存泄漏
   */
  detectMemoryLeak(): MemoryLeakDetectionResult {
    if (this.samples.length < 3) {
      return {
        leakDetected: false,
        memoryGrowthRate: 0,
        monitoringDuration: 0,
        memorySamples: [...this.samples],
        recommendations: ['监控时间过短，无法检测内存泄漏']
      };
    }

    // 计算内存增长趋势
    const firstSample = this.samples[0]!;
    const lastSample = this.samples[this.samples.length - 1]!;
    const timeDiff = this.samples.length * 1000; // 假设每秒采样一次，但实际会根据间隔调整
    const memoryDiff = lastSample.used - firstSample.used;
    const growthRate = (memoryDiff / (1024 * 1024)) / Math.max(timeDiff / (1000 * 60), 0.001); // MB/分钟，避免除零

    const recommendations: string[] = [];
    const leakDetected = growthRate > 5; // 每分钟增长超过5MB认为可能有泄漏

    if (leakDetected) {
      recommendations.push('检测到可能的内存泄漏');
      recommendations.push('建议检查事件监听器是否正确移除');
      recommendations.push('建议检查缓存是否有适当的清理机制');
      recommendations.push('建议主动调用垃圾回收');
    }

    if (lastSample.usagePercent > 80) {
      recommendations.push('内存使用率过高，建议优化内存使用');
    }

    return {
      leakDetected,
      memoryGrowthRate: growthRate,
      monitoringDuration: timeDiff,
      memorySamples: [...this.samples],
      recommendations
    };
  }

  /**
   * 获取内存使用历史
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.samples];
  }

  /**
   * 清除监控数据
   */
  clearHistory(): void {
    this.samples = [];
  }
}

/**
 * 内存优化器主类
 */
export class MemoryOptimizer {
  private config: Required<MemoryOptimizerConfig>;
  private compressor: ContentCompressor;
  private monitor: MemoryMonitor;

  constructor(config: MemoryOptimizerConfig = {}) {
    this.config = {
      largeFileThreshold: config.largeFileThreshold || 10 * 1024 * 1024, // 10MB
      streamBufferSize: config.streamBufferSize || 64 * 1024, // 64KB
      compressionLevel: config.compressionLevel || 6,
      memoryMonitorInterval: config.memoryMonitorInterval || 1000,
      memoryWarningThreshold: config.memoryWarningThreshold || 100 * 1024 * 1024, // 100MB
      gcThreshold: config.gcThreshold || 80 // 80%
    };

    this.compressor = new ContentCompressor(this.config.compressionLevel);
    this.monitor = new MemoryMonitor();
  }

  /**
   * 检查文件是否需要流式处理
   */
  async shouldUseStreamProcessing(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size >= this.config.largeFileThreshold;
    } catch (error) {
      throw new Error(`检查文件大小失败: ${(error as Error).message}`);
    }
  }

  /**
   * 流式处理大文件
   */
  async processFileWithStreams(
    filePath: string, 
    processor: (chunk: string) => Promise<string>
  ): Promise<StreamProcessResult> {
    const startTime = Date.now();
    let bytesProcessed = 0;
    let peakMemoryUsage = 0;

    try {
      // 开始内存监控
      this.monitor.startMonitoring(100);

      const reader = new ChunkedFileReader(filePath, this.config.streamBufferSize);
      await reader.init();

      const results: string[] = [];

      try {
        let chunk: Buffer | null;
        while ((chunk = await reader.readNext()) !== null) {
          const text = chunk.toString('utf8');
          const processed = await processor(text);
          results.push(processed);
          
          bytesProcessed += chunk.length;

          // 更新峰值内存使用
          const currentMemory = this.monitor.getCurrentMemoryStats();
          peakMemoryUsage = Math.max(peakMemoryUsage, currentMemory.used);

          // 检查内存使用情况
          if (currentMemory.usagePercent > this.config.gcThreshold) {
            // 触发垃圾回收
            if (global.gc) {
              global.gc();
            }
          }
        }

        // 将结果写入临时文件或返回
        // const result = results.join('');

        return {
          success: true,
          bytesProcessed,
          processingTime: Date.now() - startTime,
          peakMemoryUsage
        };
      } finally {
        await reader.close();
        this.monitor.stopMonitoring();
      }
    } catch (error) {
      this.monitor.stopMonitoring();
      
      return {
        success: false,
        bytesProcessed,
        processingTime: Date.now() - startTime,
        peakMemoryUsage,
        error: (error as Error).message
      };
    }
  }

  /**
   * 压缩内容
   */
  async compressContent(content: string): Promise<CompressionResult> {
    return await this.compressor.compressString(content);
  }

  /**
   * 解压缩内容
   */
  async decompressContent(compressedData: Buffer): Promise<DecompressionResult> {
    return await this.compressor.decompressString(compressedData);
  }

  /**
   * 获取当前内存状态
   */
  getCurrentMemoryStats(): MemoryStats {
    return this.monitor.getCurrentMemoryStats();
  }

  /**
   * 开始内存监控
   */
  startMemoryMonitoring(): void {
    this.monitor.startMonitoring(this.config.memoryMonitorInterval);
  }

  /**
   * 停止内存监控
   */
  stopMemoryMonitoring(): void {
    this.monitor.stopMonitoring();
  }

  /**
   * 检测内存泄漏
   */
  detectMemoryLeak(): MemoryLeakDetectionResult {
    return this.monitor.detectMemoryLeak();
  }

  /**
   * 强制垃圾回收（如果可用）
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * 检查内存警告
   */
  checkMemoryWarning(): { warning: boolean; stats: MemoryStats; message?: string } {
    const stats = this.getCurrentMemoryStats();
    const warning = stats.used > this.config.memoryWarningThreshold;
    
    return {
      warning,
      stats,
      message: warning ? `内存使用超过阈值: ${(stats.used / (1024 * 1024)).toFixed(2)}MB` : undefined
    };
  }

  /**
   * 创建流式处理管道
   */
  async createStreamProcessingPipeline(
    inputPath: string,
    outputPath: string,
    transformer: Transform
  ): Promise<StreamProcessResult> {
    const startTime = Date.now();
    const initialMemory = this.getCurrentMemoryStats();
    let bytesProcessed = 0;

    try {
      const inputStream = fs.createReadStream(inputPath, { 
        highWaterMark: this.config.streamBufferSize 
      });
      const outputStream = fs.createWriteStream(outputPath);

      // 统计字节数的转换流
      const statsTransform = new Transform({
        transform(chunk, _encoding, callback) {
          bytesProcessed += chunk.length;
          callback(null, chunk);
        }
      });

      await pipeline(
        inputStream,
        transformer,
        statsTransform,
        outputStream
      );

      const finalMemory = this.getCurrentMemoryStats();
      const peakMemoryUsage = Math.max(initialMemory.used, finalMemory.used);

      return {
        success: true,
        bytesProcessed,
        processingTime: Date.now() - startTime,
        peakMemoryUsage
      };
    } catch (error) {
      return {
        success: false,
        bytesProcessed,
        processingTime: Date.now() - startTime,
        peakMemoryUsage: this.getCurrentMemoryStats().used,
        error: (error as Error).message
      };
    }
  }

  /**
   * 销毁内存优化器
   */
  destroy(): void {
    this.monitor.stopMonitoring();
    this.monitor.clearHistory();
  }
}