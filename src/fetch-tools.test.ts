/**
 * 🔴 TDD 红阶段：网络请求工具测试
 * 先写失败的测试，再实现功能
 */

import { FetchToolsProvider } from './fetch-tools'; // ❌ 这会失败 - 正确的！
import { MCPServer } from './mcp-server';
import nock from 'nock';

// 使用nock替代手动fetch Mock

describe('FetchToolsProvider', () => {
  let provider: FetchToolsProvider;
  let server: MCPServer;

  beforeEach(() => {
    provider = new FetchToolsProvider(); // ❌ 这会失败 - 正确的！
    server = new MCPServer();

    // 清理所有nock拦截器
    nock.cleanAll();
  });

  afterEach(() => {
    // 确保所有nock拦截器都被使用
    nock.cleanAll();
  });

  afterAll(() => {
    // 恢复网络请求
    nock.restore();
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
      // 使用nock模拟成功的HTTP响应
      const scope = nock('https://httpbin.org')
        .get('/get')
        .reply(200, '<html><body>Test content</body></html>', {
          'content-type': 'text/html'
        });

      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行URL获取
      const result = await server.executeTool('fetch_url', {
        url: 'https://httpbin.org/get',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.status).toBe(200);
      expect(result.url).toBe('https://httpbin.org/get');
      
      // 验证nock拦截器被调用
      expect(scope.isDone()).toBe(true);
    });

    it('应该能够处理网络请求失败', async () => {
      // 使用nock模拟网络错误
      const scope = nock('https://example.com')
        .get('/nonexistent')
        .replyWithError('Network error');

      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行失败的URL请求
      const result = await server.executeTool('fetch_url', {
        url: 'https://example.com/nonexistent',
        timeout: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      
      // 验证nock拦截器被调用
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('fetch_json工具', () => {
    it('应该能够获取并解析JSON数据', async () => {
      // 使用nock模拟成功的JSON响应
      const mockJsonData = { message: 'Hello, World!', status: 'success' };
      const scope = nock('https://httpbin.org')
        .get('/json')
        .reply(200, mockJsonData, {
          'content-type': 'application/json'
        });

      // 注册工具到服务器
      const tools = provider.getTools(); // ❌ 这会失败 - 正确的！
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 执行JSON获取
      const result = await server.executeTool('fetch_json', {
        url: 'https://httpbin.org/json',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
      expect(result.data).toEqual(mockJsonData);
      expect(result.status).toBe(200);
      
      // 验证nock拦截器被调用
      expect(scope.isDone()).toBe(true);
    });
  });
});
