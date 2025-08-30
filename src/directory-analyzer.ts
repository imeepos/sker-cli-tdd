import * as path from 'path';
import { FolderContext, FileContext } from './context';

/**
 * 目录结构分析结果接口
 */
export interface DirectoryStructureAnalysis {
  /** 文件总数 */
  totalFiles: number;
  /** 文件夹总数 */
  totalFolders: number;
  /** 总大小（字节） */
  totalSize: number;
  /** 最大深度 */
  maxDepth: number;
  /** 文件类型分布 */
  fileTypes: Record<string, number>;
  /** 分析时间戳 */
  timestamp: Date;
}

/**
 * 文件类型分布接口
 */
export interface FileTypeDistribution {
  [extension: string]: number;
}

/**
 * 深度分析信息接口
 */
export interface DepthAnalysis {
  /** 最大深度 */
  maxDepth: number;
  /** 平均深度 */
  avgDepth: number;
  /** 深度分布 */
  depthDistribution: Record<number, number>;
}

/**
 * 项目类型检测结果接口
 */
export interface ProjectTypeDetection {
  /** 项目类型 */
  type: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 检测指标 */
  indicators: string[];
}

/**
 * 大小分布分析接口
 */
export interface SizeDistribution {
  /** 总大小 */
  totalSize: number;
  /** 最大的文件 */
  largestFiles: Array<{ name: string; path: string; size: number }>;
  /** 最大的文件夹 */
  largestFolders: Array<{ name: string; path: string; size: number }>;
  /** 按类型分组的大小 */
  sizeByType: Record<string, number>;
}

/**
 * 树形视图选项接口
 */
export interface TreeViewOptions {
  /** 是否包含文件 */
  includeFiles?: boolean;
  /** 最大深度 */
  maxDepth?: number;
  /** 排除模式 */
  excludePatterns?: string[];
  /** 是否显示大小 */
  showSize?: boolean;
}

/**
 * 结构数据节点接口
 */
export interface StructureNode {
  /** 节点名称 */
  name: string;
  /** 节点类型 */
  type: 'file' | 'folder';
  /** 文件大小（仅文件） */
  size?: number;
  /** 子节点 */
  children?: StructureNode[];
  /** 节点路径 */
  path: string;
}

/**
 * 结构比较结果接口
 */
export interface StructureComparison {
  /** 新增的项目 */
  added: string[];
  /** 删除的项目 */
  removed: string[];
  /** 修改的项目 */
  modified: string[];
  /** 未变化的项目 */
  unchanged: string[];
}

/**
 * 优化建议接口
 */
export interface OptimizationSuggestion {
  /** 建议类型 */
  type: 'organization' | 'performance' | 'maintainability' | 'security';
  /** 建议描述 */
  description: string;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high';
  /** 影响程度 */
  impact: string;
  /** 具体位置 */
  location?: string;
}

/**
 * 结构问题接口
 */
export interface StructureIssue {
  /** 问题描述 */
  issue: string;
  /** 严重程度 */
  severity: 'info' | 'warning' | 'error';
  /** 问题位置 */
  location: string;
  /** 解决建议 */
  suggestion: string;
}

/**
 * 健康度评分接口
 */
