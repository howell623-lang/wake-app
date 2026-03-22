import Foundation

enum Gender: String, CaseIterable, Codable, Identifiable {
    case male
    case female
    case other

    var id: String { rawValue }
    var titleKey: String { "setup.gender.\(rawValue)" }
}

enum MealState: String, CaseIterable, Codable, Identifiable {
    case empty
    case light
    case normalMeal

    var id: String { rawValue }
    var titleKey: String { "meal.\(rawValue)" }

    var absorptionFactor: Double {
        switch self {
        case .empty:
            return 1.0
        case .light:
            return 0.9
        case .normalMeal:
            return 0.8
        }
    }

    var absorptionMinutes: Int {
        switch self {
        case .empty:
            return 45
        case .light:
            return 60
        case .normalMeal:
            return 90
        }
    }
}

enum DrinkType: String, CaseIterable, Codable, Identifiable {
    case beer
    case wine
    case spirits
    case baijiu

    var id: String { rawValue }
    var nameKey: String { "drink.\(rawValue).name" }
    var unitKey: String { "drink.\(rawValue).unit" }

    var defaultVolumeML: Int {
        switch self {
        case .beer:
            return 500
        case .wine:
            return 150
        case .spirits, .baijiu:
            return 50
        }
    }

    var defaultABVPercent: Double {
        switch self {
        case .beer:
            return 5
        case .wine:
            return 13
        case .spirits:
            return 40
        case .baijiu:
            return 52
        }
    }
}

enum DrinkAction: String, Codable {
    case add
    case remove
}

enum EntitlementPlan: String, Codable {
    case free
    case pro
    case supporter

    var titleKey: String { "plan.\(rawValue)" }
}

enum CountdownTone: String {
    case neutral
    case high
    case mild
    case clear
}

struct UserProfile: Codable, Equatable {
    var gender: Gender
    var weightKG: Double
    var heightCM: Double?
    var age: Int?
    var thresholdGrams: Double
    var emergencyContact: String
}

struct DrinkEvent: Codable, Identifiable, Equatable {
    var id: UUID
    var type: DrinkType
    var action: DrinkAction
    var abv: Double
    var volumeML: Int
    var timestamp: Date

    init(
        id: UUID = UUID(),
        type: DrinkType,
        action: DrinkAction,
        abv: Double,
        volumeML: Int,
        timestamp: Date
    ) {
        self.id = id
        self.type = type
        self.action = action
        self.abv = abv
        self.volumeML = volumeML
        self.timestamp = timestamp
    }
}

struct DrinkEntry: Codable, Identifiable, Equatable {
    var type: DrinkType
    var count: Int
    var abvPercent: Double
    var volumeML: Int

    var id: String { type.rawValue }

    static func `default`(_ type: DrinkType) -> DrinkEntry {
        DrinkEntry(
            type: type,
            count: 0,
            abvPercent: type.defaultABVPercent,
            volumeML: type.defaultVolumeML
        )
    }
}

struct SessionMessage: Codable, Identifiable, Equatable {
    var id: UUID
    var level: String
    var at: Date
    var body: String

    init(id: UUID = UUID(), level: String, at: Date, body: String) {
        self.id = id
        self.level = level
        self.at = at
        self.body = body
    }
}

struct SessionState: Codable, Equatable {
    var dateKey: String
    var startedAt: Date?
    var lastDrinkAt: Date?
    var mealState: MealState?
    var isEnded: Bool
    var safeReportSent: Bool
    var warningHandled: Bool
    var emergencyHandled: Bool
    var messageLog: [SessionMessage]
    var drinkEvents: [DrinkEvent]
    var drinks: [DrinkEntry]

    static func empty(for date: Date = .now) -> SessionState {
        SessionState(
            dateKey: Self.dateKey(for: date),
            startedAt: nil,
            lastDrinkAt: nil,
            mealState: nil,
            isEnded: false,
            safeReportSent: false,
            warningHandled: false,
            emergencyHandled: false,
            messageLog: [],
            drinkEvents: [],
            drinks: DrinkType.allCases.map(DrinkEntry.default)
        )
    }

    func entry(for type: DrinkType) -> DrinkEntry {
        drinks.first(where: { $0.type == type }) ?? .default(type)
    }

    mutating func updateEntry(_ entry: DrinkEntry) {
        if let index = drinks.firstIndex(where: { $0.type == entry.type }) {
            drinks[index] = entry
        } else {
            drinks.append(entry)
        }
    }

    mutating func normalized() {
        for type in DrinkType.allCases where !drinks.contains(where: { $0.type == type }) {
            drinks.append(.default(type))
        }
        drinks.sort { $0.type.rawValue < $1.type.rawValue }
    }

    static func dateKey(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

struct EntitlementState: Codable, Equatable {
    var plan: EntitlementPlan = .free
}

struct SessionMetrics: Equatable {
    var totalAlcoholGrams: Double
    var ratio: Double
    var currentBAC: Double
    var peakBAC: Double
    var tHigh: TimeInterval
    var tMild: TimeInterval
    var tClear: TimeInterval
    var soberAt: Date?

    static let empty = SessionMetrics(
        totalAlcoholGrams: 0,
        ratio: 0,
        currentBAC: 0,
        peakBAC: 0,
        tHigh: 0,
        tMild: 0,
        tClear: 0,
        soberAt: nil
    )
}

struct CountdownStageItem: Identifiable, Equatable {
    var id: String
    var symbol: String
    var titleKey: String
    var remaining: TimeInterval
    var targetTime: Date?
    var tone: CountdownTone
    var isReached: Bool
}

