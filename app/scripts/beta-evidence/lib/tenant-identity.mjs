// Verify tenant identity from the authenticated backend, not UI text or branding
// rendered on a page. No cookie, email, or access token is written to errors.
const ORG_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertAuthenticatedSmokeTenant(settings, expectedLabel, expectedOrgId) {
  if (!expectedLabel || typeof expectedLabel !== "string" || !expectedLabel.trim()) {
    throw new Error("Expected smoke organization label is required.");
  }
  if (!settings || typeof settings !== "object" ||
      typeof settings.orgId !== "string" || !ORG_UUID.test(settings.orgId)) {
    throw new Error("Authenticated Settings API did not return a valid organization identity.");
  }

  // The canonical UUID is stronger than a brand/display name and takes
  // precedence when supplied by a reviewed, environment-scoped fixture.
  if (expectedOrgId) {
    if (!ORG_UUID.test(expectedOrgId) ||
        settings.orgId.toLowerCase() !== expectedOrgId.toLowerCase()) {
      throw new Error("Authenticated Settings API organization ID does not match the expected smoke tenant.");
    }
  } else if (settings.settings?.companyName !== expectedLabel) {
    // Without a pinned UUID, require the exact server-returned organization
    // display name. Never infer authorization from DOM text or an editable field.
    throw new Error(
      "Authenticated Settings API organization name does not match the expected smoke tenant. " +
      "Verify smoke-account membership or provision BETA_SMOKE_ORG_ID.",
    );
  }

  return settings.orgId;
}
