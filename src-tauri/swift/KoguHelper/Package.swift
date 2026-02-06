// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "KoguHelper",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "KoguHelper",
            type: .static,
            targets: ["KoguHelper"]
        )
    ],
    targets: [
        .target(
            name: "KoguHelper",
            path: "Sources/KoguHelper",
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("include")
            ],
            linkerSettings: [
                .linkedFramework("ServiceManagement"),
                .linkedFramework("AppKit")
            ]
        )
    ]
)
