import fs from "node:fs";
import path from "node:path";

export interface DocumentFrameBrand {
  companyName: string;
  tagline: string;
  logoUrl: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  typography: {
    style: string;
    headingFontFamily: string;
    bodyFontFamily: string;
    accentFontFamily: string;
  };
  websiteUrl: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  licenseNumber: string;
  insuranceSummary: string;
  bondingSummary: string;
  serviceAreas: string[];
  certifications: string[];
  showPoweredByTradeOS: boolean;
  showLicenseNumber?: boolean;
  showInsuranceSummary?: boolean;
}

export interface DocumentFrameContext {
  eyebrow: string;
  title: string;
  subtitle: string;
  badges: string[];
  projectMeta: Array<{ label: string; value: string }>;
  customerMeta: Array<{ label: string; value: string }>;
  heroMetric: {
    label: string;
    value: string;
    meta: string;
  };
  sections: Array<{
    title: string;
    body?: string;
    bullets?: string[];
    note?: string;
  }>;
  table?: {
    columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
    rows: Array<Record<string, string>>;
  };
  footerNote?: string;
}

let cachedFrameCss: string | null = null;

export function renderDocumentFrameHtml(brand: DocumentFrameBrand, context: DocumentFrameContext): string {
  const colors = {
    primary: safeHex(brand.colors.primary, "#0f172a"),
    secondary: safeHex(brand.colors.secondary, "#f8fafc"),
    accent: safeHex(brand.colors.accent, "#f97316"),
  };
  const typography = {
    heading: safeFontFamily(brand.typography.headingFontFamily, "Arial, sans-serif"),
    body: safeFontFamily(brand.typography.bodyFontFamily, "Arial, sans-serif"),
    accent: safeFontFamily(brand.typography.accentFontFamily, "Arial, sans-serif"),
  };
  const logoUrl = safeAssetUrl(brand.logoUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(context.title)} | ${escapeHtml(brand.companyName)}</title>
    <style>${getFrameCss()}</style>
    <style>
      :root {
        --frame-primary: ${colors.primary};
        --frame-secondary: ${colors.secondary};
        --frame-accent: ${colors.accent};
        --frame-ink: #0f172a;
        --frame-muted: #475569;
        --frame-heading-font: ${typography.heading};
        --frame-body-font: ${typography.body};
        --frame-accent-font: ${typography.accent};
      }
    </style>
  </head>
  <body>
    <article class="frame-page">
      <div class="frame-shell">
        <header class="frame-header">
          <div>
            <p class="frame-eyebrow">${escapeHtml(context.eyebrow)}</p>
            <h1 class="frame-title">${escapeHtml(context.title)}</h1>
            <p class="frame-subtitle">${escapeHtml(context.subtitle)}</p>
            ${context.badges.length ? `<div class="frame-badge-cluster">${context.badges.map((badge) => `<span class="frame-badge">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="frame-brand">
            ${logoUrl ? `<img class="frame-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brand.companyName)} logo" />` : ""}
            <div class="frame-company">
              <p class="frame-company-name">${escapeHtml(brand.companyName)}</p>
              <p class="frame-company-meta">${escapeHtml(joinBrandMeta(brand))}</p>
            </div>
          </div>
        </header>
        <main class="frame-main">
          <section class="frame-grid frame-grid--two">
            <div class="frame-card">
              <h2 class="frame-card-title">Customer</h2>
              <div class="frame-kv">${context.customerMeta.map(renderKvRow).join("")}</div>
            </div>
            <div class="frame-card">
              <h2 class="frame-card-title">Project</h2>
              <div class="frame-kv">${context.projectMeta.map(renderKvRow).join("")}</div>
            </div>
          </section>

          <section class="frame-hero-metric frame-section">
            <div class="frame-hero-label">${escapeHtml(context.heroMetric.label)}</div>
            <div class="frame-hero-value">${escapeHtml(context.heroMetric.value)}</div>
            <div class="frame-hero-meta">${escapeHtml(context.heroMetric.meta)}</div>
          </section>

          ${
            context.table
              ? `<section class="frame-section">
              <h2 class="frame-section-title">Line Items</h2>
              <table class="frame-table">
                <thead>
                  <tr>${context.table.columns
                    .map((column) => `<th class="${column.align === "right" ? "is-number" : ""}">${escapeHtml(column.label)}</th>`)
                    .join("")}</tr>
                </thead>
                <tbody>
                  ${context.table.rows
                    .map(
                      (row) => `<tr>${context.table!.columns
                        .map((column) => `<td class="${column.align === "right" ? "is-number" : ""}">${escapeHtml(row[column.key] ?? "")}</td>`)
                        .join("")}</tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </section>`
              : ""
          }

          ${context.sections
            .map(
              (section) => `<section class="frame-section">
                <h2 class="frame-section-title">${escapeHtml(section.title)}</h2>
                ${section.body ? `<div class="frame-section-body">${paragraphs(section.body)}</div>` : ""}
                ${section.bullets?.length ? `<ul class="frame-list frame-section-body">${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
                ${section.note ? `<div class="frame-note">${escapeHtml(section.note)}</div>` : ""}
              </section>`
            )
            .join("")}

          <footer class="frame-footer">
            <div>
              <div>${escapeHtml(formatContactLine(brand))}</div>
              <div>${escapeHtml(context.footerNote ?? defaultFooterNote(brand))}</div>
            </div>
            <div class="frame-powered">${brand.showPoweredByTradeOS ? "Powered by TradeOS" : "White-label client document"}</div>
          </footer>
        </main>
      </div>
    </article>
  </body>
</html>`;
}

function renderKvRow(item: { label: string; value: string }) {
  return `<div class="frame-kv-row"><span class="frame-kv-label">${escapeHtml(item.label)}</span><span class="frame-kv-value">${escapeHtml(item.value)}</span></div>`;
}

function paragraphs(text: string) {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function joinBrandMeta(brand: DocumentFrameBrand) {
  return [brand.phone, brand.email, brand.websiteUrl].filter(Boolean).join(" • ");
}

function formatContactLine(brand: DocumentFrameBrand) {
  return [
    brand.addressLine1,
    brand.addressLine2,
    [brand.city, brand.state].filter(Boolean).join(", "),
    brand.postalCode,
  ]
    .filter(Boolean)
    .join(" • ");
}

function defaultFooterNote(brand: DocumentFrameBrand) {
  return [
    brand.showLicenseNumber !== false ? brand.licenseNumber : "",
    brand.showInsuranceSummary !== false ? brand.insuranceSummary : "",
    brand.showInsuranceSummary !== false ? brand.bondingSummary : "",
  ]
    .filter(Boolean)
    .join(" • ");
}

function getFrameCss() {
  if (cachedFrameCss) return cachedFrameCss;
  const cssPath = path.resolve(process.cwd(), "modules/documents/frame.css");
  cachedFrameCss = fs.readFileSync(cssPath, "utf8");
  return cachedFrameCss;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHex(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeFontFamily(value: string, fallback: string) {
  return /^[a-z0-9 ,"'_-]+$/i.test(value) ? value : fallback;
}

function safeAssetUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
