import { DomainPermission, hasPermission } from "../../domain";

export const costbookPermissions = ["costbook.read", "costbook.write", "costbook.manage"] as const satisfies readonly DomainPermission[];

export function getCostbookPermissionSummary(role: string) {
  return {
    canRead: hasPermission(role, "costbook.read"),
    canWrite: hasPermission(role, "costbook.write"),
    canManage: hasPermission(role, "costbook.manage"),
  };
}
