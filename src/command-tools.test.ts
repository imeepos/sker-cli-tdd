/**
 * 🔴 TDD 红阶段：命令工具提供者测试
 * 先写失败的测试，再实现功能
 */

import { CommandToolsProvider } from './command-tools'; // ❌ 这会失败 - 正确的！
import { MCPServer } from './mcp-server';

describe('CommandToolsProvider', () => {
  let provider: CommandToolsProvider;
  let server: MCPServer;

  beforeEach(() => {
    provider = new CommandToolsProvider(); // ❌ 这会失败 - 正确的！
    server = new MCPServer();
  });

  describe('getTools', () => {
    it('应该返回命令执行工具列表', () => {
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      // 检查是否包含基本的命令执行工具
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('execute_command');
    });

    it('应该返回具有正确结构的工具', () => {
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！

      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('handler');
        expect(tool).toHaveProperty('schema');
        expect(typeof tool.handler).toBe('function');
      });
    });
  });

  describe('execute_command工具', () => {
    it('应该能够通过MCP服务器执行命令工具', async () => {
      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行简单命令
      const result = await server.executeTool('execute_command', {
        command: 'echo "Hello from MCP"',
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toMatch(/Hello from MCP/); // 兼容不同shell格式
      expect(result.command).toBe('echo "Hello from MCP"');
    });

    it('应该能够处理命令执行失败', async () => {
      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行不存在的命令
      const result = await server.executeTool('execute_command', {
        command: 'nonexistentcommand12345',
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toBeTruthy();
    });
  });
});
