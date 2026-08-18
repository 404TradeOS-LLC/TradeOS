import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const PROMPT_REGISTRY = {
  'startup': {
    id: 'startup',
    title: 'Session Startup & Autonomy Reconciliation',
    category: 'Workflow & Governance',
    targetAgents: ['Claude Code', 'ChatGPT', 'Gemini'],
    description: 'Verifies git branch, uncommitted diffs, and open PRs before writing any code.',
    variables: {
      ALLOWED_PATHS: {
        description: 'Comma or space-separated allowed file paths for the task',
        default: 'app/modules/**, app/backend/**'
      },
      FORBIDDEN_PATHS: {
        description: 'Forbidden paths for this specific mission',
        default: 'packages/knowledge-engine/**, app/prisma/schema.prisma'
      },
      MISSION_GOAL: {
        description: 'One-sentence summary of the task objective',
        default: 'Execute bounded feature implementation'
      }
    },
    template: `Execute the Canonical Startup Flow in \`docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md\` before making any edits:
1. Verify the current git branch, HEAD commit, and working tree state.
2. Read \`docs/TRADEOS_BIBLE.md\` and \`docs/CURRENT_STATE.md\` as sources of truth.
3. Check open PRs and \`docs/SESSION_HANDOFF.md\` for active lane collisions.
4. Output your understanding of:
   - Target Scope & Allowed Paths: {{ALLOWED_PATHS}}
   - Forbidden Paths: {{FORBIDDEN_PATHS}}
   - Mission Goal: {{MISSION_GOAL}}
   - Planned Verification Commands
Do not generate code diffs until this startup check is reported and confirmed.`
  },

  'backend': {
    id: 'backend',
    title: 'Backend Service & API Route Implementation',
    category: 'Backend Engineering',
    targetAgents: ['Claude Code', 'ChatGPT'],
    description: 'Implements Express routes, controllers, and domain services in app/ with strict RLS and transactions.',
    variables: {
      FEATURE_NAME: {
        description: 'Name of the feature being implemented',
        default: 'New Feature'
      },
      CONTROLLER_PATH: {
        description: 'Path to the controller file',
        default: 'app/backend/controllers/feature.controller.ts'
      },
      ROUTE_PATH: {
        description: 'Path to the route definition file',
        default: 'app/backend/routes/feature.routes.ts'
      },
      MODULE_PATH: {
        description: 'Path to the service module directory',
        default: 'app/modules/feature/'
      },
      PERMISSION_KEY: {
        description: 'RBAC permission key required for endpoint',
        default: 'crm.read'
      }
    },
    template: `Implement the backend changes for {{FEATURE_NAME}} in \`app/\`:
- Allowed Paths: \`{{CONTROLLER_PATH}}\`, \`{{ROUTE_PATH}}\`, \`{{MODULE_PATH}}/**\`
- Rules & Constraints:
  1. Tenancy: Enforce organization scoping strictly from request context (\`req.orgId\`). Never trust caller-supplied \`organizationId\`.
  2. Permissions: Gate endpoints with \`requirePermissions('{{PERMISSION_KEY}}')\`.
  3. Database Transactions: Use \`runInDatabaseTransaction()\` from \`app/db/requestSession.ts\`. Do NOT call \`prisma.$transaction()\` directly.
  4. Validation: Use strict Zod schemas rejecting unknown fields (\`.strict()\`).
  5. Audit & Telemetry: Record timeline events via \`ActivityTimelineService\` where appropriate.
- Tests: Add unit tests under \`app/tests/\` covering success, validation rejection (400), unauthorized access (403), and missing resources (404).
- Verification: Run \`cd app && npm test && npm run lint && npm run build\`.`
  },

  'database-rls': {
    id: 'database-rls',
    title: 'Supabase Postgres Migration & Forced RLS Hardening',
    category: 'Database & Security',
    targetAgents: ['Claude Code', 'ChatGPT', 'Gemini'],
    description: 'Generates safe Prisma migrations and hardened Row Level Security policies.',
    variables: {
      TABLE_NAME: {
        description: 'Database table name being created or modified',
        default: 'my_table'
      },
      MIGRATION_NAME: {
        description: 'Descriptive migration name in snake_case',
        default: 'add_table_and_rls'
      },
      MANAGE_HELPER: {
        description: 'SQL helper function for write authorization',
        default: 'current_app_can_manage_costbook()'
      }
    },
    template: `Design a Prisma migration and Supabase PostgreSQL RLS policy for \`{{TABLE_NAME}}\`:
- Constraints:
  1. Migration File: Generate under \`app/prisma/migrations/YYYYMMDDHHMMSS_{{MIGRATION_NAME}}/migration.sql\`.
  2. RLS Enforcement: Add \`ENABLE ROW LEVEL SECURITY\` and \`FORCE ROW LEVEL SECURITY\` to \`{{TABLE_NAME}}\`.
  3. Tenant Policy: Restrict SELECT/INSERT/UPDATE/DELETE to authenticated organizations using helper functions (e.g., \`{{MANAGE_HELPER}}\`). Pin all helper functions to \`SET search_path = ''\`.
  4. Role Boundaries: Ensure the \`tradeos_app\` runtime role has correct grants without bypassing RLS (\`rolbypassrls: false\`).
  5. Precision: Use \`numeric(10,2)\` or integer cents for currency fields; avoid floating-point types.
- Verification: Verify schema consistency via \`npx prisma validate\` and add regression test coverage for cross-tenant isolation in \`app/tests/rls.integration.ts\`.`
  },

  'frontend': {
    id: 'frontend',
    title: 'Frontend Component & Next.js App Router Engineering',
    category: 'Frontend Engineering',
    targetAgents: ['Claude Code', 'ChatGPT'],
    description: 'Creates or updates Next.js App Router pages and Tailwind components with honest state degradation.',
    variables: {
      PAGE_NAME: {
        description: 'Target route or component name',
        default: 'Costbook Hierarchy'
      },
      ROUTE_PATH: {
        description: 'Next.js route directory',
        default: 'web/src/app/(app)/costbook/divisions'
      },
      COMPONENT_PATH: {
        description: 'Component directory or file',
        default: 'web/src/components/costbook/'
      },
      ACTION_PATH: {
        description: 'Server action file path',
        default: 'web/src/app/actions/costbook.ts'
      }
    },
    template: `Implement the UI for {{PAGE_NAME}} in \`web/\`:
- Allowed Paths: \`{{ROUTE_PATH}}/**\`, \`{{COMPONENT_PATH}}/**\`, \`{{ACTION_PATH}}\`
- Rules & Constraints:
  1. App Router & Layout: Adhere to standard PageHeader, Card, and Badge primitives from \`web/src/components/ui/\` and \`web/src/components/shared/\`.
  2. Honest State Degradation: Do not fabricate placeholder data. Implement explicit loading skeletons (\`loading.tsx\`), empty states (\`EmptyState\`), and error fallbacks.
  3. Server Actions & Security: Verify Supabase user session server-side. Never import \`SUPABASE_SERVICE_ROLE_KEY\` into browser bundles (guarded by \`web/src/lib/envSecurity.test.ts\`).
  4. Mobile & Desktop Responsive: Ensure tables include \`min-w-[820px]\` desktop styling with mobile card list alternatives (\`hidden md:block\` / \`md:hidden\`).
- Verification: Run \`cd web && npm test && npm run lint && npm run build\`.`
  },

  'auth-supabase': {
    id: 'auth-supabase',
    title: 'Supabase Auth, Session & Finish-Setup Debugging',
    category: 'Authentication & Security',
    targetAgents: ['Claude Code', 'ChatGPT', 'Gemini'],
    description: 'Diagnoses and fixes Supabase JWT validation, login bootstrapping, and tenant session flags.',
    variables: {
      AUTH_SCENARIO: {
        description: 'Specific auth flow or bug scenario being addressed',
        default: 'Post-signup organization bootstrap and session refresh'
      }
    },
    template: `Diagnose and repair the authentication / session issue with {{AUTH_SCENARIO}}:
- Context:
  - Frontend proxy: \`web/src/proxy.ts\` / \`web/src/lib/supabase/proxy.ts\`
  - Backend JWT verification: \`app/backend/auth/jwt.ts\` (RS256 JWKS via \`jose ^4.15.9\`)
  - Bootstrap endpoint: \`POST /api/v1/auth/bootstrap\` & \`AuthService.bootstrapSupabaseIdentity\`
- Requirements:
  1. Inspect the session resolution sequence (\`app.login_lookup\` -> \`app.user_id\` -> \`app.org_id\`).
  2. Ensure unprovisioned identities without an organization gracefully redirect to \`/finish-setup\` with \`details.code: 'organization_name_required'\`.
  3. Confirm Server Actions properly forward auth cookies and bearer tokens.
  4. Provide regression tests in \`app/tests/auth.service.test.ts\` or \`app/tests/jwt.supabase.test.ts\`.`
  },

  'vercel-cloudflare': {
    id: 'vercel-cloudflare',
    title: 'Vercel & Cloudflare Production Diagnostics',
    category: 'Infrastructure & Deployment',
    targetAgents: ['Claude Code', 'ChatGPT', 'Gemini'],
    description: 'Diagnoses runtime errors, middleware matcher problems, CORS, or bundle packaging in Vercel.',
    variables: {
      ERROR_LOGS: {
        description: 'Paste error message or runtime log snippet',
        default: 'TypeError: ... or 500 Internal Server Error'
      }
    },
    template: `Investigate this Vercel / Cloudflare runtime error:
\`\`\`
{{ERROR_LOGS}}
\`\`\`

Check against known TradeOS deployment contracts:
1. Proxy & Middleware: Ensure \`web/src/proxy.ts\` matcher excludes public routes (\`/login\`, \`/signup\`) and covers all \`(app)\` routes.
2. CORS & Proxy Headers: Verify \`TRUST_PROXY=1\` configuration and \`isAllowedCorsOrigin\` in \`app/backend/middleware/productionHardening.ts\`.
3. Serverless Packaging: Confirm sibling packages like \`packages/knowledge-engine\` are vendored via \`app/scripts/vendor-knowledge-engine.js\` if accessed by backend Lambdas.
4. Turbopack Root: Ensure \`turbopack.root\` in \`web/next.config.ts\` correctly spans the repository root.
Report the exact root cause, proposed minimal fix, and affected files.`
  },

  'athena-tool': {
    id: 'athena-tool',
    title: 'Athena AI Kernel & Business Tool Implementation',
    category: 'AI & Athena Subsystems',
    targetAgents: ['Claude Code', 'ChatGPT'],
    description: 'Registers and implements first-party Athena business tools with telemetry and idempotency.',
    variables: {
      TOOL_NAME: {
        description: 'Name of the business tool (e.g. ScheduleJobTool)',
        default: 'CreateDraftEstimateTool'
      },
      TARGET_SERVICE: {
        description: 'Underlying application service being wrapped',
        default: 'EstimateEngineService'
      },
      RISK_LEVEL: {
        description: 'Risk classification (low, medium, high)',
        default: 'low'
      }
    },
    template: `Implement a new Athena business tool: \`{{TOOL_NAME}}\`
- Target Directory: \`app/modules/athena-tools/\`
- Architecture Guidelines:
  1. Tool Definition: Use \`defineTool()\` wrapper around \`{{TARGET_SERVICE}}\`. Do NOT query Prisma directly.
  2. Risk Level: Set to \`risk: '{{RISK_LEVEL}}'\` for reversible internal drafts/operational changes.
  3. Idempotency: Bind actions to \`AthenaIdempotencyStore\` with organization/actor execution keys.
  4. Event Integration: If emitting canonical events, use the atomic outbox persistence in \`app/modules/athena-events\`.
  5. Telemetry & Observability: Ensure actions inherit \`spanType\` and error codes compatible with \`app/modules/athena-observability\`.
- Tests: Add tool unit tests in \`app/tests/athena-tools.test.ts\` verifying input validation and service execution.`
  },

  'bugfix': {
    id: 'bugfix',
    title: 'Isolated Bug Fix & Root-Cause Analysis',
    category: 'Maintenance & Debugging',
    targetAgents: ['Claude Code', 'ChatGPT', 'Gemini'],
    description: 'Applies minimal surgical fix with root-cause explanation and dedicated regression tests.',
    variables: {
      MODULE_NAME: {
        description: 'Module or component where bug occurs',
        default: 'CRM Service'
      },
      BUG_DESCRIPTION: {
        description: 'Details of error or unexpected behavior',
        default: 'Description of the defect'
      }
    },
    template: `We have a bug in {{MODULE_NAME}}:
\`\`\`
{{BUG_DESCRIPTION}}
\`\`\`

Follow this three-step remediation protocol:
1. Root-Cause Analysis: Identify the exact line and condition causing the failure. Explain why existing unit tests did not catch it.
2. Minimal Surgical Fix: Apply the fix without modifying unrelated files, refactoring existing contracts, or altering database schemas.
3. Regression Test: Write a dedicated automated test in \`app/tests/\` or \`web/src/\` that reproduces the bug on unpatched code and passes on patched code.
Run verification commands to prove zero regressions.`
  },

  'pr-gate': {
    id: 'pr-gate',
    title: 'Pre-PR Sanity Check & Verification Gate',
    category: 'Quality Assurance & CI',
    targetAgents: ['Claude Code', 'ChatGPT', 'Gemini'],
    description: 'Full pre-merge audit of diffs, linting, builds, test suites, and multi-tenant security.',
    variables: {
      BRANCH_NAME: {
        description: 'Current feature branch name',
        default: 'feature/my-work'
      }
    },
    template: `Perform the Canonical Pre-PR Verification Gate on branch \`{{BRANCH_NAME}}\`:
1. Inspect full \`git diff main\` to ensure no debug code, secrets, lockfile noise, or unapproved files were changed.
2. Execute full validation suite:
   - Backend: \`cd app && npm test && npm run lint && npm run build\`
   - Frontend: \`cd web && npm test && npm run lint && npm run build\`
   - Docs Governance: \`npm run docs:check\`
3. Check Multi-Tenant Safety: Verify no route bypasses RLS or accepts unverified tenant IDs.
4. Output a summary table with:
   - Files Modified
   - Tests Passing / Blocked
   - Remaining Known Risks or Tech Debt`
  },

  'docs-handoff': {
    id: 'docs-handoff',
    title: 'Sprint Handoff & Documentation Reconciliation',
    category: 'Documentation & State',
    targetAgents: ['Claude Code', 'ChatGPT', 'Gemini'],
    description: 'Updates CURRENT_STATE.md, SESSION_HANDOFF.md, and DOC_OWNERSHIP.yml upon sprint completion.',
    variables: {
      FEATURE_OR_SPRINT: {
        description: 'Sprint ID or feature name completed',
        default: 'S027 Intelligent Costbook'
      }
    },
    template: `Update repository documentation following the completion of {{FEATURE_OR_SPRINT}}:
1. Update \`docs/CURRENT_STATE.md\`:
   - Add the verified implementation facts and file paths under "Recent verified changes".
   - Note any new blockers or unresolved technical debt.
2. Update \`docs/SESSION_HANDOFF.md\`:
   - State the current mission status, merged commit SHAs, and active out-of-band PRs.
   - Set "Next Eligible Sprint" based on \`docs/SPRINT_BACKLOG.md\`.
3. Update \`docs/DOC_OWNERSHIP.yml\` if new files or modules were introduced.
Ensure documentation reflects exact repository reality without forward-looking claims.`
  }
};

