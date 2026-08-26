import SwiftUI

struct SidebarView: View {
    @Bindable var viewModel: CostBookViewModel
    
    var body: some View {
        List(selection: $viewModel.selectedTab) {
            Section {
                Label("Dashboard", systemImage: "gauge.with.needle.fill")
                    .tag(AppTab.dashboard)
                    .foregroundStyle(viewModel.selectedTab == .dashboard ? TradeOSTheme.accent : .primary)
                    
                Label("Cost Items", systemImage: "list.dash")
                    .tag(AppTab.items)
                    .foregroundStyle(viewModel.selectedTab == .items ? TradeOSTheme.accent : .primary)
                
                Label("Assemblies", systemImage: "square.stack.3d.up.fill")
                    .tag(AppTab.assemblies)
                    .foregroundStyle(viewModel.selectedTab == .assemblies ? TradeOSTheme.accent : .primary)
            } header: {
                Text("Management").font(.caption).bold().foregroundColor(.secondary)
            }
            
            Section {
                Label("Agent Inbox", systemImage: "tray.and.arrow.down.fill")
                    .tag(AppTab.inbox)
                    .badge(viewModel.rawInboxItems.count)
                    .foregroundStyle(viewModel.selectedTab == .inbox ? TradeOSTheme.secondaryAccent : .primary)
            } header: {
                Text("Inbox").font(.caption).bold().foregroundColor(.secondary)
            }
        }
        #if os(macOS)
        .listStyle(.sidebar)
        #endif
        .navigationTitle("TradeOS")
        .accentColor(TradeOSTheme.accent)
        .alert(viewModel.alertMessage, isPresented: $viewModel.isShowingAlert) {
            Button("OK", role: .cancel) { }
        }
    }
}
