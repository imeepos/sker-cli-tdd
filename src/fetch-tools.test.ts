/**
 * 🔴 TDD 红阶段：网络请求工具测试
 * 先写失败的测试，再实现功能
 */

import { FetchToolsProvider } from './fetch-tools'; // ❌ 这会失败 - 正确的！
import { MCPServer } from './mcp-server';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('FetchToolsProvider', () => {
  let provider: FetchToolsProvider;
  let server: MCPServer;

  beforeEach(() => {
    provider = new FetchToolsProvider(); // ❌ 这会失败 - 正确的！
    server = new MCPServer();

    // Reset mock before each test
    mockFetch.mockReset();
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
      // Mock successful fetch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '<html><body>Test content</body></html>',
        headers: new Map([['content-type', 'text/html']])
      });

      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行URL获取
      const result = await server.executeTool('fetch_url', {
        url: 'https://httpbin.org/get'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.status).toBe(200);
      expect(result.url).toBe('https://httpbin.org/get');
      expect(mockFetch).toHaveBeenCalledWith('https://httpbin.org/get', expect.any(Object));
    });

    it('应该能够处理网络请求失败', async () => {
      // Mock failed fetch response
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行失败的URL请求
      const result = await server.executeTool('fetch_url', {
        url: 'http://localhost:99999/nonexistent',
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('fetch_json工具', () => {
    it('应该能够获取并解析JSON数据', async () => {
      // Mock successful JSON response
      const mockJsonData = { message: 'Hello, World!', status: 'success' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockJsonData,
        headers: new Map([['content-type', 'application/json']])
      });

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
      expect(result.data).toEqual(mockJsonData);
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith('https://httpbin.org/json', expect.any(Object));
    });
  });
});
