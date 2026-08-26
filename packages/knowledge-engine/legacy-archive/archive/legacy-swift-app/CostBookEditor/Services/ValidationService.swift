import Foundation

enum ValidationError: Error, LocalizedError {
    case emptyName
    case negativeCost
    case zeroTotalCost
    case emptyUnit
    case duplicateName(String)
    
    var errorDescription: String? {
        switch self {
        case .emptyName: return "Name cannot be empty."
        case .negativeCost: return "Costs cannot be negative."
        case .zeroTotalCost: return "Total cost must be greater than zero."
        case .emptyUnit: return "Unit cannot be empty."
        case .duplicateName(let name): return "An item with the name '\(name)' already exists."
        }
    }
}

class ValidationService {
    static func validate(item: CostBookItem, existingItems: [CostBookItem]) throws {
        if item.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw ValidationError.emptyName
        }
        if item.unit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw ValidationError.emptyUnit
        }
        if item.laborCost < 0 || item.materialCost < 0 || item.equipmentCost < 0 {
            throw ValidationError.negativeCost
        }
        if item.totalCost <= 0 {
            throw ValidationError.zeroTotalCost
        }
        
        // Deduplication check inline via dedupe service logic
        if existingItems.contains(where: { $0.name.lowercased() == item.name.lowercased() && $0.id != item.id }) {
            throw ValidationError.duplicateName(item.name)
        }
    }
}
