import Foundation
import Observation

/// How a new entry is captured.
enum CaptureMode: String, Identifiable, Sendable {
    case voice
    case text

    var id: String { rawValue }
}

enum AppTab: Hashable {
    case journal
    case tracker
    case brain
}

/// Where the app should go next. Widgets, Control Center, Siri and notification
/// taps all funnel through here.
@MainActor
@Observable
final class AppRouter {
    static let shared = AppRouter()

    var selectedTab: AppTab = .journal
    /// Set to open the capture sheet.
    var pendingCapture: CaptureMode?

    /// voicejournal://record, voicejournal://write, voicejournal://tracker
    static func url(for mode: CaptureMode) -> URL {
        URL(string: mode == .voice ? "voicejournal://record" : "voicejournal://write")!
    }

    static let trackerURL = URL(string: "voicejournal://tracker")!

    func handle(_ url: URL) {
        guard url.scheme == "voicejournal" else { return }
        switch url.host {
        case "record":
            selectedTab = .journal
            pendingCapture = .voice
        case "write":
            selectedTab = .journal
            pendingCapture = .text
        case "tracker":
            selectedTab = .tracker
        default:
            break
        }
    }
}
