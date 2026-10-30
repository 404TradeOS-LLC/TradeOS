export const ENTRY_TIMING = { first: 4000, returning: 2500 } as const;
// Software rasterizers (SwiftShader in headless/GPU-less environments,
// Mesa llvmpipe, and anything reporting itself as software) make the
// PMREM environment pass pathologically slow: its deferred cost blocks the
// main thread past the intro exit timer, so the intro overstays its
// scheduled duration. Detecting them lets the cinema skip the environment
// map there and keep the intro on schedule; the scene lights still shade
// the metal. Hardware renderers keep the full reflective environment.
export function isSoftwareRendererName(renderer: string): boolean {
  return /swiftshader|llvmpipe|software/i.test(renderer);
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
