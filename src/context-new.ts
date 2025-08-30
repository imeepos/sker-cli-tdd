/**
 * 🔄 TDD 重构阶段：Context模块统一导出
 *
 * 重构后的Context模块，拆分为多个独立文件：
 * - context-base.ts - 基础接口和类型定义
 * - file-context.ts - 文件上下文实现
 * - folder-context.ts - 文件夹上下文实现
 * - context-builder.ts - 上下文构建器实现
 */

// 导出基础接口和类型
export { ProjectInfo, Context } from './context-base';

// 导出文件上下文类
export { FileContext } from './file-context';

// 导出文件夹上下文类
export { FolderContext } from './folder-context';

// 导出构建器和选项
export { ContextBuilder, ContextBuilderOptions } from './context-builder';
