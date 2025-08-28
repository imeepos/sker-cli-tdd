/**
 * 🔄 TDD 重构阶段：MCP Prompt 功能使用示例
 * 演示如何使用 MCP 服务器的提示词功能
 * 遵循 TDD 原则：基于已测试功能的示例
 */

import { MCPServer } from '../src/mcp-server';
import { MCPPromptManager } from '../src/mcp-prompts';
import { PromptTemplatesProvider } from '../src/prompt-templates';

/**
 * MCP Prompt 功能的使用示例
 * 演示完整的提示词管理工作流程：
 * 1. 创建服务器和提示词管理器
 * 2. 注册预定义的提示词模板
 * 3. 注册自定义提示词
 * 4. 渲染提示词
 * 5. 与 MCP 服务器集成使用
 */
export async function runMCPPromptsExample(): Promise<void> {
  console.log('🚀 启动 MCP Prompt 功能示例...\n');

  // 1. 创建服务器和提示词管理器
  console.log('📋 创建 MCP 服务器和提示词管理器...');
  const server = new MCPServer();
  const promptManager = new MCPPromptManager();
  
  // 将提示词管理器集成到服务器
  server.setPromptManager(promptManager);
  
  console.log(`📦 服务器名称: ${server.getName()}`);
  console.log(`✅ 提示词管理器已集成到服务器\n`);

  // 2. 注册预定义的提示词模板
  console.log('🔧 注册预定义的提示词模板...');
  const templatesProvider = new PromptTemplatesProvider(promptManager);
  templatesProvider.registerAllTemplates();
  
  const allPrompts = server.getPrompts();
  console.log(`✅ 已注册 ${allPrompts.length} 个预定义提示词模板:`);
  allPrompts.forEach(prompt => {
    console.log(`   - ${prompt.name}: ${prompt.description}`);
  });
  console.log('');

  // 3. 注册自定义提示词
  console.log('🎨 注册自定义提示词...');
  promptManager.registerPrompt({
    name: 'meeting-summary',
    description: '会议纪要生成提示词',
    template: `请根据以下会议记录生成专业的会议纪要：

会议主题：{{topic}}
参会人员：{{participants}}
会议时间：{{date}}

会议内容：
{{content}}

请生成包含以下部分的会议纪要：
1. 会议基本信息
2. 主要讨论内容
3. 决策事项
4. 行动计划
5. 下次会议安排

格式要求：{{format}}`,
    arguments: [
      {
        name: 'topic',
        description: '会议主题',
        required: true
      },
      {
        name: 'participants',
        description: '参会人员',
        required: true
      },
      {
        name: 'date',
        description: '会议时间',
        required: true
      },
      {
        name: 'content',
        description: '会议内容记录',
        required: true
      },
      {
        name: 'format',
        description: '格式要求',
        required: false,
        default: '正式商务格式'
      }
    ]
  });
  
  console.log('✅ 已注册自定义提示词: meeting-summary\n');

  // 4. 演示提示词渲染
  console.log('🎯 演示提示词渲染功能...\n');

  // 渲染代码审查提示词
  console.log('📝 渲染代码审查提示词:');
  try {
    const codeReviewPrompt = await server.renderPrompt('code-review', {
      language: 'TypeScript',
      code: `function calculateSum(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}`,
      focus: '性能和现代化改进'
    });
    
    console.log('渲染结果:');
    console.log('---');
    console.log(codeReviewPrompt);
    console.log('---\n');
  } catch (error) {
    console.error('❌ 渲染代码审查提示词失败:', (error as Error).message);
  }

  // 渲染学习计划提示词
  console.log('📚 渲染学习计划提示词:');
  try {
    const learningPlanPrompt = await server.renderPrompt('learning-plan', {
      subject: 'TypeScript 和 TDD',
      current_level: '初级',
      target_level: '中高级',
      available_time: '每天2小时',
      special_requirements: '重点关注实际项目应用'
    });
    
    console.log('渲染结果:');
    console.log('---');
    console.log(learningPlanPrompt);
    console.log('---\n');
  } catch (error) {
    console.error('❌ 渲染学习计划提示词失败:', (error as Error).message);
  }

  // 渲染自定义会议纪要提示词
  console.log('📋 渲染自定义会议纪要提示词:');
  try {
    const meetingSummaryPrompt = await server.renderPrompt('meeting-summary', {
      topic: 'MCP 服务器功能扩展讨论',
      participants: '张三、李四、王五',
      date: '2024年1月15日 14:00-16:00',
      content: `1. 讨论了 MCP 服务器的 Prompt 功能扩展
2. 确定了 TDD 开发流程
3. 分配了开发任务
4. 讨论了测试策略`
    });
    
    console.log('渲染结果:');
    console.log('---');
    console.log(meetingSummaryPrompt);
    console.log('---\n');
  } catch (error) {
    console.error('❌ 渲染会议纪要提示词失败:', (error as Error).message);
  }

  // 5. 演示错误处理
  console.log('⚠️  演示错误处理...');
  
  // 尝试渲染不存在的提示词
  try {
    await server.renderPrompt('nonexistent-prompt', {});
  } catch (error) {
    console.log(`✅ 正确捕获错误: ${(error as Error).message}`);
  }
  
  // 尝试渲染缺少必需参数的提示词
  try {
    await server.renderPrompt('code-review', { language: 'TypeScript' }); // 缺少 code 参数
  } catch (error) {
    console.log(`✅ 正确捕获参数错误: ${(error as Error).message}`);
  }

  console.log('');

  // 6. 显示最终统计
  console.log('📊 功能统计:');
  const finalPrompts = server.getPrompts();
  console.log(`✅ 总共注册了 ${finalPrompts.length} 个提示词`);
  
  const categories = {
    '编程相关': finalPrompts.filter(p => p.name.includes('code')).length,
    '文档写作': finalPrompts.filter(p => p.name.includes('documentation')).length,
    '需求分析': finalPrompts.filter(p => p.name.includes('requirement')).length,
    '学习教育': finalPrompts.filter(p => p.name.includes('learning')).length,
    '自定义': finalPrompts.filter(p => p.name.includes('meeting')).length
  };
  
  Object.entries(categories).forEach(([category, count]) => {
    if (count > 0) {
      console.log(`   - ${category}: ${count} 个`);
    }
  });

  console.log('\n🎉 MCP Prompt 功能示例完成！');
}

/**
 * 如果直接运行此文件则执行示例
 */
if (require.main === module) {
  runMCPPromptsExample().catch(console.error);
}
