import XCTest
@testable import JournalKit

final class DueDateParserTests: XCTestCase {
    var calendar = Calendar(identifier: .gregorian)
    var parser: DueDateParser!
    /// Wednesday 15 October 2025, 10:30 UTC.
    var now: Date!

    override func setUp() {
        calendar.timeZone = TimeZone(identifier: "UTC")!
        parser = DueDateParser(calendar: calendar)
        now = date(2025, 10, 15, 10, 30)
    }

    func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour, minute: minute))!
    }

    func due(_ sentence: String) -> Date? {
        parser.dueDate(in: sentence, now: now)
    }

    func testNoTimeCue() {
        XCTAssertNil(due("I need to buy milk"))
    }

    func testRelativeDays() {
        XCTAssertEqual(due("Call mom tomorrow"), date(2025, 10, 16, 9))
        XCTAssertEqual(due("Call mom tomorrow evening"), date(2025, 10, 16, 19))
        XCTAssertEqual(due("Finish the laundry tonight"), date(2025, 10, 15, 19))
        XCTAssertEqual(due("Pay the bill this afternoon"), date(2025, 10, 15, 14))
        XCTAssertEqual(due("Back up my laptop first thing in the morning"), date(2025, 10, 16, 8))
    }

    func testWeekdaysAndWeeks() {
        XCTAssertEqual(due("Submit the report by Friday"), date(2025, 10, 17, 9))
        XCTAssertEqual(due("Renew the permit on Monday"), date(2025, 10, 20, 9))
        XCTAssertEqual(due("Clean the garage this weekend"), date(2025, 10, 18, 10))
        XCTAssertEqual(due("Schedule a call next week"), date(2025, 10, 20, 9))
        // Same weekday as today means next week.
        XCTAssertEqual(due("Team sync on Wednesday"), date(2025, 10, 22, 9))
    }

    func testClockTimes() {
        XCTAssertEqual(due("Pick up the kids at 3"), date(2025, 10, 15, 15))
        XCTAssertEqual(due("Dentist at 4:30 pm tomorrow"), date(2025, 10, 16, 16, 30))
        XCTAssertEqual(due("Meeting at 11 tomorrow"), date(2025, 10, 16, 11))
        XCTAssertEqual(due("Call the bank at 9 a.m. on Friday"), date(2025, 10, 17, 9))
        XCTAssertEqual(due("Gym at 7pm"), date(2025, 10, 15, 19))
        // 8 am has already passed today, so it rolls to tomorrow.
        XCTAssertEqual(due("Take vitamins at 8 am"), date(2025, 10, 16, 8))
    }

    func testTodayInThePastBecomesAnHourFromNow() {
        let late = date(2025, 10, 15, 18)
        XCTAssertEqual(parser.dueDate(in: "Send the invoice later today", now: late), late.addingTimeInterval(3600))
    }
}
