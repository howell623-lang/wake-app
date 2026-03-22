import XCTest
@testable import WakeMeUp

final class SobrietyEngineTests: XCTestCase {
    func testEmptySessionReturnsZeroMetrics() {
        let engine = SobrietyEngine()
        let metrics = engine.compute(profile: nil, session: .empty(), now: Date())

        XCTAssertEqual(metrics.totalAlcoholGrams, 0, accuracy: 0.001)
        XCTAssertEqual(metrics.currentBAC, 0, accuracy: 0.0001)
        XCTAssertEqual(metrics.tClear, 0, accuracy: 0.001)
    }

    func testHeavySessionProducesFutureThresholds() {
        let engine = SobrietyEngine()
        let now = Date()
        let profile = UserProfile(
            gender: .male,
            weightKG: 78,
            heightCM: 175,
            age: 35,
            thresholdGrams: 50,
            emergencyContact: "13800138000"
        )

        var session = SessionState.empty(for: now)
        session.mealState = .light
        session.startedAt = now.addingTimeInterval(-60)
        session.lastDrinkAt = now

        var spirits = session.entry(for: .spirits)
        spirits.count = 14
        session.updateEntry(spirits)

        session.drinkEvents = (0..<14).map { index in
            DrinkEvent(
                type: .spirits,
                action: .add,
                abv: 0.4,
                volumeML: 50,
                timestamp: now.addingTimeInterval(TimeInterval(-(14 - index) * 2))
            )
        }

        let metrics = engine.compute(profile: profile, session: session, now: now)

        XCTAssertGreaterThan(metrics.totalAlcoholGrams, 200)
        XCTAssertGreaterThan(metrics.tHigh, 0)
        XCTAssertGreaterThan(metrics.tMild, metrics.tHigh)
        XCTAssertGreaterThan(metrics.tClear, metrics.tMild)
        XCTAssertNotNil(metrics.soberAt)
    }
}
