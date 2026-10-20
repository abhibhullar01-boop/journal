import Foundation

/// Turns text into lowercase word tokens and n-gram features.
public enum Tokenizer {
    /// Lowercase words made of letters, digits and inner apostrophes.
    /// "Don't forget!" -> ["don't", "forget"]
    public static func words(_ text: String) -> [String] {
        let lowered = text.lowercased().replacingOccurrences(of: "\u{2019}", with: "'")
        var result: [String] = []
        var current = ""
        func flush() {
            let trimmed = current.trimmingCharacters(in: CharacterSet(charactersIn: "'"))
            if !trimmed.isEmpty { result.append(trimmed) }
            current = ""
        }
        for character in lowered {
            if character.isLetter || character.isNumber || character == "'" {
                current.append(character)
            } else {
                flush()
            }
        }
        flush()
        return result
    }

    /// Unigrams plus bigrams ("need to", "get better"). Bigrams carry most of the
    /// signal that separates "I need to call" (task) from "I need to work on my" (skill).
    public static func features(_ text: String) -> [String] {
        let tokens = words(text)
        guard tokens.count > 1 else { return tokens }
        var features = tokens
        for index in 0..<(tokens.count - 1) {
            features.append(tokens[index] + " " + tokens[index + 1])
        }
        return features
    }
}
