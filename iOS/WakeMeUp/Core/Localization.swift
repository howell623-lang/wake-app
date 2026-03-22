import Foundation

enum L10n {
    static func string(_ key: String) -> String {
        NSLocalizedString(key, comment: "")
    }

    static func format(_ key: String, _ args: CVarArg...) -> String {
        String(
            format: NSLocalizedString(key, comment: ""),
            locale: Locale.current,
            arguments: args
        )
    }

    static func formatGrams(_ value: Double) -> String {
        format("format.grams", value)
    }

    static func formatPercent(_ value: Double) -> String {
        format("format.percent", value)
    }

    static func formatLiveCountdown(_ interval: TimeInterval) -> String {
        let totalSeconds = max(0, Int(interval.rounded(.up)))
        let days = totalSeconds / 86_400
        let hours = (totalSeconds % 86_400) / 3_600
        let minutes = (totalSeconds % 3_600) / 60
        let seconds = totalSeconds % 60

        let hh = String(format: "%02d", hours)
        let mm = String(format: "%02d", minutes)
        let ss = String(format: "%02d", seconds)
        return days > 0
            ? format("format.countdown.days", days, hh, mm, ss)
            : "\(hh):\(mm):\(ss)"
    }

    static func formatTargetTime(_ date: Date?) -> String {
        guard let date else { return string("format.unknown") }

        let calendar = Calendar.current
        let hhmm = DateFormatter.localizedString(from: date, dateStyle: .none, timeStyle: .short)

        if calendar.isDateInToday(date) {
            return format("time.today", hhmm)
        }

        if calendar.isDateInTomorrow(date) {
            return format("time.tomorrow", hhmm)
        }

        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.setLocalizedDateFormatFromTemplate("Mdhm")
        return formatter.string(from: date)
    }

    static func formatLastDrink(_ date: Date?) -> String {
        guard let date else { return string("session.not_started") }
        let time = DateFormatter.localizedString(from: date, dateStyle: .none, timeStyle: .short)
        if Calendar.current.isDateInToday(date) {
            return format("session.last_drink_today", time)
        }
        return format("session.last_drink_date", formatTargetTime(date))
    }
}

