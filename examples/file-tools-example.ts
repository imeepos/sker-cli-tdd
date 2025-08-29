/**
 * 🚀 文件工具使用示例
 * 演示完整的文件操作工作流程：
 * 1. 创建 MCP 服务器和文件工具提供者
 * 2. 注册文件相关工具
 * 3. 执行各种文件操作
 * 4. 演示文件搜索和权限管理
 */

import { MCPServer } from '../src/mcp-server.js';
import { MCPWorkspaceManager } from '../src/mcp-workspace.js';
import { ToolManager } from '../src/tool-manager.js';
import { FileToolsProvider } from '../src/file-tools.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 文件工具的完整使用示例
 * 演示所有文件操作功能
 */
export async function runFileToolsExample(): Promise<void> {
  console.log('🚀 启动文件工具示例...\n');

  // 1. 创建 MCP 服务器和管理器
  console.log('📋 创建 MCP 服务器和管理器...');
  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  
  console.log(`📦 服务器名称: ${server.getName()}`);
  console.log(`📦 服务器版本: ${server.getVersion()}\n`);

  // 2. 注册文件工具
  console.log('🔧 注册文件工具...');
  const fileToolsProvider = new FileToolsProvider();
  toolManager.registerToolProvider(fileToolsProvider);
  
  const tools = toolManager.getAvailableTools();
  console.log(`✅ 已注册 ${tools.length} 个工具:`);
  tools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  console.log();

  // 3. 创建临时测试环境
  const tempDir = path.join(os.tmpdir(), 'sker-file-tools-demo-' + Date.now());
  await fs.promises.mkdir(tempDir, { recursive: true });
  console.log(`📁 创建测试目录: ${tempDir}\n`);

  try {
    // 4. 演示文件创建和写入
    console.log('📝 演示文件创建和写入...');
    
    const testFile = path.join(tempDir, 'demo.txt');
    const createResult = await toolManager.executeTool('create_file', {
      path: testFile,
      content: 'Hello, File Tools!\n这是一个演示文件。'
    });
    console.log(`✅ 创建文件结果:`, createResult);

    // 5. 演示文件读取
    console.log('\n📖 演示文件读取...');
    const readResult = await toolManager.executeTool('read_file', {
      path: testFile
    });
    console.log(`✅ 读取文件结果:`, readResult);

    // 6. 演示文件写入（更新内容）
    console.log('\n✏️ 演示文件内容更新...');
    const updateContent = `Hello, File Tools!
这是一个演示文件。
更新时间: ${new Date().toLocaleString()}
包含中文内容测试。`;

    const writeResult = await toolManager.executeTool('write_file', {
      path: testFile,
      content: updateContent
    });
    console.log(`✅ 更新文件结果:`, writeResult);

    // 7. 演示文件复制
    console.log('\n📋 演示文件复制...');
    const copyPath = path.join(tempDir, 'demo-copy.txt');
    const copyResult = await toolManager.executeTool('copy_file', {
      sourcePath: testFile,
      destPath: copyPath
    });
    console.log(`✅ 复制文件结果:`, copyResult);

    // 8. 演示文件移动
    console.log('\n🚚 演示文件移动...');
    const movePath = path.join(tempDir, 'demo-moved.txt');
    const moveResult = await toolManager.executeTool('move_file', {
      sourcePath: copyPath,
      destPath: movePath
    });
    console.log(`✅ 移动文件结果:`, moveResult);

    // 9. 创建更多测试文件用于搜索演示
    console.log('\n📁 创建更多测试文件...');
    const files = [
      { name: 'config.json', content: '{"name": "demo", "version": "1.0.0"}' },
      { name: 'readme.md', content: '# Demo Project\n\nThis is a demo project.' },
      { name: 'script.js', content: 'console.log("Hello World");' }
    ];

    for (const file of files) {
      const filePath = path.join(tempDir, file.name);
      await toolManager.executeTool('create_file', {
        path: filePath,
        content: file.content
      });
      console.log(`   ✅ 创建文件: ${file.name}`);
    }

    // 10. 演示文件搜索
    console.log('\n🔍 演示文件名搜索...');
    const searchResult = await toolManager.executeTool('search_files', {
      directory: tempDir,
      pattern: 'demo'
    });
    console.log(`✅ 搜索结果:`, searchResult);

    // 11. 演示内容搜索
    console.log('\n🔍 演示文件内容搜索...');
    const contentSearchResult = await toolManager.executeTool('search_content', {
      directory: tempDir,
      query: 'Hello'
    });
    console.log(`✅ 内容搜索结果:`, contentSearchResult);

    // 12. 演示权限检查
    console.log('\n🔒 演示文件权限检查...');
    const permissionsResult = await toolManager.executeTool('check_permissions', {
      path: testFile
    });
    console.log(`✅ 权限检查结果:`, permissionsResult);

    // 13. 演示权限修改
    console.log('\n🔧 演示文件权限修改...');
    const setPermissionsResult = await toolManager.executeTool('set_permissions', {
      path: testFile,
      mode: 0o644
    });
    console.log(`✅ 权限修改结果:`, setPermissionsResult);

    // 14. 演示文件删除
    console.log('\n🗑️ 演示文件删除...');
    const deleteResult = await toolManager.executeTool('delete_file', {
      path: movePath
    });
    console.log(`✅ 删除文件结果:`, deleteResult);

    // 15. 显示工具使用统计
    console.log('\n📊 工具使用统计:');
    const stats = toolManager.getToolStats();
    console.log(`   - 总工具数: ${stats.totalTools}`);
    console.log(`   - 总执行次数: ${stats.totalExecutions}`);
    console.log(`   - 成功率: ${(stats.successRate * 100).toFixed(2)}%`);

    // 16. 显示所有工具帮助信息
    console.log('\n📚 文件工具帮助信息:');
    const fileTools = tools.filter(tool => tool.name.includes('file') || 
                                           tool.name.includes('search') || 
                                           tool.name.includes('permissions'));
    fileTools.forEach(tool => {
      console.log(`\n🔧 ${tool.name}:`);
      console.log(`   描述: ${tool.description}`);
      if (tool.schema && tool.schema['properties']) {
        console.log(`   参数:`);
        Object.entries(tool.schema['properties']).forEach(([key, value]: [string, any]) => {
          console.log(`     - ${key}: ${value.description || '无描述'}`);
        });
      }
    });

  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  } finally {
    // 17. 清理测试环境
    console.log('\n🧹 清理测试环境...');
    try {
      const files = await fs.promises.readdir(tempDir);
      for (const file of files) {
        await fs.promises.unlink(path.join(tempDir, file));
      }
      await fs.promises.rmdir(tempDir);
      console.log('✅ 测试环境清理完成');
    } catch (error) {
      console.warn('⚠️ 清理测试环境时出现警告:', (error as Error).message);
    }
  }

  console.log('\n🎉 文件工具演示完成！');
  console.log('\n💡 提示: 这些工具现在已集成到 CLI 中，可以通过 MCP 协议调用。');
}

