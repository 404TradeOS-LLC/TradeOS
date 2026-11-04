import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

// Fail closed on production session requests without verified Vercel identity.
export default eveChannel({ auth: [vercelOidc(), localDev()] });
