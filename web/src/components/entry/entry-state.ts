export const ENTRY_TIMING = { first: 4000, returning: 2500 } as const;
// Software rasterizers (SwiftShader in headless/GPU-less environments,
// Mesa llvmpipe, Windows WARP via the Microsoft Basic Render Driver, and
// anything reporting itself as software) make the PMREM environment pass
// pathologically slow: its deferred cost blocks the main thread past the
// intro exit timer, so the intro overstays its scheduled duration.
// Detecting them lets the cinema skip the environment map there and keep
// the intro on schedule; the scene lights still shade the metal.
// Hardware renderers keep the full reflective environment. An unknown or
// unavailable renderer name is treated as software: the expensive pass
// must not run on a context that cannot be proven to be hardware (the
// extension is unavailable under some privacy settings, including on
// software contexts).
export function isSoftwareRendererName(renderer: string): boolean {
  if (!renderer.trim()) return true;
  return /swiftshader|llvmpipe|software|basic render driver/i.test(renderer);
}
// Minimal structural type for reading the unmasked renderer name, so the
// lookup itself is unit-testable without a real WebGL context.
export interface RendererInfoSource {
  getExtension(name: string): { UNMASKED_RENDERER_WEBGL: number } | null;
  getParameter(parameter: number): unknown;
}
export function readRendererName(context: RendererInfoSource): string {
  try {
    const info = context.getExtension("WEBGL_debug_renderer_info");
    return info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  } catch {
    return "";
  }
}
export type VisitKind = keyof typeof ENTRY_TIMING;
export const GREETINGS = [
  "Coffee ready? Let’s build.",
  "Measure twice. Log in once.",
  "Good work starts here.",
  "Let’s get this job moving.",
  "Another day. Something worth building.",
] as const;
export interface EntryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const VISIT_KEY = "tradeos.entry.visited.v2";
const GREETING_KEY = "tradeos.entry.greeting.v1";
export function getVisitKind(storage: EntryStorage): VisitKind {
  try {
    return storage.getItem(VISIT_KEY) ? "returning" : "first";
  } catch {
    return "first";
  }
}
export function rememberVisit(storage: EntryStorage) {
  try {
    storage.setItem(VISIT_KEY, "1");
  } catch {
    /* Storage is optional; it never gates authentication. */
  }
}
export function nextGreeting(storage: EntryStorage): string {
  try {
    const previous = Number(storage.getItem(GREETING_KEY) ?? -1);
    const index =
      Number.isInteger(previous) &&
      previous >= -1 &&
      previous < GREETINGS.length
        ? (previous + 1) % GREETINGS.length
        : 0;
    storage.setItem(GREETING_KEY, String(index));
    return GREETINGS[index];
  } catch {
    return GREETINGS[0];
  }
}
export function validateCredentials(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}
