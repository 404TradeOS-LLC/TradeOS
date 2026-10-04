"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen flex-1 bg-background lg:grid lg:grid-cols-[minmax(0,56.7%)_minmax(0,43.3%)]">
      <section
        aria-label="TradeOS"
        className="relative min-h-[226px] overflow-hidden bg-[#1b1d1f] text-[#f7f5f1] sm:min-h-[220px] lg:min-h-screen"
      >
        <div className="absolute inset-x-6 top-6 hidden items-center justify-between border-b border-white/10 pb-4 sm:flex lg:inset-x-12 lg:top-10">
          <Image
            src="/tradeos-entry-official.svg"
            alt="TradeOS"
            width={175}
            height={61}
            priority
            className="h-auto w-[145px] lg:w-[175px]"
          />
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45 lg:block">
            Built for what you build.
          </p>
        </div>

        <div className="absolute left-6 top-[92px] z-10 max-w-[18rem] sm:left-[31%] sm:top-[58px] sm:max-w-[27rem] lg:left-16 lg:top-[148px] lg:max-w-[44rem]">
          <p className="font-heading text-[30px] font-medium leading-[1.08] tracking-[-0.035em] sm:text-[38px] lg:text-[64px]">
            Built for what
            <br />
            you build.
          </p>
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-[-18px] flex items-center sm:hidden" aria-hidden="true">
          <Image
            src="/tradeos-entry-copper-identity-mobile.svg"
            alt=""
            width={154}
            height={186}
            className="h-[186px] w-[154px]"
          />
        </div>

        <div className="pointer-events-none absolute right-8 top-2 hidden sm:block lg:hidden" aria-hidden="true">
          <Image
            src="/tradeos-entry-copper-identity-tablet.svg"
            alt=""
            width={208}
            height={208}
            className="h-[208px] w-[208px]"
          />
        </div>

        <div className="pointer-events-none absolute bottom-[6%] left-[7%] hidden w-[86%] max-w-[710px] lg:block" aria-hidden="true">
          <Image
            src="/tradeos-entry-copper-identity-desktop.svg"
            alt=""
            width={710}
            height={470}
            className="h-auto w-full"
            priority
          />
        </div>

        <span className="absolute left-6 top-36 h-px w-10 bg-[#c2825c] sm:hidden" aria-hidden="true" />
      </section>

      <section className="relative flex min-h-[618px] items-start justify-center px-6 py-11 sm:min-h-[804px] sm:items-start sm:px-12 sm:pt-[78px] lg:min-h-screen lg:items-center lg:px-12 lg:py-16">
        <div className="w-full max-w-96">
          <Image
            src="/tradeos-entry-official-light.svg"
            alt="TradeOS"
            width={145}
            height={50}
            priority
            className="mb-16 hidden h-auto w-[145px] lg:block"
          />

          <header>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Welcome back.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace.</p>
          </header>

          <form action={formAction} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="pr-16"
                  required
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-1 my-1 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {state?.error ? (
              <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" disabled={isPending} className="mt-1 w-full">
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Forgot password?
            </Link>
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Create one
            </Link>
          </p>

          <p className="mt-16 text-xs font-medium tracking-[0.16em] text-muted-foreground sm:mt-24 lg:absolute lg:bottom-8">
            TradeOS
          </p>
        </div>
      </section>
    </main>
  );
}
