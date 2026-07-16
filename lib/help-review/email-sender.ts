/** Outbound invitation and password-reset email boundary for the first-party identity path. */

export interface AuthEmail {
  readonly to: string;
  readonly subject: string;
  readonly bodyText: string;
  readonly actionUrl: string;
}

export type EmailAdapterName = "console" | "resend";

export function selectedEmailAdapter(environment: NodeJS.ProcessEnv = process.env): EmailAdapterName {
  const selected = environment.HELP_REVIEW_EMAIL_ADAPTER ?? "console";
  if (selected === "console" || selected === "resend") return selected;
  throw new Error("The selected email adapter is not supported.");
}

export function applicationOrigin(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.HELP_REVIEW_APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");
  if (environment.NODE_ENV === "production") {
    throw new Error("HELP_REVIEW_APP_ORIGIN is required in production for account setup links.");
  }
  return "http://localhost:3000";
}

export function setPasswordUrl(rawToken: string, environment: NodeJS.ProcessEnv = process.env): string {
  return `${applicationOrigin(environment)}/set-password?token=${encodeURIComponent(rawToken)}`;
}

/** Sends through the configured adapter. The console adapter is a development aid and is rejected by the production configuration guard. */
export async function sendAuthEmail(email: AuthEmail, environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const adapter = selectedEmailAdapter(environment);
  if (adapter === "console") {
    console.log(JSON.stringify({
      event: "help_review_auth_email",
      adapter: "console",
      to: email.to,
      subject: email.subject,
      actionUrl: email.actionUrl
    }));
    return;
  }
  const apiKey = environment.RESEND_API_KEY;
  const from = environment.HELP_REVIEW_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("The Resend email adapter requires RESEND_API_KEY and HELP_REVIEW_EMAIL_FROM.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      text: `${email.bodyText}\n\n${email.actionUrl}\n\nIf you did not expect this email you can ignore it.`
    })
  });
  if (!response.ok) throw new Error(`The email provider rejected the message (${response.status}).`);
}
