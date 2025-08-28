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

/**
 * 遵循 TDD 原则的 MCP 服务器实现
 * 管理 AI 模型交互的工具和资源
 * 遵循单一职责原则：只负责工具和资源管理，不包含具体业务逻辑
 */
export class MCPServer {
  private readonly name: string = 'sker-ai-mcp-server';
  private readonly version: string = '1.0.0';
  private running: boolean = false;
  private readonly tools: Map<string, MCPTool> = new Map();
  private readonly resources: Map<string, MCPResource> = new Map();

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
   * 获取所有已注册的工具
   * @returns 所有已注册工具的数组
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按名称执行工具
   * @param name 要执行的工具名称
   * @param params 传递给工具的参数
   * @returns 工具执行的结果
   * @throws Error 如果工具未找到则抛出错误
   */
  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.tools.get(name);
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


}
