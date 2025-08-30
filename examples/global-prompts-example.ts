/**
 * 🚀 全局提示词模板功能演示
 * 
 * 演示如何从用户目录 ~/.sker/prompts 加载和管理提示词模板
 * 
 * 功能特性：
 * - 从全局目录加载提示词模板
 * - 创建默认模板文件
 * - 保存自定义模板
 * - 智能回退机制
 */

import * as os from 'os';
import * as fs from 'fs';
import { MCPPromptManager } from '../src/mcp-prompts';
import { PromptTemplatesProvider } from '../src/prompt-templates';

async function main(): Promise<void> {
  console.log('🚀 全局提示词模板功能演示');
  console.log('='.repeat(50));

  // 1. 创建提示词管理器和模板提供者
  console.log('\n📦 初始化组件:');
  const promptManager = new MCPPromptManager();
  const templateProvider = new PromptTemplatesProvider(promptManager);
  
  console.log('   ✅ 创建提示词管理器');
  console.log('   ✅ 创建模板提供者');

  // 2. 显示全局提示词目录
  console.log('\n📁 全局提示词目录:');
  const globalDir = templateProvider.getGlobalPromptsDirectory();
  console.log(`   📂 ${globalDir}`);

  // 3. 创建示例模板文件（如果目录为空）
  console.log('\n� 检查并创建示例模板:');
  try {
    const files = await fs.promises.readdir(globalDir).catch(() => []);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    if (mdFiles.length === 0) {
      console.log('   📂 目录为空，创建示例模板文件');
      await templateProvider.createExampleTemplate();
      console.log('   ✅ 示例模板创建完成');
    } else {
      console.log(`   📋 发现 ${mdFiles.length} 个现有模板文件`);
    }
  } catch (error) {
    console.log(`   ❌ 检查模板文件失败: ${(error as Error).message}`);
  }

  // 4. 从全局目录加载所有模板
  console.log('\n📥 加载全局提示词模板:');
  try {
    await templateProvider.loadAllTemplates();
    console.log('   ✅ 模板加载完成');
  } catch (error) {
    console.log(`   ❌ 模板加载失败: ${(error as Error).message}`);
  }

  // 5. 显示已加载的模板
  console.log('\n📋 已加载的提示词模板:');
  const loadedPrompts = promptManager.getPrompts();
  console.log(`   📊 总计: ${loadedPrompts.length} 个模板`);
  
  loadedPrompts.forEach((prompt, index) => {
    console.log(`   ${index + 1}. ${prompt.name}`);
    console.log(`      📝 ${prompt.description}`);
    console.log(`      🔧 参数: ${prompt.arguments.length} 个`);
  });

  // 6. 演示模板渲染
  console.log('\n🎨 模板渲染演示:');
  if (loadedPrompts.length > 0) {
    const firstPrompt = loadedPrompts[0]!;
    console.log(`   🎯 使用模板: ${firstPrompt.name}`);
    
    try {
      // 准备示例参数
      const sampleArgs: Record<string, string> = {};
      firstPrompt.arguments.forEach(arg => {
        if (arg.required) {
          // 为必需参数提供示例值
          switch (arg.name) {
            case 'language':
              sampleArgs[arg.name] = 'TypeScript';
              break;
            case 'code':
              sampleArgs[arg.name] = 'function hello() { console.log("Hello, World!"); }';
              break;
            default:
              sampleArgs[arg.name] = `示例${arg.name}`;
          }
        }
      });
      
      const renderedPrompt = promptManager.renderPrompt(firstPrompt.name, sampleArgs);
      console.log('   ✅ 渲染成功');
      console.log('   📄 渲染结果预览:');
      const promptText = String(renderedPrompt);
      const preview = promptText.split('\n').slice(0, 5).join('\n');
      console.log(`      ${preview.replace(/\n/g, '\n      ')}`);
      if (promptText.split('\n').length > 5) {
        console.log('      ... (更多内容)');
      }
    } catch (error) {
      console.log(`   ❌ 渲染失败: ${(error as Error).message}`);
    }
  }

  // 7. 演示保存自定义Markdown模板
  console.log('\n💾 保存自定义Markdown模板演示:');
  const customTemplate = {
    name: 'custom-greeting',
    description: '自定义问候模板',
    template: `你好，{{name}}！

欢迎使用 {{product}} 产品。

今天是 {{date}}，希望你有美好的一天！

特别说明：{{note}}

## 使用指南

1. 请确保填写正确的{{name}}
2. {{product}}名称要准确
3. 如有疑问，请查看{{note}}部分`,
    arguments: [
      {
        name: 'name',
        description: '用户姓名',
        required: true
      },
      {
        name: 'product',
        description: '产品名称',
        required: true
      },
      {
        name: 'date',
        description: '日期',
        required: false,
        default: new Date().toLocaleDateString('zh-CN')
      },
      {
        name: 'note',
        description: '特别说明',
        required: false,
        default: '感谢您的使用！'
      }
    ]
  };

  try {
    // 保存为Markdown格式
    await templateProvider.saveTemplate(customTemplate, 'md');
    console.log('   ✅ 自定义Markdown模板保存成功');

    // 注册到管理器
    promptManager.registerPrompt(customTemplate);
    console.log('   ✅ 模板注册成功');

    // 测试渲染
    const customRendered = promptManager.renderPrompt('custom-greeting', {
      name: '张三',
      product: 'Sker AI'
    });

    console.log('   🎨 自定义模板渲染结果:');
    const customText = String(customRendered);
    console.log(`      ${customText.replace(/\n/g, '\n      ')}`);

  } catch (error) {
    console.log(`   ❌ 自定义模板操作失败: ${(error as Error).message}`);
  }

  // 8. 显示最终统计
  console.log('\n📊 最终统计:');
  const finalPrompts = promptManager.getPrompts();
  console.log(`   📈 总模板数: ${finalPrompts.length}`);
  console.log(`   📂 全局目录: ${globalDir}`);
  console.log(`   🏠 用户主目录: ${os.homedir()}`);

  // 9. 使用建议
  console.log('\n💡 使用建议:');
  console.log('   1. 将常用的提示词模板保存到全局目录');
  console.log('   2. 使用Markdown格式编写模板，便于阅读和编辑');
  console.log('   3. 使用{{参数名}}格式定义模板参数');
  console.log('   4. 文件名即为模板名称，使用描述性命名');
  console.log('   5. 支持复杂的Markdown格式，包括代码块、列表等');
  console.log('   6. 定期备份全局提示词目录');
  console.log('   7. 可以直接用文本编辑器编辑.md模板文件');

  console.log('\n🎉 演示完成！');
}

// 运行演示
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 演示运行失败:', error);
    process.exit(1);
  });
}

export { main };
