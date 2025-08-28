/**
 * Context上下文功能使用示例
 * 
 * 演示如何使用Context功能来分析和管理文件系统结构
 */

import { ContextBuilder, FolderContext, FileContext, ContextBuilderOptions } from '../src/index.js';

/**
 * Context功能使用示例
 * 演示完整的Context功能使用流程：
 * 1. 创建ContextBuilder实例
 * 2. 扫描项目目录
 * 3. 分析项目结构
 * 4. 展示统计信息
 */
export async function runContextExample(): Promise<void> {
  console.log('🚀 启动 Context 上下文功能示例...\n');

  // 1. 创建Context构建器
  console.log('📋 创建 Context 构建器...');
  const builder = new ContextBuilder();
  
  // 2. 扫描当前项目目录
  console.log('🔍 扫描当前项目目录...');
  const projectPath = process.cwd();
  console.log(`📁 项目路径: ${projectPath}\n`);

  try {
    // 基本扫描 - 扫描所有文件
    console.log('📊 基本扫描 - 包含所有文件:');
    const basicContext = await builder.buildFromDirectory(projectPath, {
      maxDepth: 2 // 限制深度避免扫描太多文件
    });
    
    displayContextStats('基本扫描', basicContext);

    // 过滤扫描 - 只包含源代码文件
    console.log('\n📊 过滤扫描 - 只包含源代码文件:');
    const sourceOptions: ContextBuilderOptions = {
      includeExtensions: ['.ts', '.js', '.json', '.md'],
      maxDepth: 3
    };
    
    const sourceContext = await builder.buildFromDirectory(projectPath, sourceOptions);
    displayContextStats('源代码扫描', sourceContext);

    // 排除扫描 - 排除构建和缓存文件
    console.log('\n📊 排除扫描 - 排除构建和缓存文件:');
    const cleanOptions: ContextBuilderOptions = {
      excludeExtensions: ['.map', '.log', '.cache', '.tmp'],
      maxDepth: 2
    };

    const cleanContext = await builder.buildFromDirectory(projectPath, cleanOptions);
    displayContextStats('清洁扫描', cleanContext);

    // .gitignore扫描 - 遵循.gitignore规则
    console.log('\n📊 .gitignore扫描 - 遵循.gitignore忽略规则:');
    const gitignoreOptions: ContextBuilderOptions = {
      respectGitignore: true,
      maxDepth: 3
    };

    const gitignoreContext = await builder.buildFromDirectory(projectPath, gitignoreOptions);
    displayContextStats('.gitignore扫描', gitignoreContext);

    // 3. 详细分析项目结构
    console.log('\n🔍 详细分析项目结构:');
    analyzeProjectStructure(sourceContext);

    // 4. 演示Context树遍历
    console.log('\n🌳 Context树遍历示例:');
    traverseContextTree(sourceContext, 0, 2); // 只显示前2层

    // 5. 演示.gitignore功能
    console.log('\n🚫 .gitignore功能演示:');
    await demonstrateGitignoreFeature(builder, projectPath);

    // 6. 演示文件信息功能
    console.log('\n📄 文件信息功能演示:');
    await demonstrateFileInfoFeature(builder, projectPath);

    // 7. 演示Context查找功能
    console.log('\n🔎 Context查找功能演示:');
    demonstrateContextSearch(sourceContext);

  } catch (error) {
    console.error('❌ 扫描过程中出错:', (error as Error).message);
  }

  console.log('\n🎉 Context 上下文功能示例完成！');
}

/**
 * 显示Context统计信息
 */
function displayContextStats(title: string, context: FolderContext): void {
  const stats = calculateContextStats(context);
  
  console.log(`✅ ${title}结果:`);
  console.log(`   📁 总文件夹数: ${stats.folderCount}`);
  console.log(`   📄 总文件数: ${stats.fileCount}`);
  console.log(`   📊 总项目数: ${stats.totalCount}`);
  console.log(`   🏗️  直接子项: ${context.children.length}`);
}

