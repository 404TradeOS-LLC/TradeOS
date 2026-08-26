import SwiftUI

struct AgentInboxView: View {
    @Bindable var viewModel: CostBookViewModel
    @State private var selectedInboxItem: CostBookItem?
    
    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                HStack {
                    Text("\(viewModel.rawInboxItems.count) New Items")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                
                List(selection: $selectedInboxItem) {
                    ForEach(viewModel.rawInboxItems) { item in
                        CostItemRow(item: item)
                            .tag(item)
                    }
                }
                .listStyle(.inset)
            }
            .frame(minWidth: 320, idealWidth: 350)
            
            Divider()
            
            if let selected = selectedInboxItem {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // Header
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("New Proposal")
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(TradeOSTheme.secondaryAccent.opacity(0.2))
                                    .foregroundStyle(TradeOSTheme.secondaryAccent)
                                    .clipShape(Capsule())
                                Spacer()
                            }
                            
                            Text(selected.name)
                                .font(.system(size: 28, weight: .bold))
                            Text(selected.category)
                                .font(.title3)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)
                        .padding(.top, 24)
                        
                        // Comparison Panel
                        GroupBox {
                            VStack(spacing: 16) {
                                LabeledItemValue(label: "Unit", value: selected.unit)
                                Divider()
                                LabeledItemValue(label: "Labor", value: selected.laborCostFormatted)
                                LabeledItemValue(label: "Material", value: selected.materialCostFormatted)
                                LabeledItemValue(label: "Equipment", value: selected.equipmentCostFormatted)
                                
                                Divider()
                                
                                HStack {
                                    Text("Estimated Total")
                                        .font(.headline)
                                    Spacer()
                                    Text(selected.formattedTotal)
                                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                                        .foregroundStyle(TradeOSTheme.accent)
                                }
                            }
                            .padding(8)
                        } label: {
                            Label("Proposed Specifications", systemImage: "sparkles")
                                .foregroundStyle(TradeOSTheme.secondaryAccent)
                        }
                        .padding(.horizontal)
                        
                        if let notes = selected.notes {
                            GroupBox {
                                Text(notes)
                                    .font(.body)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(8)
                            } label: {
                                Label("Agent Notes", systemImage: "bubble.left.and.exclamationmark.bubble.right.fill")
                                    .foregroundStyle(TradeOSTheme.secondaryAccent)
                            }
                            .padding(.horizontal)
                        }
                        
                        // Action Bar
                        HStack(spacing: 16) {
                            Button(action: {
                                withAnimation {
                                    viewModel.reject(item: selected)
                                    selectedInboxItem = nil
                                }
                            }) {
                                Label("Reject Item", systemImage: "xmark.circle")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)
                            
                            Button(action: {
                                withAnimation {
                                    viewModel.approve(item: selected)
                                    selectedInboxItem = nil
                                }
                            }) {
                                Label("Approve & Add", systemImage: "checkmark.seal")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 32)
                    }
                }
                .frame(maxWidth: .infinity)
                .background(Color(NSColor.windowBackgroundColor).opacity(0.3))
            } else {
                EmptyStateView(title: "Inbox Zero", subtitle: "No more pending proposals from the agent network. Run the sync tool to fetch new data.")
            }
        }
        .toolbar {
            ToolbarView(viewModel: viewModel)
        }
    }
}

struct LabeledItemValue: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .bold()
        }
    }
}
