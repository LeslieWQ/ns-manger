const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  publicPath: '/lesliens/',
  devServer: {
    port: 8081,
    proxy: {
      '/lesliens/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        pathRewrite: { '^/lesliens/api': '/api' }
      }
    }
  }
})
