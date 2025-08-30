/**
 * 🔴 TDD 红阶段：ContextBuilder 构建器测试
 * 测试上下文构建器的所有功能
 */

import { ContextBuilder, ContextBuilderOptions } from './context-builder';
import { FolderContext } from './folder-context';
import * as fs from 'fs';
import * as path from 'path';

describe('ContextBuilder', () => {
  let builder: ContextBuilder;
  let testDirPath: string;
  let testSubDirPath: string;

  beforeEach(async () => {
    builder = new ContextBuilder();

    // 创建临时测试目录结构
    testDirPath = path.join(__dirname, '..', 'test-build-dir');
    testSubDirPath = path.join(testDirPath, 'subdir');

    await fs.promises.mkdir(testDirPath, { recursive: true });
    await fs.promises.mkdir(testSubDirPath, { recursive: true });

    // 创建各种类型的测试文件
    await fs.promises.writeFile(
      path.join(testDirPath, 'test.ts'),
      'typescript content',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(testDirPath, 'test.js'),
      'javascript content',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(testDirPath, 'test.json'),
      '{"test": true}',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(testDirPath, 'test.log'),
      'log content',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(testDirPath, 'sker.json'),
      '{"name": "test-project"}',
      'utf8'
    );

    // 子目录文件
    await fs.promises.writeFile(
      path.join(testSubDirPath, 'sub.ts'),
      'sub typescript',
      'utf8'
    );
  });

  afterEach(async () => {
    // 清理临时测试文件和目录
    try {
      await fs.promises.rm(testDirPath, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('基本构建功能', () => {
    it('应该能构建基本的目录结构', async () => {
      const rootContext = await builder.buildFromDirectory(testDirPath);

      expect(rootContext).toBeInstanceOf(FolderContext);
      expect(rootContext.path).toBe(testDirPath);
      expect(rootContext.children.length).toBeGreaterThan(0);
    });

    it('应该能识别项目根目录', async () => {
      const rootContext = await builder.buildFromDirectory(testDirPath);

      expect(rootContext.isProjectRoot).toBe(true);
      expect(rootContext.projectInfo?.name).toBe('test-project');
    });

    it('应该能构建子目录结构', async () => {
      const rootContext = await builder.buildFromDirectory(testDirPath);
      const subDirContext = rootContext.findChild('subdir') as FolderContext;

      expect(subDirContext).toBeDefined();
      expect(subDirContext?.type).toBe('folder');
      expect(subDirContext?.children.length).toBeGreaterThan(0);
    });
  });

  describe('文件扩展名过滤', () => {
    it('应该能按包含扩展名过滤', async () => {
      const options: ContextBuilderOptions = {
        includeExtensions: ['.ts', '.js'],
      };

      const rootContext = await builder.buildFromDirectory(
        testDirPath,
        options
      );
      const fileNames = rootContext.children
        .filter(child => child.type === 'file')
        .map(child => child.name);

      expect(fileNames).toContain('test.ts');
      expect(fileNames).toContain('test.js');
      expect(fileNames).not.toContain('test.log');
    });

    it('应该能按排除扩展名过滤', async () => {
      const options: ContextBuilderOptions = {
        excludeExtensions: ['.log', '.json'],
      };

      const rootContext = await builder.buildFromDirectory(
        testDirPath,
        options
      );
      const fileNames = rootContext.children
        .filter(child => child.type === 'file')
        .map(child => child.name);

      expect(fileNames).toContain('test.ts');
      expect(fileNames).toContain('test.js');
      expect(fileNames).not.toContain('test.log');
    });
  });

  describe('深度控制', () => {
    it('应该能限制扫描深度', async () => {
      const options: ContextBuilderOptions = {
        maxDepth: 1,
      };

      const rootContext = await builder.buildFromDirectory(
        testDirPath,
        options
      );
      const subDirContext = rootContext.findChild('subdir') as FolderContext;

      expect(subDirContext).toBeDefined();
      expect(subDirContext?.children.length).toBe(0); // 深度限制，子目录内容未扫描
    });

    it('无深度限制应该扫描所有层级', async () => {
      const rootContext = await builder.buildFromDirectory(testDirPath);
      const subDirContext = rootContext.findChild('subdir') as FolderContext;

      expect(subDirContext?.children.length).toBeGreaterThan(0); // 应该包含子文件
    });
  });

  describe('gitignore支持', () => {
    it('应该能创建不使用gitignore的构建器', async () => {
      const options: ContextBuilderOptions = {
        respectGitignore: false,
      };

      const rootContext = await builder.buildFromDirectory(
        testDirPath,
        options
      );

      expect(rootContext.children.length).toBeGreaterThan(0);
    });

    it('应该能处理不存在的gitignore文件', async () => {
      const options: ContextBuilderOptions = {
        respectGitignore: true,
      };

      const rootContext = await builder.buildFromDirectory(
        testDirPath,
        options
      );

      expect(rootContext.children.length).toBeGreaterThan(0);
    });
  });

  describe('默认选项', () => {
    it('无选项时应该包含所有文件', async () => {
      const rootContext = await builder.buildFromDirectory(testDirPath);
      const fileCount = rootContext.children.filter(
        child => child.type === 'file'
      ).length;

      expect(fileCount).toBeGreaterThan(3); // 应该包含所有测试文件
    });
  });
});
