/**
 * 🟢 TDD 绿阶段：MCP 工作空间功能实现
 * 遵循 TDD 原则：编写刚好让测试通过的最简代码
 * 负责 MCP 服务器的工作空间管理功能
 */

import { MCPTool, MCPResource } from './mcp-server';
import { MCPPrompt } from './mcp-prompts';

/**
 * 工作空间创建参数
 */
export interface MCPWorkspaceCreateOptions {
  /** 工作空间 ID */
  id: string;
  /** 工作空间名称 */
  name: string;
  /** 工作空间描述（可选） */
  description?: string;
}

/**
 * MCP 工作空间接口
 * 定义工作空间的基本结构和属性
 */
export interface MCPWorkspace {
  /** 工作空间唯一标识符 */
  id: string;
  /** 工作空间名称 */
  name: string;
  /** 工作空间描述 */
  description?: string;
  /** 是否为全局工作空间 */
  isGlobal: boolean;
  /** 工作空间内的工具列表 */
  tools: MCPTool[];
  /** 工作空间内的资源列表 */
  resources: MCPResource[];
  /** 工作空间内的提示词列表 */
  prompts: MCPPrompt[];
  /** 创建时间 */
  createdAt?: Date;
  /** 最后修改时间 */
  updatedAt?: Date;
}

/**
 * MCP 工作空间管理器
 * 负责工作空间的创建、管理和资源分配
 */
export class MCPWorkspaceManager {
  private readonly workspaces: Map<string, MCPWorkspace> = new Map();

  constructor() {
    // 创建默认的全局工作空间
    this.createGlobalWorkspace();
  }

