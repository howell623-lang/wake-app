# 「醒了吗」技术实现说明

更新时间：2026-03-20
当前版本：Web MVP 技术说明

## 1. 技术栈

当前项目使用：

- HTML
- CSS
- 原生 JavaScript
- Local Storage
- Service Worker
- PWA Manifest

特点：

- 零构建依赖
- 静态托管即可运行
- 不依赖后端

## 2. 系统架构

整体是单页静态前端应用。

### 2.1 模块划分

#### 配置持久化层

负责保存稳定数据：

- 性别
- 体重
- 阈值
- 联系人

#### 酒局会话层

负责保存当天酒局数据：

- 各酒类数量
- 自定义度数
- 自定义容量
- 最后一次操作时间
- 安全状态
- 提醒状态

#### 计算层

负责：

- 纯酒精计算
- 清醒时间计算
- 风险等级判断
- 巡逻状态计算
- 贡献占比计算

#### 调度层

负责：

- 30 分钟预警 timer
- 60 分钟紧急 timer
- 60 秒本地拦截倒计时
- 振动调度

#### 渲染层

负责：

- 初始化界面
- 主界面拼接
- 弹窗渲染
- 实时文案刷新
- 主题色切换

## 3. 本地存储设计

### 3.1 Config Key

`wake-app-config`

结构：

```json
{
  "gender": "male",
  "weight": 78,
  "alcoholThreshold": 50,
  "emergencyContact": "13800138000"
}
```

### 3.2 Session Key

`wake-app-session`

结构示意：

```json
{
  "dateKey": "2026-03-20",
  "startedAt": 1710000000000,
  "lastDrinkTime": 1710003600000,
  "safeMode": false,
  "safeReportSent": true,
  "warningHandled": false,
  "emergencyHandled": false,
  "messageLog": [],
  "drinks": {
    "beer": {
      "count": 2,
      "abv": 5,
      "volumeMl": 500
    }
  }
}
```

## 4. 主要状态说明

### 4.1 配置状态

保存在 `state.config`

### 4.2 会话状态

保存在 `state.session`

关键字段：

- `startedAt`
- `lastDrinkTime`
- `safeMode`
- `safeReportSent`
- `warningHandled`
- `emergencyHandled`
- `messageLog`
- `drinks`

### 4.3 UI 状态

保存在 `state.ui`

包含：

- `modal`
- `prompt`
- `toast`

### 4.4 Timer 状态

保存在 `state.timers`

包含：

- `warningTimeout`
- `emergencyTimeout`
- `promptTick`
- `vibrationTick`
- `clockTick`
- `toastTick`

## 5. 主要函数

### 5.1 启动流程

`bootstrap()`

职责：

- 跨天清理
- 首次渲染
- 启动时钟
- 启动巡逻
- 检查平安报备
- 注册 Service Worker

### 5.2 配置与会话

- `loadConfig()`
- `loadSession()`
- `saveConfig()`
- `saveSession()`
- `createEmptySession()`
- `rolloverSessionIfNeeded()`

### 5.3 页面渲染

- `render()`
- `renderSetup()`
- `renderDashboard()`
- `renderDrinkCard()`
- `renderModal()`
- `renderToast()`

### 5.4 业务计算

- `getMetrics()`
- `getPatrolStatus()`
- `getStatus()`
- `getThemeClass()`
- `renderTrendBars()`

### 5.5 行为操作

- `applyDrinkChange()`
- `maybeTriggerSafeReport()`
- `schedulePatrol()`
- `triggerPrompt()`
- `clearPrompt()`
- `markAlertHandled()`
- `dispatchSafetyMessage()`

## 6. 风险等级算法

基于：

```text
ratio = totalAlcoholGrams / alcoholThreshold
```

分级如下：

- `ratio < 0.5`：`calm`
- `0.5 <= ratio < 1`：`yellow`
- `1 <= ratio < 1.5`：`orange`
- `ratio >= 1.5`：`red`
- `safeMode = true`：`ended`

通过 `getThemeClass()` 映射为页面级主题 class：

- `theme-calm`
- `theme-yellow`
- `theme-orange`
- `theme-red`
- `theme-ended`

## 7. 巡逻调度机制

### 7.1 调度入口

`schedulePatrol()`

逻辑：

1. 清理旧 timer
2. 未配置或已结束则退出
3. 未超阈值则退出
4. 计算距最后操作的时间
5. 达 60 分钟直接触发紧急提醒
6. 达 30 分钟直接触发预警提醒
7. 否则挂载 30 / 60 分钟 timer

### 7.2 拦截弹窗

`triggerPrompt(level)`

行为：

- 创建本地提示状态
- 开启 60 秒倒计时
- 开启振动轮询
- 超时后执行短信兜底动作

### 7.3 重置条件

以下行为会重置巡逻：

- 任意加减酒
- 清空酒局
- 手动结束酒局
- 跨天清局

## 8. 短信处理策略

当前 Web 版采用降级方案：

1. 生成短信文案
2. 复制到剪贴板
3. 尝试打开 `sms:` 链接

这不是真正静默自动发信，受浏览器和系统能力限制。

## 9. 图表与视觉状态

### 9.1 当前趋势图

`renderTrendBars()` 生成的是示意型状态图，不是真实历史曲线。

### 9.2 各酒类贡献占比

在 `getMetrics()` 内计算：

- 每种酒对应的纯酒精克数
- 每种酒占总量的比例

用于：

- 主卡片排行
- 酒类卡片贡献展示

## 10. 事件处理

### 10.1 点击事件

统一通过事件委托：

```text
document.addEventListener("click", ...)
```

支持：

- 打开设置
- 载入 demo
- 关闭弹窗
- 清空会话
- 切换 safe mode
- 加酒
- 减酒
- 取消提醒
- 立即打开短信

### 10.2 表单提交

统一通过：

```text
document.addEventListener("submit", ...)
```

支持：

- 首次设置
- 设置弹窗
- 首次度数确认

## 11. 实时刷新策略

`startClock()` 每秒执行一次：

- 检查是否跨天
- 刷新主界面实时数据
- 刷新提醒倒计时

## 12. PWA 与缓存

### 12.1 manifest

`manifest.webmanifest` 提供：

- 名称
- 主题色
- 图标
- standalone 配置

### 12.2 service worker

`sw.js` 用于缓存 app shell。

当前缓存版本：

- `wake-app-v3`

## 13. 已知技术限制

- 无后台常驻
- 无服务端触达
- 无跨设备同步
- 页面关闭即失去巡逻能力
- `app.js` 当前集中承载较多逻辑，后续可拆分

## 14. 推荐演进方向

### 14.1 Web 继续迭代

建议拆分为：

- `storage.js`
- `session.js`
- `metrics.js`
- `patrol.js`
- `messages.js`
- `render.js`
- `theme.js`

### 14.2 生产化方向

优先建议：

- SwiftUI iOS 原生

其次：

- React Native
- Flutter

原因：

- 需要更可靠的本地提醒
- 需要后台能力
- 需要更强的短信 / 联系人 / 振动集成
- 产品主要使用场景天然适合手机原生能力
