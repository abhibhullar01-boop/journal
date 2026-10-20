import Foundation

/// The brain of the app: splits an entry into sentences, classifies each one as
/// a task, skill, goal or reflection, and pulls out titles and reminder times.
///
/// It blends two signals:
/// - a Naive Bayes model trained on seed sentences (and later on the user's own corrections)
/// - hand-written cue phrases, which keep it sensible on unfamiliar phrasing
public struct JournalAnalyzer: Codable, Equatable, Sendable {
    public var model: NaiveBayesModel
    /// How much the cue phrases count against the learned model (0...1).
    public var ruleWeight: Double
    /// Number of corrections the user has taught it.
    public private(set) var personalExamples: Int

    /// Corrections count this many times more than a seed sentence.
    public static let correctionWeight = 3.0

    public init(model: NaiveBayesModel, ruleWeight: Double = 0.35) {
        self.model = model
        self.ruleWeight = ruleWeight
        self.personalExamples = 0
    }

    /// A fresh model trained on the bundled seed data.
    public static func baseline() throws -> JournalAnalyzer {
        var model = NaiveBayesModel()
        model.train(on: try SeedData.training())
        return JournalAnalyzer(model: model)
    }

    public func classify(_ sentence: String) -> Classification {
        let learned = model.probabilities(sentence)
        let rules = RuleClassifier.distribution(sentence)
        var combined: [InsightKind: Double] = [:]
        for kind in InsightKind.allCases {
            combined[kind] = (1 - ruleWeight) * (learned[kind] ?? 0) + ruleWeight * (rules[kind] ?? 0)
        }
        // Ties resolve in declaration order, so the result is deterministic.
        let best = InsightKind.allCases.max { (combined[$0] ?? 0) < (combined[$1] ?? 0) } ?? .none
        return Classification(kind: best, confidence: combined[best] ?? 0, scores: combined)
    }

    /// Every trackable item in a journal entry, in the order it was said.
    public func analyze(_ entry: String, now: Date = Date(), calendar: Calendar = .current) -> [ExtractedInsight] {
        let dates = DueDateParser(calendar: calendar)
        return SentenceSplitter.split(entry).compactMap { sentence in
            let result = classify(sentence)
            guard result.kind != .none else { return nil }
            return ExtractedInsight(
                kind: result.kind,
                title: TitleCleaner.title(for: sentence),
                sentence: sentence,
                confidence: result.confidence,
                dueDate: result.kind == .task ? dates.dueDate(in: sentence, now: now) : nil
            )
        }
    }

    /// Teach it the right answer for a sentence it got wrong (or confirm one it got right).
    public mutating func learn(_ sentence: String, as kind: InsightKind) {
        model.learn(sentence, as: kind, weight: Self.correctionWeight)
        personalExamples += 1
    }
}
