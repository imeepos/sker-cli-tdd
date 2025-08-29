/**
 * 🔴 TDD 红阶段：BaseToolProvider 测试
 * 测试基础工具提供者的通用功能
 */

import { BaseToolProvider, ToolResponse } from './base-tool-provider';
import { MCPTool } from './mcp-server';
import { SkerError, ErrorCodes, ErrorSeverity } from './sker-error';

/**
 * 测试用的具体工具提供者实现
 */
class TestToolProvider extends BaseToolProvider {
  getTools(): MCPTool[] {
    return [
      this.createTool(
        'test_tool',
        '测试工具',
        this.testToolHandler.bind(this),
        this.createObjectSchema(
          {
            message: this.createStringParam('测试消息')
          },
          ['message']
        )
      ),
      this.createTool(
        'error_tool', 
        '错误测试工具',
        this.errorToolHandler.bind(this),
        this.createObjectSchema({})
      ),
      this.createTool(
        'sker_error_tool',
        'SkerError测试工具',
        this.skerErrorToolHandler.bind(this),
        this.createObjectSchema({})
      )
    ];
  }

  private async testToolHandler(params: { message: string }): Promise<ToolResponse> {
    this.validateRequiredParams(params, ['message']);
    return this.createSuccessResponse({ 
      message: `收到消息: ${params.message}`,
      timestamp: Date.now()
    });
  }

  private async errorToolHandler(_params: any): Promise<ToolResponse> {
    throw new Error('测试错误');
  }

  private async skerErrorToolHandler(_params: any): Promise<ToolResponse> {
    throw new SkerError(ErrorCodes.VALIDATION_ERROR, 'SkerError测试错误', {
      severity: ErrorSeverity.HIGH
    });
  }
}

describe('BaseToolProvider', () => {
  let provider: TestToolProvider;

  beforeEach(() => {
    provider = new TestToolProvider();
  });

  describe('createTool', () => {
    it('应该创建有效的MCP工具', () => {
      const tools = provider.getTools();
      expect(tools).toHaveLength(3);

      const testTool = tools.find(t => t.name === 'test_tool');
      expect(testTool).toBeDefined();
      expect(testTool?.name).toBe('test_tool');
      expect(testTool?.description).toBe('测试工具');
      expect(testTool?.handler).toBeDefined();
      expect(testTool?.schema).toBeDefined();
    });

    it('应该正确处理成功的工具调用', async () => {
      const tools = provider.getTools();
      const testTool = tools.find(t => t.name === 'test_tool');
      
      const result = await testTool?.handler({ message: '你好' });
      
      expect(result).toEqual({
        success: true,
        message: '收到消息: 你好',
        timestamp: expect.any(Number)
      });
    });

    it('应该正确处理工具调用中的普通错误', async () => {
      const tools = provider.getTools();
      const errorTool = tools.find(t => t.name === 'error_tool');
      
      const result = await errorTool?.handler({});
      
      expect(result).toMatchObject({
        success: false,
        code: ErrorCodes.TOOL_EXECUTION_FAILED,
        severity: ErrorSeverity.HIGH,
        retryable: false
      });
    });

    it('应该正确处理SkerError', async () => {
      const tools = provider.getTools();
      const skerErrorTool = tools.find(t => t.name === 'sker_error_tool');
      
      const result = await skerErrorTool?.handler({});
      
      expect(result).toMatchObject({
        success: false,
        code: ErrorCodes.VALIDATION_ERROR,
        severity: ErrorSeverity.HIGH,
        userMessage: '输入验证失败',
        retryable: false
      });
    });
  });

  describe('createSuccessResponse', () => {
    it('应该创建标准成功响应', () => {
      const response = provider['createSuccessResponse']({ data: 'test' });
      
      expect(response).toEqual({
        success: true,
        data: 'test'
      });
    });

    it('应该创建空的成功响应', () => {
      const response = provider['createSuccessResponse']();
      
      expect(response).toEqual({
        success: true
      });
    });
  });

  describe('createErrorResponse', () => {
    it('应该创建标准错误响应', () => {
      const error = new Error('测试错误消息');
      const response = provider['createErrorResponse'](error);
      
      expect(response).toEqual({
        success: false,
        error: '测试错误消息'
      });
    });
  });

  describe('createErrorResponseWithContext', () => {
    it('应该创建带上下文的错误响应', () => {
      const error = new Error('连接超时');
      const response = provider['createErrorResponseWithContext']('数据库操作', error);
      
      expect(response).toEqual({
        success: false,
        error: '数据库操作失败: 连接超时'
      });
    });
  });

  describe('validateRequiredParams', () => {
    it('应该通过有效参数验证', () => {
      expect(() => {
        provider['validateRequiredParams']({ name: 'test', value: 123 }, ['name', 'value']);
      }).not.toThrow();
    });

    it('应该检测缺少的必需参数', () => {
      expect(() => {
        provider['validateRequiredParams']({ name: 'test' }, ['name', 'value']);
      }).toThrow('缺少必需参数: value');
    });

    it('应该检测null值参数', () => {
      expect(() => {
        provider['validateRequiredParams']({ name: null }, ['name']);
      }).toThrow('缺少必需参数: name');
    });
  });

  describe('Schema创建方法', () => {
    it('应该创建字符串参数Schema', () => {
      const schema = provider['createStringParam']('测试字符串');
      
      expect(schema).toEqual({
        type: 'string',
        description: '测试字符串'
      });
    });

    it('应该创建枚举参数Schema', () => {
      const schema = provider['createEnumParam']('优先级', ['low', 'medium', 'high']);
      
      expect(schema).toEqual({
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: '优先级'
      });
    });

    it('应该创建数组参数Schema', () => {
      const schema = provider['createArrayParam']('标签数组');
      
      expect(schema).toEqual({
        type: 'array',
        items: { type: 'string' },
        description: '标签数组'
      });
    });

    it('应该创建对象Schema', () => {
      const properties = {
        name: { type: 'string', description: '名称' },
        age: { type: 'number', description: '年龄' }
      };
      const schema = provider['createObjectSchema'](properties, ['name']);
      
      expect(schema).toEqual({
        type: 'object',
        properties,
        required: ['name']
      });
    });
  });

  describe('safeExecute', () => {
    it('应该正确执行成功的操作', async () => {
      const result = await provider['safeExecute']('测试操作', async () => {
        return { data: '成功' };
      });

      expect(result).toEqual({
        success: true,
        result: { data: '成功' }
      });
    });

    it('应该正确处理失败的操作', async () => {
      const result = await provider['safeExecute']('测试操作', async () => {
        throw new Error('操作失败');
      });

      expect(result).toEqual({
        success: false,
        error: '测试操作失败: 操作失败'
      });
    });
  });
});