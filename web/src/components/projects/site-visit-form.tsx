"use client";

import { useActionState } from "react";
import { Camera, ChevronDown, ClipboardPenLine, Ruler } from "lucide-react";
import { createSiteVisitAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SiteVisitForm({ projectId, jobId = null }: { projectId: string; jobId?: string | null }) {
  const [state, formAction, isPending] = useActionState(createSiteVisitAction, undefined);

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardPenLine className="size-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>Site Visit Capture</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture what changes the estimate first. TradeOS runs the existing intake analysis after you save the visit.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="projectId" value={projectId} />
          {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}

          <section className="grid gap-4" aria-labelledby="site-visit-quick-capture">
            <div>
              <p id="site-visit-quick-capture" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Quick capture
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Photos, measurements, and field notes stay attached to this Project.</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="photos" className="font-medium">Photos</Label>
              </div>
              <Input id="photos" name="photos" type="file" accept="image/*" capture="environment" multiple className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                Add jobsite conditions, access, materials, and anything the estimator should see. Each image must fit the existing upload limits.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
              <div className="flex items-center gap-2">
                <Ruler className="size-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">Measurements</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="squareFeet">Square feet</Label>
                  <Input id="squareFeet" name="squareFeet" inputMode="decimal" placeholder="2200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="linearFeet">Linear feet</Label>
                  <Input id="linearFeet" name="linearFeet" inputMode="decimal" placeholder="180" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fixtureCount">Fixture count</Label>
                  <Input id="fixtureCount" name="fixtureCount" inputMode="numeric" placeholder="6" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Field notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={6}
                placeholder="Existing conditions, customer requests, hidden risks, access constraints, finish intent, and anything that changes scope or price."
              />
            </div>
          </section>

          <details className="rounded-xl border border-border/70 bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground">
              More visit details
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            </summary>
            <div className="grid gap-5 border-t border-border/70 p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="arrivalAt">Arrival</Label>
                  <Input id="arrivalAt" name="arrivalAt" type="datetime-local" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="departureAt">Departure</Label>
                  <Input id="departureAt" name="departureAt" type="datetime-local" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gps">GPS coordinates</Label>
                  <Input id="gps" name="gps" placeholder="39.7684, -86.1581" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="transcript">Transcript or dictated notes</Label>
                <Textarea
                  id="transcript"
                  name="transcript"
                  rows={4}
                  placeholder="Paste dictated notes or a voice transcript captured during the visit."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="customerNotes">Customer notes</Label>
                  <Textarea id="customerNotes" name="customerNotes" rows={4} placeholder="Preferences, access windows, approvals, and homeowner concerns." />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="materialsNeeded">Materials needed</Label>
                  <Textarea id="materialsNeeded" name="materialsNeeded" rows={4} placeholder={"Dumpster\nMatching fascia\nPrimer"} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="safetyNotes">Safety notes</Label>
                  <Textarea id="safetyNotes" name="safetyNotes" rows={4} placeholder={"Power line at rear elevation\nSteep rear access"} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="punchList">Things to verify</Label>
                  <Textarea id="punchList" name="punchList" rows={4} placeholder={"Confirm wall structure\nVerify cabinet count"} />
                </div>
              </div>
            </div>
          </details>

          {state?.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{state.error}</p> : null}

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 border-t border-border/70 bg-card/95 px-1 pt-4 backdrop-blur md:static md:z-auto md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none">
            <Button type="submit" disabled={isPending} className="min-h-11 w-full md:w-auto">
              {isPending ? "Saving visit…" : "Finish Visit"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Finish Visit creates the Site Visit record{jobId ? ", keeps it linked to this scheduled Job," : ","} saves valid photo uploads, and refreshes the current AI follow-up/missing-information analysis.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
