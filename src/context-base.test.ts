/**
 * 🔴 TDD 红阶段：Context基础接口和ProjectInfo测试
 * 测试基础接口和项目信息相关功能
 */

import { ProjectInfo, Context } from './context-base';

describe('Context基础接口', () => {
  describe('ProjectInfo接口', () => {
    it('应该包含必需的name属性', () => {
      const projectInfo: ProjectInfo = {
        name: 'test-project',
      };

      expect(projectInfo.name).toBe('test-project');
    });

    it('应该支持可选属性', () => {
      const projectInfo: ProjectInfo = {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project description',
        customField: 'custom-value',
      };

      expect(projectInfo.version).toBe('1.0.0');
      expect(projectInfo.description).toBe('Test project description');
      expect(projectInfo['customField']).toBe('custom-value');
    });
  });

  describe('Context接口', () => {
    it('应该支持文件类型的Context', () => {
      const context: Context = {
        path: '/test/file.ts',
        name: 'file.ts',
        type: 'file',
        parent: undefined,
      };

      expect(context.path).toBe('/test/file.ts');
      expect(context.name).toBe('file.ts');
      expect(context.type).toBe('file');
      expect(context.parent).toBeUndefined();
    });

    it('应该支持文件夹类型的Context', () => {
      const context: Context = {
        path: '/test/folder',
        name: 'folder',
        type: 'folder',
      };

      expect(context.type).toBe('folder');
    });

    it('应该支持父子关系', () => {
      const parentContext: Context = {
        path: '/test',
        name: 'test',
        type: 'folder',
      };

      const childContext: Context = {
        path: '/test/child',
        name: 'child',
        type: 'file',
        parent: parentContext,
      };

      expect(childContext.parent).toBe(parentContext);
    });
  });
});
