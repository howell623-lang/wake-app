import XCTest
@testable import WakeMeUp

final class SobrietyEngineTests: XCTestCase {
    private let engine = SobrietyEngine()

    func testEmptySessionReturnsZeroMetrics() {
        let metrics = engine.compute(profile: nil, session: .empty(), now: Date())

        XCTAssertEqual(metrics.totalAlcoholGrams, 0, accuracy: 0.001)
        XCTAssertEqual(metrics.currentBAC, 0, accuracy: 0.0001)
        XCTAssertEqual(metrics.tClear, 0, accuracy: 0.001)
    }

    func testHeavySessionProducesFutureThresholds() {
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

    func testMaleProfileFallsBackWithoutHeightAndAge() {
        let now = Date()
        let profile = UserProfile(
            gender: .male,
            weightKG: 82,
            heightCM: nil,
            age: nil,
            thresholdGrams: 45,
            emergencyContact: "13800138000"
        )

        let metrics = engine.compute(
            profile: profile,
            session: makeSession(
                now: now,
                mealState: .light,
                events: [
                    DrinkEvent(type: .beer, action: .add, abv: 0.05, volumeML: 500, timestamp: now.addingTimeInterval(-20 * 60))
                ]
            ),
            now: now
        )

        XCTAssertGreaterThan(metrics.totalAlcoholGrams, 19)
        XCTAssertGreaterThan(metrics.currentBAC, 0)
        XCTAssertGreaterThan(metrics.tClear, 0)
    }

    func testFemaleProfileWithHeightProducesFutureSobrietyEstimate() {
        let now = Date()
        let profile = UserProfile(
            gender: .female,
            weightKG: 58,
            heightCM: 165,
            age: 31,
            thresholdGrams: 35,
            emergencyContact: "13800138000"
        )

        let metrics = engine.compute(
            profile: profile,
            session: makeSession(
                now: now,
                mealState: .normalMeal,
                events: [
                    DrinkEvent(type: .wine, action: .add, abv: 0.13, volumeML: 150, timestamp: now.addingTimeInterval(-18 * 60)),
                    DrinkEvent(type: .wine, action: .add, abv: 0.13, volumeML: 150, timestamp: now.addingTimeInterval(-8 * 60))
                ]
            ),
            now: now
        )

        XCTAssertGreaterThan(metrics.totalAlcoholGrams, 30)
        XCTAssertGreaterThan(metrics.currentBAC, 0)
        XCTAssertNotNil(metrics.soberAt)
        XCTAssertGreaterThan(metrics.soberAt?.timeIntervalSince(now) ?? 0, 0)
    }

    func testEmptyStomachProducesHigherCurrentBACThanNormalMeal() {
        let now = Date()
        let profile = UserProfile(
            gender: .male,
            weightKG: 78,
            heightCM: 175,
            age: 35,
            thresholdGrams: 50,
            emergencyContact: "13800138000"
        )
        let events = [
            DrinkEvent(type: .beer, action: .add, abv: 0.05, volumeML: 500, timestamp: now.addingTimeInterval(-15 * 60)),
            DrinkEvent(type: .beer, action: .add, abv: 0.05, volumeML: 500, timestamp: now.addingTimeInterval(-10 * 60))
        ]

        let emptyMetrics = engine.compute(
            profile: profile,
            session: makeSession(now: now, mealState: .empty, events: events),
            now: now
        )
        let normalMealMetrics = engine.compute(
            profile: profile,
            session: makeSession(now: now, mealState: .normalMeal, events: events),
            now: now
        )

        XCTAssertGreaterThanOrEqual(emptyMetrics.currentBAC, normalMealMetrics.currentBAC)
        XCTAssertGreaterThanOrEqual(emptyMetrics.peakBAC, normalMealMetrics.peakBAC)
    }

    private func makeSession(now: Date, mealState: MealState, events: [DrinkEvent]) -> SessionState {
        var session = SessionState.empty(for: now)
        session.mealState = mealState
        session.startedAt = events.map(\.timestamp).min() ?? now
        session.lastDrinkAt = events.map(\.timestamp).max() ?? now
        session.drinkEvents = events

        for event in events where event.action == .add {
            var entry = session.entry(for: event.type)
            entry.count += 1
            entry.abvPercent = event.abv > 1 ? event.abv : event.abv * 100
            entry.volumeML = event.volumeML
            session.updateEntry(entry)
        }

        return session
    }
}
