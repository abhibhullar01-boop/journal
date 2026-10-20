import Foundation
import SwiftData
import UserNotifications
import JournalKit

/// Local notifications drawn from what you said:
/// - a reminder at the time a task mentioned ("tomorrow", "at 5 pm", "by Friday")
/// - a morning digest of open tasks
/// - a Sunday evening check-in on a skill or goal
@MainActor
final class ReminderScheduler {
    static let shared = ReminderScheduler()

    static let taskCategory = "TASK_REMINDER"
    static let markDoneAction = "MARK_DONE"
    static let snoozeAction = "SNOOZE_HOUR"
    static let itemIDKey = "itemID"
    static let digestID = "daily-digest"
    static let checkInID = "weekly-check-in"

    private let center = UNUserNotificationCenter.current()

    static func registerCategories() {
        let done = UNNotificationAction(identifier: markDoneAction, title: "Mark done", options: [])
        let snooze = UNNotificationAction(identifier: snoozeAction, title: "Remind me in an hour", options: [])
        let category = UNNotificationCategory(identifier: taskCategory, actions: [done, snooze], intentIdentifiers: [])
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    /// Asks once; later calls return the stored answer.
    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func schedule(_ items: [TrackedItem]) async {
        guard items.contains(where: { $0.dueDate != nil }), await requestAuthorization() else { return }
        for item in items { schedule(item) }
    }

    func schedule(_ item: TrackedItem) {
        cancel(item)
        guard item.kind == .task, !item.isDone, let due = item.dueDate, due > .now else { return }

        let content = UNMutableNotificationContent()
        content.title = item.title
        content.body = "From your journal: \u{201C}\(item.sentence)\u{201D}"
        content.sound = .default
        content.categoryIdentifier = Self.taskCategory
        content.userInfo = [Self.itemIDKey: item.uid.uuidString]

        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: due)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        center.add(UNNotificationRequest(identifier: item.uid.uuidString, content: content, trigger: trigger)) { _ in }
    }

    func snooze(_ item: TrackedItem, by interval: TimeInterval = 3600) {
        item.dueDate = Date.now.addingTimeInterval(interval)
        schedule(item)
    }

    func cancel(_ item: TrackedItem) {
        center.removePendingNotificationRequests(withIdentifiers: [item.uid.uuidString])
    }

    /// Rebuilds the repeating digest and check-in so their text matches the current data.
    func refreshDigests(in context: ModelContext) {
        let items = (try? context.fetch(FetchDescriptor<TrackedItem>())) ?? []
        let openTasks = items.filter { $0.kind == .task && !$0.isDone }.map(\.title)
        let pick = items
            .filter { ($0.kind == .skill || $0.kind == .goal) && !$0.isDone }
            .randomElement()
            .map { (title: $0.title, kind: $0.kind) }

        center.removePendingNotificationRequests(withIdentifiers: [Self.digestID, Self.checkInID])
        Task {
            let status = await center.notificationSettings().authorizationStatus
            guard status == .authorized else { return }
            addDigest(openTasks: openTasks)
            if let pick {
                addCheckIn(title: pick.title, kind: pick.kind)
            }
        }
    }

    private func addDigest(openTasks: [String]) {
        guard !openTasks.isEmpty else { return }
        let content = UNMutableNotificationContent()
        content.title = openTasks.count == 1 ? "1 open task" : "\(openTasks.count) open tasks"
        content.body = openTasks.prefix(3).joined(separator: " · ")
        content.sound = .default
        var morning = DateComponents()
        morning.hour = 8
        morning.minute = 30
        let trigger = UNCalendarNotificationTrigger(dateMatching: morning, repeats: true)
        center.add(UNNotificationRequest(identifier: Self.digestID, content: content, trigger: trigger)) { _ in }
    }

    private func addCheckIn(title: String, kind: InsightKind) {
        let content = UNMutableNotificationContent()
        content.title = kind == .skill ? "Skill check-in" : "Goal check-in"
        content.body = kind == .skill
            ? "You said you're working on \u{201C}\(title)\u{201D}. Did you practice this week?"
            : "You said you want to \u{201C}\(title.lowercased())\u{201D}. What's one step this week?"
        content.sound = .default
        var sunday = DateComponents()
        sunday.weekday = 1
        sunday.hour = 18
        let trigger = UNCalendarNotificationTrigger(dateMatching: sunday, repeats: true)
        center.add(UNNotificationRequest(identifier: Self.checkInID, content: content, trigger: trigger)) { _ in }
    }
}
