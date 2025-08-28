/**
 * TDD 红阶段：先编写失败的测试
 * 遵循 TDD 原则：测试驱动开发
 */

describe('计算器', () => {
  describe('加法', () => {
    it('应该正确地将两个正数相加', () => {
      // 准备
      const calculator = new Calculator();
      const a = 2;
      const b = 3;
      const expected = 5;

      // 执行
      const result = calculator.add(a, b);

      // 断言
      expect(result).toBe(expected);
    });

    it('应该处理零值', () => {
      // 准备
      const calculator = new Calculator();
      const a = 0;
      const b = 5;
      const expected = 5;

      // 执行
      const result = calculator.add(a, b);

      // 断言
      expect(result).toBe(expected);
    });

    it('应该处理负数', () => {
      // 准备
      const calculator = new Calculator();
      const a = -2;
      const b = 3;
      const expected = 1;

      // 执行
      const result = calculator.add(a, b);

      // 断言
      expect(result).toBe(expected);
    });
  });
});

describe('索引导出', () => {
  it('应该导出计算器类', () => {
    // 准备和执行
    const { Calculator: ExportedCalculator } = indexExports;

    // 断言
    expect(ExportedCalculator).toBeDefined();
    expect(typeof ExportedCalculator).toBe('function');
  });

  it('应该允许从索引导出创建计算器实例', () => {
    // 准备
    const { Calculator: ExportedCalculator } = indexExports;

    // 执行
    const calculator = new ExportedCalculator();

    // 断言
    expect(calculator).toBeInstanceOf(ExportedCalculator);
    expect(calculator.add(2, 3)).toBe(5);
  });

  it('应该导出所有计算器功能', () => {
    // 准备和执行
    const exports = Object.keys(indexExports);

    // 断言
    expect(exports).toContain('Calculator');
    expect(exports.length).toBeGreaterThan(0);
  });
});

// 从计算器模块导入用于直接测试
import { Calculator } from './calculator';
// 从索引模块导入用于测试导出
import * as indexExports from './index';
