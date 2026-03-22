# 醒了吗? / Sober? 技术实现说明

更新时间：2026-03-22
当前版本：**V1.0** — Widmark/TBW 事件流引擎版

---

## 1. 技术栈

- HTML / CSS / 原生 JavaScript（无框架，零构建依赖）
- `localStorage` 持久化
- Service Worker + PWA Manifest
- 静态托管（Vercel）

线上地址：https://wake-app-two.vercel.app
代码仓库：https://github.com/howell623-lang/wake-app

---

## 2. 系统架构

单页静态前端应用，所有状态保存在 `localStorage`，无后端。

### 2.1 模块划分（均在 `app.js`）

| 模块 | 职责 |
|------|------|
| 配置持久化层 | Config 读写（性别 / 体重 / 身高 / 年龄 / 量 / 联系人） |
| 酒局会话层 | Session 读写（drinkEvents / drinks / mealState / 标志位） |
| **算法引擎** | TBW/Widmark 事件流逐分钟模拟 → 三段式 BAC 倒计时 |
| 调度层 | 30/60 分钟守候 timer、60s 拦截倒计时、振动 |
| 渲染层 | 模板字符串拼接 → innerHTML 全量更新，`syncLiveMetrics()` 局部刷新 |

---

## 3. 本地存储设计

### 3.1 Config（`wake-app-config`）

```json
{
  "gender": "male",
  "weight": 78,
  "heightCm": 175,
  "age": 35,
  "alcoholThreshold": 50,
  "emergencyContact": "13800138000"
}
```

- `heightCm`、`age` 为可选字段，缺失时算法降级
- `alcoholThreshold` 前台展示文案为"你的量"

### 3.2 Session（`wake-app-session`）

```json
{
  "dateKey": "2026-03-22",
  "startedAt": 1710000000000,
  "lastDrinkTime": 1710003600000,
  "mealState": "light",
  "safeMode": false,
  "safeReportSent": false,
  "warningHandled": false,
  "emergencyHandled": false,
  "messageLog": [],
  "snapshots": [],
  "drinkEvents": [
    {
      "type": "beer",
      "action": "add",
      "abv": 0.05,
      "volumeMl": 500,
      "timestamp": 1710000000000
    }
  ],
  "drinks": {
    "beer": { "count": 2, "abv": 5, "volumeMl": 500 }
  }
}
```

**新字段（V1 新增）：**
- `mealState`：`"empty"` / `"light"` / `"normalMeal"`
- `drinkEvents[]`：每次 +/- 的完整事件记录，酒精引擎的主要输入

**兼容策略：** 旧 session 缺少 `mealState`/`drinkEvents` 时，`loadSession()` 自动补空数组/默认值，不报错。

---

## 4. 酒精计算引擎

### 4.1 纯酒精克数（每个事件）

```
Gi = volumeMl × abv × 0.789
```

### 4.2 个体分布容积 `Vd`（升）

`computeVd()` 逻辑：

| 条件 | 公式 |
|------|------|
| 男性 + 有身高 + 有年龄 | Watson-TBW: `2.447 - 0.09516×Age + 0.1074×H + 0.3362×W` |
| 男性（无完整信息） | `0.7 × W` |
| 女性 + 有身高 | BMI/Forrest: `Vd = W × (0.7772 - 0.0099×BMI)` |
| 女性（无身高） | `0.6 × W` |
| 其他 | `0.65 × W` |

### 4.3 进食修正参数

`MEAL_PARAMS` 常量：

| mealState | Fmeal（吸收比例） | tauAbsMin（吸收窗口 min） |
|-----------|-----------------|------------------------|
| `empty`      | 1.00 | 45 |
| `light`      | 0.90 | 60 |
| `normalMeal` | 0.80 | 90 |

### 4.4 逐分钟前向模拟（`simulateBAC()`）

```
elimGPerMin = β × 10 × Vd / 60      // β = 0.015 g/dL/h

对每个事件 i（仅 action="add"）：
  inputPerMin_i = (Gi × Fmeal) / tauAbsMin   （在吸收窗口内）

每分钟 t：
  bodyAlcG[t] = max(0, bodyAlcG[t-1] + Σ inputPerMin_i(t) - elimGPerMin)
  BAC[t] = bodyAlcG[t] / (10 × Vd)
```

模拟从最早事件时间戳起始，向后延伸 12 小时（720 min）。

### 4.5 三段式输出阈值

| 前台文案 | 后台阈值 |
|----------|----------|
| 晕得厉害 | `BAC <= 0.08 g/dL` 的剩余时间 `tHigh` |
| 还有点晕 | `BAC <= 0.03 g/dL` 的剩余时间 `tMild` |
| 基本清醒了 | `BAC <= 0.005 g/dL` 的剩余时间 `tClear` |

- 若当前 BAC 已低于阈值，对应倒计时显示 `0分`
- 同时输出 `soberAtTime = now + tClear`（大概几点缓过来）

---

## 5. 主要函数

### 5.1 启动

```
bootstrap()
  rolloverSessionIfNeeded()
  render()
  startClock()       → 每秒 syncLiveMetrics()
  schedulePatrol()
  maybeTriggerSafeReport()
  registerServiceWorker()
```

### 5.2 核心业务

