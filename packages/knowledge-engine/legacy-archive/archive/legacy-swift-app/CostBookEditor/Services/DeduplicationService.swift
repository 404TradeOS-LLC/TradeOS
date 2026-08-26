import Foundation

class DeduplicationService {
    static func isDuplicate(name: String, id: UUID, in items: [CostBookItem]) -> Bool {
        let normalizedSearch = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return items.contains { existing in
            existing.id != id && existing.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalizedSearch
        }
    }
}
