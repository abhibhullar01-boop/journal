import Foundation

/// Hand-written cue phrases. They give the model sensible behaviour on phrasing
/// the seed data never covered, and they are easy to read and tweak.
public enum RuleClassifier {
    public typealias Cue = (phrase: String, weight: Double)

    public static let cues: [InsightKind: [Cue]] = [
        .task: [
            ("need to", 1.0), ("have to", 1.0), ("has to", 1.0), ("got to", 1.0), ("gotta", 1.0),
            ("must", 0.8), ("should", 0.6), ("remember to", 1.5), ("remind me", 1.5),
            ("don't forget", 1.5), ("forget to", 1.0), ("to do", 1.0), ("todo", 1.5),
            ("note to self", 1.0), ("make sure", 0.8),
            ("tomorrow", 1.0), ("tonight", 1.0), ("today", 0.3), ("this afternoon", 1.0),
            ("this weekend", 0.7), ("next week", 0.7), ("by friday", 1.0), ("by monday", 1.0),
            ("on monday", 0.7), ("on tuesday", 0.7), ("on wednesday", 0.7), ("on thursday", 0.7),
            ("on friday", 0.7), ("on saturday", 0.7), ("on sunday", 0.7), ("end of day", 1.0),
            ("call", 0.6), ("email", 0.6), ("text", 0.4), ("buy", 0.6), ("pick up", 0.7),
            ("book", 0.5), ("schedule", 0.6), ("submit", 0.7), ("pay", 0.6), ("send", 0.6),
            ("reply", 0.6), ("order", 0.5), ("return", 0.5), ("renew", 0.6), ("cancel", 0.6),
            ("clean", 0.4), ("fix", 0.4),
        ],
        .skill: [
            ("learn", 1.5), ("learning", 1.5), ("practice", 1.5), ("practicing", 1.5),
            ("practiced", 1.5), ("get better at", 2.0), ("getting better at", 2.0),
            ("improve my", 1.5), ("improving", 1.0), ("skill", 1.5), ("skills", 1.5),
            ("course", 1.0), ("lesson", 1.0), ("class", 0.6), ("tutorial", 1.0), ("study", 1.0),
            ("studying", 1.0), ("master", 1.0), ("get good at", 2.0), ("work on my", 1.2),
            ("working on my", 1.2), ("how to", 0.5),
        ],
        .goal: [
            ("goal", 2.0), ("goals", 2.0), ("dream", 2.0), ("someday", 2.0), ("one day", 1.5),
            ("eventually", 1.5), ("long term", 1.5), ("aspire", 2.0), ("years", 1.0),
            ("decade", 1.5), ("by next year", 1.5), ("this year", 0.8), ("before i turn", 1.5),
            ("i'd love to", 0.7), ("hope to", 0.8), ("become", 1.0), ("future", 1.0),
            ("plan is", 1.0), ("retire", 1.0), ("vision", 1.0),
        ],
    ]

    /// Sum of matched cue weights per trackable kind.
    public static func scores(_ text: String) -> [InsightKind: Double] {
        let padded = " " + Tokenizer.words(text).joined(separator: " ") + " "
        var result: [InsightKind: Double] = [:]
        for (kind, kindCues) in cues {
            result[kind] = kindCues.reduce(0) { sum, cue in
                padded.contains(" " + cue.phrase + " ") ? sum + cue.weight : sum
            }
        }
        return result
    }

    /// Scores turned into a distribution. "none" gets a fixed base weight, so a
    /// sentence with no cues at all leans towards "none".
    public static func distribution(_ text: String) -> [InsightKind: Double] {
        var raw = scores(text)
        raw[.none] = 1.0
        let total = raw.values.reduce(0, +)
        return raw.mapValues { $0 / total }
    }
}
