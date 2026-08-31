import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().default(8787),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 chars'),
  // Optional: when unset, emails are logged to the console instead of sent
  // (magic-link URLs are printed so you can sign in without Resend configured).
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('ToDoList <onboarding@resend.dev>'),
});

// Treat empty strings (Docker Compose passes "" for unset vars) as undefined
// so `.optional()` / `.default()` behave as expected.
const cleaned = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
);
const parsed = schema.safeParse(cleaned);
if (!parsed.success) {
  console.error('❌ Invalid environment:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
