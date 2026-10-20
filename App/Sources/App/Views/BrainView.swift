import SwiftUI
import JournalKit

/// Shows how the on-device model is doing and lets you try sentences on it.
struct BrainView: View {
    @Environment(AnalyzerStore.self) private var store
    @State private var report: EvaluationReport?
    @State private var sample = "I need to call the dentist tomorrow at 4 pm"
    @State private var confirmingReset = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Type a sentence", text: $sample, axis: .vertical)
                    if !sample.trimmingCharacters(in: .whitespaces).isEmpty {
                        let result = store.analyzer.classify(sample)
                        ForEach(InsightKind.allCases, id: \.self) { kind in
                            ScoreBar(kind: kind, score: result.scores[kind] ?? 0, isWinner: kind == result.kind)
                        }
                        if result.kind != .none {
                            LabeledContent("Title", value: TitleCleaner.title(for: sample))
                        }
                        if result.kind == .task, let due = DueDateParser().dueDate(in: sample) {
                            LabeledContent("Reminder", value: due.formatted(date: .abbreviated, time: .shortened))
                        }
                    }
                } header: {
                    Text("Try it")
                }

                Section {
                    if let report {
                        LabeledContent("Accuracy", value: report.accuracy.formatted(.percent.precision(.fractionLength(0))))
                        ForEach(InsightKind.allCases, id: \.self) { kind in
                            if let stats = report.perKind[kind] {
                                LabeledContent(kind.pluralName, value: "\(stats.correct) of \(stats.total)")
                            }
                        }
                    } else {
                        ProgressView()
                    }
                } header: {
                    Text("Test sentences it has never seen")
                }

                Section {
                    LabeledContent("Your corrections", value: "\(store.personalExamples)")
                    LabeledContent("Words and phrases known", value: "\(store.analyzer.model.vocabularySize)")
                    Button("Reset to the built-in model", role: .destructive) {
                        confirmingReset = true
                    }
                    .disabled(store.personalExamples == 0)
                } header: {
                    Text("Personalisation")
                } footer: {
                    Text("The model started from about 680 example sentences. Every time you fix or confirm a category, it learns from your own words, and your fixes count three times as much as the examples. Everything stays on your iPhone.")
                }

                if let problem = store.problem {
                    Section { Text(problem).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Brain")
            .task(id: store.personalExamples) {
                report = store.evaluate()
            }
            .confirmationDialog("Forget everything the model learned from you?", isPresented: $confirmingReset, titleVisibility: .visible) {
                Button("Reset", role: .destructive) { store.resetPersonalization() }
            }
        }
    }
}

private struct ScoreBar: View {
    let kind: InsightKind
    let score: Double
    let isWinner: Bool

    var body: some View {
        HStack {
            Label(kind.displayName, systemImage: kind.symbol)
                .foregroundStyle(kind.tint)
                .fontWeight(isWinner ? .bold : .regular)
                .frame(width: 130, alignment: .leading)
            ProgressView(value: score)
                .tint(kind.tint)
            Text(score.formatted(.percent.precision(.fractionLength(0))))
                .font(.caption.monospacedDigit())
                .frame(width: 40, alignment: .trailing)
        }
    }
}

#Preview {
    BrainView()
        .environment(AnalyzerStore())
}
