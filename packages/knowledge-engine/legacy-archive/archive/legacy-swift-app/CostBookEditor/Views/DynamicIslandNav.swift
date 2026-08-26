import SwiftUI

struct DynamicIslandNav: View {
    @Bindable var viewModel: CostBookViewModel
    @State private var isExpanded = false
    
    var body: some View {
        HStack(spacing: 0) {
            if isExpanded {
                HStack(spacing: 32) {
                    DesktopNavIcon(icon: "list.bullet.rectangle", label: "Items", isActive: viewModel.selectedTab == .items) {
                        viewModel.selectedTab = .items
                    }
                    
                    DesktopNavIcon(icon: "square.stack.3d.up", label: "Assemblies", isActive: viewModel.selectedTab == .assemblies) {
                        viewModel.selectedTab = .assemblies
                    }
                    
                    Button(action: { viewModel.publishToProduction() }) {
                        Circle()
                            .fill(TradeOSTheme.accent)
                            .frame(width: 54, height: 54)
                            .overlay(Image(systemName: "arrow.up.to.line.circle").font(.title2).bold())
                            .shadow(color: TradeOSTheme.accent.opacity(0.4), radius: 10)
                    }
                    .buttonStyle(.plain)
                    
                    DesktopNavIcon(icon: "tray.and.arrow.down", label: "Agents", isActive: viewModel.selectedTab == .inbox) {
                        viewModel.selectedTab = .inbox
                    }
                    
                    DesktopNavIcon(icon: "gearshape", label: "System", isActive: false) {
                        // Settings
                    }
                }
                .padding(.horizontal, 32)
                .transition(.scale.combined(with: .opacity))
            } else {
                HStack(spacing: 16) {
                    Image(systemName: "sparkles")
                        .foregroundColor(TradeOSTheme.accent)
                    Text("Orchestrator Active")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    Circle()
                        .fill(.green)
                        .frame(width: 8, height: 8)
                }
                .padding(.horizontal, 24)
            }
        }
        .frame(height: 72)
        .frame(maxWidth: isExpanded ? 500 : 240)
        .background(.ultraThinMaterial)
        .background(TradeOSTheme.surface)
        .cornerRadius(36)
        .overlay(
            RoundedRectangle(cornerRadius: 36)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
        .padding(.bottom, 32)
        .shadow(color: .black.opacity(0.5), radius: 30)
        .onTapGesture {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                isExpanded.toggle()
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                withAnimation(.spring()) { isExpanded = true }
            }
        }
    }
}

struct DesktopNavIcon: View {
    let icon: String
    let label: String
    let isActive: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title3)
                Text(label)
                    .font(.system(size: 10, weight: .bold))
            }
            .foregroundColor(isActive ? TradeOSTheme.accent : .white.opacity(0.6))
            .frame(width: 60)
        }
        .buttonStyle(.plain)
    }
}
