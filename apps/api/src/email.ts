import { Resend } from 'resend';
import { env } from './env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** True when Resend is configured; otherwise emails are logged, not sent. */
export const emailEnabled = resend !== null;

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  if (!resend) {
    console.log(`✉️  [email disabled] would send "${subject}" to ${to}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  if (error) {
    console.error('Resend send failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/** Minimal, themeable-later magic-link email. */
export function magicLinkEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Your ToDoList sign-in link',
    text: `Sign in to ToDoList: ${url}\n\nThis link expires shortly. If you didn't request it, ignore this email.`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 440px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px;">Sign in to ToDoList</h1>
        <p style="color: #555; font-size: 15px;">Tap the button below to sign in. This link expires shortly.</p>
        <a href="${url}" style="display: inline-block; margin: 16px 0; background: #FF6B5E; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 12px; font-weight: 700;">Sign in</a>
        <p style="color: #999; font-size: 13px;">If you didn't request this, you can safely ignore it.</p>
      </div>`,
  };
}
