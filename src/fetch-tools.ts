/**
 * 🔄 TDD 重构阶段：网络请求工具提供者优化实现
 * 在绿灯状态下改进代码质量
 */

import { MCPTool } from './mcp-server';

/**
 * 网络请求结果接口
 */
export interface FetchResult {
  success: boolean;
  data?: any;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  url: string;
  error?: string;
  responseTime?: number;
}

/**
 * 网络请求参数接口
 */
export interface FetchParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * 网络请求工具提供者
 * 负责创建和管理网络请求相关的 MCP 工具
 * 遵循单一职责原则，与 MCP 服务器解耦
 */
export class FetchToolsProvider {
  private readonly defaultTimeout: number = 10000; // 10秒默认超时
  private readonly defaultHeaders: Record<string, string> = {
    'User-Agent': 'Sker-CLI-TDD/1.0.0'
  };

  /**
   * 获取所有网络请求工具
   * @returns 所有网络请求工具的数组
   */
  getTools(): MCPTool[] {
    return [
      this.getFetchUrlTool(),
      this.getFetchJsonTool()
    ];
  }

  /**
   * 获取URL请求工具
   * @returns URL请求工具
   */
  private getFetchUrlTool(): MCPTool {
    return {
      name: 'fetch_url',
      description: '获取指定URL的内容',
      handler: async (params: FetchParams) => {
        const startTime = Date.now();
        
        try {
          const response = await fetch(params.url, {
            method: params.method || 'GET',
            headers: { ...this.defaultHeaders, ...params.headers },
            body: params.body,
            signal: AbortSignal.timeout(params.timeout || this.defaultTimeout)
          });

          const responseTime = Date.now() - startTime;
          const data = await response.text();

          return {
            success: response.ok,
            data,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            url: params.url,
            responseTime
          };
        } catch (error) {
          const responseTime = Date.now() - startTime;
          
          return {
            success: false,
            error: (error as Error).message,
            url: params.url,
            responseTime
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要请求的URL地址' },
          method: { type: 'string', description: 'HTTP方法（GET, POST等）', default: 'GET' },
          headers: { type: 'object', description: '请求头' },
          body: { type: 'string', description: '请求体' },
          timeout: { type: 'number', description: '超时时间（毫秒）', default: 10000 }
        },
        required: ['url']
      }
    };
  }

  /**
   * 获取JSON请求工具
   * @returns JSON请求工具
   */
  private getFetchJsonTool(): MCPTool {
    return {
      name: 'fetch_json',
      description: '获取指定URL的JSON数据',
      handler: async (params: FetchParams) => {
        const startTime = Date.now();
        
        try {
          const response = await fetch(params.url, {
            method: params.method || 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...this.defaultHeaders,
              ...params.headers
            },
            body: params.body,
            signal: AbortSignal.timeout(params.timeout || this.defaultTimeout)
          });

          const responseTime = Date.now() - startTime;
          const data = await response.json();

          return {
            success: response.ok,
            data,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            url: params.url,
            responseTime
          };
        } catch (error) {
          const responseTime = Date.now() - startTime;
          
          return {
            success: false,
            error: (error as Error).message,
            url: params.url,
            responseTime
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要请求的JSON API地址' },
          method: { type: 'string', description: 'HTTP方法（GET, POST等）', default: 'GET' },
          headers: { type: 'object', description: '请求头' },
          body: { type: 'string', description: '请求体（JSON字符串）' },
          timeout: { type: 'number', description: '超时时间（毫秒）', default: 10000 }
        },
        required: ['url']
      }
    };
  }
}
