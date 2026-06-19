import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 启用 dayjs 时区插件（用于跨时区日期处理）
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 格式化时间输入
 * 如果输入是整数（如 "9"），转换为 "09:00"
 * 如果输入是HH:mm格式，验证并返回
 * 否则返回空字符串
 */
export const formatTimeInput = (value: string | number): string => {
  if (!value) return '';

  const strVal = String(value).trim();

  // 检查是否为纯整数（小时）
  if (/^\d+$/.test(strVal)) {
    const num = parseInt(strVal, 10);
    if (num >= 0 && num <= 23) {
      return `${strVal.padStart(2, '0')}:00`;
    }
    return ''; // 无效的小时数
  }

  // 检查是否为HH:mm格式
  const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (timePattern.test(strVal)) {
    const [hours, minutes] = strVal.split(':').map(Number);
    // 确保格式正确（补零）
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // 尝试解析其他格式（如 "9:30" -> "09:30"）
  const loosePattern = /^(\d{1,2}):(\d{1,2})$/;
  const match = strVal.match(loosePattern);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return ''; // 无法解析的格式
};

/**
 * 验证时间范围
 * 检查开始时间是否早于或等于结束时间
 * @param startTime 开始时间字符串 "HH:mm"
 * @param endTime 结束时间字符串 "HH:mm"
 * @returns 验证结果对象 { valid: boolean, message?: string }
 */
export const validateTimeRange = (
  startTime: string,
  endTime: string
): { valid: boolean; message?: string } => {
  // 验证格式
  const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

  if (!timePattern.test(startTime)) {
    return { valid: false, message: '开始时间格式无效' };
  }

  if (!timePattern.test(endTime)) {
    return { valid: false, message: '结束时间格式无效' };
  }

  // 解析时间
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  // 转换为分钟数进行比较
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // 验证范围
  if (startMinutes > endMinutes) {
    return {
      valid: false,
      message: '开始时间不能晚于结束时间'
    };
  }

  // 允许开始时间等于结束时间（表示0时长）
  return { valid: true };
};

/**
 * 获取当前本地时区的今天开始时间
 * 使用本地时区确保日期计算准确，避免时区偏差
 */
const getTodayLocal = (): dayjs.Dayjs => {
  // 获取用户本地时区
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || dayjs.tz.guess();
  // 使用本地时区，确保日期计算基于用户所在时区
  return dayjs().tz(userTimezone).startOf('day');
};

/**
 * 验证日期范围是否合理
 * @param start 开始日期
 * @param end 结束日期
 * @param maxDays 最大允许天数
 */
const validateDateRange = (
  start: dayjs.Dayjs,
  end: dayjs.Dayjs,
  maxDays: number = 365
): boolean => {
  const daysDiff = end.diff(start, 'day');
  return daysDiff >= 0 && daysDiff <= maxDays;
};

/**
 * 获取日期范围
 * @param offsetDays 偏移天数 (0=今天, 1=明天, etc.)
 * @param startTimeStr 开始时间字符串 "HH:mm"
 * @param endTimeStr 结束时间字符串 "HH:mm"
 *
 * 逻辑说明：
 * - 今天 (0): 起始日期=今天, 结束日期=今天
 * - 明天 (1): 起始日期=明天, 结束日期=明天（起始和结束都是明天）
 * - 未来3天 (3): 起始日期=今天, 结束日期=今天+2天（共3天）
 * - 未来一周 (7): 起始日期=今天, 结束日期=今天+6天（共7天）
 * - 未来14天 (14): 起始日期=今天, 结束日期=今天+13天（共14天）
 *
 * 时区处理：
 * - 所有日期计算基于用户本地时区
 * - 使用 dayjs.tz.guess() 自动检测时区
 * - 确保在不同时区下日期计算准确
 *
 * 边界情况处理：
 * - 验证日期范围合理性（不超过365天）
 * - 验证时间格式有效性
 * - 处理跨时区日期边界
 */
export const getDateRange = (
  offsetDays: number,
  startTimeStr: string = '08:00',
  endTimeStr: string = '17:00'
): [Date, Date] => {
  // 参数验证
  if (offsetDays < 0 || offsetDays > 365) {
    throw new Error(`无效的日期偏移量: ${offsetDays}，必须在 0-365 之间`);
  }

  // 获取当前本地时区的今天开始时间
  const today = getTodayLocal();

  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  if (offsetDays === 0) {
    // 今天：起始和结束都是今天
    start = today;
    end = today;
  } else if (offsetDays === 1) {
    // 明天：起始和结束都是明天（必须都是明天，不能是今天）
    const tomorrow = today.add(1, 'day');
    start = tomorrow;
    end = tomorrow;
  } else {
    // 未来N天：从今天开始，到未来N-1天结束（共N天）
    // 边界情况：确保不会超出合理范围
    const maxDays = 365;
    const actualDays = Math.min(offsetDays - 1, maxDays - 1);
    start = today;
    end = today.add(actualDays, 'day');
  }

  // 验证日期范围
  if (!validateDateRange(start, end)) {
    throw new Error(`日期范围无效: 起始日期不能晚于结束日期`);
  }

  // 解析时间字符串
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  // 验证时间有效性
  if (
    isNaN(startH) || isNaN(startM) ||
    startH < 0 || startH > 23 ||
    startM < 0 || startM > 59
  ) {
    throw new Error(`无效的开始时间: ${startTimeStr}`);
  }

  if (
    isNaN(endH) || isNaN(endM) ||
    endH < 0 || endH > 23 ||
    endM < 0 || endM > 59
  ) {
    throw new Error(`无效的结束时间: ${endTimeStr}`);
  }

  // 设置具体时间（使用本地时区）
  const finalStartDate = start
    .hour(startH)
    .minute(startM)
    .second(0)
    .millisecond(0)
    .toDate();

  const finalEndDate = end
    .hour(endH)
    .minute(endM)
    .second(59)
    .millisecond(999)
    .toDate();

  // 最终验证：确保开始时间不晚于结束时间
  if (finalStartDate > finalEndDate) {
    throw new Error('开始时间不能晚于结束时间');
  }

  return [finalStartDate, finalEndDate];
};

export const PRESET_OPTIONS = [
  { label: '今天', value: 0 },
  { label: '明天', value: 1 },
  { label: '未来3天', value: 3 },
  { label: '未来一周', value: 7 },
  { label: '未来14天', value: 14 },
];
