/**
 * Local discriminator for missing/denied ABC user-present account authorization.
 * Do not expose the provider response body or tokens in HTTP responses.
 */
export class AbcAccountAuthorizationError extends Error {
  readonly code = "abc_account_authorization_required" as const;

  constructor(message: string) {
    super(message);
    this.name = "AbcAccountAuthorizationError";
  }
}
