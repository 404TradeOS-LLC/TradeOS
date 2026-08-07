import "dotenv/config";
import cors from "cors";
import express, { Request, Response } from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";
import { databaseSession } from "./middleware/databaseSession";
import {
  assignRequestId,
  buildCorsOriginHandler,
  parseTrustProxy,
  requestLogger,
  securityHeaders,
} from "./middleware/productionHardening";
import { adminUiRouter } from "./routes/adminUi.routes";
import { costDatabaseRouter } from "./routes/costDatabase.routes";
import { laborDatabaseRouter } from "./routes/laborDatabase.routes";
import { materialDatabaseRouter } from "./routes/materialDatabase.routes";
import { supplierDatabaseRouter } from "./routes/supplierDatabase.routes";
import { equipmentDatabaseRouter } from "./routes/equipmentDatabase.routes";
import { assembliesDatabaseRouter } from "./routes/assembliesDatabase.routes";
import { estimateEngineRouter } from "./routes/estimateEngine.routes";
import { aiEstimateAssistRouter } from "./routes/aiEstimateAssist.routes";
import { proposalGeneratorRouter } from "./routes/proposalGenerator.routes";
import { proposalsRouter } from "./routes/proposals.routes";
import { invoicesRouter } from "./routes/invoices.routes";
import { contractsRouter } from "./routes/contracts.routes";
import { adminDashboardRouter } from "./routes/adminDashboard.routes";
import { projectsRouter } from "./routes/projects.routes";
import { changeOrdersRouter } from "./routes/changeOrders.routes";
import { supplierIntegrationRouter } from "./routes/supplierIntegration.routes";
import { organizationProvisioningRouter } from "./routes/organizationProvisioning.routes";
import { authRouter } from "./routes/auth.routes";
import { accountRouter } from "./routes/account.routes";
import { projectIntakeRouter } from "./routes/projectIntake.routes";
import { knowledgeRuntimeRouter } from "./routes/knowledgeRuntime.routes";
import { settingsRouter } from "./routes/settings.routes";
import { brandStudioRouter } from "./routes/brandStudio.routes";
import { intelligenceRouter } from "./routes/intelligence.routes";
import { companyRouter, customerImportRouter, customersRouter as crmCustomersRouter, invoicePaymentsRouter, notesRouter } from "./routes/crm.routes";
import { jobsRouter, scheduleRouter } from "./routes/jobs.routes";

export function createServer() {
  const app = express();

  app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));
  app.disable("x-powered-by");
  app.use(assignRequestId);
  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(cors({ origin: buildCorsOriginHandler() }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "tradeos-costbook-api",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use("/admin", adminUiRouter);

  // Platform provisioning uses a separate high-entropy credential because no
  // tenant identity exists until this transaction creates the first owner.
  app.use("/api/v1/platform", organizationProvisioningRouter);

  // Public self-serve signup/login — no bearer token exists yet, that's what
  // these issue. Rate-limited per IP (see authRateLimit) since unlike
  // platform provisioning these are meant to be reachable by anyone.
  app.use("/api/v1/auth", authRouter);

  // requireAuth now verifies bearer JWTs and loads org membership context.
  app.use("/api/v1", requireAuth, databaseSession);
  app.use("/api/v1/account", accountRouter);

  app.use("/api/v1/cost-database", costDatabaseRouter);
  app.use("/api/v1/labor-rates", laborDatabaseRouter);
  app.use("/api/v1/materials", materialDatabaseRouter);
  app.use("/api/v1/suppliers", supplierDatabaseRouter);
  app.use("/api/v1/equipment", equipmentDatabaseRouter);
  app.use("/api/v1/assemblies", assembliesDatabaseRouter);
  app.use("/api/v1/estimates", estimateEngineRouter);
  app.use("/api/v1/estimates", aiEstimateAssistRouter);
  app.use("/api/v1/proposals", proposalGeneratorRouter);
  app.use("/api/v1/proposals", proposalsRouter);
  app.use("/api/v1/invoices", invoicesRouter);
  app.use("/api/v1/invoices", invoicePaymentsRouter);
  app.use("/api/v1/contracts", contractsRouter);
  app.use("/api/v1/admin", adminDashboardRouter);
  app.use("/api/v1/customers", crmCustomersRouter);
  app.use("/api/v1/projects", projectsRouter);
  app.use("/api/v1/jobs", jobsRouter);
  app.use("/api/v1/schedule", scheduleRouter);
  app.use("/api/v1/notes", notesRouter);
  app.use("/api/v1/change-orders", changeOrdersRouter);
  app.use("/api/v1/supplier-integrations", supplierIntegrationRouter);
  app.use("/api/v1/project-intake", projectIntakeRouter);
  app.use("/api/v1/knowledge", knowledgeRuntimeRouter);
  app.use("/api/v1/settings", settingsRouter);
  app.use("/api/v1/company", companyRouter);
  app.use("/api/v1/import/customers", customerImportRouter);
  app.use("/api/v1/brand-studio", brandStudioRouter);
  app.use("/api/v1/intelligence", intelligenceRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
