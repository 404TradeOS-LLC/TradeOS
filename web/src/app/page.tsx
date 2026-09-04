import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

type SearchParams = Promise<{
  code?: string;
  next?: string;
  token_hash?: string;
  type?: string;
}>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const recoveryParams = new URLSearchParams();

  if (params.code) recoveryParams.set("code", params.code);
  if (params.token_hash && params.type === "recovery") {
    recoveryParams.set("token_hash", params.token_hash);
    recoveryParams.set("type", params.type);
  }

  if (recoveryParams.size > 0) {
    recoveryParams.set("next", "/reset-password");
    redirect("/auth/confirm?" + recoveryParams.toString());
  }

  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
