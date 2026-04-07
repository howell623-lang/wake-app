# 醒了吗? 项目 Checklist

更新时间：2026-03-31
适用目录：`/Users/howell623/Projects/醒了吗?`

## 已完成

- [x] 关闭 Web 版 `TESTING_RESET_ON_LOAD`，恢复本地配置、酒局和付费态的正常持久化。
- [x] 抽离 Web 存储层到 `storage-core.js`，减少 `app.js` 对本地持久化的直接耦合。
- [x] 抽离 Web 守候规则与短信辅助逻辑到 `patrol-core.js`，缩小 `app.js` 的非 UI 职责。
- [x] 抽离 Web 渲染/状态/格式化层到 `render-core.js`，让 `app.js` 更聚焦于状态编排。

## 进行中 / 待跟进

- [x] 同步顶层文档到当前“双线版本”现状：Web 验证壳 + iOS 原生主线。
- [x] 梳理 iOS 当前未提交改动，拆成可提交的功能块：历史、设置、本地化、升级页、Catalyst。
- [x] 给 Web BAC 引擎补基础测试样例，覆盖空酒局、轻度、重度、跨阈值场景。
- [x] 给 iOS `SobrietyEngine` 扩充单测，补女性、缺失身高/年龄、空腹/正常进食等边界。
- [x] 修复 iOS test target / scheme 配置，解决 `@testable import WakeMeUp` 在 `build-for-testing` 下的模块解析问题。
- [x] 去掉 Web 端单文件 `app.js` 的持续膨胀，按 `engine / patrol / storage / render` 拆模块。
- [x] 补齐 iOS StoreKit 购买收尾与付费页降级态，避免“商品缺失也能点买”以及成功购买后未 `finish transaction`。
- [x] 补一份 App Store 提审执行清单，并把当前上架阻塞项单独沉淀成文档。
- [x] 补 iOS 方向支持配置，减少提审与构建过程里的系统警告噪音。
- [ ] 继续把 Web 端 `session / controller` 逻辑从 `app.js` 剥离，避免主编排层重新膨胀。
- [ ] 明确 Free / Pro 边界并冻结一期付费方案：一次买断还是赞助型解锁。
- [ ] 接通 iOS StoreKit 真实商品并验证购买、恢复购买、无商品时的降级路径。
- [ ] 设计多联系人能力，明确免费版与 Pro 的联系人数量差异。
- [ ] 把 iOS 守候提醒从“本地通知占位”推进到完整流程：权限、重置、文案、重复触发策略。
- [ ] 统一 Web / iOS 的状态文案、阈值名词和免责声明，避免两端产品语言继续分叉。
- [ ] 评估是否保留 Web 端 Service Worker 缓存；若保留，补版本策略和缓存失效说明。
- [x] 补一份面向继续开发的里程碑表：算法稳定、通知稳定、付费接通、上架准备。

## 备注

- 当前仓库长期方向已经偏向 iOS 原生。
- Web 版更适合继续承担算法、文案和交互验证，不适合承担最终守候能力。
