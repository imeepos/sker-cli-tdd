/**
 * 🔴 TDD 红阶段：网络请求工具测试
 * 先写失败的测试，再实现功能
 */

import { FetchToolsProvider } from './fetch-tools'; // ❌ 这会失败 - 正确的！
import { MCPServer } from './mcp-server';

describe('FetchToolsProvider', () => {
  let provider: FetchToolsProvider;
  let server: MCPServer;

  beforeEach(() => {
    provider = new FetchToolsProvider(); // ❌ 这会失败 - 正确的！
    server = new MCPServer();
  });

  describe('getTools', () => {
    it('应该返回网络请求工具列表', () => {
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // 检查是否包含基本的网络请求工具
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('fetch_url');
      expect(toolNames).toContain('fetch_json');
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

  describe('fetch_url工具', () => {
    it('应该能够通过MCP服务器执行URL获取工具', async () => {
      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 执行URL获取（使用一个可靠的测试URL）
      const result = await server.executeTool('fetch_url', {
        url: 'https://httpbin.org/get'
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.status).toBe(200);
      expect(result.url).toBe('https://httpbin.org/get');
    });

    it('应该能够处理网络请求失败', async () => {
      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行无效URL请求（使用更快失败的URL和超时）
      const result = await server.executeTool('fetch_url', {
        url: 'http://localhost:99999/nonexistent',
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 15000); // 增加测试超时时间
  });

  describe('fetch_json工具', () => {
    it('应该能够获取并解析JSON数据', async () => {
      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 执行JSON获取
      const result = await server.executeTool('fetch_json', {
        url: 'https://httpbin.org/json'
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
      expect(result.status).toBe(200);
    });
  });
});
