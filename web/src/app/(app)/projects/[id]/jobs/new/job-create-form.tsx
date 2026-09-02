"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, clientFetch } from "@/lib/clientApi";

type ServiceAddress = {
  id: string;
  label?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  isPrimary?: boolean;
};

type CustomerDetail = {
  id: string;
  serviceAddresses?: ServiceAddress[];
};

type CreatedJob = {
  id: string;
  jobNumber?: string;
  title?: string;
};

const fieldClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function JobCreateForm({
  projectId,
  customerId,
  projectName,
  projectSiteAddress,
}: {
  projectId: string;
  customerId: string;
  projectName: string;
  projectSiteAddress: string | null;
}) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<ServiceAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressLoadFailed, setAddressLoadFailed] = useState(false);
  const [addressReloadNonce, setAddressReloadNonce] = useState(0);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clientFetch<CustomerDetail>(`/customers/${customerId}`)
      .then((customer) => {
        if (cancelled) return;
        const nextAddresses = Array.isArray(customer.serviceAddresses) ? customer.serviceAddresses : [];
        setAddresses(nextAddresses);
        const primary = nextAddresses.find((address) => address.isPrimary) ?? nextAddresses[0];
        setSelectedAddressId(primary?.id ?? "");
        setShowAddressForm(nextAddresses.length === 0);
        setAddressLoadFailed(false);
        setError(null);
      })
      .catch((caught) => {
        if (!cancelled) {
          setAddressLoadFailed(true);
          setShowAddressForm(false);
          setError(caught instanceof Error ? caught.message : "Unable to load service addresses.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAddresses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, addressReloadNonce]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

  function formatAddress(address: ServiceAddress) {
    const street = [address.addressLine1, address.addressLine2].filter(Boolean).join(", ");
    return `${address.label ? `${address.label} — ` : ""}${street}, ${address.city}, ${address.state} ${address.postalCode}`;
  }

  function retryAddressLoad() {
    setLoadingAddresses(true);
    setAddressLoadFailed(false);
    setError(null);
    setAddressReloadNonce((value) => value + 1);
  }

  async function createServiceAddress(formData: FormData): Promise<string> {
    const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const state = String(formData.get("state") ?? "").trim();
    const postalCode = String(formData.get("postalCode") ?? "").trim();
    if (!addressLine1 || !city || !state || !postalCode) {
      throw new Error("Complete the service address before creating the job.");
    }

    const created = await clientFetch<ServiceAddress>(`/customers/${customerId}/service-addresses`, {
      method: "POST",
      body: JSON.stringify({
        label: String(formData.get("addressLabel") ?? "Jobsite").trim() || "Jobsite",
        addressLine1,
        addressLine2: String(formData.get("addressLine2") ?? "").trim() || undefined,
        city,
        state,
        postalCode,
        country: "US",
        isPrimary: addresses.length === 0,
      }),
    });
    setAddresses((current) => [...current, created]);
    setSelectedAddressId(created.id);
    setShowAddressForm(false);
    return created.id;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addressLoadFailed) {
      setError("Reload service addresses before creating the job.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      let serviceAddressId = selectedAddressId;
      if (showAddressForm || !serviceAddressId) {
        serviceAddressId = await createServiceAddress(formData);
      }

      const title = String(formData.get("title") ?? "").trim();
      const jobType = String(formData.get("jobType") ?? "").trim();
      if (!title || !jobType) throw new Error("Job title and job type are required.");

      const created = await clientFetch<CreatedJob>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          customerId,
          serviceAddressId,
          title,
          description: String(formData.get("description") ?? "").trim() || undefined,
          jobType,
          priority: String(formData.get("priority") ?? "medium"),
          estimatedDurationMinutes: Number(formData.get("estimatedDurationMinutes") || 120),
        }),
      });

      router.push(`/dispatch?view=all&q=${encodeURIComponent(created.jobNumber ?? created.title ?? title)}`);
      router.refresh();
    } catch (caught) {
      const message = caught instanceof ClientApiError
        ? `${caught.message}${caught.status ? ` (HTTP ${caught.status})` : ""}`
        : caught instanceof Error
          ? caught.message
          : "Unable to create job.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Create field job</h2>
        <p className="mt-1 text-sm text-muted-foreground">Turn the approved project scope into a schedulable field job for {projectName}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Job title
          <input className={fieldClass} name="title" defaultValue={projectName} required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Job type
          <input className={fieldClass} name="jobType" placeholder="Install, repair, remodel…" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Priority
          <select className={fieldClass} name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Estimated duration (minutes)
          <input className={fieldClass} name="estimatedDurationMinutes" type="number" min="1" step="15" defaultValue="120" required />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm font-medium">
        Description
        <textarea name="description" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Field scope, access notes, or completion expectations" />
      </label>

      <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Service address</div>
            <div className="text-xs text-muted-foreground">Every field job is tied to a customer service address.</div>
          </div>
          {addresses.length > 0 && !addressLoadFailed ? (
            <button type="button" className="text-sm font-medium underline" onClick={() => setShowAddressForm((value) => !value)}>
              {showAddressForm ? "Use saved address" : "Add another address"}
            </button>
          ) : null}
        </div>

        {loadingAddresses ? <p className="text-sm text-muted-foreground">Loading service addresses…</p> : null}

        {!loadingAddresses && addressLoadFailed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">Service addresses could not be loaded. Retry before creating a job.</p>
            <button type="button" className="text-sm font-medium underline" onClick={retryAddressLoad}>
              Retry address load
            </button>
          </div>
        ) : null}

        {!loadingAddresses && !addressLoadFailed && addresses.length > 0 && !showAddressForm ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Saved address
            <select className={fieldClass} value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)} required>
              {addresses.map((address) => <option key={address.id} value={address.id}>{formatAddress(address)}</option>)}
            </select>
            {selectedAddress ? <span className="text-xs font-normal text-muted-foreground">Selected: {formatAddress(selectedAddress)}</span> : null}
          </label>
        ) : null}

        {!loadingAddresses && !addressLoadFailed && (showAddressForm || addresses.length === 0) ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">Label<input className={fieldClass} name="addressLabel" defaultValue="Jobsite" /></label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">Street address<input className={fieldClass} name="addressLine1" defaultValue={projectSiteAddress ?? ""} required /></label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">Address line 2<input className={fieldClass} name="addressLine2" /></label>
            <label className="grid gap-1 text-sm font-medium">City<input className={fieldClass} name="city" required /></label>
            <label className="grid gap-1 text-sm font-medium">State<input className={fieldClass} name="state" required /></label>
            <label className="grid gap-1 text-sm font-medium">ZIP / postal code<input className={fieldClass} name="postalCode" required /></label>
          </div>
        ) : null}
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <button type="submit" disabled={busy || loadingAddresses || addressLoadFailed} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Creating job…" : "Create job and open Dispatch"}
        </button>
      </div>
    </form>
  );
}
