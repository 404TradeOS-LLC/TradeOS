"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, LoaderCircle, Palette, ShieldCheck, Sparkles, SwatchBook, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { clientFetch } from "@/lib/clientApi";
import {
  buildLocalBrandPreview,
  defaultBrandAssetDraft,
  type BrandAsset,
  type BrandAssetDraft,
  type BrandLink,
  type BrandStudioSettingsBundle,
  getTypographySpecimen,
  normalizeHexColor,
  typographySpecimens,
} from "@/lib/brand-studio";

interface BrandStudioConsoleProps {
  initialSettings: BrandStudioSettingsBundle;
}

const SCREEN_NAV = [
  { id: "overview", label: "Overview" },
  { id: "colors", label: "Colors" },
  { id: "logos", label: "Logos" },
  { id: "typography", label: "Typography" },
  { id: "trust-signals", label: "Trust Signals" },
  { id: "document-branding", label: "Document Branding" },
  { id: "contact-social", label: "Contact & Social" },
] as const;

export function BrandStudioConsole({ initialSettings }: BrandStudioConsoleProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [assetDraft, setAssetDraft] = useState<BrandAssetDraft>(defaultBrandAssetDraft);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">("info");
  const [isSaving, setIsSaving] = useState(false);
  const [isAssetSaving, setIsAssetSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const livePreview = dirty
    ? buildLocalBrandPreview(settings.profile, settings.documentSettings, settings.assets)
    : settings.preview;
  const selectedTypography = getTypographySpecimen(settings.profile.typographyStyle);

  async function saveAll() {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const [profile, documentSettings, preview] = await Promise.all([
        clientFetch<BrandStudioSettingsBundle["profile"]>("/brand-studio/profile", {
          method: "PUT",
          body: JSON.stringify(settings.profile),
        }),
        clientFetch<BrandStudioSettingsBundle["documentSettings"]>("/brand-studio/document-settings", {
          method: "PUT",
          body: JSON.stringify(settings.documentSettings),
        }),
        clientFetch<BrandStudioSettingsBundle["preview"]>("/brand-studio/preview"),
      ]);

      const nextSettings = {
        ...settings,
        profile,
        documentSettings,
        preview,
      };
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setStatusTone("success");
      setStatusMessage("Brand Studio saved. Document frames, logos, and typography now point to the latest organization skin.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(error instanceof Error ? error.message : "Unable to save Brand Studio right now.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addAsset() {
    setIsAssetSaving(true);
    setStatusMessage(null);
    try {
      const created = await clientFetch<BrandAsset>("/brand-studio/assets", {
        method: "POST",
        body: JSON.stringify({
          type: assetDraft.type,
          label: assetDraft.label,
          url: assetDraft.url,
          mimeType: assetDraft.mimeType || undefined,
          sizeBytes: parseOptionalNumber(assetDraft.sizeBytes),
          width: parseOptionalNumber(assetDraft.width),
          height: parseOptionalNumber(assetDraft.height),
        }),
      });

      const nextAssets = [created, ...settings.assets];
      setSettings((current) => ({
        ...current,
        assets: nextAssets,
        preview: buildLocalBrandPreview(current.profile, current.documentSettings, nextAssets),
      }));
      setAssetDraft(defaultBrandAssetDraft);
      setStatusTone("success");
      setStatusMessage("Asset added to the brand library.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(error instanceof Error ? error.message : "Unable to add this asset.");
    } finally {
      setIsAssetSaving(false);
    }
  }

  function deleteAsset(assetId: string) {
    startTransition(() => {
      void (async () => {
        setStatusMessage(null);
        try {
          await clientFetch<void>(`/brand-studio/assets/${assetId}`, { method: "DELETE" });
          setSettings((current) => {
            const nextAssets = current.assets.filter((asset) => asset.id !== assetId);
            return {
              ...current,
              assets: nextAssets,
              preview: buildLocalBrandPreview(current.profile, current.documentSettings, nextAssets),
            };
          });
          setStatusTone("success");
          setStatusMessage("Asset removed from the brand library.");
        } catch (error) {
          setStatusTone("error");
          setStatusMessage(error instanceof Error ? error.message : "Unable to remove this asset.");
        }
      })();
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <Card className="border border-border/70 bg-[linear-gradient(140deg,rgba(17,24,39,0.03),rgba(217,119,6,0.14),rgba(255,255,255,0.94))]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <SwatchBook className="h-5 w-5 text-electric" />
              Brand Studio
            </CardTitle>
            <CardDescription>
              The contractor owns the skin. TradeOS owns the frame. This is the source of truth every customer-facing document should inherit.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <StatTile label="Completion" value={`${livePreview.completionPercentage}%`} tone="accent" />
            <StatTile label="Missing items" value={`${livePreview.missingSetupItems.length}`} tone={livePreview.missingSetupItems.length ? "warn" : "good"} />
            <StatTile label="Derived logos" value={`${livePreview.derivedLogoVariants.filter((item) => item.url).length}`} tone="good" />
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex flex-wrap gap-2">
              {SCREEN_NAV.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>
            <Button type="button" onClick={saveAll} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Save Brand Studio
            </Button>
          </CardFooter>
        </Card>

        <PreviewCard preview={livePreview} />
      </section>

      {statusMessage ? (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            statusTone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
              : statusTone === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted text-foreground"
          }`}
        >
          {statusTone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <Card id="overview">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>The highest-leverage setup issues to close before proposals, closeout packets, and warranties go customer-facing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current identity</div>
                <div className="mt-2 text-2xl font-semibold">{settings.profile.companyDisplayName || "Your Company"}</div>
                <div className="mt-1 text-sm text-muted-foreground">{settings.profile.tagline || "Add a tagline to sharpen your customer-facing voice."}</div>
              </div>
              <div className="grid gap-3">
                {livePreview.missingSetupItems.length ? (
                  livePreview.missingSetupItems.map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-900">
                    Core brand setup is complete. The frame system has enough signal for branded document output.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-electric" />
                Colors
              </CardTitle>
              <CardDescription>Set the colors that every branded frame should inherit first. This is the highest-visibility skin control after the company name.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <ColorField
                label="Primary color"
                value={settings.profile.primaryColor}
                previewColor={livePreview.validatedColors.primary}
                onChange={(value) => updateProfile("primaryColor", value)}
              />
              <ColorField
                label="Secondary color"
                value={settings.profile.secondaryColor}
                previewColor={livePreview.validatedColors.secondary}
                onChange={(value) => updateProfile("secondaryColor", value)}
              />
              <ColorField
                label="Accent color"
                value={settings.profile.accentColor}
                previewColor={livePreview.validatedColors.accent}
                onChange={(value) => updateProfile("accentColor", value)}
              />
            </CardContent>
            <CardFooter className="grid gap-3 md:grid-cols-3">
              <SafeUseCard title="Headings" color={livePreview.validatedColors.primary} body="Primary color drives titles, section markers, and structural emphasis." />
              <SafeUseCard title="Surfaces" color={livePreview.validatedColors.secondary} body="Secondary color softens cards, tables, and support panels without overpowering content." />
              <SafeUseCard title="Actions" color={livePreview.validatedColors.accent} body="Accent color is reserved for trust bars, key metrics, and conversion-focused highlights." />
            </CardFooter>
          </Card>

          <Card id="logos">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-electric" />
                Logos
              </CardTitle>
              <CardDescription>Primary source assets plus backend-derived favicon, monochrome, and print-safe variants.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Primary logo URL" value={settings.profile.logoUrl} onChange={(value) => updateProfile("logoUrl", value)} />
                <TextField label="Dark logo URL" value={settings.profile.logoDarkUrl} onChange={(value) => updateProfile("logoDarkUrl", value)} />
                <TextField label="Light logo URL" value={settings.profile.logoLightUrl} onChange={(value) => updateProfile("logoLightUrl", value)} />
                <TextField label="Icon URL" value={settings.profile.iconUrl} onChange={(value) => updateProfile("iconUrl", value)} />
                <TextField label="Watermark URL" value={settings.profile.watermarkUrl} onChange={(value) => updateProfile("watermarkUrl", value)} />
                <TextField label="Cover image URL" value={settings.profile.coverImageUrl} onChange={(value) => updateProfile("coverImageUrl", value)} />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {livePreview.derivedLogoVariants.map((variant) => (
                  <div key={variant.kind} className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{variant.kind}</div>
                    <div className="mt-2 text-sm font-medium capitalize">{variant.source}</div>
                    <div className="mt-3 break-all text-xs text-muted-foreground">{variant.url ?? "No source available yet"}</div>
                    {variant.derivedFrom ? <div className="mt-2 text-[11px] text-muted-foreground">Derived from {variant.derivedFrom}</div> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="typography">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-4 w-4 text-electric" />
                Typography
              </CardTitle>
              <CardDescription>Choose the document voice family once, then reuse it across proposals, change orders, warranties, and maintenance guides.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SelectField
                label="Typography style"
                value={settings.profile.typographyStyle}
                onChange={(event) => updateProfile("typographyStyle", event.target.value)}
              >
                {typographySpecimens.map((specimen) => (
                  <option key={specimen.style} value={specimen.style}>
                    {specimen.label}
                  </option>
                ))}
              </SelectField>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {typographySpecimens.map((specimen) => (
                  <button
                    key={specimen.style}
                    type="button"
                    onClick={() => updateProfile("typographyStyle", specimen.style)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      settings.profile.typographyStyle === specimen.style
                        ? "border-electric bg-electric/5 shadow-sm"
                        : "border-border/70 bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{specimen.label}</div>
                    <div className="mt-3 text-2xl font-semibold text-foreground" style={{ fontFamily: specimen.headingFontFamily }}>
                      Aa
                    </div>
                    <div className="mt-3 text-base font-semibold text-foreground" style={{ fontFamily: specimen.headingFontFamily }}>
                      {specimen.headingSample}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground" style={{ fontFamily: specimen.bodyFontFamily }}>
                      {specimen.bodySample}
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/25 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected family</div>
                <div className="mt-2 text-3xl font-semibold text-foreground" style={{ fontFamily: selectedTypography.headingFontFamily }}>
                  {selectedTypography.headingSample}
                </div>
                <div className="mt-3 text-sm text-muted-foreground" style={{ fontFamily: selectedTypography.bodyFontFamily }}>
                  {selectedTypography.bodySample}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card id="trust-signals">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-electric" />
                Trust Signals
              </CardTitle>
              <CardDescription>Surface the proof that helps homeowners and buyers feel safe signing.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <TextField label="Company display name" value={settings.profile.companyDisplayName} onChange={(value) => updateProfile("companyDisplayName", value)} />
              <TextField label="Tagline" value={settings.profile.tagline} onChange={(value) => updateProfile("tagline", value)} />
              <NumberField
                label="Years in business"
                value={settings.profile.yearsInBusiness === null ? "" : String(settings.profile.yearsInBusiness)}
                onChange={(value) => updateProfile("yearsInBusiness", value ? Number(value) : null)}
              />
              <TextareaField label="Service areas" value={joinLines(settings.profile.serviceAreas)} onChange={(value) => updateProfile("serviceAreas", splitLines(value))} hint="One area per line." />
              <TextField label="License number" value={settings.profile.licenseNumber} onChange={(value) => updateProfile("licenseNumber", value)} />
              <TextareaField label="Insurance summary" value={settings.profile.insuranceSummary} onChange={(value) => updateProfile("insuranceSummary", value)} />
              <TextareaField label="Bonding summary" value={settings.profile.bondingSummary} onChange={(value) => updateProfile("bondingSummary", value)} />
              <TextareaField label="Certifications" value={joinLines(settings.profile.certifications)} onChange={(value) => updateProfile("certifications", splitLines(value))} hint="One certification per line." />
              <TextareaField label="Review links" value={joinLinks(settings.profile.reviewLinks)} onChange={(value) => updateProfile("reviewLinks", splitLinks(value))} hint='Use "Label | https://..." per line.' />
              <TextareaField label="Financing links" value={joinLinks(settings.profile.financingLinks)} onChange={(value) => updateProfile("financingLinks", splitLinks(value))} hint='Use "Label | https://..." per line.' />
            </CardContent>
          </Card>

          <Card id="document-branding">
            <CardHeader>
              <CardTitle>Document Branding</CardTitle>
              <CardDescription>These settings shape the frame that estimates, change orders, closeout packets, warranties, and maintenance guides inherit.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <SelectField label="Default document theme" value={settings.profile.defaultDocumentTheme} onChange={(event) => updateProfile("defaultDocumentTheme", event.target.value)}>
                <option value="signature-frame">Signature Frame</option>
                <option value="executive-slate">Executive Slate</option>
                <option value="field-classic">Field Classic</option>
              </SelectField>
              <SelectField label="Proposal style" value={settings.profile.proposalStyle} onChange={(event) => updateProfile("proposalStyle", event.target.value)}>
                <option value="premium">Premium</option>
                <option value="consultative">Consultative</option>
                <option value="straight-bid">Straight Bid</option>
              </SelectField>
              <SelectField label="Invoice style" value={settings.profile.invoiceStyle} onChange={(event) => updateProfile("invoiceStyle", event.target.value)}>
                <option value="compact">Compact</option>
                <option value="progress">Progress Billing</option>
                <option value="statement">Statement</option>
              </SelectField>
              <SelectField label="Contract style" value={settings.profile.contractStyle} onChange={(event) => updateProfile("contractStyle", event.target.value)}>
                <option value="formal">Formal</option>
                <option value="homeowner-friendly">Homeowner Friendly</option>
                <option value="commercial">Commercial</option>
              </SelectField>
              <SelectField label="Cover mode" value={settings.documentSettings.defaultCoverMode} onChange={(event) => updateDocumentSettings("defaultCoverMode", event.target.value)}>
                <option value="editorial">Editorial</option>
                <option value="minimal">Minimal</option>
                <option value="photo-forward">Photo Forward</option>
              </SelectField>
              <SelectField label="Header style" value={settings.documentSettings.defaultHeaderStyle} onChange={(event) => updateDocumentSettings("defaultHeaderStyle", event.target.value)}>
                <option value="split">Split</option>
                <option value="centered">Centered</option>
                <option value="stacked">Stacked</option>
              </SelectField>
              <SelectField label="Footer style" value={settings.documentSettings.defaultFooterStyle} onChange={(event) => updateDocumentSettings("defaultFooterStyle", event.target.value)}>
                <option value="trust-bar">Trust Bar</option>
                <option value="minimal">Minimal</option>
                <option value="contact-heavy">Contact Heavy</option>
              </SelectField>
              <TextareaField label="Email signature" value={settings.profile.emailSignature} onChange={(value) => updateProfile("emailSignature", value)} hint="Used by future email templates and customer-facing outbound communication." />
            </CardContent>
            <CardFooter className="grid gap-3">
              <ToggleRow
                label="Powered by TradeOS"
                description="Keep this off for white-label customer documents unless you explicitly want co-branding."
                checked={settings.documentSettings.showPoweredByTradeOS}
                onCheckedChange={(checked) => updateDocumentSettings("showPoweredByTradeOS", checked)}
              />
              <ToggleRow
                label="Show license number"
                description="Include license details in headers, trust bars, and branded covers."
                checked={settings.documentSettings.showLicenseNumber}
                onCheckedChange={(checked) => updateDocumentSettings("showLicenseNumber", checked)}
              />
              <ToggleRow
                label="Show insurance summary"
                description="Useful for proposals and contract covers when trust needs to show early."
                checked={settings.documentSettings.showInsuranceSummary}
                onCheckedChange={(checked) => updateDocumentSettings("showInsuranceSummary", checked)}
              />
              <ToggleRow
                label="Show social links"
                description="Enable footer and support-surface social proof when links are present."
                checked={settings.documentSettings.showSocialLinks}
                onCheckedChange={(checked) => updateDocumentSettings("showSocialLinks", checked)}
              />
              <ToggleRow
                label="Show Google rating/reviews"
                description="Turns on review callouts when review links are present."
                checked={settings.documentSettings.showGoogleRating}
                onCheckedChange={(checked) => updateDocumentSettings("showGoogleRating", checked)}
              />
            </CardFooter>
          </Card>

          <Card id="contact-social">
            <CardHeader>
              <CardTitle>Contact & Social</CardTitle>
              <CardDescription>Give every customer-facing output the correct call, click, and service footprint.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <TextField label="Website" value={settings.profile.websiteUrl} onChange={(value) => updateProfile("websiteUrl", value)} />
              <TextField label="Phone" value={settings.profile.phone} onChange={(value) => updateProfile("phone", value)} />
              <TextField label="Email" value={settings.profile.email} onChange={(value) => updateProfile("email", value)} />
              <TextField label="Address line 1" value={settings.profile.addressLine1} onChange={(value) => updateProfile("addressLine1", value)} />
              <TextField label="Address line 2" value={settings.profile.addressLine2} onChange={(value) => updateProfile("addressLine2", value)} />
              <TextField label="City" value={settings.profile.city} onChange={(value) => updateProfile("city", value)} />
              <TextField label="State" value={settings.profile.state} onChange={(value) => updateProfile("state", value)} />
              <TextField label="Postal code" value={settings.profile.postalCode} onChange={(value) => updateProfile("postalCode", value)} />
              <TextareaField label="Social links" value={joinLinks(settings.profile.socialLinks)} onChange={(value) => updateProfile("socialLinks", splitLinks(value))} hint='Use "Label | https://..." per line.' />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asset Registry</CardTitle>
              <CardDescription>Canonical asset slots for logos, cover art, badges, QR codes, and backend-derived variants.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <SelectField label="Asset type" value={assetDraft.type} onChange={(event) => setAssetDraft({ ...assetDraft, type: event.target.value })}>
                  <option value="logo">Logo</option>
                  <option value="logo-dark">Dark Logo</option>
                  <option value="logo-light">Light Logo</option>
                  <option value="icon">Icon</option>
                  <option value="watermark">Watermark</option>
                  <option value="cover">Cover Image</option>
                  <option value="qr">QR Code</option>
                  <option value="badge">Badge</option>
                  <option value="logo-mono">Monochrome Logo</option>
                  <option value="logo-print">Print-safe Logo</option>
                </SelectField>
                <TextField label="Label" value={assetDraft.label} onChange={(value) => setAssetDraft({ ...assetDraft, label: value })} />
                <TextField label="Asset URL" value={assetDraft.url} onChange={(value) => setAssetDraft({ ...assetDraft, url: value })} />
                <TextField label="Mime type" value={assetDraft.mimeType} onChange={(value) => setAssetDraft({ ...assetDraft, mimeType: value })} />
              </div>
              <Button type="button" onClick={addAsset} disabled={isAssetSaving || !assetDraft.url.trim()} className="w-full">
                {isAssetSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                Add Asset
              </Button>
              <div className="space-y-3">
                {settings.assets.length ? (
                  settings.assets.map((asset) => (
                    <div key={asset.id} className="rounded-xl border border-border/70 bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium capitalize">{asset.label || asset.type.replaceAll("-", " ")}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{asset.type}</p>
                          <a href={asset.url} target="_blank" rel="noreferrer" className="break-all text-sm text-electric underline-offset-4 hover:underline">
                            {asset.url}
                          </a>
                        </div>
                        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => deleteAsset(asset.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No registry assets yet. Direct logo fields and derived backend variants will still drive previews.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );

  function updateProfile<Key extends keyof BrandStudioSettingsBundle["profile"]>(key: Key, value: BrandStudioSettingsBundle["profile"][Key]) {
    setSettings((current) => ({
      ...current,
      profile: { ...current.profile, [key]: value },
    }));
  }

  function updateDocumentSettings<Key extends keyof BrandStudioSettingsBundle["documentSettings"]>(
    key: Key,
    value: BrandStudioSettingsBundle["documentSettings"][Key]
  ) {
    setSettings((current) => ({
      ...current,
      documentSettings: { ...current.documentSettings, [key]: value },
    }));
  }
}

function PreviewCard({ preview }: { preview: BrandStudioSettingsBundle["preview"] }) {
  return (
    <Card className="overflow-hidden border border-border/70">
      <div
        className="px-6 py-5"
        style={{ background: `linear-gradient(135deg, ${preview.validatedColors.primary}, ${preview.validatedColors.accent})` }}
      >
        <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-white backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Live Frame Preview</p>
          <h2 className="mt-3 text-2xl font-semibold" style={{ fontFamily: preview.typography.headingFontFamily }}>
            {preview.companyDisplayName}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-white/80" style={{ fontFamily: preview.typography.bodyFontFamily }}>
            {preview.tagline || preview.typography.bodySample}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {preview.visibleTrustSignals.slice(0, 3).map((signal) => (
              <span key={signal.id} className="rounded-full bg-white/15 px-3 py-1 text-xs text-white">
                {signal.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <CardContent className="grid gap-3 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <ColorChip label="Primary" value={preview.validatedColors.primary} />
          <ColorChip label="Secondary" value={preview.validatedColors.secondary} />
          <ColorChip label="Accent" value={preview.validatedColors.accent} />
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Document Theme</p>
          <p className="mt-2 font-medium">{preview.documentTheme.defaultDocumentTheme}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview.documentTheme.typographyStyle} • {preview.documentTheme.coverMode} cover • {preview.documentTheme.headerStyle} header
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "accent" | "warn" | "good" }) {
  const toneClass =
    tone === "accent"
      ? "border-amber-500/25 bg-amber-500/10 text-amber-950"
      : tone === "warn"
        ? "border-border bg-background"
        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-950";
  return (
    <div className={`rounded-xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.25em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SafeUseCard({ title, color, body }: { title: string; color: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl border border-border/70" style={{ backgroundColor: color }} />
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{normalizeHexColor(color) ?? color}</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28" />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ColorField({
  label,
  value,
  previewColor,
  onChange,
}: {
  label: string;
  value: string;
  previewColor: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl border border-border" style={{ backgroundColor: previewColor }} />
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="#112233" />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
      <div className="space-y-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} aria-label={label} />
    </label>
  );
}

function ColorChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <div className="h-8 rounded-lg border border-border/70" style={{ backgroundColor: value }} />
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function joinLines(values: string[]) {
  return values.join("\n");
}

function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinLinks(values: BrandLink[]) {
  return values.map((item) => `${item.label} | ${item.url}`).join("\n");
}

function splitLinks(value: string): BrandLink[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, ...rest] = entry.split("|");
      return {
        label: label.trim(),
        url: rest.join("|").trim(),
      };
    })
    .filter((entry) => entry.label && entry.url);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
