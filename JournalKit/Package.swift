// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "JournalKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "JournalKit", targets: ["JournalKit"]),
        .executable(name: "journal-classify", targets: ["journal-classify"]),
    ],
    targets: [
        .target(
            name: "JournalKit",
            resources: [.process("Resources")]
        ),
        .executableTarget(
            name: "journal-classify",
            dependencies: ["JournalKit"]
        ),
        .testTarget(
            name: "JournalKitTests",
            dependencies: ["JournalKit"]
        ),
    ]
)
