import type { CanonicalRole, DomainPermission, SupportedRole } from "../../domain";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: SupportedRole;
  canonicalRole?: CanonicalRole;
  permissions?: readonly DomainPermission[];
  email?: string;
}
