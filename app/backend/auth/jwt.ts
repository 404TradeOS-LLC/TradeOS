import crypto from "crypto";
import { ApiError } from "../middleware/errorHandler";

export interface AuthClaims {
  sub: string;
  email?: string;
  orgId?: string;
  role?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

const DEFAULT_AUTH_TOKEN_TTL_SECONDS = 60 * 60;

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(base64, "base64");
}

function parseSegment<T>(segment: string, label: string): T {
  try {
    return JSON.parse(base64UrlDecode(segment).toString("utf8")) as T;
  } catch {
    throw new ApiError(401, `Invalid ${label} encoding`);
  }
}

export function signAuthToken(claims: AuthClaims, secret: string): string {
  if (!secret) throw new Error("AUTH_JWT_SECRET is required to sign auth tokens");
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const effectiveIat = claims.iat ?? iat;
  const payload = {
    ...claims,
    iat: effectiveIat,
    exp: claims.exp ?? effectiveIat + getAuthTokenTtlSeconds(),
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export function verifyAuthToken(token: string, secret: string): AuthClaims {
  if (!secret) throw new ApiError(500, "AUTH_JWT_SECRET is not configured");
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError(401, "Invalid bearer token");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseSegment<unknown>(encodedHeader, "JWT header");
  if (!isRecord(header) || header.alg !== "HS256" || header.typ !== "JWT") {
    throw new ApiError(401, "Unsupported JWT algorithm");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const receivedSignature = base64UrlDecode(encodedSignature);
  if (
    receivedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new ApiError(401, "Invalid bearer token signature");
  }

  const payload = parseSegment<unknown>(encodedPayload, "JWT payload");
  if (!isRecord(payload) || typeof payload.sub !== "string" || payload.sub.trim() === "") {
    throw new ApiError(401, "JWT payload is missing required claims");
  }

  if (!isFiniteInteger(payload.iat) || !isFiniteInteger(payload.exp)) {
    throw new ApiError(401, "JWT payload has invalid timestamp claims");
  }
  if (payload.email !== undefined && typeof payload.email !== "string") {
    throw new ApiError(401, "JWT payload has invalid email claim");
  }
  if (payload.orgId !== undefined && typeof payload.orgId !== "string") {
    throw new ApiError(401, "JWT payload has invalid organization claim");
  }
  if (payload.role !== undefined && typeof payload.role !== "string") {
    throw new ApiError(401, "JWT payload has invalid role claim");
  }
  if (payload.iss !== undefined && typeof payload.iss !== "string") {
    throw new ApiError(401, "JWT payload has invalid issuer claim");
  }
  if (
    payload.aud !== undefined &&
    !(
      typeof payload.aud === "string" ||
      (Array.isArray(payload.aud) && payload.aud.every((value) => typeof value === "string"))
    )
  ) {
    throw new ApiError(401, "JWT payload has invalid audience claim");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new ApiError(401, "Bearer token has expired");
  }

  const expectedIssuer = process.env.AUTH_ISSUER;
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw new ApiError(401, "Bearer token issuer mismatch");
  }

  const expectedAudience = process.env.AUTH_AUDIENCE;
  if (expectedAudience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (!audiences.includes(expectedAudience)) {
      throw new ApiError(401, "Bearer token audience mismatch");
    }
  }

  return payload as unknown as AuthClaims;
}

let supabaseJwks: unknown = null;

export async function verifyAnyAuthToken(token: string): Promise<AuthClaims> {
  const header = parseHeader(token);
  if (header.alg === "HS256") {
    return verifyAuthToken(token, process.env.AUTH_JWT_SECRET ?? "");
  }

  return verifySupabaseToken(token);
}

async function verifySupabaseToken(token: string): Promise<AuthClaims> {
  const { jwtVerify } = await import("jose");
  const jwks = await getSupabaseJwks();
  const issuer = getSupabaseIssuer();
  const audience = process.env.SUPABASE_JWT_AUDIENCE;

  try {
    const { payload } = await jwtVerify(token, jwks as Parameters<typeof jwtVerify>[1], {
      issuer,
      audience: audience || undefined,
    });

    if (!payload.sub || !isFiniteInteger(payload.exp) || !isFiniteInteger(payload.iat)) {
      throw new ApiError(401, "JWT payload is missing required claims");
    }

    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      iss: typeof payload.iss === "string" ? payload.iss : undefined,
      aud: Array.isArray(payload.aud) ? payload.aud.filter((value): value is string => typeof value === "string") : typeof payload.aud === "string" ? payload.aud : undefined,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Invalid bearer token");
  }
}

function parseHeader(token: string): { alg?: string } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError(401, "Invalid bearer token");
  const header = parseSegment<unknown>(parts[0], "JWT header");
  if (!isRecord(header)) throw new ApiError(401, "Invalid JWT header");
  return header as { alg?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function getAuthTokenTtlSeconds(): number {
  const configured = Number(process.env.AUTH_JWT_TTL_SECONDS);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_AUTH_TOKEN_TTL_SECONDS;
}

function getSupabaseIssuer() {
  const explicit = process.env.SUPABASE_JWT_ISSUER;
  if (explicit) return explicit;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new ApiError(500, "SUPABASE_URL is not configured");
  return `${url.replace(/\/$/, "")}/auth/v1`;
}

async function getSupabaseJwks() {
  if (!supabaseJwks) {
    const { createRemoteJWKSet } = await import("jose");
    const explicit = process.env.SUPABASE_JWT_JWKS_URL;
    const issuer = getSupabaseIssuer();
    supabaseJwks = createRemoteJWKSet(new URL(explicit ?? `${issuer}/.well-known/jwks.json`));
  }
  return supabaseJwks;
}
