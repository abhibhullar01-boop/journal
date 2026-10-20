import Foundation

/// Splits a journal entry into sentences, including run-on dictation such as
/// "I went to the gym and I need to call mom and my goal is to run a marathon".
public enum SentenceSplitter {
    static let connectors: Set<String> = ["and", "but", "so", "also", "then", "plus", "oh"]
    /// Words that start a new thought after a connector: "...and I...", "...and someday...".
    static let subjects: Set<String> = [
        "i", "i'm", "im", "i've", "ive", "i'll", "ill", "i'd", "my", "remember", "don't", "need",
        "someday", "eventually", "tomorrow", "tonight", "later",
    ]

    public static func split(_ text: String) -> [String] {
        punctuationChunks(text)
            .flatMap(splitRunOn)
            .filter { chunk in chunk.contains(where: { $0.isLetter }) }
    }

    /// Splits on . ! ? ; and new lines, leaving "p.m.", "3.30" and "Dr. Lee" alone.
    static func punctuationChunks(_ text: String) -> [String] {
        let characters = Array(text.replacingOccurrences(of: "\u{2019}", with: "'"))
        var chunks: [String] = []
        var current = ""

        func push() {
            let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { chunks.append(trimmed) }
            current = ""
        }

        for (index, character) in characters.enumerated() {
            switch character {
            case "\n", ";":
                push()
            case "!", "?":
                current.append(character)
                push()
            case ".":
                current.append(character)
                let nextIsBoundary = index + 1 >= characters.count || characters[index + 1].isWhitespace
                let lastWord = current.split(separator: " ").last.map(String.init) ?? ""
                // "p.m." / "e.g." contain another dot; "Dr." / "Mr." are short title-case words.
                let isAbbreviation = lastWord.dropLast().contains(".")
                    || ["dr.", "mr.", "mrs.", "ms.", "st.", "vs."].contains(lastWord.lowercased())
                if nextIsBoundary && !isAbbreviation { push() }
            default:
                current.append(character)
            }
        }
        push()
        return chunks
    }

    /// Breaks "... and I ..." / "... but my ..." into separate sentences.
    static func splitRunOn(_ chunk: String) -> [String] {
        let words = chunk.split(separator: " ").map(String.init)
        guard words.count > 5 else { return [chunk] }

        var sentences: [String] = []
        var current: [String] = []
        var index = 0
        while index < words.count {
            let word = clean(words[index])
            let next = index + 1 < words.count ? clean(words[index + 1]) : ""
            if connectors.contains(word), subjects.contains(next), current.count >= 3 {
                sentences.append(current.joined(separator: " "))
                current = []
                index += 1 // drop the connector
                continue
            }
            current.append(words[index])
            index += 1
        }
        if !current.isEmpty { sentences.append(current.joined(separator: " ")) }
        return sentences.map { $0.trimmingCharacters(in: CharacterSet(charactersIn: " ,")) }
    }

    static func clean(_ word: String) -> String {
        Tokenizer.words(word).first ?? ""
    }
}
