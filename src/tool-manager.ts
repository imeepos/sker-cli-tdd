/**
 * 🟢 TDD 绿阶段：工具管理器实现
 * 集成 MCP 工具调用功能
 */

import { MCPServer, MCPTool } from './mcp-server';
import { MCPWorkspaceManager, MCPWorkspace } from './mcp-workspace';
import { TypeValidator } from './type-validator';

/**
 * 工具提供者接口
 */
export interface ToolProvider {
  getTools(): MCPTool[];
}

/**
 * 工具调用接口
 */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * 工具统计接口
 */
export interface ToolStats {
  totalTools: number;
  totalExecutions: number;
  successRate: number;
}

/**
 * 工具管理器类
 */
export class ToolManager {
  private mcpServer: MCPServer;
  private workspaceManager: MCPWorkspaceManager;
  private executionCount: number = 0;
  private successCount: number = 0;

  constructor(mcpServer: MCPServer, workspaceManager: MCPWorkspaceManager) {
    this.mcpServer = mcpServer;
    this.workspaceManager = workspaceManager;
  }

  /**
   * 获取 MCP 服务器
   */
  getMCPServer(): MCPServer {
    return this.mcpServer;
  }

  /**
   * 获取工作空间管理器
   */
  getWorkspaceManager(): MCPWorkspaceManager {
    return this.workspaceManager;
  }

  /**
   * 注册单个工具
   */
  registerTool(tool: MCPTool): void {
    this.mcpServer.registerTool(tool);
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: MCPTool[]): void {
    tools.forEach(tool => this.mcpServer.registerTool(tool));
  }

  /**
   * 从工具提供者注册工具
   */
  registerToolProvider(provider: ToolProvider): void {
    const tools = provider.getTools();
    this.registerTools(tools);
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools(): MCPTool[] {
    return this.mcpServer.getTools();
  }

  /**
   * 按名称查找工具
   */
  findTool(name: string): MCPTool | undefined {
    const tools = this.mcpServer.getTools();
    return tools.find(tool => tool.name === name);
  }

  /**
   * 按类别筛选工具
   */
  getToolsByCategory(category: string): MCPTool[] {
    const tools = this.mcpServer.getTools();
    return tools.filter(tool => {
      const toolWithCategory = tool as MCPTool & { category?: string };
      return toolWithCategory.category === category;
    });
  }

  /**
   * 执行工具
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    // 验证工具名称和参数
    TypeValidator.validateString(name, 'toolName');
    TypeValidator.validateObject(args, 'toolArgs');
    
    this.executionCount++;
    try {
      const result = await this.mcpServer.executeTool(name, args);
      this.successCount++;
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 批量执行工具
   */
  async executeTools(toolCalls: ToolCall[]): Promise<unknown[]> {
    TypeValidator.validateArray(toolCalls, 'toolCalls');
    
    const results: unknown[] = [];
    for (const toolCall of toolCalls) {
      TypeValidator.validateObjectSchema(toolCall, { name: 'string', args: 'object' }, 'toolCall');
      const result = await this.executeTool(toolCall.name, toolCall.args);
      results.push(result);
    }
    return results;
  }

  /**
   * 创建工具工作空间
   */
  createToolWorkspace(workspace: { id: string; name: string; description: string }): void {
    this.workspaceManager.createWorkspace(workspace);
    this.mcpServer.setWorkspaceManager(this.workspaceManager);
  }

  /**
   * 向工作空间添加工具
   */
  addToolToWorkspace(workspaceId: string, tool: MCPTool): void {
    this.workspaceManager.addToolToWorkspace(workspaceId, tool);
  }

  /**
   * 切换工作空间
   */
  switchWorkspace(workspaceId: string): void {
    this.mcpServer.setCurrentWorkspace(workspaceId);
  }

  /**
   * 获取当前工作空间
   */
  getCurrentWorkspace(): MCPWorkspace | undefined {
    return this.mcpServer.getCurrentWorkspace();
  }

  /**
   * 获取工具帮助信息
   */
  getToolHelp(toolName: string): string {
    const tool = this.findTool(toolName);
    if (!tool) {
      return `工具 "${toolName}" 未找到`;
    }

    let help = `工具: ${tool.name}\n`;
    help += `描述: ${tool.description}\n`;
    
    if (tool.schema && tool.schema['properties']) {
      help += `参数:\n`;
      const properties = tool.schema['properties'] as Record<string, unknown>;
      for (const [key, value] of Object.entries(properties)) {
        const prop = value as Record<string, unknown>;
        const description = typeof prop['description'] === 'string' ? prop['description'] : '无描述';
        help += `  - ${key}: ${description}\n`;
      }
    }

    return help;
  }

  /**
   * 获取所有工具的帮助信息
   */
  getAllToolsHelp(): string {
    const tools = this.getAvailableTools();
    let help = `可用工具 (${tools.length} 个):\n\n`;
    
    tools.forEach(tool => {
      help += `${tool.name}: ${tool.description}\n`;
    });

    return help;
  }

  /**
   * 获取工具使用统计
   */
  getToolStats(): ToolStats {
    const totalTools = this.getAvailableTools().length;
    const successRate = this.executionCount > 0 ? this.successCount / this.executionCount : 0;

    return {
      totalTools,
      totalExecutions: this.executionCount,
      successRate
    };
  }

  /**
   * 重置工具统计
   */
  resetToolStats(): void {
    this.executionCount = 0;
    this.successCount = 0;
  }
}
