import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function validateMatrix(matrix) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) {
    fail("matrix must be a JSON object.");
    return errors;
  }
  const allowedStatuses = new Set(matrix.statusVocabulary ?? []);
  const seenJourneyIds = new Set();
  const seenActionIds = new Set();

  if (matrix.schemaVersion !== 1) fail("schemaVersion must be 1.");
  if (matrix.sprint !== "S051") fail("sprint must be S051.");
  if (!Array.isArray(matrix.journeys) || matrix.journeys.length === 0) {
    fail("journeys must contain at least one release-critical workflow.");
    return errors;
  }

  let serverSource = "";
  try {
    serverSource = read("app/backend/server.ts");
  } catch {
    fail("Unable to read app/backend/server.ts.");
  }

  for (const journey of matrix.journeys) {
    if (!journey.id || seenJourneyIds.has(journey.id)) fail(`Journey id is missing or duplicated: ${journey.id ?? "<missing>"}.`);
    seenJourneyIds.add(journey.id);
    for (const field of ["name", "owner", "authorization", "refresh", "browserCheckpoint"]) {
      if (typeof journey[field] !== "string" || !journey[field].trim()) fail(`${journey.id}: ${field} must be documented.`);
    }
    if (!allowedStatuses.has(journey.status)) fail(`${journey.id}: unsupported status ${journey.status}.`);
    if (!Array.isArray(journey.automatedEvidence) || journey.automatedEvidence.length === 0) {
      fail(`${journey.id}: at least one automated evidence reference is required.`);
    }
    for (const evidencePath of journey.automatedEvidence ?? []) {
      if (!fs.existsSync(path.join(repoRoot, evidencePath))) fail(`${journey.id}: automated evidence file does not exist: ${evidencePath}.`);
    }
    if (!Array.isArray(journey.actions) || journey.actions.length === 0) {
      if (typeof journey.unmappedGap !== "string" || !journey.unmappedGap.trim()) {
        fail(`${journey.id}: an empty action list must state the concrete unmapped gap.`);
      }
      continue;
    }

    for (const action of journey.actions) {
      if (!action.id || seenActionIds.has(action.id)) fail(`Action id is missing or duplicated: ${action.id ?? "<missing>"}.`);
      seenActionIds.add(action.id);
      for (const field of ["label", "source", "symbol", "frontendPath", "method", "mount", "routeFile", "router", "route", "handler", "contractFile", "request", "response", "permission", "tenant", "refresh", "evidence", "browser"]) {
        if (typeof action[field] !== "string" || !action[field].trim()) fail(`${action.id}: ${field} must be documented.`);
      }
      if (!allowedStatuses.has(action.status)) fail(`${action.id}: unsupported status ${action.status}.`);

      for (const relativePath of [action.source, action.screen, action.routeFile, action.contractFile, action.evidence]) {
        if (relativePath && !fs.existsSync(path.join(repoRoot, relativePath))) fail(`${action.id}: referenced file does not exist: ${relativePath}.`);
      }
      if (action.source && fs.existsSync(path.join(repoRoot, action.source))) {
        const source = read(action.source);
        if (!source.includes(action.symbol)) fail(`${action.id}: frontend symbol ${action.symbol} is absent from ${action.source}.`);
        const requestPathIndex = source.indexOf(action.frontendPath);
        if (requestPathIndex === -1) {
          fail(`${action.id}: frontend request path ${action.frontendPath} is absent from ${action.source}.`);
        } else {
          const requestContext = source.slice(requestPathIndex, requestPathIndex + 180);
          const methodOption = requestContext.match(/\bmethod\s*:\s*([^,}\n]+)/);
          let actualMethods = methodOption
            ? [...methodOption[1].matchAll(/["'](GET|POST|PUT|PATCH|DELETE)["']/g)].map((match) => match[1])
            : ["GET"];
          const methodAlias = methodOption?.[1].trim().match(/^(\w+)\.method$/);
          if (methodAlias) {
            const beforeRequestPath = source.slice(Math.max(0, requestPathIndex - 1_200), requestPathIndex);
            const escapedAlias = methodAlias[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const aliasDeclaration = new RegExp(`const\\s+${escapedAlias}\\s*=\\s*\\{[\\s\\S]{0,800}?\\bmethod\\s*:\\s*["'](GET|POST|PUT|PATCH|DELETE)["']`);
            const aliasMatch = beforeRequestPath.match(aliasDeclaration);
            actualMethods = aliasMatch ? [aliasMatch[1]] : [];
          }
          const expectedMethods = [...new Set(action.method.split("|").map((value) => value.trim().toUpperCase()))].sort();
          if (actualMethods.length === 0 || [...new Set(actualMethods)].sort().join("|") !== expectedMethods.join("|")) {
            fail(`${action.id}: frontend request method for ${action.frontendPath} does not match ${expectedMethods.join("|")}.`);
          }
        }
      }

      const mountRouter = action.mountRouter ?? action.router;
      const routeModule = `./${action.routeFile.replace(/^app\/backend\//, "") .replace(/\.ts$/, "")}`;
      const imports = [...serverSource.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/gs)]
        .find((match) => match[2] === routeModule)?.[1] ?? "";
      const bindingIsCorrect = imports.split(",").some((entry) => {
        const parts = entry.trim().split(/\s+as\s+/);
        return parts.length === 1
          ? parts[0] === action.router && mountRouter === action.router
          : parts[0] === action.router && parts[1] === mountRouter;
      });
      if (!action.mount || !mountRouter || !bindingIsCorrect || !serverSource.includes(`app.use("${action.mount}", ${mountRouter})`)) {
        fail(`${action.id}: ${mountRouter} is not mounted at ${action.mount} in app/backend/server.ts.`);
      }

      let routeSource = "";
      try {
        routeSource = read(action.routeFile);
      } catch {
        continue;
      }
      const methods = action.method.split("|").map((value) => value.trim().toLowerCase());
      const routes = action.route.split("|").map((value) => value.trim());
      const handlers = action.handler.split("|").map((value) => value.trim());
      const contractSymbols = action.contractSymbols;
      let contractSource = "";
      try {
        contractSource = read(action.contractFile);
      } catch {}
      if (!Array.isArray(contractSymbols) || contractSymbols.length !== handlers.length) {
        fail(`${action.id}: contractSymbols must identify every controller handler.`);
      } else {
        for (const symbol of contractSymbols) {
          if (typeof symbol !== "string" || !new RegExp(`\\b${symbol}\\s*\\(`).test(contractSource)) {
            fail(`${action.id}: controller contract symbol ${symbol} is absent from ${action.contractFile}.`);
          }
        }
      }
      if (methods.length !== routes.length || methods.length !== handlers.length) {
        fail(`${action.id}: method, route, and handler alternatives must have matching counts.`);
        continue;
      }
      for (let index = 0; index < methods.length; index += 1) {
        const method = methods[index];
        const route = routes[index];
        const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const routePattern = new RegExp(`${action.router}\\.${method}\\(\\s*["']${escapedRoute}["']`, "m");
        const registration = routeSource.split(/\r?\n/).find((line) => routePattern.test(line));
        if (!registration) {
          fail(`${action.id}: ${method.toUpperCase()} ${route} is not registered in ${action.routeFile}.`);
        } else if (!registration.includes(handlers[index])) {
          fail(`${action.id}: ${method.toUpperCase()} ${route} is no longer connected to ${handlers[index]} in ${action.routeFile}.`);
        }
      }
    }
  }

  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let matrix;
  try {
    matrix = JSON.parse(read("docs/testing/FRONTEND_BACKEND_CONNECTION_MATRIX.json"));
  } catch (error) {
    console.error(`Unable to parse connection matrix: ${error.message}`);
    process.exit(1);
  }
  const errors = validateMatrix(matrix);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  const actionCount = matrix.journeys.reduce((sum, journey) => sum + journey.actions.length, 0);
  console.log(`Validated ${matrix.journeys.length} journeys and ${actionCount} mapped actions against live frontend/backend route sources.`);
}

export { validateMatrix };
