export interface AthenaPluginNetworkPolicy {
  allowedHosts: string[];
}

export interface AthenaPluginManifest {
  id: string;
  name: string;
  version: string;
  publisher: string;
  athenaContractVersion: string;
  tools: string[];
  contextProviders: string[];
  eventsConsumed: string[];
  eventsPublished: string[];
  permissions: string[];
  dataUse: Record<string, unknown>;
  supportUrl?: string;
  network?: AthenaPluginNetworkPolicy;
}

export type AthenaPluginManifestReasonCode =
  | "invalid_manifest"
  | "invalid_plugin_id"
  | "invalid_version"
  | "invalid_contract_version"
  | "incompatible_contract_major"
  | "invalid_publisher"
  | "duplicate_capability"
  | "invalid_network_host";

export interface AthenaPluginManifestValidationIssue {
  code: AthenaPluginManifestReasonCode;
  path: string;
  message: string;
}

export type AthenaPluginManifestValidationResult =
  | { ok: true; manifest: AthenaPluginManifest }
  | { ok: false; issues: AthenaPluginManifestValidationIssue[] };

export type AthenaPluginReviewStatus = "submitted" | "approved" | "rejected" | "revoked";
export type AthenaPluginInstallStatus = "installed" | "disabled" | "revoked" | "uninstalled";

export interface AthenaPluginReviewRecord {
  pluginId: string;
  pluginVersion: string;
  publisher: string;
  manifestHash: string;
  status: AthenaPluginReviewStatus;
  approvedPermissions: string[];
  approvedHosts: string[];
  approvedEventsConsumed: string[];
  approvedEventsPublished: string[];
  reviewedBy: string;
  reviewedAt: string;
  reason?: string;
}

export interface AthenaPluginGrant {
  orgId: string;
  pluginId: string;
  pluginVersion: string;
  manifestHash: string;
  permissions: string[];
  allowedHosts: string[];
  eventsConsumed: string[];
  eventsPublished: string[];
  status: AthenaPluginInstallStatus;
  installedBy: string;
  installedAt: string;
  updatedAt: string;
}

export interface AthenaPluginCapabilityDecision {
  allowed: boolean;
  reasonCode:
    | "approved"
    | "review_required"
    | "plugin_not_installed"
    | "plugin_disabled"
    | "plugin_revoked"
    | "organization_mismatch"
    | "manifest_changed"
    | "permission_not_granted"
    | "network_host_not_granted"
    | "event_not_granted"
    | "tool_not_declared"
    | "context_provider_not_declared"
    | "event_not_registered";
}
