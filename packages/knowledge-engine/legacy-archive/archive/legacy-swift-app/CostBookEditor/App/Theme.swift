import SwiftUI

enum TradeOSTheme {
    static let primary = Color(hex: "1E3A8A")
    static let secondary = Color(hex: "24294C")
    static let accent = Color(hex: "3B82F6")
    static let text = Color(hex: "353942")
    static let black = Color(hex: "000000")
    static let white = Color(hex: "FFFFFF")
    
    static let background = Color(hex: "020617") // Deep Slate/Black
    static let surface = Color.white.opacity(0.05)
    
    static let cornerRadius: CGFloat = 24
    static let standardPadding: CGFloat = 24
}

extension View {
    func premiumCard() -> some View {
        self.padding(TradeOSTheme.standardPadding)
            .background(TradeOSTheme.surface)
            .background(.ultraThinMaterial)
            .cornerRadius(TradeOSTheme.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: TradeOSTheme.cornerRadius)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
    }
    
    func glassPanel() -> some View {
        self.background(.ultraThinMaterial)
            .background(TradeOSTheme.surface)
            .cornerRadius(TradeOSTheme.cornerRadius)
    }

    func liquidGlass() -> some View {
        modifier(TradeOSGlassModifier())
    }
}

struct TradeOSGlassModifier: ViewModifier {
    @State private var phase: CGFloat = 0
    func body(content: some View) -> some View {
        content
            .background(
                ZStack {
                    LinearGradient(colors: [TradeOSTheme.secondary, TradeOSTheme.primary], startPoint: .topLeading, endPoint: .bottomTrailing)
                    
                    Circle()
                        .fill(TradeOSTheme.accent.opacity(0.15))
                        .frame(width: 400, height: 400)
                        .blur(radius: 80)
                        .offset(x: phase, y: -phase)
                }
            )
            .background(.ultraThinMaterial)
            .onAppear {
                withAnimation(.linear(duration: 20).repeatForever(autoreverses: true)) {
                    phase = 100
                }
            }
    }
}
