# 智能时间配置插件

## 1 如何运行

### 本地开发
cd frontend-admin
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建 Chrome 扩展
```bash
# 构建项目
npm run build
```
1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"，选择项目的 `dist` 目录

### Docker 构建
```bash
docker compose up --build
```
构建产物将在容器中可用，或通过 localhost:8080 访问（预览模式）。

## 2 服务说明

项目采用标准的 Vue 3 + Vite 架构。
- **前端框架**: Vue 3, Element Plus, TypeScript
- **构建工具**: Vite
- **容器化**: Docker, Nginx

## 3 测试账号

（此客户端扩展不适用，但按要求包含）
- **用户名**: admin
- **密码**: admin123

## 4 题目内容

帮我生成一个chrome浏览器插件，读取目前浏览器访问的网址，可以在插件浮窗中自动设置活动时间的起始到结束时间，我希望有日期选择有今天、明天、3天、一周、14天。时间输入框有开始的时间，以及结束的时间可以填写，默认的开始时间是8点，结束时间是17点，这两个时间要求是输入框，可以设置时间，输入整数就是整数时间，最后在浮窗中可以根据配置一键设置时间选择器。

### 功能特性
- **URL读取**: 自动获取当前 Tab 的 URL。
- **日期选择**: 提供今天、明天、3天、一周、14天等快捷选项。
- **时间设置**: 支持整数快速输入（如输入9自动转换为09:00），默认8:00-17:00。
- **一键配置**: 点击应用后生成配置并在界面显示反馈（模拟设置过程）。

### 工程标准
- **UI框架**: Vue 3 + Element Plus
- **样式**: 使用 Flex/Grid 布局，视觉分层清晰。
- **交互**: 完整的 Hover、Loading、Toast 反馈。
- **工程化**: 包含 Docker 构建流程和规范的目录结构。

### 设计规范遵循

#### 视觉与排版
- ✅ **背景与视觉区分**: 页面使用卡片式布局，不同功能区域有明显分隔（URL卡片、配置卡片、结果卡片）
- ✅ **字体层级**: 定义了完整的字体尺寸系统（H1/H2/H3/H4/Body/Small）
- ✅ **颜色系统**: 使用统一的CSS变量系统，避免高饱和度紫色，主色调为蓝色系（#409EFF）
- ✅ **间距系统**: 基于8px的间距系统（4px/8px/16px/24px/32px）

#### 交互规范
- ✅ **按钮交互**: 所有按钮都有hover效果、active状态和过渡动画
- ✅ **输入验证**: 时间输入有完整的格式验证和错误提示
- ✅ **操作反馈**: 所有操作都有Toast消息提示（成功/警告/错误）
- ✅ **链接处理**: 复制功能包含错误处理和降级方案

#### 工程可交付
- ✅ **构建产物**: 清晰的目录结构（dist/assets/js、dist/assets/css、dist/assets/images）
- ✅ **代码分割**: 手动分包优化，避免单个chunk过大
- ✅ **资源管理**: 静态资源（图标、字体）分类存放
- ✅ **Docker支持**: 多阶段构建，支持ARM和X86架构

### 项目结构

```
frontend-admin/
├── src/
│   ├── styles/              # 样式系统
│   │   ├── variables.css    # 设计变量
│   │   └── base.css         # 基础样式
│   ├── components/          # 组件
│   │   └── SmartTimeConfig.vue
│   ├── views/               # 视图
│   │   └── Popup.vue
│   └── utils/               # 工具函数
│       └── timeHelper.ts
├── public/                  # 静态资源
│   ├── icons/              # 扩展图标
│   └── manifest.json       # Chrome扩展清单
├── Dockerfile              # Docker构建文件
├── docker-compose.yml      # Docker编排文件
└── vite.config.ts          # Vite配置
```

### 开发说明

#### 样式系统使用
项目使用统一的CSS变量系统，所有颜色、字体、间距都通过变量管理，确保一致性。

#### 时间输入格式
- 支持整数输入：输入 `9` 自动转换为 `09:00`
- 支持标准格式：`HH:mm` 格式（如 `09:30`）
- 自动验证：输入格式不正确时会提示并重置为默认值

#### 构建优化
- 代码分割：Element Plus、Vue核心库、图标库分别打包
- 资源分类：图片、字体、JS、CSS分别存放在不同目录
- 压缩优化：使用 esbuild 进行代码压缩

### 常见问题

**Q: 如何生成扩展图标？**
A: 查看 `public/icons/README.md` 文件，使用提供的工具生成所需尺寸的PNG图标。

**Q: Docker构建失败怎么办？**
A: 确保Docker已启动，检查网络连接，尝试清理构建缓存：`docker compose down && docker compose build --no-cache`

**Q: 扩展无法读取URL？**
A: 确保 `manifest.json` 中已配置 `activeTab` 权限，并在Chrome扩展管理页面重新加载扩展。
