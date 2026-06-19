<template>
  <div class="smart-config-panel">
    <div class="panel-header">
      <div class="header-content">
        <h4>智能时间配置</h4>
        <span class="sub-text">自定义默认工作时间与日期范围</span>
      </div>
    </div>

    <div class="config-section">
      <label class="section-label">工作时间设置</label>
      <div class="time-inputs">
        <div class="input-group">
          <span class="prefix">始</span>
          <el-input
            v-model="tempStartTime"
            placeholder="08:00"
            @blur="handleTimeBlur('start')"
            size="default"
          >
            <template #suffix>
              <el-icon><Clock /></el-icon>
            </template>
          </el-input>
        </div>
        <span class="separator">至</span>
        <div class="input-group">
          <span class="prefix">终</span>
          <el-input
            v-model="tempEndTime"
            placeholder="17:00"
            @blur="handleTimeBlur('end')"
            size="default"
          >
            <template #suffix>
              <el-icon><Clock /></el-icon>
            </template>
          </el-input>
        </div>
      </div>
      <p class="hint">提示：输入整数（如 9）可快速转换为 09:00</p>
    </div>

    <div class="config-section">
      <label class="section-label">快速预设应用</label>
      <div class="preset-grid">
        <button
          v-for="opt in presets"
          :key="opt.value"
          class="preset-btn"
          @click="applyPreset(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Clock } from '@element-plus/icons-vue';
import { formatTimeInput, PRESET_OPTIONS, validateTimeRange } from '@/utils/timeHelper';
import { ElMessage } from 'element-plus';
import { sanitizeTimeInput, isInputSafe } from '@/utils/inputSecurity';
import { logger } from '@/utils/logger';

const props = defineProps<{
  startTime: string;
  endTime: string;
}>();

const emit = defineEmits<{
  (e: 'update:startTime', val: string): void;
  (e: 'update:endTime', val: string): void;
  (e: 'apply', days: number): void;
}>();

const tempStartTime = ref(props.startTime);
const tempEndTime = ref(props.endTime);
const presets = PRESET_OPTIONS;

// Keep local state in sync if props change from outside
watch(() => props.startTime, (val) => tempStartTime.value = val);
watch(() => props.endTime, (val) => tempEndTime.value = val);

const handleTimeBlur = (type: 'start' | 'end') => {
  try {
    // 输入安全检查
    const inputValue = type === 'start' ? tempStartTime.value : tempEndTime.value;

    // 检查是否包含危险内容
    if (!isInputSafe(inputValue)) {
      logger.warn('Unsafe input detected', { type, inputValue });
      ElMessage.error({
        message: '输入包含不安全的内容',
        duration: 2000
      });
      if (type === 'start') {
        tempStartTime.value = '08:00';
      } else {
        tempEndTime.value = '17:00';
      }
      return;
    }

    // 清理和验证输入
    const sanitized = sanitizeTimeInput(inputValue);
    if (!sanitized) {
      logger.warn('Invalid time input', { type, inputValue });
      ElMessage.warning({
        message: `${type === 'start' ? '开始' : '结束'}时间输入无效`,
        duration: 2000
      });
      if (type === 'start') {
        tempStartTime.value = '08:00';
      } else {
        tempEndTime.value = '17:00';
      }
      return;
    }

    // 格式化时间
    const formatted = formatTimeInput(sanitized);
    if (!formatted || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formatted)) {
      ElMessage.warning({
        message: `${type === 'start' ? '开始' : '结束'}时间格式不正确，已重置为默认值`,
        duration: 2000
      });
      if (type === 'start') {
        tempStartTime.value = '08:00';
      } else {
        tempEndTime.value = '17:00';
      }
    } else {
      if (type === 'start') {
        tempStartTime.value = formatted;
      } else {
        tempEndTime.value = formatted;
      }
    }

    // 验证时间范围
    const timeValidation = validateTimeRange(tempStartTime.value, tempEndTime.value);
    if (!timeValidation.valid) {
      logger.warn('Time range validation failed', {
        startTime: tempStartTime.value,
        endTime: tempEndTime.value,
        message: timeValidation.message
      });
      ElMessage.warning({
        message: timeValidation.message || '开始时间不能晚于结束时间',
        duration: 2000
      });
      // 如果验证失败，重置为默认值
      if (type === 'start') {
        tempStartTime.value = '08:00';
      } else {
        tempEndTime.value = '17:00';
      }
    } else {
      logger.debug('Time range validated successfully', {
        startTime: tempStartTime.value,
        endTime: tempEndTime.value
      });
    }

    // 发送更新事件
    if (type === 'start') {
      emit('update:startTime', tempStartTime.value);
    } else {
      emit('update:endTime', tempEndTime.value);
    }
  } catch (error) {
    logger.error('Time blur error', error);
    ElMessage.error('时间格式处理出错');
  }
};

