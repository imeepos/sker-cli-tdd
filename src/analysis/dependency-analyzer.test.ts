/**
 * 🔴 TDD 红阶段：依赖关系分析测试文件
 * 测试import/require语句解析、文件依赖图构建、循环依赖检测
 */

import { DependencyAnalyzer, DependencyGraph } from './dependency-analyzer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Dependency Analyzer 依赖关系分析', () => {
  let analyzer: DependencyAnalyzer;
  let testProjectDir: string;

  beforeEach(async () => {
    analyzer = new DependencyAnalyzer();
    
    // 创建测试项目目录
    testProjectDir = path.join(os.tmpdir(), `dependency-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.promises.mkdir(testProjectDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.promises.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('依赖分析器初始化', () => {
    it('应该能够创建依赖分析器实例', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer instanceof DependencyAnalyzer).toBe(true);
    });

    it('应该支持配置文件类型过滤', () => {
      const config = {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        ignorePatterns: ['**/*.test.*', '**/node_modules/**']
      };
      
      const configuredAnalyzer = new DependencyAnalyzer(config);
      expect(configuredAnalyzer).toBeDefined();
    });
  });

  describe('import 语句解析', () => {
    it('应该能够解析ES6 import语句', () => {
      const code = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import * as Utils from './utils';
        import { Component } from '../components/Component';
        import './styles.css';
        import type { User } from '../types/User';
      `;
      
      const dependencies = analyzer.parseImports(code);
      
      expect(dependencies).toHaveLength(5); // react只会出现一次，因为Set会去重
      expect(dependencies).toContain('react');
      expect(dependencies).toContain('./utils');
      expect(dependencies).toContain('../components/Component');
      expect(dependencies).toContain('./styles.css');
      expect(dependencies).toContain('../types/User');
    });

    it('应该能够解析CommonJS require语句', () => {
      const code = `
        const fs = require('fs');
        const path = require('path');
        const utils = require('./utils');
        const { helper } = require('../helpers/helper');
        const config = require('./config.json');
        require('./side-effect');
      `;
      
      const dependencies = analyzer.parseRequires(code);
      
      expect(dependencies).toHaveLength(6);
      expect(dependencies).toContain('fs');
      expect(dependencies).toContain('path');
      expect(dependencies).toContain('./utils');
      expect(dependencies).toContain('../helpers/helper');
      expect(dependencies).toContain('./config.json');
      expect(dependencies).toContain('./side-effect');
    });

    it('应该能够解析动态import语句', () => {
      const code = `
        const module1 = await import('./dynamic-module');
        const module2 = import('../utils/helper');
        import('./lazy-component').then(module => {});
      `;
      
      const dependencies = analyzer.parseDynamicImports(code);
      
      expect(dependencies).toHaveLength(3);
      expect(dependencies).toContain('./dynamic-module');
      expect(dependencies).toContain('../utils/helper');
      expect(dependencies).toContain('./lazy-component');
    });

    it('应该能够解析TypeScript import语句', () => {
      const code = `
        import type { UserType } from './types';
        import type * as ApiTypes from '../api/types';
        import { type Config, createConfig } from './config';
      `;
      
      const dependencies = analyzer.parseImports(code);
      
      expect(dependencies).toHaveLength(3);
      expect(dependencies).toContain('./types');
      expect(dependencies).toContain('../api/types');
      expect(dependencies).toContain('./config');
    });

    it('应该过滤掉内置模块和外部依赖', () => {
      const code = `
        import fs from 'fs';
        import React from 'react';
        import axios from 'axios';
        import { helper } from './helper';
        import { Component } from '../components/Component';
      `;
      
      const dependencies = analyzer.parseImports(code, { excludeExternal: true });
      
      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContain('./helper');
      expect(dependencies).toContain('../components/Component');
      expect(dependencies).not.toContain('fs');
      expect(dependencies).not.toContain('react');
      expect(dependencies).not.toContain('axios');
    });
  });

  describe('文件依赖图构建', () => {
    beforeEach(async () => {
      // 创建测试文件结构
      const srcDir = path.join(testProjectDir, 'src');
      const componentsDir = path.join(srcDir, 'components');
      const utilsDir = path.join(srcDir, 'utils');
      
      await fs.promises.mkdir(srcDir, { recursive: true });
      await fs.promises.mkdir(componentsDir, { recursive: true });
      await fs.promises.mkdir(utilsDir, { recursive: true });
      
      // main.ts
      await fs.promises.writeFile(path.join(srcDir, 'main.ts'), `
        import { App } from './components/App';
        import { config } from './config';
        import './styles.css';
      `);
      
      // components/App.tsx
      await fs.promises.writeFile(path.join(componentsDir, 'App.tsx'), `
        import React from 'react';
        import { Header } from './Header';
        import { Footer } from './Footer';
        import { formatDate } from '../utils/date';
      `);
      
      // components/Header.tsx
      await fs.promises.writeFile(path.join(componentsDir, 'Header.tsx'), `
        import React from 'react';
        import { Button } from './Button';
      `);
      
      // components/Footer.tsx
      await fs.promises.writeFile(path.join(componentsDir, 'Footer.tsx'), `
        import React from 'react';
      `);
      
      // components/Button.tsx
      await fs.promises.writeFile(path.join(componentsDir, 'Button.tsx'), `
        import React from 'react';
        import { logger } from '../utils/logger';
      `);
      
      // utils/date.ts
      await fs.promises.writeFile(path.join(utilsDir, 'date.ts'), `
        export function formatDate(date: Date): string {
          return date.toISOString();
        }
      `);
      
      // utils/logger.ts
      await fs.promises.writeFile(path.join(utilsDir, 'logger.ts'), `
        export const logger = {
          log: (message: string) => console.log(message)
        };
      `);
      
      // config.ts
      await fs.promises.writeFile(path.join(srcDir, 'config.ts'), `
        export const config = {
          apiUrl: 'https://api.example.com'
        };
      `);
      
      // styles.css
      await fs.promises.writeFile(path.join(srcDir, 'styles.css'), `
        body { margin: 0; }
      `);
    });

    it('应该能够分析项目的依赖关系', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();
      expect(result.nodes.size).toBeGreaterThan(0);
      expect(result.cyclicDependencies).toEqual([]);
    });

    it('应该能够构建完整的依赖图', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      const graph = result.graph;
      
      // 检查主要文件的依赖关系
      const mainFile = path.resolve(testProjectDir, 'src/main.ts');
      const appFile = path.resolve(testProjectDir, 'src/components/App.tsx');
      
      expect(graph.hasNode(mainFile)).toBe(true);
      expect(graph.hasNode(appFile)).toBe(true);
      
      // 检查依赖关系
      const mainDependencies = graph.getDependencies(mainFile);
      expect(mainDependencies.length).toBeGreaterThan(0);
      expect(mainDependencies.some((dep: string) => dep.includes('App'))).toBe(true);
    });

    it('应该能够获取文件的直接依赖', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      const graph = result.graph;
      
      const appFile = path.resolve(testProjectDir, 'src/components/App.tsx');
      const dependencies = graph.getDependencies(appFile);
      
      expect(dependencies.length).toBe(3); // Header, Footer, date utils
      expect(dependencies.some((dep: string) => dep.includes('Header'))).toBe(true);
      expect(dependencies.some((dep: string) => dep.includes('Footer'))).toBe(true);
      expect(dependencies.some((dep: string) => dep.includes('date'))).toBe(true);
    });

    it('应该能够获取文件的反向依赖', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      const graph = result.graph;
      
      const headerFile = path.resolve(testProjectDir, 'src/components/Header.tsx');
      const dependents = graph.getDependents(headerFile);
      
      expect(dependents.length).toBe(1);
      expect(dependents.some((dep: string) => dep.includes('App'))).toBe(true);
    });

    it('应该能够获取文件的传递依赖', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      const graph = result.graph;
      
      const mainFile = path.resolve(testProjectDir, 'src/main.ts');
      const transitiveDeps = graph.getTransitiveDependencies(mainFile);
      
      // main -> App -> Header -> Button -> logger
      expect(transitiveDeps.length).toBeGreaterThan(3);
      expect(transitiveDeps.some((dep: string) => dep.includes('Button'))).toBe(true);
      expect(transitiveDeps.some((dep: string) => dep.includes('logger'))).toBe(true);
    });
  });

  describe('循环依赖检测', () => {
    beforeEach(async () => {
      // 创建循环依赖的测试文件
      const srcDir = path.join(testProjectDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      
      // A -> B -> C -> A (循环)
      await fs.promises.writeFile(path.join(srcDir, 'A.ts'), `
        import { B } from './B';
        export const A = 'A';
      `);
      
      await fs.promises.writeFile(path.join(srcDir, 'B.ts'), `
        import { C } from './C';
        export const B = 'B';
      `);
      
      await fs.promises.writeFile(path.join(srcDir, 'C.ts'), `
        import { A } from './A';
        export const C = 'C';
      `);
      
      // D -> E -> F (无循环)
      await fs.promises.writeFile(path.join(srcDir, 'D.ts'), `
        import { E } from './E';
        export const D = 'D';
      `);
      
      await fs.promises.writeFile(path.join(srcDir, 'E.ts'), `
        import { F } from './F';
        export const E = 'E';
      `);
      
      await fs.promises.writeFile(path.join(srcDir, 'F.ts'), `
        export const F = 'F';
      `);
    });

    it('应该能够检测简单的循环依赖', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.success).toBe(true);
      expect(result.cyclicDependencies).toHaveLength(1);
      
      const cycle = result.cyclicDependencies[0];
      expect(cycle).toBeDefined();
      if (!cycle) return; // TypeScript类型保护
      
      expect(cycle.cycle.length).toBe(3);
      expect(cycle.cycle.some((file: string) => file.includes('A.ts'))).toBe(true);
      expect(cycle.cycle.some((file: string) => file.includes('B.ts'))).toBe(true);
      expect(cycle.cycle.some((file: string) => file.includes('C.ts'))).toBe(true);
    });

    it('应该能够检测多个循环依赖', async () => {
      // 添加另一个循环 G -> H -> G
      const srcDir = path.join(testProjectDir, 'src');
      
      await fs.promises.writeFile(path.join(srcDir, 'G.ts'), `
        import { H } from './H';
        export const G = 'G';
      `);
      
      await fs.promises.writeFile(path.join(srcDir, 'H.ts'), `
        import { G } from './G';
        export const H = 'H';
      `);
      
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.cyclicDependencies.length).toBeGreaterThanOrEqual(2);
    });

    it('应该提供循环依赖的详细信息', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      const cycle = result.cyclicDependencies[0];
      
      expect(cycle).toBeDefined();
      if (!cycle) return; // TypeScript类型保护
      expect(cycle.cycle).toBeDefined();
      expect(cycle.severity).toBe('warning'); // 默认严重性
      expect(cycle.description).toContain('循环依赖');
    });

    it('应该不将无循环的依赖链识别为循环', async () => {
      // 只分析无循环的部分
      const srcDir = path.join(testProjectDir, 'src');
      
      // 删除循环依赖文件
      await fs.promises.unlink(path.join(srcDir, 'A.ts'));
      await fs.promises.unlink(path.join(srcDir, 'B.ts'));
      await fs.promises.unlink(path.join(srcDir, 'C.ts'));
      
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.cyclicDependencies).toHaveLength(0);
    });
  });

  describe('依赖图查询和分析', () => {
    let graph: DependencyGraph;

    beforeEach(async () => {
      // 使用之前创建的复杂项目结构
      const srcDir = path.join(testProjectDir, 'src');
      const componentsDir = path.join(srcDir, 'components');
      const utilsDir = path.join(srcDir, 'utils');
      
      await fs.promises.mkdir(srcDir, { recursive: true });
      await fs.promises.mkdir(componentsDir, { recursive: true });
      await fs.promises.mkdir(utilsDir, { recursive: true });
      
      await fs.promises.writeFile(path.join(srcDir, 'main.ts'), `
        import { App } from './components/App';
      `);
      
      await fs.promises.writeFile(path.join(componentsDir, 'App.tsx'), `
        import { Header } from './Header';
        import { Footer } from './Footer';
      `);
      
      await fs.promises.writeFile(path.join(componentsDir, 'Header.tsx'), `
        import { Button } from './Button';
      `);
      
      await fs.promises.writeFile(path.join(componentsDir, 'Footer.tsx'), `
        export const Footer = 'Footer';
      `);
      
      await fs.promises.writeFile(path.join(componentsDir, 'Button.tsx'), `
        export const Button = 'Button';
      `);
      
      const result = await analyzer.analyzeProject(testProjectDir);
      graph = result.graph;
    });

    it('应该能够计算文件的影响范围', () => {
      const buttonFile = path.resolve(testProjectDir, 'src/components/Button.tsx');
      const affectedFiles = graph.getAffectedFiles(buttonFile);
      
      // Button被Header依赖，Header被App依赖，App被main依赖
      expect(affectedFiles.length).toBeGreaterThanOrEqual(3);
      expect(affectedFiles.some((file: string) => file.includes('Header'))).toBe(true);
      expect(affectedFiles.some((file: string) => file.includes('App'))).toBe(true);
      expect(affectedFiles.some((file: string) => file.includes('main'))).toBe(true);
    });

    it('应该能够获取依赖深度', () => {
      const mainFile = path.resolve(testProjectDir, 'src/main.ts');
      const buttonFile = path.resolve(testProjectDir, 'src/components/Button.tsx');
      
      const depth = graph.getDependencyDepth(mainFile, buttonFile);
      expect(depth).toBe(3); // main -> App -> Header -> Button
    });

    it('应该能够检查两个文件之间是否存在依赖关系', () => {
      const mainFile = path.resolve(testProjectDir, 'src/main.ts');
      const buttonFile = path.resolve(testProjectDir, 'src/components/Button.tsx');
      const footerFile = path.resolve(testProjectDir, 'src/components/Footer.tsx');
      
      expect(graph.isDependentOn(mainFile, buttonFile)).toBe(true);
      expect(graph.isDependentOn(buttonFile, mainFile)).toBe(false);
      expect(graph.isDependentOn(mainFile, footerFile)).toBe(true);
    });

    it('应该能够获取依赖统计信息', () => {
      const stats = graph.getStats();
      
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.totalEdges).toBeGreaterThan(0);
      expect(stats.maxDepth).toBeGreaterThan(0);
      expect(stats.averageDependencies).toBeGreaterThan(0);
    });

    it('应该能够导出依赖图为DOT格式', () => {
      const dotFormat = graph.toDOT();
      
      expect(dotFormat).toContain('digraph');
      expect(dotFormat).toContain('->');
      expect(dotFormat).toContain('main');
      expect(dotFormat).toContain('App');
    });
  });

  describe('性能和扩展性', () => {
    it('应该能够处理大型项目', async () => {
      // 创建大量文件来测试性能
      const srcDir = path.join(testProjectDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      
      const fileCount = 100;
      const promises = [];
      
      for (let i = 0; i < fileCount; i++) {
        const content = `
          import { module${(i + 1) % fileCount} } from './file${(i + 1) % fileCount}';
          export const module${i} = 'module${i}';
        `;
        promises.push(
          fs.promises.writeFile(path.join(srcDir, `file${i}.ts`), content)
        );
      }
      
      await Promise.all(promises);
      
      const startTime = Date.now();
      const result = await analyzer.analyzeProject(testProjectDir);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.nodes.size).toBe(fileCount);
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('应该能够增量更新依赖图', async () => {
      // 先分析初始项目
      const srcDir = path.join(testProjectDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      
      await fs.promises.writeFile(path.join(srcDir, 'A.ts'), `
        export const A = 'A';
      `);
      
      const initialResult = await analyzer.analyzeProject(testProjectDir);
      expect(initialResult.nodes.size).toBe(1);
      
      // 添加新文件
      await fs.promises.writeFile(path.join(srcDir, 'B.ts'), `
        import { A } from './A';
        export const B = 'B';
      `);
      
      // 增量更新
      const updatedFile = path.join(srcDir, 'B.ts');
      const incrementalResult = await analyzer.updateFile(updatedFile, initialResult.graph);
      
      expect(incrementalResult.success).toBe(true);
      expect(incrementalResult.graph.hasNode(updatedFile)).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理文件读取错误', async () => {
      const nonExistentProject = '/nonexistent/project/path';
      
      const result = await analyzer.analyzeProject(nonExistentProject);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该处理语法错误的文件', async () => {
      const srcDir = path.join(testProjectDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      
      // 创建正常文件和语法错误的文件
      await fs.promises.writeFile(path.join(srcDir, 'valid.ts'), `
        export const valid = 'valid';
      `);
      
      await fs.promises.writeFile(path.join(srcDir, 'invalid.ts'), `
        import { invalid syntax here
        const malformed = 
      `);
      
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.success).toBe(true); // 应该继续处理其他文件
      // 由于语法错误不一定导致文件读取失败，我们检查至少处理了一个文件
      expect(result.nodes.size).toBeGreaterThan(0);
    });

    it('应该处理权限错误', async () => {
      // 创建无读取权限的文件（在Windows上可能无法测试）
      if (process.platform !== 'win32') {
        const srcDir = path.join(testProjectDir, 'src');
        await fs.promises.mkdir(srcDir, { recursive: true });
        
        const restrictedFile = path.join(srcDir, 'restricted.ts');
        await fs.promises.writeFile(restrictedFile, 'export const test = "test";');
        await fs.promises.chmod(restrictedFile, 0o000); // 无读取权限
        
        const result = await analyzer.analyzeProject(testProjectDir);
        
        // 恢复权限以便清理
        await fs.promises.chmod(restrictedFile, 0o644);
        
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
});