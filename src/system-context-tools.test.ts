/**
 * 🔄 TDD 重构阶段：系统上下文工具提供者测试
 * 测试MCP工具集成
 */

import { SystemContextToolsProvider } from './system-context-tools';
import { MCPServer } from './mcp-server';

describe('SystemContextToolsProvider', () => {
  let provider: SystemContextToolsProvider;
  let server: MCPServer;

  beforeEach(() => {
    provider = new SystemContextToolsProvider();
    server = new MCPServer();
  });

  describe('getTools', () => {
    it('应该返回系统上下文工具列表', () => {
      const tools = provider.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(6);
      
      // 检查是否包含所有预期的工具
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('get_system_context');
      expect(toolNames).toContain('get_system_summary');
      expect(toolNames).toContain('get_os_info');
      expect(toolNames).toContain('get_command_line_tools');
      expect(toolNames).toContain('get_shell_info');
      expect(toolNames).toContain('get_network_info');
    });

    it('应该返回具有正确结构的工具', () => {
      const tools = provider.getTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('handler');
        expect(tool).toHaveProperty('schema');
        expect(typeof tool.handler).toBe('function');
      });
    });
  });

  describe('get_system_context工具', () => {
    it('应该能够通过MCP服务器获取完整系统上下文', async () => {
      // 注册工具到服务器
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 执行系统上下文获取
      const result = await server.executeTool('get_system_context', {});
      
      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context.os).toBeDefined();
      expect(result.context.commandLineTools).toBeDefined();
      expect(result.context.shells).toBeDefined();
      expect(result.collectedAt).toBeDefined();
    }, 30000);

    it('应该能够处理系统上下文获取错误', async () => {
      // 这个测试确保错误处理正常工作
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('get_system_context', {});
      
      // 即使有错误，也应该有明确的响应结构
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    }, 30000);
  });

  describe('get_system_summary工具', () => {
    it('应该能够生成系统摘要', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('get_system_summary', {});
      
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.generatedAt).toBeDefined();
    }, 30000);
  });

  describe('get_os_info工具', () => {
    it('应该能够获取操作系统信息', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('get_os_info', {});
      
      expect(result.success).toBe(true);
      expect(result.os).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.platform).toBeDefined();
      expect(typeof result.isWindows).toBe('boolean');
      expect(typeof result.isLinux).toBe('boolean');
      expect(typeof result.isMacOS).toBe('boolean');
    }, 30000);
  });

  describe('get_command_line_tools工具', () => {
    it('应该能够获取命令行工具信息', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('get_command_line_tools', {});
      
      expect(result.success).toBe(true);
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.availableTools).toBeDefined();
      expect(result.toolNames).toBeDefined();
    }, 30000);
  });

  describe('get_shell_info工具', () => {
    it('应该能够获取Shell信息', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('get_shell_info', {});
      
      expect(result.success).toBe(true);
      expect(result.shells).toBeDefined();
      expect(result.currentShell).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
      expect(result.shellNames).toBeDefined();
      expect(typeof result.hasPowerShell).toBe('boolean');
      expect(typeof result.hasBash).toBe('boolean');
    }, 30000);
  });

  describe('get_network_info工具', () => {
    it('应该能够获取网络信息', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('get_network_info', {});
      
      expect(result.success).toBe(true);
      expect(result.network).toBeDefined();
      expect(result.interfaceCount).toBeGreaterThan(0);
      expect(typeof result.hasInternet).toBe('boolean');
      expect(typeof result.hasDNS).toBe('boolean');
      expect(result.externalInterfaces).toBeDefined();
    }, 30000);
  });
});
