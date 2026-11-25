"use client";

import { useActionState, useState } from "react";
import { completeFirstEstimateOnboarding, saveOnboardingProgressAction, skipFirstEstimateOnboarding } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import {
  formatLaborRateDollars,
  MIN_SCOPE_TEXT_LENGTH,
  ONBOARDING_DEFERRED_SETUP,
  ONBOARDING_EXAMPLE_SCOPES,
  ONBOARDING_NEXT_STEPS,
  ONBOARDING_WORK_TYPES,
  type OnboardingState,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const STEP_TITLES = ["Your work", "Build a real estimate"] as const;

function stepSummary(step: number, workTypes: string[]): string {
  if (step === 1) return workTypes.length > 0 ? workTypes.join(" · ") : "Pick the trades you do";
  return "Give Athena a recent job";
}

export function FirstEstimateOnboardingForm({ initialState }: { initialState?: OnboardingState | null }) {
  const [state, formAction, isPending] = useActionState(completeFirstEstimateOnboarding, undefined);
  const [step, setStep] = useState(initialState?.currentStep === 2 ? 2 : 1);
  const [workTypes, setWorkTypes] = useState<string[]>(initialState?.workTypes ?? []);
  const [scopeText, setScopeText] = useState(initialState?.scopeText ?? "");
  const [laborRate, setLaborRate] = useState(formatLaborRateDollars(initialState?.laborRateCents ?? null));
  const [region, setRegion] = useState(initialState?.region ?? "");

  const step1Valid = workTypes.length > 0;
  const step2Valid = scopeText.trim().length >= MIN_SCOPE_TEXT_LENGTH;

  const toggleWorkType = (workType: string) =>
    setWorkTypes((current) =>
      current.includes(workType) ? current.filter((entry) => entry !== workType) : [...current, workType],
    );

  /**
   * Best-effort progress save (DES-3 slice 2). The wizard advances
   * regardless of the outcome — a failed save must never block it.
   */
  async function saveProgress(nextStep: number) {
    const formData = new FormData();
    formData.set("currentStep", String(nextStep));
    for (const workType of workTypes) formData.append("workTypes", workType);
    formData.set("scopeText", scopeText);
    formData.set("laborRate", laborRate);
    formData.set("region", region);
    try {
      await saveOnboardingProgressAction(formData);
    } catch {
      // Best-effort: see above.
    }
  }

  const contextChips = [
    { label: "Work", value: workTypes.length > 0 ? workTypes.join(" + ") : "Not set", hint: "Selected" },
    { label: "Labor", value: `$${laborRate || "48"}/hr`, hint: "Baseline" },
    ...(region.trim().length > 0
      ? [{ label: "Region", value: region.trim(), hint: "Where you work" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Two things before your first estimate"
        description="First useful estimate before full setup. Tell Athena about a real job and it drafts the estimate — company details, pricing depth, payments, and team can wait."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex flex-col gap-6 lg:w-72 lg:shrink-0">
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Get started</p>
              <CardTitle className="text-base">Step {step} of 2</CardTitle>
              <CardDescription>{STEP_TITLES[step - 1]}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4">
                {STEP_TITLES.map((title, index) => {
                  const stepNumber = index + 1;
                  const done = stepNumber < step;
                  const current = stepNumber === step;
                  return (
                    <li key={title} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          done
                            ? "bg-primary text-primary-foreground"
                            : current
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {done ? "✓" : stepNumber}
                      </span>
                      <span className="min-w-0">
                        <span
                          aria-current={current ? "step" : undefined}
                          className={cn("block text-sm font-medium", current ? "text-foreground" : "text-muted-foreground")}
                        >
                          {title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {stepSummary(stepNumber, workTypes)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">After first value</p>
              <CardTitle className="text-base">Deferred setup</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {ONBOARDING_DEFERRED_SETUP.map((item) => (
                  <li key={item.title} className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">None of this blocks the first estimate.</p>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0 flex-1">
          <Card>
            <form action={formAction} className="flex flex-col gap-6">
              {workTypes.map((workType) => (
                <input key={workType} type="hidden" name="workTypes" value={workType} />
              ))}
              <input type="hidden" name="laborRate" value={laborRate} />
              <input type="hidden" name="region" value={region} />

              {step === 1 ? (
                <div className="flex flex-col gap-6 p-6">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">What work do you do?</h2>
                    <p className="text-sm text-muted-foreground">
                      Pick the trades your company takes on. This sets the job type for your first estimate.
                    </p>
                  </div>
                  <fieldset>
                    <legend className="sr-only">Trade types</legend>
                    <div className="flex flex-wrap gap-2">
                      {ONBOARDING_WORK_TYPES.map((workType) => {
                        const selected = workTypes.includes(workType);
                        return (
                          <Button
                            key={workType}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            aria-pressed={selected}
                            onClick={() => toggleWorkType(workType)}
                          >
                            {workType}
                          </Button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="laborRateField">Your labor rate</Label>
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="laborRateField"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={500}
                        value={laborRate}
                        onChange={(event) => setLaborRate(event.target.value)}
                        className="w-28"
                      />
                      <span className="text-sm text-muted-foreground">per hour</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your baseline crew rate, starting at $48. It carries into your first estimate — you can change it per line later.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="regionField">Region (optional)</Label>
                    <Input
                      id="regionField"
                      type="text"
                      maxLength={120}
                      placeholder="Terre Haute, IN"
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Where you usually work. Used for local pricing context when it is available.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {step1Valid ? `${workTypes.length} selected` : "Choose at least one type of work."}
                    </p>
                    <Button
                      type="button"
                      size="lg"
                      disabled={!step1Valid}
                      onClick={async () => {
                        await saveProgress(2);
                        setStep(2);
                      }}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="flex flex-col gap-6 p-6">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Step 2 of 2
                    </p>
                    <h2 className="text-xl font-semibold tracking-tight">Give Athena a job you&apos;ve actually quoted</h2>
                  </div>

                  <div className="flex flex-wrap gap-2" aria-label="Known context">
                    {contextChips.map((chip) => (
                      <span
                        key={chip.label}
                        className="inline-flex flex-col rounded-lg border border-border bg-muted/40 px-3 py-2"
                      >
                        <span className="text-xs font-semibold text-muted-foreground uppercase">{chip.label}</span>
                        <span className="text-sm font-medium text-foreground">{chip.value}</span>
                        <span className="text-xs text-muted-foreground">{chip.hint}</span>
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="scopeText">What did the customer want done?</Label>
                    <Textarea
                      id="scopeText"
                      name="scopeText"
                      rows={5}
                      placeholder="Describe the job in 2–3 rough sentences — for example, what the customer asked for, what is worn or broken, and when they want it done."
                      value={scopeText}
                      onChange={(event) => setScopeText(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      You don&apos;t need measurements, products, or line items yet.
                    </p>
                    <div className="flex flex-wrap gap-2" aria-label="Example jobs">
                      {ONBOARDING_EXAMPLE_SCOPES.map((example) => (
                        <Button
                          key={example.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScopeText(example.scope)}
                        >
                          {example.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      What TradeOS does next
                    </p>
                    <ol className="grid gap-3 sm:grid-cols-2">
                      {ONBOARDING_NEXT_STEPS.map((nextStep, index) => (
                        <li key={nextStep.title} className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold"
                          >
                            {index + 1}
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{nextStep.title}</span>
                            <span className="block text-xs text-muted-foreground">{nextStep.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {state?.error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {state.error}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await saveProgress(1);
                        setStep(1);
                      }}
                    >
                      Back
                    </Button>
                    <Button type="submit" size="lg" disabled={isPending || !step2Valid}>
                      {isPending ? "Building your first estimate…" : "Build My First Estimate"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          </Card>

          <form action={skipFirstEstimateOnboarding} className="mt-4 flex justify-end">
            <Button type="submit" variant="link">
              Skip for now — go to Today
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
