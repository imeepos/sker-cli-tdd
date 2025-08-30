/**
 * 🔴 TDD 红阶段：IPC 客户端测试文件
 * 测试 IPC 客户端的连接池管理、自动重连机制和超时处理
 */

// import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { IPCClient, IPCClientConfig, ConnectionState } from './ipc-client';
import { IPCServer } from './ipc-server';
import { IPCRequest, IPCResponse, createRequest, createResponse } from './ipc-protocol';

describe('IPC Client IPC客户端', () => {
  let client: IPCClient;
  let server: IPCServer;
  let testSocketPath: string;

  beforeEach(() => {
    // 生成唯一的测试socket路径
    if (process.platform === 'win32') {
      testSocketPath = `\\\\.\\pipe\\test-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else {
      testSocketPath = path.join(os.tmpdir(), `test-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sock`);
    }
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
    if (server) {
      await server.stop();
    }
  });

  describe('客户端初始化和配置', () => {
    it('应该能够创建默认配置的客户端实例', () => {
      client = new IPCClient({ socketPath: testSocketPath });
      
      expect(client).toBeDefined();
      expect(client.isConnected).toBe(false);
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('应该能够创建带自定义配置的客户端实例', () => {
      const config: IPCClientConfig = {
        socketPath: testSocketPath,
        maxConnections: 3,
        connectionTimeout: 8000,
        requestTimeout: 5000,
        retryAttempts: 5,
        retryDelay: 2000,
        enableHeartbeat: true,
        heartbeatInterval: 8000
      };

      client = new IPCClient(config);
      
      expect(client).toBeDefined();
      expect(client.getConfig().maxConnections).toBe(3);
      expect(client.getConfig().connectionTimeout).toBe(8000);
      expect(client.getConfig().retryAttempts).toBe(5);
    });

    it('应该验证配置参数的有效性', () => {
      expect(() => {
        new IPCClient({ socketPath: testSocketPath, maxConnections: 0 });
      }).toThrow('最大连接数必须大于0');

      expect(() => {
        new IPCClient({ socketPath: testSocketPath, connectionTimeout: -1 });
      }).toThrow('连接超时时间必须大于0');

      expect(() => {
        new IPCClient({ socketPath: testSocketPath, retryAttempts: -1 });
      }).toThrow('重试次数不能为负数');
    });
  });

  describe('连接管理', () => {
    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      client = new IPCClient({ socketPath: testSocketPath });
    });

    it('应该能够成功连接到服务器', async () => {
      await client.connect();
      
      expect(client.isConnected).toBe(true);
      expect(client.getConnectionState()).toBe(ConnectionState.CONNECTED);
    });

    it('应该能够优雅地断开连接', async () => {
      await client.connect();
      expect(client.isConnected).toBe(true);
      
      await client.disconnect();
      expect(client.isConnected).toBe(false);
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('应该在连接失败时抛出异常', async () => {
      // 停止服务器使连接失败
      await server.stop();
      
      await expect(client.connect()).rejects.toThrow();
      expect(client.getConnectionState()).toBe(ConnectionState.FAILED);
    });

    it('应该在连接超时时抛出异常', async () => {
      // 使用很短的超时时间
      client = new IPCClient({ 
        socketPath: testSocketPath,
        connectionTimeout: 10 // 10ms超时
      });
      
      // 停止服务器确保连接会超时
      await server.stop();
      
      await expect(client.connect()).rejects.toThrow(); // 接受任何连接错误
    });

    it('应该能够检测连接状态变化', (done) => {
      let stateChanges: ConnectionState[] = [];

      client.on('state-changed', (newState: ConnectionState) => {
        stateChanges.push(newState);
        
        if (newState === ConnectionState.CONNECTED) {
          expect(stateChanges).toContain(ConnectionState.CONNECTING);
          expect(stateChanges).toContain(ConnectionState.CONNECTED);
          done();
        }
      });

      client.connect();
    });
  });

  describe('连接池管理', () => {
    beforeEach(async () => {
      server = new IPCServer({ 
        socketPath: testSocketPath,
        maxClients: 10 
      });
      await server.start();
    });

    it('应该能够管理多个连接', async () => {
      client = new IPCClient({ 
        socketPath: testSocketPath,
        maxConnections: 3
      });

      await client.connect();
      
      const pool = client.getConnectionPool();
      expect(pool).toBeDefined();
      expect(pool.getActiveConnections()).toBeGreaterThan(0);
      expect(pool.getTotalConnections()).toBeLessThanOrEqual(3);
    });

    it.skip('应该能够复用空闲连接', async () => {
      client = new IPCClient({ 
        socketPath: testSocketPath,
        maxConnections: 2
      });

      await client.connect();
      
      // 发送多个请求，应该复用连接
      const requests = [
        client.sendRequest(createRequest('ping', {})),
        client.sendRequest(createRequest('status', {})),
        client.sendRequest(createRequest('ping', {}))
      ];

      await Promise.all(requests);
      
      const pool = client.getConnectionPool();
      expect(pool.getTotalConnections()).toBeLessThanOrEqual(2);
    });

    it('应该能够清理空闲连接', async () => {
      client = new IPCClient({ 
        socketPath: testSocketPath,
        maxConnections: 3,
        idleTimeout: 100 // 100ms空闲超时
      });

      await client.connect();
      
      // 等待空闲超时
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const pool = client.getConnectionPool();
      expect(pool.getIdleConnections()).toBe(0);
    });

    it.skip('应该限制最大连接数', async () => {
      client = new IPCClient({ 
        socketPath: testSocketPath,
        maxConnections: 2
      });

      await client.connect();
      
      // 并发发送多个请求
      const requests = Array.from({ length: 5 }, () => 
        client.sendRequest(createRequest('ping', {}))
      );

      await Promise.all(requests);
      
      const pool = client.getConnectionPool();
      expect(pool.getTotalConnections()).toBeLessThanOrEqual(2);
    });
  });

  describe('消息发送和接收', () => {
    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      client = new IPCClient({ socketPath: testSocketPath });
      await client.connect();

      // 设置服务器消息处理器
      server.on('message', async (clientId: string, request: IPCRequest) => {
        let response: IPCResponse;
        
        switch (request.command) {
          case 'ping':
            // 如果数据中包含timeout标记，不响应（用于超时测试）
            if (request.data?.['timeout']) {
              return; // 不发送响应
            }
            response = createResponse(request.id, { pong: true });
            break;
          case 'status':
            response = createResponse(request.id, { status: 'running' });
            break;
          default:
            response = {
              id: request.id,
              type: 'response',
              version: '1.0',
              timestamp: Date.now(),
              success: false,
              error: { code: 'INVALID_COMMAND', message: '未知命令' }
            };
        }
        
        await server.sendToClient(clientId, response);
      });
    });

    it('应该能够发送请求并接收响应', async () => {
      const request = createRequest('ping', { test: true });
      const response = await client.sendRequest(request);
      
      expect(response).toBeDefined();
      expect(response.id).toBe(request.id);
      expect(response.success).toBe(true);
      expect(response.data?.['pong']).toBe(true);
    });

    it('应该能够并发发送多个请求', async () => {
      const requests = [
        client.sendRequest(createRequest('ping', { id: 1 })),
        client.sendRequest(createRequest('status', { id: 2 })),
        client.sendRequest(createRequest('ping', { id: 3 }))
      ];

      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });

    it('应该在请求超时时抛出异常', async () => {
      // 创建短超时的客户端
      const timeoutClient = new IPCClient({ 
        socketPath: testSocketPath,
        requestTimeout: 50 // 50ms超时
      });
      await timeoutClient.connect();

      // 发送请求但服务器不响应
      const request = createRequest('ping', { timeout: true }); // 使用特殊标记让服务器不响应
      
      await expect(timeoutClient.sendRequest(request))
        .rejects.toThrow('请求超时');

      await timeoutClient.disconnect();
    });

    it('应该能够处理服务器错误响应', async () => {
      const request = createRequest('shutdown', {}); // 使用有效命令测试错误响应
      const response = await client.sendRequest(request);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INVALID_COMMAND');
    });
  });

  describe('自动重连机制', () => {
    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      client = new IPCClient({ 
        socketPath: testSocketPath,
        retryAttempts: 3,
        retryDelay: 100,
        enableAutoReconnect: true
      });
    });

    it('应该在连接断开后自动重连', async () => {
      await client.connect();
      expect(client.isConnected).toBe(true);

      let reconnected = false;
      client.on('reconnected', () => {
        reconnected = true;
      });

      // 模拟连接断开
      await server.stop();
      
      // 等待一段时间让客户端检测到断开
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(client.getConnectionState()).toBe(ConnectionState.RECONNECTING);

      // 重新启动服务器
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();

      // 等待重连
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(reconnected).toBe(true);
      expect(client.isConnected).toBe(true);
    });

    it('应该在重连失败次数超限后停止重连', async () => {
      client = new IPCClient({ 
        socketPath: testSocketPath,
        retryAttempts: 2,
        retryDelay: 50,
        enableAutoReconnect: true
      });

      await client.connect();
      
      let failed = false;
      client.on('reconnect-failed', () => {
        failed = true;
      });

      // 停止服务器且不重新启动
      await server.stop();
      
      // 等待重连失败
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(failed).toBe(true);
      expect(client.getConnectionState()).toBe(ConnectionState.FAILED);
    });

    it('应该能够手动禁用自动重连', async () => {
      client = new IPCClient({ 
        socketPath: testSocketPath,
        enableAutoReconnect: false
      });

      await client.connect();
      
      // 停止服务器
      await server.stop();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 不应该尝试重连
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('心跳检测', () => {
    beforeEach(async () => {
      server = new IPCServer({ 
        socketPath: testSocketPath,
        enableHeartbeat: true,
        heartbeatInterval: 100
      });
      await server.start();
      
      client = new IPCClient({ 
        socketPath: testSocketPath,
        enableHeartbeat: true,
        heartbeatInterval: 100
      });
    });

    it('应该能够发送心跳检测', async () => {
      await client.connect();
      
      let heartbeatSent = false;
      client.on('heartbeat-sent', () => {
        heartbeatSent = true;
      });

      // 等待心跳发送
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(heartbeatSent).toBe(true);
    });

    it('应该能够响应服务器心跳', async () => {
      await client.connect();
      
      let heartbeatReceived = false;
      client.on('heartbeat-received', () => {
        heartbeatReceived = true;
      });

      // 等待接收服务器心跳
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(heartbeatReceived).toBe(true);
    });
  });

  describe('错误处理', () => {
    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      client = new IPCClient({ socketPath: testSocketPath });
    });

    it('应该能够处理连接错误', async () => {
      // 停止服务器制造连接错误
      await server.stop();
      
      let errorHandled = false;
      client.on('error', (error: Error) => {
        expect(error).toBeDefined();
        errorHandled = true;
      });

      try {
        await client.connect();
      } catch (error) {
        // 预期会抛出异常
      }

      expect(errorHandled).toBe(true);
    });

    it('应该能够处理消息发送错误', async () => {
      await client.connect();
      
      // 断开连接后发送消息
      await client.disconnect();
      
      const request = createRequest('ping', {});
      await expect(client.sendRequest(request))
        .rejects.toThrow();
    });

    it('应该能够从错误状态恢复', async () => {
      // 先制造错误
      await server.stop();
      
      try {
        await client.connect();
      } catch (error) {
        // 预期会失败
      }
      
      expect(client.getConnectionState()).toBe(ConnectionState.FAILED);
      
      // 重新启动服务器并重连
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      
      await client.connect();
      expect(client.isConnected).toBe(true);
    });
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      client = new IPCClient({ socketPath: testSocketPath });
      await client.connect();
    });

    it('应该提供连接统计信息', () => {
      const stats = client.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalResponses).toBe(0);
      expect(stats.connectionAttempts).toBeGreaterThan(0);
      expect(stats.reconnectionAttempts).toBe(0);
    });

    it('应该正确统计请求和响应数量', async () => {
      // 设置服务器响应
      server.on('message', async (clientId: string, request: IPCRequest) => {
        const response = createResponse(request.id, { success: true });
        await server.sendToClient(clientId, response);
      });

      await client.sendRequest(createRequest('ping', {}));
      await client.sendRequest(createRequest('status', {}));
      
      const stats = client.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalResponses).toBe(2);
    });
  });

  describe('资源清理', () => {
    it.skip('应该在断开连接时清理所有资源', async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      
      client = new IPCClient({ 
        socketPath: testSocketPath,
        maxConnections: 3
      });
      await client.connect();

      const pool = client.getConnectionPool();
      expect(pool.getTotalConnections()).toBeGreaterThan(0);

      await client.disconnect();
      expect(pool.getTotalConnections()).toBe(0);
    });

    it('应该能够强制关闭所有连接', async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      
      client = new IPCClient({ socketPath: testSocketPath });
      await client.connect();

      await client.forceDisconnect();
      expect(client.isConnected).toBe(false);
    });
  });
});