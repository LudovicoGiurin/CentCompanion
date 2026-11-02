import { Resend } from "resend";
import { getEnv } from "../runtime";

const BRAND = "Cent Companion";

const DEFAULT_FROM = "Cent Companion <noreply@centcomp.net>";

function getFromAddress(): string {
  return getEnv().EMAIL_FROM ?? DEFAULT_FROM;
}

function getResend(): Resend | null {
  const key = getEnv().RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function appUrl(path: string): string {
  const base = (getEnv().APP_URL ?? "http://localhost:8788").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function emailLayout(title: string, body: string, actionUrl: string, actionLabel: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4e9c8;font-family:Georgia,serif;color:#1c1c1c;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4e9c8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#fbf5dd;border:4px solid #1c1c1c;box-shadow:0 6px 0 0 rgba(0,0,0,0.25);">
          <tr>
            <td style="padding:24px 28px;border-bottom:2px dashed #6d5526;">
              <p style="margin:0;font-family:monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c0392b;">CentComp</p>
              <h1 style="margin:8px 0 0;font-family:monospace;font-size:18px;letter-spacing:1px;">${BRAND}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:18px;line-height:1.5;">
              ${body}
              <p style="margin:28px 0 0;">
                <a href="${actionUrl}" style="display:inline-block;background:#c0392b;color:#ffffff;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:1px;text-transform:uppercase;padding:14px 24px;border:2px solid #1c1c1c;box-shadow:0 4px 0 0 rgba(0,0,0,0.25);">${actionLabel}</a>
              </p>
              <p style="margin:24px 0 0;font-size:14px;color:#6d5526;word-break:break-all;">
                Or copy this link:<br />
                <a href="${actionUrl}" style="color:#3aa0e6;">${actionUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:2px dashed #6d5526;font-family:monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#6d5526;">
              Unofficial Centurion Commander companion · centcomp.net
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const verifyUrl = appUrl(`/verify-email?token=${token}`);
  const html = emailLayout(
    "Verify your email",
    `<p>Welcome to <strong>${BRAND}</strong>. Confirm your email to register for events and climb the national leaderboard.</p>`,
    verifyUrl,
    "Verify email",
  );

  return sendEmail(to, `Verify your ${BRAND} account`, html, verifyUrl);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const resetUrl = appUrl(`/reset-password?token=${token}`);
  const html = emailLayout(
    "Reset your password",
    `<p>We received a request to reset your <strong>${BRAND}</strong> password. This link expires in one hour.</p><p>If you didn't ask for this, you can ignore this email.</p>`,
    resetUrl,
    "Reset password",
  );

  return sendEmail(to, `Reset your ${BRAND} password`, html, resetUrl);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fallbackUrl: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY not set — email not sent:", subject, "→", to, fallbackUrl);
    return false;
  }

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[EMAIL] Resend error:", error);
    return false;
  }

  return true;
}
