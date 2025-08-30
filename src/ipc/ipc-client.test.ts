/**
 * 🔴 TDD 红阶段：IPC客户端测试
 * 使用sinon专业Mock工具库，解决超时和异步问题
 */

import { IPCClient, ConnectionState, IPCClientConfig } from './ipc-client';
import { createRequest } from './ipc-protocol';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';

// Mock net module using jest
jest.mock('net');

// 使用sinon创建可控的Socket Mock
class MockSocket extends EventEmitter {
  destroyed = false;
  connecting = false;
  readyState = 'closed';
  remoteAddress?: string;
  remotePort?: number;
  
  write = sinon.stub().returns(true);
  end = sinon.stub().callsFake(() => {
    this.readyState = 'closed';
    this.emit('close');
    return this;
  });
  destroy = sinon.stub().callsFake(() => {
    this.destroyed = true;
    this.readyState = 'closed';
    this.emit('close');
    return this;
  });
  setTimeout = sinon.stub().returns(this);
  setKeepAlive = sinon.stub().returns(this);
  setNoDelay = sinon.stub().returns(this);
  
  connect(_port: number | string, _host?: string, callback?: () => void): this {
    this.connecting = true;
    this.readyState = 'opening';
    
    // 连接事件由net.createConnection的mock触发，这里只更新状态
    if (callback) {
      this.once('connect', callback);
    }
    
    return this;
  }
  
  // 手动触发连接成功
  simulateConnect() {
    this.connecting = false;
    this.readyState = 'open';
    this.emit('connect');
  }
  
  // 手动触发错误
  simulateError(error: Error) {
    this.emit('error', error);
  }
}

describe('IPC Client 基础功能测试', () => {
  let client: IPCClient;
  let mockSocket: MockSocket;
  const testSocketPath = '/tmp/test-ipc.sock';

  // 获取mocked net module
  const net = require('net');

  beforeEach(() => {
    // 重置所有mock调用历史
    jest.clearAllMocks();
    
    // 创建新的mock socket
    mockSocket = new MockSocket();
    
    // 配置net.createConnection mock - 返回socket并立即触发connect事件
    net.createConnection = jest.fn().mockImplementation(() => {
      // 使用setImmediate确保connect事件在下一个事件循环中触发
      setImmediate(() => {
        mockSocket.connecting = false;
        mockSocket.readyState = 'open';
        mockSocket.emit('connect');
      });
      return mockSocket;
    });
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('客户端初始化和配置', () => {
    it('应该能够创建IPC客户端实例并具有默认配置', () => {
      client = new IPCClient({ socketPath: testSocketPath });
      expect(client).toBeInstanceOf(IPCClient);
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
      
      const config = client.getConfig();
      expect(config.socketPath).toBe(testSocketPath);
      expect(config.maxConnections).toBe(10); // 检查默认值
    });

    it('应该能够使用自定义配置创建客户端', () => {
      const customConfig: IPCClientConfig = {
        socketPath: testSocketPath,
        maxConnections: 5,
        connectionTimeout: 3000,
        requestTimeout: 2000
      };
      client = new IPCClient(customConfig);
      const clientConfig = client.getConfig();
      
      expect(clientConfig.maxConnections).toBe(5);
      expect(clientConfig.connectionTimeout).toBe(3000);
      expect(clientConfig.requestTimeout).toBe(2000);
    });

    it('应该验证配置参数的有效性', () => {
      expect(() => { new IPCClient({ socketPath: '' }); }).toThrow('Socket路径不能为空');
      expect(() => { new IPCClient({ socketPath: testSocketPath, maxConnections: 0 }); }).toThrow('最大连接数必须大于0');
    });
  });

  describe('连接状态管理', () => {
    beforeEach(() => {
      client = new IPCClient({ socketPath: testSocketPath });
    });

    it('应该正确返回初始连接状态', () => {
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
      expect(client.isConnected).toBe(false);
    });

    it('应该在连接成功时更新状态', async () => {
      const connectPromise = client.connect();
      
      // connect方法内部已经通过setImmediate触发连接，直接等待即可
      await connectPromise;
      
      expect(client.getConnectionState()).toBe(ConnectionState.CONNECTED);
      expect(client.isConnected).toBe(true);
    });

    it('应该能够获取连接池实例', () => {
      const pool = client.getConnectionPool();
      expect(pool).toBeDefined();
      expect(pool.getTotalConnections()).toBe(0);
    });
  });

  describe('统计信息', () => {
    beforeEach(() => {
      client = new IPCClient({ socketPath: testSocketPath });
    });

    it('应该返回初始统计信息', () => {
      const stats = client.getStats();
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalResponses).toBe(0);
      expect(stats.connectionAttempts).toBe(0);
      expect(stats.reconnectionAttempts).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.heartbeatsSent).toBe(0);
      expect(stats.heartbeatsReceived).toBe(0);
    });
  });

  describe('请求创建', () => {
    it('应该能够创建请求', () => {
      const request = createRequest('ping', { data: 'test' });
      
      expect(request.id).toBeDefined();
      expect(request.command).toBe('ping');
      expect(request.data).toEqual({ data: 'test' });
      expect(request.timestamp).toBeDefined();
    });
  });
});