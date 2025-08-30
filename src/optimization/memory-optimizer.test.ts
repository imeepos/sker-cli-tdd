/**
 * 🔴 TDD 红阶段：内存使用优化测试文件
 * 测试大文件流式处理、上下文内容压缩、内存泄漏检测
 */

import { 
  MemoryOptimizer, 
  ChunkedFileReader, 
  ContentCompressor, 
  MemoryMonitor 
} from './memory-optimizer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Transform } from 'stream';

describe('Memory Optimizer 内存使用优化', () => {
  let optimizer: MemoryOptimizer;
  let testDir: string;

  beforeEach(async () => {
    optimizer = new MemoryOptimizer();
    
    // 创建测试目录
    testDir = path.join(os.tmpdir(), `memory-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    optimizer.destroy();
    
    // 清理测试目录
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('内存优化器初始化', () => {
    it('应该能够创建内存优化器实例', () => {
      expect(optimizer).toBeDefined();
      expect(optimizer instanceof MemoryOptimizer).toBe(true);
    });

    it('应该支持配置大文件阈值', () => {
      const config = {
        largeFileThreshold: 5 * 1024 * 1024, // 5MB
        streamBufferSize: 32 * 1024, // 32KB
        compressionLevel: 9
      };
      
      const configuredOptimizer = new MemoryOptimizer(config);
      expect(configuredOptimizer).toBeDefined();
      configuredOptimizer.destroy();
    });

    it('应该能够获取当前内存状态', () => {
      const memStats = optimizer.getCurrentMemoryStats();
      
      expect(memStats).toBeDefined();
      expect(memStats.used).toBeGreaterThan(0);
      expect(memStats.total).toBeGreaterThan(0);
      expect(memStats.usagePercent).toBeGreaterThanOrEqual(0);
      expect(memStats.usagePercent).toBeLessThanOrEqual(100);
    });
  });

  describe('分块文件读取器', () => {
    it('应该能够分块读取文件', async () => {
      // 创建测试文件
      const testFile = path.join(testDir, 'test-chunks.txt');
      const testContent = 'A'.repeat(1024); // 1KB内容
      await fs.promises.writeFile(testFile, testContent);

      const reader = new ChunkedFileReader(testFile, 256); // 256字节块
      await reader.init();

      try {
        const chunks: Buffer[] = [];
        let chunk: Buffer | null;
        
        while ((chunk = await reader.readNext()) !== null) {
          chunks.push(chunk);
        }

        expect(chunks.length).toBe(4); // 1024 / 256 = 4
        
        const reconstructed = Buffer.concat(chunks).toString();
        expect(reconstructed).toBe(testContent);
      } finally {
        await reader.close();
      }
    });

    it('应该能够处理空文件', async () => {
      const emptyFile = path.join(testDir, 'empty.txt');
      await fs.promises.writeFile(emptyFile, '');

      const reader = new ChunkedFileReader(emptyFile, 1024);
      await reader.init();

      try {
        const chunk = await reader.readNext();
        expect(chunk).toBeNull();
      } finally {
        await reader.close();
      }
    });

    it('应该能够重置读取位置', async () => {
      const testFile = path.join(testDir, 'reset-test.txt');
      const testContent = 'Hello World';
      await fs.promises.writeFile(testFile, testContent);

      const reader = new ChunkedFileReader(testFile, 5);
      await reader.init();

      try {
        // 读取第一个块
        const firstChunk = await reader.readNext();
        expect(firstChunk?.toString()).toBe('Hello');

        // 重置并重新读取
        reader.reset();
        await reader.close();
        await reader.init();

        const resetChunk = await reader.readNext();
        expect(resetChunk?.toString()).toBe('Hello');
      } finally {
        await reader.close();
      }
    });

    it('应该处理文件不存在的错误', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');
      const reader = new ChunkedFileReader(nonExistentFile, 1024);

      await expect(reader.init()).rejects.toThrow();
    });
  });

  describe('内容压缩器', () => {
    let compressor: ContentCompressor;

    beforeEach(() => {
      compressor = new ContentCompressor(6); // 默认压缩级别
    });

    it('应该能够压缩字符串内容', async () => {
      const originalText = 'Hello World '.repeat(100);
      
      const result = await compressor.compressString(originalText);
      
      expect(result.compressed).toBeDefined();
      expect(result.originalSize).toBe(Buffer.byteLength(originalText, 'utf8'));
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.compressionRatio).toBeLessThan(1);
      expect(result.compressionTime).toBeGreaterThan(0);
    });

    it('应该能够解压缩内容', async () => {
      const originalText = 'This is a test string for compression and decompression.';
      
      const compressed = await compressor.compressString(originalText);
      const decompressed = await compressor.decompressString(compressed.compressed);
      
      expect(decompressed.content).toBe(originalText);
      expect(decompressed.decompressionTime).toBeGreaterThan(0);
      expect(decompressed.originalSize).toBe(Buffer.byteLength(originalText, 'utf8'));
    });

    it('应该能够创建压缩流', () => {
      const compressionStream = compressor.createCompressionStream();
      const decompressionStream = compressor.createDecompressionStream();
      
      expect(compressionStream).toBeDefined();
      expect(decompressionStream).toBeDefined();
    });

    it('应该能够处理空字符串', async () => {
      const emptyString = '';
      
      const compressed = await compressor.compressString(emptyString);
      const decompressed = await compressor.decompressString(compressed.compressed);
      
      expect(decompressed.content).toBe(emptyString);
      expect(compressed.originalSize).toBe(0);
    });

    it('应该根据压缩级别产生不同的压缩结果', async () => {
      const testText = 'A'.repeat(1000);
      
      const lowCompression = new ContentCompressor(1);
      const highCompression = new ContentCompressor(9);
      
      const lowResult = await lowCompression.compressString(testText);
      const highResult = await highCompression.compressString(testText);
      
      expect(highResult.compressedSize).toBeLessThanOrEqual(lowResult.compressedSize);
    });
  });

  describe('内存监控器', () => {
    let monitor: MemoryMonitor;

    beforeEach(() => {
      monitor = new MemoryMonitor();
    });

    afterEach(() => {
      monitor.stopMonitoring();
    });

    it('应该能够获取当前内存统计', () => {
      const stats = monitor.getCurrentMemoryStats();
      
      expect(stats.used).toBeGreaterThan(0);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.rss).toBeGreaterThan(0);
      expect(stats.usagePercent).toBeGreaterThanOrEqual(0);
    });

    it('应该能够开始和停止内存监控', (done) => {
      monitor.startMonitoring(100); // 100ms间隔
      
      setTimeout(() => {
        const history = monitor.getMemoryHistory();
        expect(history.length).toBeGreaterThan(0);
        
        monitor.stopMonitoring();
        const finalHistory = monitor.getMemoryHistory();
        
        setTimeout(() => {
          const afterStopHistory = monitor.getMemoryHistory();
          expect(afterStopHistory.length).toBe(finalHistory.length);
          done();
        }, 200);
      }, 350);
    });

    it('应该能够检测内存泄漏', (done) => {
      monitor.startMonitoring(50);
      
      // 模拟内存使用增长
      const leakObjects: any[] = [];
      const interval = setInterval(() => {
        // 故意创建一些对象来模拟内存增长
        for (let i = 0; i < 1000; i++) {
          leakObjects.push({ data: 'x'.repeat(1024) });
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(interval);
        monitor.stopMonitoring();
        
        const leakResult = monitor.detectMemoryLeak();
        
        expect(leakResult).toBeDefined();
        expect(leakResult.memorySamples.length).toBeGreaterThan(2);
        expect(leakResult.monitoringDuration).toBeGreaterThanOrEqual(0);
        
        // 清理测试对象
        leakObjects.length = 0;
        done();
      }, 300);
    }, 15000);

    it('应该能够清除监控历史', (done) => {
      monitor.startMonitoring(100);
      
      setTimeout(() => {
        expect(monitor.getMemoryHistory().length).toBeGreaterThanOrEqual(0);
        
        monitor.clearHistory();
        expect(monitor.getMemoryHistory().length).toBe(0);
        
        monitor.stopMonitoring();
        done();
      }, 250);
    });

    it('应该在监控时间不足时给出建议', () => {
      // 不开始监控直接检测
      const result = monitor.detectMemoryLeak();
      
      expect(result.leakDetected).toBe(false);
      expect(result.recommendations).toContain('监控时间过短，无法检测内存泄漏');
    });
  });

  describe('大文件流式处理', () => {
    it('应该能够检查文件是否需要流式处理', async () => {
      // 创建小文件
      const smallFile = path.join(testDir, 'small.txt');
      await fs.promises.writeFile(smallFile, 'Small content');
      
      // 创建大文件
      const largeFile = path.join(testDir, 'large.txt');
      const largeContent = 'X'.repeat(15 * 1024 * 1024); // 15MB
      await fs.promises.writeFile(largeFile, largeContent);
      
      const shouldStreamSmall = await optimizer.shouldUseStreamProcessing(smallFile);
      const shouldStreamLarge = await optimizer.shouldUseStreamProcessing(largeFile);
      
      expect(shouldStreamSmall).toBe(false);
      expect(shouldStreamLarge).toBe(true);
    });

    it('应该能够流式处理文件', async () => {
      const testFile = path.join(testDir, 'stream-test.txt');
      const testContent = 'Line 1\nLine 2\nLine 3\nLine 4\n'.repeat(1000);
      await fs.promises.writeFile(testFile, testContent);
      
      // 简单的处理器：转换为大写
      const processor = async (chunk: string): Promise<string> => {
        return chunk.toUpperCase();
      };
      
      const result = await optimizer.processFileWithStreams(testFile, processor);
      
      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.peakMemoryUsage).toBeGreaterThan(0);
    });

    it('应该能够处理流式处理中的错误', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');
      
      const processor = async (chunk: string): Promise<string> => {
        return chunk;
      };
      
      const result = await optimizer.processFileWithStreams(nonExistentFile, processor);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该能够创建流式处理管道', async () => {
      const inputFile = path.join(testDir, 'input.txt');
      const outputFile = path.join(testDir, 'output.txt');
      const testContent = 'Hello World\n'.repeat(1000);
      
      await fs.promises.writeFile(inputFile, testContent);
      
      // 创建转换流：转换为大写
      const transformer = new Transform({
        transform(chunk, _encoding, callback) {
          const transformed = chunk.toString().toUpperCase();
          callback(null, transformed);
        }
      });
      
      const result = await optimizer.createStreamProcessingPipeline(
        inputFile,
        outputFile,
        transformer
      );
      
      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBeGreaterThan(0);
      
      // 验证输出文件
      const outputContent = await fs.promises.readFile(outputFile, 'utf8');
      expect(outputContent).toBe(testContent.toUpperCase());
    });
  });

  describe('压缩功能集成', () => {
    it('应该能够压缩大型内容', async () => {
      const largeText = JSON.stringify({
        data: 'A'.repeat(10000),
        nested: {
          array: Array(1000).fill('test'),
          object: Object.fromEntries(Array(500).fill(0).map((_, i) => [`key${i}`, `value${i}`]))
        }
      });
      
      const result = await optimizer.compressContent(largeText);
      
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.compressionRatio).toBeLessThan(1);
      
      // 验证可以正确解压
      const decompressed = await optimizer.decompressContent(result.compressed);
      expect(decompressed.content).toBe(largeText);
    });

    it('应该能够处理不可压缩的内容', async () => {
      // 生成随机数据（较难压缩）
      const randomData = Buffer.from(Array(1000).fill(0).map(() => Math.floor(Math.random() * 256))).toString('binary');
      
      const result = await optimizer.compressContent(randomData);
      
      expect(result.compressed).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(0.5); // 随机数据压缩比不会太好
      
      const decompressed = await optimizer.decompressContent(result.compressed);
      expect(decompressed.content).toBe(randomData);
    });
  });

  describe('内存警告和垃圾回收', () => {
    it('应该能够检查内存警告', () => {
      const warning = optimizer.checkMemoryWarning();
      
      expect(warning.warning).toBeDefined();
      expect(warning.stats).toBeDefined();
      expect(warning.stats.used).toBeGreaterThan(0);
    });

    it('应该能够尝试强制垃圾回收', () => {
      const gcResult = optimizer.forceGarbageCollection();
      
      // GC可能不可用，所以只检查返回值
      expect(typeof gcResult).toBe('boolean');
    });

    it('应该能够开始和停止内存监控', (done) => {
      optimizer.startMemoryMonitoring();
      
      setTimeout(() => {
        const leakResult = optimizer.detectMemoryLeak();
        expect(leakResult.memorySamples.length).toBeGreaterThanOrEqual(0);
        
        optimizer.stopMemoryMonitoring();
        done();
      }, 150);
    }, 15000);
  });

  describe('错误处理和边界情况', () => {
    it('应该处理文件不存在的情况', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');
      
      await expect(optimizer.shouldUseStreamProcessing(nonExistentFile))
        .rejects.toThrow('检查文件大小失败');
    });

    it('应该处理损坏的压缩数据', async () => {
      const invalidCompressedData = Buffer.from('invalid compressed data');
      
      await expect(optimizer.decompressContent(invalidCompressedData))
        .rejects.toThrow();
    });

    it('应该能够安全销毁优化器', () => {
      optimizer.startMemoryMonitoring();
      
      // 销毁应该清理所有资源
      expect(() => optimizer.destroy()).not.toThrow();
      
      // 重复销毁应该是安全的
      expect(() => optimizer.destroy()).not.toThrow();
    });
  });

  describe('性能基准测试', () => {
    it('应该在合理时间内处理中等大小文件', async () => {
      const testFile = path.join(testDir, 'performance-test.txt');
      const testContent = 'Performance test content\n'.repeat(10000); // ~240KB
      await fs.promises.writeFile(testFile, testContent);
      
      const startTime = Date.now();
      
      const processor = async (chunk: string): Promise<string> => {
        // 模拟一些处理工作
        return chunk.replace(/test/g, 'TEST');
      };
      
      const result = await optimizer.processFileWithStreams(testFile, processor);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
      expect(result.peakMemoryUsage).toBeGreaterThan(0);
    });

    it('应该展示压缩的性能优势', async () => {
      const repetitiveContent = 'This is a highly repetitive content. '.repeat(1000);
      
      const startTime = Date.now();
      const result = await optimizer.compressContent(repetitiveContent);
      const compressionTime = Date.now() - startTime;
      
      expect(compressionTime).toBeLessThan(1000); // 应该在1秒内完成压缩
      expect(result.compressionRatio).toBeLessThan(0.1); // 重复内容应该压缩得很好
      
      // 测试解压缩性能
      const decompressStart = Date.now();
      const decompressed = await optimizer.decompressContent(result.compressed);
      const decompressionTime = Date.now() - decompressStart;
      
      expect(decompressionTime).toBeLessThan(500); // 解压缩应该很快
      expect(decompressed.content).toBe(repetitiveContent);
    });
  });
});