/**
 * 🟢 TDD 绿阶段：Context基础接口和类型定义
 * 提供所有Context相关的基础接口和类型定义
 */

/**
 * 项目信息接口
 *
 * 定义了从sker.json文件中读取的项目配置信息。
 * 用于项目识别和上下文隔离。
 *
 * @example
 * ```typescript
 * const projectInfo: ProjectInfo = {
 *   name: 'my-project',
 *   version: '1.0.0',
 *   description: 'My awesome project'
 * };
 * ```
 */
export interface ProjectInfo {
  /** 项目名称 */
  name: string;
  /** 项目版本 */
  version?: string;
  /** 项目描述 */
  description?: string;
  /** 其他配置项 */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Context基础接口
 *
 * 定义所有上下文对象的基本属性和方法，为文件系统中的文件和文件夹
 * 提供统一的抽象表示。每个Context实例代表文件系统中的一个节点，
 * 可以是文件或文件夹。
 *
 * @example
 * ```typescript
 * const fileContext: Context = {
 *   path: '/project/src/index.ts',
 *   name: 'index.ts',
 *   type: 'file',
 *   parent: folderContext
 * };
 * ```
 */
export interface Context {
  /** 上下文的完整绝对路径 */
  path: string;

  /** 上下文的名称（文件名或文件夹名，不包含路径） */
  name: string;

  /** 上下文类型：'file' 表示文件，'folder' 表示文件夹 */
  type: 'file' | 'folder';

  /** 父级上下文（根目录的parent为undefined） */
  parent?: Context | undefined;
}