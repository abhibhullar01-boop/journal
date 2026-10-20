import XCTest
@testable import JournalKit

final class ClassifierTests: XCTestCase {
    var analyzer: JournalAnalyzer!

    override func setUpWithError() throws {
        analyzer = try JournalAnalyzer.baseline()
    }

    func testSeedDataLoads() throws {
        let training = try SeedData.training()
        let evaluation = try SeedData.evaluation()
        XCTAssertGreaterThan(training.count, 500)
        XCTAssertEqual(evaluation.count, 80)
        XCTAssertTrue(Set(training.map(\.text)).isDisjoint(with: evaluation.map(\.text)))
    }

    /// The baseline must stay accurate on hand-written sentences it never saw.
    func testBaselineAccuracyOnHeldOutSet() throws {
        let report = Evaluator.evaluate(analyzer, on: try SeedData.evaluation())
        print(report.summary)
        XCTAssertGreaterThanOrEqual(report.accuracy, 0.85)
        for kind in InsightKind.allCases {
            let stats = try XCTUnwrap(report.perKind[kind])
            XCTAssertGreaterThanOrEqual(Double(stats.correct) / Double(stats.total), 0.75, "\(kind)")
        }
    }

    func testClassifiesTypicalSentences() {
        XCTAssertEqual(analyzer.classify("I need to call the dentist tomorrow").kind, .task)
        XCTAssertEqual(analyzer.classify("I want to get better at public speaking").kind, .skill)
        XCTAssertEqual(analyzer.classify("Someday I want to run a marathon").kind, .goal)
        XCTAssertEqual(analyzer.classify("I felt really calm after my walk").kind, .none)
    }

    func testAnalyzeRunOnDictation() {
        let entry = "Today was busy and I need to email Sarah tomorrow and I want to learn Spanish and my goal is to move to Spain in five years"
        let insights = analyzer.analyze(entry)
        XCTAssertEqual(insights.map(\.kind), [.task, .skill, .goal])
        XCTAssertEqual(insights.first?.title, "Email Sarah tomorrow")
        XCTAssertNotNil(insights.first?.dueDate)
        XCTAssertNil(insights.last?.dueDate)
    }

    func testShortFragmentsAndSomedayClauses() {
        let entry = "Long day. I need to email Sarah tomorrow at 10 and I want to get better at public speaking and someday I want to run a marathon."
        let insights = analyzer.analyze(entry)
        XCTAssertEqual(insights.map(\.kind), [.task, .skill, .goal])
        XCTAssertEqual(insights.map(\.title), ["Email Sarah tomorrow at 10", "Public speaking", "Run a marathon"])
    }

    func testCorrectionsPersonalizeTheModel() {
        let sentence = "Gym session with coach Mike"
        var personal = analyzer!
        for _ in 0..<3 { personal.learn(sentence, as: .skill) }
        XCTAssertEqual(personal.classify(sentence).kind, .skill)
        XCTAssertEqual(personal.personalExamples, 3)
        // Unrelated sentences still behave.
        XCTAssertEqual(personal.classify("I need to pay rent tomorrow").kind, .task)
    }

    func testModelRoundTripsThroughJSON() throws {
        var personal = analyzer!
        personal.learn("Climbing session at the wall", as: .skill)
        let data = try JSONEncoder().encode(personal)
        let restored = try JSONDecoder().decode(JournalAnalyzer.self, from: data)
        XCTAssertEqual(restored, personal)
        XCTAssertEqual(restored.classify("Climbing session at the wall"), personal.classify("Climbing session at the wall"))
    }
}
