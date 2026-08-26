import Foundation

struct Assembly: Identifiable, Codable, Hashable {
    var id: UUID
    var name: String
    var category: String
    var lineItems: [AssemblyLineItem]
}
