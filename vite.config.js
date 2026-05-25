import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'; // 引入插件

export default defineConfig({
  // GitHub Pages 部署基础路径（仓库名），本地开发时注释掉这行
  base: '/landslide-monitor/',
  plugins: [
    vue(),
    cesium() // 启用插件，它会自动把 Cesium 的静态文件复制到 public 目录
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})