/**
 * Returns git repository context if available.
 */
export function getGitContext(repoRoot) {
  try {
    const branch = execSync('git branch --show-current', { cwd: repoRoot, encoding: 'utf8' }).trim();
    const head = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    return { branch: branch || 'unknown', head: head || 'unknown' };
  } catch {
    return { branch: 'unknown', head: 'unknown' };
  }
}

/**
 * Renders a prompt template with given variable overrides.
 */
export function renderPrompt(promptId, userVars = {}, repoRoot = process.cwd()) {
  const item = PROMPT_REGISTRY[promptId];
  if (!item) {
    throw new Error(`Prompt ID not found: "${promptId}". Use --list to view all available prompts.`);
  }

  const gitCtx = getGitContext(repoRoot);
  const vars = {};

  // Populate defaults
  for (const [key, config] of Object.entries(item.variables || {})) {
    if (key === 'BRANCH_NAME' && gitCtx.branch !== 'unknown') {
      vars[key] = userVars[key] || gitCtx.branch;
    } else {
      vars[key] = userVars[key] || config.default || '';
    }
  }

  let rendered = item.template;
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`\{\{${key}\}\}`, 'g');
    rendered = rendered.replace(regex, val);
  }

  return {
    meta: {
      id: item.id,
      title: item.title,
      category: item.category,
      targetAgents: item.targetAgents
    },
    variables: vars,
    rendered
  };
}

/**
 * Copies text to macOS clipboard using pbcopy if available.
 */
export function copyToClipboard(text) {
  try {
    execSync('pbcopy', { input: text, encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}
