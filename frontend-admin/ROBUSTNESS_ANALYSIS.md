# Chrome 扩展健壮性组合机制风险分析

> 分析对象：`frontend-admin` 智能时间配置 Chrome 扩展
> 分析维度：Chrome Storage 降级、跨标签页配置同步、输入安全校验、URL 获取失败时的 Demo 模式
> 关注场景：扩展环境与普通浏览器环境切换、多标签页同时操作、跨时区
> 分析日期：2026-06-19

---

## 一、被分析的四套机制现状速览

### 1. Chrome Storage 降级到 localStorage
代码位于 [storage.ts](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts)。

- 通过 `hasStorageAPI()` 判断是否处于 Chrome 扩展环境；不可用时使用 `localStorage` 持久化 [storage.ts:68-78](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L68-L78)。
- 写入时会附加 `lastUpdated` 时间戳与当前 `timezone` [storage.ts:60-65](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L60-L65)。
- 读出后通过 `isValidUserConfig` 校验 startTime/endTime 字段及 HH:mm 格式 [storage.ts:27-46](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L27-L46)。

### 2. 跨标签页配置同步
- 仅在扩展环境下使用 `chrome.storage.onChanged` 监听 `sync` 区域变更 [storage.ts:185-213](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L185-L213)。
- 普通浏览器环境（`localStorage` 路径）下显式返回空 cleanup（即不订阅 `storage` 事件）：`// localStorage 不支持跨标签页监听，返回空的清理函数`。
- Popup 加载时 `onConfigChange` 回调会把新配置直接覆盖到本地 ref [Popup.vue:97-101](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/views/Popup.vue#L97-L101)。

### 3. 输入安全校验
代码位于 [inputSecurity.ts](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/inputSecurity.ts)。

- `isInputSafe` 用正则黑名单识别 `<script>`、`javascript:`、`on*=` 等危险特征 [inputSecurity.ts:9-49](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/inputSecurity.ts#L9-L49)。
- `sanitizeTimeInput` 限制只允许数字/冒号/空格 [inputSecurity.ts:69-94](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/inputSecurity.ts#L69-L94)。
- `sanitizeUrl` 仅允许 http/https；解析失败时回退到一个相对路径白名单字符集匹配 [inputSecurity.ts:101-127](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/inputSecurity.ts#L101-L127)。
- 在 SmartTimeConfig 中，`handleTimeBlur` 先 `isInputSafe` 再 `sanitizeTimeInput`，校验失败后回落到默认值 [SmartTimeConfig.vue:87-178](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/components/SmartTimeConfig.vue#L87-L178)。

### 4. URL 获取失败的 Demo 模式
代码位于 [Popup.vue:86-94](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/views/Popup.vue#L86-L94)：

```ts
const tab = await getCurrentTab();
if (tab && tab.url) {
  const sanitized = sanitizeUrl(tab.url);
  currentUrl.value = sanitized || tab.url;   // <-- 注意：sanitize 失败时仍然使用原始 url
} else {
  currentUrl.value = 'http://localhost:3000 (Demo Mode)';
}
```

`getCurrentTab` 在非扩展环境或 `chrome.tabs` 不可用时返回 `null`，此时进入 Demo 模式 [chrome.ts:139-166](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/types/chrome.ts#L139-L166)。

---

## 二、四套机制组合时的风险矩阵

将"环境切换 / 多标签页 / 跨时区"三类场景与四套机制交叉，可识别出以下具体风险：

### 风险 A：扩展环境与普通浏览器环境切换时 —— 配置不一致

**触发条件**：用户先在扩展 Popup（`chrome.storage.sync`）保存配置，再以普通网页（`vite dev` 或部署 `nginx` 静态站）打开同一前端；或反向操作。

**问题**：
- 两条存储路径完全独立：`chrome.storage.sync` 与 `localStorage` 互不读写、互不监听。
- `loadUserConfig` 中只判断 `hasStorageAPI()`，没有"扩展环境读不到时回退查 localStorage"的合并策略 [storage.ts:103-145](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L103-L145)。
- 因此用户在浏览器里改的 08:00-19:00，回到扩展会发现仍然是旧的 08:00-17:00；用户会误以为"配置丢失"，从而再次保存——出现两套不同步的"真相版本"。

**严重程度**：中。不影响功能正常运行，但导致"配置漂移"的 UX 问题与运维困惑。

### 风险 B：localStorage 模式下完全无跨标签页同步

**触发条件**：在普通浏览器环境（开发或预览模式）打开多个 Popup 页 / 多个 Tab。

**问题**：
- `onConfigChange` 在 `!hasStorageAPI()` 分支直接 `return () => {}` [storage.ts:186-189](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L186-L189)。
- 实际上，浏览器原生 `window.addEventListener('storage', ...)` 完全可以承担跨标签页同步（这正是 localStorage 的标准能力），但代码没有接入。
- 后果：Tab A 改了 09:00-18:00 并 `saveUserConfig` 写入 localStorage，Tab B 完全感知不到，仍按内存中旧值产生 `resultText`，并且下次 `handleApply` 时再次 `saveUserConfig`，会**用 Tab B 的旧值覆盖 Tab A 的新值**——典型 last-write-wins 数据丢失。

**严重程度**：中-高。多 Tab 工作流下会出现真实的写覆盖与隐性数据丢失。

### 风险 C：Chrome Storage 多标签页同步的"回写循环"与覆盖

**触发条件**：扩展环境下，两个 Popup 同时打开（虽然 Popup 通常单实例，但 `chrome-extension://...html` 页或选项页可被多 Tab 打开）。

**问题**：
- `onConfigChange` 收到回调后直接修改 `configStartTime`/`configEndTime`，没有去重判断 [Popup.vue:97-101](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/views/Popup.vue#L97-L101)。
- `onChanged` 事件**对自身写入也会触发**（Chrome 行为），目前回调里没有"忽略自身写入"或"基于 lastUpdated 时间戳判断新旧"的保护。
- `lastUpdated` 字段虽然写入了 [storage.ts:63](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L63)，但读取/同步路径里**完全没有用它做新旧比较**，因此真正发生写冲突时无法选择最新版本。
- 当用户在 Tab A 正在编辑（已修改 ref 但尚未失焦/提交）时，Tab B 触发的同步事件会立刻覆盖 Tab A 的临时输入，造成"输入到一半被吞掉"的体验问题。

**严重程度**：中。视为可优化的健壮性缺陷。

### 风险 D：跨时区下保存值与解析值不一致

**触发条件**：用户在时区 A 保存配置，乘飞机/出差到时区 B 后再使用；或者 `chrome.storage.sync` 在跨设备同步后不同设备时区不同。

**问题**：
- 保存时写入的是当前 `Intl.DateTimeFormat().resolvedOptions().timeZone` [storage.ts:64](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L64)。
- 但 `loadUserConfig` 从未读取/比较该字段，`getDateRange` 直接使用本地时区 `Intl....timeZone` 作为基准 [timeHelper.ts:97-102](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/timeHelper.ts#L97-L102)。
- 因此用户在 UTC+8 设置 "08:00-17:00 今天" 与跨设备同步后在 UTC-5 解析，得到的是 **UTC-5 的 08:00-17:00**，而不是 UTC+8 当时的真实时刻——含义被悄悄改变了，但 UI 不会有任何提示。
- 字段结构里 `timezone` 仅是装饰性元数据，没有形成"按保存时区还原"的策略。
- 此外 `DEFAULT_CONFIG` 在模块初始化时一次性求值时区 [storage.ts:16-20](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L16-L20)；扩展长时间运行时若系统时区变化，缓存值会过期。

**严重程度**：中。语义混乱、跨设备同步用户最受影响。

### 风险 E：`isValidUserConfig` 的时间格式正则与 `lastUpdated/timezone` 字段污染

- 正则 `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/` 可以接受单字符小时（如 `9:00`），但 `formatTimeInput` 会输出 `09:00`，两侧合规集合不完全一致。
- `isValidUserConfig` **没有校验 `lastUpdated` 的类型**，攻击者若能写入 `localStorage`（同源 XSS 等）可以注入 `{ startTime:"08:00", endTime:"17:00", lastUpdated:{__proto__:...} }`。虽然当前未做 deep merge，但若未来引入合并策略将形成原型污染面。
- `timezone` 字段未校验，可被写入任意字符串。

**严重程度**：低-中。当前不会立即触发漏洞，但是给未来版本埋雷。

### 风险 F：`sanitizeUrl` 失败回退到原始 URL —— 安全策略可被绕过

代码 [Popup.vue:88-89](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/views/Popup.vue#L88-L89)：

```ts
const sanitized = sanitizeUrl(tab.url);
currentUrl.value = sanitized || tab.url;   // ← sanitize 失败仍展示原始 url
```

- 当 `tab.url` 是 `chrome://`, `file://`, `about:blank`, `data:`, `javascript:` 等不被 `sanitizeUrl` 接受的协议时，**函数返回 `null`，但 UI 实际仍会显示原始 URL**。
- 显示场景：模板上 `:title="currentUrl"` 与 `{{ currentUrl }}` 都使用了 Vue 的文本插值，Vue 会自动转义 HTML 实体，所以**直接 XSS 风险较低**。
- 但 `resultText` 把 `currentUrl` 拼到 `Site: ${currentUrl.value}` 中并通过剪贴板复制 [Popup.vue:152](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/views/Popup.vue#L152)；用户可能把这段文本贴到任意系统（Wiki/邮件/HTML 邮件签名），而 `javascript:` 链接会被某些平台二次处理。
- 含义上，"安全清洗失败"被回退为"展示原文"——`sanitizeUrl` 的**安全意图被绕过**了。这是典型的"fail-open"反模式。

**严重程度**：中。在某些下游使用场景中可被滥用。

### 风险 G：Demo 模式硬编码 URL 在跨环境中误导

- Demo 模式直接把 `'http://localhost:3000 (Demo Mode)'` 写入 `currentUrl` [Popup.vue:92](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/views/Popup.vue#L92)，包含中文括号说明。
- 这串字符串：
  1. 不再符合任何"真实 URL"语义，但又被复制进剪贴板，下游脚本若按 URL 解析会失败；
  2. 包含括号、空格，若拼到命令行/SQL/正则中需要特别转义，存在**注入风险面**；
  3. 在切换到扩展环境后不会自动消失，因为只在 `onMounted` 里取一次 tab——如果用户在 Demo 模式打开过 popup、然后扩展刚刚授予权限，**不刷新就看不到真实 URL**。

**严重程度**：低。属于体验+下游兼容性风险。

### 风险 H：DEFAULT_CONFIG 与运行时的"快照" vs "实时"语义错配

- `DEFAULT_CONFIG.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone` 在模块加载时求值 [storage.ts:16-20](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L16-L20)。
- 而 `getTodayLocal` 在每次调用时实时求值。
- 在长生命周期的 background page 中（虽然此扩展是 popup，重新打开就重置，问题较轻），若有人扩展该模块到 service worker 长任务里，会出现**两套时区视图不一致**。

**严重程度**：低。当前架构（popup-only）影响有限，但破坏一致性。

### 风险 I：`onConfigChange` 监听器泄漏与重复绑定

- `onConfigChange` 在 `onMounted` 里创建监听器，并在 `onUnmounted`（嵌套在 `onMounted` 里）注销 [Popup.vue:97-107](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/views/Popup.vue#L97-L107)。
- 把 `onUnmounted` 写在 `onMounted` 内部是**反模式**：Vue 要求生命周期钩子在 `setup`/同步上下文内注册。当 `onMounted` 是 `async` 时，`onUnmounted` 的注册时机已经晚于"同步 setup 阶段"，部分场景下会被 Vue 警告"on… is called when there is no active component instance"，导致清理函数**不被注册**——监听器会泄漏。
- 在 `chrome.storage.onChanged` 这种全局事件源上，监听器泄漏会随着 popup 多次打开/关闭累积，触发同一回调多次，进一步加剧 **风险 C** 的回写循环。

**严重程度**：中。是潜伏的内存与一致性 bug。

### 风险 J：`isInputSafe` 黑名单未启用 multiline，且没有覆盖 storage 路径

- `DANGEROUS_PATTERNS` 是 `gi` 标记，但 `pattern.test` 在循环中复用 RegExp 对象时，由于 `g` flag 的 `lastIndex` 副作用，多次调用相同字符串可能出现**误判（漏检）**。这是 JS 老生常谈的坑。
- `loadUserConfig` 从 localStorage 读出后只走 `isValidUserConfig`（仅类型/HH:mm 格式），**没有走 `isInputSafe`** [storage.ts:107-114](file:///d:/charles/program/ai/apps/02.work%20session/session-gsb0618/source%20code/app-00873/app-00873-mercury/frontend-admin/src/utils/storage.ts#L107-L114)。也就是说，若有人写入恶意时间字符串，校验依赖的是格式正则；好在 HH:mm 正则非常窄，目前是安全的，但 `timezone`/`lastUpdated` 等扩展字段无防护。

**严重程度**：低。属于纵深防御层缺失。

---

## 三、关键场景下的组合风险分析

### 场景 1：用户在扩展和普通浏览器之间来回切换
- **直接命中**：A、B、F、G。
- **链式效应**：用户以为配置已同步（A），又在 Tab B 中复制了带 `(Demo Mode)` 字样的脏 URL（G），还可能把 `javascript:` URL 复制到外部（F）。
- **结果**：配置漂移 + 脏数据外溢。

### 场景 2：多标签页同时操作
- **扩展环境**：命中 C、I。`onChanged` 多重触发 + 监听器泄漏，会出现"我刚改的值被同步过来又改回去"。
- **普通浏览器**：命中 B。完全无同步，last-write-wins 静默丢失。
- **结果**：配置不同步、写覆盖、UX 抖动。

### 场景 3：跨时区 / 跨设备 sync
- **直接命中**：D、H。
- **链式效应**：`chrome.storage.sync` 跨设备推送，在 `Asia/Shanghai` 与 `America/New_York` 之间反复同步时，`lastUpdated` 字段虽然存在但不参与决策，可能形成"两台设备互相覆盖"的循环（与 C 共振）。
- **结果**：用户感知到的"今天 08:00"在不同设备含义不同，且无法理解原因。

---

## 四、结论

四套机制各自单独看是合理的工程实践，但**组合在一起**时缺少了"边界协议"，存在以下实质性风险：

1. **配置不一致（中）**：扩展存储与 localStorage 完全孤立，未设迁移/合并策略；跨时区时 `timezone` 字段是元数据而非生效字段。
2. **状态不同步（中-高）**：localStorage 路径完全放弃跨标签页同步；扩展路径存在自身回写、监听器泄漏、缺乏 `lastUpdated` 仲裁。
3. **安全绕过（中）**：`sanitizeUrl` 失败"fail-open"回退到原始 URL；Demo 模式注入伪 URL 字符串到剪贴板/拼接文本中；正则黑名单存在 `g` flag `lastIndex` 误判潜在风险。

整体评估：**当前实现在单一环境/单 Tab/单时区"快乐路径"下是健壮的，但在题目所列的三类切换场景下会暴露上述问题。**这些不是高危漏洞，但属于阻碍扩展走向"多端、多标签、跨时区"成熟形态的关键技术债务。

---

## 五、改进建议（按优先级）

### P0（立即修复）
1. **修正 `sanitizeUrl` 的 fail-open**：`currentUrl.value = sanitized ?? '(unsupported url)';` 而不是 `sanitized || tab.url`。
2. **修正 `onUnmounted` 嵌套在 async `onMounted` 中的反模式**：改为同步 setup 阶段注册，`cleanup` 用 ref 持有：
   ```ts
   let cleanup: (() => void) | null = null;
   onMounted(async () => { /* ... */ cleanup = onConfigChange(...); });
   onUnmounted(() => cleanup?.());
   ```
3. **`isInputSafe` 移除正则的 `g` flag**，或在每次 `test` 前重置 `lastIndex = 0`，避免误判。

### P1（近期改进）
4. **接入 `window.addEventListener('storage', ...)`** 让 localStorage 路径也具备跨 Tab 同步能力。
5. **基于 `lastUpdated` 做仲裁**：`onChanged` 与 `onMounted` 加载时比较时间戳，避免老值覆盖新值；同时忽略自身写入触发的回调（用 `writeId` 标记）。
6. **统一存储抽象**：增加"读不到时回退另一个存储区"的兜底，至少在 dev → ext 切换时给出迁移提示。

### P2（长期演进）
7. **时区策略明确**：决定是"按用户当时输入的字面值"（所见即所存，与时区无关）还是"按保存时区的绝对时刻"（保留 `timezone` 字段并在解析时转换），并在 UI 中向用户说明。
8. **Demo 模式 URL 用合法占位**（如 `https://demo.example/?mode=demo`），避免下游解析失败 + 减小注入面。
9. **加强 `isValidUserConfig`**：校验 `lastUpdated` 必须为 `number`、`timezone` 必须为合法 IANA 时区或来自白名单，关闭未来的原型污染面。
10. **在 popup 重打开时主动 refresh `currentUrl`**，避免 Demo 模式残留。

---

> 文档生成位置：`frontend-admin/ROBUSTNESS_ANALYSIS.md`
