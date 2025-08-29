/**
 * 🔄 TDD 重构阶段：系统上下文工具提供者
 * 将系统上下文探索功能集成到MCP工具系统中
 */

import { SystemContextCollector } from './system-context';
import { MCPTool } from './mcp-server';

/**
 * 系统上下文工具提供者
 * 负责创建和管理系统上下文相关的 MCP 工具
 */
export class SystemContextToolsProvider {
  private readonly collector: SystemContextCollector;

  constructor() {
    this.collector = new SystemContextCollector();
  }

  /**
   * 获取所有系统上下文工具
   * @returns 所有系统上下文工具的数组
   */
  getTools(): MCPTool[] {
    return [
      this.getSystemContextTool(),
      this.getSystemSummaryTool(),
      this.getOSInfoTool(),
      this.getCommandLineToolsTool(),
      this.getShellInfoTool(),
      this.getNetworkInfoTool()
    ];
  }

  /**
   * 获取完整系统上下文工具
   */
  private getSystemContextTool(): MCPTool {
    return {
      name: 'get_system_context',
      description: '获取完整的系统上下文信息，包括操作系统、命令行工具、Shell类型等',
      handler: async () => {
        try {
          const context = await this.collector.collectSystemContext();
          
          return {
            success: true,
            context,
            collectedAt: context.collectedAt,
            summary: `收集了${context.commandLineTools.length}个命令行工具和${context.shells.length}个Shell的信息`
          };
        } catch (error) {
          return {
            success: false,
            error: `系统上下文收集失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 获取系统摘要工具
   */
  private getSystemSummaryTool(): MCPTool {
    return {
      name: 'get_system_summary',
      description: '获取系统上下文的简洁摘要信息',
      handler: async () => {
        try {
          const summary = await this.collector.generateContextSummary();
          
          return {
            success: true,
            summary,
            generatedAt: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            error: `系统摘要生成失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 获取操作系统信息工具
   */
  private getOSInfoTool(): MCPTool {
    return {
      name: 'get_os_info',
      description: '获取操作系统详细信息',
      handler: async () => {
        try {
          const context = await this.collector.collectSystemContext();
          
          return {
            success: true,
            os: context.os,
            system: context.system,
            platform: context.os.platform,
            isWindows: context.os.platform === 'win32',
            isLinux: context.os.platform === 'linux',
            isMacOS: context.os.platform === 'darwin'
          };
        } catch (error) {
          return {
            success: false,
            error: `操作系统信息获取失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 获取命令行工具信息工具
   */
  private getCommandLineToolsTool(): MCPTool {
    return {
      name: 'get_command_line_tools',
      description: '获取系统中可用的命令行工具列表',
      handler: async () => {
        try {
          const context = await this.collector.collectSystemContext();
          
          return {
            success: true,
            tools: context.commandLineTools,
            count: context.commandLineTools.length,
            availableTools: context.commandLineTools.filter(tool => tool.available),
            toolNames: context.commandLineTools.map(tool => tool.name)
          };
        } catch (error) {
          return {
            success: false,
            error: `命令行工具信息获取失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 获取Shell信息工具
   */
  private getShellInfoTool(): MCPTool {
    return {
      name: 'get_shell_info',
      description: '获取系统中可用的Shell类型信息',
      handler: async () => {
        try {
          const context = await this.collector.collectSystemContext();
          
          return {
            success: true,
            shells: context.shells,
            currentShell: context.currentShell,
            count: context.shells.length,
            shellNames: context.shells.map(shell => shell.name),
            hasPowerShell: context.shells.some(shell => 
              shell.name.toLowerCase().includes('powershell') || shell.name === 'pwsh'
            ),
            hasBash: context.shells.some(shell => shell.name === 'bash')
          };
        } catch (error) {
          return {
            success: false,
            error: `Shell信息获取失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 获取网络信息工具
   */
  private getNetworkInfoTool(): MCPTool {
    return {
      name: 'get_network_info',
      description: '获取网络接口和连接状态信息',
      handler: async () => {
        try {
          const context = await this.collector.collectSystemContext();
          
          return {
            success: true,
            network: context.network,
            interfaceCount: context.network.interfaces.length,
            hasInternet: context.network.connectivity.internet,
            hasDNS: context.network.connectivity.dns,
            externalInterfaces: context.network.interfaces.filter(iface => !iface.internal)
          };
        } catch (error) {
          return {
            success: false,
            error: `网络信息获取失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }
}
