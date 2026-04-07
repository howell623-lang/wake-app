# iOS 未提交改动整理与提交计划

更新时间：2026-03-30
适用目录：`/Users/howell623/Projects/醒了吗?/iOS`

## 目标

把当前 iOS 工作树里的未提交改动拆成语义清晰、风险可控的提交块，避免后续继续堆在一个大 diff 里。

## 当前未提交改动范围

涉及文件：

- `iOS/README.md`
- `iOS/project.yml`
- `iOS/WakeMeUpiOS.xcodeproj/project.pbxproj`
- `iOS/WakeMeUp/App/ContentView.swift`
- `iOS/WakeMeUp/Core/Domain.swift`
- `iOS/WakeMeUp/Core/Localization.swift`
- `iOS/WakeMeUp/Services/AppModel.swift`
- `iOS/WakeMeUp/Features/Dashboard/DashboardView.swift`
- `iOS/WakeMeUp/Features/Upgrade/UpgradeView.swift`
- `iOS/WakeMeUp/Resources/en.lproj/Localizable.strings`
- `iOS/WakeMeUp/Resources/zh-Hans.lproj/Localizable.strings`
- `iOS/WakeMeUp/Features/History/HistoryView.swift`
- `iOS/WakeMeUp/Features/Settings/SettingsView.swift`

## 建议拆分方式

### Commit 1：History / Settings 基础壳

建议范围：

- `iOS/WakeMeUp/Features/History/HistoryView.swift`
- `iOS/WakeMeUp/Features/Settings/SettingsView.swift`
- `iOS/WakeMeUp/App/ContentView.swift`
- `iOS/WakeMeUp/Resources/en.lproj/Localizable.strings`
- `iOS/WakeMeUp/Resources/zh-Hans.lproj/Localizable.strings`
- `iOS/WakeMeUpiOS.xcodeproj/project.pbxproj`

建议提交信息：

- `feat(iOS): add history and settings flows`

说明：

这一组主要是新页面接入和导航壳，用户可见价值清晰，和支付、算法、构建支持解耦。

### Commit 2：Session 归档与历史数据模型

建议范围：

- `iOS/WakeMeUp/Core/Domain.swift`
- `iOS/WakeMeUp/Services/AppModel.swift`

建议提交信息：

- `feat(iOS): archive sessions and persist history`

说明：

这一组是历史页背后的数据能力，包括：

- `SessionEndReason`
- `SessionArchive`
- `history` 持久化
- 手动结束 / 清空 / 跨天时归档

这部分应该单独提交，因为它属于状态模型增强，不只是 UI。

### Commit 3：Dashboard 实时倒计时与资料补充

建议范围：

- `iOS/WakeMeUp/Features/Dashboard/DashboardView.swift`
- `iOS/WakeMeUp/Core/Localization.swift`
- `iOS/WakeMeUp/Resources/en.lproj/Localizable.strings`
- `iOS/WakeMeUp/Resources/zh-Hans.lproj/Localizable.strings`

建议提交信息：

- `refine(iOS): make countdown live and expand profile detail`

说明：

这一组主要是体验层优化：

- `TimelineView` 秒级更新倒计时
- 饮酒数量的本地化格式化
- Dashboard 补充语言 / 进食状态展示

### Commit 4：Upgrade 文案与权益表达增强

建议范围：

- `iOS/WakeMeUp/Features/Upgrade/UpgradeView.swift`
- `iOS/WakeMeUp/Resources/en.lproj/Localizable.strings`
- `iOS/WakeMeUp/Resources/zh-Hans.lproj/Localizable.strings`

建议提交信息：

- `refine(iOS): expand pro upgrade messaging`

说明：

这一组只处理升级页，不夹杂算法或导航改动，便于后续继续接 App Store Connect 真商品。

### Commit 5：Catalyst / 本地运行支持

建议范围：

- `iOS/project.yml`
- `iOS/README.md`
- `iOS/WakeMeUpiOS.xcodeproj/project.pbxproj`

建议提交信息：

- `chore(iOS): enable catalyst build path and update docs`

说明：

这部分是开发环境支持，不应和产品功能混在一起。

## 推荐提交顺序

1. Commit 2：先固化历史归档数据模型
2. Commit 1：再接入 History / Settings 页面
3. Commit 3：处理 Dashboard 实时体验优化
4. Commit 4：处理升级页表达
5. Commit 5：最后提交构建与文档支持

## 风险提醒

- `AppModel.swift` 是状态中枢，提交前必须再次确认归档时机不会重复插入历史。
- `Localizable.strings` 被多个改动共用，拆 commit 时要避免互相覆盖。
- `project.pbxproj` 容易和其它 Xcode 改动冲突，适合单独控制提交粒度。
- 如果准备继续大改 iOS，不建议一次性把所有未提交内容压成一个 commit。

## 建议下一步

- 先按本文件拆一次 commit 草案
- 再补一轮 iOS 算法测试
- 然后进入通知和支付闭环
