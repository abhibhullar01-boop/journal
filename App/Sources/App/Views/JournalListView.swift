import SwiftData
import SwiftUI
import JournalKit

struct JournalListView: View {
    @Environment(AppRouter.self) private var router
    @Environment(\.modelContext) private var context
    @Query(sort: \JournalEntry.createdAt, order: .reverse) private var entries: [JournalEntry]

    var body: some View {
        NavigationStack {
            List {
                ForEach(entries) { entry in
                    NavigationLink(value: entry) {
                        EntryRow(entry: entry)
                    }
                }
                .onDelete(perform: delete)
            }
            .overlay {
                if entries.isEmpty {
                    ContentUnavailableView(
                        "Say what's on your mind",
                        systemImage: "waveform",
                        description: Text("Tap Speak and talk about your day. Tasks, skills and goals get pulled out automatically.")
                    )
                }
            }
            .navigationTitle("Journal")
            .navigationDestination(for: JournalEntry.self) { EntryDetailView(entry: $0) }
            .safeAreaInset(edge: .bottom) { captureBar }
        }
    }

    private var captureBar: some View {
        HStack(spacing: 12) {
            Button {
                router.pendingCapture = .voice
            } label: {
                Label("Speak", systemImage: "mic.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            Button {
                router.pendingCapture = .text
            } label: {
                Label("Write", systemImage: "square.and.pencil")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .controlSize(.large)
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            let entry = entries[index]
            entry.items.forEach { ReminderScheduler.shared.cancel($0) }
            context.delete(entry)
        }
        try? context.save()
    }
}

struct EntryRow: View {
    let entry: JournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: entry.isVoice ? "waveform" : "text.alignleft")
                    .foregroundStyle(.secondary)
                Text(entry.createdAt, format: .dateTime.weekday(.wide).day().month().hour().minute())
                    .font(.subheadline.weight(.semibold))
            }
            Text(entry.text)
                .lineLimit(2)
                .foregroundStyle(.secondary)
            HStack(spacing: 6) {
                ForEach(InsightKind.trackable, id: \.self) { kind in
                    let count = entry.count(of: kind)
                    if count > 0 {
                        KindBadge(kind: kind, count: count)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    JournalListView()
        .modelContainer(PreviewData.container)
        .environment(AnalyzerStore())
        .environment(AppRouter.shared)
}
