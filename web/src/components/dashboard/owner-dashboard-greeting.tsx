"use client";

import { useSyncExternalStore } from "react";
import { buildHeaderSynthesis, createGreetingSubscription, greetingForHour } from "@/components/dashboard/owner-dashboard-header-model";

/** Returns the current client-side greeting snapshot for React's external-store subscription. */
function getSnapshot() {
  return greetingForHour(new Date().getHours());
}

/** Provides a deterministic hydration-safe greeting until the client snapshot is available. */
function getServerSnapshot() {
  return "Welcome back";
}

/** Renders the owner greeting and refreshes it automatically at each greeting boundary. */
export function OwnerDashboardGreeting() {
  const greeting = useSyncExternalStore(createGreetingSubscription, getSnapshot, getServerSnapshot);
  return <>{greeting}</>;
}

interface OwnerDashboardSynthesisProps {
  notificationCount: number;
  todaysJobsCount: number;
}

/**
 * Renders the header's single synthesized status sentence. A client
 * component (like OwnerDashboardGreeting above) so the greeting word tracks
 * the viewer's local hour without a hydration mismatch; the counts it
 * combines with the greeting come from the server-rendered page.
 */
export function OwnerDashboardSynthesis({ notificationCount, todaysJobsCount }: OwnerDashboardSynthesisProps) {
  const greeting = useSyncExternalStore(createGreetingSubscription, getSnapshot, getServerSnapshot);
  return <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{buildHeaderSynthesis(greeting, notificationCount, todaysJobsCount)}</p>;
}
