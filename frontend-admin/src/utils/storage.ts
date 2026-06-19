/**
 * Chrome Storage API 封装
 * 提供类型安全的存储操作和持久化功能
 */

import type { UserConfig } from '@/types/chrome';
import { hasStorageAPI } from '@/types/chrome';
import { logger } from '@/utils/logger';

// 存储键名常量
const STORAGE_KEYS = {
  USER_CONFIG: 'userConfig'
} as const;

// 默认配置
const DEFAULT_CONFIG: UserConfig = {
  startTime: '08:00',
  endTime: '17:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
};

/**
 * 验证用户配置数据的完整性和有效性
 * @param config 待验证的配置
 * @returns 是否有效
 */
const isValidUserConfig = (config: unknown): config is UserConfig => {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  // 验证必需字段
  if (typeof cfg.startTime !== 'string' || typeof cfg.endTime !== 'string') {
    return false;
  }

  // 验证时间格式 (HH:mm)
  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timePattern.test(cfg.startTime) || !timePattern.test(cfg.endTime)) {
    return false;
  }

  return true;
};

/**
 * 保存用户配置到 Chrome storage
 * @param config 用户配置
 * @returns Promise<boolean> 是否保存成功
 */
export const saveUserConfig = async (config: UserConfig): Promise<boolean> => {
  // 验证配置有效性
  if (!isValidUserConfig(config)) {
    logger.error('Invalid user config', config);
    return false;
  }

  // 添加时间戳和时区信息
  const configToSave: UserConfig = {
    ...config,
    lastUpdated: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  // 检查是否在 Chrome 扩展环境
  if (!hasStorageAPI()) {
    // 降级到 localStorage
    try {
      localStorage.setItem(STORAGE_KEYS.USER_CONFIG, JSON.stringify(configToSave));
      logger.debug('User config saved to localStorage', configToSave);
      return true;
    } catch (error) {
      logger.error('LocalStorage save error', error);
      return false;
    }
  }

  // 使用 Chrome storage API
  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve(false);
      return;
    }

    chrome.storage.sync.set({ [STORAGE_KEYS.USER_CONFIG]: configToSave }, () => {
      if (chrome?.runtime?.lastError) {
        logger.error('Chrome storage save error', chrome.runtime.lastError.message);
        resolve(false);
      } else {
        logger.debug('User config saved to Chrome storage', configToSave);
        resolve(true);
      }
    });
  });
};

/**
 * 从 Chrome storage 加载用户配置
 * @returns Promise<UserConfig> 用户配置（如果不存在则返回默认配置）
 */
export const loadUserConfig = async (): Promise<UserConfig> => {
  // 检查是否在 Chrome 扩展环境
  if (!hasStorageAPI()) {
    // 降级到 localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidUserConfig(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      logger.error('LocalStorage load error', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  // 使用 Chrome storage API
  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve({ ...DEFAULT_CONFIG });
      return;
    }

    chrome.storage.sync.get([STORAGE_KEYS.USER_CONFIG], (result: Record<string, unknown>) => {
      if (chrome?.runtime?.lastError) {
        logger.error('Chrome storage load error', chrome.runtime.lastError.message);
        resolve({ ...DEFAULT_CONFIG });
        return;
      }

      const config = result[STORAGE_KEYS.USER_CONFIG];
      if (isValidUserConfig(config)) {
        logger.debug('User config loaded from Chrome storage', config);
        resolve(config);
      } else {
        logger.warn('Invalid config loaded, using default', config);
        resolve({ ...DEFAULT_CONFIG });
      }
    });
  });
};

/**
 * 清除用户配置
 * @returns Promise<boolean> 是否清除成功
 */
export const clearUserConfig = async (): Promise<boolean> => {
  if (!hasStorageAPI()) {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_CONFIG);
      logger.debug('User config cleared from localStorage');
      return true;
    } catch (error) {
      logger.error('LocalStorage clear error', error);
      return false;
    }
  }

  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      resolve(false);
      return;
    }

    chrome.storage.sync.remove([STORAGE_KEYS.USER_CONFIG], () => {
      if (chrome?.runtime?.lastError) {
        logger.error('Chrome storage clear error', chrome.runtime.lastError.message);
        resolve(false);
      } else {
        logger.debug('User config cleared from Chrome storage');
        resolve(true);
      }
    });
  });
};

/**
 * 监听存储变化
 * @param callback 变化回调函数
 */
export const onConfigChange = (callback: (newConfig: UserConfig) => void): (() => void) => {
  if (!hasStorageAPI()) {
    // localStorage 不支持跨标签页监听，返回空的清理函数
    return () => {};
  }

  const listener = (
    changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } },
    areaName: string
  ) => {
    if (areaName === 'sync' && changes[STORAGE_KEYS.USER_CONFIG]) {
      const newValue = changes[STORAGE_KEYS.USER_CONFIG].newValue;
      if (isValidUserConfig(newValue)) {
        callback(newValue);
      }
    }
  };

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener(listener);
  }

  // 返回清理函数
  return () => {
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(listener);
    }
  };
};
