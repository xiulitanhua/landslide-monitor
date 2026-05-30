import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'; // 引入插件

export default defineConfig({
  // GitHub Pages 部署基础路径（仓库名），本地开发时注释掉这行
  base: '/landslide-monitor/',
  server: {
    host: '0.0.0.0',  // 监听所有网络接口，允许局域网访问
    port: 5173         // 默认端口
  },
  plugins: [
    vue(),
    cesium({
      cesiumBaseUrl: 'cesium/'
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})