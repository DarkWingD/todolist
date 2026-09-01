import { BackButton } from '../components/BackButton';

export function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-3 text-muted" style={{ fontSize: 'var(--fs-base)' }}>{children}</p>
  );
  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-d2 mt-d4 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>{children}</h2>
  );

  return (
    <>
      <BackButton label="You" onClick={onBack} />
      <h1
        className="mb-d3 font-head"
        style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
      >
        Privacy &amp; security
      </h1>

      <P>ToDoList is a private, self-hosted app run by its owner — not a big company. Here’s exactly how your data is handled.</P>

      <H>What we store</H>
      <P>Your email address, display name, and the lists, tasks, events and birthdays you create. That’s it. There are no ads, no analytics, and no third-party trackers.</P>

      <H>Where it lives</H>
      <P>On a private server the owner controls. The database isn’t exposed to the internet, and all traffic is encrypted over HTTPS.</P>

      <H>Who it’s shared with</H>
      <P>Only the people you share a list with can see that list. Behind the scenes, two services help deliver the app: Cloudflare (routes traffic securely) and Resend (sends your sign-in and reminder emails). Neither is used for advertising.</P>

      <H>Sign-in</H>
      <P>We use passwordless “magic link” sign-in, so there’s no password to be stolen. Sessions are stored in a secure, http-only cookie.</P>

      <H>Your rights</H>
      <P>You can export everything you’ve created, or permanently delete your account and its data, any time — see Account.</P>
    </>
  );
}
