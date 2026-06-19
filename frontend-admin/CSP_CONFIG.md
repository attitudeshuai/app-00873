# 内容安全策略（CSP）配置说明

## 概述

本扩展使用严格的内容安全策略（Content Security Policy）来防止 XSS 攻击、代码注入和其他安全威胁。

## 当前 CSP 配置

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
}
```

## 各指令说明

### 1. `script-src 'self'`
- **作用**：只允许从扩展自身加载脚本
- **安全级别**：严格
- **说明**：禁止从外部 CDN 或远程服务器加载 JavaScript 代码，所有脚本必须打包在扩展中

### 2. `object-src 'self'`
- **作用**：只允许从扩展自身加载对象（如 `<object>`、`<embed>`、`<applet>`）
- **安全级别**：严格
- **说明**：防止加载外部插件或对象

### 3. `style-src 'self' 'unsafe-inline'`
- **作用**：允许从扩展自身加载样式，并允许内联样式
- **安全级别**：中等（因 `'unsafe-inline'`）
- **说明**：
  - `'self'`：允许从扩展自身加载 CSS 文件
  - `'unsafe-inline'`：允许内联样式（Element Plus 组件库需要）
  - **注意**：虽然使用了 `'unsafe-inline'`，但这是 Element Plus 框架的要求，且我们已通过输入验证来降低风险

### 4. `img-src 'self' data: https:`
- **作用**：允许从扩展自身、data URI 和 HTTPS 加载图片
- **安全级别**：中等
- **说明**：
  - `'self'`：允许扩展自身的图片资源
  - `data:`：允许 data URI 格式的图片（用于图标等）
  - `https:`：允许从 HTTPS 源加载图片（如果需要显示外部图片）

### 5. `font-src 'self' data:`
- **作用**：允许从扩展自身和 data URI 加载字体
- **安全级别**：严格
- **说明**：
  - `'self'`：允许扩展自身的字体文件
  - `data:`：允许 data URI 格式的字体（Element Plus 可能需要）

### 6. `connect-src 'self' https:`
- **作用**：允许扩展自身和 HTTPS 连接
- **安全级别**：中等
- **说明**：
  - `'self'`：允许扩展内部的网络请求（如 Chrome storage API）
  - `https:`：允许 HTTPS 连接（如果需要调用外部 API）

### 7. `base-uri 'self'`
- **作用**：限制 `<base>` 标签的 URL 只能指向扩展自身
- **安全级别**：严格
- **说明**：防止通过 `<base>` 标签重定向相对 URL 到恶意站点

### 8. `form-action 'self'`
- **作用**：限制表单提交的目标只能是扩展自身
- **安全级别**：严格
- **说明**：防止表单被提交到外部恶意站点

### 9. `frame-ancestors 'none'`
- **作用**：禁止扩展页面被嵌入到其他页面中
- **安全级别**：严格
- **说明**：防止点击劫持攻击（Clickjacking）

## 安全最佳实践

### ✅ 已实施的安全措施

1. **禁止远程脚本**：所有 JavaScript 代码必须打包在扩展中
2. **禁止 eval()**：不使用 `eval()` 或 `new Function()` 等动态代码执行
3. **输入验证**：所有用户输入都经过严格的验证和清理（见 `inputSecurity.ts`）
4. **类型安全**：使用 TypeScript 提供类型安全
5. **HTTPS 优先**：所有外部连接都使用 HTTPS

### ⚠️ 注意事项

1. **`'unsafe-inline'` 的使用**：
   - Element Plus 组件库需要内联样式
   - 我们通过输入验证和 XSS 防护来降低风险
   - 如果未来可以移除 Element Plus，建议移除 `'unsafe-inline'`

2. **外部资源**：
   - 当前配置允许从 HTTPS 加载图片和连接
   - 如果不需要外部资源，可以进一步限制为 `'self'` 和 `data:` 仅

## Manifest V3 要求

根据 Chrome Extension Manifest V3 的要求：

- ✅ 不允许 `'unsafe-eval'`（我们未使用）
- ✅ 不允许远程脚本源（我们只使用 `'self'`）
- ✅ 所有脚本都打包在扩展中
- ✅ 使用最小权限原则

## 测试建议

1. **安装测试**：确保扩展可以正常安装
2. **功能测试**：确保所有功能正常工作
3. **控制台检查**：检查浏览器控制台是否有 CSP 违规警告
4. **安全扫描**：使用 Chrome Web Store 的安全扫描工具

## 参考资源

- [Chrome Extension CSP 文档](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy/)
- [Manifest V3 安全要求](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security/)
- [CSP 最佳实践](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure/)
