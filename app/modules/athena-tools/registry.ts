import { createAthenaToolRegistry } from "../athena-tool-registry/registry";
import type { AthenaToolRegistry } from "../athena-tool-registry/registry";

// A12 Business Tool Rollout (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md). This is the first
// production tool-registration module - A2's registry previously had zero
// production tools registered (only tests/contract-kit built ad hoc
// registries; see athena-kernel/service.ts's `toolRegistry` module comment).
// Every A12 tool factory takes its application-service dependencies
// explicitly (never a global locator) so this module is the single place
// production wiring happens - each factory is otherwise fully unit-testable
// with fake deps, as every existing contract test in this codebase already
// does.
//
// Deliberately does not call assertValidToolDefinition() itself -
// createAthenaToolRegistry().register() already performs that single
// authoritative runtime check (see athena-tool-sdk/defineTool.ts's module
// comment on why a second copy is never introduced).

import { CrmService } from "../crm/service";
import {
  TransactionalEstimateEngineService,
  TransactionalJobsService,
} from "../athena-events/transactionalPublishers";
import { InvoicesService } from "../invoices/service";
import { ProjectTasksService } from "../project-tasks/service";
import { CostDatabaseService } from "../cost-database/service";
import { AssembliesDatabaseService } from "../assemblies-database/service";

import { createEstimateCreateTool } from "./estimator/createEstimate.tool";
import { createEstimateUpdateTool } from "./estimator/updateEstimate.tool";
import { createEstimateAnalyzeTool } from "./estimator/analyzeEstimate.tool";
import { createEstimateCompareTool } from "./estimator/compareEstimates.tool";

import { createScheduleJobTool } from "./dispatcher/scheduleJob.tool";
import { createAssignTechnicianTool } from "./dispatcher/assignTechnician.tool";
import { createOptimizeDayTool } from "./dispatcher/optimizeDay.tool";
import { createWeatherImpactTool } from "./dispatcher/weatherImpact.tool";

import { createCustomerSearchTool } from "./office/searchCustomers.tool";
import { createCustomerSummarizeTool } from "./office/summarizeCustomer.tool";
import { createFollowUpCreateTool } from "./office/createFollowUp.tool";
import { createInvoicePrepareTool } from "./office/prepareInvoice.tool";

import { createJobContextTool } from "./field/jobContext.tool";
import { createJobUpdateStatusTool } from "./field/updateJobStatus.tool";
import { createJobAddNoteTool } from "./field/addJobNote.tool";
import { createJobRecommendationTool } from "./field/createRecommendation.tool";

import { createCostbookLookupTool } from "./costbook/lookup.tool";
import { createCostbookAnalyzeMarginTool } from "./costbook/analyzeMargin.tool";
import { createCostbookRecommendPriceTool } from "./costbook/recommendPrice.tool";

export function createProductionAthenaToolRegistry(): AthenaToolRegistry {
  const registry = createAthenaToolRegistry();

  const crm = new CrmService();
  const estimateEngine = new TransactionalEstimateEngineService();
  const jobs = new TransactionalJobsService();
  const invoices = new InvoicesService();
  const projectTasks = new ProjectTasksService();
  const costDatabase = new CostDatabaseService();
  const assembliesDatabase = new AssembliesDatabaseService();

  const tools = [
    createEstimateCreateTool({ estimateEngine }),
    createEstimateUpdateTool({ estimateEngine }),
    createEstimateAnalyzeTool({ estimateEngine }),
    createEstimateCompareTool({ estimateEngine }),

    createScheduleJobTool({ jobs }),
    createAssignTechnicianTool({ jobs }),
    createOptimizeDayTool({ jobs }),
    createWeatherImpactTool(),

    createCustomerSearchTool({ crm }),
    createCustomerSummarizeTool({ crm }),
    createFollowUpCreateTool({ projectTasks }),
    createInvoicePrepareTool({ estimateEngine, invoices }),

    createJobContextTool({ jobs }),
    createJobUpdateStatusTool({ jobs }),
    createJobAddNoteTool({ crm }),
    createJobRecommendationTool({ jobs }),

    createCostbookLookupTool({ costDatabase, assembliesDatabase }),
    createCostbookAnalyzeMarginTool({ costDatabase }),
    createCostbookRecommendPriceTool({ costDatabase }),
  ];

  for (const tool of tools) {
    registry.register(tool);
  }

  return registry;
}
