/**
 * 🔄 TDD 重构阶段：统一错误处理系统
 * 提供结构化的错误分类和统一的错误处理机制
 */

/**
 * Sker系统错误代码枚举
 * 提供标准化的错误分类
 */
export const ErrorCodes = {
  // 工具相关错误
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  TOOL_INVALID_PARAMS: 'TOOL_INVALID_PARAMS',

  // 配置相关错误
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_PARSE_ERROR: 'CONFIG_PARSE_ERROR',

  // 数据库相关错误
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_OPERATION_FAILED: 'DATABASE_OPERATION_FAILED',

  // 文件系统相关错误
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  FILE_OPERATION_FAILED: 'FILE_OPERATION_FAILED',

  // 网络相关错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',

  // MQ Agent相关错误
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_CONNECTION_FAILED: 'AGENT_CONNECTION_FAILED',
  TASK_EXECUTION_FAILED: 'TASK_EXECUTION_FAILED',

  // AI相关错误
  AI_CLIENT_ERROR: 'AI_CLIENT_ERROR',
  AI_API_ERROR: 'AI_API_ERROR',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',

  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

/**
 * 错误代码类型
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * 错误严重程度枚举
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 错误上下文信息接口
 */
export interface ErrorContext {
  /** 操作名称 */
  operation?: string;
  /** 相关资源ID */
  resourceId?: string;
  /** 用户ID */
  userId?: string;
  /** 请求ID */
  requestId?: string;
  /** 额外的上下文数据 */
  metadata?: Record<string, any>;
}

/**
 * Sker系统统一错误类
 * 提供结构化的错误信息和标准化的错误处理
 */
export class SkerError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context?: ErrorContext;
  public override readonly cause?: Error;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'SkerError';
    this.code = code;
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.context = options.context;
    this.cause = options.cause;
    this.timestamp = new Date();

    // 确保堆栈跟踪正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SkerError);
    }
  }

  /**
   * 将错误转换为JSON格式
   * 便于日志记录和API响应
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      ...(this.cause && {
        cause:
          this.cause instanceof SkerError
            ? this.cause.toJSON()
            : {
                name: this.cause.name,
                message: this.cause.message,
                stack: this.cause.stack,
              },
      }),
    };
  }

  /**
   * 获取用户友好的错误消息
   * 隐藏敏感的技术细节
   */
  getUserMessage(): string {
    const userMessages: Record<ErrorCode, string> = {
      [ErrorCodes.TOOL_NOT_FOUND]: '请求的工具不存在',
      [ErrorCodes.TOOL_EXECUTION_FAILED]: '工具执行失败，请稍后重试',
      [ErrorCodes.TOOL_INVALID_PARAMS]: '参数无效，请检查输入',
      [ErrorCodes.CONFIG_INVALID]: '配置无效',
      [ErrorCodes.CONFIG_MISSING]: '缺少必需的配置',
      [ErrorCodes.CONFIG_PARSE_ERROR]: '配置解析错误',
      [ErrorCodes.DATABASE_ERROR]: '数据库操作失败',
      [ErrorCodes.DATABASE_CONNECTION_FAILED]: '数据库连接失败',
      [ErrorCodes.DATABASE_OPERATION_FAILED]: '数据库操作失败',
      [ErrorCodes.FILE_NOT_FOUND]: '文件未找到',
      [ErrorCodes.FILE_ACCESS_DENIED]: '文件访问被拒绝',
      [ErrorCodes.FILE_OPERATION_FAILED]: '文件操作失败',
      [ErrorCodes.NETWORK_ERROR]: '网络连接失败',
      [ErrorCodes.API_ERROR]: 'API调用失败',
      [ErrorCodes.CONNECTION_TIMEOUT]: '连接超时',
      [ErrorCodes.AGENT_NOT_FOUND]: 'Agent不存在',
      [ErrorCodes.AGENT_CONNECTION_FAILED]: 'Agent连接失败',
      [ErrorCodes.TASK_EXECUTION_FAILED]: '任务执行失败',
      [ErrorCodes.AI_CLIENT_ERROR]: 'AI客户端错误',
      [ErrorCodes.AI_API_ERROR]: 'AI服务错误',
      [ErrorCodes.AI_INVALID_RESPONSE]: 'AI响应无效',
      [ErrorCodes.UNKNOWN_ERROR]: '未知错误',
      [ErrorCodes.VALIDATION_ERROR]: '输入验证失败',
      [ErrorCodes.PERMISSION_DENIED]: '权限不足',
    };

    return userMessages[this.code] || this.message;
  }

  /**
   * 检查错误是否为指定类型
   */
  isType(code: ErrorCode): boolean {
    return this.code === code;
  }

  /**
   * 检查错误是否为严重错误
   */
  isCritical(): boolean {
    return this.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * 检查错误是否可重试
   * 基于错误类型判断是否值得重试
   */
  isRetryable(): boolean {
    const retryableErrors: ErrorCode[] = [
      ErrorCodes.NETWORK_ERROR,
      ErrorCodes.CONNECTION_TIMEOUT,
      ErrorCodes.DATABASE_CONNECTION_FAILED,
      ErrorCodes.API_ERROR,
      ErrorCodes.AGENT_CONNECTION_FAILED,
    ];

    return retryableErrors.includes(this.code);
  }
}

