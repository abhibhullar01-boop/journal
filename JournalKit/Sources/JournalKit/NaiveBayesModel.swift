import Foundation

/// A small multinomial Naive Bayes text model.
///
/// It is cheap enough to retrain on the phone every time the user corrects a
/// label, and its state is plain counts, so it can be saved as JSON and inspected.
public struct NaiveBayesModel: Codable, Equatable, Sendable {
    /// Total example weight seen per kind.
    public private(set) var exampleWeight: [String: Double] = [:]
    /// Feature counts per kind.
    private var featureCounts: [String: [String: Double]] = [:]
    /// Sum of feature counts per kind.
    private var totalFeatures: [String: Double] = [:]
    private var vocabulary: Set<String> = []
    /// Laplace smoothing.
    public var smoothing: Double = 1.0

    public init() {}

    public var vocabularySize: Int { vocabulary.count }

    public mutating func train(on samples: [LabeledSentence]) {
        for sample in samples {
            learn(sample.text, as: sample.label)
        }
    }

    /// Adds one example. A weight above 1 makes it count more than a seed example,
    /// which is how the user's own corrections take over from the baseline.
    public mutating func learn(_ text: String, as kind: InsightKind, weight: Double = 1.0) {
        let key = kind.rawValue
        exampleWeight[key, default: 0] += weight
        for feature in Tokenizer.features(text) {
            featureCounts[key, default: [:]][feature, default: 0] += weight
            totalFeatures[key, default: 0] += weight
            vocabulary.insert(feature)
        }
    }

    /// Probability of each kind. Priors are uniform on purpose, so a burst of
    /// corrections in one category doesn't make every sentence lean that way.
    public func probabilities(_ text: String) -> [InsightKind: Double] {
        let features = Tokenizer.features(text)
        let vocabularyCount = Double(vocabulary.count + 1)
        var logScores: [InsightKind: Double] = [:]
        for kind in InsightKind.allCases {
            let counts = featureCounts[kind.rawValue] ?? [:]
            let total = totalFeatures[kind.rawValue] ?? 0
            var score = 0.0
            for feature in features {
                score += log(((counts[feature] ?? 0) + smoothing) / (total + smoothing * vocabularyCount))
            }
            logScores[kind] = score
        }
        let maxScore = logScores.values.max() ?? 0
        var exponentials: [InsightKind: Double] = [:]
        for (kind, score) in logScores {
            exponentials[kind] = exp(score - maxScore)
        }
        let sum = exponentials.values.reduce(0, +)
        return exponentials.mapValues { $0 / sum }
    }
}
