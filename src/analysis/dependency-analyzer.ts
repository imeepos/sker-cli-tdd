/**
 * 🟢 TDD 绿阶段：依赖关系分析实现
 * 实现import/require语句解析、文件依赖图构建、循环依赖检测
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 依赖分析器配置接口
 */
export interface DependencyAnalyzerConfig {
  /** 支持的文件扩展名 */
  extensions?: string[];
  /** 忽略的文件模式 */
  ignorePatterns?: string[];
  /** 是否排除外部依赖 */
  excludeExternal?: boolean;
  /** 最大分析深度 */
  maxDepth?: number;
}

/**
 * 解析选项接口
 */
export interface ParseOptions {
  /** 是否排除外部依赖 */
  excludeExternal?: boolean;
}

/**
 * 依赖节点接口
 */
export interface DependencyNode {
  /** 文件路径 */
  path: string;
  /** 直接依赖列表 */
  dependencies: string[];
  /** 反向依赖列表 */
  dependents: string[];
  /** 文件大小 */
  size: number;
  /** 最后修改时间 */
  lastModified: Date;
}

/**
 * 循环依赖接口
 */
export interface CyclicDependency {
  /** 循环依赖链 */
  cycle: string[];
  /** 严重性级别 */
  severity: 'warning' | 'error';
  /** 描述 */
  description: string;
}

/**
 * 依赖图统计信息接口
 */
export interface DependencyGraphStats {
  /** 总节点数 */
  totalNodes: number;
  /** 总边数 */
  totalEdges: number;
  /** 最大深度 */
  maxDepth: number;
  /** 平均依赖数 */
  averageDependencies: number;
  /** 孤立节点数 */
  isolatedNodes: number;
}

/**
 * 分析结果接口
 */
export interface AnalysisResult {
  /** 分析是否成功 */
  success: boolean;
  /** 依赖图 */
  graph: DependencyGraph;
  /** 所有节点 */
  nodes: Map<string, DependencyNode>;
  /** 循环依赖列表 */
  cyclicDependencies: CyclicDependency[];
  /** 错误列表 */
  errors: string[];
  /** 分析耗时 */
  analysisTime: number;
}

/**
 * 依赖图类
 * 
 * 提供依赖关系的存储、查询和分析功能
 */
export class DependencyGraph {
  /** 邻接表 - 存储依赖关系 */
  private adjacencyList: Map<string, Set<string>> = new Map();
  
  /** 反向邻接表 - 存储反向依赖关系 */
  private reverseAdjacencyList: Map<string, Set<string>> = new Map();
  
  /** 节点信息 */
  private nodes: Map<string, DependencyNode> = new Map();

  /**
   * 添加节点
   */
  addNode(filePath: string, node: DependencyNode): void {
    this.nodes.set(filePath, node);
    
    if (!this.adjacencyList.has(filePath)) {
      this.adjacencyList.set(filePath, new Set());
    }
    if (!this.reverseAdjacencyList.has(filePath)) {
      this.reverseAdjacencyList.set(filePath, new Set());
    }
  }

