#!/usr/bin/env node

/**
 * 🌊 MCP OpenAI 流式输出示例
 * 展示如何使用 OpenAI 流式响应功能
 * 
 * 使用方法：
 * 1. 设置环境变量：
 *    OPENAI_API_KEY=your_api_key
 *    OPENAI_MODEL=gpt-4
 * 
 * 2. 运行示例：
 *    npm run build && node dist/stream-example.js
 *    或者
 *    npx ts-node src/stream-example.ts
 */

import { runMCPOpenAIStreamExample } from './mcp-openai-example';

async function main() {
  console.log('🌊 MCP OpenAI 流式输出示例');
  console.log('================================\n');
  
  console.log('📋 使用说明:');
  console.log('1. 确保已设置 OPENAI_API_KEY 环境变量');
  console.log('2. 可选设置 OPENAI_MODEL（默认 gpt-4）');
  console.log('3. 观察流式输出效果\n');
  
  console.log('🚀 开始运行流式输出示例...\n');
  
  try {
    await runMCPOpenAIStreamExample();
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
    process.exit(1);
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

export { main as runStreamExample };
