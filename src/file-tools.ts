/**
 * � TDD 重构阶段：文件工具提供者优化实现
 * 在保持测试通过的前提下改进代码质量
 *
 * 提供完整的文件操作、搜索和权限管理工具集合，
 * 集成现有的文件管理组件，遵循单一职责原则。
 */

import { MCPTool } from './mcp-server';
import { ToolProvider } from './tool-manager';
import { FileOperationsManager } from './file-operations';
import { FileSearchEngine } from './file-search';
import { FilePermissionsManager } from './file-permissions';
import { FileContext, ContextBuilder } from './context';

/**
 * 文件工具提供者
 * 负责创建和管理文件相关的 MCP 工具
 * 遵循单一职责原则，与 MCP 服务器解耦
 */
export class FileToolsProvider implements ToolProvider {
  private readonly fileOperations: FileOperationsManager;
  private readonly fileSearch: FileSearchEngine;
  private readonly filePermissions: FilePermissionsManager;

  constructor() {
    this.fileOperations = new FileOperationsManager();
    this.fileSearch = new FileSearchEngine();
    this.filePermissions = new FilePermissionsManager();
  }

  /**
   * 获取所有文件工具
   * @returns 所有文件工具的数组
   */
  getTools(): MCPTool[] {
    return [
      this.getReadFileTool(),
      this.getWriteFileTool(),
      this.getCreateFileTool(),
      this.getDeleteFileTool(),
      this.getCopyFileTool(),
      this.getMoveFileTool(),
      this.getSearchFilesTool(),
      this.getSearchContentTool(),
      this.getCheckPermissionsTool(),
      this.getSetPermissionsTool(),
    ];
  }

  /**
   * 获取文件读取工具
   */
  private getReadFileTool(): MCPTool {
    return {
      name: 'read_file',
      description: '读取文件内容',
      handler: async (params: { path: string; encoding?: BufferEncoding }) => {
        try {
          const fileContext = new FileContext(params.path);
          const content = await this.fileOperations.readFile(
            fileContext,
            params.encoding
          );
          return {
            success: true,
            content,
            path: params.path,
          };
        } catch (error) {
          return {
            success: false,
            error: `无法读取文件 ${params.path}: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          encoding: { type: 'string', description: '编码格式，默认为utf8' },
        },
        required: ['path'],
      },
    };
  }

  /**
   * 获取文件写入工具
   */
  private getWriteFileTool(): MCPTool {
    return {
      name: 'write_file',
      description: '写入文件内容',
      handler: async (params: {
        path: string;
        content: string;
        encoding?: BufferEncoding;
      }) => {
        try {
          const fileContext = new FileContext(params.path);
          await this.fileOperations.writeFile(
            fileContext,
            params.content,
            params.encoding
          );
          return {
            success: true,
            path: params.path,
            message: '文件写入成功',
          };
        } catch (error) {
          return {
            success: false,
            error: `无法写入文件 ${params.path}: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '文件内容' },
          encoding: { type: 'string', description: '编码格式，默认为utf8' },
        },
        required: ['path', 'content'],
      },
    };
  }