/**
 * 计算Context统计信息
 */
function calculateContextStats(context: FolderContext): {
  folderCount: number;
  fileCount: number;
  totalCount: number;
} {
  let folderCount = 1; // 包含当前文件夹
  let fileCount = 0;

  function traverse(ctx: FolderContext): void {
    for (const child of ctx.children) {
      if (child.type === 'folder') {
        folderCount++;
        traverse(child as FolderContext);
      } else {
        fileCount++;
      }
    }
  }

  traverse(context);

  return {
    folderCount,
    fileCount,
    totalCount: folderCount + fileCount
  };
}

/**
 * 分析项目结构
 */
function analyzeProjectStructure(context: FolderContext): void {
  const srcFolder = context.findChild('src') as FolderContext;
  const testsFolder = context.findChild('tests') as FolderContext;
  const packageJson = context.findChild('package.json') as FileContext;

  console.log('📋 项目结构分析:');
  
  if (packageJson) {
    console.log('   ✅ 发现 package.json - Node.js 项目');
  }
  
  if (srcFolder) {
    console.log(`   ✅ 发现 src 目录 - 包含 ${srcFolder.children.length} 个项目`);
    
    // 分析源代码文件类型
    const tsFiles = srcFolder.children.filter(child => 
      child.type === 'file' && (child as FileContext).extension === '.ts'
    );
    const testFiles = srcFolder.children.filter(child => 
      child.type === 'file' && child.name.includes('.test.')
    );
    
    console.log(`   📝 TypeScript 文件: ${tsFiles.length} 个`);
    console.log(`   🧪 测试文件: ${testFiles.length} 个`);
  }
  
  if (testsFolder) {
    console.log(`   ✅ 发现 tests 目录 - 包含 ${testsFolder.children.length} 个项目`);
  }

  // 查找配置文件
  const configFiles = context.children.filter(child => 
    child.type === 'file' && (
      child.name.includes('config') || 
      child.name.startsWith('.') ||
      child.name.includes('tsconfig') ||
      child.name.includes('jest')
    )
  );
  
  if (configFiles.length > 0) {
    console.log(`   ⚙️  配置文件: ${configFiles.length} 个`);
    configFiles.slice(0, 3).forEach(file => {
      console.log(`      - ${file.name}`);
    });
    if (configFiles.length > 3) {
      console.log(`      ... 还有 ${configFiles.length - 3} 个`);
    }
  }
}

/**
 * 遍历Context树
 */
function traverseContextTree(context: FolderContext, depth: number, maxDepth: number): void {
  if (depth > maxDepth) return;

  const indent = '  '.repeat(depth);
  const icon = context.type === 'folder' ? '📁' : '📄';
  
  console.log(`${indent}${icon} ${context.name}`);

  if (context.type === 'folder') {
    // 只显示前几个子项，避免输出过多
    const childrenToShow = context.children.slice(0, 5);
    
    for (const child of childrenToShow) {
      if (child.type === 'folder') {
        traverseContextTree(child as FolderContext, depth + 1, maxDepth);
      } else {
        const childIndent = '  '.repeat(depth + 1);
        console.log(`${childIndent}📄 ${child.name}`);
      }
    }
    
    if (context.children.length > 5) {
      const remaining = context.children.length - 5;
      const remainingIndent = '  '.repeat(depth + 1);
      console.log(`${remainingIndent}... 还有 ${remaining} 个项目`);
    }
  }
}

/**
 * 演示.gitignore功能
 */
