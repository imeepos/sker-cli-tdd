/**
 * 🔴 TDD 红阶段：BaseAIClientAdapter 测试
 * 测试统一AI客户端适配器基类的功能
 */

import { BaseAIClientAdapter } from './unified-client.interface';
import {
  UnifiedMessage,
  UnifiedResponse,
  UnifiedChunk,
  UnifiedTool,
  UnifiedChatCompletionParams,
  UnifiedAIConfig,
  AIProvider,
} from './unified-types';

// 创建测试用的具体实现类
class TestAIClientAdapter extends BaseAIClientAdapter {
  readonly provider: AIProvider = 'openai';
  readonly config: UnifiedAIConfig = {
    provider: 'openai',
    apiKey: 'test-key',
    model: 'test-model',
  };

  async chatCompletion(_params: UnifiedChatCompletionParams): Promise<UnifiedResponse> {
    return {
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Test response' },
        finishReason: 'stop',
      }],
    };
  }

  async *chatCompletionStream(_params: UnifiedChatCompletionParams): AsyncIterable<UnifiedChunk> {
    yield {
      id: 'test-id',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'test-model',
      choices: [{
        index: 0,
        delta: { role: 'assistant', content: 'Test' },
        finishReason: null,
      }],
    };
  }

  async chatCompletionWithTools(
    messages: UnifiedMessage[],
    tools: UnifiedTool[]
  ): Promise<UnifiedResponse> {
    return this.chatCompletion({ messages, tools });
  }

  getAvailableTools(): UnifiedTool[] {
    return [];
  }

  validateConfig(): boolean {
    return true;
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async getModelInfo(): Promise<any> {
    return {
      id: 'test-model',
      name: 'Test Model',
      description: 'A test model',
    };
  }
}

describe('BaseAIClientAdapter', () => {
  let adapter: TestAIClientAdapter;

  beforeEach(() => {
    adapter = new TestAIClientAdapter();
  });

  describe('工具方法', () => {
    it('应该生成唯一ID', () => {
      const id1 = (adapter as any).generateId();
      const id2 = (adapter as any).generateId();
      
      expect(id1).toMatch(/^chatcmpl-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^chatcmpl-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('应该获取当前时间戳', () => {
      const timestamp = (adapter as any).getCurrentTimestamp();
      const now = Math.floor(Date.now() / 1000);
      
      expect(timestamp).toBeCloseTo(now, 0);
      expect(typeof timestamp).toBe('number');
    });
  });

  describe('消息验证', () => {
    it('应该验证有效消息数组', () => {
      const validMessages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      expect(() => {
        (adapter as any).validateMessages(validMessages);
      }).not.toThrow();
    });

    it('应该拒绝空消息数组', () => {
      expect(() => {
        (adapter as any).validateMessages([]);
      }).toThrow('Messages must be a non-empty array');
    });

    it('应该拒绝非数组消息', () => {
      expect(() => {
        (adapter as any).validateMessages('not an array');
      }).toThrow('Messages must be a non-empty array');
    });

    it('应该拒绝缺少role的消息', () => {
      const invalidMessages = [
        { content: 'Hello' }, // 缺少role
      ];

      expect(() => {
        (adapter as any).validateMessages(invalidMessages);
      }).toThrow('Each message must have role and content');
    });

    it('应该拒绝缺少content的消息', () => {
      const invalidMessages = [
        { role: 'user' }, // 缺少content
      ];

      expect(() => {
        (adapter as any).validateMessages(invalidMessages);
      }).toThrow('Each message must have role and content');
    });
  });

  describe('工具验证', () => {
    it('应该验证有效工具数组', () => {
      const validTools: UnifiedTool[] = [
        {
          type: 'function',
          function: {
            name: 'test_function',
            description: '测试函数',
            parameters: {},
          },
        },
      ];

      expect(() => {
        (adapter as any).validateTools(validTools);
      }).not.toThrow();
    });

    it('应该拒绝非数组工具', () => {
      expect(() => {
        (adapter as any).validateTools('not an array');
      }).toThrow('Tools must be an array');
    });

    it('应该拒绝缺少函数名的工具', () => {
      const invalidTools = [
        {
          type: 'function',
          function: {
            description: '测试函数',
            parameters: {},
          },
        },
      ];

      expect(() => {
        (adapter as any).validateTools(invalidTools);
      }).toThrow('Each tool must have function name and description');
    });

    it('应该拒绝缺少函数描述的工具', () => {
      const invalidTools = [
        {
          type: 'function',
          function: {
            name: 'test_function',
            parameters: {},
          },
        },
      ];

      expect(() => {
        (adapter as any).validateTools(invalidTools);
      }).toThrow('Each tool must have function name and description');
    });

    it('应该拒绝缺少function属性的工具', () => {
      const invalidTools = [
        {
          type: 'function',
        },
      ];

      expect(() => {
        (adapter as any).validateTools(invalidTools);
      }).toThrow('Each tool must have function name and description');
    });
  });

  describe('错误处理', () => {
    it('应该处理HTTP响应错误', () => {
      const httpError = {
        response: {
          status: 400,
          data: { message: 'Bad Request' },
        },
      };

      expect(() => {
        (adapter as any).handleError(httpError);
      }).toThrow('API Error 400: Bad Request');
    });

    it('应该处理没有错误消息的HTTP错误', () => {
      const httpError = {
        response: {
          status: 500,
          data: {},
        },
        message: 'Internal Server Error',
      };

      expect(() => {
        (adapter as any).handleError(httpError);
      }).toThrow('API Error 500: Internal Server Error');
    });

    it('应该处理网络错误', () => {
      const networkError = {
        request: {},
        message: 'Connection timeout',
      };

      expect(() => {
        (adapter as any).handleError(networkError);
      }).toThrow('Network Error: Connection timeout');
    });

    it('应该处理客户端错误', () => {
      const clientError = {
        message: 'Invalid configuration',
      };

      expect(() => {
        (adapter as any).handleError(clientError);
      }).toThrow('Client Error: Invalid configuration');
    });
  });

  describe('抽象方法实现', () => {
    it('应该实现所有必需的抽象方法', () => {
      expect(adapter.provider).toBe('openai');
      expect(adapter.config).toBeDefined();
      expect(typeof adapter.chatCompletion).toBe('function');
      expect(typeof adapter.chatCompletionStream).toBe('function');
      expect(typeof adapter.chatCompletionWithTools).toBe('function');
      expect(typeof adapter.getAvailableTools).toBe('function');
      expect(typeof adapter.validateConfig).toBe('function');
      expect(typeof adapter.testConnection).toBe('function');
      expect(typeof adapter.getModelInfo).toBe('function');
    });
  });
});