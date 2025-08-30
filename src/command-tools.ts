/**
 * 🔄 TDD 重构阶段：命令工具提供者优化实现
 * 在绿灯状态下改进代码质量
 */

import { CommandExecutor } from './command-executor';
import { MCPTool } from './mcp-server';

/**
 * 命令执行参数接口
 */
interface ExecuteCommandParams {
  command: string;
}

/**
 * 命令工具提供者
 * 负责创建和管理命令执行相关的 MCP 工具
 * 遵循单一职责原则，与 MCP 服务器解耦
 */
export class CommandToolsProvider {
  private readonly commandExecutor: CommandExecutor;

  constructor() {
    this.commandExecutor = new CommandExecutor();
  }

  /**
   * 获取所有命令工具
   * @returns 所有命令工具的数组
   */
  getTools(): MCPTool[] {
    return [this.getExecuteCommandTool()];
  }

  /**
   * 获取执行命令工具
   * @returns 执行命令工具
   */
  private getExecuteCommandTool(): MCPTool {
    return {
      name: 'execute_command',
      description: '执行系统命令并返回结果',
      handler: async (params: ExecuteCommandParams) => {
        try {
          const result = await this.commandExecutor.execute(params.command);

          return {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            command: result.command,
            executionTime: result.executionTime,
          };
        } catch (error) {
          return {
            success: false,
            error: `命令执行失败: ${(error as Error).message}`,
            command: params.command,
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的命令字符串',
          },
        },
        required: ['command'],
      },
    };
  }
}
