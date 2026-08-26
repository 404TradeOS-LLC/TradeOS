// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CostBookEditor",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "CostBookEditor", targets: ["CostBookEditor"])
    ],
    targets: [
        .executableTarget(
            name: "CostBookEditor",
            path: ".",
            exclude: ["Data", "Resources"],
            sources: ["App", "Models", "ViewModels", "Views", "Services"]
        )
    ]
)
