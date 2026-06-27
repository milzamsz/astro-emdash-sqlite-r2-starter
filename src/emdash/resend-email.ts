import { definePlugin } from "emdash";

/**
 * EmDash email provider backed by Resend's HTTP API.
 *
 * Registers the exclusive `email:deliver` hook so EmDash can send auth
 * emails (magic links, invites, recovery) and notifications. Configuration is
 * read from the environment at send time, so no admin-dashboard setup is
 * required:
 *
 *   RESEND_API_KEY  - Resend API key (required to actually send)
 *   EMAIL_FROM      - verified sender, e.g. "My Site <noreply@example.com>"
 *
 * It uses `fetch` (no Node socket deps), so it works on both Node and edge
 * runtimes. When exactly one email provider is registered, EmDash selects it
 * automatically.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface DeliverEvent {
  message: EmailMessage;
  source: string;
}

export function createPlugin() {
  return definePlugin({
    id: "resend-email",
    version: "1.0.0",
    capabilities: ["hooks.email-transport:register"],
    hooks: {
      "email:deliver": {
        exclusive: true,
        handler: async (event: DeliverEvent) => {
          const apiKey = process.env.RESEND_API_KEY;
          const from = process.env.EMAIL_FROM;

          if (!apiKey) {
            throw new Error(
              "RESEND_API_KEY is not set — cannot deliver email via Resend.",
            );
          }
          if (!from) {
            throw new Error(
              "EMAIL_FROM is not set — Resend requires a verified sender address.",
            );
          }

          const { message } = event;
          const response = await fetch(RESEND_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: message.to,
              subject: message.subject,
              text: message.text,
              ...(message.html ? { html: message.html } : {}),
            }),
          });

          if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(
              `Resend API error ${response.status}: ${detail || response.statusText}`,
            );
          }
        },
      },
    },
  });
}
