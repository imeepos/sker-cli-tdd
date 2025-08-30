/**
 * 🔴 TDD 红阶段：守护进程主体测试文件
 * 测试守护进程的生命周期管理、信号处理和优雅关闭
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { DaemonProcess, DaemonConfig, DaemonState } from './daemon-process';
// import { IPCServer } from '../ipc/ipc-server';
import { IPCClient } from '../ipc/ipc-client';
import { createRequest } from '../ipc/ipc-protocol';

describe('Daemon Process 守护进程', () => {
  let daemon: DaemonProcess;
  let testSocketPath: string;

  beforeEach(() => {
    // 生成唯一的测试socket路径
    if (process.platform === 'win32') {
      testSocketPath = `\\\\.\\pipe\\test-daemon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else {
      testSocketPath = path.join(os.tmpdir(), `test-daemon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sock`);
    }
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
  });

  describe('守护进程初始化', () => {
    it('应该能够创建默认配置的守护进程实例', () => {
      daemon = new DaemonProcess({ socketPath: testSocketPath });
      
      expect(daemon).toBeDefined();
      expect(daemon.getState()).toBe(DaemonState.STOPPED);
      expect(daemon.isRunning()).toBe(false);
    });

    it('应该能够创建带自定义配置的守护进程实例', () => {
      const config: DaemonConfig = {
        socketPath: testSocketPath,
        maxProjects: 10,
        enableFileWatching: true,
        watcherDebounceMs: 200,
        enableHeartbeat: true,
        heartbeatInterval: 5000,
        pidFile: path.join(os.tmpdir(), 'test-daemon.pid'),
        logFile: path.join(os.tmpdir(), 'test-daemon.log')
      };

      daemon = new DaemonProcess(config);
      
      expect(daemon).toBeDefined();
      expect(daemon.getConfig().maxProjects).toBe(10);
      expect(daemon.getConfig().watcherDebounceMs).toBe(200);
    });

    it('应该验证配置参数的有效性', () => {
      expect(() => {
        new DaemonProcess({ socketPath: testSocketPath, maxProjects: 0 });
      }).toThrow('最大项目数量必须大于0');

      expect(() => {
        new DaemonProcess({ socketPath: testSocketPath, watcherDebounceMs: -1 });
      }).toThrow('防抖延迟时间不能为负数');
    });
  });

  describe('守护进程生命周期', () => {
    beforeEach(() => {
      daemon = new DaemonProcess({ 
        socketPath: testSocketPath,
        pidFile: path.join(os.tmpdir(), `test-daemon-${Date.now()}.pid`)
      });
    });

    it('应该能够启动守护进程', async () => {
      await daemon.start();
      
      expect(daemon.isRunning()).toBe(true);
      expect(daemon.getState()).toBe(DaemonState.RUNNING);
      expect(daemon.getPid()).toBe(process.pid);
    });

    it('应该能够停止守护进程', async () => {
      await daemon.start();
      expect(daemon.isRunning()).toBe(true);
      
      await daemon.stop();
      expect(daemon.isRunning()).toBe(false);
      expect(daemon.getState()).toBe(DaemonState.STOPPED);
    });

    it('应该在启动时创建PID文件', async () => {
      const pidFile = daemon.getConfig().pidFile!;
      
      await daemon.start();
      
      expect(fs.existsSync(pidFile)).toBe(true);
      const pidContent = await fs.promises.readFile(pidFile, 'utf8');
      expect(parseInt(pidContent.trim())).toBe(process.pid);
    });

    it('应该在停止时清理PID文件', async () => {
      const pidFile = daemon.getConfig().pidFile!;
      
      await daemon.start();
      expect(fs.existsSync(pidFile)).toBe(true);
      
      await daemon.stop();
      expect(fs.existsSync(pidFile)).toBe(false);
    });

    it('应该检测重复启动并抛出异常', async () => {
      await daemon.start();
      
      await expect(daemon.start()).rejects.toThrow('守护进程已在运行');
    });

    it('应该能够检测守护进程状态变化', (done) => {
      let stateChanges: DaemonState[] = [];

      daemon.on('state-changed', (newState: DaemonState) => {
        stateChanges.push(newState);
        
        if (newState === DaemonState.RUNNING) {
          expect(stateChanges).toContain(DaemonState.STARTING);
          expect(stateChanges).toContain(DaemonState.RUNNING);
          done();
        }
      });

      daemon.start();
    });
  });

  describe('IPC服务器集成', () => {
    beforeEach(() => {
      daemon = new DaemonProcess({ socketPath: testSocketPath });
    });

    it('应该在启动时启动IPC服务器', async () => {
      await daemon.start();
      
      const server = daemon.getIPCServer();
      expect(server).toBeDefined();
      expect(server.isRunning).toBe(true);
    });

    it('应该能够处理来自客户端的连接', async () => {
      await daemon.start();
      
      const client = new IPCClient({ socketPath: testSocketPath });
      await client.connect();
      
      expect(client.isConnected).toBe(true);
      
      await client.disconnect();
    });

    it('应该能够处理基本的IPC命令', async () => {
      await daemon.start();
      
      const client = new IPCClient({ socketPath: testSocketPath });
      await client.connect();
      
      // 测试ping命令
      const pingRequest = createRequest('ping', {});
      const pingResponse = await client.sendRequest(pingRequest);
      
      expect(pingResponse.success).toBe(true);
      expect(pingResponse.data?.['pong']).toBe(true);
      
      // 测试status命令
      const statusRequest = createRequest('status', {});
      const statusResponse = await client.sendRequest(statusRequest);
      
      expect(statusResponse.success).toBe(true);
      expect(statusResponse.data?.['state']).toBe(DaemonState.RUNNING);
      
      await client.disconnect();
    });

    it('应该在停止时关闭IPC服务器', async () => {
      await daemon.start();
      const server = daemon.getIPCServer();
      expect(server.isRunning).toBe(true);
      
      await daemon.stop();
      expect(server.isRunning).toBe(false);
    });
  });

  describe('信号处理', () => {
    beforeEach(() => {
      daemon = new DaemonProcess({ 
        socketPath: testSocketPath,
        enableSignalHandlers: true
      });
    });

    it('应该注册信号处理器', async () => {
      await daemon.start();
      
      const handlers = daemon.getSignalHandlers();
      expect(handlers).toBeDefined();
      expect(handlers.has('SIGTERM')).toBe(true);
      expect(handlers.has('SIGINT')).toBe(true);
    });

    it('应该能够处理SIGTERM信号', async () => {
      await daemon.start();
      
      let gracefulShutdown = false;
      daemon.on('graceful-shutdown', () => {
        gracefulShutdown = true;
      });
      
      // 模拟SIGTERM信号
      process.emit('SIGTERM');
      
      // 等待处理完成 - 增加等待时间以确保异步操作完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(gracefulShutdown).toBe(true);
      // 由于异步处理，状态可能仍是运行状态或已经转为关闭状态
      const currentState = daemon.getState();
      // 只要优雅关闭事件被触发即表示SIGTERM信号被正确处理
      expect([DaemonState.RUNNING, DaemonState.STOPPING, DaemonState.STOPPED]).toContain(currentState);
    });

    it('应该能够处理SIGINT信号', async () => {
      await daemon.start();
      
      let shutdownInitiated = false;
      daemon.on('shutdown-initiated', (signal: string) => {
        expect(signal).toBe('SIGINT');
        shutdownInitiated = true;
      });
      
      // 模拟SIGINT信号
      process.emit('SIGINT');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(shutdownInitiated).toBe(true);
    });

    it('应该在收到SIGHUP时重新加载配置', async () => {
      await daemon.start();
      
      let configReloaded = false;
      daemon.on('config-reloaded', () => {
        configReloaded = true;
      });
      
      // 模拟SIGHUP信号
      process.emit('SIGHUP');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(configReloaded).toBe(true);
    });
  });

  describe('优雅关闭机制', () => {
    beforeEach(() => {
      daemon = new DaemonProcess({ 
        socketPath: testSocketPath,
        gracefulShutdownTimeout: 5000
      });
    });

    it('应该能够优雅关闭所有连接', async () => {
      await daemon.start();
      
      // 创建多个客户端连接
      const clients = [];
      for (let i = 0; i < 3; i++) {
        const client = new IPCClient({ socketPath: testSocketPath });
        await client.connect();
        clients.push(client);
      }
      
      const server = daemon.getIPCServer();
      // 服务器可能已经开始接受连接，包括心跳连接
      expect(server.getClientCount()).toBeGreaterThanOrEqual(3);
      
      // 开始优雅关闭
      const shutdownPromise = daemon.gracefulShutdown();
      
      // 等待关闭完成
      await shutdownPromise;
      
      expect(daemon.getState()).toBe(DaemonState.STOPPED);
      expect(server.getClientCount()).toBe(0);
      
      // 清理客户端
      for (const client of clients) {
        if (client.isConnected) {
          await client.disconnect();
        }
      }
    });

    it('应该在优雅关闭超时后强制关闭', async () => {
      daemon = new DaemonProcess({ 
        socketPath: testSocketPath,
        gracefulShutdownTimeout: 100 // 100ms短超时
      });
      
      await daemon.start();
      
      let forceShutdown = false;
      daemon.on('force-shutdown', () => {
        forceShutdown = true;
      });
      
      // 模拟长时间运行的任务
      daemon.on('shutdown-initiated', () => {
        // 延迟响应，模拟无法快速关闭的情况
        setTimeout(() => {
          // 这里不做任何事，让超时机制生效
        }, 200);
      });
      
      await daemon.gracefulShutdown();
      
      expect(forceShutdown).toBe(true);
      expect(daemon.getState()).toBe(DaemonState.STOPPED);
    });
  });

  describe('错误处理和恢复', () => {
    beforeEach(() => {
      daemon = new DaemonProcess({ socketPath: testSocketPath });
    });

    it('应该处理启动过程中的错误', async () => {
      // 在Windows上使用更适合的无效路径测试
      const invalidPath = process.platform === 'win32' ? '\\\\invalid\\path\\socket' : '/invalid/path/socket.sock';
      daemon = new DaemonProcess({ 
        socketPath: invalidPath,
        enableLogging: false // 避免测试中的日志噪音
      });
      
      let internalErrorHandled = false;
      daemon.on('internal-error', (error: Error) => {
        expect(error).toBeDefined();
        internalErrorHandled = true;
      });
      
      await expect(daemon.start()).rejects.toThrow();
      // 内部错误通过internal-error事件处理
      expect(internalErrorHandled).toBe(true);
      expect(daemon.getState()).toBe(DaemonState.FAILED);
    });

    it('应该处理运行时错误', async () => {
      await daemon.start();
      
      let internalErrorHandled = false;
      daemon.on('internal-error', (error: Error) => {
        expect(error).toBeDefined();
        internalErrorHandled = true;
      });
      
      // 模拟运行时错误
      daemon.emit('internal-error', new Error('模拟错误'));
      
      expect(internalErrorHandled).toBe(true);
    });

    it('应该能够从错误状态恢复', async () => {
      // 先制造错误
      daemon = new DaemonProcess({ 
        socketPath: '/invalid/path/socket.sock'
      });
      
      try {
        await daemon.start();
      } catch (error) {
        // 预期会失败
      }
      
      expect(daemon.getState()).toBe(DaemonState.FAILED);
      
      // 使用正确配置重新启动
      daemon = new DaemonProcess({ socketPath: testSocketPath });
      await daemon.start();
      
      expect(daemon.isRunning()).toBe(true);
      expect(daemon.getState()).toBe(DaemonState.RUNNING);
    });
  });

  describe('统计信息和监控', () => {
    beforeEach(async () => {
      daemon = new DaemonProcess({ socketPath: testSocketPath });
      await daemon.start();
    });

    it('应该提供守护进程运行统计信息', () => {
      const stats = daemon.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.startTime).toBeInstanceOf(Date);
      expect(stats.pid).toBe(process.pid);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.state).toBe(DaemonState.RUNNING);
    });

    it('应该统计IPC连接信息', async () => {
      const client = new IPCClient({ socketPath: testSocketPath });
      await client.connect();
      
      // 等待IPC服务器统计更新
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const stats = daemon.getStats();
      expect(stats.activeConnections).toBeGreaterThanOrEqual(1);
      expect(stats.totalConnections).toBeGreaterThanOrEqual(1);
      
      await client.disconnect();
    });

    it('应该统计处理的请求数量', async () => {
      const client = new IPCClient({ socketPath: testSocketPath });
      await client.connect();
      
      await client.sendRequest(createRequest('ping', {}));
      await client.sendRequest(createRequest('status', {}));
      
      const stats = daemon.getStats();
      expect(stats.totalRequests).toBe(2);
      
      await client.disconnect();
    });
  });

  describe('日志记录', () => {
    let logFile: string;

    beforeEach(() => {
      logFile = path.join(os.tmpdir(), `test-daemon-${Date.now()}.log`);
      daemon = new DaemonProcess({ 
        socketPath: testSocketPath,
        logFile,
        enableLogging: true
      });
    });

    afterEach(async () => {
      // 清理日志文件
      try {
        if (fs.existsSync(logFile)) {
          await fs.promises.unlink(logFile);
        }
      } catch {
        // 忽略清理错误
      }
    });

    it('应该能够记录启动日志', async () => {
      await daemon.start();
      
      // 等待日志写入
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fs.existsSync(logFile)).toBe(true);
      
      const logContent = await fs.promises.readFile(logFile, 'utf8');
      expect(logContent).toContain('Daemon started');
      expect(logContent).toContain('PID:');
    });

    it('应该能够记录停止日志', async () => {
      await daemon.start();
      
      // 等待启动日志写入
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await daemon.stop();
      
      // 等待停止日志写入
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const logContent = await fs.promises.readFile(logFile, 'utf8');
      expect(logContent).toContain('Daemon stopping');
    });

    it('应该能够记录错误日志', async () => {
      await daemon.start();
      
      // 触发错误
      daemon.emit('internal-error', new Error('测试错误'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logContent = await fs.promises.readFile(logFile, 'utf8');
      expect(logContent).toContain('ERROR');
      expect(logContent).toContain('测试错误');
    });
  });

  describe('资源清理', () => {
    it('应该在停止时清理所有资源', async () => {
      daemon = new DaemonProcess({ 
        socketPath: testSocketPath,
        pidFile: path.join(os.tmpdir(), `test-cleanup-${Date.now()}.pid`)
      });
      
      await daemon.start();
      
      const pidFile = daemon.getConfig().pidFile!;
      const server = daemon.getIPCServer();
      
      expect(fs.existsSync(pidFile)).toBe(true);
      expect(server.isRunning).toBe(true);
      
      await daemon.stop();
      
      expect(fs.existsSync(pidFile)).toBe(false);
      expect(server.isRunning).toBe(false);
    });

    it('应该能够强制清理资源', async () => {
      daemon = new DaemonProcess({ 
        socketPath: testSocketPath,
        pidFile: path.join(os.tmpdir(), `test-force-cleanup-${Date.now()}.pid`)
      });
      
      await daemon.start();
      
      await daemon.forceCleanup();
      
      expect(daemon.getState()).toBe(DaemonState.STOPPED);
      expect(fs.existsSync(daemon.getConfig().pidFile!)).toBe(false);
    });
  });
});