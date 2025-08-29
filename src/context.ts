/**
 * � TDD 重构阶段：Context上下文功能实现
 *
 * Context上下文功能提供了文件系统的抽象表示，支持：
 * 1. 每个文件一个Context (路径/简洁)
 * 2. 上级是文件夹Context
 * 3. 文件夹Context (children: Context[])
 *
 * 主要特性：
 * - 文件和文件夹的统一抽象
 * - 树形结构的父子关系管理
 * - 灵活的文件系统扫描和过滤
 * - 跨平台路径处理
 *
 * @author AI Coding Agent
 * @version 1.0.0
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import ignore from 'ignore';
import * as mimeTypes from 'mime-types';
import * as JSON5 from 'json5';

/**
 * 项目信息接口
 *
 * 定义了从sker.json文件中读取的项目配置信息。
 * 用于项目识别和上下文隔离。
 *
 * @example
 * ```typescript
 * const projectInfo: ProjectInfo = {
 *   name: 'my-project',
 *   version: '1.0.0',
 *   description: 'My awesome project'
 * };
 * ```
 */
export interface ProjectInfo {
  /** 项目名称 */
  name: string;
  /** 项目版本 */
  version?: string;
  /** 项目描述 */
  description?: string;
  /** 其他配置项 */
  [key: string]: any;
}

/**
 * Context基础接口
 *
 * 定义所有上下文对象的基本属性和方法，为文件系统中的文件和文件夹
 * 提供统一的抽象表示。每个Context实例代表文件系统中的一个节点，
 * 可以是文件或文件夹。
 *
 * @example
 * ```typescript
 * const fileContext: Context = {
 *   path: '/project/src/index.ts',
 *   name: 'index.ts',
 *   type: 'file',
 *   parent: folderContext
 * };
 * ```
 */
export interface Context {
  /** 上下文的完整绝对路径 */
  path: string;

  /** 上下文的名称（文件名或文件夹名，不包含路径） */
  name: string;

  /** 上下文类型：'file' 表示文件，'folder' 表示文件夹 */
  type: 'file' | 'folder';

