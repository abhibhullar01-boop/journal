import Foundation

/// The categories a journal sentence can fall into.
public enum InsightKind: String, Codable, CaseIterable, Sendable, Hashable {
    /// A concrete, short-horizon action ("call mom tomorrow").
    case task
    /// An ability being built or practised ("get better at public speaking").
    case skill
    /// A long-horizon outcome ("run a marathon someday").
    case goal
    /// Reflection, feelings, events: nothing to track.
    case none

    /// The kinds that become tracked items in the app.
    public static let trackable: [InsightKind] = [.task, .skill, .goal]

    public var displayName: String {
        switch self {
        case .task: return "Task"
        case .skill: return "Skill"
        case .goal: return "Goal"
        case .none: return "Reflection"
        }
    }
}

/// One training or evaluation example.
public struct LabeledSentence: Codable, Equatable, Sendable {
    public var text: String
    public var label: InsightKind

    public init(text: String, label: InsightKind) {
        self.text = text
        self.label = label
    }
}

/// The classifier's verdict for one sentence.
public struct Classification: Equatable, Sendable {
    public var kind: InsightKind
    /// Combined score of the winning kind, between 0 and 1.
    public var confidence: Double
    /// Combined score for every kind (sums to 1).
    public var scores: [InsightKind: Double]
}

/// A trackable item pulled out of a journal entry.
public struct ExtractedInsight: Codable, Hashable, Sendable {
    public var kind: InsightKind
    /// Short, cleaned-up title, e.g. "Call mom tomorrow".
    public var title: String
    /// The sentence it came from, as spoken or typed.
    public var sentence: String
    public var confidence: Double
    /// When a reminder makes sense (tasks with a time cue only).
    public var dueDate: Date?

    public init(kind: InsightKind, title: String, sentence: String, confidence: Double, dueDate: Date? = nil) {
        self.kind = kind
        self.title = title
        self.sentence = sentence
        self.confidence = confidence
        self.dueDate = dueDate
    }
}
