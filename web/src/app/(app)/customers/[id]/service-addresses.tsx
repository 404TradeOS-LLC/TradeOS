"use client";

import { useActionState } from "react";
import {
  createServiceAddressAction,
  removeServiceAddressAction,
  updateServiceAddressAction,
} from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ServiceAddress } from "@/lib/api";

function AddressFields({ address }: { address?: ServiceAddress }) {
  const prefix = address?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {([
        ["label", "Label", address?.label ?? "", false],
        ["addressLine1", "Street address", address?.addressLine1 ?? "", true],
        ["addressLine2", "Suite or unit", address?.addressLine2 ?? "", false],
        ["city", "City", address?.city ?? "", true],
        ["state", "State", address?.state ?? "", true],
        ["postalCode", "Postal code", address?.postalCode ?? "", true],
      ] as const).map(([name, label, value, required]) => (
        <div className="flex flex-col gap-1" key={name}>
          <Label htmlFor={`${prefix}-${name}`}>{label}</Label>
          <Input id={`${prefix}-${name}`} name={name} defaultValue={value} required={required} />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isPrimary" defaultChecked={address?.isPrimary ?? false} />
        Primary service address
      </label>
    </div>
  );
}

function ExistingAddress({ customerId, address, canWrite }: { customerId: string; address: ServiceAddress; canWrite: boolean }) {
  const [updateState, updateAction, updating] = useActionState(updateServiceAddressAction, undefined);
  const [removeState, removeAction, removing] = useActionState(removeServiceAddressAction, undefined);

  return (
    <li className="rounded-md border p-3">
      <div className="mb-3 text-sm">
        <strong>{address.label || "Service address"}{address.isPrimary ? " · Primary" : ""}</strong>
        <p>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""}</p>
        <p>{address.city}, {address.state} {address.postalCode}</p>
      </div>
      {canWrite ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Edit address</summary>
          <form action={updateAction} className="mt-3 space-y-3">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="addressId" value={address.id} />
            <AddressFields address={address} />
            {updateState?.error ? <p role="alert" className="text-destructive">{updateState.error}</p> : null}
            <Button type="submit" disabled={updating}>{updating ? "Saving…" : "Save address"}</Button>
          </form>
          <form action={removeAction} className="mt-3">
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="addressId" value={address.id} />
            {removeState?.error ? <p role="alert" className="text-destructive">{removeState.error}</p> : null}
            <Button type="submit" variant="destructive" disabled={removing}>{removing ? "Removing…" : "Remove address"}</Button>
          </form>
        </details>
      ) : null}
    </li>
  );
}

export function ServiceAddresses({ customerId, addresses, canWrite }: { customerId: string; addresses: ServiceAddress[]; canWrite: boolean }) {
  const [createState, createAction, creating] = useActionState(createServiceAddressAction, undefined);
  return (
    <div className="space-y-4">
      {addresses.length ? (
        <ul className="space-y-3">
          {addresses.map((address) => <ExistingAddress key={address.id} customerId={customerId} address={address} canWrite={canWrite} />)}
        </ul>
      ) : <p className="text-sm text-muted-foreground">No service addresses saved yet.</p>}
      {canWrite ? (
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">Add service address</summary>
          <form action={createAction} className="mt-3 space-y-3">
            <input type="hidden" name="customerId" value={customerId} />
            <AddressFields />
            {createState?.error ? <p role="alert" className="text-sm text-destructive">{createState.error}</p> : null}
            <Button type="submit" disabled={creating}>{creating ? "Saving…" : "Save address"}</Button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
