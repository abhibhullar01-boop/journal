import Foundation

/// How well a classifier does on a labelled set.
public struct EvaluationReport: Sendable {
    public struct Miss: Sendable {
        public var text: String
        public var expected: InsightKind
        public var predicted: InsightKind
    }

    public var total: Int
    public var correct: Int
    public var perKind: [InsightKind: (correct: Int, total: Int)]
    public var misses: [Miss]

    public var accuracy: Double { total == 0 ? 0 : Double(correct) / Double(total) }

    public var summary: String {
        let percent = (accuracy * 1000).rounded() / 10
        var lines = ["Accuracy: \(percent)% (\(correct)/\(total))"]
        for kind in InsightKind.allCases {
            if let stats = perKind[kind] {
                lines.append("  \(kind.displayName): \(stats.correct)/\(stats.total)")
            }
        }
        for miss in misses {
            lines.append("  miss: expected \(miss.expected.rawValue), got \(miss.predicted.rawValue): \(miss.text)")
        }
        return lines.joined(separator: "\n")
    }
}

public enum Evaluator {
    public static func evaluate(_ analyzer: JournalAnalyzer, on samples: [LabeledSentence]) -> EvaluationReport {
        var report = EvaluationReport(total: 0, correct: 0, perKind: [:], misses: [])
        for sample in samples {
            let predicted = analyzer.classify(sample.text).kind
            var stats = report.perKind[sample.label] ?? (0, 0)
            stats.total += 1
            report.total += 1
            if predicted == sample.label {
                stats.correct += 1
                report.correct += 1
            } else {
                report.misses.append(.init(text: sample.text, expected: sample.label, predicted: predicted))
            }
            report.perKind[sample.label] = stats
        }
        return report
    }
}
