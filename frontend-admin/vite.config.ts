import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 清理构建产物目录
    emptyOutDir: true,
    // 代码分割优化 - 简化配置避免循环依赖
    rollupOptions: {
      output: {
        // 资源文件命名规范
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || []
          const ext = info[info.length - 1]
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name || '')) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        // 代码分割 - 避免循环依赖的安全方式
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Element Plus 单独分包
            if (id.includes('element-plus') && !id.includes('icons')) {
              return 'element-plus';
            }
            // Element Plus Icons 单独分包
            if (id.includes('@element-plus/icons-vue')) {
              return 'element-icons';
            }
            // dayjs 单独分包
            if (id.includes('dayjs')) {
              return 'dayjs';
            }
            // Vue 核心库单独分包（不包含在element-plus中，避免循环）
            if (id.includes('vue') && !id.includes('element')) {
              return 'vue-core';
            }
            // 其他第三方库
            return 'vendor';
          }
        }
      }
    },
    // 压缩配置
    minify: 'esbuild',
    // 启用源码映射（开发调试用）
    sourcemap: false,
    // chunk大小警告阈值
    chunkSizeWarningLimit: 1000
  }
})
