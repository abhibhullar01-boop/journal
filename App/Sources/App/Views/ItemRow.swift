import SwiftData
import SwiftUI
import JournalKit

/// One task, skill or goal, with a check-off button and a category menu.
struct ItemRow: View {
    @Bindable var item: TrackedItem
    var showsCheckbox = true
    var showsCategoryMenu = false

    @Environment(\.modelContext) private var context
    @Environment(AnalyzerStore.self) private var store

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if showsCheckbox {
                Button(action: toggle) {
                    Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(item.isDone ? Color.secondary : item.kind.tint)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.isDone ? "Mark not done" : "Mark done")
            } else {
                Image(systemName: item.kind.symbol)
                    .font(.title3)
                    .foregroundStyle(item.kind.tint)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .strikethrough(item.isDone)
                    .foregroundStyle(item.isDone ? .secondary : .primary)
                if let due = item.dueDate, item.kind == .task {
                    Label(due.formatted(.relative(presentation: .named)), systemImage: "bell")
                        .font(.caption)
                        .foregroundStyle(item.isOverdue ? Color.red : Color.secondary)
                }
            }

            Spacer(minLength: 0)

            if showsCategoryMenu {
                categoryMenu
            }
        }
        .contextMenu { categoryButtons }
    }

    private var categoryMenu: some View {
        Menu {
            categoryButtons
        } label: {
            KindBadge(kind: item.kind)
        }
    }

    @ViewBuilder
    private var categoryButtons: some View {
        Section("This is a…") {
            ForEach(InsightKind.allCases, id: \.self) { kind in
                Button {
                    if kind == item.kind {
                        store.confirm(item)
                    } else {
                        withAnimation { store.correct(item, to: kind, in: context) }
                    }
                } label: {
                    Label(kind == .none ? "Not trackable" : kind.displayName,
                          systemImage: kind == item.kind ? "checkmark" : kind.symbol)
                }
            }
        }
    }

    private func toggle() {
        withAnimation {
            item.isDone.toggle()
            item.completedAt = item.isDone ? .now : nil
        }
        if item.isDone {
            ReminderScheduler.shared.cancel(item)
        } else {
            ReminderScheduler.shared.schedule(item)
        }
        try? context.save()
    }
}
