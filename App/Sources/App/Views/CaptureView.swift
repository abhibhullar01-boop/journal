import SwiftData
import SwiftUI
import JournalKit

/// The quick-capture sheet: speak or type, then save.
struct CaptureView: View {
    let mode: CaptureMode

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Environment(AnalyzerStore.self) private var store
    @State private var transcriber = SpeechTranscriber()
    @State private var text = ""
    @State private var textBeforeRecording = ""
    @State private var usedVoice = false
    @State private var saved: [TrackedItem]?
    @FocusState private var editorFocused: Bool

    var body: some View {
        NavigationStack {
            Group {
                if let saved {
                    SavedSummary(items: saved) { dismiss() }
                } else {
                    editor
                }
            }
            .navigationTitle(saved == nil ? "New Entry" : "Saved")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if saved == nil {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save", action: save)
                            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
        .task {
            if mode == .voice {
                await startRecording()
            } else {
                editorFocused = true
            }
        }
        .onChange(of: transcriber.transcript) { _, spoken in
            text = [textBeforeRecording, spoken]
                .filter { !$0.isEmpty }
                .joined(separator: textBeforeRecording.hasSuffix("\n") ? "" : " ")
        }
        .onDisappear { transcriber.stop() }
    }

    private var editor: some View {
        VStack(spacing: 16) {
            TextEditor(text: $text)
                .focused($editorFocused)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(transcriber.isRecording ? "Listening…" : "What's on your mind?")
                            .foregroundStyle(.tertiary)
                            .padding(16)
                            .allowsHitTesting(false)
                    }
                }

            if let problem = transcriber.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button {
                if transcriber.isRecording {
                    transcriber.stop()
                } else {
                    Task { await startRecording() }
                }
            } label: {
                Image(systemName: transcriber.isRecording ? "stop.fill" : "mic.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 76, height: 76)
                    .background(transcriber.isRecording ? Color.red : Color.accentColor, in: Circle())
                    .symbolEffect(.pulse, isActive: transcriber.isRecording)
            }
            .accessibilityLabel(transcriber.isRecording ? "Stop recording" : "Start recording")

            Text(transcriber.isRecording ? "Listening. Tap to stop." : "Tap to speak")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    private func startRecording() async {
        editorFocused = false
        textBeforeRecording = text
        usedVoice = true
        await transcriber.start()
    }

    private func save() {
        transcriber.stop()
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let entry = JournalEntry(text: trimmed, source: usedVoice ? .voice : .text)
        context.insert(entry)
        withAnimation {
            saved = store.process(entry, in: context)
        }
    }
}

/// Shows what was found right after saving, so the user sees the categorising work.
private struct SavedSummary: View {
    let items: [TrackedItem]
    let done: () -> Void

    var body: some View {
        List {
            if items.isEmpty {
                Section {
                    Text("Saved as a reflection. No tasks, skills or goals in this one.")
                        .foregroundStyle(.secondary)
                }
            } else {
                Section("Found in your entry") {
                    ForEach(items) { ItemRow(item: $0, showsCheckbox: false) }
                }
                Section {
                    Text("Something in the wrong place? Open the entry and change its category. The app learns from every fix.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: done) {
                Text("Done").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding()
        }
    }
}

#Preview {
    CaptureView(mode: .text)
        .modelContainer(PreviewData.container)
        .environment(AnalyzerStore())
}
