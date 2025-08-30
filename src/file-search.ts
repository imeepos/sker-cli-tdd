import * as path from 'path';
import { FolderContext, FileContext } from './context';

/**
 * 搜索结果接口
 */
export interface SearchResult {
  /** 文件上下文 */
  file: FileContext;
  /** 文件名 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 匹配得分 (0-1) */
  score?: number;
  /** 高亮信息 */
  highlights?: string[];
}

/**
 * 搜索条件接口
 */
export interface SearchCriteria {
  /** 文件名模式 */
  name?: string;
  /** 文件扩展名 */
  extension?: string;
  /** 内容模式 */
  contentPattern?: string;
  /** 文件大小范围 */
  sizeRange?: { min?: number; max?: number };
  /** 修改时间范围 */
  timeRange?: { after?: Date; before?: Date };
  /** 路径模式 */
  pathPattern?: string;
}

/**
 * 排序选项接口
 */
export interface SortOptions {
  /** 排序字段 */
  sortBy: 'name' | 'size' | 'modified' | 'score';
  /** 排序顺序 */
  order: 'asc' | 'desc';
}

/**
 * 分页选项接口
 */
export interface PaginationOptions {
  /** 页码 (从1开始) */
  page: number;
  /** 每页大小 */
  pageSize: number;
}

/**
 * 分页结果接口
 */
export interface PaginatedResults {
  /** 当前页的项目 */
  items: SearchResult[];
  /** 总项目数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 过滤选项接口
 */
export interface FilterOptions {
  /** 排除模式 */
  excludePatterns?: string[];
  /** 排除路径 */
  excludePaths?: string[];
  /** 包含模式 */
  includePatterns?: string[];
  /** 包含路径 */
  includePaths?: string[];
}

/**
 * 搜索索引接口
 */
export interface SearchIndex {
  /** 文件列表 */
  files: FileContext[];
  /** 内容索引 */
  content: Map<string, FileContext[]>;
  /** 元数据索引 */
  metadata: Map<string, any>;
  /** 构建时间 */
  buildTime: Date;
}

/**
 * 高亮选项接口
 */
export interface HighlightOptions {
  /** 高亮开始标签 */
  highlightTag: string;
  /** 高亮结束标签 */
  closeTag: string;
  /** 上下文行数 */
  contextLines?: number;
}

/**
 * 搜索统计接口
 */
export interface SearchStatistics {
  /** 总文件数 */
  totalFiles: number;
  /** 匹配文件数 */
  matchedFiles: number;
  /** 搜索耗时 (毫秒) */
  searchTime: number;
  /** 文件类型分布 */
  fileTypes: Record<string, number>;
  /** 路径分布 */
  pathDistribution: Record<string, number>;
}

/**
 * 导出选项接口
 */
export interface ExportOptions {
  /** 导出格式 */
  format: 'json' | 'csv' | 'xml';
  /** 是否包含内容 */
  includeContent?: boolean;
  /** 是否包含元数据 */
  includeMetadata?: boolean;
}

/**
 * 文件搜索引擎
 *
 * 基于FolderContext提供完整的文件搜索和过滤功能，
 * 包括名称搜索、内容搜索、模糊搜索、全文搜索等。
 *
 * @example
 * ```typescript
 * const searchEngine = new FileSearchEngine();
 * const folderContext = new FolderContext('/path/to/project');
 *
 * // 按名称搜索
 * const results = await searchEngine.searchByName(folderContext, 'index');
 *
 * // 按内容搜索
 * const contentResults = await searchEngine.searchByContent(folderContext, 'export');
 *
 * // 组合搜索
 * const combinedResults = await searchEngine.searchWithCriteria(folderContext, {
 *   name: 'test',
 *   extension: '.ts',
 *   contentPattern: 'describe'
 * });
 * ```
 */
export class FileSearchEngine {
  private searchIndex?: SearchIndex;
  private cacheEnabled: boolean = false;
  private searchCache: Map<string, SearchResult[]> = new Map();

