/**
 * 🔄 TDD 重构阶段：增强的 MCP 服务器实现
 * 遵循 TDD 原则：在保持测试通过的前提下改进代码质量
 *
 * sker-ai 的模型上下文协议 (MCP) 服务器实现
 * 提供工具和资源管理功能
 */

/**
 * 可由服务器执行的 MCP 工具接口
 */
export interface MCPTool {
  /** 工具的唯一标识符 */
  name: string;
  /** 工具功能的可读描述 */
  description: string;
  /** 处理工具执行的函数 */
  handler: (params: any) => Promise<any>;
  /** 工具参数的可选模式 */
  schema?: Record<string, any>;
}

/**
 * 可由服务器访问的 MCP 资源接口
 */
export interface MCPResource {
  /** 资源的唯一 URI 标识符 */
  uri: string;
  /** 资源的可读名称 */
  name: string;
  /** 资源内容的 MIME 类型 */
  mimeType: string;
  /** 资源的可选描述 */
  description?: string;
}

import { MCPPromptManager, MCPPrompt } from './mcp-prompts';
import { MCPWorkspaceManager, MCPWorkspace } from './mcp-workspace';

/**
 * 遵循 TDD 原则的 MCP 服务器实现
 * 管理 AI 模型交互的工具、资源、提示词和工作空间
 * 遵循单一职责原则：只负责协议层管理，不包含具体业务逻辑
 */
export class MCPServer {
  private readonly name: string = 'sker-ai-mcp-server';
  private readonly version: string = '1.0.0';
  private running: boolean = false;
  private readonly tools: Map<string, MCPTool> = new Map();
  private readonly resources: Map<string, MCPResource> = new Map();
  private promptManager: MCPPromptManager | undefined;
  private workspaceManager: MCPWorkspaceManager | undefined;
  private currentWorkspaceId: string = 'global';

  /**
   * 获取服务器名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 获取服务器版本
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * 启动服务器
   */
  async start(): Promise<boolean> {
    this.running = true;
    return true;
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<boolean> {
    this.running = false;
    return true;
  }

  /**
   * 检查服务器是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 向服务器注册工具
   * @param tool 要注册的工具
   * @throws Error 如果同名工具已存在则抛出错误
   */
  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具 "${tool.name}" 已注册`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取所有已注册的工具（包括工作空间工具）
   * @returns 所有已注册工具的数组（全局工具 + 当前工作空间工具）
   */
  getTools(): MCPTool[] {
    // 如果有工作空间管理器，返回合并后的工具列表
    if (this.workspaceManager) {
      const mergedTools = this.workspaceManager.getMergedTools(this.currentWorkspaceId);
      // 同时包含服务器直接注册的工具（向后兼容）
      const serverTools = Array.from(this.tools.values());
      return [...serverTools, ...mergedTools];
    }

    // 向后兼容：没有工作空间管理器时返回服务器工具
    return Array.from(this.tools.values());
  }

  /**
   * 按名称执行工具（包括工作空间工具）
   * @param name 要执行的工具名称
   * @param params 传递给工具的参数
   * @returns 工具执行的结果
   * @throws Error 如果工具未找到则抛出错误
   */
  async executeTool(name: string, params: any): Promise<any> {
    // 首先在服务器直接注册的工具中查找（向后兼容）
    let tool = this.tools.get(name);

    // 如果没找到且有工作空间管理器，在合并的工具列表中查找
    if (!tool && this.workspaceManager) {
      const mergedTools = this.workspaceManager.getMergedTools(this.currentWorkspaceId);
      tool = mergedTools.find(t => t.name === name);
    }

    if (!tool) {
      throw new Error(`工具 "${name}" 未找到`);
    }

    return await tool.handler(params);
  }

  /**
   * 向服务器注册资源
   * @param resource 要注册的资源
   * @throws Error 如果同 URI 资源已存在则抛出错误
   */
  registerResource(resource: MCPResource): void {
    if (this.resources.has(resource.uri)) {
      throw new Error(`资源 "${resource.uri}" 已注册`);
    }
    this.resources.set(resource.uri, resource);
  }

  /**
   * 获取所有已注册的资源
   * @returns 所有已注册资源的数组
   */
  getResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * 按 URI 读取资源
   * @param uri 要读取的资源 URI
   * @returns 资源内容和元数据
   * @throws Error 如果资源未找到则抛出错误
   */
  async readResource(uri: string): Promise<{ content: string; mimeType: string }> {
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`资源 "${uri}" 未找到`);
    }
    // 最小实现 - 返回空内容
    return { content: '', mimeType: resource.mimeType };
  }

  /**
   * 设置 Prompt 管理器
   * @param promptManager Prompt 管理器实例
   */
  setPromptManager(promptManager: MCPPromptManager): void {
    this.promptManager = promptManager;
  }

  /**
   * 获取 Prompt 管理器
   * @returns Prompt 管理器实例
   * @throws Error 如果 Prompt 管理器未设置
   */
  getPromptManager(): MCPPromptManager {
    if (!this.promptManager) {
      throw new Error('Prompt 管理器未设置');
    }
    return this.promptManager;
  }

  /**
   * 获取所有已注册的提示词
   * @returns 所有提示词的数组
   * @throws Error 如果 Prompt 管理器未设置
   */
  getPrompts(): MCPPrompt[] {
    if (!this.promptManager) {
      throw new Error('Prompt 管理器未设置');
    }
    return this.promptManager.getPrompts();
  }

  /**
   * 渲染提示词
   * @param name 提示词名称
   * @param args 渲染参数
   * @returns 渲染后的文本
   * @throws Error 如果 Prompt 管理器未设置或提示词不存在
   */
  async renderPrompt(name: string, args: Record<string, any>): Promise<string> {
    if (!this.promptManager) {
      throw new Error('Prompt 管理器未设置');
    }
    return await this.promptManager.renderPrompt(name, args);
  }

  /**
   * 设置工作空间管理器
   * @param workspaceManager 工作空间管理器实例
   */
  setWorkspaceManager(workspaceManager: MCPWorkspaceManager): void {
    this.workspaceManager = workspaceManager;
  }

  /**
   * 获取工作空间管理器
   * @returns 工作空间管理器实例
   * @throws Error 如果工作空间管理器未设置
   */
  getWorkspaceManager(): MCPWorkspaceManager {
    if (!this.workspaceManager) {
      throw new Error('工作空间管理器未设置');
    }
    return this.workspaceManager;
  }

  /**
   * 设置当前工作空间
   * @param workspaceId 工作空间 ID
   * @throws Error 如果工作空间管理器未设置或工作空间不存在
   */
  setCurrentWorkspace(workspaceId: string): void {
    if (!this.workspaceManager) {
      throw new Error('工作空间管理器未设置');
    }

    const workspace = this.workspaceManager.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`工作空间 "${workspaceId}" 不存在`);
    }

    this.currentWorkspaceId = workspaceId;
  }

  /**
   * 获取当前工作空间
   * @returns 当前工作空间实例
   * @throws Error 如果工作空间管理器未设置
   */
  getCurrentWorkspace(): MCPWorkspace {
    if (!this.workspaceManager) {
      throw new Error('工作空间管理器未设置');
    }

    const workspace = this.workspaceManager.getWorkspace(this.currentWorkspaceId);
    if (!workspace) {
      throw new Error(`当前工作空间 "${this.currentWorkspaceId}" 不存在`);
    }

    return workspace;
  }
}
