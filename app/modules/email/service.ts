import { createHash } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { logWarn } from "../../backend/logging";

const RESEND_API_URL = "https://api.resend.com/emails";
const PASSWORD_RESET_PATH = "/reset-password";
const TEAM_INVITE_PATH = "/invite/accept";

export interface EmailSendResult {
  sent: boolean;
  providerMessageId?: string;
  skipped?: boolean;
}

export interface PasswordResetEmailInput {
  to: string;
  token: string;
  expiresAt: Date;
}

export interface TeamInviteEmailInput {
  to: string;
  role: "dispatcher" | "technician";
  token: string;
  expiresAt: Date;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

interface ResendSendResponse {
  id?: unknown;
}

export type EmailDispatchScheduler = (send: () => Promise<void>) => void;

interface ResponseLifecycle {
  once(event: "finish", listener: () => void): unknown;
}

export function scheduleEmailInBackground(send: () => Promise<void>): void {
  try {
    waitUntil(send());
  } catch {
    setImmediate(() => {
      void send();
    });
  }
}

export function scheduleEmailAfterResponse(response: ResponseLifecycle, send: () => Promise<void>): void {
  const afterResponse = new Promise<void>((resolve) => {
    response.once("finish", resolve);
  });

  try {
    waitUntil(afterResponse.then(send));
  } catch {
    void afterResponse.then(send);
  }
}

export class EmailService {
  async sendPasswordReset(input: PasswordResetEmailInput): Promise<EmailSendResult> {
    const resetUrl = buildActionUrl(PASSWORD_RESET_PATH, input.token);
    const expiresAt = input.expiresAt.toISOString();

    return this.send({
      to: input.to,
      subject: "Reset your TradeOS password",
      html: [
        "<p>We received a request to reset your TradeOS password.</p>",
        "<p><a href=\"" + escapeHtml(resetUrl) + "\">Reset your password</a></p>",
        "<p>This link expires at " + escapeHtml(expiresAt) + ".</p>",
        "<p>If you did not request this, you can safely ignore this email.</p>",
      ].join(""),
      text: [
        "We received a request to reset your TradeOS password.",
        "Reset your password: " + resetUrl,
        "This link expires at " + expiresAt + ".",
        "If you did not request this, you can safely ignore this email.",
      ].join("\n\n"),
      idempotencyKey: "password-reset-" + digest(input.token),
    });
  }

  async sendTeamInvite(input: TeamInviteEmailInput): Promise<EmailSendResult> {
    const inviteUrl = buildActionUrl(TEAM_INVITE_PATH, input.token);
    const expiresAt = input.expiresAt.toISOString();
    const role = input.role === "technician" ? "Technician" : "Dispatcher";

    return this.send({
      to: input.to,
      subject: "You have been invited to TradeOS",
      html: [
        "<p>You have been invited to join a TradeOS workspace as a " + escapeHtml(role) + ".</p>",
        "<p><a href=\"" + escapeHtml(inviteUrl) + "\">Accept your TradeOS invitation</a></p>",
        "<p>This invitation expires at " + escapeHtml(expiresAt) + ".</p>",
      ].join(""),
      text: [
        "You have been invited to join a TradeOS workspace as a " + role + ".",
        "Accept your invitation: " + inviteUrl,
        "This invitation expires at " + expiresAt + ".",
      ].join("\n\n"),
      idempotencyKey: "team-invite-" + digest(input.token),
    });
  }

  private async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    const baseUrl = process.env.APP_BASE_URL?.trim();
    const missing = [
      !apiKey ? "RESEND_API_KEY" : null,
      !from ? "EMAIL_FROM" : null,
      !baseUrl ? "APP_BASE_URL" : null,
    ].filter((name): name is string => name !== null);

    if (missing.length > 0) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Transactional email is not configured");
      }
      logWarn("email.delivery_skipped", { missing });
      return { sent: false, skipped: true };
    }

    if (!baseUrl) {
      throw new Error("APP_BASE_URL is not configured");
    }

    const senderUrl = new URL(baseUrl);
    if (process.env.NODE_ENV === "production" && senderUrl.protocol !== "https:") {
      throw new Error("APP_BASE_URL must use HTTPS in production");
    }

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error("Resend email request failed (" + response.status + ")");
    }

    const payload = (await response.json()) as ResendSendResponse;
    return {
      sent: true,
      ...(typeof payload.id === "string" ? { providerMessageId: payload.id } : {}),
    };
  }
}

export const emailService = new EmailService();

function buildActionUrl(path: string, token: string): string {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_BASE_URL is not configured");
    }
    return "http://localhost:3000" + path + "?token=" + encodeURIComponent(token);
  }

  const url = new URL(baseUrl);
  const basePath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = basePath + path;
  url.search = "";
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
