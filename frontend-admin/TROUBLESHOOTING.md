# 故障排除指南

## 图标加载失败问题

### 错误信息
```
Could not load icon 'icons/icon16.png' specified in 'icons'.
无法加载清单。
```

### 解决步骤

#### 1. 确认文件存在
```bash
cd frontend-admin
ls -la dist/icons/*.png
```

应该看到三个 PNG 文件：
- `dist/icons/icon16.png`
- `dist/icons/icon48.png`
- `dist/icons/icon128.png`

#### 2. 如果文件不存在，重新生成和构建
```bash
# 生成图标
npm run generate-icons

# 重新构建
npm run build

# 验证
ls -la dist/icons/*.png
```

#### 3. 在 Chrome 中重新加载扩展

**方法一：重新加载**
1. 打开 `chrome://extensions/`
2. 找到你的扩展
3. 点击"重新加载"按钮（🔄）

**方法二：完全移除后重新加载**
1. 打开 `chrome://extensions/`
2. 找到你的扩展
3. 点击"移除"
4. 点击"加载已解压的扩展程序"
5. **重要**：选择 `frontend-admin/dist` 目录（不是 `frontend-admin`）

#### 4. 验证 manifest.json 路径

确保 `dist/manifest.json` 中的路径是：
```json
{
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

路径应该是相对于 `dist` 目录的。

#### 5. 检查文件权限

```bash
chmod 644 dist/icons/*.png dist/manifest.json
```

#### 6. 清除 Chrome 缓存

如果以上方法都不行：
1. 完全关闭 Chrome
2. 删除扩展的缓存目录（可选）
3. 重新打开 Chrome
4. 重新加载扩展

## 验证清单

- [ ] 图标文件已生成（`npm run generate-icons`）
- [ ] 项目已构建（`npm run build`）
- [ ] `dist/icons/` 目录下有 3 个 PNG 文件
- [ ] `dist/manifest.json` 存在且路径正确
- [ ] 在 Chrome 中选择了正确的目录（`dist`）
- [ ] 已重新加载扩展

## 如果问题仍然存在

1. 检查 Chrome 控制台是否有其他错误信息
2. 检查扩展的"错误"标签页
3. 尝试在无痕模式下加载扩展
4. 检查是否有其他扩展冲突
