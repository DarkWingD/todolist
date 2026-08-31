import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  // Optional: when unset, reminder emails are logged instead of sent.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('ToDoList <onboarding@resend.dev>'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

// Treat empty strings (Docker Compose passes "" for unset vars) as undefined.
const cleaned = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
);
const parsed = schema.safeParse(cleaned);
if (!parsed.success) {
  console.error('❌ Invalid worker environment:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
