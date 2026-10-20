import Foundation

/// The labelled sentences that ship with the app.
/// Regenerate them with `python3 tools/generate_seed_data.py`.
public enum SeedData {
    public enum LoadError: Error {
        case missingResource(String)
    }

    /// Used to train the baseline model.
    public static func training() throws -> [LabeledSentence] {
        try load("seed_training")
    }

    /// Hand-written, never trained on. Used to measure accuracy.
    public static func evaluation() throws -> [LabeledSentence] {
        try load("seed_evaluation")
    }

    static func load(_ name: String) throws -> [LabeledSentence] {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json") else {
            throw LoadError.missingResource(name)
        }
        return try JSONDecoder().decode([LabeledSentence].self, from: Data(contentsOf: url))
    }
}
