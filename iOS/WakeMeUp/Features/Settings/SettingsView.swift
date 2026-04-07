import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section(L10n.string("settings.profile_section")) {
                settingsRow(L10n.string("setup.gender"), model.profile.map { L10n.string($0.gender.titleKey) } ?? "-")
                settingsRow(L10n.string("setup.weight"), model.profile.map { String(format: "%.0f kg", $0.weightKG) } ?? "-")
                settingsRow(L10n.string("setup.height"), model.profile?.heightCM.map { String(format: "%.0f cm", $0) } ?? "-")
                settingsRow(L10n.string("setup.age"), model.profile?.age.map(String.init) ?? "-")
                settingsRow(L10n.string("setup.threshold"), model.profile.map { L10n.formatGrams($0.thresholdGrams) } ?? "-")
                settingsRow(L10n.string("setup.contact"), model.profile?.emergencyContact ?? "-")

                Button(L10n.string("settings.edit_profile")) {
                    dismiss()
                    model.openProfileEditor()
                }
            }

            Section(L10n.string("settings.session_section")) {
                Picker(L10n.string("settings.meal_state"), selection: Binding(
                    get: { model.session.mealState ?? .normalMeal },
                    set: { model.updateMealState($0) }
                )) {
                    ForEach(MealState.allCases) { mealState in
                        Text(L10n.string(mealState.titleKey)).tag(mealState)
                    }
                }
            }

            Section(L10n.string("settings.device_section")) {
                settingsRow(L10n.string("settings.language"), model.preferredLanguageLabel)
                settingsRow(L10n.string("settings.plan"), model.planTitle)
                settingsRow(L10n.string("settings.notifications"), model.notificationsEnabled ? L10n.string("settings.notifications_on") : L10n.string("settings.notifications_off"))

                if !model.notificationsEnabled {
                    Button(L10n.string("dashboard.patrol.enable_notifications")) {
                        Task { await model.requestNotifications() }
                    }
                }
            }

            Section(L10n.string("settings.monetization_section")) {
                Text(L10n.string("settings.monetization_body"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Button(L10n.string("actions.upgrade")) {
                    dismiss()
                    model.openUpgrade()
                }
            }
        }
        .navigationTitle(L10n.string("actions.settings"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(L10n.string("actions.close")) {
                    dismiss()
                }
            }
        }
    }

    private func settingsRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
        }
    }
}
