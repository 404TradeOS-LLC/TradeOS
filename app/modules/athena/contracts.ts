import type { AthenaAction as AthenaActionRecord } from "../athena-action-engine/types";
import type { AthenaAIContext, AthenaKernelRequest, AthenaKernelResult } from "../athena-kernel/types";
import type { AthenaPermissionDecision } from "../athena-permissions/types";
import type { AthenaRegisteredToolDefinition } from "../athena-tool-registry/types";

export type AthenaRequest = AthenaKernelRequest;
export type AthenaResponse = AthenaKernelResult;
export type AthenaContext = AthenaAIContext;
export type AthenaTool = AthenaRegisteredToolDefinition;
export type AthenaAction = AthenaActionRecord;
export type AthenaPermission = AthenaPermissionDecision;

export interface AthenaAgent {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  handle(request: AthenaRequest, context: AthenaContext): Promise<AthenaResponse>;
}
