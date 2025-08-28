/**
 * TDD 绿阶段：让测试通过的最小实现
 * 遵循 TDD 原则：编写刚好让测试通过的最简代码
 */

export class Calculator {
  /**
   * 两数相加
   * @param a 第一个数
   * @param b 第二个数
   * @returns a 和 b 的和
   */
  add(a: number, b: number): number {
    // 最小实现 - 直接返回两数之和
    return a + b;
  }
}
