import AppIntents

/// Opens the app straight into recording. Used by Siri, Shortcuts, the Action
/// Button and the Control Center control. This file is compiled into both the
/// app and the widget extension, which is what lets a control open the app.
struct StartVoiceEntryIntent: AppIntent {
    static let title: LocalizedStringResource = "Start Voice Journal Entry"
    static let description = IntentDescription("Opens Voice Journal and starts listening.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.pendingCapture = .voice
        return .result()
    }
}

/// Opens the app with the keyboard ready for a written entry.
struct StartTextEntryIntent: AppIntent {
    static let title: LocalizedStringResource = "Write Journal Entry"
    static let description = IntentDescription("Opens Voice Journal ready to type an entry.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.pendingCapture = .text
        return .result()
    }
}
