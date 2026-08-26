import SwiftUI

struct TradeOSProductivityGrid: View {
    var body: some View {
        HStack(spacing: 24) {
            // Task Widget: Punchlist
            TradeOSCard(padding: 24) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Image(systemName: "checklist")
                            .foregroundColor(TradeOSTheme.accent)
                        Text("AGENT PUNCHLIST")
                            .font(.caption.bold())
                            .foregroundColor(.white.opacity(0.4))
                    }
                    
                    VStack(alignment: .leading, spacing: 10) {
                        TodoItem(text: "Verify 2x4 framing pricing delta", isDone: true)
                        TodoItem(text: "Sync roofing assemblies to Supabase", isDone: false)
                        TodoItem(text: "Review exterior siding agent logs", isDone: false)
                    }
                    
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity)
            
            // Sync Widget: Data Stream
            TradeOSCard(padding: 24) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .foregroundColor(TradeOSTheme.accent)
                        Text("DATA ORCHESTRATION")
                            .font(.caption.bold())
                            .foregroundColor(.white.opacity(0.4))
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Active Sync: costbook.json")
                            .font(.headline)
                        Text("1,795 items validated • 9s ago")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    ProgressView(value: 0.85)
                        .tint(TradeOSTheme.accent)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct TodoItem: View {
    let text: String
    let isDone: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                .foregroundColor(isDone ? .green : .gray.opacity(0.3))
            Text(text)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(isDone ? .white.opacity(0.4) : .white)
                .strikethrough(isDone)
        }
    }
}
