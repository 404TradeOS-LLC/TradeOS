import type { Metadata } from "next";
import { InviteAcceptForm } from "./invite-accept-form";

export const metadata: Metadata = {
  title: "Accept invitation | TradeOS",
  description: "Join your TradeOS workspace securely.",
};

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function InviteAcceptPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <InviteAcceptForm token={token} />
    </main>
  );
}
