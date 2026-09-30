import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export type PasswordVerificationChannel = "email" | "sms";

export interface AdminPasswordVerificationDelivery {
  configured: boolean;
  sendEmailCode(input: { to: string; code: string; expiresInMinutes: number }): Promise<void>;
  sendSmsCode(input: { to: string; code: string; expiresInMinutes: number }): Promise<void>;
}

export function generateVerificationCode() {
  return String(randomInt(100000, 1000000));
}

export function generateVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashVerificationCode(
  secret: string,
  verificationId: string,
  channel: PasswordVerificationChannel,
  code: string
) {
  return createHmac("sha256", secret)
    .update(`${verificationId}:${channel}:${code}`)
    .digest("hex");
}

export function hashVerificationToken(secret: string, token: string) {
  return createHmac("sha256", secret)
    .update(`admin-password-verification-token:${token}`)
    .digest("hex");
}

export function safeHashEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export function maskPhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "*".repeat(trimmed.length);
  return `${"*".repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

type WebhookEnv = {
  PASSWORD_2FA_EMAIL_WEBHOOK_URL?: string;
  PASSWORD_2FA_SMS_WEBHOOK_URL?: string;
  PASSWORD_2FA_EMAIL_BEARER_TOKEN?: string;
  PASSWORD_2FA_SMS_BEARER_TOKEN?: string;
};

async function postCode(
  url: string,
  bearerToken: string | undefined,
  payload: Record<string, unknown>
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (bearerToken) headers.set("authorization", `Bearer ${bearerToken}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Verification delivery webhook returned HTTP ${response.status}.`);
  }
}

export function createAdminPasswordVerificationDelivery(
  env: WebhookEnv = process.env
): AdminPasswordVerificationDelivery {
  const emailUrl = env.PASSWORD_2FA_EMAIL_WEBHOOK_URL?.trim();
  const smsUrl = env.PASSWORD_2FA_SMS_WEBHOOK_URL?.trim();

  if (!emailUrl || !smsUrl) {
    return {
      configured: false,
      async sendEmailCode() {
        throw new Error("Email verification delivery is not configured.");
      },
      async sendSmsCode() {
        throw new Error("SMS verification delivery is not configured.");
      }
    };
  }

  return {
    configured: true,
    async sendEmailCode({ to, code, expiresInMinutes }) {
      await postCode(emailUrl, env.PASSWORD_2FA_EMAIL_BEARER_TOKEN, {
        channel: "email",
        purpose: "admin_password_change",
        to,
        code,
        expiresInMinutes,
        subject: "MaktabLink password verification"
      });
    },
    async sendSmsCode({ to, code, expiresInMinutes }) {
      await postCode(smsUrl, env.PASSWORD_2FA_SMS_BEARER_TOKEN, {
        channel: "sms",
        purpose: "admin_password_change",
        to,
        code,
        expiresInMinutes,
        message: `MaktabLink verification code: ${code}. It expires in ${expiresInMinutes} minutes.`
      });
    }
  };
}
