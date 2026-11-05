import type { Metadata } from "next";
import { LoginEntry } from "@/components/entry/login-entry";
export const metadata: Metadata = { title: "Sign in | TradeOS" };
export default function LoginPage() {
  return <LoginEntry />;
}
