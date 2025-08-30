/**
 * 🔴 TDD 红阶段：IPC 协议测试文件
 * 测试 IPC 协议的消息格式、命令定义和错误处理机制
 */

import {
  IPCRequest,
  IPCResponse,
  IPCCommand,
  IPCError,
  IPCProtocol,
  createRequest,
  createResponse,
  createErrorResponse,
  validateMessage,
  serializeMessage,
  deserializeMessage
} from './ipc-protocol';

describe('IPC Protocol IPC协议', () => {
  describe('消息格式验证', () => {
    it('应该能够创建有效的请求消息', () => {
      const request = createRequest('ping', { timestamp: Date.now() });
      
      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.type).toBe('request');
      expect(request.command).toBe('ping');
      expect(request.version).toBe('1.0');
      expect(request.timestamp).toBeDefined();
      expect(request.data).toEqual({ timestamp: expect.any(Number) });
    });

    it('应该能够创建有效的响应消息', () => {
      const requestId = 'test-request-123';
      const response = createResponse(requestId, { success: true });
      
      expect(response).toBeDefined();
      expect(response.id).toBe(requestId);
      expect(response.type).toBe('response');
      expect(response.version).toBe('1.0');
      expect(response.timestamp).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ success: true });
    });

    it('应该能够创建错误响应消息', () => {
      const requestId = 'test-error-456';
      const error: IPCError = {
        code: 'INVALID_COMMAND',
        message: '未知命令',
        details: { command: 'invalid' }
      };
      
      const errorResponse = createErrorResponse(requestId, error);
      
      expect(errorResponse).toBeDefined();
      expect(errorResponse.id).toBe(requestId);
      expect(errorResponse.type).toBe('response');
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toEqual(error);
    });

    it('应该验证消息格式的有效性', () => {
      const validRequest: IPCRequest = {
        id: 'valid-123',
        type: 'request',
        version: '1.0',
        timestamp: Date.now(),
        command: 'status',
        data: {}
      };

      const validResponse: IPCResponse = {
        id: 'valid-123',
        type: 'response',
        version: '1.0',
        timestamp: Date.now(),
        success: true,
        data: {}
      };

      expect(validateMessage(validRequest)).toBe(true);
      expect(validateMessage(validResponse)).toBe(true);
    });

    it('应该拒绝无效的消息格式', () => {
      const invalidMessage = {
        id: 'invalid',
        type: 'unknown',
        // 缺少必需字段
      };

      expect(validateMessage(invalidMessage as any)).toBe(false);
    });
  });

  describe('命令类型定义', () => {
    it('应该支持所有预定义的命令类型', () => {
      const commands: IPCCommand[] = [
        'ping',
        'status',
        'start-watching',
        'stop-watching',
        'add-project',
        'remove-project',
        'list-projects',
        'refresh-context',
        'get-stats',
        'shutdown'
      ];

      commands.forEach(command => {
        const request = createRequest(command, {});
        expect(request.command).toBe(command);
        expect(validateMessage(request)).toBe(true);
      });
    });

    it('应该为每个命令提供适当的数据结构', () => {
      // ping 命令
      const pingRequest = createRequest('ping', {});
      expect(pingRequest.data).toEqual({});

      // add-project 命令
      const addProjectRequest = createRequest('add-project', {
        projectPath: '/path/to/project',
        watchPatterns: ['**/*.ts'],
        ignorePatterns: ['**/node_modules/**']
      });
      expect(addProjectRequest.data).toHaveProperty('projectPath');
      expect(addProjectRequest.data).toHaveProperty('watchPatterns');

      // get-stats 命令
      const statsRequest = createRequest('get-stats', {
        projectId: 'project-123'
      });
      expect(statsRequest.data).toHaveProperty('projectId');
    });
  });

  describe('消息序列化和反序列化', () => {
    it('应该能够序列化请求消息为JSON字符串', () => {
      const request = createRequest('ping', { test: true });
      const serialized = serializeMessage(request);
      
      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
      
      const parsed = JSON.parse(serialized);
      expect(parsed.id).toBe(request.id);
      expect(parsed.command).toBe('ping');
    });

    it('应该能够反序列化JSON字符串为消息对象', () => {
      const originalRequest = createRequest('status', { verbose: true });
      const serialized = serializeMessage(originalRequest);
      const deserialized = deserializeMessage(serialized) as IPCRequest;
      
      expect(deserialized).toEqual(originalRequest);
    });

    it('应该在反序列化无效JSON时抛出异常', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => {
        deserializeMessage(invalidJson);
      }).toThrow();
    });

    it('应该处理包含特殊字符的消息', () => {
      const request = createRequest('ping', {
        message: 'Hello "World" with \n newlines and \t tabs',
        path: 'C:\\Windows\\Path\\With\\Backslashes'
      });
      
      const serialized = serializeMessage(request);
      const deserialized = deserializeMessage(serialized) as IPCRequest;
      
      expect(deserialized.data).toEqual(request.data);
    });
  });

  describe('错误处理机制', () => {
    it('应该定义标准错误代码', () => {
      const errorCodes = [
        'INVALID_COMMAND',
        'INVALID_DATA',
        'PROJECT_NOT_FOUND',
        'PROJECT_ALREADY_EXISTS',
        'DAEMON_NOT_RUNNING',
        'PERMISSION_DENIED',
        'INTERNAL_ERROR',
        'TIMEOUT',
        'CONNECTION_FAILED'
      ];

      errorCodes.forEach(code => {
        const error: IPCError = {
          code,
          message: `Test error: ${code}`,
        };
        
        const errorResponse = createErrorResponse('test-123', error);
        expect(errorResponse.error?.code).toBe(code);
      });
    });

    it('应该支持错误详情信息', () => {
      const error: IPCError = {
        code: 'PROJECT_NOT_FOUND',
        message: '项目未找到',
        details: {
          projectId: 'missing-project',
          suggestedAction: 'use add-project command first'
        }
      };

      const errorResponse = createErrorResponse('test-456', error);
      
      expect(errorResponse.error?.details).toEqual({
        projectId: 'missing-project',
        suggestedAction: 'use add-project command first'
      });
    });

    it('应该验证错误响应的格式', () => {
      const error: IPCError = {
        code: 'INTERNAL_ERROR',
        message: '内部服务器错误'
      };

      const errorResponse = createErrorResponse('error-789', error);
      
      expect(validateMessage(errorResponse)).toBe(true);
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });
  });

  describe('协议版本控制', () => {
    it('应该在所有消息中包含版本信息', () => {
      const request = createRequest('ping', {});
      const response = createResponse('test-123', {});
      
      expect(request.version).toBeDefined();
      expect(response.version).toBeDefined();
      expect(request.version).toBe('1.0');
      expect(response.version).toBe('1.0');
    });

    it('应该支持版本兼容性检查', () => {
      const protocol = new IPCProtocol();
      
      expect(protocol.isVersionCompatible('1.0')).toBe(true);
      expect(protocol.isVersionCompatible('0.9')).toBe(false);
      expect(protocol.isVersionCompatible('2.0')).toBe(false);
      expect(protocol.getCurrentVersion()).toBe('1.0');
    });

    it('应该在版本不兼容时创建错误响应', () => {
      const protocol = new IPCProtocol();
      const incompatibleRequest = {
        ...createRequest('ping', {}),
        version: '2.0'
      };
      
      const errorResponse = protocol.handleVersionMismatch(incompatibleRequest);
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error?.code).toBe('VERSION_MISMATCH');
    });
  });

  describe('消息大小限制', () => {
    it('应该限制消息大小以防止内存溢出', () => {
      const protocol = new IPCProtocol();
      const maxSize = protocol.getMaxMessageSize();
      
      expect(maxSize).toBeGreaterThan(0);
      expect(maxSize).toBeLessThanOrEqual(10 * 1024 * 1024); // 10MB上限
    });

    it('应该拒绝过大的消息', () => {
      const protocol = new IPCProtocol();
      const largeData = 'x'.repeat(protocol.getMaxMessageSize() + 1);
      const largeRequest = createRequest('ping', { data: largeData });
      
      const result = protocol.validateMessageSize(largeRequest);
      
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('MESSAGE_TOO_LARGE');
    });

    it('应该接受正常大小的消息', () => {
      const protocol = new IPCProtocol();
      const normalRequest = createRequest('ping', { message: 'Hello' });
      
      const result = protocol.validateMessageSize(normalRequest);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('消息ID生成和验证', () => {
    it('应该生成唯一的消息ID', () => {
      const ids = new Set();
      
      for (let i = 0; i < 1000; i++) {
        const request = createRequest('ping', {});
        expect(ids.has(request.id)).toBe(false);
        ids.add(request.id);
      }
      
      expect(ids.size).toBe(1000);
    });

    it('应该生成格式正确的消息ID', () => {
      const request = createRequest('ping', {});
      
      // ID应该是字符串
      expect(typeof request.id).toBe('string');
      
      // ID长度应该合理
      expect(request.id.length).toBeGreaterThan(8);
      expect(request.id.length).toBeLessThan(64);
      
      // ID应该只包含安全字符
      expect(request.id).toMatch(/^[a-zA-Z0-9-_]+$/);
    });
  });
});