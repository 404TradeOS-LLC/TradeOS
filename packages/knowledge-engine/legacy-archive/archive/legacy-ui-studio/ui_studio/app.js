document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const accentPicker = document.getElementById('accent-color');
    const swiftCode = document.getElementById('swift-code');
    const copyBtn = document.getElementById('copy-code');

    // Initial State
    let currentPage = 'dashboard';

    function renderDashboard() {
        pageTitle.innerText = "Good Morning";
        pageSubtitle.innerText = "Apr 21, 2026 • 72°F & Rain";
        
        contentArea.innerHTML = `
            ${Components.dashboardHero('Contractor View')}
            ${Components.productivityGrid()}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                ${Components.statCard('Pipeline Value', '$240,500', '📈')}
                ${Components.statCard('Pending Claims', '12', '📥', 'primary')}
            </div>
        `;
        generateSwiftUI();
    }

    function renderCostLibrary() {
        pageTitle.innerText = "Cost Library";
        pageSubtitle.innerText = "Browse 1,795 construction line items";
        
        contentArea.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                ${TradeOSData.items.map(item => 
                    Components.costItemMini(item.name, item.price.toFixed(2), item.category, item.unit)
                ).join('')}
            </div>
        `;
        generateSwiftUI();
    }

    function startPrecisionSpar() {
        contentArea.innerHTML = `
            <div class="card" style="padding: 48px; text-align: center;">
                <div style="font-size: 11px; font-weight: 800; color: var(--trade-accent); margin-bottom: 24px;">PRECISION SPAR</div>
                <h1 style="font-size: 32px; margin-bottom: 32px;">What type of construction is this?</h1>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="palette-item" style="padding: 24px;">New Build</div>
                    <div class="palette-item" style="padding: 24px;">Renovation</div>
                </div>
                <div style="margin-top: 48px; font-size: 13px; opacity: 0.6;">I'm narrowing down material deltas based on your choice.</div>
            </div>
        `;
        swiftCode.innerText = `// PrecisionSparView.swift Logic...`;
    }

    // SwiftUI Code Generator
    function generateSwiftUI() {
        const accent = accentPicker.value.toUpperCase();
        
        let code = `import SwiftUI\n\n`;
        code += `struct DashboardView: View {\n`;
        code += `    var body: some View {\n`;
        code += `        ZStack {\n`;
        code += `            TradeOSTheme.Color.background.ignoresSafeArea()\n\n`;
        code += `            ScrollView {\n`;
        code += `                VStack(spacing: 30) {\n`;
        code += `                    TradeOSDashboardHero()\n`;
        code += `                    TradeOSProductivityGrid()\n`;
        code += `                }\n`;
        code += `            }\n`;
        code += `            \n`;
        code += `            FloatingNavBar()\n`;
        code += `        }\n`;
        code += `    }\n`;
        code += `}\n\n`;
        code += `extension Color {\n`;
        code += `    static let tradeAccent = Color(hex: "${accent}")\n`;
        code += `}`;
        
        swiftCode.innerText = code;
    }

    // Interaction Handlers
    accentPicker.addEventListener('input', () => {
        document.documentElement.style.setProperty('--trade-accent', accentPicker.value);
        generateSwiftUI();
    });

    // Navigation Logic
    document.querySelectorAll('.nav-item, .nav-btn').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            const action = item.getAttribute('data-action');
            
            if (action === 'new-estimate') {
                startPrecisionSpar();
                return;
            }

            if (page === 'dashboard') renderDashboard();
            else if (page === 'items') renderCostLibrary();
            else {
                contentArea.innerHTML = `<div class="card" style="padding: 100px; text-align: center; opacity: 0.5;">${page.toUpperCase()} PREVIEW</div>`;
            }
        });
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(swiftCode.innerText);
        copyBtn.innerText = 'Copied!';
        setTimeout(() => copyBtn.innerText = 'Copy', 2000);
    });

    // Initialize
    renderDashboard();
});
