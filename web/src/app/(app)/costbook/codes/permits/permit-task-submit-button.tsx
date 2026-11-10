"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/clientApi";

/**
 * The explicit confirm step for permit submission. There is no
 * auto-submit anywhere in this flow: the button asks the human to
 * confirm, and only then posts confirm: true to the API.
 */
export function PermitTaskSubmitButton({
  taskId,
  expectedUpdatedAt,
  disabled,
}: {
  taskId: string;
  expectedUpdatedAt: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    const confirmed = window.confirm(
      "Submit this permit to the issuing authority?\n\nThis records the submission in TradeOS. It does not grant a permit — no source link or AI message counts as a permit.",
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await clientFetch(`/api/v1/costbook/codes/permit-tasks/${taskId}/submit`, {
        method: "POST",
        body: JSON.stringify({ expectedUpdatedAt, confirm: true }),
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || busy}
        className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit permit"}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
