/**
 * 🟢 TDD 绿阶段：计算器工具提供者实现
 * 遵循 TDD 原则：编写刚好让测试通过的最简代码
 * 遵循单一职责原则：专门负责提供计算器相关的 MCP 工具
 */

import { Calculator } from './calculator';
import { MCPTool } from './mcp-server';

/**
 * 计算器工具提供者
 * 负责创建和管理计算器相关的 MCP 工具
 * 遵循单一职责原则，与 MCP 服务器解耦
 */
export class CalculatorToolsProvider {
  private readonly calculator: Calculator;

  constructor() {
    this.calculator = new Calculator();
  }

  /**
   * 获取所有计算器工具
   * @returns 所有计算器工具的数组
   */
  getTools(): MCPTool[] {
    return [
      this.getAddTool(),
      this.getSubtractTool(),
      this.getMultiplyTool(),
      this.getDivideTool()
    ];
  }

  /**
   * 获取加法工具
   * @returns 加法工具
   */
  getAddTool(): MCPTool {
    return {
      name: 'add',
      description: '两数相加',
      handler: async (params: { a: number; b: number }) => {
        return { result: this.calculator.add(params.a, params.b) };
      },
      schema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: '第一个数' },
          b: { type: 'number', description: '第二个数' }
        },
        required: ['a', 'b']
      }
    };
  }

  /**
   * 获取减法工具
   * @returns 减法工具
   */
  getSubtractTool(): MCPTool {
    return {
      name: 'subtract',
      description: '第一个数减去第二个数',
      handler: async (params: { a: number; b: number }) => {
        return { result: params.a - params.b };
      },
      schema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: '被减数' },
          b: { type: 'number', description: '减数' }
        },
        required: ['a', 'b']
      }
    };
  }

  /**
   * 获取乘法工具
   * @returns 乘法工具
   */
  getMultiplyTool(): MCPTool {
    return {
      name: 'multiply',
      description: '两数相乘',
      handler: async (params: { a: number; b: number }) => {
        return { result: params.a * params.b };
      },
      schema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: '第一个数' },
          b: { type: 'number', description: '第二个数' }
        },
        required: ['a', 'b']
      }
    };
  }

  /**
   * 获取除法工具
   * @returns 除法工具
   */
  getDivideTool(): MCPTool {
    return {
      name: 'divide',
      description: '第一个数除以第二个数',
      handler: async (params: { a: number; b: number }) => {
        if (params.b === 0) {
          throw new Error('不允许除零');
        }
        return { result: params.a / params.b };
      },
      schema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: '被除数' },
          b: { type: 'number', description: '除数' }
        },
        required: ['a', 'b']
      }
    };
  }
}