| 函数 | 职责 |
|------|------|
| `computeVd()` | 计算分布容积，按 Watson/Forrest/降级 |
| `simulateBAC()` | 事件流前向模拟，输出三段式时间 |
| `getMetrics()` | 聚合计算层：调用 simulateBAC，拼装 ratio / drinkBreakdown / patrolStatus |
| `applyDrinkChange(drinkId, delta)` | 更新 drinks count + 写入 drinkEvents + 触发守候/报备 |
| `schedulePatrol()` | 超阈值后挂载 30/60 min timer |
| `triggerPrompt(level)` | 展示拦截弹窗 + 60s 倒计时 + 振动 |
| `dispatchSafetyMessage(level)` | 写 messageLog + 复制文案 + 尝试唤起 sms: |

### 5.3 渲染

| 函数 | 产出 |
|------|------|
| `renderSetup()` | 首配页：性别/体重/身高/年龄/你的量/联系人 |
| `renderDashboard()` | 主界面单列流：喝了多少→还要多久→上头程度→安全守候→最近提醒→本机档案→免责 |
| `renderCountdownStages(metrics)` | 三段式倒计时 HTML |
| `renderModal()` | 支持：session-start / settings / abv / clear-confirm / prompt |
| `syncLiveMetrics()` | 局部 DOM 更新（`data-bind` 属性），避免每秒全量 render |

### 5.4 表单处理

| form.id | 触发时机 |
|---------|---------|
| `setup-form` | 首次配置提交 |
| `session-start-form` | 首次点 + 时弹出，收集 mealState + startTime |
| `settings-form` | 设置弹窗保存 |
| `abv-form` | 首次添加某酒类时确认度数/容量 |

---

## 6. 风险等级与主题

```
ratio = totalAlcoholGrams / alcoholThreshold
```

| ratio | 状态 | 主题 class |
|-------|------|------------|
| < 0.5 | 清醒 | `theme-calm` |
| 0.5 – 1.0 | 微醺 | `theme-yellow` |
| 1.0 – 1.5 | 上头了 | `theme-orange` |
| ≥ 1.5 | 高危 | `theme-red` |
| safeMode | 已结束 | `theme-ended` |

主题通过 `.market-shell` 的 class 控制，CSS 变量 `--accent` 等随 class 切换。

---

## 7. 守候（Safety Patrol）调度

### 触发条件

`totalAlcoholGrams >= alcoholThreshold`（超过"你的量"）

### 两级提醒

| 级别 | 无操作时长 | 提示文案 |
|------|----------|----------|
| `warning` | 30 分钟 | 还没散，我没事儿，报个平安 |
| `emergency` | 60 分钟 | 我喝断片儿了，请速来接我 |

### 重置

任意 +/- 操作调用 `applyDrinkChange()` → 自动重置 handled 标志 + 重新 `schedulePatrol()`

### 平安报备（safe）

首次达到阈值 50% 时自动触发一次：`应酬开局了`

---

## 8. 短信处理策略

Web 降级方案（无法静默自动发信）：

1. 生成文案 → 复制到剪贴板
2. 尝试打开 `sms:{phone}?body={encoded}` (Android) / `sms:{phone}&body={encoded}` (iOS)

---

## 9. 文案快速对照表

| 旧版（MVP） | V1 |
|------------|-----|
| 饮酒市场 | 喝了多少 |
| 今晚还要多久 | 还要多久 |
| 醉酒度 | 上头程度 |
| 巡逻状态 | 安全守候 |
| 个人酒量阈值 | 你的量 |
| 预计清醒时刻 | 大概几点缓过来 |
| 平安报备 | 应酬开局了 |
| 饮酒预警 | 还没散，我没事儿，报个平安 |
| 紧急提醒 | 我喝断片儿了，请速来接我 |

---

## 10. PWA

- `manifest.webmanifest`：name `醒了吗?`，standalone，主题色 `#eef3fb`
- `sw.js`：缓存版本 `wake-app-v3`，缓存 app shell 静态资源

---

## 11. 已知技术限制

- 无后台常驻（页面关闭即失去守候能力）
- 无法真正静默自动发短信
- 无跨设备同步
- `app.js` 单文件，后续可按模块拆分

---

## 12. 推荐演进方向

### 12.1 Web 继续迭代（如交给 Codex）

建议拆分模块：

```
app/
  storage.js      // loadConfig / saveConfig / loadSession / saveSession
  session.js      // createEmptySession / applyDrinkChange
  engine.js       // computeVd / simulateBAC / getMetrics
  patrol.js       // schedulePatrol / triggerPrompt / dispatchSafetyMessage
  render.js       // renderDashboard / renderSetup / renderModal
  theme.js        // getStatus / getThemeClass / syncLiveMetrics
  utils.js        // formatters / clamp / date helpers
  main.js         // bootstrap
```

### 12.2 原生 App（长期方向）

- **优先：SwiftUI iOS**（需要本地通知、后台任务、联系人/短信集成）
- 其次：React Native / Flutter

---

## 13. Codex 接手要点

1. **算法入口**：`simulateBAC()` 是核心，可独立单元测试
2. **新酒类**：在 `DRINKS` 常量新增字段即可，事件流自动支持
3. **调整阈值**：修改 `METABOLISM` 常量（beta / T_high / T_mild / T_clear）
4. **进食修正**：修改 `MEAL_PARAMS` 常量
5. **添加字段**：Config/Session 数据结构有兼容降级逻辑，新增字段需同步更新 `loadConfig()` / `loadSession()`
6. **渲染**：全量 `render()` 为主，热路径用 `syncLiveMetrics()` 局部更新避免抖动
