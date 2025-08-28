/**
 * 🔴 TDD 红阶段：Context上下文功能测试
 * 这些测试最初会失败 - 这是正确的 TDD 行为！
 */

import { Context, FileContext, FolderContext, ContextBuilder } from './context'; // ❌ 这会失败 - 正确的！
import * as path from 'path';
import * as fs from 'fs';

describe('Context上下文功能', () => {
  describe('Context基础接口', () => {
    it('应该定义Context基础接口', () => {
      // ❌ 这会失败，因为Context接口不存在
      const context: Context = {
        path: '/test/file.txt',
        name: 'file.txt',
        type: 'file'
      };
      
      expect(context.path).toBe('/test/file.txt');
      expect(context.name).toBe('file.txt');
      expect(context.type).toBe('file');
    });
  });

  describe('FileContext文件上下文', () => {
    it('应该创建文件上下文', () => {
      // ❌ 这会失败，因为FileContext类不存在
      const fileContext = new FileContext('/test/file.txt');
      
      expect(fileContext.path).toBe('/test/file.txt');
      expect(fileContext.name).toBe('file.txt');
      expect(fileContext.type).toBe('file');
      expect(fileContext.parent).toBeUndefined();
    });

    it('应该正确解析文件名', () => {
      const fileContext = new FileContext('/path/to/document.md');
      
      expect(fileContext.name).toBe('document.md');
      expect(fileContext.extension).toBe('.md');
    });

    it('应该设置父级文件夹上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      
      fileContext.setParent(folderContext);
      
      expect(fileContext.parent).toBe(folderContext);
    });
  });

  describe('FolderContext文件夹上下文', () => {
    it('应该创建文件夹上下文', () => {
      // ❌ 这会失败，因为FolderContext类不存在
      const folderContext = new FolderContext('/test/folder');
      
      expect(folderContext.path).toBe('/test/folder');
      expect(folderContext.name).toBe('folder');
      expect(folderContext.type).toBe('folder');
      expect(folderContext.children).toEqual([]);
    });

    it('应该添加子级上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      
      folderContext.addChild(fileContext);
      
      expect(folderContext.children).toContain(fileContext);
      expect(fileContext.parent).toBe(folderContext);
    });

    it('应该移除子级上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      
      folderContext.addChild(fileContext);
      folderContext.removeChild(fileContext);
      
      expect(folderContext.children).not.toContain(fileContext);
      expect(fileContext.parent).toBeUndefined();
    });

    it('应该按名称查找子级上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      
      folderContext.addChild(fileContext);
      
      const found = folderContext.findChild('file.txt');
      expect(found).toBe(fileContext);
      
      const notFound = folderContext.findChild('nonexistent.txt');
      expect(notFound).toBeUndefined();
    });
  });

  describe('ContextBuilder上下文构建器', () => {
    const testDir = path.join(__dirname, '../test-context-dir');
    
    beforeEach(async () => {
      // 创建测试目录结构
      await fs.promises.mkdir(testDir, { recursive: true });
      await fs.promises.mkdir(path.join(testDir, 'subfolder'), { recursive: true });
      await fs.promises.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.promises.writeFile(path.join(testDir, 'file2.md'), 'content2');
      await fs.promises.writeFile(path.join(testDir, 'subfolder', 'nested.js'), 'content3');
    });

    afterEach(async () => {
      // 清理测试目录
      if (fs.existsSync(testDir)) {
        await fs.promises.rm(testDir, { recursive: true, force: true });
      }
    });

    it('应该创建上下文构建器', () => {
      // ❌ 这会失败，因为ContextBuilder类不存在
      const builder = new ContextBuilder();
      
      expect(builder).toBeDefined();
    });

    it('应该扫描目录并构建上下文树', async () => {
      const builder = new ContextBuilder();
      
      // ❌ 这会失败，因为buildFromDirectory方法不存在
      const rootContext = await builder.buildFromDirectory(testDir);
      
      expect(rootContext).toBeInstanceOf(FolderContext);
      expect(rootContext.path).toBe(testDir);
      expect(rootContext.children.length).toBe(3); // file1.txt, file2.md, subfolder
    });

    it('应该正确构建嵌套目录结构', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(testDir);
      
      // 查找子文件夹
      const subfolder = rootContext.findChild('subfolder') as FolderContext;
      expect(subfolder).toBeInstanceOf(FolderContext);
      expect(subfolder.children.length).toBe(1); // nested.js
      
      // 查找嵌套文件
      const nestedFile = subfolder.findChild('nested.js');
      expect(nestedFile).toBeInstanceOf(FileContext);
      expect(nestedFile?.parent).toBe(subfolder);
    });

    it('应该支持文件过滤选项', async () => {
      const builder = new ContextBuilder();
      
      // ❌ 这会失败，因为过滤选项不存在
      const rootContext = await builder.buildFromDirectory(testDir, {
        includeExtensions: ['.txt', '.md'],
        excludeExtensions: ['.js']
      });
      
      expect(rootContext.children.length).toBe(3); // file1.txt, file2.md, subfolder
      
      const subfolder = rootContext.findChild('subfolder') as FolderContext;
      expect(subfolder.children.length).toBe(0); // nested.js被过滤掉
    });

    it('应该支持深度限制选项', async () => {
      const builder = new ContextBuilder();
      
      const rootContext = await builder.buildFromDirectory(testDir, {
        maxDepth: 1
      });
      
      expect(rootContext.children.length).toBe(3);
      
      const subfolder = rootContext.findChild('subfolder') as FolderContext;
      expect(subfolder.children.length).toBe(0); // 深度限制，不扫描子目录内容
    });
  });

  describe('Context工具方法', () => {
    it('应该获取上下文的完整路径', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      folderContext.addChild(fileContext);
      
      expect(fileContext.getFullPath()).toBe('/test/file.txt');
    });

    it('应该获取上下文的相对路径', () => {
      const rootContext = new FolderContext('/project');
      const subfolderContext = new FolderContext('/project/src');
      const fileContext = new FileContext('/project/src/index.ts');
      
      rootContext.addChild(subfolderContext);
      subfolderContext.addChild(fileContext);
      
      expect(fileContext.getRelativePath(rootContext)).toBe(path.join('src', 'index.ts'));
    });

    it('应该检查上下文是否为祖先', () => {
      const rootContext = new FolderContext('/project');
      const subfolderContext = new FolderContext('/project/src');
      const fileContext = new FileContext('/project/src/index.ts');
      
      rootContext.addChild(subfolderContext);
      subfolderContext.addChild(fileContext);
      
      expect(fileContext.isDescendantOf(rootContext)).toBe(true);
      expect(fileContext.isDescendantOf(subfolderContext)).toBe(true);
      expect(rootContext.isDescendantOf(fileContext)).toBe(false);
    });
  });
});