export interface HealthScore {
  /** 总体评分 (0-100) */
  overall: number;
  /** 组织结构评分 */
  organization: number;
  /** 可维护性评分 */
  maintainability: number;
  /** 可扩展性评分 */
  scalability: number;
  /** 详细信息 */
  details: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

/**
 * 导出选项接口
 */
export interface ExportOptions {
  /** 导出格式 */
  format: 'markdown' | 'html' | 'json';
  /** 是否包含树形视图 */
  includeTreeView?: boolean;
  /** 是否包含统计信息 */
  includeStatistics?: boolean;
  /** 是否包含优化建议 */
  includeOptimizations?: boolean;
}

/**
 * 分析数据导出接口
 */
export interface AnalysisData {
  /** 结构信息 */
  structure: StructureNode;
  /** 统计信息 */
  statistics: DirectoryStructureAnalysis;
  /** 文件类型分布 */
  fileTypes: FileTypeDistribution;
  /** 项目类型 */
  projectType: ProjectTypeDetection;
  /** 健康度评分 */
  healthScore: HealthScore;
  /** 优化建议 */
  suggestions: OptimizationSuggestion[];
}

/**
 * 目录结构分析工具
 *
 * 基于FolderContext提供完整的目录结构分析功能，
 * 包括结构统计、可视化、比较、优化建议等。
 *
 * @example
 * ```typescript
 * const analyzer = new DirectoryAnalyzer();
 * const folderContext = new FolderContext('/path/to/project');
 *
 * // 分析目录结构
 * const analysis = await analyzer.analyzeStructure(folderContext);
 *
 * // 生成树形视图
 * const treeView = await analyzer.generateTreeView(folderContext);
 *
 * // 检测项目类型
 * const projectType = await analyzer.detectProjectType(folderContext);
 *
 * // 生成优化建议
 * const suggestions = await analyzer.analyzeOptimizations(folderContext);
 * ```
 */
export class DirectoryAnalyzer {
  /**
   * 分析目录的基本结构信息
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为结构分析结果
   */
  async analyzeStructure(
    context: FolderContext
  ): Promise<DirectoryStructureAnalysis> {
    const allFiles = context.getAllFiles();
    const allFolders = context.getAllSubfolders();

    // 计算总大小
    let totalSize = 0;
    try {
      totalSize = await context.getTotalSize();
    } catch (error) {
      console.warn(`无法计算总大小: ${(error as Error).message}`);
    }

    // 分析文件类型
    const fileTypes = await this.analyzeFileTypes(context);

    // 计算最大深度
    const maxDepth = this.calculateMaxDepth(context);

    return {
      totalFiles: allFiles.length,
      totalFolders: allFolders.length,
      totalSize,
      maxDepth,
      fileTypes,
      timestamp: new Date(),
    };
  }

  /**
   * 分析文件类型分布
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为文件类型分布
   */
  async analyzeFileTypes(
    context: FolderContext
  ): Promise<FileTypeDistribution> {
    const allFiles = context.getAllFiles();
    const distribution: FileTypeDistribution = {};

    for (const file of allFiles) {
      const ext = path.extname(file.name).toLowerCase() || '(无扩展名)';
      distribution[ext] = (distribution[ext] || 0) + 1;
    }

    return distribution;
  }

  /**
   * 分析目录深度信息
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为深度分析信息
   */
  async analyzeDepth(context: FolderContext): Promise<DepthAnalysis> {
    const depthDistribution: Record<number, number> = {};
    let totalDepth = 0;
    let nodeCount = 0;

    const analyzeNode = (node: FolderContext, currentDepth: number) => {
      depthDistribution[currentDepth] =
        (depthDistribution[currentDepth] || 0) + 1;
      totalDepth += currentDepth;
      nodeCount++;

      for (const child of node.children) {
        if (child.type === 'folder') {
          analyzeNode(child as FolderContext, currentDepth + 1);
        }
      }
    };

    analyzeNode(context, 0);

    const maxDepth = Math.max(...Object.keys(depthDistribution).map(Number));
    const avgDepth = nodeCount > 0 ? totalDepth / nodeCount : 0;

    return {
      maxDepth,
      avgDepth,
      depthDistribution,
    };
  }