  /**
   * 按文件名搜索文件
   *
   * @param context 文件夹上下文
   * @param namePattern 文件名模式
   * @returns Promise，解析为搜索结果数组
   */
  async searchByName(
    context: FolderContext,
    namePattern: string
  ): Promise<SearchResult[]> {
    const cacheKey = `name:${namePattern}`;
    if (this.cacheEnabled && this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      if (file.name.toLowerCase().includes(namePattern.toLowerCase())) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: this.calculateNameScore(file.name, namePattern),
        });
      }
    }

    // 按得分排序
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    if (this.cacheEnabled) {
      this.searchCache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * 按文件扩展名搜索文件
   *
   * @param context 文件夹上下文
   * @param extension 文件扩展名
   * @returns Promise，解析为搜索结果数组
   */
  async searchByExtension(
    context: FolderContext,
    extension: string
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    const normalizedExt = extension.startsWith('.')
      ? extension
      : '.' + extension;

    for (const file of allFiles) {
      if (file.extension.toLowerCase() === normalizedExt.toLowerCase()) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: 1.0,
        });
      }
    }

    return results;
  }

  /**
   * 按文件内容搜索文件
   *
   * @param context 文件夹上下文
   * @param contentPattern 内容模式
   * @returns Promise，解析为搜索结果数组
   */
  async searchByContent(
    context: FolderContext,
    contentPattern: string
  ): Promise<SearchResult[]> {
    const cacheKey = `content:${contentPattern}`;
    if (this.cacheEnabled && this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      try {
        // 只搜索文本文件
        if (file.isTextFile === false) continue;

        if (!file.hasContent) {
          await file.loadContent();
        }

        if (
          file.content &&
          file.content.toLowerCase().includes(contentPattern.toLowerCase())
        ) {
          results.push({
            file,
            name: file.name,
            path: file.path,
            score: this.calculateContentScore(file.content, contentPattern),
          });
        }
      } catch (error) {
        // 忽略无法读取的文件
      }
    }

    // 按得分排序
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    if (this.cacheEnabled) {
      this.searchCache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * 按正则表达式搜索文件名
   *
   * @param context 文件夹上下文
   * @param regex 正则表达式
   * @returns Promise，解析为搜索结果数组
   */
  async searchByRegex(
    context: FolderContext,
    regex: RegExp
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      if (regex.test(file.name)) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: 1.0,
        });
      }
    }

    return results;
  }

  /**
   * 按文件大小范围搜索文件
   *
   * @param context 文件夹上下文
   * @param sizeRange 大小范围
   * @returns Promise，解析为搜索结果数组
   */
  async searchBySize(
    context: FolderContext,
    sizeRange: { min?: number; max?: number }
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      try {
        if (!file.size) {
          await file.loadFileInfo();
        }

        const size = file.size || 0;
        const matchesMin = sizeRange.min === undefined || size >= sizeRange.min;
        const matchesMax = sizeRange.max === undefined || size <= sizeRange.max;

        if (matchesMin && matchesMax) {
          results.push({
            file,
            name: file.name,
            path: file.path,
            score: 1.0,
          });
        }
      } catch (error) {
        // 忽略无法获取大小的文件
      }
    }

    return results;
  }

  /**
   * 按修改时间搜索文件
   *
   * @param context 文件夹上下文
   * @param timeRange 时间范围
   * @returns Promise，解析为搜索结果数组
   */
  async searchByModifiedTime(
    context: FolderContext,
    timeRange: { after?: Date; before?: Date }
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      try {
        if (!file.modifiedTime) {
          await file.loadFileInfo();
        }

        if (file.modifiedTime) {
          const matchesAfter =
            timeRange.after === undefined ||
            file.modifiedTime >= timeRange.after;
          const matchesBefore =
            timeRange.before === undefined ||
            file.modifiedTime <= timeRange.before;

          if (matchesAfter && matchesBefore) {
            results.push({
              file,
              name: file.name,
              path: file.path,
              score: 1.0,
            });
          }
        }
      } catch (error) {
        // 忽略无法获取修改时间的文件
      }
    }

    return results;
  }

  /**
   * 计算名称匹配得分
   * @private
   */
  private calculateNameScore(fileName: string, pattern: string): number {
    const lowerFileName = fileName.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    // 完全匹配得分最高
    if (lowerFileName === lowerPattern) return 1.0;

    // 开头匹配得分较高
    if (lowerFileName.startsWith(lowerPattern)) return 0.8;

    // 包含匹配得分中等
    if (lowerFileName.includes(lowerPattern)) return 0.6;

    return 0.0;
  }

  /**
   * 组合搜索条件
   *
   * @param context 文件夹上下文
   * @param criteria 搜索条件
   * @returns Promise，解析为搜索结果数组
   */
  async searchWithCriteria(
    context: FolderContext,
    criteria: SearchCriteria
  ): Promise<SearchResult[]> {
    let results: SearchResult[] = context.getAllFiles().map(file => ({
      file,
      name: file.name,
      path: file.path,
      score: 1.0,
    }));

    // 按名称过滤
    if (criteria.name) {
      results = results.filter(r =>
        r.name.toLowerCase().includes(criteria.name!.toLowerCase())
      );
    }

    // 按扩展名过滤
    if (criteria.extension) {
      const ext = criteria.extension.startsWith('.')
        ? criteria.extension
        : '.' + criteria.extension;
      results = results.filter(
        r => r.file.extension.toLowerCase() === ext.toLowerCase()
      );
    }

    // 按内容过滤
    if (criteria.contentPattern) {
      const contentResults: SearchResult[] = [];
      for (const result of results) {
        try {
          if (result.file.isTextFile === false) continue;

          if (!result.file.hasContent) {
            await result.file.loadContent();
          }

          if (
            result.file.content &&
            result.file.content
              .toLowerCase()
              .includes(criteria.contentPattern.toLowerCase())
          ) {
            contentResults.push({
              ...result,
              score: this.calculateContentScore(
                result.file.content,
                criteria.contentPattern
              ),
            });
          }
        } catch (error) {
          // 忽略无法读取的文件
        }
      }
      results = contentResults;
    }

    // 按大小过滤
    if (criteria.sizeRange) {
      const sizeResults: SearchResult[] = [];
      for (const result of results) {
        try {
          if (!result.file.size) {
            await result.file.loadFileInfo();
          }

          const size = result.file.size || 0;
          const matchesMin =
            criteria.sizeRange.min === undefined ||
            size >= criteria.sizeRange.min;
          const matchesMax =
            criteria.sizeRange.max === undefined ||
            size <= criteria.sizeRange.max;

          if (matchesMin && matchesMax) {
            sizeResults.push({
              ...result,
              score: 1.0,
            });
          }
        } catch (error) {
          // 忽略无法获取大小的文件
        }
      }
      results = sizeResults;
    }

    return results;
  }

  /**
   * 模糊搜索
   *
   * @param context 文件夹上下文
   * @param query 查询字符串
   * @returns Promise，解析为搜索结果数组
   */
  async fuzzySearch(
    context: FolderContext,
    query: string
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      const score = this.calculateFuzzyScore(file.name, query);
      if (score > 0.3) {
        // 只返回得分较高的结果
        results.push({
          file,
          name: file.name,
          path: file.path,
          score,
        });
      }
    }

    // 按得分排序
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    return results;
  }

  /**
   * 全文搜索
   *
   * @param context 文件夹上下文
   * @param query 查询字符串
   * @returns Promise，解析为搜索结果数组
   */
  async fullTextSearch(
    context: FolderContext,
    query: string
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      try {
        if (file.isTextFile === false) continue;

        if (!file.hasContent) {
          await file.loadContent();
        }

        if (file.content) {
          const score = this.calculateFullTextScore(file.content, query);
          if (score > 0) {
            results.push({
              file,
              name: file.name,
              path: file.path,
              score,
            });
          }
        }
      } catch (error) {
        // 忽略无法读取的文件
      }
    }

    // 按得分排序
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    return results;
  }

  /**
   * 搜索并排序
   *
   * @param context 文件夹上下文
   * @param query 查询字符串
   * @param options 排序选项
   * @returns Promise，解析为搜索结果数组
   */
  async searchAndSort(
    context: FolderContext,
    query: string,
    options: SortOptions
  ): Promise<SearchResult[]> {
    const results = await this.searchByName(context, query);

    return this.sortResults(results, options);
  }

  /**
   * 搜索并分页
   *
   * @param context 文件夹上下文
   * @param query 查询字符串
   * @param options 分页选项
   * @returns Promise，解析为分页结果
   */
  async searchWithPagination(
    context: FolderContext,
    query: string,
    options: PaginationOptions
  ): Promise<PaginatedResults> {
    // 使用正则表达式搜索所有文件
    const allResults = await this.searchByRegex(
      context,
      new RegExp(query, 'i')
    );

    const total = allResults.length;
    const totalPages = Math.ceil(total / options.pageSize);
    const startIndex = (options.page - 1) * options.pageSize;
    const endIndex = startIndex + options.pageSize;
    const items = allResults.slice(startIndex, endIndex);

    return {
      items,
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages,
    };
  }

  /**
   * 计算模糊匹配得分
   * @private
   */
  private calculateFuzzyScore(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let score = 0;
    let queryIndex = 0;

    for (
      let i = 0;
      i < lowerText.length && queryIndex < lowerQuery.length;
      i++
    ) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        score += 1;
        queryIndex++;
      }
    }

    // 归一化得分
    return queryIndex === lowerQuery.length
      ? score / Math.max(text.length, query.length)
      : 0;
  }

  /**
   * 计算全文搜索得分
   * @private
   */
  private calculateFullTextScore(content: string, query: string): number {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const words = lowerQuery.split(/\s+/);
    let totalScore = 0;

    for (const word of words) {
      const matches = (lowerContent.match(new RegExp(word, 'g')) || []).length;
      totalScore += matches;
    }

    return (totalScore / content.length) * 1000; // 归一化
  }

  /**
   * 排序结果
   * @private
   */
  private sortResults(
    results: SearchResult[],
    options: SortOptions
  ): SearchResult[] {
    return results.sort((a, b) => {
      let comparison = 0;

      switch (options.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = (a.file.size || 0) - (b.file.size || 0);
          break;
        case 'modified':
          const aTime = a.file.modifiedTime?.getTime() || 0;
          const bTime = b.file.modifiedTime?.getTime() || 0;
          comparison = aTime - bTime;
          break;
        case 'score':
          comparison = (a.score || 0) - (b.score || 0);
          break;
      }

      return options.order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * 按文件类型过滤
   *
   * @param context 文件夹上下文
   * @param fileType 文件类型
   * @returns Promise，解析为搜索结果数组
   */
  async filterByType(
    context: FolderContext,
    fileType: string
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    const typeExtensions = this.getExtensionsByType(fileType);

    for (const file of allFiles) {
      if (typeExtensions.includes(file.extension.toLowerCase())) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: 1.0,
        });
      }
    }

    return results;
  }

  /**
   * 按目录路径过滤
   *
   * @param context 文件夹上下文
   * @param pathPattern 路径模式
   * @returns Promise，解析为搜索结果数组
   */
  async filterByPath(
    context: FolderContext,
    pathPattern: string
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      if (file.path.toLowerCase().includes(pathPattern.toLowerCase())) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: 1.0,
        });
      }
    }

    return results;
  }

  /**
   * 使用排除模式过滤
   *
   * @param context 文件夹上下文
   * @param options 过滤选项
   * @returns Promise，解析为搜索结果数组
   */
  async filterWithExclusions(
    context: FolderContext,
    options: FilterOptions
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      let shouldExclude = false;

      // 检查排除模式
      if (options.excludePatterns) {
        for (const pattern of options.excludePatterns) {
          if (this.matchesPattern(file.name, pattern)) {
            shouldExclude = true;
            break;
          }
        }
      }

      // 检查排除路径
      if (!shouldExclude && options.excludePaths) {
        for (const excludePath of options.excludePaths) {
          if (file.path.toLowerCase().includes(excludePath.toLowerCase())) {
            shouldExclude = true;
            break;
          }
        }
      }

      if (!shouldExclude) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: 1.0,
        });
      }
    }

    return results;
  }

  /**
   * 使用包含模式过滤
   *
   * @param context 文件夹上下文
   * @param options 过滤选项
   * @returns Promise，解析为搜索结果数组
   */
  async filterWithInclusions(
    context: FolderContext,
    options: FilterOptions
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      let shouldInclude = false;

      // 检查包含模式
      if (options.includePatterns) {
        for (const pattern of options.includePatterns) {
          if (this.matchesPattern(file.name, pattern)) {
            shouldInclude = true;
            break;
          }
        }
      } else {
        shouldInclude = true; // 如果没有包含模式，默认包含
      }

      // 检查包含路径
      if (shouldInclude && options.includePaths) {
        shouldInclude = false;
        for (const includePath of options.includePaths) {
          if (file.path.toLowerCase().includes(includePath.toLowerCase())) {
            shouldInclude = true;
            break;
          }
        }
      }

      if (shouldInclude) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: 1.0,
        });
      }
    }

    return results;
  }

  /**
   * 使用自定义过滤函数
   *
   * @param context 文件夹上下文
   * @param filterFn 过滤函数
   * @returns Promise，解析为搜索结果数组
   */
  async filterWithCustomFunction(
    context: FolderContext,
    filterFn: (file: FileContext) => boolean
  ): Promise<SearchResult[]> {
    const allFiles = context.getAllFiles();
    const results: SearchResult[] = [];

    for (const file of allFiles) {
      if (filterFn(file)) {
        results.push({
          file,
          name: file.name,
          path: file.path,
          score: 1.0,
        });
      }
    }

    return results;
  }

  /**
   * 根据文件类型获取扩展名
   * @private
   */
  private getExtensionsByType(fileType: string): string[] {
    const typeMap: Record<string, string[]> = {
      javascript: ['.js', '.jsx', '.ts', '.tsx'],
      python: ['.py', '.pyw', '.pyx'],
      java: ['.java', '.class', '.jar'],
      c: ['.c', '.h'],
      cpp: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx'],
      csharp: ['.cs'],
      php: ['.php', '.phtml'],
      ruby: ['.rb', '.rbw'],
      go: ['.go'],
      rust: ['.rs'],
      swift: ['.swift'],
      kotlin: ['.kt', '.kts'],
      scala: ['.scala'],
      text: ['.txt', '.md', '.rst'],
      config: ['.json', '.yaml', '.yml', '.xml', '.toml', '.ini'],
      image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'],
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
    };

    return typeMap[fileType.toLowerCase()] || [];
  }

  /**
   * 检查文件名是否匹配模式
   * @private
   */
  private matchesPattern(fileName: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(fileName);
  }

  /**
   * 构建搜索索引
   *
   * @param context 文件夹上下文
   * @returns Promise，解析为搜索索引
   */
  async buildSearchIndex(context: FolderContext): Promise<SearchIndex> {
    const allFiles = context.getAllFiles();
    const contentIndex = new Map<string, FileContext[]>();
    const metadata = new Map<string, any>();

    // 构建内容索引
    for (const file of allFiles) {
      try {
        if (file.isTextFile === false) continue;

        if (!file.hasContent) {
          await file.loadContent();
        }

        if (file.content) {
          const words = this.extractWords(file.content);
          for (const word of words) {
            if (!contentIndex.has(word)) {
              contentIndex.set(word, []);
            }
            contentIndex.get(word)!.push(file);
          }
        }
      } catch (error) {
        // 忽略无法读取的文件
      }
    }

    // 构建元数据
    metadata.set('totalFiles', allFiles.length);
    metadata.set('indexedFiles', contentIndex.size);

    this.searchIndex = {
      files: allFiles,
      content: contentIndex,
      metadata,
      buildTime: new Date(),
    };

    return this.searchIndex;
  }

  /**
   * 使用索引进行快速搜索
   *
   * @param query 查询字符串
   * @returns Promise，解析为搜索结果数组
   */
  async searchWithIndex(query: string): Promise<SearchResult[]> {
    if (!this.searchIndex) {
      throw new Error('搜索索引未构建，请先调用 buildSearchIndex');
    }

    const words = query.toLowerCase().split(/\s+/);
    const matchedFiles = new Set<FileContext>();

    for (const word of words) {
      const files = this.searchIndex.content.get(word) || [];
      for (const file of files) {
        matchedFiles.add(file);
      }
    }

    const results: SearchResult[] = [];
    for (const file of matchedFiles) {
      results.push({
        file,
        name: file.name,
        path: file.path,
        score: this.calculateIndexScore(file, words),
      });
    }

    // 按得分排序
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    return results;
  }

  /**
   * 更新搜索索引
   *
   * @param context 文件夹上下文
   * @returns Promise
   */
  async updateSearchIndex(context: FolderContext): Promise<void> {
    // 简化实现：重新构建索引
    await this.buildSearchIndex(context);
  }

  /**
   * 启用或禁用缓存
   *
   * @param enabled 是否启用缓存
   */
  enableCache(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.searchCache.clear();
    }
  }

  /**
   * 搜索并高亮结果
   *
   * @param context 文件夹上下文
   * @param query 查询字符串
   * @param options 高亮选项
   * @returns Promise，解析为搜索结果数组
   */
  async searchWithHighlight(
    context: FolderContext,
    query: string,
    options: HighlightOptions
  ): Promise<SearchResult[]> {
    const results = await this.searchByContent(context, query);

    for (const result of results) {
      if (result.file.content) {
        result.highlights = this.generateHighlights(
          result.file.content,
          query,
          options
        );
      }
    }

    return results;
  }

  /**
   * 获取搜索建议
   *
   * @param context 文件夹上下文
   * @param query 查询字符串
   * @returns Promise，解析为建议数组
   */
  async getSuggestions(
    context: FolderContext,
    query: string
  ): Promise<string[]> {
    const allFiles = context.getAllFiles();
    const suggestions = new Set<string>();

    // 基于文件名生成建议
    for (const file of allFiles) {
      const fileName = file.name.toLowerCase();
      if (fileName.includes(query.toLowerCase())) {
        suggestions.add(file.name);
      }

      // 基于模糊匹配生成建议
      if (this.calculateFuzzyScore(fileName, query) > 0.5) {
        suggestions.add(file.name);
      }
    }

    // 基于内容生成建议
    const words = await this.extractAllWords(context);
    for (const word of words) {
      if (
        word.toLowerCase().includes(query.toLowerCase()) &&
        word.length > query.length
      ) {
        suggestions.add(word);
      }
    }

    return Array.from(suggestions).slice(0, 10); // 限制建议数量
  }

  /**
   * 获取搜索统计信息
   *
   * @param context 文件夹上下文
   * @param query 查询字符串
   * @returns Promise，解析为搜索统计
   */
  async getSearchStatistics(
    context: FolderContext,
    query: string
  ): Promise<SearchStatistics> {
    const startTime = Date.now();
    const results = await this.searchByName(context, query);
    const searchTime = Date.now() - startTime;

    const allFiles = context.getAllFiles();
    const fileTypes: Record<string, number> = {};
    const pathDistribution: Record<string, number> = {};

    for (const result of results) {
      const ext = result.file.extension || '(无扩展名)';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;

      const dir = path.dirname(result.path);
      pathDistribution[dir] = (pathDistribution[dir] || 0) + 1;
    }

    return {
      totalFiles: allFiles.length,
      matchedFiles: results.length,
      searchTime,
      fileTypes,
      pathDistribution,
    };
  }

  /**
   * 导出搜索结果
   *
   * @param results 搜索结果
   * @param options 导出选项
   * @returns Promise，解析为导出字符串
   */
  async exportResults(
    results: SearchResult[],
    options: ExportOptions
  ): Promise<string> {
    switch (options.format) {
      case 'json':
        return this.exportToJson(results, options);
      case 'csv':
        return this.exportToCsv(results, options);
      case 'xml':
        return this.exportToXml(results, options);
      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }
  }

  /**
   * 提取文本中的单词
   * @private
   */
  private extractWords(content: string): string[] {
    return content.toLowerCase().match(/\b\w+\b/g) || [];
  }

  /**
   * 计算索引搜索得分
   * @private
   */
  private calculateIndexScore(file: FileContext, words: string[]): number {
    if (!file.content) return 0;

    const content = file.content.toLowerCase();
    let score = 0;

    for (const word of words) {
      const matches = (content.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    }

    return (score / content.length) * 1000;
  }

  /**
   * 生成高亮信息
   * @private
   */
  private generateHighlights(
    content: string,
    query: string,
    options: HighlightOptions
  ): string[] {
    const lines = content.split('\n');
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.toLowerCase().includes(queryLower)) {
        const highlightedLine = line.replace(
          new RegExp(query, 'gi'),
          `${options.highlightTag}$&${options.closeTag}`
        );
        highlights.push(`${i + 1}: ${highlightedLine}`);
      }
    }

    return highlights;
  }

  /**
   * 提取所有单词
   * @private
   */
  private async extractAllWords(context: FolderContext): Promise<string[]> {
    const allFiles = context.getAllFiles();
    const words = new Set<string>();

    for (const file of allFiles) {
      try {
        if (file.isTextFile === false) continue;

        if (!file.hasContent) {
          await file.loadContent();
        }

        if (file.content) {
          const fileWords = this.extractWords(file.content);
          for (const word of fileWords) {
            if (word.length > 2) {
              // 只包含长度大于2的单词
              words.add(word);
            }
          }
        }
      } catch (error) {
        // 忽略无法读取的文件
      }
    }

    return Array.from(words);
  }

  /**
   * 导出为JSON格式
   * @private
   */
  private exportToJson(
    results: SearchResult[],
    options: ExportOptions
  ): string {
    const exportData = results.map(result => ({
      name: result.name,
      path: result.path,
      score: result.score,
      ...(options.includeContent && result.file.content
        ? { content: result.file.content }
        : {}),
      ...(options.includeMetadata
        ? {
            size: result.file.size,
            extension: result.file.extension,
            modifiedTime: result.file.modifiedTime,
          }
        : {}),
    }));

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导出为CSV格式
   * @private
   */
  private exportToCsv(results: SearchResult[], options: ExportOptions): string {
    const headers = ['name', 'path', 'score'];
    if (options.includeMetadata) {
      headers.push('size', 'extension', 'modifiedTime');
    }

    const rows = [headers.join(',')];

    for (const result of results) {
      const row = [
        `"${result.name}"`,
        `"${result.path}"`,
        result.score?.toString() || '0',
      ];

      if (options.includeMetadata) {
        row.push(
          result.file.size?.toString() || '0',
          `"${result.file.extension || ''}"`,
          `"${result.file.modifiedTime?.toISOString() || ''}"`
        );
      }

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * 导出为XML格式
   * @private
   */
  private exportToXml(results: SearchResult[], options: ExportOptions): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<searchResults>\n';

    for (const result of results) {
      xml += '  <result>\n';
      xml += `    <name>${this.escapeXml(result.name)}</name>\n`;
      xml += `    <path>${this.escapeXml(result.path)}</path>\n`;
      xml += `    <score>${result.score || 0}</score>\n`;

      if (options.includeMetadata) {
        xml += `    <size>${result.file.size || 0}</size>\n`;
        xml += `    <extension>${this.escapeXml(result.file.extension || '')}</extension>\n`;
        xml += `    <modifiedTime>${result.file.modifiedTime?.toISOString() || ''}</modifiedTime>\n`;
      }

      xml += '  </result>\n';
    }

    xml += '</searchResults>';
    return xml;
  }

  /**
   * XML转义
   * @private
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 计算内容匹配得分
   * @private
   */
  private calculateContentScore(content: string, pattern: string): number {
    const lowerContent = content.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    const matches = (lowerContent.match(new RegExp(lowerPattern, 'g')) || [])
      .length;
    const contentLength = content.length;

    // 基于匹配次数和内容长度计算得分
    return Math.min(matches / (contentLength / 1000), 1.0);
  }
}
