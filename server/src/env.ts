import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

// src 与 dist 位于同一层级，不依赖启动命令的工作目录。
// 优先根目录配置；兼容仅存在 server/.env 的旧配置，保留外部注入的变量。
const rootEnv = path.resolve(__dirname, '../../.env');
const serverEnv = path.resolve(__dirname, '../.env');
config({ path: existsSync(rootEnv) ? rootEnv : serverEnv, quiet: true });