  /**
   * 检测项目类型
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为项目类型检测结果
   */
  async detectProjectType(
    context: FolderContext
  ): Promise<ProjectTypeDetection> {
    const indicators: string[] = [];
    let confidence = 0;
    let type = 'unknown';

    // 检查关键文件
    const hasPackageJson = context.findChild('package.json') !== undefined;
    const hasPyProjectToml = context.findChild('pyproject.toml') !== undefined;
    const hasCargoToml = context.findChild('Cargo.toml') !== undefined;
    const hasGemfile = context.findChild('Gemfile') !== undefined;
    const hasComposerJson = context.findChild('composer.json') !== undefined;
    const hasPomXml = context.findChild('pom.xml') !== undefined;

    if (hasPackageJson) {
      type = 'nodejs';
      confidence += 0.8;
      indicators.push('package.json');
    }

    if (hasPyProjectToml) {
      type = 'python';
      confidence += 0.8;
      indicators.push('pyproject.toml');
    }

    if (hasCargoToml) {
      type = 'rust';
      confidence += 0.8;
      indicators.push('Cargo.toml');
    }

    if (hasGemfile) {
      type = 'ruby';
      confidence += 0.8;
      indicators.push('Gemfile');
    }

    if (hasComposerJson) {
      type = 'php';
      confidence += 0.8;
      indicators.push('composer.json');
    }

    if (hasPomXml) {
      type = 'java';
      confidence += 0.8;
      indicators.push('pom.xml');
    }

    // 检查文件扩展名
    const fileTypes = await this.analyzeFileTypes(context);

    if (fileTypes['.ts'] || fileTypes['.js']) {
      if (type === 'unknown') type = 'javascript';
      confidence += 0.3;
      indicators.push('TypeScript/JavaScript files');
    }

    if (fileTypes['.py']) {
      if (type === 'unknown') type = 'python';
      confidence += 0.3;
      indicators.push('Python files');
    }

    if (fileTypes['.rs']) {
      if (type === 'unknown') type = 'rust';
      confidence += 0.3;
      indicators.push('Rust files');
    }

    return {
      type,
      confidence: Math.min(confidence, 1.0),
      indicators,
    };
  }

  /**
   * 分析目录大小分布
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为大小分布分析
   */
  async analyzeSizeDistribution(
    context: FolderContext
  ): Promise<SizeDistribution> {
    const allFiles = context.getAllFiles();
    const allFolders = context.getAllSubfolders();

    // 计算文件大小
    const fileSizes: Array<{ name: string; path: string; size: number }> = [];
    for (const file of allFiles) {
      try {
        // 确保文件信息已加载
        if (!file.size) {
          await file.loadFileInfo();
        }
        fileSizes.push({
          name: file.name,
          path: file.path,
          size: file.size || 0,
        });
      } catch (error) {
        // 忽略无法访问的文件
      }
    }

    // 计算文件夹大小
    const folderSizes: Array<{ name: string; path: string; size: number }> = [];
    for (const folder of allFolders) {
      try {
        const size = await folder.getTotalSize();
        folderSizes.push({
          name: folder.name,
          path: folder.path,
          size,
        });
      } catch (error) {
        // 忽略无法访问的文件夹
      }
    }

    // 按类型分组大小
    const sizeByType: Record<string, number> = {};

    for (const file of fileSizes) {
      const ext = path.extname(file.name).toLowerCase() || '(无扩展名)';
      sizeByType[ext] = (sizeByType[ext] || 0) + file.size;
    }

    // 排序并取前10
    const largestFiles = fileSizes.sort((a, b) => b.size - a.size).slice(0, 10);

    const largestFolders = folderSizes
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    const totalSize = fileSizes.reduce((sum, file) => sum + file.size, 0);

    return {
      totalSize,
      largestFiles,
      largestFolders,
      sizeByType,
    };
  }

