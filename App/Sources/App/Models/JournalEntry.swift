import Foundation
import SwiftData
import JournalKit

@Model
final class JournalEntry {
    var createdAt: Date
    var text: String
    /// "voice" or "text".
    var source: String
    @Relationship(deleteRule: .cascade, inverse: \TrackedItem.entry)
    var items: [TrackedItem] = []

    init(text: String, source: CaptureMode, createdAt: Date = .now) {
        self.text = text
        self.source = source.rawValue
        self.createdAt = createdAt
    }

    var isVoice: Bool { source == CaptureMode.voice.rawValue }

    func count(of kind: InsightKind) -> Int {
        items.filter { $0.kind == kind }.count
    }
}

/// A task, skill or goal found in an entry.
@Model
final class TrackedItem {
    /// Stable id used to find the item from a notification.
    var uid: UUID
    var kindRaw: String
    var title: String
    var sentence: String
    var confidence: Double
    var dueDate: Date?
    var isDone: Bool
    var completedAt: Date?
    var createdAt: Date
    /// True once the user has confirmed or corrected the category.
    var userConfirmed: Bool
    var entry: JournalEntry?

    init(_ insight: ExtractedInsight, createdAt: Date = .now) {
        self.uid = UUID()
        self.kindRaw = insight.kind.rawValue
        self.title = insight.title
        self.sentence = insight.sentence
        self.confidence = insight.confidence
        self.dueDate = insight.dueDate
        self.isDone = false
        self.createdAt = createdAt
        self.userConfirmed = false
    }

    var kind: InsightKind {
        get { InsightKind(rawValue: kindRaw) ?? .none }
        set { kindRaw = newValue.rawValue }
    }

    var isOverdue: Bool {
        guard let dueDate, !isDone else { return false }
        return dueDate < .now
    }
}
