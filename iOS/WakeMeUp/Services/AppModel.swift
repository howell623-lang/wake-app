import Foundation
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    @Published var profile: UserProfile? {
        didSet { saveProfile() }
    }

    @Published var session: SessionState {
        didSet { saveSession() }
    }

    @Published var entitlement: EntitlementState {
        didSet { saveEntitlement() }
    }

    @Published var showUpgrade = false
    @Published var showSetupEditor = false
    @Published var showSettings = false
    @Published var showHistory = false
    @Published var notificationsEnabled = false
    @Published var purchaseMessage: String?
    @Published var history: [SessionArchive]

    private let defaults = UserDefaults.standard
    private let engine = SobrietyEngine()
    private let notificationService = NotificationService()
    let monetizationService = MonetizationService()

    private enum StorageKey {
        static let profile = "wake.ios.profile"
        static let session = "wake.ios.session"
        static let entitlement = "wake.ios.entitlement"
        static let history = "wake.ios.history"
    }

    init() {
        profile = Self.load(UserProfile.self, forKey: StorageKey.profile)
        session = Self.load(SessionState.self, forKey: StorageKey.session) ?? .empty()
        entitlement = Self.load(EntitlementState.self, forKey: StorageKey.entitlement) ?? EntitlementState()
        history = Self.load([SessionArchive].self, forKey: StorageKey.history) ?? []
        rolloverIfNeeded()
        session.normalized()
    }

    func bootstrap() async {
        notificationsEnabled = await notificationService.currentAuthorizationStatus()
        await monetizationService.loadProducts()
        if await monetizationService.refreshOwnedPro() {
            entitlement.plan = .pro
        }
    }

    var metrics: SessionMetrics {
        metrics(at: .now)
    }

    var drinkEntries: [DrinkEntry] {
        DrinkType.allCases.map { session.entry(for: $0) }
    }

    var currentSessionSummary: String {
        let parts = session.drinks.compactMap { entry -> String? in
            guard entry.count > 0 else { return nil }
            return L10n.format("history.summary.entry", L10n.string(entry.type.nameKey), L10n.formatCountUnit(entry.count, unitKey: entry.type.countUnitKey))
        }
        return parts.isEmpty ? L10n.string("history.summary.empty") : parts.joined(separator: " · ")
    }

    var currentMealStateTitle: String {
        L10n.string((session.mealState ?? .normalMeal).titleKey)
    }

    var preferredLanguageLabel: String {
        let identifiers = Locale.preferredLanguages.prefix(2)
        let localized = identifiers.compactMap { identifier -> String? in
            Locale.current.localizedString(forIdentifier: identifier)
        }
        return localized.joined(separator: " / ")
    }

    var planTitle: String {
        L10n.string(entitlement.plan.titleKey)
    }

    var riskTitle: String {
        if session.isEnded { return L10n.string("risk.ended") }
        let ratio = metrics.ratio
        if ratio >= 1.5 { return L10n.string("risk.high") }
        if ratio >= 1.0 { return L10n.string("risk.drunk") }
        if ratio >= 0.5 { return L10n.string("risk.tipsy") }
        return L10n.string("risk.calm")
    }

    var riskDetail: String {
        if session.isEnded { return L10n.string("risk.detail.ended") }
        let ratio = metrics.ratio
        if ratio >= 1.5 { return L10n.string("risk.detail.high") }
        if ratio >= 1.0 { return L10n.string("risk.detail.drunk") }
        if ratio >= 0.5 { return L10n.string("risk.detail.tipsy") }
        return L10n.string("risk.detail.calm")
    }

    var patrolHeadline: String {
        if entitlement.plan != .pro { return L10n.string("patrol.free.headline") }
        if !notificationsEnabled { return L10n.string("patrol.pro.notifications_off") }
        if session.isEnded { return L10n.string("patrol.ended.headline") }
        return L10n.string("patrol.pro.headline")
    }

    var patrolDetail: String {
        if entitlement.plan != .pro { return L10n.string("patrol.free.detail") }
        if !notificationsEnabled { return L10n.string("patrol.pro.notifications_detail") }
        return L10n.string("patrol.pro.detail")
    }

    var stageItems: [CountdownStageItem] {
        stageItems(at: .now)
    }

    func metrics(at now: Date) -> SessionMetrics {
        engine.compute(profile: profile, session: session, now: now)
    }

    func stageItems(at now: Date) -> [CountdownStageItem] {
        let currentMetrics = metrics(at: now)
        if currentMetrics.totalAlcoholGrams <= 0 {
            return [
                CountdownStageItem(
                    id: "empty",
                    symbol: "—",
                    titleKey: "countdown.empty",
                    remaining: 0,
                    targetTime: nil,
                    tone: .neutral,
                    isReached: true
                )
            ]
        }

        var items: [CountdownStageItem] = []
        if currentMetrics.tHigh > 0 {
            items.append(
                CountdownStageItem(
                    id: "high",
                    symbol: "🤯",
                    titleKey: "countdown.far",
                    remaining: currentMetrics.tHigh,
                    targetTime: now.addingTimeInterval(currentMetrics.tHigh),
                    tone: .high,
                    isReached: false
                )
            )
        }
        if currentMetrics.tMild > 0 {
            items.append(
                CountdownStageItem(
                    id: "mild",
                    symbol: "🙂",
                    titleKey: "countdown.near",
                    remaining: currentMetrics.tMild,
                    targetTime: now.addingTimeInterval(currentMetrics.tMild),
                    tone: .mild,
                    isReached: false
                )
            )
        }
        if currentMetrics.tClear > 0 {
            items.append(
                CountdownStageItem(
                    id: "clear",
                    symbol: "😌",
                    titleKey: "countdown.clear",
                    remaining: currentMetrics.tClear,
                    targetTime: currentMetrics.soberAt,
                    tone: .clear,
                    isReached: false
                )
            )
        }

        if items.isEmpty {
            return [
                CountdownStageItem(
                    id: "done",
                    symbol: "😌",
                    titleKey: "countdown.done",
                    remaining: 0,
                    targetTime: now,
                    tone: .clear,
                    isReached: true
                )
            ]
        }

        return items
    }

    func share(for type: DrinkType) -> Double {
        guard metrics.totalAlcoholGrams > 0 else { return 0 }
        let entry = session.entry(for: type)
        let grams = Double(entry.count) * Double(entry.volumeML) * (entry.abvPercent / 100) * 0.789
        return grams / metrics.totalAlcoholGrams
    }

    func submitProfile(
        gender: Gender,
        weightText: String,
        heightText: String,
        ageText: String,
        thresholdText: String,
        contact: String
    ) {
        let weight = Double(weightText) ?? 70
        let height = Double(heightText)
        let age = Int(ageText)
        let threshold = Double(thresholdText) ?? 40

        profile = UserProfile(
            gender: gender,
            weightKG: max(weight, 30),
            heightCM: height,
            age: age,
            thresholdGrams: max(threshold, 5),
            emergencyContact: contact.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    func loadDemoScenario() {
        profile = UserProfile(
            gender: .male,
            weightKG: 78,
            heightCM: 175,
            age: 35,
            thresholdGrams: 50,
            emergencyContact: "13800138000"
        )

        let now = Date()
        session = .empty(for: now)
        session.mealState = .light
        session.startedAt = now.addingTimeInterval(-45 * 60)
        session.lastDrinkAt = now.addingTimeInterval(-12 * 60)
        session.safeReportSent = true

        var beer = session.entry(for: .beer)
        beer.count = 2
        session.updateEntry(beer)

        var wine = session.entry(for: .wine)
        wine.count = 1
        session.updateEntry(wine)

        var baijiu = session.entry(for: .baijiu)
        baijiu.count = 1
        session.updateEntry(baijiu)

        session.drinkEvents = [
            DrinkEvent(type: .beer, action: .add, abv: 0.05, volumeML: 500, timestamp: now.addingTimeInterval(-42 * 60)),
            DrinkEvent(type: .beer, action: .add, abv: 0.05, volumeML: 500, timestamp: now.addingTimeInterval(-38 * 60)),
            DrinkEvent(type: .wine, action: .add, abv: 0.13, volumeML: 150, timestamp: now.addingTimeInterval(-25 * 60)),
            DrinkEvent(type: .baijiu, action: .add, abv: 0.52, volumeML: 50, timestamp: now.addingTimeInterval(-12 * 60))
        ]
    }

    func applyDrinkChange(_ type: DrinkType, delta: Int) {
        rolloverIfNeeded()
        var entry = session.entry(for: type)
        entry.count = max(0, entry.count + delta)
        session.updateEntry(entry)

        let now = Date()
        session.startedAt = session.startedAt ?? now
        session.lastDrinkAt = now
        session.warningHandled = false
        session.emergencyHandled = false
        session.mealState = session.mealState ?? .normalMeal
        session.drinkEvents.append(
            DrinkEvent(
                type: type,
                action: delta > 0 ? .add : .remove,
                abv: entry.abvPercent / 100,
                volumeML: entry.volumeML,
                timestamp: now
            )
        )

        Task {
            await refreshPatrolReminders()
        }
    }

    func clearSession() {
        archiveCurrentSession(reason: .cleared)
        session = .empty()
        Task {
            await notificationService.clearPatrolNotifications()
        }
    }

    func endOrRestartSession() {
        if session.isEnded {
            session = .empty()
            return
        }
        session.isEnded = true
        archiveCurrentSession(reason: .finished)
        Task {
            await notificationService.clearPatrolNotifications()
        }
    }

    func updateMealState(_ mealState: MealState) {
        session.mealState = mealState
    }

    func openUpgrade() {
        showUpgrade = true
    }

    func openProfileEditor() {
        showSetupEditor = true
    }

    func openSettings() {
        showSettings = true
    }

    func openHistory() {
        showHistory = true
    }

    func purchasePro() async {
        let purchased = await monetizationService.purchasePro()
        if purchased {
            entitlement.plan = .pro
            purchaseMessage = L10n.string("upgrade.purchase.success")
            await refreshPatrolReminders()
        } else {
            purchaseMessage = monetizationService.lastErrorMessage ?? L10n.string("upgrade.products.unavailable")
        }
    }

    func restorePurchases() async {
        if await monetizationService.restorePurchases() {
            entitlement.plan = .pro
            purchaseMessage = L10n.string("upgrade.restore.success")
            await refreshPatrolReminders()
        } else {
            purchaseMessage = monetizationService.lastErrorMessage ?? L10n.string("upgrade.restore.none")
        }
    }

    func requestNotifications() async {
        notificationsEnabled = await notificationService.requestAuthorization()
        await refreshPatrolReminders()
    }

    private func refreshPatrolReminders() async {
        guard entitlement.plan == .pro,
              let profile,
              metrics.totalAlcoholGrams >= profile.thresholdGrams,
              let anchor = session.lastDrinkAt,
              !session.isEnded else {
            await notificationService.clearPatrolNotifications()
            return
        }
        await notificationService.schedulePatrolReminders(from: anchor)
        notificationsEnabled = await notificationService.currentAuthorizationStatus()
    }

    private func rolloverIfNeeded() {
        let today = SessionState.dateKey(for: .now)
        guard session.dateKey != today else { return }
        archiveCurrentSession(reason: .rollover)
        session = .empty()
        Task {
            await notificationService.clearPatrolNotifications()
        }
    }

    private func saveProfile() {
        Self.save(profile, forKey: StorageKey.profile, defaults: defaults)
    }

    private func saveSession() {
        Self.save(session, forKey: StorageKey.session, defaults: defaults)
    }

    private func saveEntitlement() {
        Self.save(entitlement, forKey: StorageKey.entitlement, defaults: defaults)
    }

    private func saveHistory() {
        Self.save(history, forKey: StorageKey.history, defaults: defaults)
    }

    private static func load<T: Decodable>(_ type: T.Type, forKey key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func save<T: Encodable>(_ value: T?, forKey key: String, defaults: UserDefaults) {
        if let value, let data = try? JSONEncoder().encode(value) {
            defaults.set(data, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }

    private func archiveCurrentSession(reason: SessionEndReason, endedAt: Date = .now) {
        guard session.drinkEvents.contains(where: { $0.action == .add }) else { return }
        let metrics = self.metrics(at: endedAt)
        let archive = SessionArchive(
            dateKey: session.dateKey,
            startedAt: session.startedAt,
            endedAt: endedAt,
            totalAlcoholGrams: metrics.totalAlcoholGrams,
            peakBAC: metrics.peakBAC,
            soberAt: metrics.soberAt,
            summary: currentSessionSummary,
            endReason: reason
        )
        history.insert(archive, at: 0)
        history = Array(history.prefix(30))
        saveHistory()
    }
}
