import Foundation
import Observation
import SwiftData
import JournalKit

/// Owns the on-device classifier: loads the personalised copy if there is one,
/// turns entries into tracked items, and learns from corrections.
@MainActor
@Observable
final class AnalyzerStore {
    private(set) var analyzer: JournalAnalyzer
    private(set) var problem: String?

    init() {
        if let data = try? Data(contentsOf: Self.fileURL),
           let saved = try? JSONDecoder().decode(JournalAnalyzer.self, from: data) {
            analyzer = saved
            problem = nil
        } else {
            do {
                analyzer = try JournalAnalyzer.baseline()
                problem = nil
            } catch {
                analyzer = JournalAnalyzer(model: NaiveBayesModel())
                problem = "Couldn't load the built-in training data: \(error.localizedDescription)"
            }
        }
    }

    static var fileURL: URL {
        URL.applicationSupportDirectory.appending(path: "personal-model.json")
    }

    var personalExamples: Int { analyzer.personalExamples }

    /// Classifies a new entry, attaches the items and schedules any reminders.
    @discardableResult
    func process(_ entry: JournalEntry, in context: ModelContext) -> [TrackedItem] {
        for old in entry.items {
            ReminderScheduler.shared.cancel(old)
            context.delete(old)
        }
        let items = analyzer.analyze(entry.text, now: entry.createdAt).map { insight in
            let item = TrackedItem(insight, createdAt: entry.createdAt)
            item.entry = entry
            context.insert(item)
            return item
        }
        try? context.save()
        Task { await ReminderScheduler.shared.schedule(items) }
        return items
    }

    /// Moves an item to another category and teaches the model.
    func correct(_ item: TrackedItem, to kind: InsightKind, in context: ModelContext) {
        analyzer.learn(item.sentence, as: kind)
        save()
        if kind == .none {
            ReminderScheduler.shared.cancel(item)
            context.delete(item)
        } else {
            item.kind = kind
            item.userConfirmed = true
            item.dueDate = kind == .task ? DueDateParser().dueDate(in: item.sentence, now: item.createdAt) : nil
            ReminderScheduler.shared.schedule(item)
        }
        try? context.save()
    }

    /// The category was right: reinforce it.
    func confirm(_ item: TrackedItem) {
        guard !item.userConfirmed else { return }
        analyzer.learn(item.sentence, as: item.kind)
        item.userConfirmed = true
        save()
    }

    func resetPersonalization() {
        try? FileManager.default.removeItem(at: Self.fileURL)
        if let fresh = try? JournalAnalyzer.baseline() { analyzer = fresh }
    }

    func evaluate() -> EvaluationReport? {
        guard let samples = try? SeedData.evaluation() else { return nil }
        return Evaluator.evaluate(analyzer, on: samples)
    }

    private func save() {
        do {
            try FileManager.default.createDirectory(at: URL.applicationSupportDirectory, withIntermediateDirectories: true)
            try JSONEncoder().encode(analyzer).write(to: Self.fileURL, options: .atomic)
        } catch {
            problem = "Couldn't save what the model learned: \(error.localizedDescription)"
        }
    }
}
