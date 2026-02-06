// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NetScannerDaemon",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "NetScannerDaemon",
            targets: ["NetScannerDaemon"]
        )
    ],
    targets: [
        .executableTarget(
            name: "NetScannerDaemon",
            path: "Sources/NetScannerDaemon",
            linkerSettings: [
                .linkedFramework("Foundation")
            ]
        )
    ]
)
