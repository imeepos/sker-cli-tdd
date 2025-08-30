/**
 * 🔴 TDD 红阶段：守护进程监控测试
 * 测试守护进程健康检查、监听统计信息、性能指标收集功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DaemonMonitor, DaemonStatus, DaemonStats, HealthCheckResult } from './daemon-monitor';

describe('DaemonMonitor', () => {
  let tempDir: string;
  let monitor: DaemonMonitor;

  beforeEach(() => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sker-monitor-test-'));
    monitor = new DaemonMonitor({
      pidFile: path.join(tempDir, 'daemon.pid'),
      socketPath: path.join(tempDir, 'daemon.sock'),
      healthCheckInterval: 100, // 快速健康检查用于测试
      statsFile: path.join(tempDir, 'stats.json')
    });
  });

  afterEach(() => {
    // 清理资源
    monitor.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('守护进程状态检测', () => {
    it('应该能够检测守护进程是否运行', async () => {
      // 创建PID文件模拟运行中的守护进程
      const pidFile = path.join(tempDir, 'daemon.pid');
      fs.writeFileSync(pidFile, process.pid.toString());

      const status = await monitor.getDaemonStatus();
      expect(status.isRunning).toBe(true);
      expect(status.pid).toBe(process.pid);
    });

    it('应该在没有PID文件时检测为未运行', async () => {
      const status = await monitor.getDaemonStatus();
      expect(status.isRunning).toBe(false);
      expect(status.pid).toBeNull();
    });

    it('应该在进程不存在时检测为未运行', async () => {
      // 创建一个无效的PID
      const pidFile = path.join(tempDir, 'daemon.pid');
      fs.writeFileSync(pidFile, '999999'); // 不存在的进程ID

      const status = await monitor.getDaemonStatus();
      expect(status.isRunning).toBe(false);
      expect(status.pid).toBe(999999);
      expect(status.error).toContain('进程不存在');
    });
  });

  describe('健康检查', () => {
    it('应该能够执行完整的健康检查', async () => {
      const result = await monitor.performHealthCheck();
      
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('checks');
      expect(result.checks).toHaveProperty('process');
      expect(result.checks).toHaveProperty('socket');
      expect(result.checks).toHaveProperty('resources');
    });

    it('应该检查Socket文件是否存在', async () => {
      // 创建Socket文件
      const socketPath = path.join(tempDir, 'daemon.sock');
      fs.writeFileSync(socketPath, '');

      const result = await monitor.performHealthCheck();
      expect(result.checks.socket.healthy).toBe(true);
      expect(result.checks.socket.message).toBe('Socket文件存在');
    });

    it('应该检查内存和CPU使用情况', async () => {
      // 创建PID文件
      const pidFile = path.join(tempDir, 'daemon.pid');
      fs.writeFileSync(pidFile, process.pid.toString());

      const result = await monitor.performHealthCheck();
      expect(result.checks.resources.healthy).toBeDefined();
      expect(result.checks.resources.details).toHaveProperty('memoryUsage');
      expect(result.checks.resources.details).toHaveProperty('cpuUsage');
    });

    it('应该在多次检查失败时标记为不健康', async () => {
      // 连续执行多次健康检查
      for (let i = 0; i < 3; i++) {
        await monitor.performHealthCheck();
      }

      const status = monitor.getHealthStatus();
      expect(status.consecutiveFailures).toBe(3);
      expect(status.isHealthy).toBe(false);
    });
  });

  describe('统计信息收集', () => {
    it('应该能够收集守护进程统计信息', () => {
      // 模拟一些统计数据
      monitor.recordProjectCount(5);
      monitor.recordFileChange();
      monitor.recordContextUpdate();
      monitor.recordError('TEST_ERROR');

      const stats = monitor.getStats();
      expect(stats.projectCount).toBe(5);
      expect(stats.fileChanges).toBe(1);
      expect(stats.contextUpdates).toBe(1);
      expect(stats.errors).toBe(1);
    });

    it('应该能够重置统计信息', () => {
      // 添加一些统计数据
      monitor.recordProjectCount(3);
      monitor.recordFileChange();
      monitor.recordContextUpdate();

      // 重置统计信息
      monitor.resetStats();

      const stats = monitor.getStats();
      expect(stats.projectCount).toBe(0);
      expect(stats.fileChanges).toBe(0);
      expect(stats.contextUpdates).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('应该能够保存统计信息到文件', async () => {
      // 添加统计数据
      monitor.recordProjectCount(2);
      monitor.recordFileChange();

      // 保存统计信息
      await monitor.saveStats();

      const statsFile = path.join(tempDir, 'stats.json');
      expect(fs.existsSync(statsFile)).toBe(true);

      const savedStats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      expect(savedStats.projectCount).toBe(2);
      expect(savedStats.fileChanges).toBe(1);
    });

    it('应该能够从文件加载统计信息', async () => {
      // 创建统计文件
      const statsData = {
        projectCount: 4,
        fileChanges: 10,
        contextUpdates: 8,
        errors: 2,
        uptime: 3600,
        lastUpdate: Date.now()
      };

      const statsFile = path.join(tempDir, 'stats.json');
      fs.writeFileSync(statsFile, JSON.stringify(statsData, null, 2));

      // 加载统计信息
      await monitor.loadStats();

      const stats = monitor.getStats();
      expect(stats.projectCount).toBe(4);
      expect(stats.fileChanges).toBe(10);
      expect(stats.contextUpdates).toBe(8);
      expect(stats.errors).toBe(2);
    });
  });

  describe('性能监控', () => {
    it('应该能够监控内存使用情况', () => {
      const memoryInfo = monitor.getMemoryUsage();
      
      expect(memoryInfo).toHaveProperty('used');
      expect(memoryInfo).toHaveProperty('total');
      expect(memoryInfo).toHaveProperty('percentage');
      expect(memoryInfo.percentage).toBeGreaterThanOrEqual(0);
      expect(memoryInfo.percentage).toBeLessThanOrEqual(100);
    });

    it('应该能够监控CPU使用情况', async () => {
      const cpuInfo = await monitor.getCpuUsage();
      
      expect(cpuInfo).toHaveProperty('percentage');
      expect(cpuInfo).toHaveProperty('loadAverage');
      expect(cpuInfo.percentage).toBeGreaterThanOrEqual(0);
      expect(cpuInfo.percentage).toBeLessThanOrEqual(100);
    });

    it('应该能够检查资源使用是否超出限制', () => {
      const isWithinLimits = monitor.checkResourceLimits({
        maxMemoryMB: 500,
        maxCpuPercent: 80
      });

      expect(typeof isWithinLimits.memory).toBe('boolean');
      expect(typeof isWithinLimits.cpu).toBe('boolean');
    });
  });

  describe('事件监听', () => {
    it('应该能够监听守护进程状态变化', (done) => {
      let statusChangeCount = 0;

      monitor.on('statusChange', (status: DaemonStatus) => {
        statusChangeCount++;
        expect(status).toHaveProperty('isRunning');
        
        if (statusChangeCount === 1) {
          done();
        }
      });

      // 触发状态检查
      monitor.checkStatus();
    });

    it('应该能够监听健康状态变化', (done) => {
      monitor.on('healthChange', (result: HealthCheckResult) => {
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('checks');
        done();
      });

      // 触发健康检查
      monitor.performHealthCheck();
    });

    it('应该能够监听统计信息更新', (done) => {
      monitor.on('statsUpdate', (stats: DaemonStats) => {
        expect(stats).toHaveProperty('projectCount');
        done();
      });

      // 更新统计信息
      monitor.recordProjectCount(1);
    });
  });

  describe('监控控制', () => {
    it('应该能够启动持续监控', () => {
      expect(monitor.isRunning()).toBe(false);
      
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
    });

    it('应该能够停止监控', () => {
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
      
      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('应该能够配置监控间隔', () => {
      const config = monitor.getConfig();
      expect(config.healthCheckInterval).toBe(100);
      
      monitor.setConfig({ healthCheckInterval: 200 });
      
      const updatedConfig = monitor.getConfig();
      expect(updatedConfig.healthCheckInterval).toBe(200);
    });
  });
});