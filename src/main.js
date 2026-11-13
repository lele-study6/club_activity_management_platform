import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as Icons from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import pinia from './stores'
import '@/styles/global.scss' // 由 UI 组维护

const app = createApp(App)
Object.entries(Icons).forEach(([k, v]) => app.component(k, v))
app.use(pinia).use(router).use(ElementPlus)
app.mount('#app')