import "dotenv/config";
import { basePrisma } from "../db/client";
import { runWithBackgroundDatabaseSession } from "../db/requestSession";
import { ingestJonesAndSonsTerreHauteCandidates } from "../modules/costbook/jonesAndSonsIngestion";

/**
 * One-shot operator entry point that submits the two Jones & Sons Terre
 * Haute branch-verified aggregate materials as Costbook research candidates
 * for one organization - the same governed, per-organization submission a
 * costbook.write user could make by hand through POST /costbook/candidates,
 * just scripted so an operator doesn't have to retype the evidence.
 *
 * This never reviews or promotes anything. After it runs, a named human
 * with costbook.manage still has to approve (or reject) each candidate and
 * explicitly promote it through /costbook/research-review before it can
 * become a real Material/CostItem in that organization's Costbook - exactly
 * like a hand-submitted candidate.
 *
 * Usage:
 *   npx ts-node scripts/ingest-jones-and-sons-candidates.ts --org-id <uuid> --user-id <uuid>
 *
 * --user-id must be an existing, active member of --org-id;
 * runWithBackgroundDatabaseSession re-verifies that membership itself and
 * resolves the actor's real role from it (never accepts a caller-supplied
 * role), and the database's own write policy independently requires that
 * role be owner/admin for the insert to succeed.
 */

interface CliArgs {
  orgId: string;
  userId: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let orgId: string | undefined;
  let userId: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--org-id") orgId = argv[i + 1];
    if (argv[i] === "--user-id") userId = argv[i + 1];
  }

  if (!orgId || !userId) {
    throw new Error("Usage: ingest-jones-and-sons-candidates.ts --org-id <uuid> --user-id <uuid>");
  }

  return { orgId, userId };
}

async function main() {
  const { orgId, userId } = parseArgs(process.argv.slice(2));

  const result = await runWithBackgroundDatabaseSession(
    basePrisma,
    { jobName: "costbook-jones-and-sons-ingest", orgId, userId },
    // The resolved `auth` here is derived from --user-id's real, active
    // organization membership - runWithBackgroundDatabaseSession re-verifies
    // it and resolves the real role from the database; nothing here ever
    // trusts a caller-supplied role.
    (auth) => ingestJonesAndSonsTerreHauteCandidates(auth)
  );

  for (const candidate of result.created) {
    console.log(`[jones-and-sons] created candidate ${candidate.id}: ${candidate.itemName} ($${candidate.materialCostTypical}/${candidate.unitOfMeasure})`);
  }
  for (const skipped of result.skipped) {
    console.log(`[jones-and-sons] skipped ${skipped.sourceIdentifier}: organization ${orgId} already has candidate ${skipped.existingCandidateId}`);
  }

  console.log(
    `[jones-and-sons] done: ${result.created.length} created, ${result.skipped.length} already present. ` +
      `Nothing was reviewed or promoted - a costbook.manage user must approve and promote each candidate at /costbook/research-review.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
