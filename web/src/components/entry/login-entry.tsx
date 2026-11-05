"use client";
import Image from "next/image";
import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Pause,
  Play,
} from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CinematicIntro, Schematics } from "./cinematic-intro";
import {
  ENTRY_TIMING,
  GREETINGS,
  getVisitKind,
  nextGreeting,
  rememberVisit,
  validateCredentials,
  type VisitKind,
} from "./entry-state";
import styles from "./entry.module.css";
export function LoginEntry() {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);
  const [opening, setOpening] = useState(false),
    [kind, setKind] = useState<VisitKind>("first"),
    [greeting, setGreeting] = useState<string>(GREETINGS[0]),
    [paused, setPaused] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const heading = useRef<HTMLHeadingElement>(null),
    emailInput = useRef<HTMLInputElement>(null),
    passwordInput = useRef<HTMLInputElement>(null),
    serverError = useRef<HTMLParagraphElement>(null);
  const finish = useCallback(() => {
    const restore = document.activeElement?.closest(".intro-film");
    setOpening(false);
    if (restore)
      requestAnimationFrame(() =>
        heading.current?.focus({ preventScroll: true }),
      );
  }, []);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = requestAnimationFrame(() => {
      try {
        const storage = window.localStorage;
        setKind(getVisitKind(storage));
        setGreeting(nextGreeting(storage));
        rememberVisit(storage);
      } catch {
        /* Private browsing may disable storage entirely. */
      }
      setOpening(!motion.matches);
    });
    const changed = () => {
      if (motion.matches) finish();
    };
    motion.addEventListener("change", changed);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", changed);
    };
  }, [finish]);
  useEffect(() => {
    if (state?.error) serverError.current?.focus();
  }, [state]);
  function validate(event: FormEvent<HTMLFormElement>) {
    if (isPending) {
      event.preventDefault();
      return;
    }
    const next = validateCredentials(email, password);
    setErrors(next);
    if (next.email || next.password) {
      event.preventDefault();
      (next.email ? emailInput : passwordInput).current?.focus();
    }
  }
  return (
    <main className={styles.root}>
      <div className={`entry ${paused ? "motion-paused" : ""}`}>
        <div className="entry-content" inert={opening ? true : undefined}>
          <Schematics className="login-schematics" />
          <header className="masthead">
            <Link className="header-brand" href="/" aria-label="TradeOS home">
              <Image
                src="/entry/wordmark.svg"
                alt="TradeOS"
                width={185}
                height={47}
                priority
              />
            </Link>
            <button
              type="button"
              className="motion-control"
              aria-label={
                paused ? "Resume ambient motion" : "Pause ambient motion"
              }
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
              <span>{paused ? "Motion paused" : "Pause motion"}</span>
            </button>
          </header>
          <div className="scene">
            <div className="login-identity">
              <div className="login-monogram">
                <Image src="/entry/mark.svg" alt="" width={64} height={64} />
              </div>
              <h1>
                Built for what you <span>build.</span>
              </h1>
            </div>
            <section className="entry-panel" aria-labelledby="sign-in-title">
              <header className="intro">
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h2 id="sign-in-title" ref={heading} tabIndex={-1}>
                  Welcome back.
                </h2>
                <p>{greeting}</p>
              </header>
              <form
                action={formAction}
                onSubmit={validate}
                noValidate
                aria-busy={isPending}
              >
                <div className="field">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    ref={emailInput}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  <p className="field-error" id="email-error">
                    {errors.email || "\u00a0"}
                  </p>
                </div>
                <div className="field">
                  <Label htmlFor="password">Password</Label>
                  <div className="password">
                    <Input
                      ref={passwordInput}
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={!!errors.password}
                      aria-describedby={
                        errors.password ? "password-error" : undefined
                      }
                    />
                    <button
                      type="button"
                      className="visibility"
                      aria-pressed={showPassword}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p id="password-error" className="field-error">
                    {errors.password || "\u00a0"}
                  </p>
                </div>
                <div className="recovery">
                  <Link href="/forgot-password" className="text-button">
                    Forgot password?
                  </Link>
                </div>
                <div className="auth-error-slot">
                  {state?.error ? (
                    <p
                      ref={serverError}
                      role="alert"
                      tabIndex={-1}
                      className="server-error"
                    >
                      {state.error}
                    </p>
                  ) : null}
                </div>
                <Button type="submit" disabled={isPending} className="primary">
                  <span>{isPending ? "Signing in…" : "Sign in"}</span>
                  {isPending ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <ArrowRight size={20} />
                  )}
                </Button>
              </form>
              <p className="signup">
                No account yet? <Link href="/signup">Create one</Link>
              </p>
              <div className="panel-foot">
                <LockKeyhole size={14} />
                <span>Secure sign-in</span>
              </div>
            </section>
          </div>
          <footer className="entry-footer">
            <span>© {new Date().getFullYear()} 404 TradeOS LLC</span>
            <span className="footer-preview">BUILT FOR WHAT YOU BUILD.</span>
          </footer>
        </div>
        {opening ? (
          <CinematicIntro duration={ENTRY_TIMING[kind]} onComplete={finish} />
        ) : null}
      </div>
    </main>
  );
}
