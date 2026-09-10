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
