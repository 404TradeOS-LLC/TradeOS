"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/clientApi";
import { PageHeader } from "@/components/shared/page-header";
import { ContextualAthenaPanel } from "@/components/estimate-assist/contextual-athena-panel";
import { assessCostItemMapping, type StarterCatalogComponent, type StarterCatalogTemplate } from "@/components/costbook/assembly-catalog-model";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Textarea } from "@/components/ui/textarea";
import type { Estimate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { groupSavedDirectCosts } from "@/lib/estimate-direct-costs";
import { canAddReviewedEstimateCatalogItem } from "@/lib/estimate-catalog-review";

interface LineItem {
  id: string;
  costItemId: string | null;
  assemblyId: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
  section: string;
  costType: "labor" | "material" | "equipment" | "disposal" | "subcontractor" | "other";
  taxable: boolean;
}

interface EstimateDetail extends Estimate {
  lineItems: LineItem[];
}

interface PickerResult {
  id: string;
  name: string;
  code: string;
  unitOfMeasure: string;
  kind: "costItem" | "assembly" | "starterAssembly";
  description?: string | null;
  starterTemplate?: StarterCatalogTemplate;
}

interface AssemblyPreviewData {
  unitCost: number;
  componentCount: number;
  items: Array<{
    id: string;
    componentName: string;
    componentCode: string;
    componentUnitOfMeasure: string;
    quantityPerUnit: number;
    componentType: "cost_item" | "assembly";
  }>;
  total: number;
}

export function EstimateBuilder({ projectId, projectName, estimateId, simpleScope }: { projectId: string; projectName: string; estimateId: string; simpleScope?: string | null }) {
  const queryClient = useQueryClient();
  const estimateKey = ["estimate", estimateId];
  const [activeStage, setActiveStage] = useState<EstimateStage>("scope");
  const [scopeDraft, setScopeDraft] = useState(simpleScope ?? "");
  const [persistedScope, setPersistedScope] = useState(simpleScope ?? "");

  const saveScope = useMutation({
    mutationFn: (scope: string) =>
      clientFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ simpleScope: scope }),
      }),
    onSuccess: (_data, savedScope) => setPersistedScope(savedScope),
  });

  const { data: estimate, isLoading, isError, error } = useQuery({
    queryKey: estimateKey,
    queryFn: () => clientFetch<EstimateDetail>(`/estimates/${estimateId}`),
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: estimateKey });

  const removeLineItem = useMutation({
    mutationFn: (lineItemId: string) => clientFetch(`/estimates/${estimateId}/line-items/${lineItemId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const finalize = useMutation({
    mutationFn: () => clientFetch(`/estimates/${estimateId}/finalize`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const runningTotals = useMemo(() => {
    if (!estimate) return null;
    const subtotalCost = estimate.subtotalCost;
    const costAfterOverhead = estimate.costAfterOverhead ?? subtotalCost * (1 + estimate.overheadPct / 100);
    const preTaxTotalPrice = estimate.preTaxTotalPrice ?? estimate.totalPrice - (estimate.taxAmount ?? 0);
    const totalPrice = estimate.totalPrice;
    const grossProfit = preTaxTotalPrice - costAfterOverhead;
    const markupPct = costAfterOverhead > 0 ? (grossProfit / costAfterOverhead) * 100 : 0;
    const marginPct = preTaxTotalPrice > 0 ? (grossProfit / preTaxTotalPrice) * 100 : 0;

    return {
      subtotalCost,
      costAfterOverhead,
      preTaxTotalPrice,
      totalPrice,
      taxAmount: estimate.taxAmount ?? 0,
      grossProfit,
      markupPct,
      marginPct,
      lineItemCount: estimate.lineItems.length,
    };
  }, [estimate]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading estimateâ€¦</p>;
  if (isError) return <p className="text-sm text-destructive">Unable to load this estimate. {error instanceof Error ? error.message : "Check your session and try again."}</p>;
  if (!estimate || !runningTotals) return <p className="text-sm text-muted-foreground">Estimate not found.</p>;

  const isDraft = estimate.status === "draft";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Estimate v${estimate.version}`}
        description="Shape the scope, price the work, and send a clear proposal from one focused workspace."
        breadcrumbs={[
          { label: projectName, href: `/projects/${projectId}` },
          { label: `Estimate v${estimate.version}` },
        ]}
        action={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link href={`/projects/${projectId}/estimates/compare`} className={buttonVariants({ variant: "outline" })}>
              Compare versions
            </Link>
            <Link href={`/projects/${projectId}/estimates/${estimateId}/assist`} className={buttonVariants({ variant: "outline" })}>
              Athena review
            </Link>
            {isDraft ? (
              <span className={buttonVariants({ variant: "outline" })} aria-disabled="true">
                Finalize to create proposal
              </span>
            ) : (
              <Link href={`/projects/${projectId}/proposals/new?estimateId=${estimateId}`} className={buttonVariants({ variant: "outline" })}>
                Create proposal
              </Link>
            )}
            <StatusBadge status={estimate.status} />
          </div>
        }
      />

      <div className="hidden grid-cols-2 gap-x-5 gap-y-3 border-y border-border/70 bg-muted/20 px-3 py-3 sm:grid-cols-4 sm:px-4 lg:grid" aria-label="Estimate summary">
        <SummaryValue label="Job cost" value={formatCurrency(runningTotals.subtotalCost)} />
        <SummaryValue label="Sell price" value={formatCurrency(runningTotals.preTaxTotalPrice)} />
        <SummaryValue label="Gross profit" value={formatCurrency(runningTotals.grossProfit)} tone={runningTotals.grossProfit >= 0 ? "positive" : "negative"} />
        <SummaryValue label="Margin" value={formatPercent(runningTotals.marginPct)} tone={runningTotals.marginPct >= 0 ? "positive" : "negative"} />
      </div>

      {removeLineItem.isError ? (
        <FeedbackState
          kind="mutation-failure"
          title="Item removal was not confirmed"
          description="Refresh the estimate to check whether the item was removed before trying again. Your other saved items remain available."
          reference={removeLineItem.error instanceof Error ? removeLineItem.error.message : undefined}
          action={<Button type="button" variant="outline" onClick={() => void invalidate()}>Refresh estimate</Button>}
        />
      ) : null}

      <EstimateStageFlow
        projectId={projectId}
        projectName={projectName}
        simpleScope={scopeDraft}
        onScopeChange={(value) => {
          saveScope.reset();
          setScopeDraft(value);
        }}
        onSaveScope={async () => {
          try {
            await saveScope.mutateAsync(scopeDraft.trim());
            return true;
          } catch {
            return false;
          }
        }}
        scopeDirty={scopeDraft.trim() !== persistedScope.trim()}
        scopeSavePending={saveScope.isPending}
        scopeSaveSuccess={saveScope.isSuccess}
        scopeSaveError={saveScope.isError ? (saveScope.error instanceof Error ? saveScope.error.message : "Unable to save scope.") : null}
        estimate={estimate}
        runningTotals={runningTotals}
        estimateId={estimateId}
        isDraft={isDraft}
        activeStage={activeStage}
        onStageChange={setActiveStage}
        onUpdated={invalidate}
        onRemoveLineItem={(lineItemId) => removeLineItem.mutate(lineItemId)}
        removeLineItemPending={removeLineItem.isPending}
        onFinalize={() => { if (!saveScope.isPending && scopeDraft.trim() === persistedScope.trim()) finalize.mutate(); }}
        finalizePending={finalize.isPending || saveScope.isPending}
        finalizeError={finalize.isError ? (finalize.error instanceof Error ? finalize.error.message : "Unable to finalize estimate. Review the items and trm«ëŒ+Š×ž®º+º$zzb¥ç’v–ââ"’¢çVÆÇÐ¢óà¢ÂöF—cà¢“°§Ð ¢ò¢¢öæR66÷R÷væW"f÷"FW6·F÷æBÖö&–ÆS²&÷F‚6†&RF†R6ÖR&VçBG&gB÷6fR7FFRâ¢ð¦gVæ7F–öâW7F–ÖFU66÷TVF—F÷"‡²fÇVRÂöä6†ævRÂöå6fRÂ—4G&gBÂVæF–ærÂ6fVBÂW'&÷"Ó¢°¢fÇVS¢7G&–æs°¢öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C°¢öå6fS¢‚’Óâ&öÖ—6SÆ&ööÆVãã°¢—4G&gC¢&ööÆVã°¢VæF–æs¢&ööÆVã°¢6fVC¢&ööÆVã°¢W'&÷#¢7G&–ærÂçVÆÃ°§Ò’°¢6öç7B–çWD–BÒW6T–B‚“°¢6öç7B†VÇ–BÒG¶–çWD–GÒÖ†VÇ°¢6öç7BW'&÷$–BÒG¶–çWD–GÒÖW'&÷&°¢&WGW&â€¢Ç6V7F–öâ6Æ74æÖSÒ'76R×’Ó2&÷&FW"Ö"&÷&FW"Ö&÷&FW"ós"ÓB"&–ÖÆ&VÃÒ$W7F–ÖFR66÷RVF—F÷""&–Ö'W7“×·VæF–æwÓà¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâvÓ2#à¢ÄÆ&VÂ‡FÖÄf÷#×¶–çWD–GÓäFW67&–&RF†Rv÷&²–â–÷W"÷vâv÷&G3ÂôÆ&VÃà¢·6fVBbbVæF–æròÇ7â&öÆSÒ'7FGW2"6Æ74æÖSÒ'FW‡B×‡2föçBÖÖVF—VÒFW‡B×7V66W72#å6fVCÂ÷7ãâ¢çVÆÇÐ¢ÂöF—cà¢Ç–C×¶†VÇ–GÒ6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖ×WFVBÖf÷&Vw&÷VæB#å6fRF†R&ö¦V7B66÷R†W&RÂF†Vâ&Wf–Wr—Bv—F‚F†Væâ7VvvW7F–öç2&RFFVBöæÇ’v—F‚–÷W"&÷fÂãÂ÷à¢ÅFW‡F&V¢–C×¶–çWD–GÐ¢fÇVS×·fÇVWÐ¢öä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—Ð¢&÷w3×³WÐ¢Ö„ÆVæwFƒ×³SÐ¢6Æ74æÖSÒ&Ö–âÖ‚Ó3"&W6—¦RÖæöæR ¢F—6&ÆVC×²—4G&gBÇÂVæF–æwÐ¢&–ÖÆ&VÃÒ$W7F–ÖFR66÷R ¢&–ÖFW67&–&VF'“×¶W'&÷"òG¶†VÇ–GÒG¶W'&÷$–GÖ¢†VÇ–GÐ¢Æ6V†öÆFW#Ò$FW67&–&Rv†B–÷^(	—&R'V–ÆF–ær÷"f—†–æ~(
b ¢óà¢Ä'WGFöâG—SÒ&'WGFöâ"f&–çCÒ&÷WFÆ–æR"öä6Æ–6³×²‚’Óâfö–Böå6fR‚—ÒF—6&ÆVC×²—4G&gBÇÂVæF–ærÇÂfÇVRçG&–Ò‚—Óà¢·VæF–ærò%6f–ær66÷^(
b"¢%6fR66÷R'Ð¢Âô'WGFöãà¢²—4G&gBòÇ6Æ74æÖSÒ'FW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#äf–æÆ—¦VBW7F–ÖFW2¶VWF†V—"&–6–ær6æ6†÷C²GWÆ–6FRF†RW7F–ÖFRFò&Wf—6R—BãÂ÷â¢çVÆÇÐ¢¶W'&÷"òÇ–C×¶W'&÷$–GÒ6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖFW7G'V7F—fR"&öÆSÒ&ÆW'B#ç¶W'&÷'Ò–÷W"66÷R—27F–ÆÂ–âF†RVF—F÷"âG'’6f–ærv–âãÂ÷â¢çVÆÇÐ¢Â÷6V7F–öãà¢“°§Ð §G—RW7F–ÖFU7FvRÒ'66÷R"Â&—FV×2"Â'&–6R"Â'&Wf–Wr#° ¦gVæ7F–öâW7F–ÖFU7FvTfÆ÷r‡°¢&ö¦V7D–BÀ¢&ö¦V7DæÖRÀ¢6–×ÆU66÷RÀ¢öå66÷T6†ævRÀ¢öå6fU66÷RÀ¢66÷TF—'G’À¢66÷U6fUVæF–ærÀ¢66÷U6fU7V66W72À¢66÷U6fTW'&÷"À¢W7F–ÖFRÀ¢'Vææ–æuF÷FÇ2À¢W7F–ÖFT–BÀ¢—4G&gBÀ¢7F—fU7FvRÀ¢öå7FvT6†ævRÀ¢öåWFFVBÀ¢öå&VÖ÷fTÆ–æT—FVÒÀ¢&VÖ÷fTÆ–æT—FVÕVæF–ærÀ¢öäf–æÆ—¦RÀ¢f–æÆ—¦UVæF–ærÀ¢f–æÆ—¦TW'&÷"À§Ó¢°¢&ö¦V7D–C¢7G&–æs°¢&ö¦V7DæÖS¢7G&–æs°¢6–×ÆU66÷S¢7G&–æs°¢öå66÷T6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C°¢öå6fU66÷S¢‚’Óâ&öÖ—6SÆ&ööÆVãã°¢66÷TF—'G“¢&ööÆVã°¢66÷U6fUVæF–æs¢&ööÆVã°¢66÷U6fU7V66W73¢&ööÆVã°¢66÷U6fTW'&÷#¢7G&–ærÂçVÆÃ°¢W7F–ÖFS¢W7F–ÖFTFWF–Ã°¢'Vææ–æuF÷FÇ3¢²F÷FÅ&–6S¢çVÖ&W#²Ö&v–å7C¢çVÖ&W#²Æ–æT—FVÔ6÷VçC¢çVÖ&W"Ó°¢W7F–ÖFT–C¢7G&–æs°¢—4G&gC¢&ööÆVã°¢7F—fU7FvS¢W7F–ÖFU7FvS°¢öå7FvT6†ævS¢‡7FvS¢W7F–ÖFU7FvR’Óâfö–C°¢öåWFFVC¢‚’Óâfö–C°¢öå&VÖ÷fTÆ–æT—FVÓ¢†Æ–æT—FVÔ–C¢7G&–ær’Óâfö–C°¢&VÖ÷fTÆ–æT—FVÕVæF–æs¢&ööÆVã°¢öäf–æÆ—¦S¢‚’Óâfö–C°¢f–æÆ—¦UVæF–æs¢&ööÆVã°¢f–æÆ—¦TW'&÷#¢7G&–ærÂçVÆÃ°§Ò’°¢6öç7B7FvW3¢'&“Ç²–C¢W7F–ÖFU7FvS²Æ&VÃ¢7G&–ærÓâÒ°¢²–C¢'66÷R"ÂÆ&VÃ¢%66÷R"ÒÀ¢²–C¢&—FV×2"ÂÆ&VÃ¢$—FV×2"ÒÀ¢²–C¢'&–6R"ÂÆ&VÃ¢%&–6R"ÒÀ¢²–C¢'&Wf–Wr"ÂÆ&VÃ¢%&Wf–Wr"ÒÀ¢Ó°¢6öç7B7FvT–æFW‚Ò7FvW2æf–æD–æFW‚‚‡7FvR’Óâ7FvRæ–BÓÓÒ7F—fU7FvR“°¢6öç7B7FvT†VF–æu&Vg2ÒW6U&VcÅ'F–ÃÅ&V6÷&CÄW7F–ÖFU7FvRÂ…DÔÄ†VF–ætVÆVÖVçBÂçVÆÃããâ‡·Ò“°¢6öç7Bfö7W4öå7FvT6†ævRÒW6U&Vb†fÇ6R“° ¢W6TVffV7B‚‚’Óâ°¢–b‚fö7W4öå7FvT6†ævRæ7W'&VçB’&WGW&ã°¢fö7W4öå7FvT6†ævRæ7W'&VçBÒfÇ6S°¢7FvT†VF–æu&Vg2æ7W'&VçE¶7F—fU7FvUÓòæfö7W2‚“°¢ÒÂ¶7F—fU7FvUÒ“° ¢6öç7BvõFõ7FvRÒ7–æ2‡7FvS¢W7F–ÖFU7FvR’Óâ°¢–b‡7FvRÓÓÒ7F—fU7FvRÇÂ66÷U6fUVæF–ær’&WGW&ã°¢–b†7F—fU7FvRÓÓÒ'66÷R"bb—4G&gBbb66÷TF—'G’’°¢6öç7B6fVBÒv—Böå6fU66÷R‚“°¢–b‚6fVB’&WGW&ã°¢Ð¢fö7W4öå7FvT6†ævRæ7W'&VçBÒG'VS°¢öå7FvT6†ævR‡7FvR“°¢Ó° ¢6öç7BGfæ6RÒ‚’Óâ°¢6öç7BæW‡BÒ7FvW5·7FvT–æFW‚²Ó°¢–b†æW‡B’fö–BvõFõ7FvR†æW‡Bæ–B“°¢Ó° ¢&WGW&â€¢Ç6V7F–öâ6Æ74æÖSÒ'76R×’ÓB"&–ÖÆ&VÃÒ$W7F–ÖFRv÷&¶fÆ÷r#à¢Ææb&–ÖÆ&VÃÒ$W7F–ÖFR7FvW2#à¢ÆöÂ6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2ÓB&÷&FW"Ö"&÷&FW"Ö&÷&FW"ósÆs¦Ö‚×rÓ'†ÂÆs¦vÓR#à¢·7FvW2æÖ‚‡7FvRÂ–æFW‚’Óâ€¢ÆÆ’¶W“×·7FvRæ–GÒ6Æ74æÖSÒ&Ö–â×rÓ#à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢&–Ö7W'&VçC×¶7F—fU7FvRÓÓÒ7FvRæ–Bò'7FW"¢VæFVf–æVGÐ¢öä6Æ–6³×²‚’Óâfö–BvõFõ7FvR‡7FvRæ–B—Ð¢F—6&ÆVC×·66÷U6fUVæF–ærbb7F—fU7FvRÓÓÒ'66÷R"bb7FvRæ–BÓÒ'66÷R'Ð¢6Æ74æÖS×¶6â€¢&Ö–âÖ‚ÓrÖgVÆÂ&÷&FW"Ö"Ó"‚ÓFW‡B×‡2föçB×6VÖ–&öÆBG&ç6—F–öâÖ6öÆ÷'2Æs§FW‡BÖÆVgBÆs§FW‡B×6Òfö7W2×f—6–&ÆS¦÷WFÆ–æRfö7W2×f—6–&ÆS¦÷WFÆ–æRÓ"fö7W2×f—6–&ÆS¦÷WFÆ–æRÖöfg6WBÓ"fö7W2×f—6–&ÆS¦÷WFÆ–æR×&–ær"À¢7F—fU7FvRÓÓÒ7FvRæ–Bò&&÷&FW"×&–Ö'’FW‡B×&–Ö'’"¢&&÷&FW"×G&ç7&VçBFW‡BÖ×WFVBÖf÷&Vw&÷VæB ¢—Ð¢à¢Ç7â6Æ74æÖSÒ&×"ÓFW‡BÕ³…ÒF'VÆ"ÖçV×2"&–Ö†–FFVãÒ'G'VR#ç¶–æFW‚²ÓÂ÷7ãà¢Ç7â6Æ74æÖSÒ'7"ÖöæÇ’#å7FW¶–æFW‚²Òöb·7FvW2æÆVæwF‡Ó¢Â÷7ãà¢·7FvRæÆ&VÇÐ¢Âö'WGFöãà¢ÂöÆ“à¢’—Ð¢ÂööÃà¢Âöæcà ¢ÆF—b6Æ74æÖSÒ&w&–B—FV×2×7F'BvÓbÆs¦w&–BÖ6öÇ2Õ¶Ö–æÖ‚ƒÃg"•öÖ–æÖ‚ƒ#ƒ‚ÃãC&g"•Ò#à¢ÆF—b6Æ74æÖSÒ&Ö–â×rÓ&rÖ6&B‚ÓB’Ób6Ó§‚Ób#à¢ÆF—b†–FFVã×¶7F—fU7FvRÓÒ'66÷R'Ò6Æ74æÖSÒ'76R×’ÓB"Ó#BÆs§"Ó#à¢Æƒ"&Vc×²†æöFR’Óâ²7FvT†VF–æu&Vg2æ7W'&VçBç66÷RÒæöFS²×ÒF$–æFWƒ×²ÓÒ6Æ74æÖSÒ&föçBÖ†VF–ærFW‡B×†ÂföçBÖÖVF—VÒfö7W2×f—6–&ÆS¦÷WFÆ–æRfö7W2×f—6–&ÆS¦÷WFÆ–æRÓ"fö7W2×f—6–&ÆS¦÷WFÆ–æRÖöfg6WBÓ"fö7W2×f—6–&ÆS¦÷WFÆ–æR×&–ær#å7F'Bv—F‚F†Rv÷&²ãÂöƒ#à¢ÄW7F–ÖFU66÷TVF—F÷ ¢fÇVS×·6–×ÆU66÷WÐ¢öä6†ævS×¶öå66÷T6†ævWÐ¢öå6fS×¶öå6fU66÷WÐ¢—4G&gC×¶—4G&gGÐ¢VæF–æs×·66÷U6fUVæF–æwÐ¢6fVC×·66÷U6fU7V66W72bb66÷TF—'G—Ð¢W'&÷#×·66÷U6fTW'&÷'Ð¢óà¢ÆF—b6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖ×WFVBÖf÷&Vw&÷VæB#à¢F†Væ7VvvW7F–öç2&R&Wf–WrÖf—'7Bâæ÷F†–ær—2FFVBWFöÖF–6ÆÇ“²÷VâF†Væ&Wf–Wrf÷"FVWW"66÷RæÇ—6—2à¢ÂöF—cà¢ÄW7F–ÖFU7FvT7F–öâÆ&VÃ×·66÷U6fUVæF–ærò%6f–ær66÷^(
b"¢$6öçF–çVRFò—FV×2'Òöä6Æ–6³×¶Gfæ6WÒF—6&ÆVC×·66÷U6fUVæF–æwÒóà¢ÂöF—cà ¢ÆF—b†–FFVã×¶7F—fU7FvRÓÒ&—FV×2'Ò6Æ74æÖSÒ'76R×’ÓB"Ó#BÆs§"Ó#à¢ÆF—cà¢Æƒ"&Vc×²†æöFR’Óâ²7FvT†VF–æu&Vg2æ7W'&VçBæ—FV×2ÒæöFS²×ÒF$–æFWƒ×²ÓÒ6Æ74æÖSÒ&föçBÖ†VF–ærFW‡B×†ÂföçBÖÖVF—VÒfö7W2×f—6–&ÆS¦÷WFÆ–æRfö7W2×f—6–&ÆS¦÷WFÆ–æRÓ"fö7W2×f—6–&ÆS¦÷WFÆ–æRÖöfg6WBÓ"fö7W2×f—6–&ÆS¦÷WFÆ–æR×&–ær#äW7F–ÖFR—FV×3Âöƒ#à¢Ç6Æ74æÖSÒ&×BÓFW‡B×6ÒFW‡BÖ×WFVBÖf÷&Vw&÷VæB#ç¶W7F–ÖFRæÆ–æT—FV×2æÆVæwF‡Ò6fVBÆ–æW2+r&Wf–Wr6÷W&6W2ÂVçF—F–W2æB6÷7G2&Vf÷&R&–6–ærãÂ÷à¢ÂöF—cà¢¶—4G&gBòÄÆ–æT—FVÕ–6¶W"W7F–ÖFT–C×¶W7F–ÖFT–GÒöäFFVC×¶öåWFFVGÒ7F—fS×¶7F—fU7FvRÓÓÒ&—FV×2'Òóâ¢çVÆÇÐ¢¶W7F–ÖFRæÆ–æT—FV×2æÆVæwF‚ÓÓÒò€¢Ç6Æ74æÖSÒ&&÷&FW"Ö"&÷&FW"Ö&÷&FW"ós’ÓBFW‡B×6ÒFW‡BÖ×WFVBÖf÷&Vw&÷VæB#äæòÆ–æR—FV×2–WBãÂ÷à¢’¢€¢ÆF—b6Æ74æÖSÒ'76R×’ÓB#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖ×WFVBÖf÷&Vw&÷VæB#å6fVB–çFW&æÂ6÷7G2â&Wf–Wr7W7FöÖW"&–6–ær–â&–6RãÂ÷à¢ÆF—b&–Ö†–FFVãÒ'G'VR"6Æ74æÖS×¶6â‚&†–FFVâv×‚ÓB&÷&FW"Ö"&÷&FW"Ö&÷&FW"ós"Ó"FW‡B×‡2föçB×6VÖ–&öÆBFW‡BÖ×WFVBÖf÷&Vw&÷VæBÆs¦w&–B"ÂW7F–ÖFT—FVÔ6öÇVÖç2—Óà¢Ç7ãä—FVÒò&–6–ær&6—3Â÷7ããÇ7ãåVçF—G“Â÷7ããÇ7â6Æ74æÖSÒ'FW‡B×&–v‡B#åVæ—B6÷7CÂ÷7ããÇ7â6Æ74æÖSÒ'FW‡B×&–v‡B#äÆ–æR6÷7CÂ÷7ãà¢ÂöF—cà¢ÇVÂ&–ÖÆ&VÃÒ%6fVBW7F–ÖFR—FV×2"6Æ74æÖSÒ'76R×’ÓB#à¢¶w&÷WÆ–æT—FV×2†W7F–ÖFRæÆ–æT—FV×2’æÖ‚…·6V7F–öâÂ6V7F–öä—FV×5Ò’Óâ€¢ÆÆ’¶W“×·6V7F–öçÒ6Æ74æÖSÒ'76R×’Ó"#à¢Æƒ26Æ74æÖSÒ'FW‡B×‡2föçB×6VÖ–&öÆBWW&66RG&6¶–ærÕ³ãfVÕÒFW‡BÖ×WFVBÖf÷&Vw&÷VæB#ç·6V7F–öçÓÂöƒ3à¢ÇVÂ6Æ74æÖSÒ&F—f–FR×’F—f–FRÖ&÷&FW"ós#à¢·6V7F–öä—FV×2æÖ‚†Æ–æT—FVÒ’Óâ€¢ÄVF—F&ÆTÆ–æT—FVÐ¢¶W“×¶Æ–æT—FVÒæ–GÐ¢W7F–ÖFT–C×¶W7F–ÖFT–GÐ¢Æ–æT—FVÓ×¶Æ–æT—FV×Ð¢—4G&gC×¶—4G&gGÐ¢öåWFFVC×¶öåWFFVGÐ¢öå&VÖ÷fS×²‚’Óâöå&VÖ÷fTÆ–æT—FVÒ†Æ–æT—FVÒæ–B—Ð¢&VÖ÷f–æs×·&VÖ÷fTÆ–æT—FVÕVæF–æwÐ¢Ú±î¸Â¸­yêë¢°k¢G§¦*^      />
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <EstimateStageAction label="Continue to price" onClick={advance} />
          </div>

          <div hidden={activeStage !== "price"} className="space-y-4 pb-24 lg:pb-0">
            <h2 ref={(node) => { stageHeadingRefs.current.price = node; }} tabIndex={-1} className="font-heading text-xl font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Price the work</h2>
            <p className="text-sm text-muted-foreground">Use Apply or Save overhead / tax to save pricing changes. Review uses the saved estimate total.</p>
            <EstimateDirectCostBreakdown lineItems={estimate.lineItems} />
            <PricingPanel
              estimateId={estimateId}
              estimate={estimate}
              hasTaxableLineItems={estimate.lineItems.some((lineItem) => lineItem.taxable)}
              pricingModeLabel={estimate.targetMarginPct != null ? "Target margin" : "Markup"}
              isDraft={isDraft}
              onUpdated={onUpdated}
            />
            <EstimateStageAction label="Continue to review" onClick={advance} />
          </div>

          <div hidden={activeStage !== "review"} className="space-y-5 pb-24 lg:pb-0">
            <div className="border-b border-border/70 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Internal estimate review</p>
                  <h2 ref={(node) => { stageHeadingRefs.current.review = node; }} tabIndex={-1} className="mt-2 text-xl font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{projectName}</h2>
                </div>
                <StatusBadge status={estimate.status} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{simpleScope?.trim() || "Estimate scope"}</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Internal line costs below are not a customer proposal. The customer-facing amount is the saved sell total.</p>
              {estimate.lineItems.map((lineItem) => (
                <div key={lineItem.id} className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 text-sm">
                  <span className="min-w-0">{lineItem.description} <span className="text-muted-foreground">Ã— {lineItem.quantity}</span></span>
                  <span className="shrink-0 font-mono font-semibold">{formatCurrency(lineItem.lineCost)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border py-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">Estimate total</span>
                <span className="text-2xl font-semibold tabular-nums text-primary">{formatCurrency(runningTotals.totalPrice)}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{formatPercent(runningTotals.marginPct)} gross margin Â· {runningTotals.lineItemCount} line items</p>
            </div>
            {isDraft ? (
              <>
                <p className="text-sm text-muted-foreground">Finalizing locks this reviewed estimate version. The next step is creating the customer proposal. Nothing is sent to the customer by finalizing.</p>
                {finalizeError ? <EstimateFinalizationError message={finalizeError} /> : null}
                <EstimateStageAction label={finalizePending ? "Finalizingâ€¦" : finalizeError ? "Retry finalization" : "Finalize estimate"} onClick={onFinalize} disabled={finalizePending || estimate.lineItems.length === 0} />
              </>
            ) : (
              <Link href={`/projects/${estimate.projectId}/proposals/new?estimateId=${estimateId}`} className={buttonVariants({ variant: "default" }) + " flex min-h-11 w-full items-center justify-center"}>
                Review proposal draft
              </Link>
            )}
          </div>
        </div>
        <aside
          aria-label="Estimate decision support"
          className={cn("dark min-w-0 space-y-5 bg-background p-6 text-foreground lg:sticky lg:top-20", activeStage !== "scope" && "hidden lg:block")}
        >
          <div className="space-y-3 border-b border-primary/40 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Athena / Estimate context</p>
            <p className="text-sm text-muted-foreground">Saved estimate total</p>
            <p className="font-mono text-3xl tabular-nums">{formatCurrency(runningTotals.totalPrice)}</p>
            <p className="text-xs text-muted-foreground">Saved pricing snapshot. Suggestions stay separate until you review and add them.</p>
          </div>
          <ContextualAthenaPanel
            estimateId={estimateId}
            projectId={projectId}
            scopeOfWork={simpleScope}
            isDraft={isDraft}
            headingId="estimate-contextual-athena-heading"
            onAdded={onUpdated}
          />
        </aside>
      </div>
    </section>
  );
}

/** Focus the visible recovery message only after an actual failed finalize write. */
function EstimateFinalizationError({ message }: { message: string }) {
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const notice = noticeRef.current;
    // Keep focus out of hidden stages and never imply the failed write succeeded.
    if (!notice || notice.getClientRects().length === 0) return;
    notice.focus({ preventScroll: true });
    notice.scrollIntoView({ block: "center", behavior: "instant" });
  }, [message]);

  return (
    <p
      ref={noticeRef}
      role="alert"
      tabIndex={-1}
      className="w-full scroll-mb-44 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      Finalization failed. {message} Your saved draft remains available. Retry when ready.
    </p>
  );
}

function EstimateDirectCostBreakdown({ lineItems }: { lineItems: LineItem[] }) {
  const amounts = groupSavedDirectCosts(lineItems);
  return (
    <section aria-label="Internal direct cost breakdown" className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Internal direct costs</h3>
        <p className="mt-1 text-xs text-muted-foreground">Saved line costs by type, excluding markup, overhead and tax. Not a customer proposal.</p>
      </div>
      {lineItems.length === 0 ? <p className="text-sm text-muted-foreground">Add priced items in Items to see the breakdown.</p> : (
        <dl className="space-y-2 text-sm">
          {amounts.map((item) => (
            <div key={item.type} className="flex items-center justify-between gap-3">
              <dt>{item.label}</dt>
              <dd className="font-mono tabular-nums">{item.amount === null ? "Unavailable" : formatCurrency(item.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function EstimateStageAction({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border/70 bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <Button type="button" className="min-h-11 w-full lg:w-auto" onClick={onClick} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}


function LineItemPicker({ estimateId, onAdded, active }: { estimateId: string; onAdded: () => void; active: boolean }) {
  const queryClient = useQueryClient();
  const catalogPanelId = useId();
  const customPanelId = useId();
  const customInputRef = useRef<HTMLInputElement>(null);
  const [entryMode, setEntryMode] = useState<"catalog" | "custom" | null>(null);
  const [catalogKind, setCatalogKind] = useState<"assemblies" | "costItems">("assemblies");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<PickerResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [section, setSection] = useState("Demolition");
  const [costType, setCostm«ëŒ+Š×ž®º+º$zzb¥åG—UÒÒW6U7FFSÄÆ–æT—FVÕ²&6÷7EG—R%ÒÂ"#â‚""“°¢6öç7B·F†&ÆRÂ6WEF†&ÆUÒÒW6U7FFR†fÇ6R“°¢6öç7B¶7W7FöÒÂ6WD7W7FöÕÒÒW6U7FFR‡²FW67&—F–öã¢""ÂVæ—DödÖV7W&S¢$T"ÂVæ—D6÷7C¢""ÂVçF—G“¢#"Â6V7F–öã¢%&V6öç7G'V7F–öâòf–æ—6‚"Â6÷7EG—S¢&Æ&÷""2Æ–æT—FVÕ²&6÷7EG—R%ÒÂF†&ÆS¢fÇ6RÒ“°¢6öç7B¶W'&÷"Â6WDW'&÷%ÒÒW6U7FFSÇ7G&–ærÂçVÆÃâ†çVÆÂ“° ¢W6TVffV7B‚‚’Óâ°¢6öç7BF–ÖV÷WBÒ6WEF–ÖV÷WB‚‚’Óâ6WDFV&÷Væ6VEVW'’‡VW'’’Â3“°¢&WGW&â‚’Óâ6ÆV%F–ÖV÷WB‡F–ÖV÷WB“°¢ÒÂ·VW'•Ò“° ¢6öç7B²FF¢6V&6„FFÂ—4fWF6†–æs¢6V&6…VæF–ærÂ—4W'&÷#¢6V&6„f–ÆVBÂW'&÷#¢6V&6„W'&÷"ÒÒW6UVW'’‡°¢VW'”¶W“¢²&—FVÒ×6V&6‚"Â6FÆöt¶–æBÂFV&÷Væ6VEVW'•ÒÀ¢VW'”fã¢7–æ2‚“¢&öÖ—6SÇ²—FV×3¢–6¶W%&W7VÇEµÓ²f–ÆVE6÷W&6W3¢7G&–æuµÒÓâÓâ°¢–b‚FV&÷Væ6VEVW'’’&WGW&â²—FV×3¢µÒÂf–ÆVE6÷W&6W3¢µÒÓ°¢6öç7B¶6÷7D—FV×5&W7VÇBÂ76VÖ&Æ–W5&W7VÇBÂ7F'FW$6FÆöu&W7VÇEÒÒv—B&öÖ—6RæÆÅ6WGFÆVB…°¢6FÆöt¶–æBÓÓÒ&6÷7D—FV×2"ò6Æ–VçDfWF6ƒÇ²–C¢7G&–æs²æÖS¢7G&–æs²6öFS¢7G&–æs²Væ—DödÖV7W&S¢7G&–ærÕµÓâ€¢ö6÷7BÖFF&6Rö6÷7BÖ—FV×2÷6V&6ƒ÷ÒG¶Væ6öFUU$”6ö×öæVçB†FV&÷Væ6VEVW'’—Ö ¢’¢&öÖ—6Rç&W6öÇfR…µÒ’À¢6FÆöt¶–æBÓÓÒ&76VÖ&Æ–W2"ò6Æ–VçDfWF6ƒÄ'&“Ç²–C¢7G&–æs²æÖS¢7G&–æs²6öFS¢7G&–æs²Væ—DödÖV7W&S¢7G&–æs²FW67&—F–öãó¢7G&–ærÂçVÆÂÓãâ€¢ö76VÖ&Æ–W2÷6V&6ƒ÷ÒG¶Væ6öFUU$”6ö×öæVçB†FV&÷Væ6VEVW'’—Ö ¢’¢&öÖ—6Rç&W6öÇfR…µÒ’À¢6FÆöt¶–æBÓÓÒ&76VÖ&Æ–W2"ò6Æ–VçDfWF6ƒÇ°¢—FV×3¢7F'FW$6FÆöuFV×ÆFUµÓ°¢Óâ‚"ö76VÖ&Æ–W2÷7F'FW"Ö6FÆör"’¢&öÖ—6Rç&W6öÇfR‡²—FV×3¢µÒÒ’À¢Ò“°¢6öç7B6÷7D—FV×2Ò6÷7D—FV×5&W7VÇBç7FGW2ÓÓÒ&gVÆf–ÆÆVB"ò6÷7D—FV×5&W7VÇBçfÇVR¢µÓ°¢6öç7B76VÖ&Æ–W2Ò76VÖ&Æ–W5&W7VÇBç7FGW2ÓÓÒ&gVÆf–ÆÆVB"ò76VÖ&Æ–W5&W7VÇBçfÇVR¢µÓ°¢6öç7Bæ÷&ÖÆ—¦VEVW'’ÒFV&÷Væ6VEVW'’çG&–Ò‚’çFôÆ÷vW$66R‚“°¢6öç7B–ç7FÆÆVD6öFW2ÒæWr6WB†76VÖ&Æ–W2æÖ‚†76VÖ&Ç’’Óâ76VÖ&Ç’æ6öFR’“°¢6öç7B7F'FW$76VÖ&Æ–W2Ò7F'FW$6FÆöu&W7VÇBç7FGW2ÓÓÒ&gVÆf–ÆÆVB ¢ò7F'FW$6FÆöu&W7VÇBçfÇVRæ—FV×0¢æf–ÇFW"‚‡FV×ÆFR’Óâ–ç7FÆÆVD6öFW2æ†2‡FV×ÆFRæ6öFR’¢æf–ÇFW"‚‡FV×ÆFR’Óà¢·FV×ÆFRææÖRÂFV×ÆFRæ6öFRÂFV×ÆFRçG&FRÂFV×ÆFRæFW67&—F–öåÐ¢ç6öÖR‚‡fÇVR’ÓâfÇVRçFôÆ÷vW$66R‚’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VEVW'’’¢¢ç6Æ–6RƒÂ"¢¢µÓ°¢6öç7B—FV×3¢–6¶W%&W7VÇEµÒÒ°¢ââæ76VÖ&Æ–W2æÖ‚†76VÖ&Ç’’Óâ‡²ââæ76VÖ&Ç’Â¶–æC¢&76VÖ&Ç’"26öç7BÒ’’À¢ââç7F'FW$76VÖ&Æ–W2æÖ‚‡FV×ÆFR’Óâ‡°¢–C¢FV×ÆFRæ–BÀ¢æÖS¢FV×ÆFRææÖRÀ¢6öFS¢FV×ÆFRæ6öFRÀ¢Væ—DödÖV7W&S¢FV×ÆFRçVæ—DödÖV7W&RÀ¢FW67&—F–öã¢FV×ÆFRæFW67&—F–öâÀ¢¶–æC¢'7F'FW$76VÖ&Ç’"26öç7BÀ¢7F'FW%FV×ÆFS¢FV×ÆFRÀ¢Ò’’À¢ââæ6÷7D—FV×2æÖ‚†6÷7D—FVÒ’Óâ‡²ââæ6÷7D—FVÒÂ¶–æC¢&6÷7D—FVÒ"26öç7BÒ’’À¢Ó°¢–b€¢—FV×2æÆVæwF‚ÓÓÒb`¢†6FÆöt¶–æBÓÓÒ&6÷7D—FV×2"ò6÷7D—FV×5&W7VÇBç7FGW2ÓÓÒ'&V¦V7FVB" ¢76VÖ&Æ–W5&W7VÇBç7FGW2ÓÓÒ'&V¦V7FVB"bb7F'FW$6FÆöu&W7VÇBç7FGW2ÓÓÒ'&V¦V7FVB"¢’°¢F‡&÷ræWrW'&÷"‚$6÷7F&öö²6V&6‚—2Væf–Æ&ÆRâ–÷R6â7F–ÆÂFB7W7FöÒÆ–æR—FVÒâ"“°¢Ð¢&WGW&â°¢—FV×2À¢f–ÆVE6÷W&6W3¢°¢6÷7D—FV×5&W7VÇBç7FGW2ÓÓÒ'&V¦V7FVB"ò&6÷7B—FV×2"¢""À¢76VÖ&Æ–W5&W7VÇBç7FGW2ÓÓÒ'&V¦V7FVB"ò&76VÖ&Æ–W2"¢""À¢7F'FW$6FÆöu&W7VÇBç7FGW2ÓÓÒ'&V¦V7FVB"ò'7F'FW"6FÆör"¢""À¢Òæf–ÇFW"„&ööÆVâ’À¢Ó°¢ÒÀ¢Væ&ÆVC¢VçG'”ÖöFRÓÓÒ&6FÆör"bbFV&÷Væ6VEVW'’æÆVæwF‚âÀ¢7FÆUF–ÖS¢R¢cóÀ¢Ò“° ¢6öç7B÷&FW&VE&W7VÇG2ÒW6TÖVÖò‚‚’Óâ°¢6öç7B—FV×2Ò‡6V&6„FFòæ—FV×2óòµÒ’æf–ÇFW"‚†—FVÒ’Óâ6FÆöt¶–æBÓÓÒ&6÷7D—FV×2"ò—FVÒæ¶–æBÓÓÒ&6÷7D—FVÒ"¢—FVÒæ¶–æBÓÒ&6÷7D—FVÒ"“°¢&WGW&â°¢ââæ—FV×2æf–ÇFW"‚‡&W7VÇB’Óâ&W7VÇBæ¶–æBÓÓÒ&76VÖ&Ç’"’À¢ââæ—FV×2æf–ÇFW"‚‡&W7VÇB’Óâ&W7VÇBæ¶–æBÓÓÒ'7F'FW$76VÖ&Ç’"’À¢ââæ—FV×2æf–ÇFW"‚‡&W7VÇB’Óâ&W7VÇBæ¶–æBÓÓÒ&6÷7D—FVÒ"’À¢Ó°¢ÒÂ·6V&6„FFÂ6FÆöt¶–æEÒ“° ¢6öç7B7F—fU&W7VÇD–æFW‚Ò÷&FW&VE&W7VÇG2æÆVæwF‚ÓÓÒò¢ÖF‚æÖ–â†7F—fT–æFW‚Â÷&FW&VE&W7VÇG2æÆVæwF‚Ò“°¢6öç7B7F—fU&W7VÇBÒ÷&FW&VE&W7VÇG5¶7F—fU&W7VÇD–æFW…ÒóòçVÆÃ°¢6öç7B6VÆV7FVD76VÖ&Ç”–BÒ6VÆV7FVCòæ¶–æBÓÓÒ&76VÖ&Ç’"ò6VÆV7FVBæ–B¢çVÆÃ°¢6öç7B6VÆV7FVD6÷7D—FVÔ–BÒ6VÆV7FVCòæ¶–æBÓÓÒ&6÷7D—FVÒ"ò6VÆV7FVBæ–B¢çVÆÃ°¢6öç7B²FF¢6÷7D—FVÕ&Wf–WrÂ—4ÆöF–æs¢6÷7D—FVÕ&Wf–WtÆöF–ærÂ—4fWF6†–æs¢6÷7D—FVÕ&Wf–WtfWF6†–ærÀ¢—4W'&÷#¢6÷7D—FVÕ&Wf–Wtf–ÆVBÂW'&÷#¢6÷7D—FVÕ&Wf–WtW'&÷"ÒÒW6UVW'’‡°¢VW'”¶W“¢²&6÷7BÖ—FVÒ×&Wf–Wr"Â6VÆV7FVD6÷7D—FVÔ–EÒÀ¢VW'”fã¢‚’Óâ°¢–b‚6VÆV7FVD6÷7D—FVÔ–B’F‡&÷ræWrW'&÷"‚%6VÆV7B6÷7F&öö²—FVÒf—'7Bâ"“°¢&WGW&â6Æ–VçDfWF6ƒÇ²F÷FÅVæ—D6÷7C¢çVÖ&W"Óâ†ö6÷7F&öö²ö6÷7BÖ—FV×2òG·6VÆV7FVD6÷7D—FVÔ–GÒ÷Væ—BÖ6÷7F“°¢ÒÀ¢Væ&ÆVC¢&ööÆVâ‡6VÆV7FVD6÷7D—FVÔ–B’Â7FÆUF–ÖS¢cóÀ¢Ò“° ¢6öç7B°¢FF¢76VÖ&Ç•&Wf–WrÀ¢—4ÆöF–æs¢76VÖ&Ç•&Wf–WtÆöF–ærÀ¢—4fWF6†–æs¢76VÖ&Ç•&Wf–WtfWF6†–ærÀ¢—4W'&÷#¢76VÖ&Ç•&Wf–Wtf–ÆVBÀ¢W'&÷#¢76VÖ&Ç•&Wf–WtW'&÷"À¢ÒÒW6UVW'’‡°¢VW'”¶W“¢²&76VÖ&Ç’×&Wf–Wr"Â6VÆV7FVD76VÖ&Ç”–EÒÀ¢VW'”fã¢7–æ2‚“¢&öÖ—6SÄ76VÖ&Ç•&Wf–WtFFâÓâ°¢–b‚6VÆV7FVD76VÖ&Ç”–B’F‡&÷ræWrW'&÷"‚%6VÆV7Bâ–ç7FÆÆVB76VÖ&Ç’f—'7Bâ"“°¢6öç7B¶6÷7BÂ6ö×öæVçG5ÒÒv—B&öÖ—6RæÆÂ…°¢6Æ–VçDfWF6ƒÇ²Væ—D6÷7C¢çVÖ&W#²6ö×öæVçD6÷VçC¢çVÖ&W"Óâ†ö76VÖ&Æ–W2òG·6VÆV7FVD76VÖ&Ç”–GÒ÷Væ—BÖ6÷7F’À¢6Æ–VçDfWF6ƒÇ°¢—FV×3¢76VÖ&Ç•&Wf–WtFF²&—FV×2%Ó°¢F÷FÃ¢çVÖ&W#°¢æW‡D7W'6÷#ó¢7G&–ærÂçVÆÃ°¢Óâ†ö76VÖ&Æ–W2òG·6VÆV7FVD76VÖ&Ç”–GÒö—FV×3öÆ–Ö—CÓbg6÷'C×6÷'D÷&FW"f÷&FW#Ö66’À¢Ò“°¢&WGW&â°¢Væ—D6÷7C¢6÷7BçVæ—D6÷7BÀ¢6ö×öæVçD6÷VçC¢6÷7Bæ6ö×öæVçD6÷VçBÀ¢—FV×3¢6ö×öæVçG2æ—FV×2À¢F÷FÃ¢6ö×öæVçG2çF÷FÂÀ¢Ó°¢ÒÀ¢Væ&ÆVC¢&ööÆVâ‡6VÆV7FVD76VÖ&Ç”–B’À¢7FÆUF–ÖS¢cóÀ¢Ò“° ¢òò&VÂ×F–ÖRfÆ–F—G’f÷"–æÆ–æRfVVF&6²ÒW'&÷'26†÷röæÇ’öæ6Rf–VÆ@¢òò†2fÇVR†æWfW"öâF†RVçF÷V6†VB#"FVfVÇB’Â&F†W"F†âöæÇ¢òò7W&f6–æröâ7V&Ö—Bà¢6öç7BVçF—G”–çfÆ–BÒVçF—G’ÓÒ""bb‚çVÖ&W"æ—4f–æ—FR„çVÖ&W"‡VçF—G’’’ÇÂçVÖ&W"‡VçF—G’’ÃÒ“°¢6öç7B7W7FöÕVçF—G”–çfÆ–BÒ7W7FöÒçVçF—G’ÓÒ""bb‚çVÖ&W"æ—4f–æ—FR„çVÖ&W"†7W7FöÒçVçF—G’’’ÇÂçVÖ&W"†7W7FöÒçVçF—G’’ÃÒ“°¢6öç7B7W7FöÕVæ—D6÷7DÖ—76–ærÒ7W7FöÒçVæ—D6÷7BçG&–Ò‚“°¢6öç7B7W7FöÕVæ—D6÷7D–çfÆ–BÒ7W7FöÒçVæ—D6÷7BÓÒ""bb‚çVÖ&W"æ—4f–æ—FR„çVÖ&W"†7W7FöÒçVæ—D6÷7B’’ÇÂçVÖ&W"†7W7FöÒçVæ—D6÷7B’Â“° ¢W6TVffV7B‚‚’Óâ°¢–b†VçG'”ÖöFRÓÓÒ&6FÆör"’6V&6„–çWE&Vbæ7W'&VçCòæfö7W2‚“°¢–b†VçG'”ÖöFRÓÓÒ&7W7FöÒ"’7W7FöÔ–çWE&Vbæ7W'&VçCòæfö7W2‚“°¢ÒÂ¶VçG'”ÖöFRÂ6FÆöt¶–æEÒ“° ¢W6TVffV7B‚‚’Óâ°¢–b‚7F—fR’&WGW&ã°¢6öç7Böä¶W”F÷vâÒ†WfVçC¢¶W–&ö&DWfVçB’Óâ°¢6öç7B—56V&6…6†÷'F7WBÒ†WfVçBæÖWF¶W’ÇÂWfVçBæ7G&Ä¶W’’bbWfVçBæ¶W’çFôÆ÷vW$66R‚’ÓÓÒ&²#°¢–b†—56V&6…6†÷'F7WB’°¢WfVçBç&WfVçDFVfVÇB‚“°¢6WDVçG'”ÖöFR‚&6FÆör"“°¢6V&6„–çWE&Vbæ7W'&VçCòæfö7W2‚“°¢6V&6„–çWE&Vbæ7W'&VçCòç6VÆV7B‚“°¢Ð¢Ó° ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Âöä¶W”F÷vâ“°¢&WGW&â‚’Óâv–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Âöä¶W”F÷vâ“°¢ÒÂ¶7F—fUÒ“° ¢6öç7B6öÖÖ—DÆ–æT—FVÒÒ†—FVÓó¢–6¶W%&W7VÇBÂçVÆÂ’Óâ°¢6öç7BF&vWBÒ—FVÒóò6VÆV7FVC°¢–b‚F&vWB’°¢6WDW'&÷"‚%–6²&W7VÇBg&öÒF†RÆ—7Bf—'7Bâ"“°¢&WGW&ã°¢Ð¢–b‡F&vWBæ¶–æBÓÓÒ'7F'FW$76VÖ&Ç’"’°¢6WDW'&÷"‚%6WGW&WV—&VBâÖF†—27F'FW"&V6—RFò–÷W"7F—fR6÷7F&öö²—FV×2&Vf÷&R—B6â&R&–6VB÷"FFVBâ"“°¢&WGW&ã°¢Ð¢6öç7BG’ÒçVÖ&W"‡VçF—G’“°¢–b‚çVÖ&W"æ—4f–æ—FR‡G’’ÇÂG’ÃÒ’°¢6WDW'&÷"‚%VçF—G’×W7B&R÷6—F—fRçVÖ&W""“°¢&WGW&ã°¢Ð¢–b‚6äFE&Wf–WvVDÆ–æR’°¢6WDW'&÷"‚%&Wf–WrF†R6VÆV7FVB—FVÒw27W'&VçB6÷7F&öö²6÷7B&Vf÷&RFF–ærâ"“°¢&WGW&ã°¢Ð¢FDÆ–æT—FVÒæ×WFFR‡²—FVÓ¢F&vWBÂVçF—G“¢G’Â6V7F–öâÂ6÷7EG—S¢6÷7EG—m«ëŒ+Š×ž®º+º$zzb¥å || undefined, taxable, sourceKey: `builder:${crypto.randomUUID()}` });
  };

  const addLineItem = useMutation({
    mutationFn: ({ item, quantity, section: itemSection, costType: itemCostType, taxable: itemTaxable, sourceKey }: { item: PickerResult; quantity: number; section: string; costType?: LineItem["costType"]; taxable: boolean; sourceKey: string }) => {
      if (item.kind === "starterAssembly") throw new Error("Starter assemblies must be mapped before they can be added.");
      return clientFetch(`/estimates/${estimateId}/line-items`, {
        method: "POST",
        body: JSON.stringify({
          [item.kind === "costItem" ? "costItemId" : "assemblyId"]: item.id,
          quantity,
          section: itemSection,
          ...(itemCostType ? { costType: itemCostType } : {}),
          taxable: itemTaxable,
          sourceKey,
        }),
      });
    },
    onSuccess: () => {
      setSelected(null);
      setQuery("");
      setQuantity("1");
      setSection("Demolition");
      setCostType("");
      setTaxable(false);
      setError(null);
      setActiveIndex(0);
      quantityInputRef.current?.blur();
      searchInputRef.current?.focus();
      onAdded();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to add line item"),
  });

  const previewUnitCost = selected?.kind === "costItem"
    ? costItemPreview?.totalUnitCost
    : selected?.kind === "assembly" ? assemblyPreview?.unitCost : undefined;
  const previewPending = selected?.kind === "costItem"
    ? costItemPreviewLoading || costItemPreviewFetching
    : selected?.kind === "assembly" ? assemblyPreviewLoading || assemblyPreviewFetching : true;
  const canAddReviewedLine = canAddReviewedEstimateCatalogItem({
    kind: selected?.kind ?? null, quantity, unitCost: previewUnitCost, previewPending, adding: addLineItem.isPending,
  });

  const customAdd = useMutation({
    mutationFn: (payload: { description: string; unitOfMeasure: string; quantity: number; unitCost: number; section: string; costType: LineItem["costType"]; taxable: boolean }) => clientFetch(`/estimates/${estimateId}/line-items`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setCustom({ description: "", unitOfMeasure: "EA", unitCost: "", quantity: "1", section: "Reconstruction / Finish", costType: "labor", taxable: false });
      setError(null);
      onAdded();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to add custom line item"),
  });

  const openCatalog = (kind: typeof catalogKind) => {
    if (kind === catalogKind && entryMode === "catalog") {
      setEntryMode(null);
      return;
    }
    if (kind !== catalogKind) {
      setSelected(null);
      setQuery("");
      setDebouncedQuery("");
      setActiveIndex(0);
    }
    setCatalogKind(kind);
    setEntryMode("catalog");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Add estimate items">
        <Button type="button" variant="outline" className="min-h-11" aria-expanded={entryMode === "catalog" && catalogKind === "assemblies"} aria-controls={catalogPanelId} onClick={() => openCatalog("assemblies")}>Add assembly</Button>
        <Button type="button" variant="outline" className="min-h-11" aria-expanded={entryMode === "catalog" && catalogKind === "costItems"} aria-controls={catalogPanelId} onClick={() => openCatalog("costItems")}>Costbook</Button>
        <Button type="button" variant="outline" className="min-h-11" aria-expanded={entryMode === "custom"} aria-controls={customPanelId} onClick={() => setEntryMode(entryMode === "custom" ? null : "custom")}>Custom item</Button>
      </div>

      <div id={catalogPanelId} hidden={entryMode !== "catalog"} className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3 sm:p-4">
        <Label htmlFor="item-search" className="text-sm font-medium">{catalogKind === "assemblies" ? "Search assemblies" : "Search Costbook items"}</Label>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_180px_auto] md:items-end">
          <div className="space-y-2">
            <Input
              ref={searchInputRef}
              id="item-search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={!selected && orderedResults.length > 0}
              aria-controls={!selected ? "item-search-results" : undefined}
              aria-activedescendant={!selected && activeResult ? `item-search-option-${activeResult.kind}-${activeResult.id}` : undefined}
              placeholder="Search assemblies or cost itemsâ€¦"
              value={selected ? selected.name : query}
              onChange={(e) => {
                setSelected(null);
                setQuery(e.target.value);
                setError(null);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (orderedResults.length === 0) return;
                  const nextIndex = Math.min(activeResultIndex + 1, orderedResults.length - 1);
                  setActiveIndex(nextIndex);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (orderedResults.length === 0) return;
                  const nextIndex = Math.max(activeResultIndex - 1, 0);
                  setActiveIndex(nextIndex);
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (selected) {
                    quantityInputRef.current?.focus();
                    return;
                  }
                  if (!activeResult) {
                    setError("Pick a result from the list first.");
                    return;
                  }
                  setSelected(activeResult);
                  setQuery(activeResult.name);
                  setError(null);
                  if (activeResult.kind !== "starterAssembly") quantityInputRef.current?.focus();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setSelected(null);
                  setQuery("");
                  setError(null);
                  setActiveIndex(0);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">Tip: press âŒ˜/Ctrl+K anywhere on the page to jump back here.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="costbook-section">Section</Label>
            <Input id="costbook-section" value={section} onChange={(e) => setSection(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-sm font-medium">
              Quantity{selected ? ` (${selected.unitOfMeasure})` : ""}
            </Label>
            <Input
              ref={quantityInputRef}
              id="quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              aria-invalid={quantityInvalid}
              aria-describedby={quantityInvalid ? "quantity-error" : undefined}
              onChange={(e) => setQuantity(e.target.value)}

            />
            {quantityInvalid ? (
              <p id="quantity-error" className="text-xs text-destructive">
                Quantity must be a positive number.
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={() => commitLineItem()}
            disabled={!canAddReviewedLine}
          >
            {addLineItem.isPending ? "Addingâ€¦" : selected?.kind === "starterAssembly" ? "Setup required" : "Add to estimate"}
          </Button>
        </div>

        <div className="grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <Label htmlFor="costbook-cost-type">Costbook cost type</Label>
            <select id="costbook-cost-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={costType} onChange={(e) => setCostType(e.target.value as LineItem["costType"] | "")}>
              <option value="">Auto-detect</option>
              {costTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} /> Costbook item is taxable</label>
          <p className="text-xs text-muted-foreground">These settings apply to the selected Costbook item.</p>
        </div>

        {!selected && orderedResults.length > 0 && (
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Search results</div>
            <div id="item-search-results" role="listbox" aria-label="Costbook search results" className="max-h-72 space-y-4 overflow-auto pr-1">
              <ResultGroup
                title="Assemblies"
                description="Reusable packages and templates"
                results={orderedResults.filter((result) => result.kind === "assembly")}
                baseIndex={0}
                activeIndex={activeResultIndex}
                onSelect={(result, index) => {
                  setSelected(result);
                  setActiveIndex(index);
                  setQuery(result.name);
                  setError(null);
                  quantityInputRef.current?.focus();
                }}
              />
              <ResultGroup
                title="Starter assemblies"
                description="TradeOS starter recipes Â· setup required before estimating"
                results={orderedResults.filter((result) => result.kind === "starterAssembly")}
                baseIndex={orderedResults.filter((result) => result.kind === "assembly").length}
                activeIndex={activeResultIndex}
                onSelect={(result, index) => {
                  setSelected(result);
                  setActiveIndex(index);
                  setQuery(result.name);
                  setError(null);
                }}
              />
              <ResultGroup
                title="Cost items"
                description="Individual labor or material items"
                results={orderedResults.filter((result) => result.kind === "costItem")}
                baseIndex={
                  orderedResults.filter((result) => result.kind === "assembly").length +
                  orderedResults.filter((result) => result.kind === "starterAssembly").length
                }
                activeIndex={activeResultIndex}
                onSelect={(result, index) => {
                  setSelected(result);
                  setActiveIndex(index);
                  setQuery(result.name);
                  setError(null);
                  quantityInputRef.current?.focus();
                }}
              />
            </div>
          </div>
        )}

        {!selected && searchPending ? <p role="status" className="text-sm text-muted-foreground">Searching {catalogKind === "assemblies" ? "assemblies" : "Costbook"}â€¦</p> : null}

        {!selected && debouncedQuery && !searchPending && orderedResults.length === 0 && !addLineItem.isPending && (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
            <p>{searchFailed ? searchError instanceof Error ? searchError.message : "Costbook search is unavailable." : "No matches yet. Try a broader assembly name or a cost item code."}</p>
            <p className="mt-2">Choose Custom item to add a line, or <Link href="/costbook/cost-items" className="font-medium text-foreground underline">add a Costbook item</Link> for reuse.</p>
          </div>
        )}

        {!selected && searchData?.failedSources?.length ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning" role="alert">
            Search unavailable for {searchData.failedSources.join(" and ")}. Add a custom line item or try again.
          </p>
        ) : null}

        {selected && (
          <div className="space-y-3 rounded-lg border border-border/70 bg-background px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selected.kind === "assembly" ? "default" : selected.kind === "starterAssembly" ? "outline" : "secondary"}>
                {selected.kind === "assembly" ? "Installed assembly" : selected.kind === "starterAssembly" ? "Starter assembly" : "Cost item"}
              </Badge>
              <span className="font-medium">{selected.name}</span>
              <span className="text-muted-foreground">
                {selected.code} Â· {selected.unitOfMeasure}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                  setError(null);
                  searchInputRef.current?.focus();
                }}
              >
                Clear
              </Button>
            </div>


            {selected.kind === "costItem" ? (
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current Costbook cost preview</p>
                {costItemPreviewLoading || costItemPreviewFetching ? (
                  <p className="text-sm text-muted-foreground">Resolving stored unit costâ€¦</p>
                ) : costItemPreviewFailed ? (
                  <p className="text-sm text-warning" role="alert">
                    Cost preview unavailable. {costItemPreviewError instanceof Error ? costItemPreviewError.message : "Try again or choose a custom item."}
                  </p>
                ) : costItemPreview && Number.isFinite(costItemPreview.totalUnitCost) && costItemPreview.totalUnitCost >= 0 ? (
                  <div className="text-sm">
                    <strong className="font-medium">{formatCurrency(costItemPreview.totalUnitCost)}</strong> / {selected.unitOfMeasure} stored cost
                    <p className="mt-1 text-muted-foreground">
                      {formatCurrency(costItemPreview.totalUnitCost * (Number(quantity) > 0 ? Number(quantity) : 0))} estimated direct job cost for {quantity || "0"} {selected.unitOfMeasure}.
                    </p>
                  </div>
                ) : <p className="text-sm text-warning">Cost preview is unavailable.</p>}
                <p className="text-xs text-muted-foreground">This is a stored Costbook cost, not a live supplier quote. Estimate Engine saves its own cost snapshot when you explicitly Add.</p>
              </div>
            ) : null}
            {selected.kind === "assembly" ? (
              <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Assembly preview</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Current Costbook recipe. Estimate Engine captures the pricing snapshot and assembly source when you explicitly add it.
                    </p>
                  </div>
                  {assemblyPreviewLoading ? <p className="text-sm text-muted-foreground">Resolving current assembly costâ€¦</p> : null}
                  {assemblyPreviewFailed ? (
                    <p className="text-sm text-warning" role="alert">
                      Current cost preview is unavailable. {assemblyPreviewError instanceof Error ? assemblyPreviewError.message : "Try again before relying on this price."}
                    </p>
                  ) : null}
                  {assemblyPreview ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span><strong className="font-medium">{formatCurrency(assemblyPreview.unitCost)}</strong> / {selected.unitOfMeasure} current cost</span>
                        <span className="text-muted-foreground">{assemblyPreview.componentCount} resolved component{assemblyPreview.componentCount === 1 ? "" : "s"}</span>
                      </div>
                      <div className="text-sm">
                        Estimated job cost for {Number(quantity) > 0 ? Number(quantity) : 0} {selected.unitOfMeasure}:{" "}
                        <strong className="font-medium">
                          {formatCurrency(assemblyPreview.unitCost * (Number(quantity) > 0 ? Number(quantity) : 0))}
                        </strong>
                      </div>
                      {assemblyPreview.items.length > 0 ? (
                        <div className="grid gap-1 text-xs text-muted-foreground">
                          {assemblyPreview.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between gap-3">
                              <span>{item.componentName} Â· {item.componentCode}</span>
                              <span className="shrink-0 font-mono">{item.quantityPerUnit} {item.componentUnitOfMeasure}</span>
                            </div>
                          ))}
                          {assemblyPreview.total > assemblyPreview.items.length ? (
                            <div>{assemblyPreview.total - assemblyPreview.items.length} more component{assemblyPreview.total - assemblyPreview.items.length === 1 ? "" : "s"} in the recipe</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Source: organization Costbook assembly with current resolved component costs, not a live supplier quote. Estimate Engine captures a new snapshot on Add.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quantity</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{quantity || "0"} {selected.unitOfMeasure}</p>
                </div>
              </div>
            ) : null}

            {selected.kind === "starterAssembly" && selected.starterTemplate ? (
              <StarterAssemblySetup
                key={selected.id}
                template={selected.starterTemplate}
                quantity={quantity}
                onInstalled={(assembly) => {
                  setSelected({ ...assembly, kind: "assembly" });
                  setQuery(assembly.name);
                  setError(null);
                  void queryClient.invalidateQueries({ queryKey: ["item-search"] });
                }}
              />
            ) : null}
          </div>
        )}
      </div>

      <div id={customPanelId} hidden={entryMode !== "custom"}>
        <div className="grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="sm:col-span-2 lg:col-span-2">
            <Label htmlFor="custom-description">Custom line item</Label>
            <Input ref={customInputRef} id="custom-description" placeholder="e.g. debris handling" value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="custom-quantity">Qty</Label>
            <Input
              id="custom-quantity"
              type="number"
              min="0"
              step="any"
              value={custom.quantity}
              aria-invalid={customQuantityInvalid}
              aria-describedby={customQuantityInvalid ? "custom-quantity-error" : undefined}
              onChange={(e) => setCustom({ ...custom, quantity: e.target.value })}
            />
            {customQuantityInvalid ? (
              <p id="custom-quantity-error" className="mt-1 text-xs text-destructive">
                Must be positive.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="custom-unit-cost">Unit cost</Label>
            <Input
              id="custom-unit-cost"
              type="number"
              min="0"
              step="0.01"
              value={custom.unitCost}
              aria-invalid={customUnitCostInvalid}
              required
              aria-describedby={customUnitCostInvalid ? "custom-unit-cost-error" : "custom-unit-cost-help"}
              onChange={(e) => setCustom({ ...custom, unitCost: e.target.value })}
            />
            <p id="custom-unit-cost-help" className="mt-1 text-xs text-muted-foreground">Enter a unit cost. Use 0 only when this item intentionally has no cost.</p>
            {customUnitCostInvalid ? (
              <p id="custom-unit-cost-error" className="mt-1 text-xs text-destructive">
                Can&apos;t be negative.
              </p>
            ) : null}
          </div>
          <Button type="button" variant="secondary" onClick={() => addCustomLineItem()} disabled={customAdd.isPending || customUnitCostMissing || customQuantityInvalid || customUnitCostInvalid}>
            {customAdd.isPending ? "Addingâ€¦" : "Add custom"}
          </Button>
          <div>
            <Label htmlFor="custom-unit">Unit</Label>
            <Input id="custom-unit" value={custom.unitOfMeasure} onChange={(e) => setCustom({ ...custom, unitOfMeasure: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="custom-section">Section</Label>
            <Input id="custom-section" value={custom.section} onChange={(e) => setCustom({ ...custom, section: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="custom-cost-type">Cost type</Label>
            <select id="custom-cost-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={custom.costType} onChange={(e) => setCustom({ ...custom, costType: e.target.value as LineItem["costType"] })}>
              {costTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={custom.taxable} onChange={(e) => setCustom({ ...custom, taxable: e.target.checked })} /> Taxable</label>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );

  function addCustomLineItem() {
    const qty = Number(custom.quantity);
    const unitCost = Number(custom.unitCost);
    if (!custom.description.trim() || !custom.unitOfMeasure.trim() || !custom.unitCost.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      setError("Custom lines need a description, unit, positive quantity, and non-negative unit cost.");
      return;
    }
    customAdd.mutate({ description: custom.description.trim(), unitOfMeasure: custom.unitOfMeasure.trim(), quantity: qty, unitCost, section: custom.section.trim() || "General", costType: custom.costType, taxable: custom.taxable });
  }

}

function StarterAssemblySetup({
  template,
  quantity,
  onInstalled,
}: {
  template: StarterCatalogTemplate;
  quantity: string;
  onInstalled: (assembly: { id: string; name: string; code: string; unitOfMeasure: string; description?: string | null }) => void;
}) {
  const [mappings, setMappings] = useState<Record<string, CostItemCatalogRecord>>({});
  const [error, setError] = useState<string | null>(null);
  const mappedIds = template.components.map((component) => mappings[component.key]?.id ?? "");
  const mappingComplete = mappedIds.every(Boolean);
  const duplicateMapping = mappingComplete && new Set(mappedIds).size !== mappedIds.length;
  const incompatibleComponent = template.components.find((component) => {
    const item = mappings[component.key];
    return item && !assessCostItemMapping(component, item).compatible;
  });

  const preview = useQuery({
    queryKey: ["starter-assembly-cost-preview", template.id, ...mappedIds],
    queryFn: async () => {
      const resolved = await Promise.all(template.components.map(async (component) => {
        const item = mappings[component.key];
        if (!item) throw new Error(`Map ${component.label} before previewing cost.`);
        const result = await clientFetch<{ totalUnitCost: number }>(`/costbook/cost-items/${item.id}/unit-cost`);
        return { component, item, unitCost: result.totalUnitCost };
      }));
      const unitCost = resolved.reduce((total, row) => total + row.unitCost * row.component.quantityPerUnit, 0);
      return { unitCost, resolved };
    },
    enabled: mappingComplete && !duplicateMapping && !incompatibleComponent,
    staleTime: 60_000,
  });

  const install = useMutation({
    mutationFn: async () => {
      if (!mappingComplete) throw new Error("Map every recipe slot before installing the assembly.");
      if (duplicateMapping) throw new Error("Use a different Costbook item for each recipe slot.");
      if (incompatibleComponent) throw new Error(`${incompatibleComponent.label} is mapped to an incompatible Costbook item.`);
      if (!previewReady) throw new Error("Review the mapped Costbook cost before installing.");
      return clientFetch<{ id: string; name: string; code: string; unitOfMeasure: string; description?: string | null }>(
        "/assemblies/starter-catalog/install",
        {
          method: "POST",
          body: JSON.stringify({
            templateId: template.id,
            componentMappings: template.components.map((component) => ({
              componentKey: component.key,
              costItemId: mappings[component.key].id,
            })),
          }),
        }
      );
    },
    onSuccess: (assembly) => {
      setError(null);
      onInstalled(assembly);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Starter assembly could not be installed."),
  });

  const previewReady = !preview.isLoading && !preview.isFetching && !preview.isError &&
    preview.data !== undefined && Number.isFinite(preview.data.unitCost) && preview.data.unitCost >= 0;
  const outputQuantity = Number(quantity) > 0 ? Number(quantity) : 0;

  return (
    <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <div>
        <p className="font-medium text-foreground">Setup required before this assembly can be priced or added.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Map each starter recipe slot to an active, compatible Costbook item. TradeOS will not invent those mappings or a price.
        </p>
      </div>

      <div className="grid gap-3">
        {template.components.map((component) => {
          const usedIds = new Set(Object.entries(mappings).filter(([key]) => key !== component.key).map(([, item]) => item.id));
          return (
            <StarterComponentMappingPicker
              key={component.key}
              component={component}
              value={mappings[component.key]}
              unavailableIds={usedIds}
              disabled={install.isPending}
              onSelect={(item) => {
                setMappings((current) => {
                  const next = { ...current };
                  if (item) next[component.key] = item;
                  else delete next[component.key];
                  return next;
                });
                setError(null);
              }}
            />
          );
        })}
      </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-background/75 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pre-install cost preview</p>
          {!mappingComplete ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Map {template.components.length - mappedIds.filter(Boolean).length} more component{template.components.length - mappedIds.filter(Boolean).length === 1 ? "" : "s"} to resolve current Costbook cost.
            </p>
          ) : duplicateMapping ? (
            <p className="mt-1 text-sm text-warning">Each recipe slot must use a different Costbook item.</p>
          ) : incompatibleComponent ? (
            <p className="mt-1 text-sm text-warning">{incompatibleComponent.label} needs a compatible unit and cost type.</p>
          ) : preview.isLoading ? (
            <p className="mt-1 text-sm text-muted-foreground">Resolving mapped Costbook costsâ€¦</p>
          ) : preview.isError ? (
            <p className="mt-1 text-sm text-warning" role="alert">
              Cost preview unavailable. {preview.error instanceof Error ? preview.error.message : "Try again."}
            </p>
          ) : preview.data ? (
            <div className="mt-2 grid gap-1 text-sm">
              <span><strong className="font-medium">{formatCurrency(preview.data.unitCost)}</strong> / {template.unitOfMeasure}</span>
              <span className="text-muted-foreground">
                {outputQuantity} {template.unitOfMeasure} job cost Â· {formatCurrency(preview.data.unitCost * outputQuantity)}
              </span>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={() => install.mutate()}
          disabled={install.isPending || !mappingComplete || duplicateMapping || Boolean(incompatibleComponent) || !previewReady}
        >
          {install.isPending ? "Installingâ€¦" : "Install assembly"}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Measured by {template.measurementBasis.toLowerCase()}. {template.wasteGuidance}</p>
        <p className="mt-1">
          Provenance: {template.review.source}, reviewed {template.review.reviewedOn}. {template.review.regionalBasis}
        </p>
        <p className="mt-1">Installation creates the tenant assembly only. Review its resolved cost, then use the separate Add action to write the estimate line.</p>
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

function StarterComponentMappingPicker({
  component,
  value,
  unavailableIds,
  disabled,
  onSelect,
}: {
  component: StarterCatalogComponent;
  value?: CostItemCatalogRecord;
  unavailableIds: Set<string>;
  disabled: boolean;
  onSelect: (item: CostItemCatalogRecord | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const resultsId = useId();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const search = useQuery({
    queryKey: ["starter-cost-item-search", component.key, debouncedQuery],
    queryFn: () => clientFetch<CostItemCatalogRecord[]>(`/costbook/cost-items/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: open,
    staleTime: 60_000,
  });

  const displayValue = editing ? query : value ? `${value.code} Â· ${value.name}` : "";
  const assessment = value ? assessCostItemMapping(component, value) : null;

  return (
    <div className="grid gap-2 rounded-lg border border-border/70 bg-background/75 p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-start">
      <div>
        <p className="text-sm font-medium text-foreground">{component.label} Â· {component.quantityPerUnit}</p>
        <p className="mt-1 text-xs text-muted-foreground">{component.help}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Compatible: {component.compatibleUnits.join(", ")} Â· {component.allowedCostItemKinds.join(", ")}
        </p>
      </div>
      <div className="relative">
        <Input
          role="combobox"
          aria-label={`Map ${component.label}`}
          aria-expanded={open}
          aria-controls={resultsId}
          autoComplete="off"
          placeholder="Search active Costbook itemsâ€¦"
          value={displayValue}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setEditing(true);
            setQuery(event.target.value);
            if (value) onSelect(null);
            setOpen(true);
          }}
        />
        {open && !disabled ? (
          <div id={resultsId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
            {search.isLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Searching Costbookâ€¦</p>
            ) : search.isError ? (
              <p className="px-3 py-2 text-xs text-destructive" role="alert">Cost Items could not be loaded.</p>
            ) : (search.data ?? []).length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No active Cost Items found.</p>
            ) : (
              (search.data ?? []).map((item) => {
                const itemAssessment = assessCostItemMapping(component, item);
                const unavailable = unavailableIds.has(item.id);
                const selectable = !unavailable && itemAssessment.compatible;
                const detail = unavailable
                  ? "Already mapped to another slot"
                  : itemAssessment.compatible
                    ? `${item.unitOfMeasure} Â· ${itemAssessment.kind}`
                    : itemAssessment.reasons.join(" Â· ");
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={value?.id === item.id}
                    disabled={!selectable}
                    className="grid w-full gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(item);
                      setEditing(false);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium text-foreground">{item.code} Â· {item.name}</span>
                    <span className="text-xs text-muted-foreground">{detail}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
        {assessment && !assessment.compatible ? <p className="mt-1 text-xs text-warning">{assessment.reasons.join(" Â· ")}</p> : null}
      </div>
    </div>
  );
}

const costTypes: LineItem["costType"][] = ["labor", "material", "equipment", "disposal", "subcontractor", "other"];

function groupLineItems(items: LineItem[]) {
  const grouped = new Map<string, LineItem[]>();
  for (const item of items) grouped.set(item.section || "General", [...(grouped.get(item.section || "General") ?? []), item]);
  return Array.from(grouped.entries());
}

const estimateItemColumns = "lg:grid-cols-[minmax(0,1fr)_5.5rem_6.25rem_7.25rem]";

function EditableLineItem({ estimateId, lineItem, isDraft, onUpdated, onRemove, removing }: { estimateId: string; lineItem: LineItem; isDraft: boolean; onUpdated: () => void; onRemove: () => void; removing: boolean }) {
  const editorId = useId();
  const costHelpId = `${editorId}-cost-help`;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ description: lineItem.description, quantity: String(lineItem.quantity), unitCost: String(lineItem.unitCost), unitOfMeasure: lineItem.unitOfMeasure, section: lineItem.section, costType: lineItem.costType, taxable: lineItem.taxable });
  const [error, setError] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: () => {
      const quantity = Number(form.quantity);
      const unitCost = Number(form.unitCost);
      if (!form.description.trim() || !form.unitOfMeasure.trim() || !form.unitCost.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error("Description and unit are required; quantity must be positive and unit cost is required and cannot be negative.");
      }
      return clientFetch(`/estimates/${estimateId}/line-items/${lineItem.id}`, { method: "PATCH", body: JSON.stringify({ ...form, quantity, unitCost }) });
    },
    onSuccess: () => { setError(null); setEditing(false); onUpdated(); },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update line item"),
  });
  return <li aria-label={lineItem.description} className="border-b border-border/70 px-0 py-4 last:border-b-0">
    {editing && isDraft ? <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2"><Label htmlFor={`${editorId}-description`}>Description</Label><Input id={`${editorId}-description`} className="min-h-11 lg:min-h-8" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="Description" /></div>
      <div className="space-y-2"><Label htmlFor={`${editorId}-section`}>Section</Label><Input id={`${editorId}-section`} className="min-h-11 lg:min-h-8" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} aria-label="Section" /></div>
      <div className="space-y-2"><Label htmlFor={`${editorId}-quantity`}>Quantity</Label><Input id={`${editorId}-quantity`} className="min-h-11 lg:min-h-8" type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} aria-label="Quantity" /></div>
      <div className="space-y-2"><Label htmlFor={`${editorId}-unit-cost`}>Unit cost</Label><Input id={`${editorId}-unit-cost`} className="min-h-11 lg:min-h-8" type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} aria-label="Unit cost" required aria-describedby={costHelpId} /></div>
      <div className="space-y-2"><Label htmlFor={`${editorId}-unit`}>Unit</Label><Input id={`${editorId}-unit`} className="min-h-11 lg:min-h-8" value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} aria-label="Unit" /></div>
      <div className="space-y-2"><Label htmlFor={`${editorId}-cost-type`}>Cost type</Label><select id={`${editorId}-cost-type`} className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base lg:h-10 lg:text-sm" value={form.costType} onChange={(e) => setForm({ ...form, costType: e.target.value as LineItem["costType"] })}>{costTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
      <label className="flex min-h-11 items-center gap-2 text-sm lg:min-h-7"><input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} /> Taxable</label>
      <div className="flex gap-2"><Button className="min-h-11 lg:min-h-7" size="sm" onClick={() => update.mutate()} disabled={update.isPending || !form.unitCost.trim()}>{update.isPending ? "Savingâ€¦" : "Save"}</Button><Button className="min-h-11 lg:min-h-7" size="sm" variant="ghost" onClick={() => { setError(null); setEditing(false); }}>Cancel</Button></div>
      <p id={costHelpId} className="sm:col-span-2 lg:col-span-4 text-xs text-muted-foreground">Enter a unit cost. Use 0 only when this item intentionally has no cost.</p>
      {error && <p role="alert" className="sm:col-span-2 lg:col-span-4 text-sm text-destructive">{error}</p>}
    </div> : <div className="space-y-2">
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2", estimateItemColumns)}>
        <div className="min-w-0 space-y-1"><div className="break-words font-medium">{lineItem.description}</div><div className="text-sm text-muted-foreground lg:hidden">{lineItem.quantity} {lineItem.unitOfMeasure} Ã— {formatCurrency(lineItem.unitCost)}</div></div>
        <div role="group" aria-label="Quantity" className="hidden min-w-0 break-words text-sm tabular-nums lg:block">{lineItem.quantity} {lineItem.unitOfMeasure}</div>
        <div role="group" aria-label="Unit cost" className="hidden min-w-0 break-all text-right font-mono text-sm tabular-nums lg:block">{formatCurrency(lineItem.unitCost)}</div>
        <div role="group" aria-label="Line cost" className="min-w-0 break-all text-right font-mono font-semibold tabular-nums">{formatCurrency(lineItem.lineCost)}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground"><Badge variant="outline">{lineItem.costType}</Badge><Badge variant="outline">{lineItem.assemblyId ? "Assembly source" : lineItem.costItemId ? "Costbook source" : "Custom item"}</Badge>{lineItem.taxable && <Badge variant="secondary">taxable</Badge>}</div>
        {isDraft && <div className="ml-auto flex gap-1"><Button className="min-h-11 lg:min-h-7" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button><Button className="min-h-11 lg:min-h-7" variant="ghost" size="sm" onClick={onRemove} disabled={removing}>Remove</Button></div>}
      </div>
    </div>}
  </li>;
}

function PricingPanel({
  estimateId,
  estimate,
  hasTaxableLineItems,
  pricingModeLabel,
  isDraft,
  onUpdated,
}: {
  estimateId: string;
  estimate: Estimate;
  hasTaxableLineItems: boolean;
  pricingModeLabel: string;
  isDraft: boolean;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState<"markup" | "targetMargin">(estimate.targetMarginPct != null ? "targetMargin" : "markup");
  const [value, setValue] = useState(String(estimate.targetMarginPct ?? estimate.profitPct ?? 0));
  const [overhead, setOverhead] = useState(String(estimate.overheadPct ?? 0));
  const [tax, setTax] = useState(String(estimate.taxPct ?? 0));
  const [error, setError] = useState<string | null>(null);
  const grossProfit = (estimate.preTaxTotalPrice ?? estimate.totalPrice - (estimate.taxAmount ?? 0)) - (estimate.costAfterOverhead ?? estimate.subtotalCost * (1 + estimate.overheadPct / 100));
  const costAfterOverhead = estimate.costAfterOverhead ?? estimate.subtotalCost * (1 + estimate.overheadPct / 100);
  const preTaxTotalPrice = estimate.preTaxTotalPrice ?? estimate.totalPrice - (estimate.taxAmount ?? 0);
  const currentMarkupPct = costAfterOverhead > 0 ? (grossProfit / costAfterOverhead) * 100 : 0;
  const currentMarginPct = preTaxTotalPrice > 0 ? (grossProfit / preTaxTotalPrice) * 100 : 0;

  const setPricingMode = useMutation({
    mutationFn: () => {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0) throw new Error("Enter a valid percentage");
      return clientFetch(`/estimates/${estimateId}/pricing-mode`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          markupPct: mode === "markup" ? numericValue : undefined,
          targetMarginPct: mode === "targetMargin" ? numericValue : undefined,
        }),
      });
    },
    onSuccess: () => {
      setError(null);
      onUpdated();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update pricing"),
  });

  const updateSettings = useMutation({
    mutationFn: () => {
      const overheadPct = Number(overhead);
      const taxPct = Number(tax);
      if (!Number.isFinite(overheadPct) || overheadPct < 0 || !Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) throw new Error("Enter valid overhead and tax percentages");
      return clientFetch(`/estimates/${estimateId}`, { method: "PATCH", body: JSON.stringify({ overheadPct, taxPct }) });
    },
    onSuccess: () => { setError(null); onUpdated(); },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update estimate settings"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Profit / markup</CardTitle>
            <CardDescription>Switch between markup and target margin without changing the estimate math.</CardDescription>
          </div>
          <Badge variant="outline">{pricingModeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={mode === "markup" ? "default" : "outline"} onClick={() => setMode("markup")}>
            Markup %
          </Button>
          <Button type="button" variant={mode === "targetMargin" ? "default" : "outline"} onClick={() => setMode("targetMargin")}>
            Target margin %
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "markup"
            ? (() => {
                const pct = Number(value) || 20;
                const cost = 100;
                const price = cost * (1 + pct / 100);
                return `$${cost} cost at ${pct}% markup = $${price.toFixed(2)} price.`;
              })()
            : (() => {
                const pct = Math.min(Number(value) || 20, 99);
                const cost = 100;
                const price = cost / (1 - pct / 100);
                return `$${cost} cost at ${pct}% target margin = $${price.toFixed(2)} price.`;
              })()}
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="pricing-value">Percentage</Label>
            <Input id="pricing-value" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setPricingMode.mutate()} disabled={!isDraft || setPricingMode.isPending}>
              {setPricingMode.isPending ? "Applyingâ€¦" : "Apply"}
            </Button>
            {setPricingMode.isSuccess && !setPricingMode.isPending ? (
              <span className="text-xs text-success">Saved</span>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="overhead-value">Overhead %</Label><Input id="overhead-value" type="number" min="0" step="any" value={overhead} onChange={(e) => setOverhead(e.target.value)} disabled={!isDraft} /></div>
          <div className="space-y-2"><Label htmlFor="tax-value">Tax %</Label><Input id="tax-value" type="number" min="0" max="100" step="any" value={tax} onChange={(e) => setTax(e.target.value)} disabled={!isDraft} /></div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => updateSettings.mutate()} disabled={!isDraft || updateSettings.isPending}>
            {updateSettings.isPending ? "Saving settingsâ€¦" : "Save overhead / tax"}
          </Button>
          {updateSettings.isSuccess && !updateSettings.isPending ? <span className="text-xs text-success">Saved</span> : null}
        </div>
        {Number(tax) > 0 && !hasTaxableLineItems ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning" role="alert">
            A tax rate is set, but no estimate line is marked taxable. Tax will calculate to $0.00 until you mark the applicable line items as taxable.
          </p>
        ) : null}
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Current gross profit</span>
            <span className="font-medium">{formatCurrency(grossProfit)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Current margin</span>
            <span className="font-medium">{formatPercent(currentMarginPct)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Current markup</span>
            <span className="font-medium">{formatPercent(currentMarkupPct)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tax is allocated across taxable scope using the same estimate-wide pricing basis. Finalized estimates are read-only; duplicate the version from the project history to revise it.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function SummaryValue({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-base font-semibold tabular-nums", tone === "positive" && "text-success", tone === "negative" && "text-destructive")}>{value}</div>
    </div>
  );
}


function ResultGroup({
  title,
  description,
  results,
  baseIndex,
  activeIndex,
  onSelect,
}: {
  title: string;
  description: string;
  results: PickerResult[];
  baseIndex: number;
  activeIndex: number;
  onSelect: (result: PickerResult, index: number) => void;
}) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="text-xs text-muted-foreground">{results.length}</div>
      </div>
      <div className="space-y-2">
        {results.map((result, offset) => {
          const index = baseIndex + offset;
          const isActive = index === activeIndex;
          return (
            <button
              key={`${result.kind}-${result.id}`}
              id={`item-search-option-${result.kind}-${result.id}`}
              role="option"
              aria-selected={isActive}
              type="button"
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive ? "border-primary bg-primary/5 shadow-(--elev-1)" : "border-border/70 bg-background hover:border-primary/40 hover:bg-muted/50"
              )}
              onClick={() => onSelect(result, index)}
            >
              <div className="space-y-1">
                <div className="font-medium">{result.name}</div>
                <div className="text-xs text-muted-foreground">
                  {result.code} Â· {result.unitOfMeasure}
                </div>
              </div>
              <Badge variant={result.kind === "assembly" ? "default" : result.kind === "starterAssembly" ? "outline" : "secondary"} className="shrink-0">
                {result.kind === "assembly" ? "Assembly" : result.kind === "starterAssembly" ? "Setup required" : "Cost item"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
