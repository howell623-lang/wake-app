import SwiftUI

enum SetupMode {
    case onboarding
    case editing
}

struct SetupView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    let mode: SetupMode

    @State private var gender: Gender = .male
    @State private var weightText = ""
    @State private var heightText = ""
    @State private var ageText = ""
    @State private var thresholdText = ""
    @State private var contactText = ""
    @State private var hasLoaded = false

    var body: some View {
        Form {
            Section {
                Text(L10n.string("setup.description"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section(L10n.string("setup.profile_section")) {
                Picker(L10n.string("setup.gender"), selection: $gender) {
                    ForEach(Gender.allCases) { value in
                        Text(L10n.string(value.titleKey)).tag(value)
                    }
                }

                TextField(L10n.string("setup.weight"), text: $weightText)
                    .keyboardType(.decimalPad)

                TextField(L10n.string("setup.height"), text: $heightText)
                    .keyboardType(.decimalPad)

                TextField(L10n.string("setup.age"), text: $ageText)
                    .keyboardType(.numberPad)

                TextField(L10n.string("setup.threshold"), text: $thresholdText)
                    .keyboardType(.decimalPad)

                TextField(L10n.string("setup.contact"), text: $contactText)
                    .keyboardType(.phonePad)
            }

            Section {
                Button(L10n.string(mode == .onboarding ? "setup.save" : "profile.save")) {
                    model.submitProfile(
                        gender: gender,
                        weightText: weightText,
                        heightText: heightText,
                        ageText: ageText,
                        thresholdText: thresholdText,
                        contact: contactText
                    )
                    if mode == .editing {
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)

                if mode == .onboarding {
                    Button(L10n.string("setup.demo")) {
                        model.loadDemoScenario()
                    }
                }
            }
        }
        .navigationTitle(L10n.string(mode == .onboarding ? "setup.title" : "profile.edit"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if mode == .editing {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(L10n.string("actions.close")) {
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            if let profile = model.profile {
                gender = profile.gender
                weightText = String(format: "%.0f", profile.weightKG)
                heightText = profile.heightCM.map { String(format: "%.0f", $0) } ?? ""
                ageText = profile.age.map(String.init) ?? ""
                thresholdText = String(format: "%.0f", profile.thresholdGrams)
                contactText = profile.emergencyContact
            }
        }
    }
}

