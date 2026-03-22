import SwiftUI

struct UpgradeView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

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

                if let product = model.monetizationService.products.first {
                    Text(L10n.format("upgrade.price", product.displayPrice))
                        .font(.title3.weight(.semibold))
                }

                Button(L10n.string("upgrade.buy")) {
                    Task {
                        await model.purchasePro()
                    }
                }
                .buttonStyle(.borderedProminent)

                Button(L10n.string("upgrade.restore")) {
                    Task {
                        await model.restorePurchases()
                    }
                }
                .buttonStyle(.bordered)

                if let message = model.purchaseMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
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
}

