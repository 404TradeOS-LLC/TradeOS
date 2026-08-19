"use client";

import { useSyncExternalStore } from "react";
import { createGreetingSubscription, greetingForHour } from "@/components/dashboard/owner-dashboard-header-model";

function getSnapshot() {
  return greetingForHour(new Date().getHours());
}

function getServerSnapshot() {
  return "Welcome back";
}

export function OwnerDashboardGreeting() {
  const greeting = useSyncExternalStore(createGreetingSubscription, getSnapshot, getServerSnapshot);
  return <>{greeting}</>;
}
