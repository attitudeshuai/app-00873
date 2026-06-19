/**
 * 输入安全验证工具
 * 防止 XSS、注入攻击等安全风险
 */

/**
 * 危险字符模式（用于检测潜在的注入攻击）
 */
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick=, onerror= 等事件处理器
  /data:text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi, // CSS expression
];

/**
 * HTML 实体编码映射
 */
const HTML_ENTITIES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '&': '&amp;',
};

/**
 * 检查字符串是否包含危险内容
 * @param input 待检查的字符串
 * @returns 是否安全
 */
export const isInputSafe = (input: string): boolean => {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // 检查危险模式
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      return false;
    }
  }

  return true;
};

/**
 * 转义 HTML 特殊字符
 * @param input 待转义的字符串
 * @returns 转义后的字符串
 */
export const escapeHtml = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input.replace(/[<>"'/&]/g, (char) => HTML_ENTITIES[char] || char);
};

/**
 * 清理和验证时间输入
 * @param input 时间输入
 * @returns 清理后的时间字符串或 null
 */
export const sanitizeTimeInput = (input: string | number): string | null => {
  if (input === null || input === undefined) {
    return null;
  }

  // 转换为字符串并去除首尾空白
  const str = String(input).trim();

  // 检查是否为空
  if (!str) {
    return null;
  }

  // 检查是否包含危险字符
  if (!isInputSafe(str)) {
    console.warn('Unsafe time input detected:', str);
    return null;
  }

  // 只允许数字、冒号和空格
  if (!/^[\d:\s]+$/.test(str)) {
    return null;
  }

  return str;
};

/**
 * 清理和验证 URL 输入
 * @param url URL 字符串
 * @returns 清理后的 URL 或 null
 */
export const sanitizeUrl = (url: string): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // 检查是否包含危险内容
  if (!isInputSafe(url)) {
    console.warn('Unsafe URL detected:', url);
    return null;
  }

  // 验证 URL 格式
  try {
    const urlObj = new URL(url);
    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }
    return urlObj.toString();
  } catch {
    // 如果不是完整 URL，检查是否是相对路径
    if (/^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(url)) {
      return url;
    }
    return null;
  }
};

/**
 * 清理和验证数字输入
 * @param input 数字输入
 * @param min 最小值
 * @param max 最大值
 * @returns 验证后的数字或 null
 */
export const sanitizeNumber = (
  input: string | number,
  min?: number,
  max?: number
): number | null => {
  if (input === null || input === undefined) {
    return null;
  }

  const num = typeof input === 'number' ? input : Number(input);

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return null;
  }

  if (max !== undefined && num > max) {
    return null;
  }

  return num;
};

/**
 * 清理和验证 JSON 输入
 * @param input JSON 字符串
 * @returns 解析后的对象或 null
 */
export const sanitizeJson = <T = unknown>(input: string): T | null => {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // 检查是否包含危险内容
  if (!isInputSafe(input)) {
    console.warn('Unsafe JSON detected:', input);
    return null;
  }

  try {
    const parsed = JSON.parse(input);
    // 只允许对象和数组
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
};
