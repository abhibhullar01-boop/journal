import SwiftData
import SwiftUI
import JournalKit

/// Everything pulled out of the journal: tasks to check off, skills being built, goals.
struct TrackerView: View {
    @State private var kind: InsightKind = .task
    @Query(sort: \TrackedItem.createdAt, order: .reverse) private var items: [TrackedItem]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Category", selection: $kind) {
                        ForEach(InsightKind.trackable, id: \.self) { Text($0.pluralName).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                switch kind {
                case .task: taskSections
                case .skill: skillSections
                default: goalSections
                }
            }
            .navigationTitle("Tracker")
            .overlay {
                if filtered(kind).isEmpty {
                    ContentUnavailableView(
                        "No \(kind.pluralName.lowercased()) yet",
                        systemImage: kind.symbol,
                        description: Text(emptyHint)
                    )
                }
            }
        }
    }

    private func filtered(_ kind: InsightKind) -> [TrackedItem] {
        items.filter { $0.kind == kind }
    }

    private var emptyHint: String {
        switch kind {
        case .task: return "Try saying \u{201C}I need to call mom tomorrow.\u{201D}"
        case .skill: return "Try saying \u{201C}I want to get better at public speaking.\u{201D}"
        default: return "Try saying \u{201C}Someday I want to run a marathon.\u{201D}"
        }
    }

    @ViewBuilder
    private var taskSections: some View {
        let tasks = filtered(.task)
        let open = tasks.filter { !$0.isDone }.sorted(by: Self.dueOrder)
        let done = tasks.filter(\.isDone).sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
        if !open.isEmpty {
            Section("To do") {
                ForEach(open) { ItemRow(item: $0) }
            }
        }
        if !done.isEmpty {
            Section("Done") {
                ForEach(done.prefix(30)) { ItemRow(item: $0) }
            }
        }
    }

    /// Skills grouped by title, with how often they come up.
    @ViewBuilder
    private var skillSections: some View {
        let groups = Dictionary(grouping: filtered(.skill)) { $0.title.lowercased() }
            .values
            .sorted { $0.count > $1.count || ($0.count == $1.count && ($0.first?.createdAt ?? .distantPast) > ($1.first?.createdAt ?? .distantPast)) }
        if !groups.isEmpty {
            Section("Skills you're building") {
                ForEach(groups, id: \.first!.uid) { group in
                    HStack {
                        ItemRow(item: group[0], showsCheckbox: false)
                        Text(group.count == 1 ? "1 mention" : "\(group.count) mentions")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var goalSections: some View {
        let goals = filtered(.goal)
        let active = goals.filter { !$0.isDone }
        let reached = goals.filter(\.isDone)
        if !active.isEmpty {
            Section("Working towards") {
                ForEach(active) { ItemRow(item: $0) }
            }
        }
        if !reached.isEmpty {
            Section("Reached") {
                ForEach(reached) { ItemRow(item: $0) }
            }
        }
    }

    /// Dated tasks first (soonest first), then undated ones (newest first).
    static func dueOrder(_ a: TrackedItem, _ b: TrackedItem) -> Bool {
        switch (a.dueDate, b.dueDate) {
        case let (x?, y?): return x < y
        case (_?, nil): return true
        case (nil, _?): return false
        case (nil, nil): return a.createdAt > b.createdAt
        }
    }
}

#Preview {
    TrackerView()
        .modelContainer(PreviewData.container)
        .environment(AnalyzerStore())
}
