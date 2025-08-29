/**
 * 🔴 TDD 红阶段：类型验证集成测试
 * 测试改进后的类型验证在各个模块中的集成效果
 */

import { BaseToolProvider, ToolResponse } from './base-tool-provider';
import { ToolManager, ToolCall } from './tool-manager';
import { MCPServer } from './mcp-server';
import { MCPWorkspaceManager } from './mcp-workspace';
import { ValidationError } from './type-validator';
import { ProjectInfo } from './context-base';

describe('类型验证集成测试', () => {
  describe('BaseToolProvider 类型验证', () => {
    // 创建测试用的工具提供者
    class TestToolProvider extends BaseToolProvider {
      getTools() {
        return [
          this.createTool(
            'test-tool',
            '测试工具',
            async (params: { name: string; count: number }) => {
              this.validateRequiredParams(params, ['name', 'count']);
              return this.createSuccessResponse({ 
                message: `Hello ${params.name}, count: ${params.count}` 
              });
            },
            this.createObjectSchema({
              name: this.createStringParam('名称参数'),
              count: { type: 'number', description: '计数参数' }
            }, ['name', 'count'])
          )
        ];
      }
    }

    it('应该正确验证工具参数', async () => {
      const provider = new TestToolProvider();
      const tools = provider.getTools();
      const testTool = tools[0];
      expect(testTool).toBeDefined();

      // 有效参数应该成功
      const validParams = { name: 'test', count: 5 };
      const result = await testTool!.handler(validParams);
      
      expect(result.success).toBe(true);
      expect(result['message']).toContain('Hello test');
    });

    it('应该拒绝无效参数', async () => {
      const provider = new TestToolProvider();
      const tools = provider.getTools();
      const testTool = tools[0];
      expect(testTool).toBeDefined();

      // 缺少必需参数应该失败
      const invalidParams = { name: 'test' }; // 缺少count
      const result = await testTool!.handler(invalidParams as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('缺少必需参数');
    });

    it('应该创建类型安全的Schema', () => {
      const provider = new TestToolProvider();
      
      const stringParam = provider['createStringParam']('测试字符串');
      expect(stringParam['type']).toBe('string');
      expect(stringParam['description']).toBe('测试字符串');

      const enumParam = provider['createEnumParam']('状态', ['pending', 'completed']);
      expect(enumParam['type']).toBe('string');
      expect(enumParam['enum']).toEqual(['pending', 'completed']);

      const arrayParam = provider['createArrayParam']('字符串列表');
      expect(arrayParam['type']).toBe('array');
      expect(arrayParam['items']).toEqual({ type: 'string' });
    });
  });

  describe('ToolManager 类型验证', () => {
    let toolManager: ToolManager;
    let mcpServer: MCPServer;

    beforeEach(() => {
      mcpServer = new MCPServer();
      const workspaceManager = new MCPWorkspaceManager();
      toolManager = new ToolManager(mcpServer, workspaceManager);

      // 注册一个测试工具
      mcpServer.registerTool({
        name: 'echo-tool',
        description: '回显工具',
        handler: async (params: any) => ({ echo: params.message }),
        schema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: '要回显的消息' }
          },
          required: ['message']
        }
      });
    });

    it('应该验证工具执行参数', async () => {
      // 有效参数应该成功
      const result = await toolManager.executeTool('echo-tool', { message: 'hello' });
      expect(result).toEqual({ echo: 'hello' });
    });

    it('应该拒绝无效的工具名称', async () => {
      await expect(toolManager.executeTool(123 as any, {}))
        .rejects
        .toThrow(ValidationError);
    });

    it('应该拒绝无效的工具参数', async () => {
      await expect(toolManager.executeTool('echo-tool', 'invalid-params' as any))
        .rejects
        .toThrow(ValidationError);
    });

    it('应该验证批量工具调用', async () => {
      const toolCalls: ToolCall[] = [
        { name: 'echo-tool', args: { message: 'hello1' } },
        { name: 'echo-tool', args: { message: 'hello2' } }
      ];

      const results = await toolManager.executeTools(toolCalls);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ echo: 'hello1' });
      expect(results[1]).toEqual({ echo: 'hello2' });
    });

    it('应该拒绝无效的工具调用格式', async () => {
      const invalidToolCalls = [
        { name: 'echo-tool' }, // 缺少args
        { args: { message: 'hello' } } // 缺少name
      ];

      await expect(toolManager.executeTools(invalidToolCalls as any))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('ProjectInfo 类型验证', () => {
    it('应该接受有效的项目信息', () => {
      const validProject: ProjectInfo = {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project',
        author: 'Test Author', // 额外属性应该是基础类型
        repository: 'https://github.com/test/repo'
      };

      expect(validProject.name).toBe('test-project');
      expect(validProject.version).toBe('1.0.0');
      expect(validProject['author']).toBe('Test Author');
    });

    it('应该具有更严格的类型约束', () => {
      const project: ProjectInfo = {
        name: 'test',
        count: 42, // number 类型
        active: true, // boolean 类型
        tags: undefined // 可以是 undefined
      };

      // TypeScript 编译时应该不允许复杂对象类型
      // const invalidProject: ProjectInfo = {
      //   name: 'test',
      //   config: { nested: { object: 'not allowed' } } // 这应该导致编译错误
      // };

      expect(typeof project['count']).toBe('number');
      expect(typeof project['active']).toBe('boolean');
    });
  });

  describe('ToolResponse 类型验证', () => {
    it('应该创建类型安全的响应', () => {
      const response: ToolResponse = {
        success: true,
        message: 'Operation successful',
        count: 42,
        active: true
      };

      expect(response.success).toBe(true);
      expect(typeof response['message']).toBe('string');
      expect(typeof response['count']).toBe('number');

      // TypeScript 编译时应该不允许复杂对象类型
      // const invalidResponse: ToolResponse = {
      //   success: true,
      //   data: { nested: { object: 'not allowed' } } // 这应该导致编译错误
      // };
    });

    it('应该支持error字段', () => {
      const errorResponse: ToolResponse = {
        success: false,
        error: 'Something went wrong',
        code: 500
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Something went wrong');
      expect(errorResponse['code']).toBe(500);
    });
  });
});