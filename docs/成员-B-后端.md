# 成员 B - 后端开发记录

> 本文档记录后端接口与游戏规则的开发进度、待协作事项及接口变更。

## 负责范围

- Express 接口设计与实现
- 公共数据结构定义
- 四维属性结算
- 14 天推进控制
- A～D 分档逻辑
- 快照校验与重复提交处理

## 已完成

### 接口实现

| 接口 | 路径 | 状态 |
|------|------|------|
| 生成事件 | POST /api/events/generate | 已实现 |
| 选择选项 | POST /api/events/choose | 已实现 |
| 生成结局 | POST /api/endings/generate | 已实现 |

### 核心逻辑

- [x] 快照结构定义（GameSnapshot）
- [x] 属性结算（applyEffects）
- [x] 修订号递增（incrementRevision）
- [x] 四维分档判定（getGrades）
- [x] 快照校验（validateSnapshot）
- [x] 历史记录天数连续性检查
- [x] 属性重算与快照声明比对
- [x] 选项效果范围校验（validateEventEffects）

### 文件结构

server/src/
  index.ts              # Express 入口
  game/
    types.ts            # 类型定义
    constants.ts        # 数值配置
    service.ts          # 核心逻辑
    controller.ts       # 接口实现
  routes/
    index.ts            # 路由注册

### 测试情况

- [x] 服务能正常启动
- [x] POST /api/events/generate 测试通过
- [x] POST /api/events/choose 测试通过
- [ ] POST /api/endings/generate 待测试

## 待协作事项

### 需要成员 C 提供

| 事项 | 说明 | 优先级 |
|------|------|--------|
| generateEvent 实现 | 替换 controller.ts 中的 mockGenerateEvent | 高 |
| generateEnding 实现 | 替换 controller.ts 中的 mockGenerateEnding | 高 |
| 事件选项效果范围确认 | 与 constants.ts 中的 EFFECT_RANGES 对齐 | 高 |
| 分档阈值确认 | 与 constants.ts 中的 GRADE_THRESHOLDS 对齐 | 中 |

### 需要成员 D 配合

| 事项 | 说明 | 优先级 |
|------|------|--------|
| 快照校验规则对齐 | 确认 validateSnapshot 与前端 localStorage 恢复流程一致 | 高 |
| 固定端口确认 | 后端使用 3000，前端联调时需一致 | 中 |

### 需要成员 A 配合

| 事项 | 说明 | 优先级 |
|------|------|--------|
| 接口调用对齐 | 前端调用接口时需携带完整 snapshot | 高 |
| 错误码处理 | 前端需根据 error.code 展示对应提示 | 中 |

## 接口变更记录

| 日期 | 变更内容 | 影响范围 |
|------|----------|----------|
| 2026-09-10 | 初始实现三个核心接口 | 前后端联调 |

## 备注

- 当前 AI 调用为 Mock，待成员 C 替换为真实 DeepSeek 调用
- 后端无状态设计，所有游戏状态由前端 localStorage 维护
- 服务运行在 http://localhost:3000
