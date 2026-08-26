import SwiftUI

struct AssemblyBuilderView: View {
    @Bindable var viewModel: CostBookViewModel
    @State private var searchText = ""
    
    var filteredAssemblies: [Assembly] {
        if searchText.isEmpty {
            return viewModel.assemblies.sorted { $0.category < $1.category }
        } else {
            return viewModel.assemblies.filter { $0.name.localizedCaseInsensitiveContains(searchText) || $0.category.localizedCaseInsensitiveContains(searchText) }
                .sorted { $0.category < $1.category }
        }
    }
    
    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                HStack {
                    Text("\(filteredAssemblies.count) Assemblies")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                
                List(selection: $viewModel.selectedAssembly) {
                    ForEach(filteredAssemblies) { assembly in
                        AssemblyRow(assembly: assembly, viewModel: viewModel)
                            .tag(assembly)
                    }
                    .onDelete(perform: viewModel.deleteAssemblies)
                }
                .listStyle(.inset)
                .searchable(text: $searchText, prompt: "Search assemblies...")
            }
            .frame(minWidth: 320, idealWidth: 350)
            
            Divider()
            
            if let selected = viewModel.selectedAssembly, let index = viewModel.assemblies.firstIndex(where: { $0.id == selected.id }) {
                AssemblyDetailView(assembly: $viewModel.assemblies[index], viewModel: viewModel)
                    .transition(.asymmetric(insertion: .push(from: .trailing), removal: .opacity))
            } else {
                EmptyStateView(title: "Select an Assembly", subtitle: "Choose an assembly to view its component tree, modify quantities, and check total system pricing.")
            }
        }
        .toolbar {
            ToolbarView(viewModel: viewModel)
        }
        .animation(.spring(), value: viewModel.selectedAssembly)
    }
}

struct AssemblyRow: View {
    let assembly: Assembly
    var viewModel: CostBookViewModel
    
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Rectangle()
                    .fill(TradeOSTheme.accent.opacity(0.1))
                    .frame(width: 40, height: 40)
                    .cornerRadius(8)
                Image(systemName: "square.stack.3d.up.fill")
                    .foregroundStyle(TradeOSTheme.accent)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(assembly.name)
                    .font(.system(size: 14, weight: .semibold))
                Text("\(assembly.category) • \(assembly.lineItems.count) items")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Text(calculateTotal().formatted(.currency(code: "USD")))
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(.green)
        }
        .padding(.vertical, 4)
    }
    
    private func calculateTotal() -> Double {
        var total = 0.0
        for lineItem in assembly.lineItems {
            if let item = viewModel.items.first(where: { $0.id == lineItem.costBookItemId }) {
                total += item.totalCost * lineItem.quantity
            }
        }
        return total
    }
}
