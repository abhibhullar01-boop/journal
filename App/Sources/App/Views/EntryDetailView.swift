import SwiftData
import SwiftUI
import JournalKit

struct EntryDetailView: View {
    @Bindable var entry: JournalEntry
    @Environment(\.modelContext) private var context
    @Environment(AnalyzerStore.self) private var store

    var body: some View {
        List {
            Section {
                Text(entry.text)
                    .textSelection(.enabled)
            } header: {
                Label(entry.isVoice ? "Spoken" : "Written", systemImage: entry.isVoice ? "waveform" : "text.alignleft")
            }

            Section {
                if entry.items.isEmpty {
                    Text("Nothing to track in this entry.")
                        .foregroundStyle(.secondary)
                }
                ForEach(entry.items.sorted { $0.createdAt < $1.createdAt || ($0.createdAt == $1.createdAt && $0.sentence < $1.sentence) }) { item in
                    ItemRow(item: item, showsCategoryMenu: true)
                }
            } header: {
                Text("Found in this entry")
            } footer: {
                Text("Tap a category to fix it. Each fix teaches the model on your iPhone.")
            }
        }
        .navigationTitle(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Button("Re-analyze", systemImage: "arrow.triangle.2.circlepath") {
                withAnimation { _ = store.process(entry, in: context) }
            }
        }
    }
}
