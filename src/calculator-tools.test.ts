/**
 * 🔴 TDD 红阶段：计算器工具提供者测试
 * 这些测试最初会失败 - 这是正确的 TDD 行为！
 */

import { CalculatorToolsProvider } from './calculator-tools'; // ❌ 这会失败 - 正确的！
import { MCPServer } from './mcp-server';

describe('计算器工具提供者', () => {
  describe('工具创建', () => {
    it('应该创建计算器工具提供者实例', () => {
      const provider = new CalculatorToolsProvider(); // ❌ 会失败 - 类不存在
      expect(provider).toBeInstanceOf(CalculatorToolsProvider);
    });

    it('应该获取所有计算器工具', () => {
      const provider = new CalculatorToolsProvider();
      const tools = provider.getTools(); // ❌ 会失败
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(4);
      expect(tools.some(tool => tool.name === 'add')).toBe(true);
      expect(tools.some(tool => tool.name === 'subtract')).toBe(true);
      expect(tools.some(tool => tool.name === 'multiply')).toBe(true);
      expect(tools.some(tool => tool.name === 'divide')).toBe(true);
    });

    it('应该获取加法工具', () => {
      const provider = new CalculatorToolsProvider();
      const addTool = provider.getAddTool(); // ❌ 会失败
      
      expect(addTool.name).toBe('add');
      expect(addTool.description).toBe('两数相加');
      expect(typeof addTool.handler).toBe('function');
    });

    it('应该获取减法工具', () => {
      const provider = new CalculatorToolsProvider();
      const subtractTool = provider.getSubtractTool(); // ❌ 会失败
      
      expect(subtractTool.name).toBe('subtract');
      expect(subtractTool.description).toBe('第一个数减去第二个数');
      expect(typeof subtractTool.handler).toBe('function');
    });

    it('应该获取乘法工具', () => {
      const provider = new CalculatorToolsProvider();
      const multiplyTool = provider.getMultiplyTool(); // ❌ 会失败
      
      expect(multiplyTool.name).toBe('multiply');
      expect(multiplyTool.description).toBe('两数相乘');
      expect(typeof multiplyTool.handler).toBe('function');
    });

    it('应该获取除法工具', () => {
      const provider = new CalculatorToolsProvider();
      const divideTool = provider.getDivideTool(); // ❌ 会失败
      
      expect(divideTool.name).toBe('divide');
      expect(divideTool.description).toBe('第一个数除以第二个数');
      expect(typeof divideTool.handler).toBe('function');
    });
  });

  describe('工具执行', () => {
    let provider: CalculatorToolsProvider;

    beforeEach(() => {
      provider = new CalculatorToolsProvider();
    });

    it('应该执行加法工具', async () => {
      const addTool = provider.getAddTool();
      const result = await addTool.handler({ a: 5, b: 3 }); // ❌ 会失败
      expect(result).toEqual({ result: 8 });
    });

    it('应该执行减法工具', async () => {
      const subtractTool = provider.getSubtractTool();
      const result = await subtractTool.handler({ a: 10, b: 4 }); // ❌ 会失败
      expect(result).toEqual({ result: 6 });
    });

    it('应该执行乘法工具', async () => {
      const multiplyTool = provider.getMultiplyTool();
      const result = await multiplyTool.handler({ a: 6, b: 7 }); // ❌ 会失败
      expect(result).toEqual({ result: 42 });
    });

    it('应该执行除法工具', async () => {
      const divideTool = provider.getDivideTool();
      const result = await divideTool.handler({ a: 15, b: 3 }); // ❌ 会失败
      expect(result).toEqual({ result: 5 });
    });

    it('应该处理除零错误', async () => {
      const divideTool = provider.getDivideTool();
      await expect(divideTool.handler({ a: 10, b: 0 })) // ❌ 会失败
        .rejects
        .toThrow('不允许除零');
    });
  });

  describe('与MCP服务器集成', () => {
    it('应该能够将工具注册到MCP服务器', () => {
      const provider = new CalculatorToolsProvider();
      const server = new MCPServer();
      
      // 使用提供者的工具注册到服务器
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const registeredTools = server.getTools();
      expect(registeredTools.length).toBe(4);
      expect(registeredTools.some(tool => tool.name === 'add')).toBe(true);
    });

    it('应该能够通过MCP服务器执行计算器工具', async () => {
      const provider = new CalculatorToolsProvider();
      const server = new MCPServer();
      
      // 注册所有计算器工具
      provider.getTools().forEach(tool => {
        server.registerTool(tool);
      });
      
      // 通过服务器执行工具
      const result = await server.executeTool('add', { a: 8, b: 12 }); // ❌ 会失败
      expect(result).toEqual({ result: 20 });
    });
  });
});
