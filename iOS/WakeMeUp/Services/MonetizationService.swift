import Foundation
import StoreKit

@MainActor
final class MonetizationService: ObservableObject {
    static let proLifetimeID = "com.howell623.wakemeup.pro.lifetime"

    @Published var products: [Product] = []
    @Published var lastErrorMessage: String?

    func loadProducts() async {
        do {
            products = try await Product.products(for: [Self.proLifetimeID])
        } catch {
            lastErrorMessage = error.localizedDescription
        }
    }

    func purchasePro() async -> Bool {
        guard let product = products.first(where: { $0.id == Self.proLifetimeID }) else {
            lastErrorMessage = L10n.string("upgrade.purchase.pending")
            return false
        }

        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                _ = try verified(verification)
                return true
            case .userCancelled:
                lastErrorMessage = L10n.string("upgrade.purchase.cancelled")
                return false
            case .pending:
                lastErrorMessage = L10n.string("upgrade.purchase.pending")
                return false
            @unknown default:
                lastErrorMessage = L10n.string("upgrade.purchase.pending")
                return false
            }
        } catch {
            lastErrorMessage = error.localizedDescription
            return false
        }
    }

    func restorePurchases() async -> Bool {
        do {
            try await AppStore.sync()
            return await refreshOwnedPro()
        } catch {
            lastErrorMessage = error.localizedDescription
            return false
        }
    }

    func refreshOwnedPro() async -> Bool {
        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try verified(result)
                if transaction.productID == Self.proLifetimeID {
                    return true
                }
            } catch {
                lastErrorMessage = error.localizedDescription
            }
        }
        return false
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let payload):
            return payload
        case .unverified:
            throw StoreError.failedVerification
        }
    }

    enum StoreError: Error {
        case failedVerification
    }
}

