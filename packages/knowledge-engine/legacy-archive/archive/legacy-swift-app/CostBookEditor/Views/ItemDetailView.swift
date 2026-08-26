import SwiftUI

struct ItemDetailView: View {
    @Binding var item: CostBookItem
    var viewModel: CostBookViewModel
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header Panel
                VStack(alignment: .leading, spacing: 8) {
                    Text(item.name)
                        .font(.system(size: 28, weight: .bold))
                    Text(item.category)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
                .padding(.top, 24)
                
                // Form Sections
                VStack(spacing: 20) {
                    // Identity Section
                    GroupBox {
                        VStack(spacing: 12) {
                            LabeledContent("Item Name") {
                                TextField("e.g. 1/2 in. Drywall", text: $item.name)
                                    .textFieldStyle(.roundedBorder)
                                    .multilineTextAlignment(.trailing)
                            }
                            Divider()
                            LabeledContent("Category") {
                                TextField("e.g. Drywall", text: $item.category)
                                    .textFieldStyle(.roundedBorder)
                                    .multilineTextAlignment(.trailing)
                            }
                            Divider()
                            LabeledContent("Unit") {
                                TextField("e.g. SF", text: $item.unit)
                                    .textFieldStyle(.roundedBorder)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        .padding(8)
                    } label: {
                        Label("General Information", systemImage: "info.circle")
                            .foregroundStyle(TradeOSTheme.accent)
                    }
                    
                    // Cost Vector Section
                    GroupBox {
                        VStack(spacing: 16) {
                            CostInputRow(label: "Labor Cost", value: $item.laborCost, icon: "person.fill")
                            CostInputRow(label: "Material Cost", value: $item.materialCost, icon: "shippingbox.fill")
                            CostInputRow(label: "Equipment Cost", value: $item.equipmentCost, icon: "hammer.fill")
                            
                            Divider()
                            
                            HStack {
                                Text("Total Calculated Cost")
                                    .font(.headline)
                                Spacer()
                                Text(item.formattedTotal)
                                    .font(.system(size: 20, weight: .bold, design: .monospaced))
                                    .foregroundStyle(TradeOSTheme.accent)
                            }
                            .padding(.top, 4)
                        }
                        .padding(8)
                    } label: {
                        Label("Cost Matrix (Per \(item.unit))", systemImage: "chart.bar.xaxis")
                            .foregroundStyle(TradeOSTheme.accent)
                    }
                    
                    // Notes Section
                    GroupBox {
                        TextEditor(text: Binding(
                            get: { item.notes ?? "" },
                            set: { item.notes = $0.isEmpty ? nil : $0 }
                        ))
                        .frame(minHeight: 100)
                        .font(.body)
                    } label: {
                        Label("Notes & Specifications", systemImage: "note.text")
                            .foregroundStyle(TradeOSTheme.accent)
                    }
                }
                .padding(.horizontal)
                
                // Final Action Bar
                HStack(spacing: 16) {
                    Button(action: {
                        viewModel.selectedItem = nil
                    }) {
                        Text("Deselect")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    
                    Button(action: {
                        viewModel.saveWorkingSet()
                    }) {
                        Text("Save Changes")
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
    }
}

struct CostInputRow: View {
    let label: String
    @Binding var value: Double
    let icon: String
    
    var body: some View {
        HStack {
            Label(label, systemImage: icon)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            TextField("0.00", value: $value, format: .number.precision(.fractionLength(2)))
                .textFieldStyle(.roundedBorder)
                .multilineTextAlignment(.trailing)
                .frame(width: 100)
            Text("USD")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }
}
