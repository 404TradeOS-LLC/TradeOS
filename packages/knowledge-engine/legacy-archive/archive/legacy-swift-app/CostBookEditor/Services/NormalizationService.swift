import Foundation

class NormalizationService {
    static func normalize(item: CostBookItem) -> CostBookItem {
        return item.normalized
    }
    
    static func normalize(collection: [CostBookItem]) -> [CostBookItem] {
        return collection.map { $0.normalized }
    }
}
