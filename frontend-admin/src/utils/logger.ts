/**
 * 日志系统
 * 区分开发环境和生产环境的日志级别
 * 便于问题定位和调试
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * 日志配置接口
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageSize: number;
}

/**
 * 日志条目接口
 */
interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  data?: unknown;
  stack?: string;
}

/**
 * 判断是否为开发环境
 */
const isDevelopment = (): boolean => {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
};

/**
 * 获取默认日志配置
 */
const getDefaultConfig = (): LoggerConfig => {
  const isDev = isDevelopment();
  return {
    level: isDev ? LogLevel.DEBUG : LogLevel.WARN,
    enableConsole: true,
    enableStorage: isDev,
    maxStorageSize: 100 // 最多保存100条日志
  };
};

/**
 * 日志类
 */
class Logger {
  private config: LoggerConfig;
  private storage: LogEntry[] = [];

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...getDefaultConfig(), ...config };
    this.loadFromStorage();
  }

  /**
   * 从 localStorage 加载日志
   */
  private loadFromStorage(): void {
    if (!this.config.enableStorage) {
      return;
    }

    try {
      const stored = localStorage.getItem('app_logs');
      if (stored) {
        this.storage = JSON.parse(stored);
        // 限制存储大小
        if (this.storage.length > this.config.maxStorageSize) {
          this.storage = this.storage.slice(-this.config.maxStorageSize);
        }
      }
    } catch (error) {
      console.error('Failed to load logs from storage:', error);
    }
  }

  /**
   * 保存日志到 localStorage
   */
  private saveToStorage(entry: LogEntry): void {
    if (!this.config.enableStorage) {
      return;
    }

    try {
      this.storage.push(entry);
      // 限制存储大小
      if (this.storage.length > this.config.maxStorageSize) {
        this.storage = this.storage.slice(-this.config.maxStorageSize);
      }
      localStorage.setItem('app_logs', JSON.stringify(this.storage));
    } catch (error) {
      // 存储失败时静默处理，避免无限循环
      console.error('Failed to save log to storage:', error);
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return `${prefix} ${message}`;
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, levelName: string, message: string, data?: unknown): void {
    // 检查日志级别
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level: levelName,
      message,
      data
    };

    // 如果是错误级别，捕获堆栈信息
    if (level === LogLevel.ERROR && data instanceof Error) {
      entry.stack = data.stack;
    }

    // 输出到控制台
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(levelName, message);
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage, data || '');
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, data || '');
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, data || '');
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, data || '');
          if (data instanceof Error && data.stack) {
            console.error('Stack:', data.stack);
          }
          break;
      }
    }

    // 保存到存储
    this.saveToStorage(entry);
  }

  /**
   * Debug 级别日志
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  /**
   * Info 级别日志
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  /**
   * Warn 级别日志
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  /**
   * Error 级别日志
   */
  error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, 'ERROR', message, error);
  }

  /**
   * 获取所有存储的日志
   */
  getLogs(): LogEntry[] {
    return [...this.storage];
  }

  /**
   * 清除所有日志
   */
  clearLogs(): void {
    this.storage = [];
    if (this.config.enableStorage) {
      try {
        localStorage.removeItem('app_logs');
      } catch (error) {
        console.error('Failed to clear logs from storage:', error);
      }
    }
  }

  /**
   * 导出日志为 JSON 字符串
   */
  exportLogs(): string {
    return JSON.stringify(this.storage, null, 2);
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.config.level;
  }
}

// 创建默认日志实例
export const logger = new Logger();

// 导出日志类供自定义使用
export { Logger };
