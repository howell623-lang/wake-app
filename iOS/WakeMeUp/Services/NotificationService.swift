import Foundation
import UserNotifications

@MainActor
final class NotificationService {
    private let center = UNUserNotificationCenter.current()
    private let patrolIDs = ["wake.patrol.warning", "wake.patrol.emergency"]

    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
    }

    func currentAuthorizationStatus() async -> Bool {
        let settings = await center.notificationSettings()
        return settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
    }

    func clearPatrolNotifications() async {
        center.removePendingNotificationRequests(withIdentifiers: patrolIDs)
    }

    func schedulePatrolReminders(from anchor: Date) async {
        await clearPatrolNotifications()

        let now = Date()
        let offsets: [(String, TimeInterval, String, String)] = [
            (
                patrolIDs[0],
                30 * 60,
                L10n.string("notification.warning.title"),
                L10n.string("notification.warning.body")
            ),
            (
                patrolIDs[1],
                60 * 60,
                L10n.string("notification.emergency.title"),
                L10n.string("notification.emergency.body")
            )
        ]

        for (identifier, offset, title, body) in offsets {
            let triggerSeconds = anchor.addingTimeInterval(offset).timeIntervalSince(now)
            guard triggerSeconds > 1 else { continue }

            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: triggerSeconds, repeats: false)
            let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

            try? await center.add(request)
        }
    }
}

