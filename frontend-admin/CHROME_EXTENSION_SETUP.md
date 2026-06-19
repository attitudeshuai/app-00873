# Chrome 扩展安装指南

## 构建步骤

1. **生成图标文件**（首次或图标更新后）：
```bash
npm run generate-icons
```

2. **构建项目**：
```bash
npm run build
```

3. **验证构建产物**：
确保 `dist` 目录下有以下文件：
- `manifest.json`
- `index.html`
- `icons/icon16.png`
- `icons/icon48.png`
- `icons/icon128.png`
- `assets/` 目录（包含 JS 和 CSS 文件）

## 加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. **重要**：选择 `dist` 目录（不是 `frontend-admin` 目录）
   - 正确路径：`frontend-admin/dist`
   - 错误路径：`frontend-admin`（会导致图标加载失败）

## 常见问题

### 图标加载失败

**错误信息**：`Could not load icon 'icons/icon16.png' specified in 'icons'`

**解决方法**：
1. 确保已运行 `npm run generate-icons` 生成图标文件
2. 确保已运行 `npm run build` 构建项目
3. 在 Chrome 扩展管理页面，点击扩展的"重新加载"按钮
4. 如果仍然失败，完全移除扩展后重新加载

### 验证文件是否存在

运行以下命令验证文件：
```bash
cd frontend-admin
ls -la dist/icons/*.png
ls -la dist/manifest.json
```

应该看到：
- `dist/icons/icon16.png`
- `dist/icons/icon48.png`
- `dist/icons/icon128.png`
- `dist/manifest.json`

### 重新加载扩展

如果修改了代码或配置：
1. 重新运行 `npm run build`
2. 在 Chrome 扩展管理页面点击扩展的"重新加载"按钮
3. 或者移除扩展后重新加载

## 文件结构

```
frontend-admin/
├── dist/                    ← 加载这个目录到 Chrome
│   ├── manifest.json
│   ├── index.html
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── assets/
│       ├── js/
│       └── css/
├── public/
│   └── icons/
│       └── icon.svg        ← 图标源文件
└── scripts/
    └── generate-icons.js   ← 图标生成脚本
```
