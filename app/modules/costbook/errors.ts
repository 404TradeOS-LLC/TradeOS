import { ApiError } from "../../backend/middleware/errorHandler";

export class CostbookWorkspaceNotFoundError extends ApiError {
  constructor(organizationId: string) {
    super(404, `Costbook workspace for organization ${organizationId} not found`);
  }
}
