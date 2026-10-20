import Foundation
import JournalKit

// Try the classifier from a terminal:
//   swift run journal-classify "I need to call mom tomorrow and someday I want to run a marathon"
//   swift run journal-classify --eval
let arguments = Array(CommandLine.arguments.dropFirst())
let analyzer = try JournalAnalyzer.baseline()

if arguments.first == "--eval" {
    let report = Evaluator.evaluate(analyzer, on: try SeedData.evaluation())
    print(report.summary)
    exit(0)
}

var text = arguments.joined(separator: " ")
if text.isEmpty {
    text = AnyIterator { readLine() }.joined(separator: "\n")
}

let formatter = DateFormatter()
formatter.dateStyle = .medium
formatter.timeStyle = .short

let insights = analyzer.analyze(text)
if insights.isEmpty {
    print("No tasks, skills or goals found.")
}
for insight in insights {
    var line = "[\(insight.kind.displayName)] \(insight.title)"
    line += String(format: "  (%.0f%%)", insight.confidence * 100)
    if let due = insight.dueDate {
        line += "  remind: \(formatter.string(from: due))"
    }
    print(line)
}
