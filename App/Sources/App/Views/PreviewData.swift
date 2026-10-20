import SwiftData
import SwiftUI
import JournalKit

/// Sample entries for Xcode previews.
@MainActor
enum PreviewData {
    static let container: ModelContainer = {
        let container = try! ModelContainer(
            for: JournalEntry.self, TrackedItem.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        let analyzer = try! JournalAnalyzer.baseline()
        let samples = [
            "Long day at work. I need to email Sarah about the budget tomorrow and I want to get better at public speaking.",
            "Felt great after the run. Someday I want to run a marathon. Remember to buy new running shoes this weekend.",
            "I've been practicing guitar every evening. My goal is to play at my sister's wedding next year.",
        ]
        for (offset, text) in samples.enumerated() {
            let entry = JournalEntry(text: text, source: offset == 1 ? .text : .voice,
                                     createdAt: .now.addingTimeInterval(Double(-offset) * 86_400))
            container.mainContext.insert(entry)
            for insight in analyzer.analyze(text) {
                let item = TrackedItem(insight, createdAt: entry.createdAt)
                item.entry = entry
                container.mainContext.insert(item)
            }
        }
        return container
    }()
}
