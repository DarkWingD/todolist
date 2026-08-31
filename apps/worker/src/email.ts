import { Resend } from 'resend';
import { env } from './env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(args: { to: string; subject: string; html: string; text?: string }) {
  if (!resend) {
    console.log(`✉️  [email disabled] would send "${args.subject}" to ${args.to}`);
    return;
  }
  const { error } = await resend.emails.send({ from: env.EMAIL_FROM, ...args });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
