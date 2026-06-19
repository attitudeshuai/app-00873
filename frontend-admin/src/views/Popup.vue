<template>
  <div class="popup-container">
    <!-- Header with gradient -->
    <div class="popup-header">
      <div class="header-icon">
        <el-icon :size="20"><Timer /></el-icon>
      </div>
      <div class="header-title">智能时间配置</div>
    </div>

    <!-- URL Card with icon -->
    <div class="url-card">
      <div class="url-header">
        <el-icon class="url-icon"><Link /></el-icon>
        <span class="url-label">当前访问</span>
      </div>
      <div class="url-value" :title="currentUrl">
        <span class="url-text">{{ currentUrl || '获取中...' }}</span>
        <el-icon v-if="currentUrl" class="url-status-icon"><Check /></el-icon>
      </div>
    </div>

    <!-- Config Card -->
    <div class="config-card">
      <SmartTimeConfig
        v-model:start-time="configStartTime"
        v-model:end-time="configEndTime"
        @apply="handleApply"
      />
    </div>

    <!-- Result Card with animation -->
    <transition name="slide-fade">
      <div class="result-card" v-if="resultText">
        <div class="result-header">
          <div class="result-title">
            <el-icon class="result-icon"><DocumentChecked /></el-icon>
            <span>配置预览</span>
          </div>
          <el-button link type="primary" size="small" @click="copyResult" class="copy-btn">
            <el-icon><DocumentCopy /></el-icon>
            复制
          </el-button>
        </div>
        <div class="result-content">
          {{ resultText }}
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Timer, Link, Check, DocumentChecked, DocumentCopy } from '@element-plus/icons-vue';
import SmartTimeConfig from '@/components/SmartTimeConfig.vue';
import { getDateRange, validateTimeRange } from '@/utils/timeHelper';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import { sanitizeUrl } from '@/utils/inputSecurity';
import { loadUserConfig, saveUserConfig, onConfigChange } from '@/utils/storage';
import { getCurrentTab } from '@/types/chrome';
import { logger } from '@/utils/logger';

const currentUrl = ref('');
const configStartTime = ref('08:00');
const configEndTime = ref('17:00');
const resultText = ref('');

// 加载保存的配置
onMounted(async () => {
  logger.debug('Popup component mounted');

  try {
    // 加载保存的配置
    const savedConfig = await loadUserConfig();
    if (savedConfig) {
      configStartTime.value = savedConfig.startTime || '08:00';
      configEndTime.value = savedConfig.endTime || '17:00';
      logger.info('Loaded saved config', savedConfig);
    } else {
      logger.debug('No saved config found, using defaults');
    }

    // 获取当前标签页 URL
    const tab = await getCurrentTab();
    if (tab && tab.url) {
      const sanitized = sanitizeUrl(tab.url);
      currentUrl.value = sanitized || tab.url;
      logger.debug('Current tab URL loaded', { url: currentUrl.value });
    } else {
      currentUrl.value = 'http://localhost:3000 (Demo Mode)';
      logger.warn('No active tab found, using demo mode');
    }

    // 监听配置变化（跨标签页同步）
    const cleanup = onConfigChange((newConfig) => {
      logger.info('Config changed from another tab', newConfig);
      configStartTime.value = newConfig.startTime;
      configEndTime.value = newConfig.endTime;
    });

    // 组件卸载时清理监听器
    onUnmounted(() => {
      cleanup();
      logger.debug('Popup component unmounted');
    });
  } catch (error) {
    logger.error('Error during popup initialization', error);
  }
});

