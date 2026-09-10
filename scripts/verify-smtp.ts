/**
 * Proves the Zoho mailbox works, before a student is the one who finds out.
 *
 *   npm run mail:verify                  connect and authenticate only
 *   npm run mail:verify you@example.com  also send a real test message
 *
 * The two failures this catches are the two that actually happen: a wrong
 * region host (a .in domain on smtp.zoho.com authenticates nowhere), and the
 * account password used where an app-specific password is required.
 */

import { sendMail, verifyTransport } from "../src/server/mail/mailer";
import { otpMessage } from "../src/server/mail/templates";
import { OTP_PURPOSE } from "../src/types/auth";
import { serverEnv } from "../src/lib/env";

async function main(): Promise<void> {
  const env = serverEnv();

  console.log("TREFOOD mail check");
  console.log(`  transport : ${env.MAIL_TRANSPORT}`);
  console.log(`  host      : ${env.SMTP_HOST}:${env.SMTP_PORT}`);
  console.log(`  user      : ${env.SMTP_USER ?? "(unset)"}`);
  console.log(`  from      : ${env.MAIL_FROM}`);
  console.log("");

  if (env.MAIL_TRANSPORT === "console") {
    console.log("MAIL_TRANSPORT=console — nothing is actually sent.");
    console.log("Set MAIL_TRANSPORT=smtp with the Zoho values to test the real mailbox.");
    return;
  }

  const check = await verifyTransport();
  if (!check.ok) {
    console.error(`FAILED to authenticate: ${check.error}`);
    console.error("");
    console.error("The usual causes, in order of likelihood:");
    console.error("  1. SMTP_PASSWORD is the account password, not an app-specific one.");
    console.error("     Zoho Mail -> Settings -> Security -> App Passwords -> Generate.");
    console.error("  2. SMTP_HOST is the wrong region. A .in domain is usually smtp.zoho.in.");
    console.error("  3. The domain is not verified in Zoho yet, or the mailbox does not exist.");
    process.exitCode = 1;
    return;
  }

  console.log("Authenticated. The mailbox accepts our credentials.");

  const recipient = process.argv[2];
  if (!recipient) {
    console.log("Pass an address to also send a test message.");
    return;
  }

  const message = otpMessage("123456", OTP_PURPOSE.SIGNUP, 10);
  const result = await sendMail({
    to: recipient,
    subject: `[TEST] ${message.subject}`,
    html: message.html,
    text: message.text,
  });

  if (!result.sent) {
    console.error(`Authenticated, but the send failed: ${result.error}`);
    console.error("Most often MAIL_FROM is an address this mailbox does not own.");
    process.exitCode = 1;
    return;
  }

  console.log(`Sent to ${recipient}. Check the inbox, and check spam the first time.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // The pooled transport keeps a socket warm, which keeps the process alive.
    process.exit(process.exitCode ?? 0);
  });