async function demonstrateGitignoreFeature(builder: ContextBuilder, projectPath: string): Promise<void> {
  console.log('🔍 检查.gitignore文件:');

  try {
    const fs = require('fs');
    const path = require('path');
    const gitignorePath = path.join(projectPath, '.gitignore');

    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      console.log('   ✅ 发现.gitignore文件');

      // 显示部分.gitignore内容
      const lines = gitignoreContent.split('\n').filter((line: string) => line.trim() && !line.startsWith('#'));
      const sampleRules = lines.slice(0, 5);

      if (sampleRules.length > 0) {
        console.log('   📋 忽略规则示例:');
        sampleRules.forEach((rule: string) => {
          console.log(`      - ${rule}`);
        });
        if (lines.length > 5) {
          console.log(`      ... 还有 ${lines.length - 5} 条规则`);
        }
      }

      // 比较启用和禁用.gitignore的差异
      console.log('\n   📊 .gitignore效果对比:');

      const withGitignore = await builder.buildFromDirectory(projectPath, {
        respectGitignore: true,
        maxDepth: 2
      });

      const withoutGitignore = await builder.buildFromDirectory(projectPath, {
        respectGitignore: false,
        maxDepth: 2
      });

      const withStats = calculateContextStats(withGitignore);
      const withoutStats = calculateContextStats(withoutGitignore);

      console.log(`      启用.gitignore: ${withStats.totalCount} 个项目`);
      console.log(`      禁用.gitignore: ${withoutStats.totalCount} 个项目`);
      console.log(`      被忽略的项目: ${withoutStats.totalCount - withStats.totalCount} 个`);

    } else {
      console.log('   ℹ️  未发现.gitignore文件');
      console.log('   💡 可以创建.gitignore文件来忽略不需要的文件');
    }

  } catch (error) {
    console.log(`   ❌ 检查.gitignore时出错: ${(error as Error).message}`);
  }
}

/**
 * 演示文件信息功能
 */
async function demonstrateFileInfoFeature(builder: ContextBuilder, projectPath: string): Promise<void> {
  console.log('🔍 扫描项目文件并加载详细信息:');

  try {
    // 扫描项目，只包含源代码文件
    const context = await builder.buildFromDirectory(projectPath, {
      includeExtensions: ['.ts', '.js', '.json', '.md'],
      respectGitignore: true,
      maxDepth: 2
    });

    // 收集所有文件
    const allFiles = getAllFiles(context);
    console.log(`   📊 发现 ${allFiles.length} 个源代码文件`);

    if (allFiles.length > 0) {
      // 选择几个有代表性的文件进行详细分析
      const sampleFiles = allFiles.slice(0, 3);

      console.log('\n   📋 文件详细信息:');
      for (const file of sampleFiles) {
        console.log(`\n   📄 ${file.name}:`);

        // 加载文件统计信息
        await file.loadFileInfo();

        console.log(`      📏 大小: ${file.size} 字节`);
        console.log(`      🕒 修改时间: ${file.modifiedTime?.toLocaleString()}`);
        console.log(`      🔗 MIME类型: ${file.mimeType}`);
        console.log(`      📝 文本文件: ${file.isTextFile ? '是' : '否'}`);
        console.log(`      🔐 文件hash: ${file.hash?.substring(0, 16)}...`);

        // 如果是文本文件，加载内容并生成简介
        if (file.isTextFile && file.size && file.size < 10000) { // 只处理小于10KB的文件
          await file.loadContent();
          if (file.hasContent) {
            const summary = file.generateSummary();
            console.log(`      📖 文件简介: ${summary}`);

            // 显示文件内容预览（前3行）
            const lines = file.content!.split('\n');
            const preview = lines.slice(0, 3).join('\n');
            console.log(`      👀 内容预览:`);
            console.log(`         ${preview.replace(/\n/g, '\n         ')}`);
            if (lines.length > 3) {
              console.log(`         ... 还有 ${lines.length - 3} 行`);
            }
          }
        }
      }

      // 统计文件类型分布
      console.log('\n   📊 文件类型统计:');
      const typeStats = analyzeFileTypes(allFiles);
      Object.entries(typeStats).forEach(([type, count]) => {
        console.log(`      ${type}: ${count} 个文件`);
      });

      // 统计文件大小分布
      console.log('\n   📏 文件大小分析:');
      await analyzeFileSizes(allFiles);
    }

  } catch (error) {
    console.log(`   ❌ 文件信息分析时出错: ${(error as Error).message}`);
  }
}

