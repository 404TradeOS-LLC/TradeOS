import SwiftUI

struct ToolbarView: ToolbarContent {
    @Bindable var viewModel: CostBookViewModel
    
    var body: some ToolbarContent {
        ToolbarItemGroup {
            Button(action: {
                if viewModel.selectedTab == .items {
                    let newItem = CostBookItem(id: UUID(), name: "New Item", category: "Uncategorized", unit: "Ea", laborCost: 0, materialCost: 0, equipmentCost: 0)
                    viewModel.items.append(newItem)
                    viewModel.selectedItem = newItem
                } else if viewModel.selectedTab == .assemblies {
                    let newAssembly = Assembly(id: UUID(), name: "New Assembly", category: "Uncategorized", lineItems: [])
                    viewModel.assemblies.append(newAssembly)
                    viewModel.selectedAssembly = newAssembly
                }
            }) {
                Label("Add Entry", systemImage: "plus")
            }
            .disabled(viewModel.selectedTab == .inbox)
            
            Button(action: {
                // Let's validate all items manually to simulate global check
                do {
                    for item in viewModel.items {
                        try ValidationService.validate(item: item, existingItems: viewModel.items)
                    }
                    viewModel.saveWorkingSet()
                } catch {
                    viewModel.showAlert(message: "Validation Error: \(error.localizedDescription)")
                }
            }) {
                Label("Save Local", systemImage: "square.and.arrow.down")
            }
            
            Button(action: {
                viewModel.export()
            }) {
                Label("Export", systemImage: "square.and.arrow.up")
            }
            .tint(.blue)
        }
    }
}
