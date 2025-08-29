/**
 * 🔴 TDD 红阶段：命令执行器测试
 * 先写失败的测试，再实现功能
 */

import { CommandExecutor } from './command-executor'; // ❌ 这会失败 - 正确的！

describe('CommandExecutor', () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor(); // ❌ 这会失败 - 正确的！
  });

  describe('execute', () => {
    it('应该能够执行简单的echo命令', async () => {
      const result = await executor.execute('echo "Hello World"'); // ❌ 这会失败 - 正确的！

      expect(result.success).toBe(true);
      // 修复：处理不同shell的输出格式差异
      const output = result.stdout.trim();
      expect(output).toMatch(/Hello World/); // 使用正则匹配，兼容不同格式
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.command).toBe('echo "Hello World"');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('应该能够处理命令执行失败的情况', async () => {
      const result = await executor.execute('nonexistentcommand12345'); // ❌ 这会失败 - 正确的！

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
      expect(result.command).toBe('nonexistentcommand12345');
    });

    it('应该能够处理空命令', async () => {
      const result = await executor.execute(''); // ❌ 这会失败 - 正确的！

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('命令不能为空');
      expect(result.exitCode).toBe(1);
      expect(result.command).toBe('');
    });
  });
});
