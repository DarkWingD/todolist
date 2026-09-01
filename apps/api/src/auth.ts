import { db, account, session, user, verification } from '@todolist/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { env } from './env.js';
import { emailEnabled, magicLinkEmail, sendEmail } from './email.js';

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  // Links are built against the web origin; the web app proxies /api/auth to this server.
  baseURL: env.WEB_ORIGIN,
  basePath: '/api/auth',
  trustedOrigins: [env.WEB_ORIGIN],

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),

  // Extra identity fields surfaced on the user object.
  user: {
    additionalFields: {
      avatarEmoji: { type: 'string', required: false, defaultValue: '🙂' },
      avatarColor: { type: 'string', required: false, defaultValue: '#8B5CF6' },
    },
  },

  // Magic-link signups arrive with no name — default it to the email's local part.
  databaseHooks: {
    user: {
      create: {
        before: async (u) => ({
          data: { ...u, name: u.name?.trim() || u.email.split('@')[0] },
        }),
      },
    },
  },

  // Long-lived, self-refreshing sessions so people rarely re-authenticate.
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 days
    updateAge: 60 * 60 * 24, // slide the expiry forward at most once per day
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 minutes
      sendMagicLink: async ({ email, url }) => {
        try {
          // Without Resend configured, print the link so you can still sign in.
          if (!emailEnabled) {
            console.log(`\n🔗 MAGIC LINK for ${email}:\n${url}\n`);
            return;
          }
          const { subject, html, text } = magicLinkEmail(url);
          await sendEmail({ to: email, subject, html, text });
        } catch (err) {
          // Swallow send errors so the response doesn't reveal whether an address
          // is deliverable (prevents user enumeration) and never 500s.
          console.error('Magic link send failed:', err);
        }
      },
    }),
  ],
});

export type Auth = typeof auth;