const applyPreset = (days: number) => {
  logger.debug('Applying preset', { days, startTime: tempStartTime.value, endTime: tempEndTime.value });

  // Validate times before applying
  if (!tempStartTime.value || !tempEndTime.value) {
    logger.warn('Missing time values', { startTime: tempStartTime.value, endTime: tempEndTime.value });
    ElMessage.warning('请先设置有效的工作时间范围');
    return;
  }

  // 验证时间范围
  const timeValidation = validateTimeRange(tempStartTime.value, tempEndTime.value);
  if (!timeValidation.valid) {
    logger.warn('Time range validation failed in preset', timeValidation);
    ElMessage.error({
      message: timeValidation.message || '开始时间不能晚于结束时间',
      duration: 3000
    });
    return;
  }

  logger.info('Preset applied successfully', { days });
  emit('apply', days);
  // 提示消息由父组件统一处理，避免重复提示
};
</script>

<style scoped>
.smart-config-panel {
  padding: var(--spacing-md);
  min-width: 280px;
}

/* 面板头部 - 清晰的层级分隔 */
.panel-header {
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  position: relative;
}

.panel-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--color-border-lighter) 20%, var(--color-border-lighter) 80%, transparent 100%);
}

.header-content {
  padding: 0 var(--spacing-xs);
}

.panel-header h4 {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-h4);
  line-height: var(--line-height-h4);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  background: linear-gradient(135deg, #303133 0%, #606266 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sub-text {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-text-secondary);
  display: block;
}

/* 配置区块 - 统一间距 */
.config-section {
  margin-bottom: var(--spacing-lg);
}

.config-section:last-child {
  margin-bottom: 0;
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-regular);
  margin-bottom: var(--spacing-sm);
  padding-left: var(--spacing-xs);
  position: relative;
}

.section-label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 14px;
  background: linear-gradient(180deg, #409EFF 0%, #66b1ff 100%);
  border-radius: 1px;
}

/* 时间输入区域 - Flex布局 */
.time-inputs {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.input-group {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.input-group .prefix {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-primary);
  margin-right: var(--spacing-xs);
  white-space: nowrap;
  font-weight: var(--font-weight-bold);
  padding: 2px 6px;
  background: var(--color-primary-light-9);
  border-radius: var(--border-radius-base);
}

.separator {
  color: var(--color-primary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  padding: 0 var(--spacing-xs);
  font-weight: var(--font-weight-bold);
  opacity: 0.6;
}

.hint {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-info);
  margin-top: var(--spacing-sm);
  margin-bottom: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(64, 158, 255, 0.05);
  border-radius: var(--border-radius-base);
  border-left: 2px solid var(--color-primary-light-5);
}

/* 预设按钮网格 - 统一间距 */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

/* 预设按钮 - 完整的交互反馈 */
.preset-btn {
  background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
  border: 1.5px solid var(--color-border-lighter);
  color: var(--color-text-regular);
  padding: var(--spacing-sm) var(--spacing-xs);
  border-radius: var(--border-radius-base);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  cursor: pointer;
  transition: var(--transition-base);
  font-weight: var(--font-weight-medium);
  position: relative;
  overflow: hidden;
}

.preset-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(64, 158, 255, 0.1), transparent);
  transition: left 0.5s;
}

.preset-btn:hover::before {
  left: 100%;
}

.preset-btn:hover {
  background: linear-gradient(135deg, var(--color-primary-light-9) 0%, #ffffff 100%);
  color: var(--color-primary);
  border-color: var(--color-primary-light-5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

.preset-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.15);
}

</style>