  /**
   * 获取文件创建工具
   */
  private getCreateFileTool(): MCPTool {
    return {
      name: 'create_file',
      description: '创建新文件',
      handler: async (params: {
        path: string;
        content?: string;
        encoding?: BufferEncoding;
      }) => {
        try {
          const fileContext = await this.fileOperations.createFile(
            params.path,
            params.content || '',
            params.encoding
          );
          return {
            success: true,
            path: fileContext.path,
            message: '文件创建成功',
          };
        } catch (error) {
          return {
            success: false,
            error: `无法创建文件 ${params.path}: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '文件内容，默认为空' },
          encoding: { type: 'string', description: '编码格式，默认为utf8' },
        },
        required: ['path'],
      },
    };
  }

  /**
   * 获取文件删除工具
   */
  private getDeleteFileTool(): MCPTool {
    return {
      name: 'delete_file',
      description: '删除文件',
      handler: async (params: { path: string }) => {
        try {
          const fileContext = new FileContext(params.path);
          await this.fileOperations.deleteFile(fileContext);
          return {
            success: true,
            path: params.path,
            message: '文件删除成功',
          };
        } catch (error) {
          return {
            success: false,
            error: `无法删除文件 ${params.path}: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
        },
        required: ['path'],
      },
    };
  }

  /**
   * 获取文件复制工具
   */
  private getCopyFileTool(): MCPTool {
    return {
      name: 'copy_file',
      description: '复制文件',
      handler: async (params: { sourcePath: string; destPath: string }) => {
        try {
          const sourceContext = new FileContext(params.sourcePath);
          const destContext = await this.fileOperations.copyFile(
            sourceContext,
            params.destPath
          );
          return {
            success: true,
            sourcePath: params.sourcePath,
            destPath: destContext.path,
            message: '文件复制成功',
          };
        } catch (error) {
          return {
            success: false,
            error: `无法复制文件 ${params.sourcePath} 到 ${params.destPath}: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件路径' },
          destPath: { type: 'string', description: '目标文件路径' },
        },
        required: ['sourcePath', 'destPath'],
      },
    };
  }

  /**
   * 获取文件移动工具
   */
  private getMoveFileTool(): MCPTool {
    return {
      name: 'move_file',
      description: '移动文件',
      handler: async (params: { sourcePath: string; destPath: string }) => {
        try {
          const sourceContext = new FileContext(params.sourcePath);
          const destContext = await this.fileOperations.moveFile(
            sourceContext,
            params.destPath
          );
          return {
            success: true,
            sourcePath: params.sourcePath,
            destPath: destContext.path,
            message: '文件移动成功',
          };
        } catch (error) {
          return {
            success: false,
            error: `无法移动文件 ${params.sourcePath} 到 ${params.destPath}: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: '源文件路径' },
          destPath: { type: 'string', description: '目标文件路径' },
        },
        required: ['sourcePath', 'destPath'],
      },
    };
  }

  /**
   * 获取文件搜索工具
   */
  private getSearchFilesTool(): MCPTool {
    return {
      name: 'search_files',
      description: '按文件名搜索文件',
      handler: async (params: { directory: string; pattern: string }) => {
        try {
          const builder = new ContextBuilder();
          const folderContext = await builder.buildFromDirectory(
            params.directory
          );
          const results = await this.fileSearch.searchByName(
            folderContext,
            params.pattern
          );
          return {
            success: true,
            files: results.map(result => ({
              name: result.name,
              path: result.path,
              score: result.score,
            })),
            directory: params.directory,
            pattern: params.pattern,
          };
        } catch (error) {
          return {
            success: false,
            error: `搜索文件失败: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: '搜索目录' },
          pattern: { type: 'string', description: '文件名模式' },
        },
        required: ['directory', 'pattern'],
      },
    };
  }

  /**
   * 获取内容搜索工具
   */
  private getSearchContentTool(): MCPTool {
    return {
      name: 'search_content',
      description: '在文件内容中搜索',
      handler: async (params: { directory: string; query: string }) => {
        try {
          const builder = new ContextBuilder();
          const folderContext = await builder.buildFromDirectory(
            params.directory
          );
          const results = await this.fileSearch.searchByContent(
            folderContext,
            params.query
          );
          return {
            success: true,
            matches: results.map(result => ({
              name: result.name,
              path: result.path,
              score: result.score,
            })),
            directory: params.directory,
            query: params.query,
          };
        } catch (error) {
          return {
            success: false,
            error: `搜索内容失败: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: '搜索目录' },
          query: { type: 'string', description: '搜索查询' },
        },
        required: ['directory', 'query'],
      },
    };
  }

  /**
   * 获取权限检查工具
   */
  private getCheckPermissionsTool(): MCPTool {
    return {
      name: 'check_permissions',
      description: '检查文件权限',
      handler: async (params: { path: string }) => {
        try {
          const fileContext = new FileContext(params.path);
          const permissions =
            await this.filePermissions.getPermissions(fileContext);
          return {
            success: true,
            path: params.path,
            permissions: {
              readable: permissions.readable,
              writable: permissions.writable,
              executable: permissions.executable,
              mode: permissions.mode,
              owner: permissions.owner,
              group: permissions.group,
              size: permissions.size,
              mtime: permissions.mtime,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `检查权限失败: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
        },
        required: ['path'],
      },
    };
  }

  /**
   * 获取权限设置工具
   */
  private getSetPermissionsTool(): MCPTool {
    return {
      name: 'set_permissions',
      description: '设置文件权限',
      handler: async (params: { path: string; mode: number }) => {
        try {
          const fileContext = new FileContext(params.path);
          await this.filePermissions.setMode(fileContext, params.mode);
          return {
            success: true,
            path: params.path,
            mode: params.mode,
            message: '权限设置成功',
          };
        } catch (error) {
          return {
            success: false,
            error: `设置权限失败: ${(error as Error).message}`,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          mode: { type: 'number', description: '权限模式（八进制）' },
        },
        required: ['path', 'mode'],
      },
    };
  }
}
