/**
 * 🔴 TDD 红阶段：FolderContext 文件夹上下文测试
 * 测试文件夹上下文的所有功能
 */

import { FolderContext } from './folder-context';
import { FileContext } from './file-context';
import * as fs from 'fs';
import * as path from 'path';

describe('FolderContext', () => {
  let testDirPath: string;
  let testFilePath: string;

  beforeEach(async () => {
    // 创建临时测试目录和文件
    testDirPath = path.join(__dirname, '..', 'test-temp-dir');
    testFilePath = path.join(testDirPath, 'test-file.txt');

    await fs.promises.mkdir(testDirPath, { recursive: true });
    await fs.promises.writeFile(testFilePath, 'test content', 'utf8');
  });

  afterEach(async () => {
    // 清理临时测试文件和目录
    try {
      await fs.promises.rm(testDirPath, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('构造函数', () => {
    it('应该正确初始化文件夹上下文', () => {
      const folderContext = new FolderContext('/test/folder');

      expect(folderContext.path).toBe('/test/folder');
      expect(folderContext.name).toBe('folder');
      expect(folderContext.type).toBe('folder');
      expect(folderContext.children).toEqual([]);
      expect(folderContext.isProjectRoot).toBe(false);
    });
  });

  describe('父子关系管理', () => {
    it('应该能添加子级上下文', () => {
      const folder = new FolderContext('/test');
      const file = new FileContext('/test/file.ts');

      folder.addChild(file);

      expect(folder.children).toContain(file);
      expect(file.parent).toBe(folder);
    });

    it('应该避免重复添加相同子级', () => {
      const folder = new FolderContext('/test');
      const file = new FileContext('/test/file.ts');

      folder.addChild(file);
      folder.addChild(file); // 重复添加

      expect(folder.children.length).toBe(1);
    });

    it('应该能移除子级上下文', () => {
      const folder = new FolderContext('/test');
      const file = new FileContext('/test/file.ts');

      folder.addChild(file);
      folder.removeChild(file);

      expect(folder.children).not.toContain(file);
      expect(file.parent).toBeUndefined();
    });

    it('应该能按名称查找子级', () => {
      const folder = new FolderContext('/test');
      const file = new FileContext('/test/file.ts');

      folder.addChild(file);
      const found = folder.findChild('file.ts');

      expect(found).toBe(file);
    });

    it('查找不存在的子级应该返回undefined', () => {
      const folder = new FolderContext('/test');
      const found = folder.findChild('nonexistent.ts');

      expect(found).toBeUndefined();
    });
  });

  describe('项目根目录检查', () => {
    it('应该能同步检查项目根目录状态', () => {
      const folder = new FolderContext('/test');
      folder.isProjectRoot = true;

      const isProject = folder.checkIsProjectRootSync();

      expect(isProject).toBe(true);
    });

    it('应该能异步检查项目根目录状态', async () => {
      const folder = new FolderContext('/test');
      folder.isProjectRoot = true;

      const isProject = await folder.checkIsProjectRoot();

      expect(isProject).toBe(true);
    });
  });

  describe('多子项目工作空间检查', () => {
    it('应该能识别多子项目工作空间', async () => {
      const workspace = new FolderContext('/workspace');
      const project1 = new FolderContext('/workspace/project1');
      const project2 = new FolderContext('/workspace/project2');

      project1.isProjectRoot = true;
      project2.isProjectRoot = true;

      workspace.addChild(project1);
      workspace.addChild(project2);

      const isWorkspace = await workspace.isMultiProjectWorkspace();

      expect(isWorkspace).toBe(true);
    });

    it('单个项目不应该被识别为工作空间', async () => {
      const workspace = new FolderContext('/workspace');
      const project1 = new FolderContext('/workspace/project1');

      project1.isProjectRoot = true;
      workspace.addChild(project1);

      const isWorkspace = await workspace.isMultiProjectWorkspace();

      expect(isWorkspace).toBe(false);
    });
  });

  describe('项目信息获取', () => {
    it('非项目根目录应该返回null', async () => {
      const folder = new FolderContext('/test');
      const projectInfo = await folder.getProjectInfo();

      expect(projectInfo).toBeNull();
    });

    it('项目根目录应该返回缓存的项目信息', async () => {
      const folder = new FolderContext('/test');
      folder.isProjectRoot = true;
      folder.projectInfo = { name: 'test-project' };

      const projectInfo = await folder.getProjectInfo();

      expect(projectInfo).toEqual({ name: 'test-project' });
    });
  });

  describe('文件夹大小计算', () => {
    it('应该能计算包含文件的文件夹大小', async () => {
      const folder = new FolderContext(testDirPath);
      const file = new FileContext(testFilePath);
      folder.addChild(file);

      const totalSize = await folder.getTotalSize();

      expect(totalSize).toBeGreaterThan(0);
    });

    it('空文件夹大小应该为0', async () => {
      const folder = new FolderContext('/empty');

      const totalSize = await folder.getTotalSize();

      expect(totalSize).toBe(0);
    });
  });

  describe('兼容性方法', () => {
    it('应该能获取所有子级上下文', () => {
      const root = new FolderContext('/root');
      const subFolder = new FolderContext('/root/sub');
      const file = new FileContext('/root/file.txt');
      const subFile = new FileContext('/root/sub/sub-file.txt');

      root.addChild(subFolder);
      root.addChild(file);
      subFolder.addChild(subFile);

      const descendants = root.getAllDescendants();
      
      expect(descendants).toHaveLength(3);
      expect(descendants).toContain(subFolder);
      expect(descendants).toContain(file);
      expect(descendants).toContain(subFile);
    });

    it('应该能根据模式查找文件', () => {
      const root = new FolderContext('/root');
      const jsFile = new FileContext('/root/test.js');
      const tsFile = new FileContext('/root/test.ts');
      const txtFile = new FileContext('/root/readme.txt');

      root.addChild(jsFile);
      root.addChild(tsFile);
      root.addChild(txtFile);

      const scriptFiles = root.findFilesByPattern(/\.(js|ts)$/);
      
      expect(scriptFiles).toHaveLength(2);
      expect(scriptFiles).toContain(jsFile);
      expect(scriptFiles).toContain(tsFile);
      expect(scriptFiles).not.toContain(txtFile);
    });

    it('应该能根据模式查找文件夹', () => {
      const root = new FolderContext('/root');
      const srcFolder = new FolderContext('/root/src');
      const testFolder = new FolderContext('/root/test');
      const distFolder = new FolderContext('/root/dist');

      root.addChild(srcFolder);
      root.addChild(testFolder);
      root.addChild(distFolder);

      const sourceFolders = root.findFoldersByPattern(/^(src|test)$/);
      
      expect(sourceFolders).toHaveLength(2);
      expect(sourceFolders).toContain(srcFolder);
      expect(sourceFolders).toContain(testFolder);
      expect(sourceFolders).not.toContain(distFolder);
    });

    it('应该能检查层级关系', () => {
      const root = new FolderContext('/project');
      const subFolder = new FolderContext('/project/src');
      const otherFolder = new FolderContext('/other');

      expect(subFolder.isDescendantOf(root)).toBe(true);
      expect(root.isDescendantOf(subFolder)).toBe(false);
      expect(otherFolder.isDescendantOf(root)).toBe(false);
    });

    it('应该能生成文件夹摘要', async () => {
      const folder = new FolderContext('/test');
      folder.projectInfo = { name: 'test-project', version: '1.0.0' };
      folder.isProjectRoot = true;

      const file = new FileContext('/test/file.txt');
      const subFolder = new FolderContext('/test/sub');

      folder.addChild(file);
      folder.addChild(subFolder);

      const summary = await folder.getSummary();
      
      expect(typeof summary).toBe('string');
      expect(summary).toContain('test');
      expect(summary).toContain('test-project');
      expect(summary).toContain('v1.0.0');
    });
  });
});