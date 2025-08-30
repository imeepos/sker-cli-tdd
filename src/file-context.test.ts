/**
 * 🔴 TDD 红阶段：FileContext 文件上下文测试
 * 测试文件上下文的所有功能
 */

import { FileContext } from './file-context';
import * as fs from 'fs';
import * as path from 'path';

describe('FileContext', () => {
  let testFilePath: string;

  beforeEach(async () => {
    // 创建临时测试文件
    testFilePath = path.join(__dirname, '..', 'test-temp-file.txt');
    await fs.promises.writeFile(
      testFilePath,
      'test content for file context',
      'utf8'
    );
  });

  afterEach(async () => {
    // 清理临时测试文件
    try {
      await fs.promises.unlink(testFilePath);
    } catch {
      // 忽略清理错误
    }
  });

  describe('构造函数', () => {
    it('应该正确初始化文件上下文', () => {
      const fileContext = new FileContext('/test/file.ts');

      expect(fileContext.path).toBe('/test/file.ts');
      expect(fileContext.name).toBe('file.ts');
      expect(fileContext.type).toBe('file');
    });

    it('应该正确解析文件扩展名', () => {
      const fileContext = new FileContext('/test/file.test.ts');

      expect(fileContext.extension).toBe('.ts');
    });

    it('应该正确解析无扩展名文件', () => {
      const fileContext = new FileContext('/test/README');

      expect(fileContext.extension).toBe('');
    });
  });

  describe('文件信息加载', () => {
    it('应该能加载文件统计信息', async () => {
      const fileContext = new FileContext(testFilePath);
      await fileContext.loadFileInfo();

      expect(fileContext.size).toBeGreaterThan(0);
      expect(fileContext.lastModified).toBeDefined();
      expect(fileContext.lastModified?.getTime()).toBeGreaterThan(0);
    });

    it('应该能处理文件不存在的情况', async () => {
      const fileContext = new FileContext('/nonexistent/file.txt');

      await expect(fileContext.loadFileInfo()).rejects.toThrow();
    });
  });

  describe('内容加载', () => {
    it('应该能加载文本文件内容', async () => {
      const fileContext = new FileContext(testFilePath);
      await fileContext.loadContent();

      expect(fileContext.content).toBe('test content for file context');
    });

    it('应该能计算文件hash', async () => {
      const fileContext = new FileContext(testFilePath);
      await fileContext.loadContent();

      expect(fileContext.hash).toBeDefined();
      expect(typeof fileContext.hash).toBe('string');
      expect(fileContext.hash?.length).toBe(64); // SHA256长度
    });
  });

  describe('文件类型检查', () => {
    it('应该能同步检查是否为文本文件', () => {
      const fileContext = new FileContext(testFilePath);
      const isText = fileContext.isTextFile;

      expect(isText).toBe(true);
    });

    it('应该能异步检查是否为文本文件', async () => {
      const fileContext = new FileContext(testFilePath);
      const isText = await fileContext.isTextFileAsync();

      expect(isText).toBe(true);
    });
  });

  describe('MIME类型检测', () => {
    it('应该能检测TypeScript文件的MIME类型', () => {
      const fileContext = new FileContext('/test/file.ts');

      // TypeScript文件可能被识别为不同的MIME类型
      expect(typeof fileContext.mimeType).toBe('string');
      expect(fileContext.mimeType).toBeTruthy();
    });

    it('应该能检测JSON文件的MIME类型', () => {
      const fileContext = new FileContext('/test/config.json');

      expect(fileContext.mimeType).toBe('application/json');
    });
  });

  describe('兼容性方法', () => {
    it('应该能生成文件摘要', async () => {
      const testFile = path.join(__dirname, '../test-summary.js');
      const testContent = `function test() {
  console.log('test');
}
class MyClass {}`;

      try {
        await fs.promises.writeFile(testFile, testContent);

        const fileContext = new FileContext(testFile);
        await fileContext.loadFileInfo();
        await fileContext.loadContent();

        const summary = fileContext.generateSummary();
        expect(typeof summary).toBe('string');
        expect(summary).toContain('JavaScript');
      } finally {
        if (fs.existsSync(testFile)) {
          await fs.promises.unlink(testFile);
        }
      }
    });

    it('应该支持路径相关方法', () => {
      const fileContext = new FileContext('/project/src/index.ts');
      const rootContext = new FileContext('/project');

      expect(fileContext.getFullPath()).toBe('/project/src/index.ts');
      expect(fileContext.getRelativePath(rootContext)).toBe(
        path.relative('/project', '/project/src/index.ts')
      );
      expect(fileContext.isDescendantOf(rootContext)).toBe(true);
    });

    it('应该包含创建时间信息', async () => {
      const testFile = path.join(__dirname, '../test-created-time.txt');

      try {
        await fs.promises.writeFile(testFile, 'test content');

        const fileContext = new FileContext(testFile);
        await fileContext.loadFileInfo();

        expect(fileContext.createdTime).toBeDefined();
        expect(fileContext.createdTime?.getTime()).toBeGreaterThan(0);
      } finally {
        if (fs.existsSync(testFile)) {
          await fs.promises.unlink(testFile);
        }
      }
    });
  });
});
