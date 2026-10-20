import Foundation

/// Turns a spoken sentence into a short item title:
/// "Um, I really need to call mom tomorrow." -> "Call mom tomorrow"
public enum TitleCleaner {
    static let fillers: Set<String> = ["um", "uh", "so", "and", "also", "okay", "ok", "well", "oh", "then", "plus", "anyway", "basically"]

    /// Lead-ins to drop, longest first so "i really need to" wins over "i need to".
    static let leadIns: [[String]] = [
        "one of my goals is to", "my long-term plan is to", "my long term plan is to",
        "over the next few years i want to", "this year my goal is to", "my big goal is to",
        "someday i want to", "one day i want to", "one day i'd love to", "eventually i want to",
        "long term i want to", "in five years i want to", "i'd love to one day",
        "i really want to get good at", "i really need to", "i really want to",
        "i want to get better at", "i want to build my skills in", "i'm trying to improve my",
        "i need to work on my", "i'm working on my", "i want to improve at",
        "don't forget to", "make sure i", "note to self", "reminder to", "remember to", "remind me to",
        "i still need to", "i need to", "i have to", "i've got to", "i got to", "i gotta",
        "i should", "i must", "need to", "have to", "got to", "gotta",
        "my goal is to", "my goal is", "my dream is to", "i aspire to", "i hope to",
        "i plan to", "i'm going to", "i am going to", "i will", "i'll", "i wanna",
        "i'd like to", "i would like to", "i'd love to", "i would love to", "i want to",
        "i'm", "i've been",
    ].map { $0.split(separator: " ").map(String.init) }

    public static func title(for sentence: String) -> String {
        var words = sentence
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)

        var changed = true
        while changed && !words.isEmpty {
            changed = false
            // "long-term," -> "long-term", "Don't" -> "don't"
            let lowered = words.map { Tokenizer.words($0).joined(separator: "-") }
            if let first = lowered.first, fillers.contains(first), words.count > 1 {
                words.removeFirst()
                changed = true
                continue
            }
            for leadIn in leadIns where leadIn.count < words.count {
                if Array(lowered.prefix(leadIn.count)) == leadIn {
                    words.removeFirst(leadIn.count)
                    changed = true
                    break
                }
            }
        }

        var title = words.joined(separator: " ")
            .trimmingCharacters(in: CharacterSet(charactersIn: " ,.!?;:"))
        if let first = title.first {
            title = first.uppercased() + title.dropFirst()
        }
        return title.isEmpty ? sentence : title
    }
}
