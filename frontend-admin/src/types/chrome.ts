/**
 * Chrome Extension API 类型定义
 * 提供 Chrome API 的类型安全支持
 */

// ==================== 全局类型声明 ====================
// 这些类型在全局作用域中可用，不需要导入

/**
 * Chrome Tabs API 类型定义
 */
interface ChromeTabs {
  query(
    queryInfo: { active?: boolean; currentWindow?: boolean },
    callback: (result: ChromeTab[]) => void
  ): void;
}

/**
 * Chrome Storage API 类型定义
 */
interface ChromeStorage {
  sync: {
    get(keys: string[], callback: (result: Record<string, unknown>) => void): void;
    set(items: Record<string, unknown>, callback?: () => void): void;
    remove(keys: string[], callback?: () => void): void;
  };
  onChanged: {
    addListener(
      callback: (
        changes: { [key: string]: ChromeStorageChange },
        areaName: string
      ) => void
    ): void;
    removeListener(
      callback: (
        changes: { [key: string]: ChromeStorageChange },
        areaName: string
      ) => void
    ): void;
  };
}

/**
 * Chrome Storage Change 类型定义
 */
interface ChromeStorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Chrome Runtime API 类型定义
 */
interface ChromeRuntime {
  lastError?: {
    message?: string;
  };
}

/**
 * Chrome API 全局对象类型
 */
interface ChromeAPI {
  tabs?: ChromeTabs;
  storage?: ChromeStorage;
  runtime?: ChromeRuntime;
}

// 全局声明 chrome 变量
declare global {
  // 在全局作用域中声明 chrome 变量
  const chrome: ChromeAPI | undefined;

  // 扩展 Window 接口
  interface Window {
    chrome?: ChromeAPI;
  }
}

// ==================== 导出类型和函数 ====================
// 这些可以通过 import 导入使用

/**
 * Chrome 标签页信息
 */
export interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
  active: boolean;
  windowId: number;
}

/**
 * 用户配置数据结构
 */
export interface UserConfig {
  startTime: string;
  endTime: string;
  lastUpdated?: number;
  timezone?: string;
}

/**
 * Storage 存储结果
 */
export interface StorageResult {
  userConfig?: UserConfig;
}

/**
 * 检查是否在 Chrome 扩展环境中运行
 */
export const isChromeExtension = (): boolean => {
  return typeof chrome !== 'undefined' &&
         typeof chrome.tabs !== 'undefined' &&
         typeof chrome.storage !== 'undefined';
};

/**
 * 检查是否有 tabs API 可用
 */
export const hasTabsAPI = (): boolean => {
  return typeof chrome !== 'undefined' && typeof chrome.tabs !== 'undefined';
};

/**
 * 检查是否有 storage API 可用
 */
export const hasStorageAPI = (): boolean => {
  return typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined';
};

/**
 * 安全获取当前活动标签页
 * @returns Promise<ChromeTab | null>
 */
export const getCurrentTab = (): Promise<ChromeTab | null> => {
  return new Promise((resolve) => {
    if (!hasTabsAPI() || !chrome?.tabs) {
      resolve(null);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: ChromeTab[]) => {
      if (chrome?.runtime?.lastError) {
        console.error('Chrome tabs query error:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }

      if (tabs.length > 0 && tabs[0]) {
        resolve({
          id: tabs[0].id,
          url: tabs[0].url,
          title: tabs[0].title,
          active: tabs[0].active,
          windowId: tabs[0].windowId
        });
      } else {
        resolve(null);
      }
    });
  });
};

// 确保这是一个模块（通过导出空对象）
export {};
