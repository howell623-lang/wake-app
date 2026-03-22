import Foundation

struct SobrietyEngine {
    private let ethanolDensity = 0.789
    private let beta = 0.015
    private let highThreshold = 0.08
    private let mildThreshold = 0.03
    private let clearThreshold = 0.005

    func compute(profile: UserProfile?, session: SessionState, now: Date = .now) -> SessionMetrics {
        let totalAlcoholGrams = session.drinks.reduce(0) { partial, entry in
            partial + Double(entry.count) * Double(entry.volumeML) * (entry.abvPercent / 100) * ethanolDensity
        }

        let ratio: Double
        if let threshold = profile?.thresholdGrams, threshold > 0 {
            ratio = totalAlcoholGrams / threshold
        } else {
            ratio = 0
        }

        let addEvents = session.drinkEvents.filter { $0.action == .add }
        guard !addEvents.isEmpty else {
            return SessionMetrics(
                totalAlcoholGrams: totalAlcoholGrams,
                ratio: ratio,
                currentBAC: 0,
                peakBAC: 0,
                tHigh: 0,
                tMild: 0,
                tClear: 0,
                soberAt: nil
            )
        }

        let vdLiters = computeVd(profile: profile)
        let eliminationPerMinute = (beta * 10 * vdLiters) / 60
        let mealState = session.mealState ?? .normalMeal

        let earliest = addEvents.map(\.timestamp).min() ?? now
        let totalAbsorptionMinutes = addEvents.map { event in
            Int(event.timestamp.timeIntervalSince(earliest) / 60) + mealState.absorptionMinutes
        }.max() ?? mealState.absorptionMinutes

        let totalInputGrams = addEvents.reduce(0.0) { partial, event in
            partial + Double(event.volumeML) * normalizeABV(event.abv) * ethanolDensity * mealState.absorptionFactor
        }

        let estimatedClearMinutes = Int(ceil(totalInputGrams / max(eliminationPerMinute, 0.01))) + totalAbsorptionMinutes + 180
        let totalMinutes = max(Int(ceil(now.timeIntervalSince(earliest) / 60)) + 720, estimatedClearMinutes)
        let nowMinute = min(Int(ceil(now.timeIntervalSince(earliest) / 60)), totalMinutes)

        var bodyAlcoholGrams = 0.0
        var peakBAC = 0.0
        var trace: [Double] = []
        trace.reserveCapacity(totalMinutes + 1)

        for minute in 0...totalMinutes {
            var absorptionInput = 0.0
            for event in addEvents {
                let offset = Int(event.timestamp.timeIntervalSince(earliest) / 60)
                guard minute >= offset, minute < offset + mealState.absorptionMinutes else { continue }
                let grams = Double(event.volumeML) * normalizeABV(event.abv) * ethanolDensity * mealState.absorptionFactor
                absorptionInput += grams / Double(mealState.absorptionMinutes)
            }

            bodyAlcoholGrams = max(0, bodyAlcoholGrams + absorptionInput - eliminationPerMinute)
            let bac = vdLiters > 0 ? bodyAlcoholGrams / (10 * vdLiters) : 0
            peakBAC = max(peakBAC, bac)
            trace.append(bac)
        }

        let currentBAC = trace[min(nowMinute, trace.count - 1)]
        let tHigh = timeUntilStableBelow(trace: trace, fromMinute: nowMinute, threshold: highThreshold)
        let tMild = timeUntilStableBelow(trace: trace, fromMinute: nowMinute, threshold: mildThreshold)
        let tClear = timeUntilStableBelow(trace: trace, fromMinute: nowMinute, threshold: clearThreshold)

        return SessionMetrics(
            totalAlcoholGrams: totalAlcoholGrams,
            ratio: ratio,
            currentBAC: currentBAC,
            peakBAC: peakBAC,
            tHigh: tHigh,
            tMild: tMild,
            tClear: tClear,
            soberAt: now.addingTimeInterval(tClear)
        )
    }

    private func computeVd(profile: UserProfile?) -> Double {
        guard let profile else { return 40 }

        let weight = profile.weightKG
        let height = profile.heightCM
        let age = profile.age

        switch profile.gender {
        case .male:
            if let height, let age {
                return 2.447 - 0.09516 * Double(age) + 0.1074 * height + 0.3362 * weight
            }
            return 0.7 * weight
        case .female:
            if let height {
                let heightMeters = height / 100
                let bmi = weight / (heightMeters * heightMeters)
                return weight * (0.7772 - 0.0099 * bmi)
            }
            return 0.6 * weight
        case .other:
            return 0.65 * weight
        }
    }

    private func normalizeABV(_ value: Double) -> Double {
        value > 1 ? value / 100 : value
    }

    private func timeUntilStableBelow(trace: [Double], fromMinute: Int, threshold: Double) -> TimeInterval {
        var lastAboveIndex = -1
        for index in max(fromMinute, 0)..<trace.count where trace[index] > threshold {
            lastAboveIndex = index
        }
        guard lastAboveIndex >= 0 else { return 0 }
        return TimeInterval(lastAboveIndex - fromMinute + 1) * 60
    }
}

