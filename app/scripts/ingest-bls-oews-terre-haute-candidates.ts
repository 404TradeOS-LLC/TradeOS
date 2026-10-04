import "dotenv/config";
import { basePrisma } from "../db/client";
import { runWithBackgroundDatabaseSession } from "../db/requestSession";
import { ingestTerreHauteBlsOewsCandidates } from "../modules/costbook/blsOewsIngestion";

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
    throw new Error("Usage: ingest-bls-oews-terre-haute-candidates.ts --org-id <uuid> --user-id <uuid>");
  }
  return { orgId, userId };
}

async function main() {
  const { orgId, userId } = parseArgs(process.argv.slice(2));
  const result = await runWithBackgroundDatabaseSession(
    basePrisma,
    { jobName: "costbook-bls-oews-terre-haute-ingest", orgId, userId },
    (auth) => ingestTerreHauteBlsOewsCandidates(auth)
  );

  console.log(
    `[bls-oews] ${result.created.length} candidates created, ${result.skipped.length} already present. ` +
      "No LaborRate or bill-rate record was created; human review remains required."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
