import { createHash } from "node:crypto";
import { renderTradeOsEmail } from "./brand";
import { waitUntil } from "@vercel/functions";
import { logWarn } from "../../backend/logging";

const RESEND_API_URL = "https://api.resend.com/emails";
const PASSWORD_RESET_PATH = "/reset-password";
const TEAM_INVITE_PATH = "/invite/accept";
const CUSTOMER_PORTAL_PATH = "/customer-portal/access";

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

export interface CustomerPortalAccessEmailInput {
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

// One Athena observability alert transition (newly firing, reactivated, or
// newly resolved) addressed to the operator mailbox. Plain fields on
// purpose: the email module stays domain-agnostic and does not import
// Athena's record types - the delivery module maps AthenaAlertRecord onto
// this shape.
export interface AthenaAlertEmailInput {
  to: string;
  orgId: string;
  ruleId: string;
  dedupeKey: string;
  severity: string;
  status: "active" | "resolved";
  summary: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  template: {
    id: "tradeos-password-reset" | "tradeos-team-invitation" | "tradeos-customer-portal-access" | "tradeos-athena-alert";
    variables: Record<string, string>;
  };
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

  const delivery = afterResponse.then(send);
  try {
    waitUntil(delivery);
  } catch {
    void delivery;
  }
}

export class EmailService {
  async sendPasswordReset(input: PasswordResetEmailInput): Promise<EmailSendResult> {
    const resetUrl = buildActionUrl(PASSWORD_RESET_PATH, input.token);
    const expiresAt = input.expiresAt.toISOString();

    return this.send({
      to: input.to,
      template: {
        id: "tradeos-password-reset",
        variables: { RESET_URL: resetUrl, EXPIRES_AT: expiresAt },
      },
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
      template: {
        id: "tradeos-team-invitation",
        variables: { ROLE: role, INVITE_URL: inviteUrl, EXPIRES_AT: expiresAt },
      },
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

  async sendCustomerPortalAccess(input: CustomerPortalAccessEmailInput): Promise<EmailSendResult> {
    const accessUrl = buildActionUrl(CUSTOMER_PORTAL_PATH, input.token);
    const expiresAt = input.expiresAt.toISOString();

    return this.send({
      to: input.to,
      template: {
        id: "tradeos-customer-portal-access",
        variables: { PORTAL_URL: accessUrl, EXPIRES_AT: expiresAt },
      },
      subject: "Your TradeOS customer portal is ready",
      html: [
        "<p>Your contractor has shared a secure TradeOS project portal with you.</p>",
        "<p><a href=\"" + escapeHtml(accessUrl) + "\">Open your customer portal</a></p>",
        "<p>This private link expires at " + escapeHtml(expiresAt) + " and can only be used once.</p>",
        "<p>If you were not expecting this, you can safely ignore this email.</p>",
      ].join(""),
      text: [
        "Your contractor has shared a secure TradeOS project portal with you.",
        "Open your customer portal: " + accessUrl,
        "This private link expires at " + expiresAt + " and can only be used once.",
        "If you were not expecting this, you can safely ignore this email.",
      ].join("\n\n"),
      idempotencyKey: "customer-portal-access-" + digest(input.token),
    });
  }
  async sendAthenaAlert(input: AthenaAlertEmailInput): Promise<EmailSendResult> {
    const firing = input.status === "active";
    const overviewUrl = buildAppUrl("/athena");
    // The anchor is the full timestamp that identifies this notification,
    // not just its calendar date: an alert that fires, resolves, and fires
    // again on the same day is a distinct notification from its first
    // firing (different firstSeenAt), so it must not share an idempotency
    // key with it. A re-run over the same applied row produces the identical
    // key, so Resend dedupes the repeat instead of sending twice.
    const anchor = firing ? input.firstSeenAt : (input.resolvedAt ?? input.lastSeenAt);
    const subject = firing
      ? `[TradeOS Athena] FIRING: ${input.ruleId} (${input.severity})`
      : `[TradeOS Athena] RESOLVED: ${input.ruleId}`;

    return this.send({
      to: input.to,
      template: {
        id: "tradeos-athena-alert",
        variables: {
          ORG_ID: input.orgId,
          RULE_ID: input.ruleId,
          DEDUPE_KEY: input.dedupeKey,
          SEVERITY: input.severity,
          STATUS: input.status,
          SUMMARY: input.summary,
          FIRST_SEEN_AT: input.firstSeenAt,
          LAST_SEEN_AT: input.lastSeenAt,
          RESOLVED_AT: input.resolvedAt ?? "",
          OVERVIEW_URL: overviewUrl,
        },
      },
      subject,
      html: [
        firing
          ? "<p>An Athena alert is firing for your TradeOS workspace.</p>"
          : "<p>An Athena alert has resolved for your TradeOS workspace.</p>",
        "<p><strong>Rule:</strong> " + escapeHtml(input.ruleId) + "</p>",
        "<p><strong>Severity:</strong> " + escapeHtml(input.severity) + "</p>",
        "<p><strong>Summary:</strong> " + escapeHtml(input.summary) + "</p>",
        "<p><strong>Organization:</strong> " + escapeHtml(input.orgId) + "</p>",
        "<p><strong>First seen:</strong> " + escapeHtml(input.firstSeenAt) + "</p>",
        "<p><strong>Last seen:</strong> " + escapeHtml(input.lastSeenAt) + "</p>",
        ...(input.resolvedAt ? ["<p><strong>Resolved:</strong> " + escapeHtml(input.resolvedAt) + "</p>"] : []),
        "<p><a href=\"" + escapeHtml(overviewUrl) + "\">Open the Athena overview</a> to trace this alert.</p>",
      ].join(""),
      text: [
        firing ? "An Athena alert is firing for your TradeOS workspace." : "An Athena alert has resolved for your TradeOS workspace.",
        "Rule: " + input.ruleId,
        "Severity: " + input.severity,
        "Summary: " + input.summary,
        "Organization: " + input.orgId,
        "First seen: " + input.firstSeenAt,
        "Last seen: " + input.lastSeenAt,
        ...(input.resolvedAt ? ["Resolved: " + input.resolvedAt] : []),
        "Open the Athena overview: " + overviewUrl,
      ].join("\n\n"),
      idempotencyKey: "athena-alert-" + digest(input.orgId + "|" + input.dedupeKey + "|" + input.status + "|" + anchor),
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
      // Published Resend templates are opt-in. Keep existing HTML/plain-text
      // sends as the default until authenticated staging acceptance is recorded.
      // Never retry a template failure as inline mail: that could send twice.
      body: JSON.stringify(process.env.RESEND_TEMPLATE_MODE === "dashboard"
        ? {
            from,
            to: [message.to],
            template: message.template,
          }
        : {
            from,
            to: [message.to],
            subject: message.subject,
            html: renderTradeOsEmail(message.html),
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

function buildAppUrl(path: string): string {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_BASE_URL is not configured");
    }
    return "http://localhost:3000" + path;
  }

  const url = new URL(baseUrl);
  const basePath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = basePath + path;
  url.search = "";
  return url.toString();
}

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
