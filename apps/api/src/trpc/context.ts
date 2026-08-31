import { auth } from '../auth.js';

export async function createContext({ req }: { req: Request }) {
  const sess = await auth.api.getSession({ headers: req.headers });
  return {
    user: sess?.user ?? null,
    session: sess?.session ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
