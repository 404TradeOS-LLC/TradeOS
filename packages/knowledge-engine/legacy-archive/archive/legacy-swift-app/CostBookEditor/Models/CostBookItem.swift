import Foundation

struct CostBookItem: Identifiable, Codable, Hashable {
    var id: UUID
    var name: String
    var category: String
    var unit: String
    var laborCost: Double
    var materialCost: Double
    var equipmentCost: Double
    var notes: String?
    
    enum CodingKeys: String, CodingKey {
        case id, name, category, unit, laborCost, materialCost, equipmentCost, notes
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decode(String.self, forKey: .category)
        unit = try container.decode(String.self, forKey: .unit)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        
        // Handle String-to-Double conversion from JSON
        let laborStr = try container.decode(String.self, forKey: .laborCost)
        laborCost = Double(laborStr) ?? 0.0
        
        let materialStr = try container.decode(String.self, forKey: .materialCost)
        materialCost = Double(materialStr) ?? 0.0
        
        let equipmentStr = try container.decode(String.self, forKey: .equipmentCost)
        equipmentCost = Double(equipmentStr) ?? 0.0
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(category, forKey: .category)
        try container.encode(unit, forKey: .unit)
        try container.encodeIfPresent(notes, forKey: .notes)
        
        // Handle Double-to-String conversion for JSON (Run 1 compliance)
        try container.encode(String(format: "%.2f", laborCost), forKey: .laborCost)
        try container.encode(String(format: "%.2f", materialCost), forKey: .materialCost)
        try container.encode(String(format: "%.2f", equipmentCost), forKey: .equipmentCost)
    }
    
    var totalCost: Double {
        laborCost + materialCost + equipmentCost
    }
    
    var formattedTotal: String {
        totalCost.formatted(.currency(code: "USD"))
    }
    
    var laborCostFormatted: String {
        laborCost.formatted(.currency(code: "USD"))
    }
    
    var materialCostFormatted: String {
        materialCost.formatted(.currency(code: "USD"))
    }
    
    var equipmentCostFormatted: String {
        equipmentCost.formatted(.currency(code: "USD"))
    }
    
    var normalized: CostBookItem {
        var copy = self
        copy.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        copy.category = category.trimmingCharacters(in: .whitespacesAndNewlines)
        copy.unit = unit.trimmingCharacters(in: .whitespacesAndNewlines)
        copy.laborCost = (laborCost * 100).rounded() / 100
        copy.materialCost = (materialCost * 100).rounded() / 100
        copy.equipmentCost = (equipmentCost * 100).rounded() / 100
        return copy
    }
}