  /** 父级上下文（根目录的parent为undefined） */
  parent?: Context | undefined;
}

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

  /** 文件名（包含扩展名） */
  public readonly name: string;

  /** 上下文类型，固定为 'file' */
  public readonly type: 'file' = 'file';

  /** 父级文件夹上下文 */
  public parent?: Context | undefined;

  /** 文件扩展名（包含点号，如 '.ts'） */
  public readonly extension: string;

  // 文件统计信息
  /** 文件大小（字节） */
  public size?: number;

  /** 文件修改时间 */
  public modifiedTime?: Date;

  /** 文件创建时间 */
  public createdTime?: Date;

  /** 文件SHA256哈希值 */
  public hash?: string;

  /** 文件MIME类型 */
  public mimeType?: string;

  /** 是否为文本文件 */
  public isTextFile?: boolean;

  // 文件内容相关
  /** 文件内容（需要调用loadContent加载） */
  public content?: string;

  /** 是否已加载内容 */
  public hasContent: boolean = false;

  /** 文件简介/摘要 */
  public summary?: string;

  /**
   * 创建文件上下文实例
   * @param filePath 文件的完整路径
   */
  constructor(filePath: string) {
    this.path = filePath;
    this.name = path.basename(filePath);
    this.extension = path.extname(filePath);
  }

  /**
   * 加载文件统计信息
   *
   * 异步加载文件的统计信息，包括大小、修改时间、创建时间、
   * hash值、MIME类型等。
   *
   * @example
   * ```typescript
   * const file = new FileContext('/project/src/index.ts');
   * await file.loadFileInfo();
   * console.log(`文件大小: ${file.size} 字节`);
   * console.log(`修改时间: ${file.modifiedTime}`);
   * console.log(`文件hash: ${file.hash}`);
   * ```
   */
  async loadFileInfo(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.path);

      // 基本统计信息
      this.size = stats.size;
      this.modifiedTime = stats.mtime;
      this.createdTime = stats.birthtime;

      // 计算文件hash
      this.hash = await this.calculateHash();

      // 确定MIME类型
      this.mimeType = mimeTypes.lookup(this.path) || 'application/octet-stream';

      // 检查是否为文本文件
      this.isTextFile = await this.checkIsTextFile();

    } catch (error) {
      console.warn(`无法加载文件信息 ${this.path}: ${(error as Error).message}`);
    }
  }

  /**
   * 设置父级上下文
   *
   * 建立与父级文件夹的关联关系。通常在构建文件树时自动调用。
   *
   * @param parent 父级文件夹上下文
   * @example
   * ```typescript
   * const folder = new FolderContext('/project/src');
   * const file = new FileContext('/project/src/index.ts');
   * file.setParent(folder);
   * ```
   */
  setParent(parent: Context): void {
    this.parent = parent;
  }

  /**
   * 获取文件的完整绝对路径
   *
   * @returns 文件的完整绝对路径
   * @example
   * ```typescript
   * const file = new FileContext('/project/src/index.ts');
   * console.log(file.getFullPath()); // '/project/src/index.ts'
   * ```
   */
  getFullPath(): string {
    return this.path;
  }

  /**
   * 获取相对于指定祖先上下文的相对路径
   *
   * 计算当前文件相对于指定祖先目录的相对路径，常用于显示
   * 项目内的文件路径。
   *
   * @param ancestor 祖先上下文（通常是项目根目录）
   * @returns 相对路径
   * @example
   * ```typescript
   * const root = new FolderContext('/project');
   * const file = new FileContext('/project/src/index.ts');
   * console.log(file.getRelativePath(root)); // 'src/index.ts'
   * ```
   */
  getRelativePath(ancestor: Context): string {
    return path.relative(ancestor.path, this.path);
  }

  /**
   * 加载文件内容
   *
   * 异步加载文件的文本内容。只有文本文件才会加载内容，
   * 二进制文件将跳过内容加载。
   *
   * @param encoding 文件编码，默认为'utf8'
   * @example
   * ```typescript
   * const file = new FileContext('/project/src/index.ts');
   * await file.loadContent();
   * console.log(file.content); // 文件的文本内容
   * console.log(file.hasContent); // true
   * ```
   */
  async loadContent(encoding: BufferEncoding = 'utf8'): Promise<void> {
    try {
      // 如果还没有加载文件信息，先加载
      if (this.isTextFile === undefined) {
        await this.loadFileInfo();
      }

      // 只加载文本文件的内容
      if (this.isTextFile) {
        this.content = await fs.promises.readFile(this.path, encoding);
        this.hasContent = true;
      } else {
        this.content = undefined;
        this.hasContent = false;
      }
    } catch (error) {
      console.warn(`无法加载文件内容 ${this.path}: ${(error as Error).message}`);
      this.content = undefined;
      this.hasContent = false;
    }
  }

  /**
   * 生成文件简介
   *
   * 基于文件内容和类型生成简洁的文件描述。
   *
   * @returns 文件简介字符串
   * @example
   * ```typescript
   * const file = new FileContext('/project/src/index.ts');
   * await file.loadContent();
   * const summary = file.generateSummary();
   * console.log(summary); // "TypeScript文件，包含主要的导出函数..."
   * ```
   */
  generateSummary(): string {
    if (!this.hasContent || !this.content) {
      return `${this.getFileTypeDescription()}文件，大小: ${this.size || 0} 字节`;
    }

    const lines = this.content.split('\n');
    const lineCount = lines.length;
    const charCount = this.content.length;

    let summary = `${this.getFileTypeDescription()}文件，${lineCount} 行，${charCount} 个字符`;

    // 根据文件类型添加特定信息
    if (this.extension === '.js' || this.extension === '.ts') {
      const functions = this.content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g);
      const classes = this.content.match(/class\s+\w+/g);
      if (functions) summary += `，包含 ${functions.length} 个函数`;
      if (classes) summary += `，包含 ${classes.length} 个类`;
    } else if (this.extension === '.json') {
      try {
        const json = JSON.parse(this.content);
        const keys = Object.keys(json);
        summary += `，包含 ${keys.length} 个顶级属性`;
      } catch {
        summary += '，JSON格式';
      }
    } else if (this.extension === '.md') {
      const headers = this.content.match(/^#+\s+.+$/gm);
      if (headers) summary += `，包含 ${headers.length} 个标题`;
    }

    return summary;
  }

  /**
   * 检查当前文件是否为指定上下文的后代
   *
   * 通过遍历父级链来判断当前文件是否位于指定目录下。
   *
   * @param ancestor 可能的祖先上下文
   * @returns 如果是后代则返回true，否则返回false
   * @example
   * ```typescript
   * const root = new FolderContext('/project');
   * const src = new FolderContext('/project/src');
   * const file = new FileContext('/project/src/index.ts');
   *
   * // 建立关系
   * root.addChild(src);
   * src.addChild(file);
   *
   * console.log(file.isDescendantOf(root)); // true
   * console.log(file.isDescendantOf(src));  // true
   * ```
   */
  isDescendantOf(ancestor: Context): boolean {
    let current: Context | undefined = this.parent;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 计算文件的SHA256哈希值
   *
   * @returns Promise<string> 文件的SHA256哈希值
   * @private
   */
  private async calculateHash(): Promise<string> {
    try {
      const buffer = await fs.promises.readFile(this.path);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (error) {
      console.warn(`无法计算文件hash ${this.path}: ${(error as Error).message}`);
      return '';
    }
  }

  /**
   * 检查文件是否为文本文件
   *
   * 通过读取文件的前几个字节来判断是否包含二进制内容。
   *
   * @returns Promise<boolean> 如果是文本文件返回true
   * @private
   */
  private async checkIsTextFile(): Promise<boolean> {
    try {
      // 先通过MIME类型快速判断
      if (this.mimeType) {
        if (this.mimeType.startsWith('text/') ||
            this.mimeType.includes('json') ||
            this.mimeType.includes('javascript') ||
            this.mimeType.includes('xml')) {
          return true;
        }
        if (this.mimeType.startsWith('image/') ||
            this.mimeType.startsWith('video/') ||
            this.mimeType.startsWith('audio/')) {
          return false;
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
      console.warn(`无法检查文件类型 ${this.path}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 获取文件类型描述
   *
   * 根据文件扩展名返回友好的文件类型描述。
   *
   * @returns 文件类型描述字符串
   * @private
   */
  private getFileTypeDescription(): string {
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
      '.env': '环境变量文件'
    };

    return typeMap[ext] || '未知类型';
  }
}

/**
 * 文件夹上下文类
 *
 * 表示文件系统中文件夹的上下文信息，包含子级上下文的管理功能。
 * 文件夹可以包含其他文件夹和文件，形成树形结构。
 *
 * @example
 * ```typescript
 * const folder = new FolderContext('/project/src');
 * const file = new FileContext('/project/src/index.ts');
 *
 * folder.addChild(file);
 * console.log(folder.children.length); // 1
 * console.log(folder.findChild('index.ts')); // FileContext实例
 * ```
 */
export class FolderContext implements Context {
  /** 文件夹的完整绝对路径 */
  public readonly path: string;

  /** 文件夹名称 */
  public readonly name: string;

  /** 上下文类型，固定为 'folder' */
  public readonly type: 'folder' = 'folder';

  /** 父级文件夹上下文 */
  public parent?: Context | undefined;

  /** 子级上下文列表（文件和子文件夹） */
  public readonly children: Context[] = [];

  /** 是否为项目根目录（包含sker.json文件） */
  public isProjectRoot: boolean = false;

  /** 项目配置信息（从sker.json解析得到） */
  public projectInfo?: ProjectInfo;

  /**
   * 创建文件夹上下文实例
   * @param folderPath 文件夹的完整路径
   */
  constructor(folderPath: string) {
    this.path = folderPath;
    this.name = path.basename(folderPath);
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
   * 添加子级上下文
   *
   * 将文件或子文件夹添加到当前文件夹中，同时建立双向关联关系。
   * 如果子级已存在则不会重复添加。
   *
   * @param child 要添加的子级上下文（文件或文件夹）
   * @example
   * ```typescript
   * const folder = new FolderContext('/project/src');
   * const file = new FileContext('/project/src/index.ts');
   *
   * folder.addChild(file);
   * console.log(file.parent === folder); // true
   * console.log(folder.children.includes(file)); // true
   * ```
   */
  addChild(child: Context): void {
    if (!this.children.includes(child)) {
      this.children.push(child);
      child.parent = this;
    }
  }

  /**
   * 移除子级上下文
   *
   * 从当前文件夹中移除指定的子级上下文，同时断开双向关联关系。
   *
   * @param child 要移除的子级上下文
   * @example
   * ```typescript
   * const folder = new FolderContext('/project/src');
   * const file = new FileContext('/project/src/index.ts');
   *
   * folder.addChild(file);
   * folder.removeChild(file);
   * console.log(file.parent); // undefined
   * console.log(folder.children.length); // 0
   * ```
   */
  removeChild(child: Context): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = undefined as Context | undefined;
    }
  }

  /**
   * 按名称查找子级上下文
   *
   * 在当前文件夹的直接子级中查找指定名称的上下文。
   * 只查找直接子级，不进行递归搜索。
   *
   * @param name 要查找的子级名称（文件名或文件夹名）
   * @returns 找到的子级上下文，如果不存在则返回undefined
   * @example
   * ```typescript
   * const folder = new FolderContext('/project/src');
   * const file = new FileContext('/project/src/index.ts');
   *
   * folder.addChild(file);
   * const found = folder.findChild('index.ts');
   * console.log(found === file); // true
   *
   * const notFound = folder.findChild('nonexistent.ts');
   * console.log(notFound); // undefined
   * ```
   */
  findChild(name: string): Context | undefined {
    return this.children.find(child => child.name === name);
  }

  /**
   * 获取文件夹的完整绝对路径
   *
   * @returns 文件夹的完整绝对路径
   */
  getFullPath(): string {
    return this.path;
  }

  /**
   * 获取相对于指定祖先上下文的相对路径
   *
   * @param ancestor 祖先上下文（通常是项目根目录）
   * @returns 相对路径
   */
  getRelativePath(ancestor: Context): string {
    return path.relative(ancestor.path, this.path);
  }

  /**
   * 检查当前文件夹是否为指定上下文的后代
   *
   * @param ancestor 可能的祖先上下文
   * @returns 如果是后代则返回true，否则返回false
   */
  isDescendantOf(ancestor: Context): boolean {
    let current: Context | undefined = this.parent;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 获取文件夹中的文件数量
   *
   * @returns 直接子文件的数量（不包括子文件夹）
   */
  getFileCount(): number {
    return this.children.filter(child => child.type === 'file').length;
  }

  /**
   * 获取文件夹中的子文件夹数量
   *
   * @returns 直接子文件夹的数量
   */
  getFolderCount(): number {
    return this.children.filter(child => child.type === 'folder').length;
  }

  /**
   * 检查文件夹是否为空
   *
   * @returns 如果文件夹不包含任何子项则返回true
   */
  isEmpty(): boolean {
    return this.children.length === 0;
  }

  /**
   * 获取所有子文件夹的Context（递归）
   *
   * 递归遍历当前文件夹及其所有子文件夹，返回所有文件夹类型的Context。
   * 包括直接子文件夹和间接子文件夹。
   *
   * @returns 所有子文件夹的Context数组
   * @example
   * ```typescript
   * const root = new FolderContext('/project');
   * const src = new FolderContext('/project/src');
   * const utils = new FolderContext('/project/src/utils');
   *
   * root.addChild(src);
   * src.addChild(utils);
   *
   * const subfolders = root.getAllSubfolders();
   * console.log(subfolders.length); // 2 (src, utils)
   * ```
   */
  getAllSubfolders(): FolderContext[] {
    const subfolders: FolderContext[] = [];

    for (const child of this.children) {
      if (child.type === 'folder') {
        const folderChild = child as FolderContext;
        subfolders.push(folderChild);
        // 递归获取子文件夹的子文件夹
        subfolders.push(...folderChild.getAllSubfolders());
      }
    }

    return subfolders;
  }

  /**
   * 获取所有子文件的Context（递归）
   *
   * 递归遍历当前文件夹及其所有子文件夹，返回所有文件类型的Context。
   * 包括直接子文件和间接子文件。
   *
   * @returns 所有子文件的Context数组
   * @example
   * ```typescript
   * const root = new FolderContext('/project');
   * const src = new FolderContext('/project/src');
   * const file1 = new FileContext('/project/index.ts');
   * const file2 = new FileContext('/project/src/utils.ts');
   *
   * root.addChild(src);
   * root.addChild(file1);
   * src.addChild(file2);
   *
   * const allFiles = root.getAllFiles();
   * console.log(allFiles.length); // 2 (index.ts, utils.ts)
   * ```
   */
  getAllFiles(): FileContext[] {
    const files: FileContext[] = [];

    for (const child of this.children) {
      if (child.type === 'file') {
        files.push(child as FileContext);
      } else if (child.type === 'folder') {
        // 递归获取子文件夹中的文件
        files.push(...(child as FolderContext).getAllFiles());
      }
    }

    return files;
  }

  /**
   * 获取所有后代Context（文件和文件夹，递归）
   *
   * 递归遍历当前文件夹及其所有子文件夹，返回所有后代Context。
   * 包括文件和文件夹类型的Context。
   *
   * @returns 所有后代Context数组
   * @example
   * ```typescript
   * const root = new FolderContext('/project');
   * const src = new FolderContext('/project/src');
   * const file1 = new FileContext('/project/index.ts');
   * const file2 = new FileContext('/project/src/utils.ts');
   *
   * root.addChild(src);
   * root.addChild(file1);
   * src.addChild(file2);
   *
   * const descendants = root.getAllDescendants();
   * console.log(descendants.length); // 3 (src, index.ts, utils.ts)
   * ```
   */
  getAllDescendants(): Context[] {
    const descendants: Context[] = [];

    for (const child of this.children) {
      descendants.push(child);

      if (child.type === 'folder') {
        // 递归获取子文件夹的后代
        descendants.push(...(child as FolderContext).getAllDescendants());
      }
    }

    return descendants;
  }

  /**
   * 检查当前文件夹是否为项目根目录（同步方法）
   *
   * 返回在扫描时预先标记的项目根目录状态。
   * 项目根目录用于上下文隔离，不会向上级查找。
   *
   * @returns true表示是项目根目录，false表示不是
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   * if (folder.isProjectRoot) {
   *   console.log('这是一个项目根目录');
   * }
   * ```
   */
  getIsProjectRoot(): boolean {
    return this.isProjectRoot;
  }

  /**
   * 异步检查当前文件夹是否为项目根目录（兼容性方法）
   *
   * 为了保持向后兼容性，提供异步版本的方法。
   * 如果isProjectRoot属性已设置，直接返回；否则进行文件系统检查。
   *
   * @returns Promise，解析为true表示是项目根目录，false表示不是
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   * const isProject = await folder.checkIsProjectRoot();
   * if (isProject) {
   *   console.log('这是一个项目根目录');
   * }
   * ```
   */
  async checkIsProjectRoot(): Promise<boolean> {
    // 如果已经在扫描时标记过，直接返回
    if (this.isProjectRoot !== undefined) {
      return this.isProjectRoot;
    }

    // 否则进行文件系统检查（兼容性）
    const skerJsonPath = path.join(this.path, 'sker.json');

    try {
      await fs.promises.access(skerJsonPath, fs.constants.F_OK);
      this.isProjectRoot = true;
      return true;
    } catch {
      this.isProjectRoot = false;
      return false;
    }
  }

  /**
   * 检查当前文件夹是否为多子项目工作空间（优化版本）
   *
   * 通过检查直接子文件夹中标记为项目根目录的数量来判断。
   * 多子项目工作空间中每个子项目拥有独立的上下文。
   * 这个方法不需要文件系统访问，性能更好。
   *
   * @returns Promise，解析为true表示是多子项目工作空间，false表示不是
   * @example
   * ```typescript
   * const workspace = new FolderContext('/workspace');
   * const isWorkspace = await workspace.isMultiProjectWorkspace();
   * if (isWorkspace) {
   *   console.log('这是一个多子项目工作空间');
   * }
   * ```
   */
  async isMultiProjectWorkspace(): Promise<boolean> {
    // 基于已扫描的children快速判断
    const projectRoots = this.children.filter(child =>
      child.type === 'folder' && (child as FolderContext).isProjectRoot
    );

    return projectRoots.length >= 2; // 至少2个子项目才算工作空间
  }

  /**
   * 获取所有子项目信息
   *
   * 扫描直接子文件夹，返回所有包含sker.json的子项目信息。
   * 每个子项目都有独立的上下文隔离。
   *
   * @returns Promise，解析为子项目信息数组
   * @example
   * ```typescript
   * const workspace = new FolderContext('/workspace');
   * const subProjects = await workspace.getSubProjects();
   * subProjects.forEach(project => {
   *   console.log(`子项目: ${project.name}`);
   * });
   * ```
   */
  async getSubProjects(): Promise<ProjectInfo[]> {
    const subProjects: ProjectInfo[] = [];

    try {
      const entries = await fs.promises.readdir(this.path, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(this.path, entry.name);
          const skerJsonPath = path.join(subPath, 'sker.json');

          try {
            await fs.promises.access(skerJsonPath, fs.constants.F_OK);
            const content = await fs.promises.readFile(skerJsonPath, 'utf8');
            const projectInfo: ProjectInfo = JSON.parse(content);

            // 确保项目名称存在，如果没有则使用文件夹名
            if (!projectInfo.name) {
              projectInfo.name = entry.name;
            }

            subProjects.push(projectInfo);
          } catch (error) {
            // 如果读取失败，创建基本的项目信息
            console.warn(`无法读取项目配置 ${skerJsonPath}: ${(error as Error).message}`);
            subProjects.push({
              name: entry.name
            });
          }
        }
      }
    } catch (error) {
      console.warn(`无法扫描子项目 ${this.path}: ${(error as Error).message}`);
    }

    return subProjects;
  }

  /**
   * 获取项目信息（优化版本）
   *
   * 如果当前文件夹是项目根目录，返回扫描时缓存的项目信息。
   * 如果缓存不存在，则进行文件系统读取（兼容性）。
   *
   * @returns Promise，解析为项目信息，如果不是项目根目录则返回null
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   * const projectInfo = await folder.getProjectInfo();
   * if (projectInfo) {
   *   console.log(`项目名称: ${projectInfo.name}`);
   * }
   * ```
   */
  async getProjectInfo(): Promise<ProjectInfo | null> {
    const isProject = await this.checkIsProjectRoot();
    if (!isProject) {
      return null;
    }

    // 如果已经缓存了项目信息，直接返回
    if (this.projectInfo) {
      return this.projectInfo;
    }

    return null;
  }

  /**
   * 获取文件夹总大小（递归计算所有子文件）
   *
   * 递归遍历文件夹及其所有子文件夹，计算所有文件的总大小。
   * 这个方法会访问文件系统获取每个文件的实际大小。
   *
   * @returns Promise，解析为文件夹总大小（字节）
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   * const totalSize = await folder.getTotalSize();
   * console.log(`项目总大小: ${totalSize} bytes`);
   * ```
   */
  async getTotalSize(): Promise<number> {
    let totalSize = 0;

    for (const child of this.children) {
      if (child.type === 'file') {
        try {
          const stats = await fs.promises.stat(child.path);
          totalSize += stats.size;
        } catch (error) {
          // 忽略无法访问的文件
          console.warn(`无法获取文件大小 ${child.path}: ${(error as Error).message}`);
        }
      } else if (child.type === 'folder') {
        // 递归计算子文件夹大小
        totalSize += await (child as FolderContext).getTotalSize();
      }
    }

    return totalSize;
  }

  /**
   * 获取最近更新时间（递归查找所有子文件）
   *
   * 递归遍历文件夹及其所有子文件夹，找到最近修改的文件的修改时间。
   * 这个方法会访问文件系统获取每个文件的修改时间。
   *
   * @returns Promise，解析为最近更新时间，如果没有文件则返回文件夹自身的修改时间
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   * const lastModified = await folder.getLastModified();
   * console.log(`最近更新: ${lastModified.toISOString()}`);
   * ```
   */
  async getLastModified(): Promise<Date> {
    let latestTime = new Date(0); // 初始化为最早时间

    // 检查文件夹自身的修改时间
    try {
      const folderStats = await fs.promises.stat(this.path);
      latestTime = folderStats.mtime;
    } catch (error) {
      console.warn(`无法获取文件夹修改时间 ${this.path}: ${(error as Error).message}`);
    }

    // 递归检查所有子项
    for (const child of this.children) {
      try {
        if (child.type === 'file') {
          const stats = await fs.promises.stat(child.path);
          if (stats.mtime > latestTime) {
            latestTime = stats.mtime;
          }
        } else if (child.type === 'folder') {
          // 递归获取子文件夹的最近更新时间
          const childLatest = await (child as FolderContext).getLastModified();
          if (childLatest > latestTime) {
            latestTime = childLatest;
          }
        }
      } catch (error) {
        // 忽略无法访问的文件/文件夹
        console.warn(`无法获取修改时间 ${child.path}: ${(error as Error).message}`);
      }
    }

    return latestTime;
  }

  /**
   * 通过正则表达式查找文件
   *
   * 递归搜索文件夹及其所有子文件夹，返回文件名匹配正则表达式的所有文件。
   * 只匹配文件名部分，不包括路径。
   *
   * @param pattern 正则表达式模式
   * @returns 匹配的文件Context数组
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   *
   * // 查找所有TypeScript文件
   * const tsFiles = folder.findFilesByPattern(/\.tsx?$/);
   *
   * // 查找所有配置文件
   * const configFiles = folder.findFilesByPattern(/\.(json|yaml|yml)$/);
   * ```
   */
  findFilesByPattern(pattern: RegExp): FileContext[] {
    const matchedFiles: FileContext[] = [];

    for (const child of this.children) {
      if (child.type === 'file') {
        if (pattern.test(child.name)) {
          matchedFiles.push(child as FileContext);
        }
      } else if (child.type === 'folder') {
        // 递归搜索子文件夹
        matchedFiles.push(...(child as FolderContext).findFilesByPattern(pattern));
      }
    }

    return matchedFiles;
  }

  /**
   * 通过正则表达式查找文件夹
   *
   * 递归搜索文件夹及其所有子文件夹，返回文件夹名匹配正则表达式的所有文件夹。
   * 只匹配文件夹名部分，不包括路径。
   *
   * @param pattern 正则表达式模式
   * @returns 匹配的文件夹Context数组
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   *
   * // 查找源码文件夹
   * const sourceFolders = folder.findFoldersByPattern(/^(src|lib|source)$/);
   *
   * // 查找测试文件夹
   * const testFolders = folder.findFoldersByPattern(/test|spec/);
   * ```
   */
  findFoldersByPattern(pattern: RegExp): FolderContext[] {
    const matchedFolders: FolderContext[] = [];

    for (const child of this.children) {
      if (child.type === 'folder') {
        const folderChild = child as FolderContext;
        if (pattern.test(folderChild.name)) {
          matchedFolders.push(folderChild);
        }
        // 递归搜索子文件夹
        matchedFolders.push(...folderChild.findFoldersByPattern(pattern));
      }
    }

    return matchedFolders;
  }

  /**
   * 生成文件夹简介
   *
   * 生成包含文件夹基本信息的简介，包括：
   * - 项目信息（如果是项目根目录）
   * - 文件和文件夹统计
   * - 总大小
   * - 最近更新时间
   * - 主要文件类型分布
   *
   * @returns Promise，解析为文件夹简介字符串
   * @example
   * ```typescript
   * const folder = new FolderContext('/my-project');
   * const summary = await folder.getSummary();
   * console.log(summary);
   * // 输出:
   * // 📁 my-project
   * // 📊 统计: 15 files, 3 folders
   * // 💾 大小: 2.5 KB
   * // 🕒 最近更新: 2024-01-15 10:30:45
   * ```
   */
  async getSummary(): Promise<string> {
    const lines: string[] = [];

    // 文件夹名称和项目信息
    if (this.isProjectRoot && this.projectInfo) {
      lines.push(`📁 ${this.projectInfo.name} (v${this.projectInfo.version || '1.0.0'})`);
      if (this.projectInfo.description) {
        lines.push(`📝 ${this.projectInfo.description}`);
      }
    } else {
      lines.push(`📁 ${this.name}`);
    }

    // 统计信息
    const allFiles = this.getAllFiles();
    const allFolders = this.getAllSubfolders();
    lines.push(`📊 统计: ${allFiles.length} files, ${allFolders.length} folders`);

    // 总大小
    try {
      const totalSize = await this.getTotalSize();
      lines.push(`💾 大小: ${this.formatFileSize(totalSize)}`);
    } catch (error) {
      lines.push(`💾 大小: 无法计算`);
    }

    // 最近更新时间
    try {
      const lastModified = await this.getLastModified();
      lines.push(`🕒 最近更新: ${lastModified.toLocaleString()}`);
    } catch (error) {
      lines.push(`🕒 最近更新: 未知`);
    }

    // 文件类型分布
    if (allFiles.length > 0) {
      const fileTypes = new Map<string, number>();
      for (const file of allFiles) {
        const ext = path.extname(file.name).toLowerCase();
        const type = ext || '(无扩展名)';
        fileTypes.set(type, (fileTypes.get(type) || 0) + 1);
      }

      const sortedTypes = Array.from(fileTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // 只显示前5种类型

      if (sortedTypes.length > 0) {
        lines.push(`📄 主要文件类型: ${sortedTypes.map(([type, count]) => `${type}(${count})`).join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 格式化文件大小
   *
   * 将字节数转换为人类可读的格式（B, KB, MB, GB）。
   *
   * @param bytes 字节数
   * @returns 格式化的文件大小字符串
   * @private
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }
}

/**
 * 上下文构建器选项接口
 *
 * 定义文件系统扫描时的过滤和限制选项，用于控制Context树的构建行为。
 *
 * @example
 * ```typescript
 * const options: ContextBuilderOptions = {
 *   includeExtensions: ['.ts', '.js', '.json'],
 *   excludeExtensions: ['.log', '.tmp'],
 *   maxDepth: 3,
 *   respectGitignore: true
 * };
 * ```
 */
export interface ContextBuilderOptions {
  /**
   * 包含的文件扩展名列表
   * 如果指定，则只包含这些扩展名的文件
   * @example ['.ts', '.js', '.json']
   */
  includeExtensions?: string[];

  /**
   * 排除的文件扩展名列表
   * 指定的扩展名文件将被忽略
   * @example ['.log', '.tmp', '.cache']
   */
  excludeExtensions?: string[];

  /**
   * 最大扫描深度
   * 限制目录树的扫描深度，0表示只扫描子目录
   * @default undefined（无限制）
   */
  maxDepth?: number;

  /**
   * 是否遵循.gitignore文件的忽略规则
   * 如果为true，将读取.gitignore文件并忽略匹配的文件和目录
   * @default false
   */
  respectGitignore?: boolean;

  /**
   * 自定义ignore文件路径
   * 指定要使用的ignore文件名，相对于扫描的根目录
   * @default '.gitignore'
   * @example '.dockerignore', '.eslintignore'
   */
  ignoreFile?: string;
}

/**
 * 上下文构建器类
 *
 * 负责扫描文件系统并构建Context树结构。提供灵活的过滤选项
 * 和深度控制，支持大型项目的高效扫描。
 *
 * @example
 * ```typescript
 * const builder = new ContextBuilder();
 *
 * // 基本用法
 * const rootContext = await builder.buildFromDirectory('/project');
 *
 * // 带过滤选项
 * const filteredContext = await builder.buildFromDirectory('/project', {
 *   includeExtensions: ['.ts', '.js'],
 *   maxDepth: 2
 * });
 * ```
 */
export class ContextBuilder {
  /** ignore实例，用于处理.gitignore规则 */
  private ignoreInstance: ReturnType<typeof ignore> | null = null;

  /**
   * 从指定目录构建完整的上下文树
   *
   * 扫描指定目录及其子目录，根据提供的选项过滤文件，
   * 构建完整的Context树结构。支持.gitignore文件的忽略规则。
   *
   * @param directoryPath 要扫描的根目录路径
   * @param options 构建选项，用于控制扫描行为
   * @returns Promise，解析为根文件夹的FolderContext实例
   *
   * @example
   * ```typescript
   * const builder = new ContextBuilder();
   *
   * // 扫描整个项目
   * const projectContext = await builder.buildFromDirectory('/my-project');
   * console.log(`项目包含 ${projectContext.children.length} 个直接子项`);
   *
   * // 扫描时遵循.gitignore规则
   * const cleanContext = await builder.buildFromDirectory('/my-project', {
   *   includeExtensions: ['.ts', '.tsx'],
   *   maxDepth: 3,
   *   respectGitignore: true
   * });
   * ```
   */
  async buildFromDirectory(
    directoryPath: string,
    options: ContextBuilderOptions = {}
  ): Promise<FolderContext> {
    const rootContext = new FolderContext(directoryPath);

    // 如果需要遵循gitignore规则，初始化ignore实例
    if (options.respectGitignore) {
      await this.initializeIgnore(directoryPath, options.ignoreFile || '.gitignore');
    } else {
      this.ignoreInstance = null;
    }

    await this.scanDirectory(rootContext, options, 0);
    return rootContext;
  }

  /**
   * 初始化ignore实例
   *
   * 读取指定的ignore文件（如.gitignore）并创建ignore实例用于文件过滤。
   *
   * @param rootPath 根目录路径
   * @param ignoreFileName ignore文件名
   * @private
   */
  private async initializeIgnore(rootPath: string, ignoreFileName: string): Promise<void> {
    const ignoreFilePath = path.join(rootPath, ignoreFileName);

    try {
      const ignoreContent = await fs.promises.readFile(ignoreFilePath, 'utf8');
      this.ignoreInstance = ignore().add(ignoreContent);
    } catch (error) {
      // 如果ignore文件不存在或无法读取，创建空的ignore实例
      this.ignoreInstance = ignore();
    }
  }

  /**
   * 递归扫描目录的私有方法
   *
   * 深度优先遍历目录结构，根据选项过滤文件和控制扫描深度。
   * 对于每个发现的文件和子目录，创建相应的Context实例并建立关系。
   * 支持.gitignore规则的文件过滤。
   *
   * @param folderContext 当前正在扫描的文件夹上下文
   * @param options 构建选项，包含过滤和深度限制
   * @param currentDepth 当前扫描深度（从0开始）
   * @private
   */
  private async scanDirectory(
    folderContext: FolderContext,
    options: ContextBuilderOptions,
    currentDepth: number
  ): Promise<void> {
    // 检查深度限制
    if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) {
      return;
    }

    try {
      const entries = await fs.promises.readdir(folderContext.path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderContext.path, entry.name);

        // 检查是否应该被ignore规则忽略
        if (this.shouldIgnoreByGitignore(fullPath, entry.isDirectory())) {
          continue;
        }

        if (entry.isDirectory()) {
          const subfolderContext = new FolderContext(fullPath);
          folderContext.addChild(subfolderContext);

          // 递归扫描子目录
          await this.scanDirectory(subfolderContext, options, currentDepth + 1);
        } else if (entry.isFile()) {
          // 检查是否为sker.json文件，如果是则标记父文件夹为项目根目录并读取配置
          if (entry.name === 'sker.json') {
            folderContext.isProjectRoot = true;

            // 读取并解析sker.json文件
            try {
              const skerJsonContent = await fs.promises.readFile(fullPath, 'utf8');
              const projectInfo: ProjectInfo = JSON5.parse(skerJsonContent);

              // 确保项目名称存在，如果没有则使用文件夹名
              if (!projectInfo.name) {
                projectInfo.name = folderContext.name;
              }

              folderContext.projectInfo = projectInfo;
            } catch (error) {
              // 如果解析失败，创建基本的项目信息
              // 在测试环境下不输出警告，避免测试噪音
              if (!process.env['NODE_ENV'] || process.env['NODE_ENV'] !== 'test') {
                console.warn(`无法解析项目配置 ${fullPath}: ${(error as Error).message}`);
              }
              folderContext.projectInfo = {
                name: folderContext.name
              };
            }
          }
          // 检查文件扩展名过滤
          const ext = path.extname(entry.name);

          if (this.shouldIncludeFile(ext, options)) {
            const fileContext = new FileContext(fullPath);
            folderContext.addChild(fileContext);
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
      // 在测试环境下不输出警告，避免测试噪音
      if (!process.env['NODE_ENV'] || process.env['NODE_ENV'] !== 'test') {
        console.warn(`无法扫描目录 ${folderContext.path}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 检查文件或目录是否应该被.gitignore规则忽略
   *
   * 使用ignore实例检查指定路径是否匹配ignore规则。
   *
   * @param fullPath 文件或目录的完整路径
   * @param isDirectory 是否为目录
   * @returns 如果应该被忽略则返回true，否则返回false
   * @private
   */
  private shouldIgnoreByGitignore(fullPath: string, isDirectory: boolean): boolean {
    if (!this.ignoreInstance) {
      return false; // 没有ignore实例，不忽略任何文件
    }

    // 获取相对路径用于ignore检查
    // ignore库期望使用相对路径，并且目录路径应该以/结尾
    const relativePath = path.relative(process.cwd(), fullPath);
    const normalizedPath = relativePath.replace(/\\/g, '/'); // 统一使用正斜杠

    // 对于目录，添加尾部斜杠以确保正确匹配
    const pathToCheck = isDirectory ? `${normalizedPath}/` : normalizedPath;

    return this.ignoreInstance.ignores(pathToCheck);
  }

  /**
   * 检查文件是否应该被包含在Context树中
   *
   * 根据构建选项中的扩展名过滤规则，判断指定扩展名的文件
   * 是否应该被包含。优先级：includeExtensions > excludeExtensions > 默认包含。
   *
   * @param extension 文件扩展名（包含点号，如 '.ts'）
   * @param options 构建选项，包含过滤规则
   * @returns 如果文件应该被包含则返回true，否则返回false
   *
   * @example
   * ```typescript
   * const builder = new ContextBuilder();
   *
   * // 只包含TypeScript文件
   * const options1 = { includeExtensions: ['.ts', '.tsx'] };
   * console.log(builder.shouldIncludeFile('.ts', options1));  // true
   * console.log(builder.shouldIncludeFile('.js', options1));  // false
   *
   * // 排除日志文件
   * const options2 = { excludeExtensions: ['.log', '.tmp'] };
   * console.log(builder.shouldIncludeFile('.ts', options2));  // true
   * console.log(builder.shouldIncludeFile('.log', options2)); // false
   * ```
   *
   * @private
   */
  private shouldIncludeFile(extension: string, options: ContextBuilderOptions): boolean {
    // 如果指定了包含扩展名列表，只包含列表中的扩展名
    if (options.includeExtensions && options.includeExtensions.length > 0) {
      return options.includeExtensions.includes(extension);
    }

    // 如果指定了排除扩展名列表，排除列表中的扩展名
    if (options.excludeExtensions && options.excludeExtensions.length > 0) {
      return !options.excludeExtensions.includes(extension);
    }

    // 默认情况下包含所有文件
    return true;
  }
}
