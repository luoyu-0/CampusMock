# 运行与联调说明

> 更新：2026-09-10 · 维护：成员 A / D

当前 React 前端与 Express 游戏接口已经联通，可跑完 14 天并生成结局。服务端暂用模拟生成逻辑，后续由成员 C 将事件与结局生成替换为 DeepSeek 调用。

## 环境要求

- Node.js 20 及以上版本。
- npm 10 及以上版本。
- 所有命令默认在仓库根目录执行。项目使用 npm workspaces，不要分别在 `client/` 和 `server/` 安装依赖。

## 首次安装

```powershell
npm install
Copy-Item .env.example .env
```

`.env` 中常用配置如下：

| 配置 | 默认值 | 作用 |
| --- | --- | --- |
| `PORT` | `3000` | Express 监听端口，也是 Vite 开发代理目标端口 |
| `VITE_API_MODE` | `server` | `server` 请求 Express；`mock` 使用前端假 API |
| `VITE_ENABLE_PROTO_BAR` | `false` | 是否在生产构建中保留开发走查面板 |
| `DEEPSEEK_API_KEY` | 空 | 真实模型密钥，目前模拟生成模式无需填写 |
| `DEEPSEEK_MODEL` | 空 | DeepSeek 模型名，接入模型时填写 |

`.env` 已被 Git 忽略。API 密钥只能由后端读取，不得放入 `VITE_` 变量、前端源码或浏览器存档。

## 前后端开发模式

打开两个终端：

```powershell
# 终端 1
npm run dev:server

# 终端 2
npm run dev:client
```

- 前端：`http://localhost:5173/`
- 后端健康检查：`http://localhost:3000/health`
- API：`http://localhost:3000/api/`

前端使用相对路径 `/api`，Vite 会代理到 `.env` 中 `PORT` 指定的 Express 服务。修改环境变量后应重启相关进程。停止服务时在对应终端按 `Ctrl + C`。

## 前端独立开发模式

将 `.env` 改为：

```dotenv
VITE_API_MODE=mock
```

重启 `npm run dev:client` 后，无需后端即可跑完 14 天。此模式适合页面开发、存档验证和失败注入；重新联调时记得改回 `server`。

## 生产构建与一体化启动

```powershell
npm run build
npm start
```

访问 `http://localhost:3000/`。Express 会同时提供 `client/dist` 和 `/api`。代码更新后需重新执行 `npm run build`；`npm start` 只运行已有构建产物。

可按需单独执行：

```powershell
npm run typecheck -w client
npm run build -w client
npm run build -w server
```

## 局域网演示

1. 运行 `ipconfig`，找到当前网络适配器的 IPv4 地址。
2. 开发模式访问 `http://<本机内网IP>:5173/`；一体化模式访问 `http://<本机内网IP>:3000/`。
3. 演示设备与开发机连接同一局域网。
4. Windows 防火墙提示时允许 Node.js 访问专用网络。

前端始终请求同一来源下的 `/api`，局域网设备不会错误请求自身的 `localhost`。部分校园网开启客户端隔离，设备无法互访时可改用电脑热点。

localStorage 只在同一协议、主机和端口中共享。因此 `localhost:5173`、内网 IP 的 `:5173` 与 `:3000` 各有独立存档，这是浏览器的正常行为。

## 页面走查

开发环境默认显示顶部走查面板；生产构建默认隐藏。确需在生产构建中展示时，将 `VITE_ENABLE_PROTO_BAR=true` 后重新构建。

| 状态 | 正常到达方式 |
| --- | --- |
| 开始页 | 首次访问，或清除本机存档 |
| 待生成事件 | 开始第一天或继续下一天时的短暂等待 |
| 待选择 | 事件生成完成 |
| 展示结果 | 选择一个选项并完成结算 |
| 待生成结局 | 第 14 天结算后 |
| 已结束 | 结局生成完成 |

走查面板可加载合法预设、清除存档并自动跑完整局。可重试和不可重试失败注入仅在 `VITE_API_MODE=mock` 时启用，避免开发工具伪装成服务端真实故障。

## 关键文件

| 内容 | 文件 |
| --- | --- |
| 前端 API 模式与 `fetch` | `client/src/api/gameApi.ts` |
| 前端假 API | `client/src/api/mockApi.ts` |
| 页面状态机与响应接纳 | `client/src/state/useGame.ts` |
| 存档校验与恢复 | `client/src/storage/index.ts` |
| Vite 环境与 API 代理 | `client/vite.config.ts` |
| Express 入口与静态托管 | `server/src/index.ts` |
| API 控制器 | `server/src/game/controller.ts` |
| 快照校验与游戏规则 | `server/src/game/service.ts` |
| 接口类型 | `server/src/game/types.ts` |

## 常见问题

- **页面提示网络错误**：先打开 `/health`，确认 Express 已启动；再检查 `.env` 的 `PORT`，修改后重启 Vite 和 Express。
- **运行 `npm start` 后页面为空或仍是旧版本**：先执行 `npm run build`，再重启服务。
- **刷新后进入第 N 天**：这是 localStorage 恢复。需要重新开始时使用页面中的重新开始或开发走查面板清除存档。
- **顶部提示无法保存**：页面会保留待保存响应且暂停推进。处理浏览器存储限制后点击重试保存，不会重复请求事件或重复结算。
- **多标签页出现冲突提示**：另一标签页已推进存档。重新载入最新存档后再操作。
- **5173 或 3000 被占用**：关闭占用进程；也可修改 `PORT` 调整后端端口，前端开发端口在 `client/vite.config.ts` 中配置。

## 当前验收状态

- [x] 根目录统一安装、构建和一体化启动。
- [x] React 通过 Vite 代理调用 Express。
- [x] Express 提供 API、健康检查与生产静态页面。
- [x] 真实 HTTP 跑通 14 天、14 次结算和结局生成。
- [x] 刷新恢复、防重复结算、过期响应和多标签页冲突处理。
- [ ] DeepSeek 真实事件与结局生成。
- [ ] 在最终演示网络中使用第二台设备完成局域网验收。
