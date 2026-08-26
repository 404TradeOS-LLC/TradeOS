import Foundation

struct AssemblyLineItem: Identifiable, Codable, Hashable {
    var id: UUID { UUID() } // Using dynamic ID for UI list compliance where necessary, though usually schema only persists costBookItemId
    var costBookItemId: UUID
    var quantity: Double
    
    enum CodingKeys: String, CodingKey {
        case costBookItemId, quantity
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        costBookItemId = try container.decode(UUID.self, forKey: .costBookItemId)
        
        // Handle String-to-Double conversion from JSON
        let qtyStr = try container.decode(String.self, forKey: .quantity)
        quantity = Double(qtyStr) ?? 0.0
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(costBookItemId, forKey: .costBookItemId)
        
        // Handle Double-to-String conversion for JSON (Run 1 compliance)
        try container.encode(String(format: "%.2f", quantity), forKey: .quantity)
    }
}
