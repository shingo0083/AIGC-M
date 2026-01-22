import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

// 这里原本可能有 './style.css'，我们可以先去掉，或者保留，不影响核心逻辑
// import './style.css' 

const app = createApp(App)

// 注册 Element Plus 组件库
app.use(ElementPlus)

app.mount('#app')