"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Command,
  LoaderCircle,
  Save,
  Search,
  Upload,
  WandSparkles,
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
  initialDraft: TradeOsSettingsDraft;
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

export function SettingsConsole({ initialDraft, initialWorkspaceData, developerMeta }: SettingsConsoleProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [selectedSectionId, setSelectedSectionId] = useState(realSections[0]?.id ?? "general");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedResult, setHighlightedResult] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [uploadingAssetKeys, setUploadingAssetKeys] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const dirty = isDirtyDraft(draft, savedDraft);

  const developerSection = useMemo<SettingsSectionDefinition>(() => {
    return {
      ...realSections.find((section) => section.id === "developer")!,
      stats: [
        { label: "Environment", value: developerMeta.environment },
        { label: "Commit", value: developerMeta.gitCommit.slice(0, 7) || developerMeta.gitCommit },
        { label: "Health", value: developerMeta.healthStatus, tone: "good" },
      ],
      cards: [
        {
          kind: "status",
          id: "developer-metadata",
          title: "Runtime Metadata",
          description: "Server-provided build details plus placeholders for deeper platform telemetry.",
          items: [
            { label: "Version", value: developerMeta.version, description: "Frontend package version." },
            { label: "Environment", value: developerMeta.environment, description: "Current Next.js runtime environment." },
            { label: "Git commit", value: developerMeta.gitCommit, description: "From deployment environment variables." },
            { label: "Build number", value: developerMeta.buildNumber, description: "Release identifier for this build." },
            { label: "Database version", value: developerMeta.databaseVersion, description: "Awaiting richer backend diagnostics." },
            { label: "Feature flags", value: developerMeta.featureFlags, description: "Representative flag inventory." },
            { label: "Health status", value: developerMeta.healthStatus, tone: "good", description: "App shell and core surfaces are responding." },
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

  const sections = useMemo(
    () =>
      realSections.map((section) => {
        if (section.id === "developer") return developerSection;
        if (section.id === "team") return teamSection;
        if (section.id === "roles-permissions") return rolesSection;
        return section;
      }),
    [developerSection, rolesSection, teamSection]
  );

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0];

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
    setIsSaving(true);
    try {
      const result = await clientFetch<OrganizationSettingsResponse>("/settings", {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setSavedDraft(draft);
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
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.16),_transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,251,0.94))] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <WandSparkles className="size-3.5 text-[color:var(--settings-accent)]" />
              TradeOS Control Center
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings that make TradeOS feel like your company.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Configure operations, branding, pricing, automation, and platform controls from one responsive workspace built for a construction company.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <HeroMetric label="Active domains" value={`${sections.length}`} />
            <HeroMetric label="Unsaved changes" value={dirty ? "Yes" : "No"} tone={dirty ? "warn" : "good"} />
            <HeroMetric label="Search shortcut" value="Cmd/Ctrl + K" />
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-20 rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm backdrop-blur">
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
              <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-2xl border border-border/80 bg-popover p-2 shadow-xl">
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
                          "flex w-full items-start justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted",
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

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
          <label className="sr-only" htmlFor="settings-section-select">
            Select settings section
          </label>
          <select
            id="settings-section-select"
            value={selectedSectionId}
            onChange={(event) => setSelectedSectionId(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm xl:hidden"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
          <Card className="hidden rounded-2xl xl:flex">
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Navigate every operational surface of the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === selectedSectionId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => startTransition(() => setSelectedSectionId(section.id))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                      isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{section.title}</span>
                    <ChevronRight className="size-4 opacity-60" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <section id={`section-${selectedSection.id}`} className="space-y-4" style={{ ["--settings-accent" as string]: draft.accentColor }}>
          <Card className="rounded-[24px] border-border/70 bg-card/95">
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{selectedSection.title}</CardTitle>
                  <CardDescription className="max-w-2xl">{selectedSection.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSection.stats.map((stat) => (
                    <StatusPill key={stat.label} item={stat} />
                  ))}
                </div>
              </div>
            </CardHeader>
          </Card>

          {isPending ? (
            <SettingsSectionSkeleton />
          ) : (
            selectedSection.cards.map((card) => (
              <SettingsCard
                key={card.id}
                card={card}
                section={selectedSection}
                draft={draft}
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
  onChange,
  onAssetUpload,
  onAssetRemove,
  uploadingAssetKeys,
}: {
  card: SettingsCardDefinition;
  section: SettingsSectionDefinition;
  draft: TradeOsSettingsDraft;
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
  onChange,
}: {
  sectionId: string;
  field: SettingsFieldDefinition;
  value: TradeOsSettingsDraft[K];
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
            <p className="text-sm text-muted-foreground">{field.description}</p>
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
        <p className="text-sm text-muted-foreground">{field.description}</p>
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
          hint={field.description}
          className="h-11 rounded-xl"
        >
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
            <p className="text-sm text-muted-foreground">{field.description}</p>
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
      <p className="text-sm text-muted-foreground">{field.description}</p>
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

function HeroMetric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/85 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold text-foreground", tone === "warn" && "text-warning", tone === "good" && "text-success")}>
        {value}
      </div>
    </div>
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
