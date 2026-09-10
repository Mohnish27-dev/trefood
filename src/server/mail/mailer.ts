import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { serverEnv } from "@/lib/env";

/**
 * Outbound mail, over the TREFOOD business mailbox.
 *
 * Verification codes used to ride a hosted auth provider's shared sending
 * quota. That quota is small, invisible from here, and counted across every
 * project on the platform — so a busy evening produced "email rate limit
 * exceeded" for students who had done nothing wrong, and there was no dial to
 * turn. Sending through a mailbox on our own domain replaces a borrowed
 * allowance with one we own and can raise.
 *
 * One transport for the process, created lazily. Nodemailer pools the TCP
 * connection, so the second code of a lunch rush does not pay for a fresh TLS
 * handshake.
 */

let cached: Transporter | null = null;

/** Console transport: prints the message instead of sending it. Dev only — `serverEnv` refuses it in production. */
function createConsoleTransport(): Transporter {
  return nodemailer.createTransport({ jsonTransport: true });
}

function createSmtpTransport(): Transporter {
  const env = serverEnv();

  // Port 465 is implicit TLS, 587 is STARTTLS. Deriving it from the port
  // rather than asking for both is one fewer way to misconfigure a mailbox.
  const secure = env.SMTP_SECURE ?? env.SMTP_PORT === 465;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    // Zoho throttles hard on connection churn. Pooling keeps one connection
    // warm and queues behind it instead of opening a socket per code.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export function getTransport(): Transporter {
  if (cached) return cached;
  cached = serverEnv().MAIL_TRANSPORT === "console" ? createConsoleTransport() : createSmtpTransport();
  return cached;
}

export interface OutboundMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  sent: boolean;
  /** Set when the send failed. Never surfaced verbatim to the person signing up. */
  error: string | null;
}

/**
 * Sends one message.
 *
 * Returns a result rather than throwing: a failed send is a thing the sign-up
 * screen has to explain in words a student can act on ("we could not send the
 * code, try again"), not a stack trace, and never the SMTP server's own reply —
 * which leaks whether an address exists.
 */
export async function sendMail(mail: OutboundMail): Promise<MailResult> {
  const env = serverEnv();

  try {
    await getTransport().sendMail({
      from: env.MAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    if (env.MAIL_TRANSPORT === "console") {
      // The whole point of this transport, and a warning because no mail
      // actually left the building — the code is readable right here instead.
      console.warn(
        [`[mail:console] to=${mail.to}`, `subject=${mail.subject}`, mail.text].join("\n"),
      );
    }

    // A successful send is deliberately silent. One line per code, at campus
    // scale, is a log of who signed in and when for no operational gain, and
    // the failures below are what anybody actually goes looking for.
    return { sent: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mail] send failed to=${maskEmail(mail.to)}: ${message}`);
    return { sent: false, error: message };
  }
}

/** `mohnish@trefood.in` becomes `m*****h@trefood.in`. Logs should not be an address book. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

/**
 * Proves the mailbox actually accepts our credentials.
 * Called by `scripts/verify-smtp.ts`, never on a request path.
 */
export async function verifyTransport(): Promise<{ ok: boolean; error: string | null }> {
  try {
    await getTransport().verify();
    return { ok: true, error: null };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
