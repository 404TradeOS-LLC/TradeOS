import SwiftUI

struct TradeOSDashboardHero: View {
    var title: String = "Command Center"
    @State private var radarRotation: Double = 0
    
    var body: some View {
        TradeOSCard(padding: 24) {
            HStack(alignment: .top, spacing: 32) {
                // Left: Identity & Time
                VStack(alignment: .leading, spacing: 8) {
                    Text(title)
                        .font(.system(size: 40, weight: .black))
                        .foregroundColor(.white)
                    
                    HStack(spacing: 12) {
                        Label("Current Site: Remote", systemImage: "location.fill")
                        Text("•")
                        Label("72°F & Clear", systemImage: "sun.max.fill")
                    }
                    .font(.subheadline)
                    .foregroundColor(TradeOSTheme.accent)
                    
                    Spacer()
                    
                    HStack(spacing: 40) {
                        VStack(alignment: .leading) {
                            Text("PIPELINE HEALTH")
                                .font(.caption.bold())
                                .foregroundColor(.white.opacity(0.4))
                            Text("98.4%")
                                .font(.system(size: 24, weight: .bold, design: .monospaced))
                        }
                        
                        VStack(alignment: .leading) {
                            Text("ACTIVE AGENTS")
                                .font(.caption.bold())
                                .foregroundColor(.white.opacity(0.4))
                            Text("12/12")
                                .font(.system(size: 24, weight: .bold, design: .monospaced))
                        }
                    }
                }
                
                Spacer()
                
                // Right: Radar & Precip (The Vibe)
                VStack(alignment: .trailing, spacing: 16) {
                    ZStack {
                        Circle()
                            .stroke(TradeOSTheme.accent.opacity(0.2), lineWidth: 1)
                            .frame(width: 140, height: 140)
                        
                        Circle()
                            .trim(from: 0, to: 0.25)
                            .stroke(
                                AngularGradient(colors: [TradeOSTheme.accent, .clear], center: .center),
                                style: StrokeStyle(lineWidth: 40, lineCap: .round)
                            )
                            .frame(width: 100, height: 100)
                            .rotationEffect(.degrees(radarRotation))
                        
                        // Blips
                        Circle()
                            .fill(.green)
                            .frame(width: 6, height: 6)
                            .offset(x: 30, y: -20)
                            .blur(radius: 2)
                    }
                    .onAppear {
                        withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
                            radarRotation = 360
                        }
                    }
                    
                    Text("DOPPLER LIVE • NEW YORK")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(TradeOSTheme.accent)
                }
            }
        }
    }
}

// Reusable Material Card for Desktop
struct TradeOSCard<Content: View>: View {
    let padding: CGFloat
    let content: Content
    
    init(padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(padding)
            .background(TradeOSTheme.surface)
            .background(.ultraThinMaterial)
            .cornerRadius(TradeOSTheme.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: TradeOSTheme.cornerRadius)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
    }
}
