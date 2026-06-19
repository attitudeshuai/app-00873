import { createApp } from 'vue'
import App from './App.vue'

// 先导入样式，确保CSS变量在组件之前加载
import './styles/variables.css'
import './styles/base.css'
import 'element-plus/dist/index.css'

// 然后导入Element Plus
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)

app.use(ElementPlus)

// Register all icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
