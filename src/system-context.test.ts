/**
 * 🔴 TDD 红阶段：系统上下文探索工具测试
 * 先写失败的测试，再实现功能
 */

import { SystemContextCollector } from './system-context'; // ❌ 这会失败 - 正确的！

describe('SystemContext', () => {
  let collector: SystemContextCollector;

  beforeEach(() => {
    collector = new SystemContextCollector(); // ❌ 这会失败 - 正确的！
  });

  describe('操作系统信息收集', () => {
    it('应该能够获取操作系统基本信息', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.os).toBeDefined();
      expect(context.os.platform).toBeDefined();
      expect(context.os.type).toBeDefined();
      expect(context.os.version).toBeDefined();
      expect(context.os.arch).toBeDefined();
      expect(context.os.release).toBeDefined();
    }, 30000);

    it('应该能够获取系统资源信息', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.system).toBeDefined();
      expect(context.system.totalMemory).toBeGreaterThan(0);
      expect(context.system.freeMemory).toBeGreaterThan(0);
      expect(context.system.cpuCount).toBeGreaterThan(0);
      expect(context.system.uptime).toBeGreaterThan(0);
    });
  });

  describe('命令行工具检测', () => {
    it('应该能够检测常用命令行工具', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.commandLineTools).toBeDefined();
      expect(Array.isArray(context.commandLineTools)).toBe(true);
      expect(context.commandLineTools.length).toBeGreaterThan(0);

      // 检查是否包含基本工具
      const toolNames = context.commandLineTools.map(tool => tool.name);
      expect(toolNames).toContain('node');
      expect(toolNames).toContain('npm');
    });

    it('应该能够检测工具版本信息', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      const nodeTool = context.commandLineTools.find(
        tool => tool.name === 'node'
      );
      if (nodeTool) {
        expect(nodeTool.version).toBeDefined();
        expect(nodeTool.available).toBe(true);
        expect(nodeTool.path).toBeDefined();
      }
    });
  });

  describe('Shell类型检测', () => {
    it('应该能够检测支持的Shell类型', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.shells).toBeDefined();
      expect(Array.isArray(context.shells)).toBe(true);
      expect(context.shells.length).toBeGreaterThan(0);
    });

    it('应该能够识别当前默认Shell', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.currentShell).toBeDefined();
      expect(context.currentShell.name).toBeDefined();
      expect(context.currentShell.available).toBe(true);
    });

    it('应该能够检测PowerShell在Windows上', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      if (context.os.platform === 'win32') {
        const powershell = context.shells.find(
          shell => shell.name === 'PowerShell' || shell.name === 'pwsh'
        );
        expect(powershell).toBeDefined();
      }
    });

    it('应该能够检测Bash在Unix系统上', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      if (context.os.platform !== 'win32') {
        const bash = context.shells.find(shell => shell.name === 'bash');
        expect(bash).toBeDefined();
      }
    });
  });

  describe('环境变量收集', () => {
    it('应该能够收集重要的环境变量', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.environment).toBeDefined();
      expect(context.environment['PATH']).toBeDefined();
      expect(context.environment['NODE_ENV']).toBeDefined();
    });

    it('应该能够过滤敏感环境变量', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      // 确保不包含敏感信息
      expect(context.environment['PASSWORD']).toBeUndefined();
      expect(context.environment['SECRET']).toBeUndefined();
      expect(context.environment['TOKEN']).toBeUndefined();
    });
  });

  describe('网络信息收集', () => {
    it('应该能够获取网络接口信息', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.network).toBeDefined();
      expect(context.network.interfaces).toBeDefined();
      expect(Array.isArray(context.network.interfaces)).toBe(true);
    });

    it('应该能够检测网络连接状态', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      expect(context.network.connectivity).toBeDefined();
      expect(typeof context.network.connectivity.internet).toBe('boolean');
    });
  });

  describe('上下文序列化', () => {
    it('应该能够将上下文序列化为JSON', async () => {
      const context = await collector.collectSystemContext(); // ❌ 这会失败 - 正确的！

      const json = JSON.stringify(context);
      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);

      const parsed = JSON.parse(json);
      expect(parsed.os).toBeDefined();
      expect(parsed.commandLineTools).toBeDefined();
      expect(parsed.shells).toBeDefined();
    });

    it('应该能够生成上下文摘要', async () => {
      const summary = await collector.generateContextSummary(); // ❌ 这会失败 - 正确的！

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toContain('操作系统');
      expect(summary).toContain('命令行工具');
    });
  });
});