  /**
   * 添加依赖关系
   */
  addDependency(from: string, to: string): void {
    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, new Set());
    }
    if (!this.reverseAdjacencyList.has(to)) {
      this.reverseAdjacencyList.set(to, new Set());
    }

    this.adjacencyList.get(from)!.add(to);
    this.reverseAdjacencyList.get(to)!.add(from);
  }

  /**
   * 检查节点是否存在
   */
  hasNode(filePath: string): boolean {
    return this.nodes.has(filePath);
  }

  /**
   * 获取节点的直接依赖
   */
  getDependencies(filePath: string): string[] {
    const deps = this.adjacencyList.get(filePath);
    return deps ? Array.from(deps) : [];
  }

  /**
   * 获取节点的反向依赖（依赖于该节点的文件）
   */
  getDependents(filePath: string): string[] {
    const dependents = this.reverseAdjacencyList.get(filePath);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * 获取节点的传递依赖（递归依赖）
   */
  getTransitiveDependencies(filePath: string): string[] {
    const visited = new Set<string>();
    const result = new Set<string>();

    const dfs = (current: string) => {
      if (visited.has(current)) return;
      visited.add(current);

      const deps = this.getDependencies(current);
      for (const dep of deps) {
        result.add(dep);
        dfs(dep);
      }
    };

    dfs(filePath);
    return Array.from(result);
  }

  /**
   * 获取受影响的文件（当该文件变更时需要重新处理的文件）
   */
  getAffectedFiles(filePath: string): string[] {
    const visited = new Set<string>();
    const result = new Set<string>();

    const dfs = (current: string) => {
      if (visited.has(current)) return;
      visited.add(current);

      const dependents = this.getDependents(current);
      for (const dependent of dependents) {
        result.add(dependent);
        dfs(dependent);
      }
    };

    dfs(filePath);
    return Array.from(result);
  }

  /**
   * 获取两个文件之间的依赖深度
   */
  getDependencyDepth(from: string, to: string): number {
    if (from === to) return 0;

    const visited = new Set<string>();
    const queue: Array<{ node: string; depth: number }> = [{ node: from, depth: 0 }];

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      
      if (visited.has(node)) continue;
      visited.add(node);

      const deps = this.getDependencies(node);
      for (const dep of deps) {
        if (dep === to) {
          return depth + 1;
        }
        if (!visited.has(dep)) {
          queue.push({ node: dep, depth: depth + 1 });
        }
      }
    }

    return -1; // 不存在依赖关系
  }

  /**
   * 检查是否存在依赖关系
   */
  isDependentOn(from: string, to: string): boolean {
    return this.getDependencyDepth(from, to) > 0;
  }

  /**
   * 检测循环依赖
   */
  detectCycles(): CyclicDependency[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const cycles: CyclicDependency[] = [];

    const dfs = (node: string, path: string[]): void => {
      if (visiting.has(node)) {
        // 发现循环
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart); // 不包含重复的节点
        
        cycles.push({
          cycle,
          severity: 'warning',
          description: `检测到循环依赖: ${cycle.join(' -> ')}`
        });
        return;
      }

      if (visited.has(node)) return;

      visiting.add(node);
      const newPath = [...path, node];

      const deps = this.getDependencies(node);
      for (const dep of deps) {
        dfs(dep, newPath);
      }

      visiting.delete(node);
      visited.add(node);
    };

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * 获取统计信息
   */
  getStats(): DependencyGraphStats {
    let totalEdges = 0;
    let maxDepthFromAnyNode = 0;
    let isolatedNodes = 0;

    for (const [node, deps] of this.adjacencyList) {
      totalEdges += deps.size;
      
      // 检查是否为孤立节点
      const dependents = this.reverseAdjacencyList.get(node) || new Set();
      if (deps.size === 0 && dependents.size === 0) {
        isolatedNodes++;
      }

      // 计算从该节点出发的最大深度
      const visited = new Set<string>();
      const getMaxDepth = (current: string, depth: number): number => {
        if (visited.has(current)) return depth;
        visited.add(current);

        const currentDeps = this.getDependencies(current);
        let maxDepth = depth;
        
        for (const dep of currentDeps) {
          const depDepth = getMaxDepth(dep, depth + 1);
          maxDepth = Math.max(maxDepth, depDepth);
        }
        
        return maxDepth;
      };

      const nodeMaxDepth = getMaxDepth(node, 0);
      maxDepthFromAnyNode = Math.max(maxDepthFromAnyNode, nodeMaxDepth);
    }

    const totalNodes = this.nodes.size;
    const averageDependencies = totalNodes > 0 ? totalEdges / totalNodes : 0;

    return {
      totalNodes,
      totalEdges,
      maxDepth: maxDepthFromAnyNode,
      averageDependencies,
      isolatedNodes
    };
  }

  /**
   * 导出为DOT格式（用于可视化）
   */
  toDOT(): string {
    const lines = ['digraph DependencyGraph {'];
    
    // 添加节点
    for (const [node] of this.nodes) {
      const label = path.basename(node);
      lines.push(`  "${label}";`);
    }
    
    // 添加边
    for (const [from, deps] of this.adjacencyList) {
      const fromLabel = path.basename(from);
      for (const to of deps) {
        const toLabel = path.basename(to);
        lines.push(`  "${fromLabel}" -> "${toLabel}";`);
      }
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  /**
   * 获取所有节点
   */
  getNodes(): Map<string, DependencyNode> {
    return new Map(this.nodes);
  }
}

/**
 * 依赖关系分析器类
 * 
 * 负责解析代码文件中的依赖关系，构建依赖图，检测循环依赖
 */
export class DependencyAnalyzer {
  /** 分析器配置 */
  private config: Required<DependencyAnalyzerConfig>;

  /**
   * 构造函数
   */
  constructor(config: DependencyAnalyzerConfig = {}) {
    this.config = {
      extensions: config.extensions || ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
      ignorePatterns: config.ignorePatterns || [
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**'
      ],
      excludeExternal: config.excludeExternal || true,
      maxDepth: config.maxDepth || 50
    };
  }

  /**
   * 解析ES6 import语句
   */
  parseImports(code: string, options: ParseOptions = {}): string[] {
    const imports = new Set<string>();
    
    // 匹配各种import语句
    const importRegexes = [
      /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g,  // 普通import
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,                   // 动态import
      /import\s+type\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g, // type import
    ];

    for (const regex of importRegexes) {
      let match;
      while ((match = regex.exec(code)) !== null) {
        const modulePath = match[1];
        if (modulePath && this.shouldIncludeDependency(modulePath, options)) {
          imports.add(modulePath);
        }
      }
    }

    return Array.from(imports);
  }

  /**
   * 解析CommonJS require语句
   */
  parseRequires(code: string, options: ParseOptions = {}): string[] {
    const requires = new Set<string>();
    
    // 匹配require语句
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    let match;
    while ((match = requireRegex.exec(code)) !== null) {
      const modulePath = match[1];
      if (modulePath && this.shouldIncludeDependency(modulePath, options)) {
        requires.add(modulePath);
      }
    }

    return Array.from(requires);
  }

  /**
   * 解析动态import语句
   */
  parseDynamicImports(code: string, options: ParseOptions = {}): string[] {
    const imports = new Set<string>();
    
    // 匹配动态import
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    let match;
    while ((match = dynamicImportRegex.exec(code)) !== null) {
      const modulePath = match[1];
      if (modulePath && this.shouldIncludeDependency(modulePath, options)) {
        imports.add(modulePath);
      }
    }

    return Array.from(imports);
  }

  /**
   * 解析文件中的所有依赖
   */
  private parseAllDependencies(code: string, options: ParseOptions = {}): string[] {
    const allDeps = new Set<string>();
    
    // 合并所有类型的依赖
    const imports = this.parseImports(code, options);
    const requires = this.parseRequires(code, options);
    const dynamicImports = this.parseDynamicImports(code, options);
    
    for (const dep of [...imports, ...requires, ...dynamicImports]) {
      allDeps.add(dep);
    }
    
    return Array.from(allDeps);
  }

  /**
   * 判断是否应该包含该依赖
   */
  private shouldIncludeDependency(modulePath: string, options: ParseOptions = {}): boolean {
    // 排除外部依赖
    const excludeExternal = options.excludeExternal ?? false; // 默认不排除，让调用者决定
    if (excludeExternal && this.isExternalModule(modulePath)) {
      return false;
    }
    
    return true;
  }

  /**
   * 判断是否为外部模块
   */
  private isExternalModule(modulePath: string): boolean {
    // 相对路径和绝对路径被认为是内部模块
    if (modulePath.startsWith('./') || modulePath.startsWith('../') || modulePath.startsWith('/')) {
      return false;
    }
    
    // Node.js内置模块
    const builtinModules = [
      'fs', 'path', 'os', 'crypto', 'util', 'url', 'querystring',
      'http', 'https', 'net', 'stream', 'events', 'buffer', 'zlib'
    ];
    
    if (builtinModules.includes(modulePath)) {
      return true;
    }
    
    // 其他不以.或/开头的被认为是npm包
    return true;
  }

  /**
   * 解析单个文件的依赖
   */
  private async parseFileDependencies(filePath: string): Promise<string[]> {
    try {
      const code = await fs.promises.readFile(filePath, 'utf8');
      const dependencies = this.parseAllDependencies(code, { excludeExternal: true });
      
      // 解析相对路径为绝对路径
      const resolvedDeps: string[] = [];
      const fileDir = path.dirname(filePath);
      
      for (const dep of dependencies) {
        try {
          const resolvedPath = this.resolveModulePath(dep, fileDir);
          if (resolvedPath && await this.fileExists(resolvedPath)) {
            resolvedDeps.push(resolvedPath);
          }
        } catch (error) {
          // 跳过无法解析的依赖
          continue;
        }
      }
      
      return resolvedDeps;
    } catch (error) {
      throw new Error(`解析文件 ${filePath} 失败: ${(error as Error).message}`);
    }
  }

  /**
   * 解析模块路径
   */
  private resolveModulePath(modulePath: string, baseDir: string): string | null {
    if (!modulePath.startsWith('./') && !modulePath.startsWith('../')) {
      return null; // 非相对路径
    }

    let resolvedPath = path.resolve(baseDir, modulePath);
    
    // 如果没有扩展名，尝试添加支持的扩展名
    if (!path.extname(resolvedPath)) {
      for (const ext of this.config.extensions) {
        const pathWithExt = resolvedPath + ext;
        if (fs.existsSync(pathWithExt)) {
          return pathWithExt;
        }
      }
      
      // 尝试index文件
      for (const ext of this.config.extensions) {
        const indexPath = path.join(resolvedPath, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }
    
    return resolvedPath;
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查文件是否应该被分析
   */
  private shouldAnalyzeFile(filePath: string): boolean {
    // 检查文件扩展名
    const ext = path.extname(filePath);
    if (!this.config.extensions.includes(ext)) {
      return false;
    }

    // 检查忽略模式
    const relativePath = path.relative(process.cwd(), filePath);
    for (const pattern of this.config.ignorePatterns) {
      const regex = this.patternToRegex(pattern);
      if (regex.test(relativePath)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 将glob模式转换为正则表达式
   */
  private patternToRegex(pattern: string): RegExp {
    let regex = pattern
      .replace(/\*\*/g, '.*')      // ** 匹配任意路径
      .replace(/\*/g, '[^/]*')     // * 匹配单层路径
      .replace(/\./g, '\\.')       // 转义点
      .replace(/\?/g, '.');        // ? 匹配单个字符
    
    return new RegExp(regex);
  }

  /**
   * 获取项目中的所有文件
   */
  private async getProjectFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && this.shouldAnalyzeFile(fullPath)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // 跳过无法访问的目录
      }
    };

    await scanDirectory(projectPath);
    return files;
  }

  /**
   * 分析项目依赖关系
   */
  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const graph = new DependencyGraph();
    const nodes = new Map<string, DependencyNode>();

    try {
      // 检查项目路径是否存在
      try {
        await fs.promises.access(projectPath, fs.constants.F_OK);
      } catch (error) {
        return {
          success: false,
          graph,
          nodes,
          cyclicDependencies: [],
          errors: [`项目路径不存在: ${projectPath}`],
          analysisTime: Date.now() - startTime
        };
      }

      // 获取所有文件
      const files = await this.getProjectFiles(projectPath);
      
      // 解析每个文件的依赖
      for (const file of files) {
        try {
          const dependencies = await this.parseFileDependencies(file);
          const stats = await fs.promises.stat(file);
          
          const node: DependencyNode = {
            path: file,
            dependencies,
            dependents: [],
            size: stats.size,
            lastModified: stats.mtime
          };
          
          nodes.set(file, node);
          graph.addNode(file, node);
          
          // 添加依赖关系到图中
          for (const dep of dependencies) {
            graph.addDependency(file, dep);
          }
        } catch (error) {
          const errorMsg = `解析文件 ${file} 失败: ${(error as Error).message}`;
          errors.push(errorMsg);
          
          // 即使文件解析失败，也要添加一个基本节点以便统计
          try {
            const stats = await fs.promises.stat(file);
            const node: DependencyNode = {
              path: file,
              dependencies: [],
              dependents: [],
              size: stats.size,
              lastModified: stats.mtime
            };
            nodes.set(file, node);
            graph.addNode(file, node);
          } catch (statError) {
            // 如果连文件状态都获取不了，则跳过
          }
        }
      }

      // 更新反向依赖信息
      for (const [filePath, node] of nodes) {
        const dependents = graph.getDependents(filePath);
        node.dependents = dependents;
      }

      // 检测循环依赖
      const cyclicDependencies = graph.detectCycles();

      const analysisTime = Date.now() - startTime;

      return {
        success: true,
        graph,
        nodes,
        cyclicDependencies,
        errors,
        analysisTime
      };
    } catch (error) {
      return {
        success: false,
        graph,
        nodes,
        cyclicDependencies: [],
        errors: [error instanceof Error ? error.message : String(error)],
        analysisTime: Date.now() - startTime
      };
    }
  }

  /**
   * 增量更新单个文件的依赖
   */
  async updateFile(filePath: string, graph: DependencyGraph): Promise<AnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      if (!this.shouldAnalyzeFile(filePath)) {
        return {
          success: false,
          graph,
          nodes: graph.getNodes(),
          cyclicDependencies: [],
          errors: ['文件不符合分析条件'],
          analysisTime: Date.now() - startTime
        };
      }

      const dependencies = await this.parseFileDependencies(filePath);
      const stats = await fs.promises.stat(filePath);
      
      const node: DependencyNode = {
        path: filePath,
        dependencies,
        dependents: graph.getDependents(filePath), // 保持现有的反向依赖
        size: stats.size,
        lastModified: stats.mtime
      };

      graph.addNode(filePath, node);
      
      // 重新添加依赖关系
      for (const dep of dependencies) {
        graph.addDependency(filePath, dep);
      }

      const analysisTime = Date.now() - startTime;

      return {
        success: true,
        graph,
        nodes: graph.getNodes(),
        cyclicDependencies: graph.detectCycles(),
        errors,
        analysisTime
      };
    } catch (error) {
      return {
        success: false,
        graph,
        nodes: graph.getNodes(),
        cyclicDependencies: [],
        errors: [error instanceof Error ? error.message : String(error)],
        analysisTime: Date.now() - startTime
      };
    }
  }
}