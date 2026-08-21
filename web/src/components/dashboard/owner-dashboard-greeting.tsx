"use client";

import { useSyncExternalStore } from "react";
import { createGreetingSubscription, greetingForHour } from "@/components/dashboard/owner-dashboard-header-model";

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
