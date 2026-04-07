import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            if model.history.isEmpty {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(L10n.string("history.empty.title"))
                            .font(.headline)
                        Text(L10n.string("history.empty.body"))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            } else {
                ForEach(model.history) { item in
                    Section {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(L10n.string(item.endReason.titleKey))
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.secondary.opacity(0.12), in: Capsule())
                                Spacer()
                                Text(L10n.formatTargetTime(item.endedAt))
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }

                            Text(item.summary)
                                .font(.headline)

                            historyRow(L10n.string("dashboard.summary.total"), L10n.formatGrams(item.totalAlcoholGrams))
                            historyRow(L10n.string("history.peak_bac"), String(format: "%.3f", item.peakBAC))
                            historyRow(L10n.string("dashboard.summary.sober_at"), L10n.formatTargetTime(item.soberAt))
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
        }
        .navigationTitle(L10n.string("history.title"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(L10n.string("actions.close")) {
                    dismiss()
                }
            }
        }
    }

    private func historyRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
        .font(.subheadline)
    }
}

