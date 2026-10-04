import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTransport } from 'nodemailer';
import type { ServerConfig } from '@visitspakistan/config';
import type { RecoveryDelivery } from '@visitspakistan/database';
export function recoveryDelivery(
  config: ServerConfig,
): RecoveryDelivery | undefined {
  const origin = new URL(config.CMS_ORIGIN);
  if (config.NODE_ENV === 'production' && origin.protocol !== 'https:')
    return undefined;
  const message = (token: string) =>
    `Open this VisitsPakistan CMS link within 15 minutes to reset your password. You also need your authenticator code.\n\n${origin.origin}/reset-password/#token=${token}\n\nIf you did not request this, ignore this message. Your password has not changed.`;
  if (
    config.SMTP_HOST &&
    config.SMTP_FROM &&
    config.SMTP_USER &&
    config.SMTP_PASS
  ) {
    const smtp = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      requireTLS: config.SMTP_PORT !== 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    return async (email, token) => {
      await smtp.sendMail({
        from: config.SMTP_FROM,
        to: email,
        subject: 'Reset your VisitsPakistan CMS password',
        text: message(token),
      });
    };
  }
  if (config.NODE_ENV === 'production') return undefined;
  return async (email, token) => {
    await mkdir(config.PASSWORD_RESET_DIR, { recursive: true, mode: 0o700 });
    await writeFile(
      join(config.PASSWORD_RESET_DIR, `${randomUUID()}.json`),
      JSON.stringify({ to: email, text: message(token) }, null, 2),
      { mode: 0o600, flag: 'wx' },
    );
  };
}
