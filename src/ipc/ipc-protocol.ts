/**
 * 🟢 TDD 绿阶段：IPC 协议实现
 * 定义命令和响应格式、错误处理机制、版本控制
 */

import * as crypto from 'crypto';

/**
 * IPC 命令类型定义
 */
export type IPCCommand = 
  | 'ping'              // 心跳检测
  | 'status'            // 获取守护进程状态
  | 'start-watching'    // 开始文件监听
  | 'stop-watching'     // 停止文件监听
  | 'add-project'       // 添加项目监听
  | 'remove-project'    // 移除项目监听
  | 'list-projects'     // 列出所有项目
  | 'refresh-context'   // 刷新上下文
  | 'get-stats'         // 获取统计信息
  | 'shutdown';         // 关闭守护进程

/**
 * IPC 错误接口
 */
export interface IPCError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: Record<string, any>;
}

/**
 * IPC 消息基础接口
 */
export interface IPCMessage {
  /** 消息唯一标识符 */
  id: string;
  /** 消息类型 */
  type: 'request' | 'response';
  /** 协议版本 */
  version: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * IPC 请求接口
 */
export interface IPCRequest extends IPCMessage {
  type: 'request';
  /** 命令类型 */
  command: IPCCommand;
  /** 请求数据 */
  data: Record<string, any>;
}

/**
 * IPC 响应接口
 */
export interface IPCResponse extends IPCMessage {
  type: 'response';
  /** 请求是否成功 */
  success: boolean;
  /** 响应数据（成功时） */
  data?: Record<string, any>;
  /** 错误信息（失败时） */
  error?: IPCError;
}

/**
 * 消息大小验证结果接口
 */
export interface MessageSizeValidation {
  /** 是否有效 */
  valid: boolean;
  /** 消息大小（字节） */
  size: number;
  /** 错误信息（如果无效） */
  error?: IPCError;
}

/**
 * 当前协议版本
 */
const PROTOCOL_VERSION = '1.0';

/**
 * 最大消息大小（10MB）
 */
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

/**
 * 生成唯一的消息ID
 */
function generateMessageId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * 创建 IPC 请求消息
 * 
 * @param command 命令类型
 * @param data 请求数据
 * @returns IPC 请求对象
 */
export function createRequest(command: IPCCommand, data: Record<string, any> = {}): IPCRequest {
  return {
    id: generateMessageId(),
    type: 'request',
    version: PROTOCOL_VERSION,
    timestamp: Date.now(),
    command,
    data
  };
}

/**
 * 创建 IPC 响应消息
 * 
 * @param requestId 对应的请求ID
 * @param data 响应数据
 * @returns IPC 响应对象
 */
export function createResponse(requestId: string, data: Record<string, any> = {}): IPCResponse {
  return {
    id: requestId,
    type: 'response',
    version: PROTOCOL_VERSION,
    timestamp: Date.now(),
    success: true,
    data
  };
}

/**
 * 创建 IPC 错误响应消息
 * 
 * @param requestId 对应的请求ID
 * @param error 错误信息
 * @returns IPC 错误响应对象
 */
export function createErrorResponse(requestId: string, error: IPCError): IPCResponse {
  return {
    id: requestId,
    type: 'response',
    version: PROTOCOL_VERSION,
    timestamp: Date.now(),
    success: false,
    error
  };
}

/**
 * 验证 IPC 消息格式
 * 
 * @param message 消息对象
 * @returns 是否有效
 */
export function validateMessage(message: any): message is IPCMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  // 检查必需字段
  if (!message.id || !message.type || !message.version || !message.timestamp) {
    return false;
  }

  // 检查类型字段
  if (message.type !== 'request' && message.type !== 'response') {
    return false;
  }

  // 检查版本字段
  if (typeof message.version !== 'string') {
    return false;
  }

  // 检查时间戳字段
  if (typeof message.timestamp !== 'number') {
    return false;
  }

  // 如果是请求消息，检查命令字段
  if (message.type === 'request') {
    if (!message.command || typeof message.command !== 'string') {
      return false;
    }

    // 验证命令是否是有效的 IPCCommand
    const validCommands: IPCCommand[] = [
      'ping', 'status', 'start-watching', 'stop-watching',
      'add-project', 'remove-project', 'list-projects',
      'refresh-context', 'get-stats', 'shutdown'
    ];

    if (!validCommands.includes(message.command as IPCCommand)) {
      return false;
    }
  }

  // 如果是响应消息，检查成功字段
  if (message.type === 'response') {
    if (typeof message.success !== 'boolean') {
      return false;
    }
  }

  return true;
}

/**
 * 序列化 IPC 消息为 JSON 字符串
 * 
 * @param message 消息对象
 * @returns JSON 字符串
 */
export function serializeMessage(message: IPCMessage): string {
  return JSON.stringify(message);
}

/**
 * 反序列化 JSON 字符串为 IPC 消息
 * 
 * @param json JSON 字符串
 * @returns 消息对象
 */
export function deserializeMessage(json: string): IPCMessage {
  try {
    const parsed = JSON.parse(json);
    
    if (!validateMessage(parsed)) {
      throw new Error('Invalid message format');
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`Failed to deserialize message: ${(error as Error).message}`);
  }
}

/**
 * IPC 协议管理类
 */
export class IPCProtocol {
  private readonly version = PROTOCOL_VERSION;
  private readonly maxMessageSize = MAX_MESSAGE_SIZE;

  /**
   * 获取当前协议版本
   */
  getCurrentVersion(): string {
    return this.version;
  }

  /**
   * 检查版本是否兼容
   * 
   * @param version 要检查的版本
   * @returns 是否兼容
   */
  isVersionCompatible(version: string): boolean {
    // 目前只支持 1.0 版本
    return version === this.version;
  }

  /**
   * 处理版本不匹配
   * 
   * @param request 请求消息
   * @returns 错误响应
   */
  handleVersionMismatch(request: IPCRequest): IPCResponse {
    const error: IPCError = {
      code: 'VERSION_MISMATCH',
      message: `Unsupported protocol version: ${request.version}`,
      details: {
        requestVersion: request.version,
        supportedVersion: this.version
      }
    };

    return createErrorResponse(request.id, error);
  }

  /**
   * 获取最大消息大小
   */
  getMaxMessageSize(): number {
    return this.maxMessageSize;
  }

  /**
   * 验证消息大小
   * 
   * @param message 消息对象
   * @returns 验证结果
   */
  validateMessageSize(message: IPCMessage): MessageSizeValidation {
    const serialized = serializeMessage(message);
    const size = Buffer.byteLength(serialized, 'utf8');

    if (size > this.maxMessageSize) {
      return {
        valid: false,
        size,
        error: {
          code: 'MESSAGE_TOO_LARGE',
          message: `Message size ${size} bytes exceeds maximum ${this.maxMessageSize} bytes`,
          details: {
            messageSize: size,
            maxSize: this.maxMessageSize
          }
        }
      };
    }

    return {
      valid: true,
      size
    };
  }
}