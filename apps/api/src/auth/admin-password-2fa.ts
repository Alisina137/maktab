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

type DeliveryEnv = {
  PASSWORD_2FA_EMAIL_WEBHOOK_URL?: string;
  PASSWORD_2FA_SMS_WEBHOOK_URL?: string;
  PASSWORD_2FA_EMAIL_BEARER_TOKEN?: string;
  PASSWORD_2FA_SMS_BEARER_TOKEN?: string;
  RESEND_API_KEY?: string;
  PASSWORD_2FA_EMAIL_FROM?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
};

async function postWebhook(
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

async function sendResendEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  code: string;
  expiresInMinutes: number;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: "MaktabLink password verification",
      text: `Your MaktabLink verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes. If you did not request a password change, ignore this message.`
    })
  });

  if (!response.ok) {
    throw new Error(`Resend verification email returned HTTP ${response.status}.`);
  }
}

async function sendTwilioSms(input: {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  to: string;
  code: string;
  expiresInMinutes: number;
}) {
  const body = new URLSearchParams({
    To: input.to,
    Body: `MaktabLink verification code: ${input.code}. Expires in ${input.expiresInMinutes} minutes.`
  });

  if (input.messagingServiceSid) {
    body.set("MessagingServiceSid", input.messagingServiceSid);
  } else if (input.fromNumber) {
    body.set("From", input.fromNumber);
  } else {
    throw new Error("Twilio sender is not configured.");
  }

  const credentials = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(input.accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  if (!response.ok) {
    throw new Error(`Twilio verification SMS returned HTTP ${response.status}.`);
  }
}

export function createAdminPasswordVerificationDelivery(
  env: DeliveryEnv = process.env
): AdminPasswordVerificationDelivery {
  const emailWebhookUrl = env.PASSWORD_2FA_EMAIL_WEBHOOK_URL?.trim();
  const smsWebhookUrl = env.PASSWORD_2FA_SMS_WEBHOOK_URL?.trim();
  const resendApiKey = env.RESEND_API_KEY?.trim();
  const emailFrom = env.PASSWORD_2FA_EMAIL_FROM?.trim();
  const twilioAccountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const twilioAuthToken = env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFromNumber = env.TWILIO_FROM_NUMBER?.trim();
  const twilioMessagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  const emailConfigured = Boolean(emailWebhookUrl || (resendApiKey && emailFrom));
  const smsConfigured = Boolean(
    smsWebhookUrl ||
      (twilioAccountSid &&
        twilioAuthToken &&
        (twilioFromNumber || twilioMessagingServiceSid))
  );

  if (!emailConfigured || !smsConfigured) {
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
      if (emailWebhookUrl) {
        await postWebhook(
          emailWebhookUrl,
          env.PASSWORD_2FA_EMAIL_BEARER_TOKEN,
          {
            channel: "email",
            purpose: "admin_password_change",
            to,
            code,
            expiresInMinutes,
            subject: "MaktabLink password verification"
          }
        );
        return;
      }

      await sendResendEmail({
        apiKey: resendApiKey!,
        from: emailFrom!,
        to,
        code,
        expiresInMinutes
      });
    },

    async sendSmsCode({ to, code, expiresInMinutes }) {
      if (smsWebhookUrl) {
        await postWebhook(
          smsWebhookUrl,
          env.PASSWORD_2FA_SMS_BEARER_TOKEN,
          {
            channel: "sms",
            purpose: "admin_password_change",
            to,
            code,
            expiresInMinutes,
            message: `MaktabLink verification code: ${code}. It expires in ${expiresInMinutes} minutes.`
          }
        );
        return;
      }

      await sendTwilioSms({
        accountSid: twilioAccountSid!,
        authToken: twilioAuthToken!,
        fromNumber: twilioFromNumber,
        messagingServiceSid: twilioMessagingServiceSid,
        to,
        code,
        expiresInMinutes
      });
    }
  };
}
