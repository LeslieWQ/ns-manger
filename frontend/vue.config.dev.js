// 本地开发配置 - API 转发到服务器
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  publicPath: '/',
  devServer: {
    port: 8081,
    proxy: {
      '/api': {
        target: 'http://150.158.147.230:8080',
        changeOrigin: true
      }
    }
  }
})