  /**
   * 创建全局工作空间
   * 全局工作空间包含所有工作空间共享的资源
   */
  private createGlobalWorkspace(): void {
    const globalWorkspace: MCPWorkspace = {
      id: 'global',
      name: '全局工作空间',
      description: '所有工作空间共享的全局资源',
      isGlobal: true,
      tools: [],
      resources: [],
      prompts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workspaces.set('global', globalWorkspace);
  }

  /**
   * 获取全局工作空间
   * @returns 全局工作空间实例
   */
  getGlobalWorkspace(): MCPWorkspace {
    return this.workspaces.get('global')!;
  }

  /**
   * 创建新的工作空间
   * @param options 工作空间创建选项
   * @returns 创建的工作空间实例
   * @throws Error 如果同 ID 的工作空间已存在
   */
  createWorkspace(options: MCPWorkspaceCreateOptions): MCPWorkspace {
    if (this.workspaces.has(options.id)) {
      throw new Error(`工作空间 "${options.id}" 已存在`);
    }

    const workspace: MCPWorkspace = {
      id: options.id,
      name: options.name,
      isGlobal: false,
      tools: [],
      resources: [],
      prompts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.description) {
      workspace.description = options.description;
    }

    this.workspaces.set(options.id, workspace);
    return workspace;
  }

  /**
   * 获取所有工作空间
   * @returns 所有工作空间的数组
   */
  getAllWorkspaces(): MCPWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * 按 ID 获取工作空间
   * @param id 工作空间 ID
   * @returns 找到的工作空间，如果不存在则返回 undefined
   */
  getWorkspace(id: string): MCPWorkspace | undefined {
    return this.workspaces.get(id);
  }

  /**
   * 删除工作空间
   * @param id 要删除的工作空间 ID
   * @returns 是否成功删除
   * @throws Error 如果尝试删除全局工作空间
   */
  deleteWorkspace(id: string): boolean {
    if (id === 'global') {
      throw new Error('不能删除全局工作空间');
    }

    return this.workspaces.delete(id);
  }

  /**
   * 向工作空间添加工具
   * @param workspaceId 工作空间 ID
   * @param tool 要添加的工具
   * @throws Error 如果工作空间不存在
   */
  addToolToWorkspace(workspaceId: string, tool: MCPTool): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`工作空间 "${workspaceId}" 不存在`);
    }

    workspace.tools.push(tool);
    workspace.updatedAt = new Date();
  }

  /**
   * 向工作空间添加资源
   * @param workspaceId 工作空间 ID
   * @param resource 要添加的资源
   * @throws Error 如果工作空间不存在
   */
  addResourceToWorkspace(workspaceId: string, resource: MCPResource): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`工作空间 "${workspaceId}" 不存在`);
    }

    workspace.resources.push(resource);
    workspace.updatedAt = new Date();
  }

  /**
   * 向工作空间添加提示词
   * @param workspaceId 工作空间 ID
   * @param prompt 要添加的提示词
   * @throws Error 如果工作空间不存在
   */
  addPromptToWorkspace(workspaceId: string, prompt: MCPPrompt): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`工作空间 "${workspaceId}" 不存在`);
    }

    workspace.prompts.push(prompt);
    workspace.updatedAt = new Date();
  }

  /**
   * 从工作空间移除工具
   * @param workspaceId 工作空间 ID
   * @param toolName 要移除的工具名称
   * @throws Error 如果工作空间不存在
   */
  removeToolFromWorkspace(workspaceId: string, toolName: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`工作空间 "${workspaceId}" 不存在`);
    }

    const index = workspace.tools.findIndex(tool => tool.name === toolName);
    if (index !== -1) {
      workspace.tools.splice(index, 1);
      workspace.updatedAt = new Date();
    }
  }

  /**
   * 从工作空间移除资源
   * @param workspaceId 工作空间 ID
   * @param resourceUri 要移除的资源 URI
   * @throws Error 如果工作空间不存在
   */
  removeResourceFromWorkspace(workspaceId: string, resourceUri: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`工作空间 "${workspaceId}" 不存在`);
    }

    const index = workspace.resources.findIndex(
      resource => resource.uri === resourceUri
    );
    if (index !== -1) {
      workspace.resources.splice(index, 1);
      workspace.updatedAt = new Date();
    }
  }

  /**
   * 从工作空间移除提示词
   * @param workspaceId 工作空间 ID
   * @param promptName 要移除的提示词名称
   * @throws Error 如果工作空间不存在
   */
  removePromptFromWorkspace(workspaceId: string, promptName: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`工作空间 "${workspaceId}" 不存在`);
    }

    const index = workspace.prompts.findIndex(
      prompt => prompt.name === promptName
    );
    if (index !== -1) {
      workspace.prompts.splice(index, 1);
      workspace.updatedAt = new Date();
    }
  }

  /**
   * 获取合并后的工具列表（全局 + 指定工作空间）
   * @param workspaceId 工作空间 ID，如果不提供则只返回全局工具
   * @returns 合并后的工具列表
   */
  getMergedTools(workspaceId?: string): MCPTool[] {
    const globalTools = this.getGlobalWorkspace().tools;

    if (!workspaceId || workspaceId === 'global') {
      return [...globalTools];
    }

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [...globalTools];
    }

    return [...globalTools, ...workspace.tools];
  }

  /**
   * 获取合并后的资源列表（全局 + 指定工作空间）
   * @param workspaceId 工作空间 ID，如果不提供则只返回全局资源
   * @returns 合并后的资源列表
   */
  getMergedResources(workspaceId?: string): MCPResource[] {
    const globalResources = this.getGlobalWorkspace().resources;

    if (!workspaceId || workspaceId === 'global') {
      return [...globalResources];
    }

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [...globalResources];
    }

    return [...globalResources, ...workspace.resources];
  }

  /**
   * 获取合并后的提示词列表（全局 + 指定工作空间）
   * @param workspaceId 工作空间 ID，如果不提供则只返回全局提示词
   * @returns 合并后的提示词列表
   */
  getMergedPrompts(workspaceId?: string): MCPPrompt[] {
    const globalPrompts = this.getGlobalWorkspace().prompts;

    if (!workspaceId || workspaceId === 'global') {
      return [...globalPrompts];
    }

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [...globalPrompts];
    }

    return [...globalPrompts, ...workspace.prompts];
  }
}
