import SwiftData
import SwiftUI

struct RootView: View {
    @Environment(AppRouter.self) private var router
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @Query(filter: #Predicate<TrackedItem> { $0.kindRaw == "task" && !$0.isDone })
    private var openTasks: [TrackedItem]

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.selectedTab) {
            JournalListView()
                .tabItem { Label("Journal", systemImage: "book.closed") }
                .tag(AppTab.journal)
            TrackerView()
                .tabItem { Label("Tracker", systemImage: "checklist") }
                .badge(openTasks.count)
                .tag(AppTab.tracker)
            BrainView()
                .tabItem { Label("Brain", systemImage: "brain") }
                .tag(AppTab.brain)
        }
        .sheet(item: $router.pendingCapture) { mode in
            CaptureView(mode: mode)
        }
        .onOpenURL { router.handle($0) }
        .onChange(of: openTasks.count, initial: true) {
            ReminderScheduler.shared.refreshDigests(in: context)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                ReminderScheduler.shared.refreshDigests(in: context)
            }
        }
    }
}

#Preview {
    RootView()
        .modelContainer(PreviewData.container)
        .environment(AnalyzerStore())
        .environment(AppRouter.shared)
}
