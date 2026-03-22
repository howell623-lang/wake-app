import SwiftUI

@main
struct WakeMeUpApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .task {
                    await model.bootstrap()
                }
        }
    }
}

