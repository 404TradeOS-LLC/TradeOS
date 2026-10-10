"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Command,
  Copy,
  LoaderCircle,
  Save,
  Search,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { removeSettingsAssetAction, uploadSettingsAssetAction } from "@/app/actions/settings";
import { clientFetch } from "@/lib/clientApi";
import { validateSettingsAssetUpload } from "@/lib/settingsAssetUpload";
import { cn } from "@/lib/utils";
import { type OrganizationSettingsResponse, type SettingsRoleProfile, type SettingsTeamMember, type TradeOsSettingsDraft } from "@/lib/settings";
import {
  settingsSections,
  type SettingsAssetDefinition,
  type SettingsCardDefinition,
  type SettingsFieldDefinition,
  type SettingsSectionDefinition,
  type SettingsStatusItem,
} from "./settings-schema";

interface SettingsConsoleProps {
  supplierWorkflowIdentity: { orgId: string; userId: string } | null;
  initialDraft: TradeOsSettingsDraft;
  persistedSettingKeys: string[];
  initialWorkspaceData: {
    currentRole: string;
    canManageWorkspace: boolean;
    teamMembers: SettingsTeamMember[];
    roleProfiles: SettingsRoleProfile[];
  };
  developerMeta: {
    version: string;
    environment: string;
    gitCommit: string;
    buildNumber: string;
    databaseVersion: string;
    featureFlags: string;
    healthStatus: string;
  };
}

interface SettingsSearchResult {
  id: string;
  label: string;
  sectionId: string;
  sectionTitle: string;
  description: string;
  anchorId: string;
  keywords: string[];
}

interface ToastMessage {
  id: number;
  title: string;
  description: string;
  tone: "success" | "info" | "error";
}

const realSections = settingsSections.filter((section) => section.cards.length > 0);

