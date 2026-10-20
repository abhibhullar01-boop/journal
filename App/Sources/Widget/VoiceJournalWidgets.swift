import AppIntents
import SwiftUI
import WidgetKit

@main
struct VoiceJournalWidgets: WidgetBundle {
    var body: some Widget {
        QuickCaptureWidget()
        RecordControl()
    }
}

// MARK: - Home screen and lock screen widget

struct QuickCaptureEntry: TimelineEntry {
    let date: Date
}

struct QuickCaptureProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickCaptureEntry { QuickCaptureEntry(date: .now) }

    func getSnapshot(in context: Context, completion: @escaping (QuickCaptureEntry) -> Void) {
        completion(QuickCaptureEntry(date: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickCaptureEntry>) -> Void) {
        completion(Timeline(entries: [QuickCaptureEntry(date: .now)], policy: .never))
    }
}

struct QuickCaptureWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "QuickCapture", provider: QuickCaptureProvider()) { _ in
            QuickCaptureView()
        }
        .configurationDisplayName("Quick Capture")
        .description("Start a journal entry with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    }
}

struct QuickCaptureView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "mic.fill").font(.title2)
            }
            .widgetURL(AppRouter.url(for: .voice))
            .containerBackground(for: .widget) { Color.clear }
        case .systemMedium:
            HStack(spacing: 12) {
                Link(destination: AppRouter.url(for: .voice)) {
                    CaptureTile(symbol: "mic.fill", title: "Speak")
                }
                Link(destination: AppRouter.url(for: .text)) {
                    CaptureTile(symbol: "square.and.pencil", title: "Write")
                }
            }
            .containerBackground(Color.accentColor.gradient, for: .widget)
        default:
            CaptureTile(symbol: "mic.fill", title: "Speak")
                .widgetURL(AppRouter.url(for: .voice))
                .containerBackground(Color.accentColor.gradient, for: .widget)
        }
    }
}

private struct CaptureTile: View {
    let symbol: String
    let title: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: symbol)
                .font(.system(size: 34, weight: .semibold))
            Text(title)
                .font(.headline)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.white.opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Control Center, lock screen control and Action Button

struct RecordControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.abhibhullar.VoiceJournal.RecordControl") {
            ControlWidgetButton(action: StartVoiceEntryIntent()) {
                Label("Voice Journal", systemImage: "mic.fill")
            }
        }
        .displayName("Voice Journal")
        .description("Start a voice journal entry.")
    }
}
