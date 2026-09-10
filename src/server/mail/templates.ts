import "server-only";

import { OTP_PURPOSE, type OtpPurpose } from "@/types/auth";

/**
 * The messages TREFOOD sends.
 *
 * Deliberately plain HTML with inline styles and no images. Gmail strips
 * <style> blocks, Outlook ignores half of flexbox, and a code that renders as
 * a broken layout is a support ticket. Every message also ships a text/plain
 * part, which is what a spam filter looks for and what a watch shows.
 */

const BRAND = "#E8A33D";
const INK = "#141414";

interface Message {
  subject: string;
  html: string;
  text: string;
}

function shell(heading: string, body: string, footerNote: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">
          <tr>
            <td style="background:${INK};padding:20px 28px;">
              <span style="color:${BRAND};font-size:20px;font-weight:700;letter-spacing:0.08em;">TREFOOD</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:${INK};font-weight:700;">${heading}</h1>
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#fafaf9;border-top:1px solid #e7e5e4;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#78716c;">${footerNote}</p>
              <p style="margin:8px 0 0;font-size:12px;color:#a8a29e;">TREFOOD &middot; NIT Patna campus food ordering &middot; trefood.in</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function codeBlock(code: string): string {
  // Letter-spacing on a monospace face, so 0 and O are never confused when
  // somebody reads the code off a lock screen and types it on another device.
  return `<div style="margin:20px 0;padding:18px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;text-align:center;">
    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.35em;color:${INK};padding-left:0.35em;">${code}</span>
  </div>`;
}

export function otpMessage(code: string, purpose: OtpPurpose, minutes: number): Message {
  const isSignup = purpose === OTP_PURPOSE.SIGNUP;

  const heading = isSignup ? "Confirm your email address" : "Reset your TREFOOD password";
  const lead = isSignup
    ? "Enter this code on the TREFOOD sign-up screen to finish creating your account."
    : "Enter this code on the TREFOOD reset screen to choose a new password.";

  const body = `
    <p style="margin:0;font-size:14px;line-height:1.65;color:#44403c;">${lead}</p>
    ${codeBlock(code)}
    <p style="margin:0;font-size:13px;line-height:1.65;color:#57534e;">
      The code expires in ${minutes} minutes and can be used once.
    </p>`;

  const footer = isSignup
    ? "If you did not try to create a TREFOOD account, ignore this email. Nothing was created."
    : "If you did not ask to reset your password, ignore this email. Your password has not changed.";

  const text = [
    heading,
    "",
    lead,
    "",
    `Code: ${code}`,
    `Expires in ${minutes} minutes. Single use.`,
    "",
    footer,
    "TREFOOD - trefood.in",
  ].join("\n");

  return {
    subject: `${code} is your TREFOOD ${isSignup ? "verification" : "password reset"} code`,
    html: shell(heading, body, footer),
    text,
  };
}

export function welcomeMessage(name: string): Message {
  const heading = `Welcome to TREFOOD, ${escapeHtml(name)}`;
  const body = `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#44403c;">
      Your account is ready. Order from the campus kitchens, pick it up at the gate, and pay cash on delivery.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#44403c;">
      One thing worth doing now: set a 4-digit quick unlock in Account, so you are not typing a password at the counter.
    </p>`;

  const text = [
    `Welcome to TREFOOD, ${name}`,
    "",
    "Your account is ready. Order from the campus kitchens, pick it up at the gate, and pay cash on delivery.",
    "Set a 4-digit quick unlock in Account so you are not typing a password at the counter.",
    "",
    "TREFOOD - trefood.in",
  ].join("\n");

  return {
    subject: "Welcome to TREFOOD",
    html: shell(heading, body, "You are receiving this because an account was created with this address."),
    text,
  };
}

export function passwordChangedMessage(name: string, when: Date): Message {
  const heading = "Your TREFOOD password was changed";
  const stamp = when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  const body = `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#44403c;">
      Hi ${escapeHtml(name)}, the password on your TREFOOD account was changed on ${escapeHtml(stamp)} IST.
      Every other device has been signed out.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#44403c;">
      If this was not you, reset your password immediately and tell us at tregoinworks@gmail.com.
    </p>`;

  const text = [
    heading,
    "",
    `Hi ${name}, the password on your TREFOOD account was changed on ${stamp} IST. Every other device has been signed out.`,
    "If this was not you, reset your password immediately and email tregoinworks@gmail.com.",
    "",
    "TREFOOD - trefood.in",
  ].join("\n");

  return {
    subject: "Your TREFOOD password was changed",
    html: shell(heading, body, "This is a security notice; it is sent whether or not the change was expected."),
    text,
  };
}

/** Names come from a sign-up form and from Google. Neither is trusted markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