  /**
   * 生成树形结构文本
   *
   * @param context 文件夹上下文
   * @param options 树形视图选项
   * @returns Promise，解析为树形结构字符串
   */
  async generateTreeView(
    context: FolderContext,
    options: TreeViewOptions = {}
  ): Promise<string> {
    const {
      includeFiles = true,
      maxDepth = Infinity,
      excludePatterns = [],
      showSize = false,
    } = options;

    const lines: string[] = [];

    const generateNode = async (
      node: FolderContext,
      prefix: string = '',
      isLast: boolean = true,
      currentDepth: number = 0
    ) => {
      if (currentDepth > maxDepth) return;

      // 检查是否应该排除
      if (excludePatterns.some(pattern => node.name.includes(pattern))) {
        return;
      }

      const connector = isLast ? '└── ' : '├── ';
      let line = prefix + connector + node.name;

      if (showSize) {
        try {
          const size = await node.getTotalSize();
          line += ` (${this.formatFileSize(size)})`;
        } catch (error) {
          // 忽略大小计算错误
        }
      }

      lines.push(line);

      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      const children = node.children.filter(child => {
        if (!includeFiles && child.type === 'file') return false;
        if (excludePatterns.some(pattern => child.name.includes(pattern)))
          return false;
        return true;
      });

      for (let i = 0; i < children.length; i++) {
        const child = children[i]!;
        const isChildLast = i === children.length - 1;

        if (child.type === 'folder') {
          await generateNode(
            child as FolderContext,
            newPrefix,
            isChildLast,
            currentDepth + 1
          );
        } else if (includeFiles) {
          const childConnector = isChildLast ? '└── ' : '├── ';
          let childLine = newPrefix + childConnector + child.name;

          if (showSize) {
            try {
              const fileChild = child as FileContext;
              if (!fileChild.size) {
                await fileChild.loadFileInfo();
              }
              childLine += ` (${this.formatFileSize(fileChild.size || 0)})`;
            } catch (error) {
              // 忽略文件大小错误
            }
          }

          lines.push(childLine);
        }
      }
    };

    await generateNode(context);
    return lines.join('\n');
  }

  /**
   * 生成JSON格式的结构数据
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为结构数据
   */
  async generateStructureData(context: FolderContext): Promise<StructureNode> {
    const generateNode = async (
      node: FolderContext | FileContext
    ): Promise<StructureNode> => {
      const structureNode: StructureNode = {
        name: node.name,
        type: node.type,
        path: node.path,
      };

      if (node.type === 'file') {
        try {
          const fileNode = node as FileContext;
          if (!fileNode.size) {
            await fileNode.loadFileInfo();
          }
          structureNode.size = fileNode.size || 0;
        } catch (error) {
          // 忽略文件大小错误
        }
      } else {
        const folderNode = node as FolderContext;
        structureNode.children = [];

        for (const child of folderNode.children) {
          const childNode = await generateNode(
            child as FolderContext | FileContext
          );
          structureNode.children.push(childNode);
        }
      }

      return structureNode;
    };

    return generateNode(context);
  }

  /**
   * 生成Mermaid图表代码
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为Mermaid代码
   */
  async generateMermaidDiagram(context: FolderContext): Promise<string> {
    const lines: string[] = ['graph TD'];
    const nodeIds = new Map<string, string>();
    let nodeCounter = 0;

    const getNodeId = (path: string): string => {
      if (!nodeIds.has(path)) {
        nodeIds.set(path, `node${nodeCounter++}`);
      }
      return nodeIds.get(path)!;
    };

    const generateNode = (node: FolderContext | FileContext) => {
      const nodeId = getNodeId(node.path);

      if (node.type === 'folder') {
        lines.push(`    ${nodeId}[${node.name}]`);
        lines.push(`    ${nodeId} --> ${nodeId}_folder{Folder}`);

        const folderNode = node as FolderContext;
        for (const child of folderNode.children) {
          generateNode(child as FolderContext | FileContext);
          const childId = getNodeId(child.path);
          lines.push(`    ${nodeId} --> ${childId}`);
        }
      } else {
        lines.push(`    ${nodeId}(${node.name})`);
      }
    };

    generateNode(context);
    return lines.join('\n');
  }

