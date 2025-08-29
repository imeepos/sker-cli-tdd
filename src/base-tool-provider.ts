/**
 * 🔄 TDD 重构阶段：基础工具提供者抽象类
 * 减少代码重复，提供统一的错误处理和响应格式
 */

import { MCPTool } from './mcp-server';
import { ToolProvider } from './tool-manager';
import { SkerError, ErrorFactory, ErrorUtils } from './sker-error';
import { TypeValidator, ValidationError } from './type-validator';

/**
 * 统一的工具响应接口
 */
export interface ToolResponse {
  success: boolean;
  error?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * 工具处理器类型
 */
export type ToolHandler<TParams = Record<string, unknown>, TResult = ToolResponse> = (params: TParams) => Promise<TResult>;

/**
 * 基础工具提供者抽象类
 * 提供通用的工具创建、错误处理和响应格式化功能
 * 减少各个具体工具提供者中的代码重复
 */
export abstract class BaseToolProvider implements ToolProvider {
  /**
   * 获取工具集合
   * 由子类实现具体的工具定义
   */
  abstract getTools(): MCPTool[];

  /**
   * 创建MCP工具的通用方法
   * 统一处理错误和响应格式
   * @param name 工具名称
   * @param description 工具描述
   * @param handler 工具处理器
   * @param schema JSON Schema定义
   * @returns 完整的MCPTool对象
   */
  protected createTool<TParams = Record<string, unknown>>(
    name: string,
    description: string,
    handler: ToolHandler<TParams, ToolResponse>,
    schema: Record<string, unknown>
  ): MCPTool {
    return {
      name,
      description,
      handler: async (params: TParams) => {
        try {
          return await handler(params);
        } catch (error) {
          if (error instanceof SkerError) {
            return this.createSkerErrorResponse(error);
          }
          const skerError = ErrorFactory.toolExecutionFailed(name, error as Error);
          return this.createSkerErrorResponse(skerError);
        }
      },
      schema
    };
  }

  /**
   * 创建成功响应
   * 统一成功响应的格式
   * @param data 响应数据
   * @returns 成功响应对象
   */
  protected createSuccessResponse(data: Record<string, string | number | boolean | undefined> = {}): ToolResponse {
    return {
      success: true,
      ...data
    };
  }

  /**
   * 创建错误响应
   * 统一错误响应的格式和错误消息处理
   * @param error 错误对象
   * @returns 错误响应对象
   */
  protected createErrorResponse(error: Error): ToolResponse {
    return {
      success: false,
      error: error.message
    };
  }

  /**
   * 创建SkerError响应
   * 提供更丰富的错误信息和结构化错误处理
   * @param error SkerError对象
   * @returns 结构化错误响应
   */
  protected createSkerErrorResponse(error: SkerError): ToolResponse {
    return {
      success: false,
      error: ErrorUtils.getUserMessage(error),
      code: error.code,
      severity: error.severity,
      userMessage: error.getUserMessage(),
      retryable: error.isRetryable(),
      timestamp: error.timestamp.toISOString(),
      ...(error.context && { context: error.context })
    };
  }

  /**
   * 创建带有错误前缀的错误响应
   * 为特定操作添加上下文信息
   * @param operation 操作名称
   * @param error 错误对象
   * @returns 带前缀的错误响应
   */
  protected createErrorResponseWithContext(operation: string, error: Error): ToolResponse {
    return {
      success: false,
      error: `${operation}失败: ${error.message}`
    };
  }

  /**
   * 验证必需参数
   * 提供统一的参数验证逻辑
   * @param params 参数对象
   * @param requiredFields 必需字段列表
   * @throws Error 如果缺少必需参数
   */
  protected validateRequiredParams(params: Record<string, unknown>, requiredFields: string[]): void {
    try {
      TypeValidator.validateRequiredFields(params, requiredFields, 'params');
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new Error(`缺少必需参数: ${error.fieldName.replace('params.', '')}`);
      }
      throw error;
    }
  }

  /**
   * 验证必需参数（使用SkerError）
   * 提供更好的错误信息和分类
   * @param params 参数对象
   * @param requiredFields 必需字段列表
   * @throws SkerError 如果缺少必需参数
   */
  protected validateRequiredParamsWithSkerError(params: Record<string, unknown>, requiredFields: string[]): void {
    try {
      TypeValidator.validateRequiredFields(params, requiredFields, 'params');
    } catch (error) {
      if (error instanceof ValidationError) {
        const fieldName = error.fieldName.replace('params.', '');
        throw ErrorFactory.invalidParams(fieldName, { 
          operation: 'parameter_validation',
          metadata: { providedParams: Object.keys(params) }
        });
      }
      throw error;
    }
  }

  /**
   * 创建标准的字符串参数Schema
   * 减少重复的Schema定义
   * @param description 参数描述
   * @param required 是否必需
   * @returns JSON Schema属性定义
   */
  protected createStringParam(description: string): Record<string, unknown> {
    return {
      type: 'string',
      description
    };
  }

  /**
   * 创建标准的对象Schema
   * 提供快速创建对象Schema的方法
   * @param properties 属性定义
   * @param requiredFields 必需字段
   * @returns 完整的JSON Schema
   */
  protected createObjectSchema(
    properties: Record<string, unknown>, 
    requiredFields: string[] = []
  ): Record<string, unknown> {
    return {
      type: 'object',
      properties,
      required: requiredFields
    };
  }

  /**
   * 创建枚举参数Schema
   * 快速创建枚举类型参数
   * @param description 参数描述
   * @param enumValues 枚举值列表
   * @returns 枚举参数Schema
   */
  protected createEnumParam(description: string, enumValues: string[]): Record<string, unknown> {
    return {
      type: 'string',
      enum: enumValues,
      description
    };
  }

  /**
   * 创建数组参数Schema
   * 快速创建数组类型参数
   * @param description 参数描述
   * @param itemType 数组项类型
   * @returns 数组参数Schema
   */
  protected createArrayParam(description: string, itemType: Record<string, unknown> = { type: 'string' }): Record<string, unknown> {
    return {
      type: 'array',
      items: itemType,
      description
    };
  }

  /**
   * 安全执行异步操作
   * 统一处理异步操作的错误
   * @param operation 操作名称
   * @param asyncFn 异步函数
   * @returns 操作结果
   */
  protected async safeExecute<T>(
    operation: string, 
    asyncFn: () => Promise<T>
  ): Promise<ToolResponse> {
    try {
      const result = await asyncFn();
      return this.createSuccessResponse({ result });
    } catch (error) {
      return this.createErrorResponseWithContext(operation, error as Error);
    }
  }
}