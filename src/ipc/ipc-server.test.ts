/**
 * 🔴 TDD 红阶段：IPC 服务器测试文件
 * 测试 IPC 服务器的连接管理、消息处理和多客户端支持
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IPCServer, IPCServerConfig, ClientConnection } from './ipc-server';
import { IPCRequest, IPCResponse, createRequest } from './ipc-protocol';

describe('IPC Server IPC服务器', () => {
  let server: IPCServer;
  let testSocketPath: string;

  beforeEach(() => {
    // 生成临时socket路径
    if (process.platform === 'win32') {
      // Windows下使用Named Pipe
      testSocketPath = `\\\\.\\pipe\\test-ipc-${Date.now()}`;
    } else {
      // Unix系统使用Unix Socket
      testSocketPath = path.join(os.tmpdir(), `test-ipc-${Date.now()}.sock`);
    }
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    
    // 清理socket文件（只在Unix系统需要）
    try {
      if (process.platform !== 'win32') {
        await fs.promises.unlink(testSocketPath);
      }
    } catch {
      // 忽略清理错误
    }
  });

  describe('服务器初始化和配置', () => {
    it('应该能够创建默认配置的服务器实例', () => {
      server = new IPCServer();
      
      expect(server).toBeDefined();
      expect(server.isRunning).toBe(false);
      expect(server.getClientCount()).toBe(0);
    });

    it('应该能够创建带自定义配置的服务器实例', () => {
      const config: IPCServerConfig = {
        socketPath: testSocketPath,
        maxClients: 50,
        connectionTimeout: 10000,
        enableHeartbeat: true,
        heartbeatInterval: 5000,
        maxMessageSize: 2 * 1024 * 1024
      };

      server = new IPCServer(config);
      
      expect(server).toBeDefined();
      expect(server.getConfig().maxClients).toBe(50);
      expect(server.getConfig().connectionTimeout).toBe(10000);
    });

    it('应该验证配置参数的有效性', () => {
      expect(() => {
        new IPCServer({ maxClients: -1 });
      }).toThrow('最大客户端数量必须大于0');

      expect(() => {
        new IPCServer({ connectionTimeout: -1 });
      }).toThrow('连接超时时间必须大于0');
    });
  });

  describe('服务器启动和停止', () => {
    it('应该能够启动服务器并监听连接', async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      
      await server.start();
      
      expect(server.isRunning).toBe(true);
      // Windows Named Pipe不会创建文件系统文件
      if (process.platform !== 'win32') {
        expect(fs.existsSync(testSocketPath)).toBe(true);
      }
    });

    it('应该能够优雅地停止服务器', async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      
      await server.start();
      expect(server.isRunning).toBe(true);
      
      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('应该在端口被占用时抛出异常', async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();

      const server2 = new IPCServer({ socketPath: testSocketPath });
      
      await expect(server2.start()).rejects.toThrow();
    });

    it('应该在启动时清理遗留的socket文件', async () => {
      // 只在Unix系统测试遗留文件清理
      if (process.platform === 'win32') {
        // Windows下跳过此测试
        return;
      }
      
      // 创建一个遗留的socket文件
      await fs.promises.writeFile(testSocketPath, '');
      expect(fs.existsSync(testSocketPath)).toBe(true);

      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
      
      expect(server.isRunning).toBe(true);
    });
  });

  describe('客户端连接管理', () => {
    beforeEach(async () => {
      server = new IPCServer({ 
        socketPath: testSocketPath,
        maxClients: 3
      });
      await server.start();
    });

    it('应该能够接受客户端连接', (done) => {
      server.on('client-connected', (client: ClientConnection) => {
        expect(client).toBeDefined();
        expect(client.id).toBeDefined();
        expect(client.connectedAt).toBeInstanceOf(Date);
        expect(server.getClientCount()).toBe(1);
        done();
      });

      const client = net.createConnection(testSocketPath);
      client.on('connect', () => {
        // 连接成功
      });
    });

    it('应该能够跟踪多个客户端连接', async () => {
      const clients: net.Socket[] = [];
      let connectedCount = 0;

      server.on('client-connected', () => {
        connectedCount++;
      });

      // 创建3个并发连接
      for (let i = 0; i < 3; i++) {
        const client = net.createConnection(testSocketPath);
        clients.push(client);
      }

      // 等待连接建立
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(connectedCount).toBe(3);
      expect(server.getClientCount()).toBe(3);

      // 清理连接
      clients.forEach(client => client.destroy());
    });

    it('应该拒绝超过最大客户端数量的连接', async () => {
      const clients: net.Socket[] = [];

      // 创建最大数量的连接
      for (let i = 0; i < 3; i++) {
        const client = net.createConnection(testSocketPath);
        clients.push(client);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(server.getClientCount()).toBe(3);

      // 尝试创建第4个连接
      let rejected = false;
      server.on('client-rejected', (reason: string) => {
        expect(reason).toBe('超过最大客户端连接数');
        rejected = true;
      });

      const extraClient = net.createConnection(testSocketPath);
      extraClient.on('error', () => {
        // 连接被拒绝
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(rejected).toBe(true);

      // 清理连接
      clients.forEach(client => client.destroy());
      extraClient.destroy();
    });

    it('应该在客户端断开连接时清理资源', (done) => {
      let clientId: string;

      server.on('client-connected', (client: ClientConnection) => {
        clientId = client.id;
        expect(server.getClientCount()).toBe(1);
      });

      server.on('client-disconnected', (disconnectedClientId: string, _reason: string) => {
        expect(disconnectedClientId).toBe(clientId);
        expect(server.getClientCount()).toBe(0);
        done();
      });

      const client = net.createConnection(testSocketPath);
      client.on('connect', () => {
        // 延迟断开连接
        setTimeout(() => client.destroy(), 50);
      });
    });
  });

  describe('消息处理', () => {
    let testClient: net.Socket;

    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();

      testClient = net.createConnection(testSocketPath);
      await new Promise(resolve => testClient.on('connect', resolve));
    });

    afterEach(() => {
      if (testClient) {
        testClient.destroy();
      }
    });

    it('应该能够接收和解析客户端消息', (done) => {
      const testRequest = createRequest('ping', { message: 'test' });

      server.on('message', (clientId: string, request: IPCRequest) => {
        expect(clientId).toBeDefined();
        expect(request.command).toBe('ping');
        expect(request.data['message']).toBe('test');
        done();
      });

      const messageData = JSON.stringify(testRequest) + '\n';
      testClient.write(messageData);
    });

    it('应该能够向客户端发送响应', async () => {
      const testRequest = createRequest('status', {});
      let responseReceived = false;

      // 设置响应处理器
      testClient.on('data', (data) => {
        const response: IPCResponse = JSON.parse(data.toString().trim());
        expect(response.id).toBe(testRequest.id);
        expect(response.success).toBe(true);
        expect(response.data?.['status']).toBe('running');
        responseReceived = true;
      });

      // 设置消息处理器
      server.on('message', async (clientId: string, request: IPCRequest) => {
        const response: IPCResponse = {
          id: request.id,
          type: 'response',
          version: '1.0',
          timestamp: Date.now(),
          success: true,
          data: { status: 'running' }
        };

        await server.sendToClient(clientId, response);
      });

      // 发送请求
      const messageData = JSON.stringify(testRequest) + '\n';
      testClient.write(messageData);

      // 等待响应
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(responseReceived).toBe(true);
    });

    it('应该处理无效的消息格式', (done) => {
      server.on('message-error', (_clientId: string, error: Error) => {
        expect(_clientId).toBeDefined();
        expect(error.message).toContain('Failed to deserialize message');
        done();
      });

      // 发送无效JSON
      testClient.write('{ invalid json }\n');
    });

    it('应该处理超大消息', (done) => {
      // 为单独测试创建新的唯一socket路径
      const uniqueSocketPath = process.platform === 'win32' 
        ? `\\\\.\\pipe\\test-large-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : path.join(os.tmpdir(), `test-large-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sock`);
      server = new IPCServer({ 
        socketPath: uniqueSocketPath,
        maxMessageSize: 1024 // 1KB限制
      });

      server.start().then(() => {
        const client = net.createConnection(uniqueSocketPath);
        
        server.on('message-error', (_clientId: string, error: Error) => {
          expect(error.message).toContain('Message too large');
          done();
        });

        client.on('connect', () => {
          // 发送超大消息
          const largeData = 'x'.repeat(2048);
          const largeRequest = createRequest('ping', { data: largeData });
          const messageData = JSON.stringify(largeRequest) + '\n';
          client.write(messageData);
        });
      });
    });
  });

  describe('心跳检测', () => {
    beforeEach(async () => {
      server = new IPCServer({
        socketPath: testSocketPath,
        enableHeartbeat: true,
        heartbeatInterval: 100 // 快速心跳用于测试
      });
      await server.start();
    });

    it('应该定期发送心跳消息', (done) => {
      const client = net.createConnection(testSocketPath);
      // let heartbeatReceived = false;

      client.on('data', (data) => {
        const message = JSON.parse(data.toString().trim());
        if (message.command === 'ping') {
          // heartbeatReceived = true;
          done();
        }
      });

      client.on('connect', () => {
        // 等待心跳
      });
    });

    it.skip('应该在心跳超时后断开客户端连接', async () => {
      // 为单独测试创建新的唯一socket路径
      const uniqueSocketPath = process.platform === 'win32' 
        ? `\\\\.\\pipe\\test-hb-${Math.random().toString(36).substr(2, 6)}`
        : path.join(os.tmpdir(), `test-heartbeat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sock`);
      
      // 创建新的服务器实例，不影响全局server变量
      const testServer = new IPCServer({
        socketPath: uniqueSocketPath,
        enableHeartbeat: true,
        heartbeatInterval: 50,
        connectionTimeout: 150 // 短超时用于测试
      });

      let client: net.Socket | null = null;
      
      try {
        await testServer.start();
        
        // 使用Promise来处理异步事件
        const disconnectPromise = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Test timeout: client disconnect event not received'));
          }, 5000);
          
          testServer.on('client-disconnected', (_clientId: string, reason: string) => {
            clearTimeout(timeout);
            resolve(reason);
          });
        });

        client = net.createConnection(uniqueSocketPath);
        client.on('connect', () => {
          // 不响应心跳，等待超时
        });
        
        const reason = await disconnectPromise;
        expect(reason).toBe('connection timeout');
      } finally {
        // 确保清理资源
        if (client) {
          client.destroy();
        }
        await testServer.stop();
      }
    }, 10000);
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
    });

    it('应该提供服务器运行统计信息', () => {
      const stats = server.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.startTime).toBeInstanceOf(Date);
      expect(stats.totalConnections).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.activeClients).toBe(0);
    });

    it('应该正确统计连接和消息数量', async () => {
      const client = net.createConnection(testSocketPath);
      await new Promise(resolve => client.on('connect', resolve));

      const request = createRequest('ping', {});
      const messageData = JSON.stringify(request) + '\n';
      client.write(messageData);

      await new Promise(resolve => setTimeout(resolve, 50));

      const stats = server.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeClients).toBe(1);
      expect(stats.totalMessages).toBe(1);

      client.destroy();
    });
  });

  describe('错误处理和恢复', () => {
    beforeEach(async () => {
      server = new IPCServer({ socketPath: testSocketPath });
      await server.start();
    });

    it('应该处理客户端异常断开', (done) => {
      server.on('client-error', (clientId: string, error: Error) => {
        expect(clientId).toBeDefined();
        expect(error).toBeDefined();
      });

      server.on('client-disconnected', (_clientId: string, reason: string) => {
        expect(reason).toContain('客户端断开连接');
        done();
      });

      const client = net.createConnection(testSocketPath);
      client.on('connect', () => {
        // 模拟客户端异常
        client.destroy();
      });
    });

    it('应该在服务器错误后能够重新启动', async () => {
      await server.stop();
      
      // 应该能够重新启动
      await server.start();
      expect(server.isRunning).toBe(true);
    });
  });

  describe('并发处理', () => {
    beforeEach(async () => {
      server = new IPCServer({ 
        socketPath: testSocketPath,
        maxClients: 10
      });
      await server.start();
    });

    it('应该能够处理并发客户端连接', async () => {
      const clients: net.Socket[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 5; i++) {
        const client = net.createConnection(testSocketPath);
        clients.push(client);
        
        promises.push(new Promise(resolve => {
          client.on('connect', resolve);
        }));
      }

      await Promise.all(promises);
      expect(server.getClientCount()).toBe(5);

      clients.forEach(client => client.destroy());
    });

    it('应该能够处理并发消息', async () => {
      const clients: net.Socket[] = [];
      let messageCount = 0;

      server.on('message', () => {
        messageCount++;
      });

      // 创建多个客户端
      for (let i = 0; i < 3; i++) {
        const client = net.createConnection(testSocketPath);
        clients.push(client);
        await new Promise(resolve => client.on('connect', resolve));
      }

      // 每个客户端发送消息
      clients.forEach((client, index) => {
        const request = createRequest('ping', { clientIndex: index });
        const messageData = JSON.stringify(request) + '\n';
        client.write(messageData);
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(messageCount).toBe(3);

      clients.forEach(client => client.destroy());
    });
  });
});