import XCTest
@testable import JournalKit

final class TextTests: XCTestCase {
    func testTokenizer() {
        XCTAssertEqual(Tokenizer.words("Don’t forget: call Mom!"), ["don't", "forget", "call", "mom"])
        XCTAssertEqual(Tokenizer.features("need to go"), ["need", "to", "go", "need to", "to go"])
    }

    func testSplitsOnPunctuation() {
        XCTAssertEqual(
            SentenceSplitter.split("Long day. Need to call mom at 5 p.m. tomorrow! Was it fun? Yes"),
            ["Long day.", "Need to call mom at 5 p.m. tomorrow!", "Was it fun?", "Yes"]
        )
    }

    func testSplitsRunOnDictation() {
        XCTAssertEqual(
            SentenceSplitter.split("I went to the gym and I need to buy milk but my goal is to run a marathon"),
            ["I went to the gym", "I need to buy milk", "my goal is to run a marathon"]
        )
    }

    func testDoesNotSplitShortPhrases() {
        XCTAssertEqual(SentenceSplitter.split("Salt and I agree"), ["Salt and I agree"])
    }

    func testTitles() {
        XCTAssertEqual(TitleCleaner.title(for: "Um, I really need to call mom tomorrow."), "Call mom tomorrow")
        XCTAssertEqual(TitleCleaner.title(for: "I want to get better at public speaking"), "Public speaking")
        XCTAssertEqual(TitleCleaner.title(for: "My goal is to run a marathon by next year."), "Run a marathon by next year")
        XCTAssertEqual(TitleCleaner.title(for: "Don't forget to water the plants"), "Water the plants")
        XCTAssertEqual(TitleCleaner.title(for: "My long-term plan is to open a cafe"), "Open a cafe")
        XCTAssertEqual(TitleCleaner.title(for: "Buy milk"), "Buy milk")
    }
}
