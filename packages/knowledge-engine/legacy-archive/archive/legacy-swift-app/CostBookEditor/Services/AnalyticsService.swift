import Foundation

struct TradeMetric: Identifiable {
    let id = UUID()
    let category: String
    let count: Int
    let totalValue: Double
}

class AnalyticsService {
    
    static func getTradeMetrics(items: [CostBookItem]) -> [TradeMetric] {
        let groups = Dictionary(grouping: items, by: { $0.category })
        return groups.map { (cat, items) in
            TradeMetric(
                category: cat,
                count: items.count,
                totalValue: items.reduce(0) { $0 + $1.totalCost }
            )
        }.sorted { $0.count > $1.count }
    }
    
    static func getSanityFlags(items: [CostBookItem]) -> [String: Int] {
        var flags: [String: Int] = ["Below Min": 0, "High Labor Ratio": 0]
        
        // Match master_pipeline logic
        let minCosts: [String: Double] = ["SF": 0.05, "LF": 0.10, "EA": 0.25, "HR": 12.00, "CY": 8.00, "SQ": 5.00, "CF": 0.50]
        let maxLaborRatio = 0.98
        
        for item in items {
            let total = item.totalCost
            if total < (minCosts[item.unit] ?? 0.01) {
                flags["Below Min", default: 0] += 1
            }
            if total > 0 && (item.laborCost / total) > maxLaborRatio {
                flags["High Labor Ratio", default: 0] += 1
            }
        }
        return flags
    }
}
