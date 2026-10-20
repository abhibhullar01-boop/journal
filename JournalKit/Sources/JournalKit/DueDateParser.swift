import Foundation

/// Finds a reminder time in phrases like "tomorrow", "tonight", "by Friday",
/// "at 5 pm", "next week" or "this weekend". Returns nil when there is no time cue.
public struct DueDateParser: Sendable {
    public var calendar: Calendar
    /// Hour used when a day is mentioned without a time.
    public var defaultHour = 9

    public init(calendar: Calendar = .current) {
        self.calendar = calendar
    }

    static let weekdays: [String: Int] = [
        "sunday": 1, "monday": 2, "tuesday": 3, "wednesday": 4,
        "thursday": 5, "friday": 6, "saturday": 7,
    ]

    public func dueDate(in sentence: String, now: Date = Date()) -> Date? {
        let words = Tokenizer.words(sentence)
        let text = " " + words.joined(separator: " ") + " "
        func has(_ phrase: String) -> Bool { text.contains(" " + phrase + " ") }

        let today = calendar.startOfDay(for: now)
        var day: Date?
        var hour: Int?
        var minute = 0

        // Day.
        if has("tomorrow") || has("first thing in the morning") {
            day = addDays(1, to: today)
        } else if has("tonight") || has("today") || has("this afternoon") || has("this evening") || has("end of day") || has("later") {
            day = today
        } else if has("this weekend") || has("weekend") {
            day = next(weekday: 7, after: today)
            hour = 10
        } else if has("next week") {
            day = next(weekday: 2, after: today)
        } else if let weekday = words.compactMap({ Self.weekdays[$0] }).first {
            day = next(weekday: weekday, after: today)
        }

        // Part of day.
        if has("tonight") || has("evening") || has("night") {
            hour = 19
        } else if has("afternoon") {
            hour = 14
        } else if has("morning") {
            hour = 8
        } else if has("end of day") || has("later today") || has("later") {
            hour = 17
        } else if has("lunch") || has("noon") {
            hour = 12
        }

        // Explicit clock time: "at 5", "at 5 pm", "at 3 30", "5pm", "10am".
        if let clock = clockTime(in: words) {
            hour = clock.hour
            minute = clock.minute
            if day == nil { day = today }
        }

        guard let chosenDay = day else { return nil }
        var components = DateComponents()
        components.hour = hour ?? defaultHour
        components.minute = minute
        guard var date = calendar.date(byAdding: components, to: chosenDay) else { return nil }

        // A time that has already passed today moves to tomorrow (or an hour from now for "today").
        if date <= now {
            if chosenDay == today && (has("today") || has("tonight") || has("later") || has("end of day")) {
                date = now.addingTimeInterval(3600)
            } else if chosenDay == today, let tomorrow = addDays(1, to: date) {
                date = tomorrow
            }
        }
        return date
    }

    func clockTime(in words: [String]) -> (hour: Int, minute: Int)? {
        for (index, word) in words.enumerated() {
            var hourText: String?
            var suffix: String?
            var cursor = index + 1

            if word == "at", index + 1 < words.count, Int(words[index + 1]) != nil {
                hourText = words[index + 1]
                cursor = index + 2
            } else if word.hasSuffix("pm") || word.hasSuffix("am"), Int(word.dropLast(2)) != nil {
                hourText = String(word.dropLast(2))
                suffix = String(word.suffix(2))
            }
            guard let rawHour = hourText.flatMap({ Int($0) }), (0...23).contains(rawHour) else { continue }

            var minute = 0
            if cursor < words.count, words[cursor].count == 2, let value = Int(words[cursor]), value < 60 {
                minute = value
                cursor += 1
            }
            if suffix == nil, cursor < words.count {
                let next = words[cursor]
                if next == "pm" || next == "am" {
                    suffix = next
                } else if (next == "p" || next == "a"), cursor + 1 < words.count, words[cursor + 1] == "m" {
                    suffix = next + "m"
                }
            }

            var hour = rawHour
            switch suffix {
            case "pm": if hour < 12 { hour += 12 }
            case "am": if hour == 12 { hour = 0 }
            default:
                // No am/pm: 1 to 6 almost always means afternoon in a journal.
                if (1...6).contains(hour) { hour += 12 }
            }
            return (hour, minute)
        }
        return nil
    }

    func addDays(_ days: Int, to date: Date) -> Date? {
        calendar.date(byAdding: .day, value: days, to: date)
    }

    /// The next given weekday strictly after `date` (1 = Sunday ... 7 = Saturday).
    func next(weekday: Int, after date: Date) -> Date? {
        let current = calendar.component(.weekday, from: date)
        var delta = (weekday - current + 7) % 7
        if delta == 0 { delta = 7 }
        return addDays(delta, to: date)
    }
}
