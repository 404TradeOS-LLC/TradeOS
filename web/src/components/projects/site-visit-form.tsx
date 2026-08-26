"use client";

import { useActionState } from "react";
import { createSiteVisitAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SiteVisitForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(createSiteVisitAction, undefined);

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Site Visit Intake</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="grid gap-5 md:grid-cols-3">
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

          <div className="grid gap-5 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="squareFeet">Square feet</Label>
              <Input id="squareFeet" name="squareFeet" inputMode="decimal" placeholder="2200" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="linearFeet">Linear feet</Label>
              <Input id="linearFeet" name="linearFeet" inputMode="decimal" placeholder="180" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fixtureCount">Fixture count</Label>
              <Input id="fixtureCount" name="fixtureCount" inputMode="numeric" placeholder="6" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Site visit notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={7}
              placeholder="Visible conditions, customer requests, access issues, materials to match, hidden risks, and anything a PM should remember."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="transcript">Transcript or dictated notes</Label>
            <Textarea
              id="transcript"
              name="transcript"
              rows={5}
              placeholder="Paste dictated notes or a voice transcript if the field team captured one during the visit."
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerNotes">Customer notes</Label>
              <Textarea id="customerNotes" name="customerNotes" rows={4} placeholder="Preferences, approvals needed, access windows, and homeowner concerns." />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="materialsNeeded">Materials needed</Label>
              <Textarea id="materialsNeeded" name="materialsNeeded" rows={4} placeholder={"Dumpster\nIce and water shield\nMatching fascia"} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="safetyNotes">Safety notes</Label>
              <Textarea id="safetyNotes" name="safetyNotes" rows={4} placeholder={"Power line at rear elevation\nSteep rear access"} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="punchList">Punch list</Label>
              <Textarea id="punchList" name="punchList" rows={4} placeholder={"Confirm skylight measurements\nVerify gutter color"} />
            </div>
          </div>

          <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Project photos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload up to a few jobsite photos now so they stay attached to the project and can support the proposal draft.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="photos">Jobsite photos</Label>
              <Input id="photos" name="photos" type="file" accept="image/*" multiple />
              <p className="text-sm text-muted-foreground">For the smoothest upload experience, keep each photo lightweight and focused on conditions, access, and materials.</p>
            </div>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={isPending} className="w-full md:w-auto">
            {isPending ? "Saving intake…" : "Save intake and generate AI questions"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
