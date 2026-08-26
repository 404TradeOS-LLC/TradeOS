import SwiftUI

struct AssemblyDetailView: View {
    @Binding var assembly: Assembly
    var viewModel: CostBookViewModel
    
    @State private var showingAddProduct = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(assembly.name)
                        .font(.system(size: 28, weight: .bold))
                    Text(assembly.category)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
                .padding(.top, 24)
                
                // Form Sections
                VStack(spacing: 20) {
                    GroupBox {
                        VStack(spacing: 12) {
                            LabeledContent("Assembly Name") {
                                TextField("Name", text: $assembly.name)
                                    .textFieldStyle(.roundedBorder)
                                    .multilineTextAlignment(.trailing)
                            }
                            Divider()
                            LabeledContent("Category") {
                                TextField("Category", text: $assembly.category)
                                    .textFieldStyle(.roundedBorder)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        .padding(8)
                    } label: {
                        Label("Assembly Information", systemImage: "folder.fill")
                            .foregroundStyle(TradeOSTheme.accent)
                    }
                    
                    // Line Items Section
                    GroupBox {
                        VStack(spacing: 0) {
                            if assembly.lineItems.isEmpty {
                                Text("No items in this assembly.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .padding(.vertical, 20)
                            } else {
                                ForEach($assembly.lineItems) { $lineItem in
                                    AssemblyLineItemRow(lineItem: $lineItem, viewModel: viewModel) {
                                        removeLineItem(lineItem)
                                    }
                                    if lineItem.id != assembly.lineItems.last?.id {
                                        Divider().padding(.vertical, 8)
                                    }
                                }
                            }
                            
                            Divider().padding(.vertical, 8)
                            
                            Button(action: {
                                showingAddProduct = true
                            }) {
                                Label("Add Item to Assembly", systemImage: "plus.circle.fill")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(TradeOSTheme.accent)
                        }
                        .padding(8)
                    } label: {
                        Label("Included Components", systemImage: "shippingbox.fill")
                            .foregroundStyle(TradeOSTheme.accent)
                    }
                    
                    // Total Calculation
                    GroupBox {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Total Assembly Cost")
                                    .font(.headline)
                                Text("Calculated from all component labor/material costs")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(calculateTotal().formatted(.currency(code: "USD")))
                                .font(.system(size: 24, weight: .bold, design: .monospaced))
                                .foregroundStyle(.green)
                        }
                        .padding(8)
                    }
                }
                .padding(.horizontal)
                
                // Action Bar
                HStack(spacing: 16) {
                    Button(action: {
                        viewModel.selectedAssembly = nil
                    }) {
                        Text("Close")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    
                    Button(action: {
                        viewModel.saveWorkingSet()
                    }) {
                        Text("Save Assembly")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TradeOSTheme.accent)
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
        }
        .background(Color(NSColor.windowBackgroundColor).opacity(0.3))
        .sheet(isPresented: $showingAddProduct) {
            ItemSelectionSheet(viewModel: viewModel) { item in
                let newLineItem = AssemblyLineItem(costBookItemId: item.id, quantity: 1.0)
                assembly.lineItems.append(newLineItem)
            }
        }
    }
    
    private func removeLineItem(_ lineItem: AssemblyLineItem) {
        assembly.lineItems.removeAll(where: { $0.id == lineItem.id })
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

struct AssemblyLineItemRow: View {
    @Binding var lineItem: AssemblyLineItem
    var viewModel: CostBookViewModel
    var onRemove: () -> Void
    
    var body: some View {
        HStack {
            if let item = viewModel.items.first(where: { $0.id == lineItem.costBookItemId }) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.subheadline).bold()
                    Text("\(item.category) • \(item.unit)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    HStack {
                        Text("Qty:")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("Qty", value: $lineItem.quantity, format: .number)
                            .textFieldStyle(.plain)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 40)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(4)
                    }
                    
                    Text((item.totalCost * lineItem.quantity).formatted(.currency(code: "USD")))
                        .font(.caption.monospaced())
                        .foregroundStyle(TradeOSTheme.accent)
                }
                
                Button(action: onRemove) {
                    Image(systemName: "trash")
                        .foregroundStyle(.red)
                }
                .buttonStyle(.plain)
                .padding(.leading, 8)
            }
        }
    }
}

struct ItemSelectionSheet: View {
    var viewModel: CostBookViewModel
    var onSelect: (CostBookItem) -> Void
    @Environment(\.dismiss) var dismiss
    
    @State private var searchText = ""
    
    var filteredItems: [CostBookItem] {
        if searchText.isEmpty { return viewModel.items }
        return viewModel.items.filter { 
            $0.name.localizedCaseInsensitiveContains(searchText) || 
            $0.category.localizedCaseInsensitiveContains(searchText) 
        }
    }
    
    var body: some View {
        NavigationStack {
            List(filteredItems) { item in
                Button(action: {
                    onSelect(item)
                    dismiss()
                }) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(item.name).bold()
                            Text(item.category).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(item.formattedTotal).font(.caption.monospaced())
                    }
                }
                .buttonStyle(.plain)
            }
            .searchable(text: $searchText)
            .navigationTitle("Select Component")
            .toolbar {
                Button("Done") { dismiss() }
            }
        }
        .frame(width: 400, height: 500)
    }
}
