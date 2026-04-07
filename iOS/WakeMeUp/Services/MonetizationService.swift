import Foundation
import StoreKit

@MainActor
final class MonetizationService: ObservableObject {
    static let proLifetimeID = "com.howell623.wakemeup.pro.lifetime"

    @Published var products: [Product] = []
    @Published var lastErrorMessage: String?
    @Published var isLoadingProducts = false
    @Published var isPurchasing = false

    func loadProducts() async {
        isLoadingProducts = true
        lastErrorMessage = nil
        defer { isLoadingProducts = false }
        do {
            products = try await Product.products(for: [Self.proLifetimeID])
            if products.isEmpty {
                lastErrorMessage = L10n.string("upgrade.products.unavailable")
            }
        } catch {
            lastErrorMessage = error.localizedDescription
        }
    }

    func purchasePro() async -> Bool {
        guard let product = products.first(where: { $0.id == Self.proLifetimeID }) else {
            lastErrorMessage = L10n.string("upgrade.products.unavailable")
            return false
        }

        isPurchasing = true
        lastErrorMessage = nil
        defer { isPurchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                await transaction.finish()
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
        lastErrorMessage = nil
        do {
            try await AppStore.sync()
            let hasPro = await refreshOwnedPro()
            if !hasPro {
                lastErrorMessage = L10n.string("upgrade.restore.none")
            }
            return hasPro
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
