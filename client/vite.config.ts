import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* host: true 是给验收项「至少一台局域网设备完成事件生成与结算」留的：
   队友用手机连同一局域网时，访问的是这台机器的内网 IP，而不是 localhost。
   /api 代理到 Express（端口取 .env.example 的 PORT=3000）。现在 src/api 走的是
   本地假 API，这个代理要等成员 B 的服务起来才会真的被用到。 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
