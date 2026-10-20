import AppIntents
import SwiftData
import SwiftUI

@main
struct VoiceJournalApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var analyzerStore = AnalyzerStore()

    static let container: ModelContainer = {
        do {
            return try ModelContainer(for: JournalEntry.self, TrackedItem.self)
        } catch {
            fatalError("Couldn't open the journal database: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(analyzerStore)
                .environment(AppRouter.shared)
        }
        .modelContainer(Self.container)
    }
}

/// Siri and Shortcuts phrases. They also make the intents available to the Action Button.
struct VoiceJournalShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartVoiceEntryIntent(),
            phrases: [
                "Start a journal entry in \(.applicationName)",
                "Journal with \(.applicationName)",
                "Record in \(.applicationName)",
            ],
            shortTitle: "Speak an Entry",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: StartTextEntryIntent(),
            phrases: ["Write in \(.applicationName)"],
            shortTitle: "Write an Entry",
            systemImageName: "square.and.pencil"
        )
    }
}
