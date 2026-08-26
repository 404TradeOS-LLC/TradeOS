const Components = {
    dashboardHero: (greeting) => `
        <div class="card" data-comp-type="hero">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <div style="font-size: 12px; color: var(--trade-accent); font-weight: 800; margin-bottom: 4px;">LIVE COMMAND</div>
                    <div style="font-size: 32px; font-weight: 800; letter-spacing: -1px;">${greeting}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 800;">72°F</div>
                    <div style="font-size: 12px; opacity: 0.6;">Precip: 40%</div>
                </div>
            </div>
            <div style="display: flex; gap: 16px;">
                <div style="flex: 1; background: rgba(0,0,0,0.2); padding: 16px; border-radius: 16px;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--trade-accent); margin-bottom: 12px;">PRECIPITATION MAP</div>
                    <div style="display: flex; gap: 4px; align-items: flex-end; height: 40px;">
                        ${[20,40,60,30,80,40,20,10,30,50].map(h => `<div style="flex: 1; height: ${h}%; background: var(--trade-accent); border-radius: 2px; opacity: 0.4;"></div>`).join('')}
                    </div>
                </div>
                <div class="radar-circle" style="flex-shrink: 0;">
                    <div class="radar-sweep"></div>
                    <div style="position: absolute; top: 30%; left: 40%; width: 6px; height: 6px; background: #4ade80; border-radius: 50%; blur: 2px;"></div>
                </div>
            </div>
        </div>
    `,

    productivityGrid: () => `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
            <div class="card" style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                    <span style="font-size: 11px; font-weight: 800; opacity: 0.6;">SCHEDULE</span>
                    <span style="font-size: 11px; color: var(--trade-accent);">APR 21</span>
                </div>
                <div style="font-size: 13px; font-weight: 600;">
                    <div style="margin-bottom: 8px; color: var(--trade-accent);">• 08:00 AM Site Visit</div>
                    <div style="margin-bottom: 8px; opacity: 0.8;">• 10:30 AM Concrete Pour</div>
                    <div style="opacity: 0.8;">• 02:00 PM Client Review</div>
                </div>
            </div>
            <div class="card" style="padding: 20px;">
                <div style="font-size: 11px; font-weight: 800; opacity: 0.6; margin-bottom: 16px;">DAILY NOTES</div>
                <div style="font-size: 13px; font-weight: 500; opacity: 0.8; line-height: 1.6;">
                    - Check rebar spacing<br>
                    - Verify window specs<br>
                    - Material disposal Fri
                </div>
            </div>
        </div>
    `,

    statCard: (title, value, icon, colorClass = 'accent') => `
        <div class="card stat-card" data-comp-type="stat-card">
            <div style="font-size: 24px; color: var(--trade-${colorClass}); margin-bottom: 12px;">
                ${icon}
            </div>
            <div style="font-size: 28px; font-weight: 900; font-family: 'JetBrains Mono';">${value}</div>
            <div style="font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px;">${title}</div>
        </div>
    `,

    costItemMini: (name, price, category, unit = 'EA') => `
        <div class="card" style="padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">${name}</div>
                <div class="glass-pill">${category}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-family: 'JetBrains Mono'; font-weight: 800; color: var(--trade-accent);">$${price}</div>
                <div style="font-size: 10px; opacity: 0.5;">per ${unit}</div>
            </div>
        </div>
    `
};

const Icons = {
    list: '📋',
    stack: '📊',
    tags: '🏷️',
    inbox: '📥',
    plus: '➕',
    wand: '🪄',
    chart: '📈',
    money: '💰',
    tool: '🛠️'
};
