import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { AthenaDisplayState } from "@/lib/athena-state";

/**
 * Renders any of the three non-"ready" states an Athena page can be in
 * (signed_out, denied, not_enabled, error - see web/src/lib/athena-state.ts).
 * Reuses the same EmptyState primitive every other list page in this app
 * uses for "nothing here" (web/src/components/ui/empty-state.tsx), rather
 * than inventing a second visual language for "you can't see this."
 */
export function AthenaStatePanel({ state }: { state: AthenaDisplayState }) {
  const { title, description } = describe(state);

  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      }
    />
  );
}

function describe(state: AthenaDisplayState): { title: string; description: string } {
  switch (state.kind) {
    case "signed_out":
      return {
        title: "Sign in required",
        description: "You need to be signed in as an organization owner or admin to view Athena observability.",
      };
    case "denied":
      return {
        title: "Operator access required",
        description:
          "Athena observability is limited to owner and admin roles - it surfaces cost, traces, and error detail across the whole organization." +
          (state.currentRole ? ` Your current role is "${state.currentRole}".` : ""),
      };
    case "not_enabled":
      return {
        title: "Athena observability isn't enabled yet",
        description: "This environment hasn't turned on Athena observability for your organization. Nothing is broken - check back once it's enabled.",
      };
    case "error":
      return {
        title: "Couldn't load Athena observability",
        description: state.message ?? "Something went wrong reaching the Athena observability service. Try again in a moment.",
      };
  }
}
