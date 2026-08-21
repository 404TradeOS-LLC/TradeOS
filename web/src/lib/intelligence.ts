import { clientFetch } from "@/lib/clientApi";

export const INTELLIGENCE_ENTITY_TYPES = [
  "customer",
  "job",
  "project",
  "document",
  "photo",
  "estimate",
  "invoice",
  "contract",
  "material",
  "vendor",
  "note",
  "ai_knowledge",
  "task",
  "calendar_event",
  "settings",
] as const;

export type IntelligenceEntityType = (typeof INTELLIGENCE_ENTITY_TYPES)[number];

export interface SearchResult {
  entityType: IntelligenceEntityType;
  entityId: string;
  title: string;
  subtitle?: string | null;
  href: string;
  keywords?: string[];
  updatedAt?: string | null;
  score: number;
  matchReason: "exact" | "prefix" | "contains" | "fuzzy";
  source: string;
}

export interface RecentItem {
  id: string;
  userId: string;
  entityType: IntelligenceEntityType;
  entityId: string;
  title: string;
  subtitle?: string | null;
  href: string;
  keywords?: string[];
  metadata?: Record<string, unknown>;
  updatedAt?: string | null;
  viewedAt: string;
  viewCount: number;
}

export interface CommandAction {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: "action";
  keywords: string[];
  favorite?: boolean;
}

export const commandPaletteActions: CommandAction[] = [
  {
    id: "create-estimate",
    title: "Choose project for estimate",
    subtitle: "Open the project that should own the estimate",
    href: "/projects",
    kind: "action",
    keywords: ["estimate", "new", "create"],
    favorite: true,
  },
  {
    id: "create-customer",
    title: "Create customer",
    subtitle: "Add a new customer record",
    href: "/customers/new",
    kind: "action",
    keywords: ["customer", "new", "create"],
    favorite: true,
  },
  {
    id: "create-project",
    title: "Create project",
    subtitle: "Start a new project workspace",
    href: "/projects/new",
    kind: "action",
    keywords: ["project", "new", "create"],
    favorite: true,
  },
  {
    id: "open-settings",
    title: "Open settings",
    subtitle: "Manage organization configuration",
    href: "/settings",
    kind: "action",
    keywords: ["settings", "preferences", "organization"],
    favorite: true,
  },
];

export async function searchIntelligence(query: string) {
  const params = new URLSearchParams({ q: query, limit: "10" });
  return clientFetch<SearchResult[]>(`/intelligence/search?${params.toString()}`);
}

export async function listRecentItems() {
  return clientFetch<RecentItem[]>("/intelligence/recent-items?limit=8");
}

export async function recordRecentItem(input: {
  entityType: IntelligenceEntityType;
  entityId: string;
  title: string;
  subtitle?: string | null;
  href: string;
  keywords?: string[];
  updatedAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return clientFetch<RecentItem>("/intelligence/recent-items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
