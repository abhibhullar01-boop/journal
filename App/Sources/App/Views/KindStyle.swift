import SwiftUI
import JournalKit

extension InsightKind {
    var symbol: String {
        switch self {
        case .task: return "checkmark.circle"
        case .skill: return "figure.mind.and.body"
        case .goal: return "flag.checkered"
        case .none: return "text.bubble"
        }
    }

    var tint: Color {
        switch self {
        case .task: return .blue
        case .skill: return .orange
        case .goal: return .green
        case .none: return .secondary
        }
    }

    var pluralName: String {
        switch self {
        case .task: return "Tasks"
        case .skill: return "Skills"
        case .goal: return "Goals"
        case .none: return "Reflections"
        }
    }
}

struct KindBadge: View {
    let kind: InsightKind
    var count: Int?

    var body: some View {
        Label {
            Text(count.map { "\($0)" } ?? kind.displayName)
        } icon: {
            Image(systemName: kind.symbol)
        }
        .font(.caption.weight(.semibold))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .foregroundStyle(kind.tint)
        .background(kind.tint.opacity(0.12), in: Capsule())
    }
}