const handleApply = async (days: number) => {
  logger.debug('Applying time config', { days, startTime: configStartTime.value, endTime: configEndTime.value });

  try {
    // 验证时间范围
    const timeValidation = validateTimeRange(configStartTime.value, configEndTime.value);
    if (!timeValidation.valid) {
      logger.warn('Time range validation failed', timeValidation);
      ElMessage.error({
        message: timeValidation.message || '时间范围无效',
        duration: 3000
      });
      return;
    }

    // 生成日期范围
    const [start, end] = getDateRange(days, configStartTime.value, configEndTime.value);
    logger.debug('Date range generated', { start, end });

    // 使用本地时区格式化，确保显示正确
    const startStr = dayjs(start).format('YYYY-MM-DD HH:mm:ss');
    const endStr = dayjs(end).format('YYYY-MM-DD HH:mm:ss');

    // 验证日期范围合理性
    const daysDiff = dayjs(end).diff(dayjs(start), 'day');
    if (daysDiff < 0) {
      throw new Error('日期范围无效：结束日期不能早于开始日期');
    }

    // 保存配置到 Chrome storage
    const saveSuccess = await saveUserConfig({
      startTime: configStartTime.value,
      endTime: configEndTime.value
    });

    if (!saveSuccess) {
      logger.warn('Failed to save user config');
    }

    resultText.value = `Site: ${currentUrl.value}\nStart: ${startStr}\nEnd: ${endStr}`;
    logger.info('Time config applied successfully', { startStr, endStr });

    ElMessage.success('时间配置已生成');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '日期配置生成失败';
    logger.error('Error applying time config', error);
    ElMessage.error({
      message: errorMessage,
      duration: 3000
    });
  }
};

const copyResult = async () => {
  logger.debug('Copying result to clipboard');

  try {
    await navigator.clipboard.writeText(resultText.value);
    logger.info('Result copied to clipboard successfully');
    ElMessage.success({
      message: '已复制到剪贴板',
      duration: 2000,
      showClose: false
    });
  } catch (error) {
    logger.warn('Clipboard API failed, using fallback', error);
    ElMessage.error({
      message: '复制失败，请手动复制',
      duration: 3000
    });
    // 降级方案：选中文本
    const textArea = document.createElement('textarea');
    textArea.value = resultText.value;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      logger.info('Result copied using fallback method');
      ElMessage.success('已通过降级方案复制');
    } catch (e) {
      logger.error('Fallback copy method failed', e);
      ElMessage.error('复制功能不可用');
    }
    document.body.removeChild(textArea);
  }
};
</script>

<style scoped>
.popup-container {
  width: 100%;
  min-height: 400px;
  background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
  position: relative;
  overflow: hidden;
}

/* 顶部装饰性背景 */
.popup-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(135deg, #409EFF 0%, #66b1ff 100%);
  opacity: 0.05;
  z-index: 0;
}

/* Header with gradient */
.popup-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) var(--spacing-md) var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.header-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409EFF 0%, #66b1ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.header-title {
  font-size: var(--font-size-h4);
  line-height: var(--line-height-h4);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  background: linear-gradient(135deg, #409EFF 0%, #66b1ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* URL卡片 - 美化样式 */
.url-card {
  position: relative;
  z-index: 1;
  background: var(--color-bg-card);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--color-border-lighter);
  margin: 0 var(--spacing-md) var(--spacing-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: var(--transition-base);
  overflow: hidden;
}

.url-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, #409EFF 0%, #66b1ff 100%);
}

.url-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.url-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.url-icon {
  color: var(--color-primary);
  font-size: 14px;
}

.url-label {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.url-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.url-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.url-status-icon {
  color: var(--color-success);
  font-size: 16px;
  flex-shrink: 0;
}

/* 配置卡片 - 主要功能区域 */
.config-card {
  position: relative;
  z-index: 1;
  background: var(--color-bg-card);
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--color-border-lighter);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  margin: 0 var(--spacing-md) var(--spacing-md);
  transition: var(--transition-base);
}

.config-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* 结果卡片 - 成功状态区域，带动画 */
.result-card {
  position: relative;
  z-index: 1;
  margin: 0 var(--spacing-md) var(--spacing-md);
  background: linear-gradient(135deg, #f0f9eb 0%, #ffffff 100%);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  border: 1px solid var(--color-success);
  box-shadow: 0 2px 8px rgba(103, 194, 58, 0.15);
  transition: var(--transition-base);
  overflow: hidden;
}

.result-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, #67c23a 0%, #85ce61 100%);
}

.result-card:hover {
  box-shadow: 0 4px 16px rgba(103, 194, 58, 0.25);
  transform: translateY(-2px);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.result-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-success);
  font-weight: var(--font-weight-bold);
}

.result-icon {
  font-size: 16px;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  transition: var(--transition-fast);
}

.copy-btn:hover {
  transform: scale(1.05);
}

.result-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-text-regular);
  white-space: pre-wrap;
  word-break: break-all;
  background: rgba(255, 255, 255, 0.6);
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-base);
  border: 1px solid rgba(103, 194, 58, 0.2);
}

/* 动画效果 */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