const contractorSectionIds = ["company", "costbook", "estimating", "team", "notifications", "ai", "integrations"] as const;
const advancedSectionIds = [
  "general",
  "branding",
  "roles-permissions",
  "crm",
  "documents",
  "templates",
  "knowledge-engine",
  "api-keys",
  "security",
  "billing",
  "backups",
  "audit-log",
  "developer",
] as const;

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function capitalize(value: string) {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isDirtyDraft(current: TradeOsSettingsDraft, saved: TradeOsSettingsDraft) {
  return JSON.stringify(current) !== JSON.stringify(saved);
}

export function SettingsConsole({ supplierWorkflowIdentity, initialDraft, persistedSettingKeys, initialWorkspaceData, developerMeta }: SettingsConsoleProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [persistedKeys, setPersistedKeys] = useState(() => new Set(persistedSettingKeys));
  const [selectedSectionId, setSelectedSectionId] = useState("costbook");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedResult, setHighlightedResult] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [uploadingAssetKeys, setUploadingAssetKeys] = useState<Set<string>>(new Set());
  const [abcProbe, setAbcProbe] = useState<
    | { state: "idle" | "testing" }
    | { state: "complete"; sku: string; priced: boolean; price: number | null; providerStatus: string }
    | { state: "error"; message: string }
  >({ state: "idle" });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const dirty = isDirtyDraft(draft, savedDraft);

  const developerSection = useMemo<SettingsSectionDefinition>(() => {
    return {
      ...realSections.find((section) => section.id === "developer")!,
      stats: [
        { label: "Environment", value: developerMeta.environment },
        { label: "Commit", value: developerMeta.gitCommit.slice(0, 7) || developerMeta.gitCommit },
        { label: "Health", value: developerMeta.healthStatus },
      ],
      cards: [
        {
          kind: "status",
          id: "developer-metadata",
          title: "Runtime Metadata",
          description: "Server-provided build details plus placeholders for deeper platform telemetry.",
          sampleData: true,
          items: [
            { label: "Version", value: developerMeta.version, description: "Frontend package version." },
            { label: "Environment", value: developerMeta.environment, description: "Current Next.js runtime environment." },
            { label: "Git commit", value: developerMeta.gitCommit, description: "From deployment environment variables." },
            { label: "Build number", value: developerMeta.buildNumber, description: "Release identifier for this build." },
            { label: "Database version", value: developerMeta.databaseVersion, description: "Awaiting richer backend diagnostics." },
            { label: "Feature flags", value: developerMeta.featureFlags, description: "Representative flag inventory." },
            { label: "Health status", value: developerMeta.healthStatus, description: "No live health claim is shown until a diagnostics source exposes it." },
          ],
        },
      ],
    };
  }, [developerMeta]);

  const teamSection = useMemo<SettingsSectionDefinition>(() => {
    const pendingInvites = initialWorkspaceData.teamMembers.filter((member) => member.status === "invited").length;
    const activeMembers = initialWorkspaceData.teamMembers.filter((member) => member.status === "active").length;

    return {
      ...realSections.find((section) => section.id === "team")!,
      stats: initialWorkspaceData.canManageWorkspace
        ? [
            { label: "Seats in use", value: `${activeMembers}` },
            { label: "Pending invites", value: `${pendingInvites}`, tone: pendingInvites > 0 ? "warn" : "good" },
            {
              label: "Access",
              value: initialWorkspaceData.currentRole,
              tone: "good",
            },
          ]
        : [
            { label: "Access", value: "Restricted", tone: "warn" },
            { label: "Current role", value: initialWorkspaceData.currentRole },
            { label: "Directory", value: "Admin only" },
          ],
      cards: initialWorkspaceData.canManageWorkspace
        ? [
            {
              kind: "records",
              id: "team-directory",
              title: "Active Team",
              description: "Live organization membership from the current workspace.",
              rows: initialWorkspaceData.teamMembers.map((member) => ({
                title: member.fullName ?? member.email,
                subtitle: `${member.email} • ${member.role}`,
                meta: `Updated ${formatRelativeDate(member.updatedAt)}`,
                status: capitalize(member.status),
              })),
            },
          ]
        : [
            {
              kind: "status",
              id: "team-directory",
              title: "Team Directory",
              description: "Organization-wide team visibility is limited to owners and admins.",
              items: [
                {
                  label: "Current role",
                  value: initialWorkspaceData.currentRole,
                  description: "Request owner or admin access to manage team membership from Settings.",
                  tone: "warn",
                },
              ],
            },
          ],
    };
  }, [initialWorkspaceData]);

  const rolesSection = useMemo<SettingsSectionDefinition>(() => {
    return {
      ...realSections.find((section) => section.id === "roles-permissions")!,
      stats: initialWorkspaceData.canManageWorkspace
        ? [
            { label: "System roles", value: `${initialWorkspaceData.roleProfiles.length}` },
            {
              label: "Active owners",
              value: `${initialWorkspaceData.roleProfiles.find((profile) => profile.role === "owner")?.memberCount ?? 0}`,
              tone: "good",
            },
            { label: "Permission scope", value: "Live" },
          ]
        : [
            { label: "Access", value: "Restricted", tone: "warn" },
            { label: "Current role", value: initialWorkspaceData.currentRole },
            { label: "Policies", value: "Admin only" },
          ],
      cards: initialWorkspaceData.canManageWorkspace
        ? [
            {
              kind: "records",
              id: "roles-summary",
              title: "Permission Profiles",
              description: "Live role inventory based on the current membership model.",
              rows: initialWorkspaceData.roleProfiles.map((profile) => ({
                title: profile.title,
                subtitle: profile.description,
                meta: `${profile.memberCount} active member${profile.memberCount === 1 ? "" : "s"}`,
                status: "System role",
              })),
            },
          ]
        : [
            {
              kind: "status",
              id: "roles-summary",
              title: "Permission Profiles",
              description: "Role policy management is limited to workspace admins.",
              items: [
                {
                  label: "Current role",
                  value: initialWorkspaceData.currentRole,
                  description: "The Control Center can show your personal settings, but workspace-wide permission policy is protected.",
                  tone: "warn",
                },
              ],
            },
          ],
    };
  }, [initialWorkspaceData]);

  const sections = useMemo(() => {
    const resolved = realSections.map((section) => {
      if (section.id === "developer") return developerSection;
      if (section.id === "team") return teamSection;
      if (section.id === "roles-permissions") return rolesSection;
      return section;
    });
    const byId = new Map(resolved.map((section) => [section.id, section]));
    const ordered = [...contractorSectionIds, ...advancedSectionIds]
      .map((id) => byId.get(id))
      .filter((section): section is SettingsSectionDefinition => Boolean(section));
    const included = new Set(ordered.map((section) => section.id));
    return [...ordered, ...resolved.filter((section) => !included.has(section.id))];
  }, [developerSection, rolesSection, teamSection]);

  const contractorSections = sections.filter((section) => contractorSectionIds.includes(section.id as (typeof contractorSectionIds)[number]));
  const advancedSections = sections.filter((section) => !contractorSectionIds.includes(section.id as (typeof contractorSectionIds)[number]));

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0];

  async function testAbcConnection() {
    if (abcProbe.state === "testing") return;
    setAbcProbe({ state: "testing" });
    try {
      const result = await clientFetch<{
        sku: string; priced: boolean; price: number | null; providerStatus: string;
        providerStockingUnitVerified: boolean; materialCreated: boolean; priceApplied: boolean;
      }>("/api/v1/supplier-integrations/abc/price-probe", {
        method: "POST",
        body: JSON.stringify({ productKey: "ABC-654210" }),
      });
      if (result.materialCreated || result.priceApplied) {
        throw new Error("The connection test returned an unexpected mutation claim");
      }
      setAbcProbe({ state: "complete", sku: result.sku, priced: result.priced, price: result.price, providerStatus: result.providerStatus });
    } catch (error) {
      setAbcProbe({
        state: "error",
        message: error instanceof Error ? error.message : "The sandbox request did not complete",
      });
    }
  }

  async function copyWorkflowId(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ title: `${label} copied`, description: "Paste it into the GitHub supplier seed workflow.", tone: "success" });
    } catch {
      showToast({ title: "Could not copy", description: "Select the UUID below and copy it manually.", tone: "error" });
    }
  }

  function showToast(toast: Omit<ToastMessage, "id">) {
    const id = window.setTimeout(() => {
      setToasts((current) => current.filter((message) => message.id !== id));
    }, 3200);

    setToasts((current) => [...current, { ...toast, id }]);
  }

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchIndex = useMemo<SettingsSearchResult[]>(() => {
    return sections.flatMap((section) => {
      const sectionEntry: SettingsSearchResult = {
        id: `${section.id}-section`,
        label: section.title,
        sectionId: section.id,
        sectionTitle: section.title,
        description: section.description,
        anchorId: `section-${section.id}`,
        keywords: section.keywords,
      };

      const cardEntries = section.cards.flatMap((card) => {
        if (card.kind === "fields") {
          return card.fields.map((item) => ({
            id: `${section.id}-${String(item.key)}`,
            label: item.label,
            sectionId: section.id,
            sectionTitle: section.title,
            description: item.description,
            anchorId: `field-${section.id}-${String(item.key)}`,
            keywords: [...(item.keywords ?? []), card.title, section.title],
          }));
        }

        if (card.kind === "assets") {
          return card.assets.map((asset) => ({
            id: `${section.id}-${String(asset.key)}`,
            label: asset.label,
            sectionId: section.id,
            sectionTitle: section.title,
            description: asset.description,
            anchorId: `asset-${section.id}-${String(asset.key)}`,
            keywords: [...(asset.keywords ?? []), card.title, section.title],
          }));
        }

        return {
          id: `${section.id}-${card.id}`,
          label: card.title,
          sectionId: section.id,
          sectionTitle: section.title,
          description: card.description,
          anchorId: `card-${section.id}-${card.id}`,
          keywords: [section.title, card.title],
        };
      });

      return [sectionEntry, ...cardEntries];
    });
  }, [sections]);

  const filteredResults = useMemo(() => {
    const query = normalizeText(deferredSearchQuery);
    if (!query) return [];

    return searchIndex
      .filter((item) => {
        const haystack = normalizeText([item.label, item.description, item.sectionTitle, item.keywords.join(" ")].join(" "));
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [deferredSearchQuery, searchIndex]);

  function jumpToAnchor(sectionId: string, anchorId: string) {
    startTransition(() => setSelectedSectionId(sectionId));

    window.setTimeout(() => {
      const target = document.getElementById(anchorId) ?? document.getElementById(`section-${sectionId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function updateDraft<K extends keyof TradeOsSettingsDraft>(key: K, value: TradeOsSettingsDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleAssetUpload(asset: SettingsAssetDefinition, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const assetKey = String(asset.key);

    // Cheap client-side checks (file type / size) so obviously invalid files fail
    // instantly instead of waiting on a network round trip. The server call
    // below re-runs the same checks and remains the real authority.
    const clientValidationError = validateSettingsAssetUpload({
      assetKey,
      file: { size: file.size, type: file.type },
    });
    if (clientValidationError) {
      showToast({
        tone: "error",
        title: `${asset.label} upload failed`,
        description: clientValidationError,
      });
      return;
    }

    setUploadingAssetKeys((current) => new Set(current).add(assetKey));

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("assetKey", assetKey);
      const result = await uploadSettingsAssetAction(formData);

      if (!result.url) {
        showToast({
          tone: "error",
          title: `${asset.label} upload failed`,
          description: result.error ?? "Something went wrong.",
        });
        return;
      }

      updateDraft(asset.key, result.url as TradeOsSettingsDraft[typeof asset.key]);
      showToast({
        tone: "info",
        title: `${asset.label} ready to save`,
        description: `${file.name} uploaded — press Save changes to apply it.`,
      });
    } finally {
      setUploadingAssetKeys((current) => {
        const next = new Set(current);
        next.delete(assetKey);
        return next;
      });
    }
  }

  // Unlike other settings fields, removal takes effect immediately: it
  // deletes the underlying storage object and its metadata record (see
  // removeSettingsAssetAction), not just a display string. The field is
  // still staged to "" in the draft afterward so "Save changes" reflects the
  // removal consistently with every other settings field.
  async function handleAssetRemove(asset: SettingsAssetDefinition) {
    const assetKey = String(asset.key);
    setUploadingAssetKeys((current) => new Set(current).add(assetKey));

    try {
      const result = await removeSettingsAssetAction(assetKey);
      if (!result.ok) {
        showToast({
          tone: "error",
          title: `${asset.label} removal failed`,
          description: result.error ?? "Something went wrong.",
        });
        return;
      }

      updateDraft(asset.key, "" as TradeOsSettingsDraft[typeof asset.key]);
      showToast({
        tone: "info",
        title: `${asset.label} removed`,
        description: "Press Save changes to apply the removal to your organization settings.",
      });
    } finally {
      setUploadingAssetKeys((current) => {
        const next = new Set(current);
        next.delete(assetKey);
        return next;
      });
    }
  }

  async function saveChanges() {
    if (!dirty) return;

    setIsSaving(true);
    try {
      // PATCH /settings currently validates the complete organization settings
      // contract. Send the full draft until the backend explicitly supports
      // partial updates; omitting required fields would turn ordinary single-
      // field edits into 400 responses.
      const result = await clientFetch<OrganizationSettingsResponse>("/settings", {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setSavedDraft(draft);
      setPersistedKeys(new Set(Object.keys(draft)));
      showToast({
        tone: "success",
        title: "Settings saved",
        description: `Organization settings synced at ${new Date(result.updatedAt ?? new Date().toISOString()).toLocaleTimeString()}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Save failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function resetChanges() {
    setDraft(savedDraft);
    showToast({
      tone: "info",
      title: "Changes reset",
      description: "The current section reverted to the last saved draft.",
    });
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-border/70 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Settings</p>
        <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Control Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              The settings contractors use often stay up top. Platform and administrative tooling stays under Advanced.
            </p>
          </div>
          <Badge variant="outline" className={dirty ? "border-warning/30 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}>
            {dirty ? "Unsaved changes" : "Saved"}
          </Badge>
        </div>
      </header>

      <section className="sticky top-0 z-20 rounded-2xl border border-border/70 bg-background/90 p-4 shadow-(--elev-1) backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setHighlightedResult(0);
              }}
              onKeyDown={(event) => {
                if (!filteredResults.length) return;

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlightedResult((current) => (current + 1) % filteredResults.length);
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlightedResult((current) => (current - 1 + filteredResults.length) % filteredResults.length);
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  const target = filteredResults[highlightedResult];
                  if (target) {
                    jumpToAnchor(target.sectionId, target.anchorId);
                    setSearchQuery("");
                  }
                }
              }}
              className="h-11 rounded-xl pl-10 pr-24"
              placeholder="Search settings: logo, labor rate, SMTP, invoice..."
              style={{ ["--settings-accent" as string]: draft.accentColor }}
            />
            <span className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              <Command className="size-3" />
              K
            </span>
            {searchQuery ? (
              <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-2xl border border-border/80 bg-popover p-2 shadow-(--elev-3)">
                {filteredResults.length ? (
                  <div className="space-y-1">
                    {filteredResults.map((result, index) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          jumpToAnchor(result.sectionId, result.anchorId);
                          setSearchQuery("");
                        }}
                        className={cn(
                          "flex w-full items-start justify-between rounded-xl px-3 py-2 text-left outline-none transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                          index === highlightedResult && "bg-muted"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">{result.label}</div>
                          <div className="text-xs text-muted-foreground">{result.description}</div>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{result.sectionTitle}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No matching settings"
                    description={`Nothing matched "${searchQuery}". Try a document type, channel, or platform term.`}
                    className="border-none bg-transparent p-2"
                  />
                )}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="lg" onClick={resetChanges} disabled={!dirty || isSaving}>
              Reset
            </Button>
            <Button type="button" size="lg" onClick={saveChanges} disabled={!dirty || isSaving}>
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save changes
            </Button>
          </div>
        </div>
        {dirty ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              Unsaved changes are ready to sync. Core TradeOS settings now persist to the active organization workspace.
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <label className="sr-only" htmlFor="settings-section-select">
            Select settings section
          </label>
          <select
            id="settings-section-select"
            value={selectedSectionId}
            onChange={(event) => setSelectedSectionId(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm xl:hidden"
          >
            <optgroup label="Contractor settings">
              {contractorSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Advanced / admin">
              {advancedSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </optgroup>
          </select>

          <Card className="hidden rounded-2xl xl:flex">
            <CardHeader className="pb-3">
              <CardTitle>Contractor settings</CardTitle>
              <CardDescription>Common controls first. Specialized and platform controls stay lower.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {contractorSections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === selectedSectionId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => startTransition(() => setSelectedSectionId(section.id))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("size-4", isActive && "text-primary")} />
                    <span className="flex-1 font-medium">{section.title}</span>
                    <ChevronRight className="size-4 opacity-60" />
                  </button>
                );
              })}

              <div className="my-3 border-t border-border/70 pt-3">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Advanced / admin</p>
                {advancedSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = section.id === selectedSectionId;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => startTransition(() => setSelectedSectionId(section.id))}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                        isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1">{section.title}</span>
                      <ChevronRight className="size-4 opacity-50" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section id={`section-${selectedSection.id}`} className="space-y-4" style={{ ["--settings-accent" as string]: draft.accentColor }}>
          <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card px-4 py-4 sm:px-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">{selectedSection.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{selectedSection.description}</p>
            </div>
            {selectedSection.id === "costbook" ? (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Region · {draft.costRegion || "Not configured"}</Badge>
                <Badge variant="outline">Labor · {draft.laborRate ? `$${draft.laborRate}/hr` : "Not configured"}</Badge>
                <Badge variant="outline">Markup · {draft.markupPercent ? `${draft.markupPercent}%` : "Not configured"}</Badge>
              </div>
            ) : null}
          </div>

          {selectedSection.id === "costbook" ? (
            <div className="flex flex-col gap-3 rounded-xl border border-success/25 bg-success/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Costbook provenance still governs actual price trust</p>
                <p className="mt-0.5 text-muted-foreground">These defaults never turn stale, placeholder, or unverified supplier pricing into trusted precision.</p>
              </div>
              <a href="/costbook" className="shrink-0 font-medium text-primary underline-offset-4 hover:underline">Open Costbook</a>
            </div>
          ) : null}

          {selectedSection.id === "costbook" && supplierWorkflowIdentity ? (
            <Card className="rounded-[24px] border-border/70">
              <CardHeader>
                <CardTitle>ABC Supply connection test</CardTitle>
                <CardDescription>
                  Test one verified supplier item against the ABC sandbox using your secure TradeOS connection.
                  This checks the provider response without creating a Material or applying a price.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Test item: underlayment · ABC SKU 654210</p>
                <Button type="button" disabled={abcProbe.state === "testing"} onClick={() => void testAbcConnection()}>
                  {abcProbe.state === "testing" ? <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
                  {abcProbe.state === "testing" ? "Testing ABC sandbox..." : "Test ABC connection"}
                </Button>
                {abcProbe.state === "complete" ? (
                  <div role="status" className="rounded-lg border border-border p-3 text-sm">
                    {abcProbe.priced && abcProbe.price !== null
                      ? `Sandbox returned ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(abcProbe.price)} for SKU ${abcProbe.sku}.`
                      : `No eligible priced line for SKU ${abcProbe.sku} (provider status: ${abcProbe.providerStatus}).`}
                    <p className="mt-2 text-muted-foreground">
                      ABC stocking unit is not verified. No price was saved or approved.
                    </p>
                  </div>
                ) : null}
                {abcProbe.state === "error" ? (
                  <p role="alert" className="text-sm text-destructive">{abcProbe.message}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {selectedSection.id === "costbook" && supplierWorkflowIdentity ? (
            <Card className="rounded-[24px] border-border/70">
              <CardHeader>
                <CardTitle>Supplier workflow IDs</CardTitle>
                <CardDescription>
                  Verified from your active TradeOS owner/admin session. GitHub requires the organization UUID and
                  the application user UUID, not a membership ID or Supabase project ID.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  ["Organization UUID", supplierWorkflowIdentity.orgId],
                  ["Owner/admin user UUID", supplierWorkflowIdentity.userId],
                ] as const).map(([label, value]) => (
                  <div key={label} className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
                        {value}
                      </code>
                      <Button type="button" variant="outline" aria-label={`Copy ${label}`} onClick={() => void copyWorkflowId(label, value)}>
                        <Copy className="mr-2 size-4" aria-hidden="true" />
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}
                <a
                  href="https://github.com/404TradeOS-LLC/TradeOS/actions/workflows/seed-costbook-supplier-prices-47802.yml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open supplier import workflow <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              </CardContent>
            </Card>
          ) : null}

          {isPending ? (
            <SettingsSectionSkeleton />
          ) : (
            selectedSection.cards.map((card) => (
              <SettingsCard
                key={card.id}
                card={card}
                section={selectedSection}
                draft={draft}
                persistedKeys={persistedKeys}
                onChange={updateDraft}
                onAssetUpload={handleAssetUpload}
                onAssetRemove={handleAssetRemove}
                uploadingAssetKeys={uploadingAssetKeys}
              />
            ))
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
}

function SettingsCard({
  card,
  section,
  draft,
  persistedKeys,
  onChange,
  onAssetUpload,
  onAssetRemove,
  uploadingAssetKeys,
}: {
  card: SettingsCardDefinition;
  section: SettingsSectionDefinition;
  draft: TradeOsSettingsDraft;
  persistedKeys: Set<string>;
  onChange: <K extends keyof TradeOsSettingsDraft>(key: K, value: TradeOsSettingsDraft[K]) => void;
  onAssetUpload: (asset: SettingsAssetDefinition, event: ChangeEvent<HTMLInputElement>) => void;
  onAssetRemove: (asset: SettingsAssetDefinition) => void;
  uploadingAssetKeys: Set<string>;
}) {
  return (
    <Card id={`card-${section.id}-${card.id}`} className="rounded-[24px] border-border/70">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{card.title}</CardTitle>
          {card.sampleData ? (
            <Badge variant="outline" className="border-accent-foreground/30 bg-accent text-accent-foreground">
              Sample data
            </Badge>
          ) : null}
        </div>
        <CardDescription>{card.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {card.kind === "fields" ? (
          <div className={cn("grid gap-4", card.columns === 2 && "md:grid-cols-2")}>
            {card.fields.map((item) => (
              <FieldRenderer
                key={String(item.key)}
                sectionId={section.id}
                field={item}
                value={draft[item.key]}
                isPersisted={persistedKeys.has(String(item.key))}
                onChange={onChange}
              />
            ))}
          </div>
        ) : null}

        {card.kind === "assets" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {card.assets.map((asset) => {
              const previewValue = draft[asset.key];

              return (
                <AssetCard
                  key={String(asset.key)}
                  sectionId={section.id}
                  asset={asset}
                  previewUrl={typeof previewValue === "string" ? previewValue : ""}
                  onUpload={onAssetUpload}
                  onRemove={onAssetRemove}
                  isUploading={uploadingAssetKeys.has(String(asset.key))}
                />
              );
            })}
          </div>
        ) : null}

        {card.kind === "status" ? <StatusGrid items={card.items} /> : null}
        {card.kind === "records" ? <RecordList rows={card.rows} /> : null}
        {card.kind === "preview" ? <PreviewSurface preview={card.preview} draft={draft} /> : null}
      </CardContent>
      {card.kind === "preview" ? (
        <CardFooter className="justify-between">
          <span className="text-xs text-muted-foreground">Live preview updates as you change branding and document settings.</span>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Customer-facing sample
            <ArrowUpRight className="size-3.5" />
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function FieldRenderer<K extends keyof TradeOsSettingsDraft>({
  sectionId,
  field,
  value,
  isPersisted,
  onChange,
}: {
  sectionId: string;
  field: SettingsFieldDefinition;
  value: TradeOsSettingsDraft[K];
  isPersisted: boolean;
  onChange: (key: K, value: TradeOsSettingsDraft[K]) => void;
}) {
  const fieldId = `field-${sectionId}-${String(field.key)}`;

  if (field.kind === "toggle") {
    return (
      <div id={fieldId} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(field.key as K, Boolean(checked) as TradeOsSettingsDraft[K])} />
          <div className="space-y-1">
            <Label htmlFor={fieldId}>{field.label}</Label>
            <p className="text-sm text-muted-foreground">{!isPersisted ? "Product default; not yet saved for this organization. " : ""}{field.description}</p>
          </div>
        </div>
      </div>
    );
  }

  if (field.kind === "textarea") {
    return (
      <div id={fieldId} className="space-y-2">
        <Label htmlFor={`${fieldId}-input`}>{field.label}</Label>
        <Textarea
          id={`${fieldId}-input`}
          value={String(value)}
          onChange={(event) => onChange(field.key as K, event.target.value as TradeOsSettingsDraft[K])}
          placeholder={field.placeholder}
          className="min-h-28 rounded-xl"
        />
        <p className="text-sm text-muted-foreground">{!isPersisted ? "Product default; not yet saved for this organization. " : ""}{field.description}</p>
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div id={fieldId}>
        <SelectField
          id={`${fieldId}-input`}
          label={field.label}
          value={String(value)}
          onChange={(event) => onChange(field.key as K, event.target.value as TradeOsSettingsDraft[K])}
          hint={`${!isPersisted ? "Product default; not yet saved for this organization. " : ""}${field.description}`}
          className="h-11 rounded-xl"
        >
          {!String(value) ? <option value="">Not configured</option> : null}
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>
    );
  }

  if (field.kind === "color") {
    return (
      <div id={fieldId} className="space-y-2">
        <Label htmlFor={`${fieldId}-input`}>{field.label}</Label>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-3">
          <input
            id={`${fieldId}-input`}
            type="color"
            value={String(value)}
            onChange={(event) => onChange(field.key as K, event.target.value as TradeOsSettingsDraft[K])}
            className="size-10 rounded-xl border border-border bg-transparent p-1"
          />
          <div>
            <div className="text-sm font-medium text-foreground">{String(value)}</div>
            <p className="text-sm text-muted-foreground">{!isPersisted ? "Product default; not yet saved for this organization. " : ""}{field.description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={fieldId} className="space-y-2">
      <Label htmlFor={`${fieldId}-input`}>{field.label}</Label>
      <Input
        id={`${fieldId}-input`}
        value={String(value)}
        onChange={(event) => onChange(field.key as K, event.target.value as TradeOsSettingsDraft[K])}
        placeholder={field.placeholder}
        className="h-11 rounded-xl"
      />
      <p className="text-sm text-muted-foreground">{!isPersisted ? "Product default; not yet saved for this organization. " : ""}{field.description}</p>
    </div>
  );
}

function AssetCard({
  sectionId,
  asset,
  previewUrl,
  onUpload,
  onRemove,
  isUploading,
}: {
  sectionId: string;
  asset: SettingsAssetDefinition;
  previewUrl: string;
  onUpload: (asset: SettingsAssetDefinition, event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (asset: SettingsAssetDefinition) => void;
  isUploading: boolean;
}) {
  const id = `asset-${sectionId}-${String(asset.key)}`;

  return (
    <div id={id} className="rounded-[22px] border border-dashed border-border/80 bg-muted/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{asset.label}</h3>
          <p className="text-sm text-muted-foreground">{asset.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {previewUrl && !isUploading ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(asset)}>
              Remove
            </Button>
          ) : null}
          <label
            aria-busy={isUploading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition",
              isUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"
            )}
          >
            {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {isUploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              aria-label={`Upload ${asset.label}`}
              accept={asset.accept}
              className="hidden"
              disabled={isUploading}
              onChange={(event) => onUpload(asset, event)}
            />
          </label>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-background">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${asset.label} preview`} className="h-36 w-full object-contain bg-muted/20 p-4" />
        ) : (
          <div className="grid h-36 place-items-center bg-[linear-gradient(135deg,rgba(17,24,39,0.03),rgba(217,119,6,0.08))] p-4 text-center text-sm text-muted-foreground">
            No asset uploaded yet.
          </div>
        )}
      </div>
    </div>
  );
}

function StatusGrid({ items }: { items: SettingsStatusItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-border/70 bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">{item.label}</div>
            <StatusPill item={item} />
          </div>
          {item.description ? <p className="mt-2 text-sm text-muted-foreground">{item.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

function RecordList({ rows }: { rows: { title: string; subtitle: string; meta: string; status?: string }[] }) {
  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
      {rows.map((row) => (
        <div key={`${row.title}-${row.meta}`} className="flex flex-col gap-3 bg-background px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">{row.title}</div>
            <div className="text-sm text-muted-foreground">{row.subtitle}</div>
          </div>
          <div className="flex flex-col gap-1 text-sm md:items-end">
            <div className="text-muted-foreground">{row.meta}</div>
            {row.status ? <span className="text-foreground">{row.status}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewSurface({ preview, draft }: { preview: "branding" | "documents" | "email"; draft: TradeOsSettingsDraft }) {
  if (preview === "email") {
    return (
      <div className="rounded-[28px] border border-border/70 bg-background p-5">
        <div className="text-sm font-semibold text-foreground">Email Signature Preview</div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{draft.emailSignature}</p>
      </div>
    );
  }

  if (preview === "documents") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <DocumentPreviewCard
          title="Proposal"
          eyebrow={draft.proposalTemplate}
          tone={draft.brandSecondary}
          body={`Styled as ${draft.proposalStyle} with ${draft.pdfAppearance.toLowerCase()} output and ${draft.typography}.`}
        />
        <div className="space-y-4">
          <MiniDoc label="Invoice" value={draft.invoiceStyle} />
          <MiniDoc label="Contract" value={draft.contractStyle} />
          <MiniDoc label="Change Order" value={draft.changeOrderTemplate} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div
        className="rounded-[28px] border border-border/70 p-6"
        style={{
          background: `linear-gradient(135deg, ${draft.brandPrimary} 0%, color-mix(in srgb, ${draft.brandPrimary} 70%, white 30%) 100%)`,
        }}
      >
        <div className="space-y-6 text-white">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.22em] text-white/70">{draft.companyName}</div>
            <div className="text-3xl font-semibold" style={{ fontFamily: draft.typography }}>
              Proposal Preview
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <div className="text-sm text-white/80">Typography</div>
            <div className="mt-1 text-lg font-medium">{draft.typography}</div>
          </div>
          <div className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: draft.brandSecondary }}>
            Accent color in use
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <MiniDoc label="PDF appearance" value={draft.pdfAppearance} />
        <MiniDoc label="Invoice style" value={draft.invoiceStyle} />
        <MiniDoc label="Contract style" value={draft.contractStyle} />
        <MiniDoc label="Email signature" value="Preview available in outbound templates" />
      </div>
    </div>
  );
}

function DocumentPreviewCard({
  title,
  eyebrow,
  tone,
  body,
}: {
  title: string;
  eyebrow: string;
  tone: string;
  body: string;
}) {
  return (
    <div className="rounded-[28px] border border-border/70 bg-background p-6">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</div>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">{title}</h3>
          </div>
          <div className="h-10 w-10 rounded-2xl" style={{ backgroundColor: tone }} />
        </div>
        <div className="rounded-2xl border border-border/70 p-4">
          <div className="text-sm font-medium text-foreground">Customer-facing presentation</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MiniDoc label="Hero" value="Branded" />
          <MiniDoc label="Scope" value="Readable" />
          <MiniDoc label="Totals" value="High emphasis" />
        </div>
      </div>
    </div>
  );
}

function MiniDoc({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function StatusPill({ item }: { item: SettingsStatusItem }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        item.tone === "good" && "bg-success/10 text-success",
        item.tone === "warn" && "bg-warning/10 text-warning",
        !item.tone && "bg-muted text-muted-foreground"
      )}
    >
      {item.tone === "good" ? <CheckCircle2 className="size-3.5" /> : null}
      {item.tone === "warn" ? <AlertCircle className="size-3.5" /> : null}
      {item.value}
    </span>
  );
}

function SettingsSectionSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-48 animate-pulse rounded-[24px] border border-border/70 bg-muted/30" />
      ))}
    </div>
  );
}

function Toast({ toast }: { toast: ToastMessage }) {
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-2xl border bg-background px-4 py-3 shadow-(--elev-4) animate-in fade-in-0 slide-in-from-bottom-2 duration-(--dur-3) ease-(--ease-emphasized)",
        toast.tone === "success" && "border-success/30",
        toast.tone === "info" && "border-border",
        toast.tone === "error" && "border-destructive/30"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="text-sm font-semibold text-foreground">{toast.title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{toast.description}</div>
    </div>
  );
}
