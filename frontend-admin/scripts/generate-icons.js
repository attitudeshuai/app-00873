#!/usr/bin/env node

/**
 * 生成 Chrome 扩展所需的 PNG 图标
 * 使用 sharp 库将 SVG 转换为不同尺寸的 PNG
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconSizes = [16, 48, 128];
const svgPath = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

// 检查 SVG 文件是否存在
if (!fs.existsSync(svgPath)) {
  console.error('错误: 找不到 icon.svg 文件');
  process.exit(1);
}

// 读取 SVG 内容
const svgBuffer = fs.readFileSync(svgPath);

// 生成各个尺寸的 PNG
async function generateIcons() {
  console.log('开始生成图标...');

  for (const size of iconSizes) {
    try {
      const outputPath = path.join(outputDir, `icon${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`✓ 已生成 icon${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`✗ 生成 icon${size}.png 失败:`, error.message);
    }
  }

  console.log('图标生成完成！');
}

generateIcons().catch(console.error);
