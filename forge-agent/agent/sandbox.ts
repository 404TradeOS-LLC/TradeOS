import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

// All generated code and repository tests run in an isolated Vercel Sandbox;
// the sandbox has no app-runtime environment secrets or production credentials.
export const environment = VercelSandbox.environment();

export default defineSandbox(() => environment.open({
  networkPolicy: {
    allow: {
      "github.com": [],
      "api.github.com": [],
      "registry.npmjs.org": [],
    },
  },
}));
