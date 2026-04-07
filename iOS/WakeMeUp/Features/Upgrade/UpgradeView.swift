import SwiftUI
import StoreKit

struct UpgradeView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    private var monetization: MonetizationService {
        model.monetizationService
    }

    private var product: Product? {
        monetization.products.first
    }

    private var canPurchase: Bool {
        product != nil && !monetization.isPurchasing
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(L10n.string("upgrade.title"))
                    .font(.largeTitle.bold())

                Text(L10n.string("upgrade.subtitle"))
                    .foregroundStyle(.secondary)

                comparisonCard(
                    title: L10n.string("upgrade.free.title"),
                    body: L10n.string("upgrade.free.body")
                )

                comparisonCard(
                    title: L10n.string("upgrade.pro.title"),
                    body: L10n.string("upgrade.pro.body")
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text(L10n.string("upgrade.feature_list"))
                        .font(.headline)

                    featureRow("bell.badge", L10n.string("upgrade.feature.notifications"))
                    featureRow("person.2.fill", L10n.string("upgrade.feature.contacts"))
                    featureRow("clock.badge.exclamationmark", L10n.string("upgrade.feature.history"))
                    featureRow("square.and.arrow.up", L10n.string("upgrade.feature.export"))
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))

                if let product {
                    Text(L10n.format("upgrade.price", product.displayPrice))
                        .font(.title3.weight(.semibold))
                } else if monetization.isLoadingProducts {
                    Label(L10n.string("upgrade.products.loading"), systemImage: "hourglass")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    Label(L10n.string("upgrade.products.unavailable"), systemImage: "exclamationmark.triangle")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Button(L10n.string("upgrade.buy")) {
                    Task {
                        await model.purchasePro()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canPurchase)

                Button(L10n.string("upgrade.restore")) {
                    Task {
                        await model.restorePurchases()
                    }
                }
                .buttonStyle(.bordered)
                .disabled(monetization.isPurchasing)

                if let message = model.purchaseMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Text(product == nil ? L10n.string("upgrade.testing_note") : L10n.string("upgrade.ready_note"))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(20)
        }
        .navigationTitle(L10n.string("actions.upgrade"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(L10n.string("actions.close")) {
                    dismiss()
                }
            }
        }
    }

    private func comparisonCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            Text(body)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func featureRow(_ systemImage: String, _ title: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .foregroundStyle(.red)
            Text(title)
                .font(.subheadline)
            Spacer()
        }
    }
}
