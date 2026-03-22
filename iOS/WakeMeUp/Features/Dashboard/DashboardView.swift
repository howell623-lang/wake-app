import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var model: AppModel

    private let grid = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                headerCard
                drinksCard
                countdownCard
                patrolCard

                if model.entitlement.plan == .free {
                    upgradeCard
                }

                profileCard
            }
            .padding(16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(L10n.string("app.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(L10n.string("actions.demo")) {
                    model.loadDemoScenario()
                }

                Button(L10n.string("actions.profile")) {
                    model.openProfileEditor()
                }

                Button(L10n.string("actions.reset")) {
                    model.clearSession()
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button(model.session.isEnded ? L10n.string("actions.new_session") : L10n.string("actions.end_session")) {
                model.endOrRestartSession()
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 8)
            .background(.ultraThinMaterial)
        }
    }

    private var headerCard: some View {
        CardSection {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(L10n.string("dashboard.status.title"))
                        .font(.headline)
                    Spacer()
                    Text(model.planTitle)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.secondary.opacity(0.12), in: Capsule())
                }

                Text(model.riskTitle)
                    .font(.system(.title2, design: .rounded, weight: .bold))

                Text(model.riskDetail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                HStack {
                    metricPill(title: L10n.string("dashboard.summary.total"), value: L10n.formatGrams(model.metrics.totalAlcoholGrams))
                    metricPill(title: L10n.string("dashboard.summary.sober_at"), value: L10n.formatTargetTime(model.metrics.soberAt))
                }
            }
        }
    }

    private var drinksCard: some View {
        CardSection(title: L10n.string("dashboard.drinks.title"), subtitle: L10n.string("dashboard.drinks.subtitle")) {
            LazyVGrid(columns: grid, spacing: 12) {
                ForEach(model.drinkEntries) { entry in
                    DrinkCardView(
                        entry: entry,
                        share: model.share(for: entry.type),
                        onRemove: { model.applyDrinkChange(entry.type, delta: -1) },
                        onAdd: { model.applyDrinkChange(entry.type, delta: 1) }
                    )
                }
            }
        }
    }

    private var countdownCard: some View {
        CardSection(title: L10n.string("dashboard.countdown.title"), subtitle: L10n.string("dashboard.countdown.subtitle")) {
            VStack(spacing: 0) {
                ForEach(model.stageItems) { item in
                    HStack(alignment: .top, spacing: 12) {
                        Text(item.symbol)
                            .font(.title3)

                        Text(L10n.string(item.titleKey))
                            .font(.headline)

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text(item.isReached ? L10n.string("countdown.reached") : L10n.formatLiveCountdown(item.remaining))
                                .font(.system(.headline, design: .monospaced))
                                .foregroundStyle(stageColor(for: item.tone))

                            Text(item.isReached ? L10n.string("countdown.target_now") : L10n.format("countdown.target_prefix", L10n.formatTargetTime(item.targetTime)))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 14)

                    if item.id != model.stageItems.last?.id {
                        Divider()
                    }
                }

                Divider().padding(.top, 8)

                summaryRow(L10n.string("dashboard.summary.total"), L10n.formatGrams(model.metrics.totalAlcoholGrams))
                summaryRow(L10n.string("dashboard.summary.sober_at"), L10n.formatTargetTime(model.metrics.soberAt))
                summaryRow(L10n.string("dashboard.summary.last_drink"), L10n.formatLastDrink(model.session.lastDrinkAt))
            }
        }
    }

    private var patrolCard: some View {
        CardSection(title: L10n.string("dashboard.patrol.title"), subtitle: L10n.string("dashboard.patrol.subtitle")) {
            VStack(alignment: .leading, spacing: 8) {
                Text(model.patrolHeadline)
                    .font(.headline)

                Text(model.patrolDetail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if model.entitlement.plan == .pro, !model.notificationsEnabled {
                    Button(L10n.string("dashboard.patrol.enable_notifications")) {
                        Task { await model.requestNotifications() }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
    }

    private var upgradeCard: some View {
        CardSection(title: L10n.string("dashboard.upgrade.title"), subtitle: L10n.string("dashboard.upgrade.subtitle")) {
            VStack(alignment: .leading, spacing: 10) {
                Text(L10n.string("dashboard.upgrade.body"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Button(L10n.string("actions.upgrade")) {
                    model.openUpgrade()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private var profileCard: some View {
        CardSection(title: L10n.string("dashboard.profile.title"), subtitle: L10n.string("dashboard.profile.subtitle")) {
            VStack(spacing: 12) {
                profileRow(L10n.string("setup.gender"), model.profile.map { L10n.string($0.gender.titleKey) } ?? "-")
                profileRow(L10n.string("setup.weight"), model.profile.map { String(format: "%.0f kg", $0.weightKG) } ?? "-")
                profileRow(L10n.string("setup.height"), model.profile?.heightCM.map { String(format: "%.0f cm", $0) } ?? "-")
                profileRow(L10n.string("setup.age"), model.profile?.age.map(String.init) ?? "-")
                profileRow(L10n.string("setup.threshold"), model.profile.map { L10n.formatGrams($0.thresholdGrams) } ?? "-")
                profileRow(L10n.string("setup.contact"), model.profile?.emergencyContact ?? "-")
            }
        }
    }

    private func metricPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func summaryRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
        .padding(.top, 12)
    }

    private func profileRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
    }

    private func stageColor(for tone: CountdownTone) -> Color {
        switch tone {
        case .neutral:
            return .secondary
        case .high:
            return .red
        case .mild:
            return .orange
        case .clear:
            return .green
        }
    }
}

private struct CardSection<Content: View>: View {
    var title: String?
    var subtitle: String?
    @ViewBuilder var content: Content

    init(title: String? = nil, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let title {
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(.headline)
                    Spacer()
                    if let subtitle {
                        Text(subtitle)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }
}

private struct DrinkCardView: View {
    let entry: DrinkEntry
    let share: Double
    let onRemove: () -> Void
    let onAdd: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(L10n.string(entry.type.nameKey))
                        .font(.headline)
                    Text("\(entry.volumeML)ml / \(L10n.string(entry.type.unitKey)) · \(L10n.format("drink.current_abv", entry.abvPercent))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("\(entry.count)\(L10n.string(entry.type.unitKey))")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.red)
            }

            Text(L10n.format("drink.contribution", entry.volumeML, Int(round(share * 100))))
                .font(.footnote)
                .foregroundStyle(.secondary)

            HStack {
                Spacer()
                Button(action: onRemove) {
                    Image(systemName: "minus")
                        .frame(width: 42, height: 42)
                }
                .buttonStyle(.bordered)
                .disabled(entry.count == 0)

                Button(action: onAdd) {
                    Image(systemName: "plus")
                        .frame(width: 42, height: 42)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(16)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