/**
 * 错误处理演示
 */
export async function runFileToolsErrorHandlingExample(): Promise<void> {
  console.log('\n🚀 启动文件工具错误处理演示...\n');

  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const fileToolsProvider = new FileToolsProvider();
  
  toolManager.registerToolProvider(fileToolsProvider);

  // 演示各种错误情况
  console.log('❌ 演示错误处理...');

  // 1. 读取不存在的文件
  console.log('\n1. 读取不存在的文件:');
  const readError = await toolManager.executeTool('read_file', {
    path: '/non/existent/file.txt'
  });
  console.log('结果:', readError);

  // 2. 写入到无权限目录
  console.log('\n2. 写入到受保护目录:');
  const writeError = await toolManager.executeTool('write_file', {
    path: '/root/protected.txt',
    content: 'test'
  });
  console.log('结果:', writeError);

  // 3. 搜索不存在的目录
  console.log('\n3. 搜索不存在的目录:');
  const searchError = await toolManager.executeTool('search_files', {
    directory: '/non/existent/directory',
    pattern: 'test'
  });
  console.log('结果:', searchError);

  console.log('\n✅ 错误处理演示完成！所有错误都被正确捕获和处理。');
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
  runFileToolsExample()
    .then(() => runFileToolsErrorHandlingExample())
    .catch(console.error);
}
