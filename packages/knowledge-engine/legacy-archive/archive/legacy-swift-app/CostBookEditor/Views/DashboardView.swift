import SwiftUI
import Charts

struct DashboardView: View {
    @Bindable var viewModel: CostBookViewModel
    
    var metrics: [TradeMetric] {
        AnalyticsService.getTradeMetrics(items: viewModel.items)
    }
    
    var sanityFlags: [String: Int] {
        AnalyticsService.getSanityFlags(items: viewModel.items)
    }
    
    var body: some View {
        ZStack(alignment: .bottom) {
            TradeOSTheme.background.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 32) {
                    // COMMANDER HERO
                    TradeOSDashboardHero(title: "Command Center")
                        .padding(.top, 24)
                    
                    // PRODUCTIVITY & PIPELINE
                    TradeOSProductivityGrid()
                    
                    // MAIN DATA CONTENT
                    HStack(alignment: .top, spacing: 24) {
                        tradeChartSection
                            .frame(maxWidth: .infinity)
                        
                        VStack(spacing: 24) {
                            sanityCheckPanel
                            quickActionsPanel
                        }
                        .frame(width: 320)
                    }
                }
                .padding(32)
                .padding(.bottom, 100) // Hover space
            }
            
            // DYNAMIC ISLAND NAVIGATION
            DynamicIslandNav(viewModel: viewModel)
        }
        .liquidGlass()
    }
    
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Command Center")
                    .font(.system(size: 34, weight: .black))
                Text("Real-time pricing health and pipeline status")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            
            Button(action: { viewModel.publishToProduction() }) {
                Label("Deploy to Production", systemImage: "arrow.up.to.line.circle.fill")
                    .font(.headline)
                    .padding(.horizontal, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(TradeOSTheme.accent)
        }
    }
    
    private var summaryGrid: some View {
        HStack(spacing: 20) {
            StatCard(title: "Total Items", value: "\(viewModel.items.count)", icon: "list.bullet.rectangle", color: TradeOSTheme.accent)
            StatCard(title: "Assemblies", value: "\(viewModel.assemblies.count)", icon: "square.stack.3d.up.fill", color: TradeOSTheme.secondaryAccent)
            StatCard(title: "Categories", value: "\(Set(viewModel.items.map { $0.category }).count)", icon: "tag.fill", color: .purple)
            StatCard(title: "Inbox Pending", value: "\(viewModel.rawInboxItems.count)", icon: "tray.fill", color: .orange)
        }
    }
    
    private var tradeChartSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Trade Distribution")
                .font(.headline)
                .foregroundStyle(.secondary)
            
            Chart(metrics.prefix(10)) { metric in
                BarMark(
                    x: .value("Count", metric.count),
                    y: .value("Trade", metric.category)
                )
                .foregroundStyle(TradeOSTheme.accent.gradient)
                .annotation(position: .trailing) {
                    Text("\(metric.count)")
                        .font(.caption2).bold()
                        .foregroundStyle(.secondary)
                }
            }
            .frame(height: 400)
            .premiumCard()
        }
    }
    
    private var sanityCheckPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Sanity Check")
                .font(.headline)
                .foregroundStyle(.secondary)
            
            VStack(spacing: 12) {
                ForEach(sanityFlags.sorted(by: { $0.key < $1.key }), id: \.key) { key, count in
                    HStack {
                        Label(key, systemImage: count > 0 ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                            .foregroundStyle(count > 0 ? .orange : .green)
                        Spacer()
                        Text("\(count)")
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                    }
                    .padding(.vertical, 4)
                }
            }
            .premiumCard()
        }
    }
    
    private var quickActionsPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.headline)
                .foregroundStyle(.secondary)
            
            VStack(spacing: 12) {
                ActionButton(title: "Add New Item", icon: "plus.circle") {
                    viewModel.selectedTab = .items
                    // Simulate pressing Add entry in toolbar
                }
                ActionButton(title: "Open Agent Inbox", icon: "tray.and.arrow.down") {
                    viewModel.selectedTab = .inbox
                }
                ActionButton(title: "Normalize All Data", icon: "wand.and.stars") {
                    viewModel.saveWorkingSet()
                }
            }
        }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 0) {
                Text(value)
                    .font(.system(size: 32, weight: .bold, design: .monospaced))
                Text(title)
                    .font(.caption)
                    .bold()
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(TradeOSTheme.cardBackground)
        .cornerRadius(TradeOSTheme.cornerRadius)
        .overlay(
            RoundedRectangle(cornerRadius: TradeOSTheme.cornerRadius)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
    }
}

struct ActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                Text(title)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
            }
            .padding()
            .background(TradeOSTheme.cardBackground)
            .cornerRadius(TradeOSTheme.cornerRadius)
        }
        .buttonStyle(.plain)
    }
}