/**
 * 错误工厂类
 * 提供快速创建常见错误的方法
 */
export class ErrorFactory {
  /**
   * 创建工具未找到错误
   */
  static toolNotFound(toolName: string, context?: ErrorContext): SkerError {
    return new SkerError(
      ErrorCodes.TOOL_NOT_FOUND,
      `工具 "${toolName}" 未找到`,
      { severity: ErrorSeverity.MEDIUM, context }
    );
  }

  /**
   * 创建工具执行失败错误
   */
  static toolExecutionFailed(
    toolName: string,
    cause?: Error,
    context?: ErrorContext
  ): SkerError {
    return new SkerError(
      ErrorCodes.TOOL_EXECUTION_FAILED,
      `工具 "${toolName}" 执行失败`,
      { severity: ErrorSeverity.HIGH, cause, context }
    );
  }

  /**
   * 创建参数验证错误
   */
  static invalidParams(paramName: string, context?: ErrorContext): SkerError {
    return new SkerError(
      ErrorCodes.TOOL_INVALID_PARAMS,
      `参数 "${paramName}" 无效`,
      { severity: ErrorSeverity.LOW, context }
    );
  }

  /**
   * 创建配置错误
   */
  static configError(
    configKey: string,
    cause?: Error,
    context?: ErrorContext
  ): SkerError {
    return new SkerError(
      ErrorCodes.CONFIG_INVALID,
      `配置项 "${configKey}" 无效`,
      { severity: ErrorSeverity.HIGH, cause, context }
    );
  }

  /**
   * 创建数据库错误
   */
  static databaseError(
    operation: string,
    cause?: Error,
    context?: ErrorContext
  ): SkerError {
    return new SkerError(
      ErrorCodes.DATABASE_ERROR,
      `数据库操作 "${operation}" 失败`,
      { severity: ErrorSeverity.HIGH, cause, context }
    );
  }

  /**
   * 创建文件操作错误
   */
  static fileError(
    path: string,
    operation: string,
    cause?: Error,
    context?: ErrorContext
  ): SkerError {
    const code = cause?.message.includes('ENOENT')
      ? ErrorCodes.FILE_NOT_FOUND
      : cause?.message.includes('EACCES')
        ? ErrorCodes.FILE_ACCESS_DENIED
        : ErrorCodes.FILE_OPERATION_FAILED;

    return new SkerError(code, `文件操作失败: ${operation} "${path}"`, {
      severity: ErrorSeverity.MEDIUM,
      cause,
      context,
    });
  }

  /**
   * 创建Agent错误
   */
  static agentError(
    agentId: string,
    operation: string,
    cause?: Error,
    context?: ErrorContext
  ): SkerError {
    return new SkerError(
      ErrorCodes.AGENT_NOT_FOUND,
      `Agent "${agentId}" ${operation}失败`,
      { severity: ErrorSeverity.MEDIUM, cause, context }
    );
  }

  /**
   * 包装原生错误为SkerError
   */
  static wrap(
    error: Error,
    code: ErrorCode = ErrorCodes.UNKNOWN_ERROR,
    context?: ErrorContext
  ): SkerError {
    if (error instanceof SkerError) {
      return error;
    }

    return new SkerError(code, error.message, { cause: error, context });
  }
}

/**
 * 错误处理实用工具
 */
export class ErrorUtils {
  /**
   * 格式化错误信息用于日志记录
   */
  static formatForLog(error: Error): string {
    if (error instanceof SkerError) {
      const context = error.context
        ? ` [${JSON.stringify(error.context)}]`
        : '';
      return `[${error.code}:${error.severity}] ${error.message}${context}`;
    }

    return `[${ErrorCodes.UNKNOWN_ERROR}] ${error.message}`;
  }

  /**
   * 检查错误是否需要记录到日志
   */
  static shouldLog(error: Error): boolean {
    if (error instanceof SkerError) {
      return (
        error.severity === ErrorSeverity.HIGH ||
        error.severity === ErrorSeverity.CRITICAL
      );
    }
    return true;
  }

  /**
   * 从错误中提取用户友好的消息
   */
  static getUserMessage(error: Error): string {
    if (error instanceof SkerError) {
      return error.getUserMessage();
    }
    return '操作失败，请稍后重试';
  }

  /**
   * 检查错误是否可以重试
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof SkerError) {
      return error.isRetryable();
    }
    return false;
  }
}
