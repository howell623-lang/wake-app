# 「醒了吗?」项目交接文档

更新时间：2026-03-30  
当前仓库状态：Web 验证版 + iOS 原生主线并行

## 1. 一句话概述

「醒了吗?」已经不是最早那版纯 Web 小工具了。当前仓库有两条线：

- Web 版：负责算法、文案、交互验证
- iOS 版：负责原生通知、支付能力、历史记录与正式产品化

当前长期方向明确偏向 iOS。

## 2. 版本演进

### 2.1 关键里程碑

- 2026-03-20：Web MVP 建立
- 2026-03-22：Web 升级到 Widmark / TBW 事件流 V1
- 2026-03-22：引入 Pro / 支付口径、守候 gating、PWA 调整
- 2026-03-22：落地 iOS 原生工程脚手架
- 2026-03-30：仓库进入“Web 验证壳 + iOS 主线”的双线阶段

### 2.2 当前 git 认知

`main` 最近公开提交已经包含：

- Web V1 算法升级
- 守候与 Pro 结构
- iOS 原生脚手架

当前工作树还存在一批**未提交 iOS 变更**，主要集中在：

- 历史记录页
- 设置页
- 本地化补充
- 升级页增强
- Mac Catalyst 构建支持

交接时必须注意：不要误把这些未提交改动当成“还没开发”。它们已经在本地文件里，只是还没形成新的 commit。

## 3. 当前文件结构

```text
/Users/howell623/Projects/醒了吗?
├── Web 入口与文档
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── sw.js
│   ├── manifest.webmanifest
│   ├── README.md
│   ├── PROJECT_HANDOFF.md
│   ├── PRD_FINAL.md
│   ├── TECH_SPEC.md
│   └── CHECKLIST.md
├── icons/
└── iOS/
    ├── project.yml
    ├── README.md
    ├── WakeMeUp/
    ├── WakeMeUpTests/
    └── WakeMeUpiOS.xcodeproj/
```

## 4. Web 版现状

### 4.1 职责定位

Web 版现在主要承担：

- 算法验证
- 文案验证
- 交互节奏验证
- 演示与快速迭代

它不再适合作为最终安全兜底产品形态。

### 4.2 已实现能力

- 本机档案：性别、体重、身高、年龄、你的量、联系人
- 酒局记录：四类酒 `+ / -`
- 首次酒局启动弹层：进食状态、开始时间
- `drinkEvents` 事件流
- Widmark / TBW BAC 逐分钟前向模拟
- 三段式清醒倒计时
- Free / Pro 状态门控
- Web 降级版短信唤起与文案复制
- PWA Manifest / Service Worker

### 4.3 当前限制

- 无法后台常驻
- 无法静默自动发短信
- 守候能力天然弱于原生 App
- `app.js` 仍然过大，尚未模块化

## 5. iOS 版现状

### 5.1 职责定位

iOS 是当前正式产品化主线，未来核心能力都应该优先在这条线上闭环。

### 5.2 已有模块

- `App`：入口和导航
- `Core`：领域模型、算法、语言工具
- `Services`：AppModel、通知、支付
- `Features/Setup`：首配 / 档案编辑
- `Features/Dashboard`：主界面
- `Features/Upgrade`：升级页
- `Features/History`：历史记录页
- `Features/Settings`：设置页
- `WakeMeUpTests`：算法基础测试

### 5.3 已实现能力

- SwiftUI 主流程
- Swift 版 SobrietyEngine
- iOS 本地通知守候占位
- StoreKit 2 终身 Pro 商品壳
- 多语言 strings：中文 / 英文
- 当前酒局归档到历史
- 设备语言跟随
- Mac Catalyst 构建支持

### 5.4 当前缺口

- 通知策略还不是最终版
- 支付仍未接 App Store Connect 真商品
- 多联系人还没落地
- 历史记录还未扩展到导出 / 复盘深水区
- 还没进入真正上架准备阶段

## 6. 算法口径

当前 Web 与 iOS 都已经采用同一条核心口径：

- 纯酒精：`volume × abv × 0.789`
- 分布容积：Watson-TBW / Forrest / 降级公式
- 进食修正：`empty / light / normalMeal`
- 输出：
  - 离清醒还差得远
  - 快清醒了
  - 基本清醒了

如果后续要继续改算法，必须优先保证 Web 与 iOS 的公式口径一致。

## 7. 付费与商业化现状

当前代码里已经明确存在 Free / Pro 结构：

- Free：记录、基础估算、基本演示能力
- Pro：守候提醒、多联系人、更强兜底、历史 / 复盘 / 导出、自定义酒类

现阶段支付还是“结构先行”，并未真正完成商品接通与商业策略冻结。

## 8. 当前最重要的开发原则

- 不要再把 Web 当最终形态来规划
- iOS 优先级高于 Web
- 算法改动必须双端对齐
- 付费边界要尽快冻结，否则产品和技术都会反复摇摆
- 对已有未提交 iOS 改动要谨慎，不要误覆盖

## 9. 建议接手顺序

1. 先读 [TECH_SPEC.md](/Users/howell623/Projects/醒了吗?/TECH_SPEC.md)
2. 再读 [iOS/README.md](/Users/howell623/Projects/醒了吗?/iOS/README.md)
3. 然后看 [app.js](/Users/howell623/Projects/醒了吗?/app.js) 与 [iOS/WakeMeUp/Services/AppModel.swift](/Users/howell623/Projects/醒了吗?/iOS/WakeMeUp/Services/AppModel.swift)
4. 最后按 [CHECKLIST.md](/Users/howell623/Projects/醒了吗?/CHECKLIST.md) 继续推进

## 10. 当前最值得继续做的事

- 先把 iOS 当前本地改动整理成一轮可提交版本
- 补算法测试
- 明确支付模型
- 再做通知与多联系人闭环
