# 醒了吗? / WakeMeUp

一个以饮酒安全兜底为核心的极简工具仓库，当前同时包含：

- Web / PWA 验证版
- iOS 原生主线

当前仓库重点已经从“单纯 Web MVP”转向“原生 iPhone 版本落地”，Web 更多承担算法、文案和交互验证职责。

## 当前仓库结构

```text
/Users/howell623/Projects/醒了吗?
├── index.html
├── styles.css
├── app.js
├── sw.js
├── manifest.webmanifest
├── README.md
├── PROJECT_HANDOFF.md
├── PRD_FINAL.md
├── TECH_SPEC.md
├── CHECKLIST.md
├── icons/
└── iOS/
```

## 当前版本概况

### Web 版

- 纯静态前端，无后端
- `localStorage` 存储本机档案、酒局数据、付费态
- Widmark / TBW 事件流逐分钟 BAC 模拟
- 三段式清醒倒计时
- 基础安全守候逻辑
- PWA 壳与本地缓存

说明：Web 版无法真正后台常驻，也无法静默自动发短信，因此更适合作为验证壳，而不是最终兜底形态。

### iOS 版

- SwiftUI 原生工程
- 已迁移核心酒精算法到 Swift
- 已有本地化、多语言字符串、基础本地通知、StoreKit 2 支付壳
- 已有设置、历史记录、升级页、档案编辑、Demo 流程

说明：iOS 是当前长期主线，因为锁屏提醒、系统通知、后续支付和更强兜底能力都更适合原生实现。

## Web 运行

```bash
cd /Users/howell623/Projects/醒了吗?
python3 -m http.server 4173
```

然后访问 [http://localhost:4173](http://localhost:4173)。

## iOS 运行

```bash
cd /Users/howell623/Projects/醒了吗?/iOS
xcodegen generate
open WakeMeUpiOS.xcodeproj
```

Mac Catalyst 本机构建：

```bash
xcodegen generate
xcodebuild -project WakeMeUpiOS.xcodeproj -scheme WakeMeUp -destination 'platform=macOS,variant=Mac Catalyst' CODE_SIGNING_ALLOWED=NO build
```

## 关键文档

- [TECH_SPEC.md](/Users/howell623/Projects/醒了吗?/TECH_SPEC.md)：Web V1 技术实现说明
- [PROJECT_HANDOFF.md](/Users/howell623/Projects/醒了吗?/PROJECT_HANDOFF.md)：项目交接与当前仓库状态
- [PRD_FINAL.md](/Users/howell623/Projects/醒了吗?/PRD_FINAL.md)：当前产品版本口径
- [CHECKLIST.md](/Users/howell623/Projects/醒了吗?/CHECKLIST.md)：持续跟进项
- [iOS/README.md](/Users/howell623/Projects/醒了吗?/iOS/README.md)：iOS 工程说明

## 当前优先级

1. 稳定 iOS 主线
2. 明确 Free / Pro 边界与支付方案
3. 补足算法测试与守候策略测试
4. 继续把 Web 保持为轻量验证壳
