import Foundation

struct Payload: Codable {
    var items: [CostBookItem]
    var assemblies: [Assembly]
}

class FileService {
    
    static var baseURL: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appDir = appSupport.appendingPathComponent("TradeOSCostBookEditor")
        if !FileManager.default.fileExists(atPath: appDir.path) {
            try? FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
        }
        return appDir
    }
    
    // We mock the local target dirs according to prompt constraints, simulating where Data paths are relative to the user root, or we put them in User's Document directory. Let's use current directory relative mapping for the dev environment.
    static var projectRoot: URL {
        let dir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("Data")
        try? FileManager.default.createDirectory(at: dir.appendingPathComponent("raw"), withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: dir.appendingPathComponent("working"), withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: dir.appendingPathComponent("export"), withIntermediateDirectories: true)
        return dir
    }
    
    static func loadRawInbox() -> [CostBookItem] {
        let fileURL = projectRoot.appendingPathComponent("raw/items.json")
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        return (try? JSONDecoder().decode([CostBookItem].self, from: data)) ?? []
    }
    
    static func updateRawInbox(items: [CostBookItem]) {
        let fileURL = projectRoot.appendingPathComponent("raw/items.json")
        defer { try? JSONEncoder().encode(items).write(to: fileURL) }
    }
    
    static func loadWorkingSet() -> Payload {
        let fileURL = projectRoot.appendingPathComponent("working/costbook.json")
        guard let data = try? Data(contentsOf: fileURL) else { return Payload(items: [], assemblies: []) }
        return (try? JSONDecoder().decode(Payload.self, from: data)) ?? Payload(items: [], assemblies: [])
    }
    
    static func saveWorkingSet(payload: Payload) throws {
        let fileURL = projectRoot.appendingPathComponent("working/costbook.json")
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        let data = try encoder.encode(payload)
        try data.write(to: fileURL)
    }
    
    static func exportPayload(payload: Payload) throws {
        let fileURL = projectRoot.appendingPathComponent("export/costbook.json")
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        let data = try encoder.encode(payload)
        try data.write(to: fileURL)
    }
}
