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

  // Every request arrives via nginx's proxy_pass, which appends its own hop onto
  // X-Forwarded-For — so Better Auth's own default (single-value X-Forwarded-For) could
  // never resolve a real client IP, and fell back to one shared rate-limit bucket for
  // everyone. CF-Connecting-IP is Cloudflare's own header, set once at the edge and never
  // touched afterward — the same one nginx's sign-in limiter already keys on
  // (infra/nginx.conf: $http_cf_connecting_ip) — so this just points Better Auth at the
  // same already-correct source instead of inventing a second way to parse the chain.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip'],
    },
  },

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
