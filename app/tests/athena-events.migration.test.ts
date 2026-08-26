import fs from "node:fs";
import path from "node:path";

describe("athena events migration", () => {
  it("adds the expected tables, dedupe indexes, and forced RLS policies", () => {
    const migration = fs.readFileSync(path.join(__dirname, "../prisma/migrations/20260810180000_add_athena_events/migration.sql"), "utf8");

    expect(migration).toContain("create table athena_events");
    expect(migration).toContain("create table athena_event_deliveries");
    expect(migration).toContain("create table athena_event_dead_letters");

    // Publication dedupe key (plan doc: "Publication dedupes by (orgId,
    // idempotencyKey)").
    expect(migration).toContain("create unique index idx_athena_events_org_idempotency_key on athena_events(org_id, idempotency_key)");

    // Dispatch dedupe key (plan doc: "dispatch dedupes by (eventId,
    // subscriberId) - a delivery row is claimed exactly once per attempt
    // cycle"). Scoped to first-attempt deliveries only - a replay
    // deliberately creates a new row with is_replay = true rather than
    // reusing this one (see replay.ts), so it does not violate this index.
    expect(migration).toContain("create unique index idx_athena_event_deliveries_event_subscriber on athena_event_deliveries(event_id, subscriber_id)");
    expect(migration).toContain("where is_replay = false");

    expect(migration).toContain("alter table athena_events enable row level security");
    expect(migration).toContain("alter table athena_events force row level security");
    expect(migration).toContain("alter table athena_event_deliveries enable row level security");
    expect(migration).toContain("alter table athena_event_deliveries force row level security");
    expect(migration).toContain("alter table athena_event_dead_letters enable row level security");
    expect(migration).toContain("alter table athena_event_dead_letters force row level security");

    // athena_events' own select/insert policies.
    expect(migration).toContain("create policy athena_events_select_policy on athena_events");
    expect(migration).toContain("create policy athena_events_insert_policy on athena_events");

    // Delivery/dead-letter rows derive their visibility from the parent
    // event rather than a second independent actor check (migration's own
    // comment: "access derives entirely from the parent event's own
    // visibility rule").
    expect(migration).toContain("create policy athena_event_deliveries_select_policy on athena_event_deliveries");
    expect(migration).toContain("create policy athena_event_deliveries_insert_policy on athena_event_deliveries");
    expect(migration).toContain("create policy athena_event_deliveries_update_policy on athena_event_deliveries");
    expect(migration).toContain("create policy athena_event_dead_letters_select_policy on athena_event_dead_letters");
    expect(migration).toContain("create policy athena_event_dead_letters_insert_policy on athena_event_dead_letters");
  });
});
