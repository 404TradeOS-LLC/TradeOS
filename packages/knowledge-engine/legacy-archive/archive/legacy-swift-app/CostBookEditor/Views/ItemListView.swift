import SwiftUI

struct ItemListView: View {
    @Bindable var viewModel: CostBookViewModel
    @State private var searchText = ""
    
    var filteredItems: [CostBookItem] {
        if searchText.isEmpty {
            return viewModel.items.sorted { $0.category < $1.category }
        } else {
            return viewModel.items.filter { $0.name.localizedCaseInsensitiveContains(searchText) || $0.category.localizedCaseInsensitiveContains(searchText) }
                .sorted { $0.category < $1.category }
        }
    }
    
    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                // Header with Count
                HStack {
                    Text("\(filteredItems.count) Items")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                
                List(selection: $viewModel.selectedItem) {
                    ForEach(filteredItems) { item in
                        CostItemRow(item: item)
                            .tag(item)
                    }
                    .onDelete(perform: viewModel.deleteItems)
                }
                .listStyle(.inset)
                .searchable(text: $searchText, prompt: "Search items, categories, units...")
            }
            .frame(minWidth: 320, idealWidth: 350)
            
            Divider()
            
            if let selected = viewModel.selectedItem, let index = viewModel.items.firstIndex(where: { $0.id == selected.id }) {
                ItemDetailView(item: $viewModel.items[index], viewModel: viewModel)
                    .transition(.asymmetric(insertion: .push(from: .trailing), removal: .opacity))
            } else {
                EmptyStateView(title: "Select an Item", subtitle: "Choose a cost item from the list to edit its properties or view labor/material breakdowns.")
            }
        }
        .toolbar {
            ToolbarView(viewModel: viewModel)
        }
        .animation(.spring(), value: viewModel.selectedItem)
    }
}

struct CostItemRow: View {
    let item: CostBookItem
    
    var body: some View {
        HStack(spacing: 12) {
            // Price Indicator
            VStack(spacing: 4) {
                Text(item.unit)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .padding(4)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(4)
            }
            .frame(width: 45)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.system(size: 14, weight: .semibold))
                Text(item.category)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Text(item.formattedTotal)
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(TradeOSTheme.accent)
        }
        .padding(.vertical, 4)
    }
}

struct EmptyStateView: View {
    let title: String
    let subtitle: String
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 64))
                .foregroundStyle(.quaternary)
            
            Text(title)
                .font(.title2)
                .bold()
            
            Text(subtitle)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 400)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TradeOSTheme.background.opacity(0.05))
    }
}
