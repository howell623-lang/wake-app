import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            Group {
                if model.profile == nil {
                    SetupView(mode: .onboarding)
                } else {
                    DashboardView()
                }
            }
            .sheet(isPresented: $model.showUpgrade) {
                NavigationStack {
                    UpgradeView()
                }
                .environmentObject(model)
            }
            .sheet(isPresented: $model.showSetupEditor) {
                NavigationStack {
                    SetupView(mode: .editing)
                }
                .environmentObject(model)
            }
        }
    }
}

