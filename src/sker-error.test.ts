/**
 * 🔴 TDD 红阶段：SkerError 系统测试
 * 测试统一错误处理机制
 */

import { 
  SkerError, 
  ErrorCodes, 
  ErrorSeverity, 
  ErrorFactory, 
  ErrorUtils,
  ErrorContext
} from './sker-error';

describe('SkerError', () => {
  describe('构造函数和基本属性', () => {
    it('应该创建基本的SkerError实例', () => {
      const error = new SkerError(ErrorCodes.TOOL_NOT_FOUND, '工具未找到');
      
      expect(error.name).toBe('SkerError');
      expect(error.code).toBe(ErrorCodes.TOOL_NOT_FOUND);
      expect(error.message).toBe('工具未找到');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM); // 默认值
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('应该接受完整的选项参数', () => {
      const cause = new Error('原始错误');
      const context: ErrorContext = {
        operation: '测试操作',
        resourceId: 'test-123',
        userId: 'user-456'
      };

      const error = new SkerError(
        ErrorCodes.DATABASE_ERROR,
        '数据库连接失败',
        {
          severity: ErrorSeverity.CRITICAL,
          context,
          cause
        }
      );

      expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.context).toEqual(context);
      expect(error.cause).toBe(cause);
    });
  });

  describe('toJSON', () => {
    it('应该序列化为完整的JSON对象', () => {
      const context: ErrorContext = { operation: 'test' };
      const cause = new Error('原始错误');
      
      const error = new SkerError(
        ErrorCodes.CONFIG_INVALID,
        '配置无效',
        { context, cause, severity: ErrorSeverity.HIGH }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'SkerError',
        code: ErrorCodes.CONFIG_INVALID,
        message: '配置无效',
        severity: ErrorSeverity.HIGH,
        context,
        timestamp: error.timestamp.toISOString(),
        stack: error.stack,
        cause: {
          name: 'Error',
          message: '原始错误',
          stack: cause.stack
        }
      });
    });

    it('应该正确处理嵌套的SkerError', () => {
      const innerError = new SkerError(ErrorCodes.DATABASE_ERROR, '内部错误');
      const outerError = new SkerError(
        ErrorCodes.TOOL_EXECUTION_FAILED,
        '工具执行失败',
        { cause: innerError }
      );

      const json = outerError.toJSON();

      expect(json['cause']).toEqual(innerError.toJSON());
    });
  });

  describe('getUserMessage', () => {
    it('应该返回用户友好的错误消息', () => {
      const error = new SkerError(ErrorCodes.FILE_NOT_FOUND, '文件不存在');
      
      expect(error.getUserMessage()).toBe('文件未找到');
    });

    it('应该对未知错误代码返回原始消息', () => {
      const error = new SkerError('CUSTOM_ERROR' as any, '自定义错误消息');
      
      expect(error.getUserMessage()).toBe('自定义错误消息');
    });
  });

  describe('错误类型检查方法', () => {
    const error = new SkerError(
      ErrorCodes.NETWORK_ERROR,
      '网络错误',
      { severity: ErrorSeverity.CRITICAL }
    );

    it('isType - 应该正确识别错误类型', () => {
      expect(error.isType(ErrorCodes.NETWORK_ERROR)).toBe(true);
      expect(error.isType(ErrorCodes.DATABASE_ERROR)).toBe(false);
    });

    it('isCritical - 应该正确识别严重错误', () => {
      expect(error.isCritical()).toBe(true);
      
      const normalError = new SkerError(ErrorCodes.VALIDATION_ERROR, '验证错误');
      expect(normalError.isCritical()).toBe(false);
    });

    it('isRetryable - 应该正确识别可重试错误', () => {
      expect(error.isRetryable()).toBe(true);
      
      const nonRetryableError = new SkerError(ErrorCodes.VALIDATION_ERROR, '验证错误');
      expect(nonRetryableError.isRetryable()).toBe(false);
    });
  });
});

