import AVFoundation
import Observation
import Speech

/// Live speech-to-text with Apple's Speech framework. Recognition runs on the
/// iPhone when the language supports it, so entries never leave the device.
@MainActor
@Observable
final class SpeechTranscriber {
    enum State: Equatable {
        case idle
        case recording
        case unavailable(String)
    }

    private(set) var state: State = .idle
    private(set) var transcript = ""

    private let recognizer = SFSpeechRecognizer(locale: .current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    var isRecording: Bool { state == .recording }

    var problem: String? {
        if case .unavailable(let message) = state { return message }
        return nil
    }

    func start() async {
        guard !isRecording else { return }
        guard await requestPermissions() else { return }
        guard let recognizer, recognizer.isAvailable else {
            state = .unavailable("Speech recognition isn't available right now. You can still type.")
            return
        }

        transcript = ""
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            request.addsPunctuation = true
            if recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
            }

            guard Self.installTap(on: audioEngine.inputNode, feeding: request) else {
                state = .unavailable("No microphone found. You can still type.")
                return
            }
            audioEngine.prepare()
            try audioEngine.start()

            self.request = request
            state = .recording
            task = Self.recognize(with: recognizer, request: request) { [weak self] text, finished in
                Task { @MainActor in
                    guard let self else { return }
                    if let text { self.transcript = text }
                    if finished { self.finish() }
                }
            }
        } catch {
            teardownAudio()
            state = .unavailable("Couldn't start recording: \(error.localizedDescription)")
        }
    }

    /// Stops listening. The recognizer still delivers its final result.
    func stop() {
        guard isRecording else { return }
        teardownAudio()
        request?.endAudio()
        state = .idle
    }

    private func finish() {
        if isRecording {
            teardownAudio()
            state = .idle
        }
        request = nil
        task = nil
    }

    private func teardownAudio() {
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func requestPermissions() async -> Bool {
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard speechStatus == .authorized else {
            state = .unavailable("Speech recognition is turned off for Voice Journal in Settings. You can still type.")
            return false
        }
        guard await AVAudioApplication.requestRecordPermission() else {
            state = .unavailable("Microphone access is turned off for Voice Journal in Settings. You can still type.")
            return false
        }
        return true
    }

    // The audio tap and recognition callbacks run on background threads, so they
    // are built outside the main actor.

    private nonisolated static func installTap(on node: AVAudioInputNode, feeding request: SFSpeechAudioBufferRecognitionRequest) -> Bool {
        let format = node.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { return false }
        node.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        return true
    }

    private nonisolated static func recognize(
        with recognizer: SFSpeechRecognizer,
        request: SFSpeechAudioBufferRecognitionRequest,
        update: @escaping @Sendable (String?, Bool) -> Void
    ) -> SFSpeechRecognitionTask {
        recognizer.recognitionTask(with: request) { result, error in
            update(result?.bestTranscription.formattedString, error != nil || (result?.isFinal ?? false))
        }
    }
}
