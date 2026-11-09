import { githubChannel } from "eve/channels/github";

// GitHub App signing credentials must be provided in the isolated Vercel
// project or through a future authorized Vercel Connect integration.
// Without credentials, no GitHub webhook should be accepted.
export default githubChannel({ botName: "tradeos-forge" });
