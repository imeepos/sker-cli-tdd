/**
 * 🚀 网络请求工具使用示例
 * 演示如何使用网络请求工具进行API调用和数据获取
 */

import { FetchToolsProvider } from '../src/fetch-tools';
import { MCPServer } from '../src/mcp-server';
import { MCPWorkspaceManager } from '../src/mcp-workspace';
import { ToolManager } from '../src/tool-manager';

/**
 * 基础网络请求示例
 */
export async function runBasicFetchExample(): Promise<void> {
  console.log('\n🚀 启动基础网络请求示例...\n');

  // 创建必要的组件
  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const fetchToolsProvider = new FetchToolsProvider();
  
  // 注册网络请求工具
  toolManager.registerToolProvider(fetchToolsProvider);

  try {
    // 1. 演示基本的HTTP GET请求
    console.log('🌐 演示基本HTTP GET请求...');
    const getResult = await toolManager.executeTool('fetch_url', {
      url: 'https://httpbin.org/get'
    });
    console.log(`✅ GET请求结果:`, {
      success: getResult.success,
      status: getResult.status,
      dataLength: getResult.data?.length || 0,
      responseTime: getResult.responseTime
    });

    // 2. 演示JSON API调用
    console.log('\n📊 演示JSON API调用...');
    const jsonResult = await toolManager.executeTool('fetch_json', {
      url: 'https://httpbin.org/json'
    });
    console.log(`✅ JSON API结果:`, {
      success: jsonResult.success,
      status: jsonResult.status,
      hasData: !!jsonResult.data,
      responseTime: jsonResult.responseTime
    });
    if (jsonResult.data) {
      console.log('   数据预览:', JSON.stringify(jsonResult.data).substring(0, 100) + '...');
    }

    // 3. 演示获取网页内容
    console.log('\n📄 演示获取网页内容...');
    const htmlResult = await toolManager.executeTool('fetch_url', {
      url: 'https://httpbin.org/html'
    });
    console.log(`✅ HTML内容获取:`, {
      success: htmlResult.success,
      status: htmlResult.status,
      contentLength: htmlResult.data?.length || 0,
      isHTML: htmlResult.data?.includes('<html>') || false
    });

  } catch (error) {
    console.error(`❌ 基础示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 实用API调用示例
 */
export async function runPracticalApiExample(): Promise<void> {
  console.log('\n🚀 启动实用API调用示例...\n');

  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const fetchToolsProvider = new FetchToolsProvider();
  
  toolManager.registerToolProvider(fetchToolsProvider);

  try {
    // 1. 获取GitHub API信息
    console.log('🐙 演示GitHub API调用...');
    const githubResult = await toolManager.executeTool('fetch_json', {
      url: 'https://api.github.com/repos/microsoft/typescript'
    });
    if (githubResult.success && githubResult.data) {
      console.log(`✅ TypeScript仓库信息:`, {
        name: githubResult.data.name,
        description: githubResult.data.description,
        stars: githubResult.data.stargazers_count,
        language: githubResult.data.language,
        updated: githubResult.data.updated_at
      });
    }

    // 2. 获取天气信息（使用免费API）
    console.log('\n🌤️ 演示天气API调用...');
    const weatherResult = await toolManager.executeTool('fetch_json', {
      url: 'https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current_weather=true'
    });
    if (weatherResult.success && weatherResult.data) {
      console.log(`✅ 北京天气信息:`, {
        temperature: weatherResult.data.current_weather?.temperature,
        windspeed: weatherResult.data.current_weather?.windspeed,
        time: weatherResult.data.current_weather?.time
      });
    }

    // 3. 获取随机名言
    console.log('\n💭 演示名言API调用...');
    const quoteResult = await toolManager.executeTool('fetch_json', {
      url: 'https://api.quotable.io/random'
    });
    if (quoteResult.success && quoteResult.data) {
      console.log(`✅ 随机名言:`, {
        content: quoteResult.data.content,
        author: quoteResult.data.author,
        tags: quoteResult.data.tags
      });
    }

  } catch (error) {
    console.error(`❌ 实用API示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 错误处理和边界情况示例
 */
export async function runErrorHandlingExample(): Promise<void> {
  console.log('\n🚀 启动错误处理示例...\n');

  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const fetchToolsProvider = new FetchToolsProvider();
  
  toolManager.registerToolProvider(fetchToolsProvider);

  // 1. 演示404错误处理
  console.log('❌ 演示404错误处理...');
  const notFoundResult = await toolManager.executeTool('fetch_url', {
    url: 'https://httpbin.org/status/404'
  });
  console.log('结果:', {
    success: notFoundResult.success,
    status: notFoundResult.status,
    statusText: notFoundResult.statusText
  });

  // 2. 演示超时处理
  console.log('\n⏱️ 演示超时处理...');
  const timeoutResult = await toolManager.executeTool('fetch_url', {
    url: 'https://httpbin.org/delay/5',
    timeout: 2000 // 2秒超时
  });
  console.log('结果:', {
    success: timeoutResult.success,
    error: timeoutResult.error,
    responseTime: timeoutResult.responseTime
  });

  // 3. 演示无效JSON处理
  console.log('\n📄 演示无效JSON处理...');
  const invalidJsonResult = await toolManager.executeTool('fetch_json', {
    url: 'https://httpbin.org/html' // 返回HTML而不是JSON
  });
  console.log('结果:', {
    success: invalidJsonResult.success,
    error: invalidJsonResult.error
  });
}

/**
 * 主函数 - 运行所有示例
 */
export async function runAllFetchExamples(): Promise<void> {
  console.log('🌐 网络请求工具完整示例');
  console.log('=' .repeat(50));

  await runBasicFetchExample();
  await runPracticalApiExample();
  await runErrorHandlingExample();

  console.log('\n✅ 所有网络请求示例完成！');
  console.log('🔗 现在AI可以联网查询资料和调用API了！');
  console.log('=' .repeat(50));
}

// 如果直接运行此文件
if (require.main === module) {
  runAllFetchExamples().catch(console.error);
}
