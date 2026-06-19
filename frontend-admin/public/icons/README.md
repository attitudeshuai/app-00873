# 图标文件说明

Chrome扩展需要以下尺寸的PNG图标：
- ✅ icon16.png (16x16) - 已生成
- ✅ icon48.png (48x48) - 已生成
- ✅ icon128.png (128x128) - 已生成

## 生成图标

项目已包含自动生成脚本，运行以下命令即可生成所有尺寸的图标：

```bash
npm run generate-icons
```

该脚本会从 `icon.svg` 自动生成所有所需的 PNG 图标文件。

## 手动生成（备选方案）

如果需要手动生成，可以使用以下方法：

1. **使用在线工具**: 访问 https://www.favicon-generator.org/ 上传 icon.svg 生成多尺寸图标

2. **使用ImageMagick**:
```bash
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

## 图标设计

图标采用蓝色主题（#409EFF），符合项目主色调，包含时钟元素，表示时间配置功能。