/**
 * 分析文件类型分布
 */
function analyzeFileTypes(files: FileContext[]): Record<string, number> {
  const typeStats: Record<string, number> = {};

  files.forEach(file => {
    const ext = file.extension || '(无扩展名)';
    typeStats[ext] = (typeStats[ext] || 0) + 1;
  });

  return typeStats;
}

/**
 * 分析文件大小分布
 */
async function analyzeFileSizes(files: FileContext[]): Promise<void> {
  // 为文件加载大小信息
  const filesWithSize = [];
  for (const file of files) {
    if (!file.size) {
      await file.loadFileInfo();
    }
    if (file.size !== undefined) {
      filesWithSize.push({ name: file.name, size: file.size });
    }
  }

  if (filesWithSize.length === 0) {
    console.log('      无法获取文件大小信息');
    return;
  }

  // 计算统计信息
  const sizes = filesWithSize.map(f => f.size);
  const totalSize = sizes.reduce((sum, size) => sum + size, 0);
  const avgSize = totalSize / sizes.length;
  const maxFile = filesWithSize.reduce((max, file) => file.size > max.size ? file : max);
  const minFile = filesWithSize.reduce((min, file) => file.size < min.size ? file : min);

  console.log(`      总大小: ${formatBytes(totalSize)}`);
  console.log(`      平均大小: ${formatBytes(avgSize)}`);
  console.log(`      最大文件: ${maxFile.name} (${formatBytes(maxFile.size)})`);
  console.log(`      最小文件: ${minFile.name} (${formatBytes(minFile.size)})`);
}

/**
 * 格式化字节数为可读格式
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 演示Context查找功能
 */
function demonstrateContextSearch(context: FolderContext): void {
  console.log('🔍 查找功能演示:');
  
  // 查找特定文件
  const packageJson = context.findChild('package.json');
  if (packageJson) {
    console.log(`   ✅ 找到 package.json: ${packageJson.path}`);
  }
  
  // 查找src目录
  const srcFolder = context.findChild('src');
  if (srcFolder && srcFolder.type === 'folder') {
    console.log(`   ✅ 找到 src 目录: ${srcFolder.path}`);
    
    // 在src目录中查找index文件
    const indexFile = (srcFolder as FolderContext).findChild('index.ts');
    if (indexFile) {
      console.log(`   ✅ 找到 index.ts: ${indexFile.path}`);
      
      // 演示相对路径计算
      const relativePath = (indexFile as FileContext).getRelativePath(context);
      console.log(`   📍 相对路径: ${relativePath}`);

      // 演示祖先关系检查
      const isDescendant = (indexFile as FileContext).isDescendantOf(context);
      console.log(`   🔗 是项目根目录的后代: ${isDescendant}`);
    }
  }
  
  // 统计不同类型的文件
  const allFiles = getAllFiles(context);
  const filesByExtension = groupFilesByExtension(allFiles);
  
  console.log('   📊 文件类型统计:');
  Object.entries(filesByExtension).forEach(([ext, files]) => {
    console.log(`      ${ext || '(无扩展名)'}: ${files.length} 个`);
  });
}

/**
 * 获取所有文件
 */
function getAllFiles(context: FolderContext): FileContext[] {
  const files: FileContext[] = [];
  
  function traverse(ctx: FolderContext): void {
    for (const child of ctx.children) {
      if (child.type === 'file') {
        files.push(child as FileContext);
      } else {
        traverse(child as FolderContext);
      }
    }
  }
  
  traverse(context);
  return files;
}

/**
 * 按扩展名分组文件
 */
function groupFilesByExtension(files: FileContext[]): Record<string, FileContext[]> {
  return files.reduce((groups, file) => {
    const ext = file.extension || '(无扩展名)';
    if (!groups[ext]) {
      groups[ext] = [];
    }
    groups[ext].push(file);
    return groups;
  }, {} as Record<string, FileContext[]>);
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  runContextExample().catch(console.error);
}