describe('ErrorFactory', () => {
  describe('toolNotFound', () => {
    it('应该创建工具未找到错误', () => {
      const context: ErrorContext = { operation: 'execute' };
      const error = ErrorFactory.toolNotFound('test_tool', context);

      expect(error.code).toBe(ErrorCodes.TOOL_NOT_FOUND);
      expect(error.message).toBe('工具 "test_tool" 未找到');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.context).toBe(context);
    });
  });

  describe('toolExecutionFailed', () => {
    it('应该创建工具执行失败错误', () => {
      const cause = new Error('执行异常');
      const error = ErrorFactory.toolExecutionFailed('test_tool', cause);

      expect(error.code).toBe(ErrorCodes.TOOL_EXECUTION_FAILED);
      expect(error.message).toBe('工具 "test_tool" 执行失败');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.cause).toBe(cause);
    });
  });

  describe('fileError', () => {
    it('应该根据原因创建正确的文件错误类型', () => {
      const enoentError = new Error('ENOENT: file not found');
      const error = ErrorFactory.fileError('/test/file.txt', 'read', enoentError);

      expect(error.code).toBe(ErrorCodes.FILE_NOT_FOUND);
      expect(error.message).toBe('文件操作失败: read "/test/file.txt"');
    });

    it('应该处理访问权限错误', () => {
      const eaccesError = new Error('EACCES: permission denied');
      const error = ErrorFactory.fileError('/test/file.txt', 'write', eaccesError);

      expect(error.code).toBe(ErrorCodes.FILE_ACCESS_DENIED);
    });
  });

  describe('wrap', () => {
    it('应该包装原生错误为SkerError', () => {
      const originalError = new Error('原始错误');
      const context: ErrorContext = { operation: 'test' };
      
      const wrappedError = ErrorFactory.wrap(
        originalError, 
        ErrorCodes.DATABASE_ERROR, 
        context
      );

      expect(wrappedError).toBeInstanceOf(SkerError);
      expect(wrappedError.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(wrappedError.message).toBe('原始错误');
      expect(wrappedError.cause).toBe(originalError);
      expect(wrappedError.context).toBe(context);
    });

    it('应该直接返回已存在的SkerError', () => {
      const skerError = new SkerError(ErrorCodes.VALIDATION_ERROR, '验证错误');
      const result = ErrorFactory.wrap(skerError);

      expect(result).toBe(skerError);
    });
  });
});

describe('ErrorUtils', () => {
  describe('formatForLog', () => {
    it('应该格式化SkerError用于日志记录', () => {
      const context: ErrorContext = { operation: 'test', resourceId: '123' };
      const error = new SkerError(
        ErrorCodes.DATABASE_ERROR,
        '连接失败',
        { severity: ErrorSeverity.HIGH, context }
      );

      const formatted = ErrorUtils.formatForLog(error);
      
      expect(formatted).toBe(
        '[DATABASE_ERROR:high] 连接失败 [{"operation":"test","resourceId":"123"}]'
      );
    });

    it('应该格式化普通错误', () => {
      const error = new Error('普通错误');
      const formatted = ErrorUtils.formatForLog(error);

      expect(formatted).toBe('[UNKNOWN_ERROR] 普通错误');
    });
  });

  describe('shouldLog', () => {
    it('应该对高严重性错误返回true', () => {
      const highError = new SkerError(
        ErrorCodes.DATABASE_ERROR,
        '严重错误',
        { severity: ErrorSeverity.HIGH }
      );
      
      expect(ErrorUtils.shouldLog(highError)).toBe(true);
    });

    it('应该对低严重性错误返回false', () => {
      const lowError = new SkerError(
        ErrorCodes.VALIDATION_ERROR,
        '轻微错误',
        { severity: ErrorSeverity.LOW }
      );
      
      expect(ErrorUtils.shouldLog(lowError)).toBe(false);
    });

    it('应该对普通错误返回true', () => {
      const error = new Error('普通错误');
      
      expect(ErrorUtils.shouldLog(error)).toBe(true);
    });
  });

  describe('getUserMessage', () => {
    it('应该返回SkerError的用户友好消息', () => {
      const error = new SkerError(ErrorCodes.NETWORK_ERROR, '网络连接失败');
      
      expect(ErrorUtils.getUserMessage(error)).toBe('网络连接失败');
    });

    it('应该对普通错误返回默认消息', () => {
      const error = new Error('技术错误');
      
      expect(ErrorUtils.getUserMessage(error)).toBe('操作失败，请稍后重试');
    });
  });

  describe('isRetryable', () => {
    it('应该正确识别可重试的SkerError', () => {
      const retryableError = new SkerError(ErrorCodes.NETWORK_ERROR, '网络错误');
      const nonRetryableError = new SkerError(ErrorCodes.VALIDATION_ERROR, '验证错误');
      
      expect(ErrorUtils.isRetryable(retryableError)).toBe(true);
      expect(ErrorUtils.isRetryable(nonRetryableError)).toBe(false);
    });

    it('应该对普通错误返回false', () => {
      const error = new Error('普通错误');
      
      expect(ErrorUtils.isRetryable(error)).toBe(false);
    });
  });
});