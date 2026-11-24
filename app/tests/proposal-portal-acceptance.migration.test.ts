import fs from "node:fs";
import path from "node:path";

// DES-10-F7: the governed portal proposal response runs under a portal
// session (app.role = 'portal_customer'), for which
// current_app_can_write() is false — so the staff proposals /
// proposal_deliveries / activity write policies all deny it. The migration
// grants one narrowly scoped portal UPDATE policy + trigger, keyed by a
// transaction-local app.portal_proposal_id, mirroring the contract-signing
// and invoice-viewed precedents.

describe("proposal portal acceptance policy migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20261124150000_add_proposal_portal_acceptance/migration.sql"),
    "utf8"
  );

  it("records the portal signature on the proposal row", () => {
    expect(migration).toContain("signer_name");
    expect(migration).toContain("signature_data_url");
    expect(migration).toContain("signed_at");
    expect(migration).toContain("declined_reason");
  });

  it("adds the portal proposal id setting used to key the narrow write", () => {
    expect(migration).toContain("current_app_portal_proposal_id()");
    expect(migration).toContain("app.portal_proposal_id");
  });

  it("grants a portal-only proposal update policy scoped to the verified customer and proposal", () => {
    expect(migration).toContain("create policy proposals_portal_response_policy on proposals");
    expect(migration).toContain("for update using");
    expect(migration).toContain("status in ('sent', 'viewed')");
    expect(migration).toContain("current_app_portal_customer_id()");
  });

  it("pins portal updates to the governed accept/decline transition with a trigger", () => {
    expect(migration).toContain("create or replace function public.enforce_customer_portal_proposal_response()");
    expect(migration).toContain("Customer portal proposal response may only record the governed accept or decline of the sent proposal");
    expect(migration).toContain("create trigger proposals_customer_portal_response_integrity");
    // The trigger requires a real decodable image data URL — a bare
    // `data:image/` prefix with no payload must not pass.
    expect(migration).toContain("data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$");
  });

  it("lets the portal record the response event and activity row for that proposal only", () => {
    expect(migration).toContain("create policy proposal_deliveries_portal_response_policy on proposal_deliveries");
    expect(migration).toContain("event_type in ('proposal.accepted', 'proposal.declined')");
    expect(migration).toContain("delivery_channel = 'portal'");
    expect(migration).toContain("create policy activity_events_portal_proposal_response_policy on activity_events");
  });

  it("awards the project of the accepted proposal and nothing else", () => {
    expect(migration).toContain("create policy projects_portal_proposal_award_policy on projects");
    expect(migration).toContain("current_app_portal_proposal_project_id()");
    expect(migration).toContain("create or replace function public.enforce_customer_portal_proposal_award()");
    expect(migration).toContain("Customer portal proposal acceptance may only award the project of the accepted proposal");
  });
});

// Codex P2 (PR #1079 promotion review): the trigger above only checked
// the data-URL pattern, so a payload that decodes to bytes but is not an
// image passed the database check. The follow-up migration carries the
// magic-byte rule into the database without editing the landed migration.
describe("signature image magic-byte migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20261124185609_add_signature_image_magic_bytes/migration.sql"),
    "utf8"
  );

  it("adds a magic-byte validator for the accepted image types", () => {
    expect(migration).toContain("create or replace function public.is_valid_signature_image(data_url text)");
    expect(migration).toContain("decode(split_part(data_url, ',', 2), 'base64')");
    // PNG 89 50 4E 47, JPEG FF D8 FF, GIF "GIF8", WebP RIFF....WEBP.
    expect(migration).toContain("get_byte(bytes, 0) = 137");
    expect(migration).toContain("get_byte(bytes, 0) = 255");
    expect(migration).toContain("get_byte(bytes, 0) = 71");
    expect(migration).toContain("get_byte(bytes, 8) = 87");
  });

  it("replaces the portal response trigger function with the magic-byte check", () => {
    expect(migration).toContain("create or replace function public.enforce_customer_portal_proposal_response() returns trigger");
    expect(migration).toContain("or not public.is_valid_signature_image(new.signature_data_url)");
  });
});
