# Chrome 扩展健壮性风险分析报告

## 分析概述

本报告针对 Chrome 扩展项目中四大核心机制的组合使用进行深度风险分析：
- **Chrome Storage 降级到 localStorage**
- **跨标签页配置同步**
- **输入安全校验**
- **URL 获取失败的 Demo 模式**

分析场景涵盖：扩展环境与普通浏览器环境切换、多标签页并发操作、跨时区使用等。

---

## 一、核心机制代码现状分析

### 1.1 存储降级机制

**关键文件**: [storage.ts](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/storage.ts)

```typescript
// 环境检测逻辑（第131-133行）
export const hasStorageAPI = (): boolean => {
  return typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined';
};
```

**存储策略分支**:
- Chrome 环境：使用 `chrome.storage.sync`（跨设备同步）
- 非 Chrome 环境：降级到 `localStorage`（同源隔离）

### 1.2 跨标签页同步机制

**关键文件**: [storage.ts](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/storage.ts#L185-L213)

```typescript
export const onConfigChange = (callback: ...): (() => void) => {
  if (!hasStorageAPI()) {
    // localStorage 模式下直接返回空函数！
    return () => {};
  }
  // 仅监听 chrome.storage.onChanged
};
```

### 1.3 输入安全校验

**关键文件**: [inputSecurity.ts](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/inputSecurity.ts)

采用黑名单正则匹配方式检测危险模式：
- `<script>` 标签检测
- `javascript:` 协议检测
- 事件处理器属性检测（`onclick=` 等）

### 1.4 Demo 模式触发

**关键文件**: [Popup.vue](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/views/Popup.vue#L86-L94)

```typescript
const tab = await getCurrentTab();
if (tab && tab.url) {
  const sanitized = sanitizeUrl(tab.url);
  currentUrl.value = sanitized || tab.url;
} else {
  // 硬编码 Demo URL，包含非法字符
  currentUrl.value = 'http://localhost:3000 (Demo Mode)';
}
```

---

## 二、场景一：扩展环境与普通浏览器环境切换风险

### 2.1 配置数据割裂问题

**风险等级**: ⚠️ 中高

**问题描述**:

| 环境 | 存储后端 | 数据作用域 | 跨设备同步 |
|------|---------|-----------|-----------|
| Chrome 扩展（已安装） | `chrome.storage.sync` | Google 账户同步 | ✅ 是 |
| 普通网页（开发/预览） | `localStorage` | 同源（协议+域名+端口） | ❌ 否 |

**具体风险**:

1. **配置丢失** ([storage.ts#L68-L78](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/storage.ts#L68-L78))
   - 用户在扩展中配置的时间，在本地开发预览页面看不到
   - 反之亦然，两套存储完全独立，无数据迁移逻辑

2. **存储命名空间冲突**
   - 如果扩展页面与开发服务器同源（罕见但可能），两者会读写同一个 localStorage key `userConfig`
   - 扩展环境检测逻辑存在缺陷：`hasStorageAPI()` 仅检查 `chrome.storage` 是否存在，但：
     - 普通网页中也可能存在 `chrome` 对象（如 Chrome 自带的一些全局变量）
     - 扩展的 content script 环境中 `chrome.storage` 可能受限

3. **降级逻辑的静默失败**
   ```typescript
   // 第82-85行：chrome.storage.sync 不存在时静默返回 false
   if (!chrome?.storage?.sync) {
     resolve(false);
     return;
   }
   ```
   - 调用方 `saveUserConfig` 返回 false 后，Popup 中仅打 warn 日志，无用户提示
   - 用户以为配置已保存，实际未持久化

### 2.2 环境检测误判风险

**风险等级**: ⚠️ 中

**代码问题** ([chrome.ts#L131-L133](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/types/chrome.ts#L131-L133)):

```typescript
export const hasStorageAPI = (): boolean => {
  return typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined';
};
```

**边界场景**:
- 扩展刚安装/升级时，chrome API 可能尚未完全初始化
- 隐私模式/隐身窗口中 `chrome.storage.sync` 可能被禁用
- 企业策略限制扩展存储权限时，API 存在但调用失败
- **在这些场景下会错误地继续使用 chrome.storage，而不是降级到 localStorage，导致运行时错误**

---

## 三、场景二：多标签页同时操作风险

### 3.1 localStorage 模式下跨标签同步完全失效

**风险等级**: 🔴 高

**代码问题** ([storage.ts#L186-L189](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/storage.ts#L186-L189)):

```typescript
if (!hasStorageAPI()) {
  // localStorage 不支持跨标签页监听，返回空的清理函数
  return () => {};
}
```

**影响分析**:

| 场景 | chrome.storage 模式 | localStorage 模式 |
|------|-------------------|------------------|
| 标签页 A 修改配置 | 标签页 B 实时收到通知更新 | ❌ 标签页 B 完全无感 |
| 用户同时打开多个弹窗 | 状态最终一致 | 各标签页状态分叉 |
| 刷新页面后 | 加载最新配置 | 加载最新配置（仅刷新时） |

**HTML5 实际上提供了 localStorage 跨标签页监听机制**，但代码未实现：
```javascript
// 缺失的实现：
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEYS.USER_CONFIG && e.newValue) {
    // 通知配置变更
  }
});
```

### 3.2 并发写入竞态条件

**风险等级**: ⚠️ 中

**问题描述**:

无论是 `chrome.storage.sync` 还是 `localStorage`，都存在并发写入问题：

1. **无版本控制/乐观锁**
   - 存储的配置对象中虽有 `lastUpdated` 时间戳 ([storage.ts#L63](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/storage.ts#L63))，但读取-修改-写入周期中并未检查该字段
   - 标签页 A 和 B 同时读取配置 v1，分别修改为 v2 和 v3，后写入者会覆盖前者，无合并逻辑

2. **chrome.storage.sync 限流风险**
   - Chrome 对 `storage.sync` 有写入频率限制：**每分钟最多 180 次写入**，每小时最多 1800 次
   - 用户快速点击多个预设按钮（今天/明天/3天/一周）时可能触发限流
   - 代码未处理 `chrome.runtime.lastError` 中的 `MAX_WRITE_OPERATIONS_PER_MINUTE` 错误

3. **localStorage 非原子写入**
   - `localStorage.setItem` 是同步阻塞的，但大对象序列化可能阻塞 UI 线程
   - 多个标签页同时写入时，最后写入胜利（LWW），无冲突检测

### 3.3 内存状态与持久化状态不一致

**风险等级**: ⚠️ 中

**代码问题** ([SmartTimeConfig.vue#L79-L85](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/components/SmartTimeConfig.vue#L79-L85)):

```typescript
const tempStartTime = ref(props.startTime);
const tempEndTime = ref(props.endTime);

watch(() => props.startTime, (val) => tempStartTime.value = val);
watch(() => props.endTime, (val) => tempEndTime.value = val);
```

**问题流程**:
1. 用户在标签页 A 输入时间 "09:00"（未失焦，`tempStartTime` 已更新但未 emit）
2. 标签页 B 修改配置为 "10:00" 并保存
3. 标签页 A 收到 `onConfigChange` 回调，更新 props 为 "10:00"
4. watch 触发，`tempStartTime` 被重置为 "10:00"，**用户正在输入的内容丢失**
5. 但如果此时用户恰好失焦，`handleTimeBlur` 使用的是旧的 "09:00"，又会覆盖回 "09:00"

---

## 四、场景三：跨时区风险

### 4.1 时区字段存储与更新逻辑不一致

**风险等级**: ⚠️ 中

**代码问题** ([storage.ts#L60-L65](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/storage.ts#L60-L65)):

```typescript
const configToSave: UserConfig = {
  ...config,
  lastUpdated: Date.now(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone  // 每次保存强制更新为当前时区
};
```

**矛盾点**:
- `startTime`/`endTime` 是格式为 "HH:mm" 的**本地时间字符串**
- `timezone` 字段记录的是保存时的时区，但：
  1. **没有使用该字段做任何转换或校验**
  2. 用户携带笔记本跨时区旅行后打开扩展，保存的时间 "08:00" 是指新时区的 8 点还是旧时区的 8 点？语义不明确
  3. `chrome.storage.sync` 跨设备同步时，两台设备时区不同，时间字符串的含义歧义

### 4.2 默认配置时区固定

**风险等级**: ⚠️ 低

**代码问题** ([storage.ts#L16-L20](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/storage.ts#L16-L20)):

```typescript
const DEFAULT_CONFIG: UserConfig = {
  startTime: '08:00',
  endTime: '17:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone  // 模块加载时固定
};
```

- 模块首次加载时时区被固化到 `DEFAULT_CONFIG`
- 如果用户在扩展运行期间更改系统时区（不重启扩展），`DEFAULT_CONFIG.timezone` 不会更新
- 清除配置后，会用旧的默认时区填充，而非新的当前时区

### 4.3 日期范围计算的时区边界问题

**风险等级**: ⚠️ 中

**代码问题** ([timeHelper.ts#L97-L102](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/timeHelper.ts#L97-L102)):

```typescript
const getTodayLocal = (): dayjs.Dayjs => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || dayjs.tz.guess();
  return dayjs().tz(userTimezone).startOf('day');
};
```

**边缘场景**:
- 用户在 UTC+8 时区（北京时间）23:30 打开扩展，"今天"的范围是 08:00-17:00
- 但此时 UTC 时间是 15:30，如果配置被同步到 UTC 时区的设备，"今天"的计算结果会不同
- 更严重的是：**跨午夜时（23:59 - 00:01）操作**，日期计算可能跨越"今天"和"明天"边界，导致预设按钮"今天"和"明天"的结果与用户预期不符

---

## 五、输入安全校验机制风险

### 5.1 黑名单正则可被绕过

**风险等级**: 🔴 高

**代码问题** ([inputSecurity.ts#L9-L17](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/inputSecurity.ts#L9-L17)):

```typescript
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  // ...
];
```

**潜在绕过方式**:

| 绕过向量 | 示例 | 是否被拦截 |
|---------|------|-----------|
| 大小写混合 | `<ScRiPt>alert(1)</ScRiPt>` | ✅ 已拦截（i 标志） |
| 标签内换行 | `<script\n>alert(1)</script>` | ✅ 已拦截（`\s` 匹配换行） |
| 未闭合标签 | `<script src=//evil.com>` | ❌ **未拦截**（正则要求闭合 `</script>`） |
| 编码混淆 | `<img src=x onerror=alert(1)>` | ⚠️ 被 `on\w+=` 拦截 |
| SVG 载体 | `<svg onload=alert(1)>` | ⚠️ 被 `on\w+=` 拦截 |
| 协议混淆 | `java&#115;cript:alert(1)` | ❌ **未拦截**（HTML实体编码） |
| 空格变体 | `<img\x00src=x onerror=alert(1)>` | ❓ 可能绕过 `\s`（空字符） |
| 无事件属性的 XSS | `<a href="javascript:alert(1)">` | ✅ 被 `javascript:` 拦截 |

### 5.2 URL 校验逻辑存在缺陷

**风险等级**: ⚠️ 中高

**代码问题** ([inputSecurity.ts#L101-L127](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/utils/inputSecurity.ts#L101-L127)):

```typescript
export const sanitizeUrl = (url: string): string | null => {
  if (!isInputSafe(url)) {
    return null;
  }
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }
    return urlObj.toString();
  } catch {
    // 相对路径正则过于宽松！
    if (/^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(url)) {
      return url;
    }
    return null;
  }
};
```

**问题 1**: 相对路径白名单正则包含危险字符
- 正则中包含 `:` `/` `?` `#` `[` `]` `@` 等 URI 保留字符
- 虽然看似安全，但未考虑 browser quirks，如 `\` 在某些浏览器中被当作 `/`
- 允许 `data:` 吗？不，因为 `data:` 包含逗号后内容，但如果不进入 try 块（格式错误的 URL），catch 中的正则**不包含逗号**，所以 data URI 被拦截。这一点是安全的。

**问题 2**: Demo URL 本身绕过校验
- [Popup.vue#L92](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/views/Popup.vue#L92) 硬编码 `'http://localhost:3000 (Demo Mode)'`
- 包含空格和括号，不是合法 URL
- 如果该 URL 被传递到任何需要合法 URL 的 API（如 `fetch`、新建标签页等），会导致失败
- 更严重的是，该 URL 未经 `sanitizeUrl` 处理直接赋值：
  ```typescript
  currentUrl.value = 'http://localhost:3000 (Demo Mode)';  // 绕过了 sanitizeUrl
  ```

**问题 3**: 校验后未重新赋值的兜底逻辑
```typescript
const sanitized = sanitizeUrl(tab.url);
currentUrl.value = sanitized || tab.url;  // ⚠️ 校验失败时回退到原始 URL！
```
- 如果 `sanitizeUrl` 返回 null（检测到危险），代码**反而使用原始未净化 URL**
- 这是一个典型的"校验失败但仍使用原值"的反模式

### 5.3 时间输入校验时机不足

**风险等级**: ⚠️ 中

**代码问题** ([SmartTimeConfig.vue#L18](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/components/SmartTimeConfig.vue#L18)):

- 时间输入仅在 `@blur`（失焦）时校验
- 用户输入过程中 `v-model` 实时更新 `tempStartTime`
- 如果用户正在输入恶意脚本（虽然是 time 类型输入但仍然是文本框），在失焦前这段时间内，该值可能被其他响应式逻辑读取
- 预设按钮点击时使用的是 `tempStartTime.value`（未校验的临时值）而非经过 blur 验证后的值

---

## 六、Demo 模式的风险

### 6.1 Demo 模式与正常模式无明确视觉区分

**风险等级**: ⚠️ 中

- Demo URL 中虽包含 "(Demo Mode)" 文字，但整体 UI 样式与正常模式完全一致
- 无 banner、图标变色、禁用等视觉提示
- 用户可能误以为 Demo 模式下的配置已生效或正在操作真实网站
- 生成的结果文本 `resultText` 包含虚假 URL，用户复制后可能在别处误用

### 6.2 Demo 模式下的功能完整性错觉

**风险等级**: ⚠️ 低

- Demo 模式下"应用配置"功能看似正常工作（生成日期范围、显示结果）
- 但扩展的实际功能（如修改网页内容、注入脚本等）在无标签页时不会执行
- 这在开发测试阶段没问题，但如果用户在实际使用中因权限问题进入 Demo 模式，会产生"配置已生效"的错觉

### 6.3 标签页 URL 获取失败的多种原因未区分

**风险等级**: ⚠️ 中

`getCurrentTab()` 返回 null 的可能原因：
1. 不在扩展环境中（开发预览）→ Demo 模式合理
2. 扩展无 tabs 权限（manifest 配置错误）→ 错误被静默吞掉
3. 当前窗口无活动标签页（极少数情况）
4. Chrome 内部错误（`chrome.runtime.lastError`）

代码将所有失败统一归为 Demo 模式，掩盖了真正的错误原因，给调试带来困难。

---

## 七、多机制组合放大的交叉风险

### 7.1 环境切换 + 多标签页 = 配置分裂与静默覆盖

**风险场景**:

```
时间线：
T1: 用户在 Chrome 扩展中保存配置 startTime=09:00 → 存入 chrome.storage.sync
T2: 用户打开开发预览页面（http://localhost:3000）→ localStorage 为空，使用默认 08:00
T3: 用户在预览页修改为 10:00 → 存入 localStorage
T4: 用户回到扩展弹窗 → 仍然显示 09:00（从 chrome.storage 加载）
T5: 用户在扩展中点击"今天"预设 → 保存 09:00 到 chrome.storage（覆盖无感知）
```

**后果**: 两套存储各自演进，用户在不同环境看到不同配置，无法判断哪个是"最新"的。

### 7.2 跨时区同步 + Demo 模式 = 误导性结果

**风险场景**:
1. 用户在 UTC+8（北京）时区的设备上使用扩展，保存配置 08:00-17:00
2. chrome.storage.sync 同步到 UTC-5（纽约）时区的另一台设备
3. 纽约设备打开扩展时，getDateRange 使用纽约时区计算"今天"
4. 但 startTime 字符串 "08:00" 被直接使用，导致配置的工作时间相对于北京时间偏移了 13 小时
5. 如果恰好 URL 获取失败进入 Demo 模式，用户看到的结果是基于错误时区计算的虚假数据，且无法与真实网站行为比对

### 7.3 安全校验绕过 + 跨标签页同步 = 潜在 XSS 蠕虫

**风险场景**:
1. 攻击者找到绕过 `isInputSafe` 黑名单的 XSS payload
2. 将恶意 payload 注入时间输入框（假设扩展未来版本在某处将配置值作为 HTML 渲染而非文本）
3. chrome.storage.sync 自动同步到该用户登录的所有设备的 Chrome 扩展
4. 所有设备的扩展弹窗打开时，恶意脚本执行
5. 如果扩展有更高权限（如管理其他标签页、读取网页数据），XSS 危害被放大

**当前缓解因素**:
- 目前扩展使用 Vue 模板，默认会进行 HTML 转义，`{{ }}` 插值是文本节点而非 HTML
- 但 [Popup.vue](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-saturn/frontend-admin/src/views/Popup.vue) 中 `v-html` 指令不存在，目前 XSS 风险较低
- 然而 `resultText` 使用 `{{ resultText }}` 是安全的，但如果未来有人为了"美化"改为 `v-html`，黑名单防护将不足

---

## 八、风险总结矩阵

| 风险类别 | 风险项 | 严重程度 | 发生概率 | 综合评级 |
|---------|-------|---------|---------|---------|
| 存储降级 | 环境切换配置丢失 | 中 | 高 | ⚠️ 中 |
| 存储降级 | API 检测误判导致静默失败 | 中 | 低 | ⚠️ 低中 |
| 跨标签同步 | localStorage 模式下同步完全失效 | 高 | 中（开发环境必现） | 🔴 高 |
| 跨标签同步 | 并发写入竞态覆盖 | 中 | 低 | ⚠️ 中 |
| 跨标签同步 | 用户输入被远程重置 | 中 | 低 | ⚠️ 低中 |
| 跨时区 | 时间语义歧义（本地时间 vs 绝对时间） | 中 | 中 | ⚠️ 中 |
| 跨时区 | DST（夏令时）切换未处理 | 低 | 低 | ℹ️ 低 |
| 输入安全 | 黑名单正则可被绕过 | 高 | 低（需组合其他漏洞） | ⚠️ 中高 |
| 输入安全 | sanitizeUrl 失败后回退原值 | 高 | 中 | 🔴 高 |
| 输入安全 | Demo URL 硬编码绕过校验 | 中 | 高（Demo 模式必现） | ⚠️ 中 |
| Demo 模式 | 无视觉区分导致用户混淆 | 中 | 高 | ⚠️ 中 |
| Demo 模式 | 错误原因被掩盖 | 低 | 中 | ℹ️ 低中 |
| 交叉风险 | 环境+多标签配置分裂 | 中 | 中 | ⚠️ 中 |
| 交叉风险 | 时区同步+Demo 误导结果 | 中 | 低 | ⚠️ 低中 |

---

## 九、修复建议

### 9.1 存储层修复

1. **实现 localStorage 跨标签页监听**:
```typescript
// storage.ts - onConfigChange 补充 localStorage 支持
if (!hasStorageAPI()) {
  const storageListener = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.USER_CONFIG && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (isValidUserConfig(parsed)) callback(parsed);
      } catch {}
    }
  };
  window.addEventListener('storage', storageListener);
  return () => window.removeEventListener('storage', storageListener);
}
```

2. **增加存储版本号与迁移逻辑**
3. **加入简单的乐观锁机制**（比较 lastUpdated 时间戳）
4. **chrome.storage.sync 写入添加节流/错误重试**

### 9.2 环境检测增强

```typescript
// chrome.ts - 更可靠的环境检测
export const isChromeExtensionContext = (): boolean => {
  try {
    return typeof chrome !== 'undefined' &&
           typeof chrome.runtime !== 'undefined' &&
           typeof chrome.runtime.id !== 'undefined' &&  // 扩展ID存在才是真正的扩展环境
           typeof chrome.storage !== 'undefined';
  } catch {
    return false;
  }
};
```

### 9.3 安全校验修复

1. **URL 校验失败时不要回退到原始值**:
```typescript
const sanitized = sanitizeUrl(tab.url);
currentUrl.value = sanitized || '';  // 而非 || tab.url
```

2. **Demo URL 使用明确标记且不模拟真实 URL 格式**:
```typescript
currentUrl.value = '[Demo Mode] No active tab';
```

3. **将黑名单改为白名单**（对时间输入尤其简单）：
```typescript
// sanitizeTimeInput 已使用白名单 /^[\d:\s]+$/，这是好的
// 对其他输入也尽量采用白名单策略
```

4. **给 isInputSafe 补充对未闭合标签、编码混淆的检测**，或考虑使用 DOMPurify 等成熟库

### 9.4 跨时区处理明确化

- 明确 `startTime`/`endTime` 的语义：**始终是用户当前本地时间**，并在加载时检测时区变化提醒用户
- 或者存储为 UTC 偏移后的分钟数（如 08:00 存储为 8*60=480，表示"本地时间上午8点"），在所有设备上都用本地时区解释

### 9.5 Demo 模式视觉区分

添加明显的 Demo 模式标识：
- 顶部显示橙色/黄色警告条
- 更改头部颜色主题（蓝色→橙色）
- 预设按钮添加"[Demo]"后缀
- 禁用可能误导用户的操作（如"复制结果"按钮）

---

## 十、结论

当前四套机制的组合在**单一环境、单标签页、相同时区**的理想场景下可以工作，但在以下方面存在显著健壮性缺陷：

1. **localStorage 降级模式是一个不完整的实现**——只做了读写降级，没有做监听同步，导致多标签页体验在开发环境中严重割裂
2. **输入安全校验采用黑名单策略存在固有缺陷**，且 `sanitizeUrl` 的失败回退逻辑是一个明确的安全反模式
3. **Demo 模式的错误处理过于粗糙**，既掩盖了真实错误，又缺乏足够的用户警示
4. **跨时区语义模糊**在跨设备同步场景下可能导致时间计算错误
5. **各机制之间缺乏防御性编程的深度**——一层防护被绕过（如环境检测误判），其他层没有足够的冗余保护

建议优先修复：`sanitizeUrl` 回退逻辑、localStorage 跨标签同步、Demo 模式视觉提示这三项，可在较小改动下显著提升健壮性。
