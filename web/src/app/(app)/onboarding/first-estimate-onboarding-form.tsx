"use client";

import { useActionState, useState } from "react";
import { completeFirstEstimateOnboarding, skipFirstEstimateOnboarding } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import {
  DEFAULT_LABOR_RATE,
  MAX_LABOR_RATE,
  MAX_REGION_LENGTH,
  MIN_LABOR_RATE,
  MIN_SCOPE_TEXT_LENGTH,
  ONBOARDING_DEFERRED_SETUP,
  ONBOARDING_EXAMPLE_SCOPES,
  ONBOARDING_NEXT_STEPS,
  ONBOARDING_WORK_TYPES,
  formatLaborRate,
  isValidLaborRate,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const STEP_TITLES = ["Your work", "Your labor", "Build a real estimate"] as const;

function stepSummary(step: number, workTypes: string[], laborRate: string, region: string): string {
  if (step === 1) return workTypes.length > 0 ? workTypes.join(" · ") : "Pick the trades you do";
  if (step === 2) {
    const rate = Number(laborRate);
    const labor = isValidLaborRate(rate) ? formatLaborRate(rate) : "Set a baseline";
    return region.trim() ? `${labor} · ${region.trim()}` : `${labor} baseline`;
  }
  return "Give Athena a recent job";
}

export function FirstEstimateOnboardingForm() {
  const [state, formAction, isPending] = useActionState(completeFirstEstimateOnboarding, undefined);
  const [step, setStep] = useState(1);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [laborRate, setLaborRate] = useState(String(DEFAULT_LABOR_RATE));
  const [region, setRegion] = useState("");
  const [scopeText, setScopeText] = useState("");

  const laborRateNumber = Number(laborRate);
  const step1Valid = workTypes.length > 0;
  const step2Valid = laborRate.trim() !== "" && isValidLaborRate(laborRateNumber);
  const step3Valid = scopeText.trim().length >= MIN_SCOPE_TEXT_LENGTH;

  const toggleWorkType = (workType: string) =>
    setWorkTypes((current) =>
      current.includes(workType) ? current.filter((entry) => entry !== workType) : [...current, workType],
    );

  const contextChips = [
    { label: "Work", value: workTypes.length > 0 ? workTypes.join(" + ") : "Not set", hint: "Selected" },
    {
      label: "Labor",
      value: isValidLaborRate(laborRateNumber) ? formatLaborRate(laborRateNumber) : "Not set",
      hint: "Baseline",
    },
    { label: "Region", value: region.trim() || "Not set", hint: "Local pricing context" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Three things before your first estimate"
        description="First useful estimate before full setup. Tell Athena about a real job and it drafts the estimate — company details, pricing depth, payments, and team can wait."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex flex-col gap-6 lg:w-72 lg:shrink-0">
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Get started</p>
              <CardTitle className="text-base">Step {step} of 3</CardTitle>
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
                          {stepSummary(stepNumber, workTypes, laborRate, region)}
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {step1Valid ? `${workTypes.length} selected` : "Choose at least one type of work."}
                    </p>
                    <Button type="button" size="lg" disabled={!step1Valid} onClick={() => setStep(2)}>
                      Continue
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="flex flex-col gap-6 p-6">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">What is your labor baseline?</h2>
                    <p className="text-sm text-muted-foreground">
                      The hourly rate Athena uses as context when it checks labor against the Costbook.
                    </p>
                  </div>
                  <div className="flex max-w-sm flex-col gap-2">
                    <Label htmlFor="laborRate">Labor rate ($ / hour)</Label>
                    <Input
                      id="laborRate"
                      inputMode="decimal"
                      type="number"
                      min={MIN_LABOR_RATE}
                      max={MAX_LABOR_RATE}
                      step="1"
                      value={laborRate}
                      onChange={(event) => setLaborRate(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Most crews start around ${DEFAULT_LABOR_RATE} / hour. You can tune pricing defaults after the
                      first estimate.
                    </p>
                  </div>
                  <div className="flex max-w-sm flex-col gap-2">
                    <Label htmlFor="region">Region (optional)</Label>
                    <Input
                      id="region"
                      type="text"
                      maxLength={MAX_REGION_LENGTH}
                      placeholder="City, ST"
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Local pricing context for the draft.</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your labor baseline and region are context for this first estimate. Saving them as organization
                    defaults comes after the first draft.
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button type="button" size="lg" disabled={!step2Valid} onClick={() => setStep(3)}>
                      Continue
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="flex flex-col gap-6 p-6">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Step 3 of 3
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
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button type="submit" size="lg" disabled={isPending || !step3Valid}>
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
