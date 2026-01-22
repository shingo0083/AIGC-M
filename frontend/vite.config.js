import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 【新增】配置打包输出目录
  build: {
    outDir: '../public', // 将打包后的文件输出到根目录的 public 文件夹，方便 Vercel 托管
    emptyOutDir: true
  }
})