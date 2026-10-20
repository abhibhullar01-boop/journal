import SwiftData
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        ReminderScheduler.registerCategories()
        return true
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let action = response.actionIdentifier
        let itemID = response.notification.request.content.userInfo[ReminderScheduler.itemIDKey] as? String
        await MainActor.run {
            Self.handle(action: action, itemID: itemID)
        }
    }

    @MainActor
    static func handle(action: String, itemID: String?) {
        let context = VoiceJournalApp.container.mainContext
        let item: TrackedItem? = itemID.flatMap(UUID.init(uuidString:)).flatMap { uid in
            try? context.fetch(FetchDescriptor<TrackedItem>(predicate: #Predicate { $0.uid == uid })).first
        }
        switch action {
        case ReminderScheduler.markDoneAction:
            item?.isDone = true
            item?.completedAt = .now
        case ReminderScheduler.snoozeAction:
            if let item { ReminderScheduler.shared.snooze(item) }
        default:
            AppRouter.shared.selectedTab = .tracker
        }
        try? context.save()
    }
}
