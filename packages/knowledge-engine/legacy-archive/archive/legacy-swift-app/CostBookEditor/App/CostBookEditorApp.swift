import SwiftUI

@main
struct CostBookEditorApp: App {
    @State private var viewModel = CostBookViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView(viewModel: viewModel)
                .frame(minWidth: 1000, minHeight: 700)
                .accentColor(TradeOSTheme.accent)
                .preferredColorScheme(.dark)
        }
        .commands {
            SidebarCommands()
            CommandGroup(replacing: .newItem) {
                Button("New Cost Item") {
                    let newItem = CostBookItem(id: UUID(), name: "New Item", category: "Uncategorized", unit: "Ea", laborCost: 0, materialCost: 0, equipmentCost: 0)
                    viewModel.items.append(newItem)
                    viewModel.selectedItem = newItem
                    viewModel.selectedTab = .items
                }
                .keyboardShortcut("n", modifiers: .command)
                
                Button("New Assembly") {
                    let newAssembly = Assembly(id: UUID(), name: "New Assembly", category: "Uncategorized", lineItems: [])
                    viewModel.assemblies.append(newAssembly)
                    viewModel.selectedAssembly = newAssembly
                    viewModel.selectedTab = .assemblies
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            }
            
            CommandGroup(after: .saveItem) {
                Button("Save Working Set") {
                    viewModel.saveWorkingSet()
                }
                .keyboardShortcut("s", modifiers: .command)
            }
        }
    }
}

struct ContentView: View {
    @Bindable var viewModel: CostBookViewModel
    
    var body: some View {
        NavigationSplitView {
            SidebarView(viewModel: viewModel)
        } detail: {
            Group {
                switch viewModel.selectedTab {
                case .dashboard:
                    DashboardView(viewModel: viewModel)
                case .items:
                    ItemListView(viewModel: viewModel)
                case .assemblies:
                    AssemblyBuilderView(viewModel: viewModel)
                case .inbox:
                    AgentInboxView(viewModel: viewModel)
                }
            }
            .animation(.spring(duration: 0.3), value: viewModel.selectedTab)
            .frame(minWidth: 600)
        }
    }
}
