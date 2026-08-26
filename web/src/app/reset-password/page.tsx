import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password | TradeOS",
  description: "Choose a new password for your TradeOS account.",
};

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <ResetPasswordForm token={token} />
    </div>
  );
}