  /**
   * 生成HTML格式的交互式目录树
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为HTML字符串
   */
  async generateInteractiveTree(context: FolderContext): Promise<string> {
    const structureData = await this.generateStructureData(context);

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>目录结构 - ${context.name}</title>
    <style>
        body { font-family: 'Courier New', monospace; margin: 20px; }
        .tree { list-style: none; padding-left: 0; }
        .tree li { margin: 2px 0; }
        .tree .folder { cursor: pointer; color: #0066cc; }
        .tree .file { color: #666; }
        .tree .toggle { margin-right: 5px; }
        .tree .collapsed { display: none; }
    </style>
</head>
<body>
    <h1>目录结构: ${context.name}</h1>
    <div id="tree-container"></div>

    <script>
        const data = ${JSON.stringify(structureData, null, 2)};

        function createTreeElement(node, level = 0) {
            const li = document.createElement('li');
            li.style.paddingLeft = (level * 20) + 'px';

            if (node.type === 'folder') {
                const span = document.createElement('span');
                span.className = 'folder';
                span.innerHTML = '📁 ' + node.name;
                span.onclick = () => toggleFolder(li);
                li.appendChild(span);

                if (node.children && node.children.length > 0) {
                    const ul = document.createElement('ul');
                    ul.className = 'tree';

                    node.children.forEach(child => {
                        ul.appendChild(createTreeElement(child, level + 1));
                    });

                    li.appendChild(ul);
                }
            } else {
                const span = document.createElement('span');
                span.className = 'file';
                span.innerHTML = '📄 ' + node.name;
                if (node.size) {
                    span.innerHTML += ' (' + formatFileSize(node.size) + ')';
                }
                li.appendChild(span);
            }

            return li;
        }

        function toggleFolder(li) {
            const ul = li.querySelector('ul');
            if (ul) {
                ul.classList.toggle('collapsed');
            }
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        const container = document.getElementById('tree-container');
        const ul = document.createElement('ul');
        ul.className = 'tree';
        ul.appendChild(createTreeElement(data));
        container.appendChild(ul);
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * 格式化文件大小
   * @private
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * 比较两个目录结构的差异
   *
   * @param context1 第一个目录上下文
   * @param context2 第二个目录上下文
   * @returns Promise，解析为结构比较结果
   */
  async compareStructures(
    context1: FolderContext,
    context2: FolderContext
  ): Promise<StructureComparison> {
    const getAllPaths = (context: FolderContext): Set<string> => {
      const paths = new Set<string>();

      const traverse = (node: FolderContext | FileContext) => {
        paths.add(node.path);
        if (node.type === 'folder') {
          const folderNode = node as FolderContext;
          for (const child of folderNode.children) {
            traverse(child as FolderContext | FileContext);
          }
        }
      };

      traverse(context);
      return paths;
    };

    const paths1 = getAllPaths(context1);
    const paths2 = getAllPaths(context2);

    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];
    const modified: string[] = []; // 简化实现，暂时为空

    // 找出新增的路径
    for (const path of paths2) {
      if (!paths1.has(path)) {
        added.push(path);
      }
    }

    // 找出删除的路径
    for (const path of paths1) {
      if (!paths2.has(path)) {
        removed.push(path);
      }
    }

    // 找出未变化的路径
    for (const path of paths1) {
      if (paths2.has(path)) {
        unchanged.push(path);
      }
    }

    return { added, removed, modified, unchanged };
  }

  /**
   * 生成结构变化报告
   *
   * @param oldContext 旧的目录上下文
   * @param newContext 新的目录上下文
   * @returns Promise，解析为变化报告字符串
   */
  async generateChangeReport(
    oldContext: FolderContext,
    newContext: FolderContext
  ): Promise<string> {
    const comparison = await this.compareStructures(oldContext, newContext);
    const lines: string[] = [];

    lines.push('# 结构变化报告');
    lines.push('');
    lines.push(`生成时间: ${new Date().toLocaleString()}`);
    lines.push('');

    if (comparison.added.length > 0) {
      lines.push('## 新增文件/文件夹');
      for (const item of comparison.added) {
        lines.push(`+ ${item}`);
      }
      lines.push('');
    }

    if (comparison.removed.length > 0) {
      lines.push('## 删除文件/文件夹');
      for (const item of comparison.removed) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (comparison.modified.length > 0) {
      lines.push('## 修改文件/文件夹');
      for (const item of comparison.modified) {
        lines.push(`~ ${item}`);
      }
      lines.push('');
    }

    lines.push('## 统计信息');
    lines.push(`- 新增: ${comparison.added.length} 项`);
    lines.push(`- 删除: ${comparison.removed.length} 项`);
    lines.push(`- 修改: ${comparison.modified.length} 项`);
    lines.push(`- 未变化: ${comparison.unchanged.length} 项`);

    return lines.join('\n');
  }

  /**
   * 分析并提供结构优化建议
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为优化建议数组
   */
  async analyzeOptimizations(
    context: FolderContext
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const analysis = await this.analyzeStructure(context);

    // 检查深度过深
    if (analysis.maxDepth > 8) {
      suggestions.push({
        type: 'organization',
        description: '目录层级过深，建议重新组织文件结构',
        priority: 'medium',
        impact: '提高代码可读性和维护性',
        location: '整个项目',
      });
    }

    // 检查文件数量过多
    if (analysis.totalFiles > 1000) {
      suggestions.push({
        type: 'organization',
        description: '文件数量过多，建议按功能模块分组',
        priority: 'high',
        impact: '提高项目管理效率',
        location: '根目录',
      });
    }

    // 检查是否有node_modules在版本控制中
    const nodeModules = context.findChild('node_modules');
    if (nodeModules) {
      suggestions.push({
        type: 'performance',
        description: 'node_modules目录应该被排除在版本控制之外',
        priority: 'high',
        impact: '减少仓库大小，提高克隆速度',
        location: 'node_modules',
      });
    }

    return suggestions;
  }

  /**
   * 检测常见的结构问题
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为结构问题数组
   */
  async detectStructureIssues(
    context: FolderContext
  ): Promise<StructureIssue[]> {
    const issues: StructureIssue[] = [];

    // 检查空文件夹
    const checkEmptyFolders = (folder: FolderContext) => {
      if (folder.children.length === 0) {
        issues.push({
          issue: '空文件夹',
          severity: 'info',
          location: folder.path,
          suggestion: '考虑删除空文件夹或添加README文件说明用途',
        });
      }

      for (const child of folder.children) {
        if (child.type === 'folder') {
          checkEmptyFolders(child as FolderContext);
        }
      }
    };

    checkEmptyFolders(context);

    // 检查命名规范
    const allFiles = context.getAllFiles();
    for (const file of allFiles) {
      if (file.name.includes(' ')) {
        issues.push({
          issue: '文件名包含空格',
          severity: 'warning',
          location: file.path,
          suggestion: '使用下划线或连字符替代空格',
        });
      }
    }

    return issues;
  }

  /**
   * 生成结构健康度评分
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为健康度评分
   */
  async calculateHealthScore(context: FolderContext): Promise<HealthScore> {
    const analysis = await this.analyzeStructure(context);
    const issues = await this.detectStructureIssues(context);

    let organizationScore = 100;
    let maintainabilityScore = 100;
    let scalabilityScore = 100;

    // 根据深度调整分数
    if (analysis.maxDepth > 8) {
      organizationScore -= 20;
      maintainabilityScore -= 15;
    }

    // 根据问题数量调整分数
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    organizationScore -= errorCount * 10 + warningCount * 5;
    maintainabilityScore -= errorCount * 15 + warningCount * 8;
    scalabilityScore -= errorCount * 12 + warningCount * 6;

    // 确保分数不低于0
    organizationScore = Math.max(0, organizationScore);
    maintainabilityScore = Math.max(0, maintainabilityScore);
    scalabilityScore = Math.max(0, scalabilityScore);

    const overall = Math.round(
      (organizationScore + maintainabilityScore + scalabilityScore) / 3
    );

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    if (analysis.maxDepth <= 5) {
      strengths.push('目录层级合理');
    } else {
      weaknesses.push('目录层级过深');
      recommendations.push('重新组织文件结构，减少嵌套层级');
    }

    if (issues.length === 0) {
      strengths.push('无明显结构问题');
    } else {
      weaknesses.push(`发现 ${issues.length} 个结构问题`);
      recommendations.push('修复检测到的结构问题');
    }

    return {
      overall,
      organization: organizationScore,
      maintainability: maintainabilityScore,
      scalability: scalabilityScore,
      details: {
        strengths,
        weaknesses,
        recommendations,
      },
    };
  }

  /**
   * 导出完整的分析报告
   *
   * @param context 文件夹上下文
   * @param options 导出选项
   * @returns Promise，解析为报告字符串
   */
  async exportAnalysisReport(
    context: FolderContext,
    options: ExportOptions
  ): Promise<string> {
    const { format, includeTreeView, includeStatistics, includeOptimizations } =
      options;

    if (format !== 'markdown') {
      throw new Error('目前只支持 markdown 格式');
    }

    const lines: string[] = [];

    lines.push('# 目录结构分析报告');
    lines.push('');
    lines.push(`项目: ${context.name}`);
    lines.push(`生成时间: ${new Date().toLocaleString()}`);
    lines.push('');

    if (includeStatistics) {
      const analysis = await this.analyzeStructure(context);
      lines.push('## 基本统计');
      lines.push(`- 文件总数: ${analysis.totalFiles}`);
      lines.push(`- 文件夹总数: ${analysis.totalFolders}`);
      lines.push(`- 总大小: ${this.formatFileSize(analysis.totalSize)}`);
      lines.push(`- 最大深度: ${analysis.maxDepth}`);
      lines.push('');
    }

    if (includeTreeView) {
      const treeView = await this.generateTreeView(context, { maxDepth: 3 });
      lines.push('## 目录树');
      lines.push('```');
      lines.push(treeView);
      lines.push('```');
      lines.push('');
    }

    if (includeOptimizations) {
      const suggestions = await this.analyzeOptimizations(context);
      lines.push('## 优化建议');
      for (const suggestion of suggestions) {
        lines.push(`### ${suggestion.type} - ${suggestion.priority}`);
        lines.push(suggestion.description);
        lines.push(`**影响**: ${suggestion.impact}`);
        if (suggestion.location) {
          lines.push(`**位置**: ${suggestion.location}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 导出JSON格式的分析数据
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为分析数据
   */
  async exportAnalysisData(context: FolderContext): Promise<AnalysisData> {
    const [
      structure,
      statistics,
      fileTypes,
      projectType,
      healthScore,
      suggestions,
    ] = await Promise.all([
      this.generateStructureData(context),
      this.analyzeStructure(context),
      this.analyzeFileTypes(context),
      this.detectProjectType(context),
      this.calculateHealthScore(context),
      this.analyzeOptimizations(context),
    ]);

    return {
      structure,
      statistics,
      fileTypes,
      projectType,
      healthScore,
      suggestions,
    };
  }

  /**
   * 计算最大深度
   * @private
   */
  private calculateMaxDepth(
    context: FolderContext,
    currentDepth: number = 0
  ): number {
    let maxDepth = currentDepth;

    for (const child of context.children) {
      if (child.type === 'folder') {
        const childDepth = this.calculateMaxDepth(
          child as FolderContext,
          currentDepth + 1
        );
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }

    return maxDepth;
  }
}
