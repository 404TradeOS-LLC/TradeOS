"use client";

import { useSyncExternalStore } from "react";
import { greetingForHour } from "@/components/dashboard/owner-dashboard-header-model";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return greetingForHour(new Date().getHours());
}

function getServerSnapshot() {
  return "Welcome back";
}

export function OwnerDashboardGreeting() {
  const greeting = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <>{greeting}</>;
}
