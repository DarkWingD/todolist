import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetch a public web page for recipe import, and nothing else.
 *
 * The server fetches on the user's behalf, which makes it a way into the home
 * network if a link points there: "http://192.168.1.1/" or a name that resolves
 * to 127.0.0.1. So every hop, redirects included, is resolved first and refused
 * if any address it resolves to is private, loopback, link-local or otherwise
 * not on the public internet. Bodies are capped at 3 MB and requests at 10 s.
 *
 * What is left is DNS rebinding between the check and the connection; for a
 * family app behind sign-in, fetching recipe pages, that is accepted.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;

export class PageError extends Error {}

function privateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function privateV6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) return privateV4(v.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !privateV4(ip);
  if (kind === 6) return !privateV6(ip);
  return false;
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new PageError('Only web links can be imported.');
  if (url.username || url.password) throw new PageError('That link is not a plain web page.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new PageError("That site couldn't be found.");
  // A network-level blocker (the home router's content filter) answers 0.0.0.0.
  if (addresses.some((a) => a.address === '0.0.0.0' || a.address === '::'))
    throw new PageError('That site is blocked on this network. Paste the recipe in instead.');
  if (!addresses.every((a) => isPublicAddress(a.address)))
    throw new PageError('That link points somewhere private.');
}

/** The page's HTML, following redirects safely. */
export async function fetchPage(input: string): Promise<{ url: string; html: string }> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        // Some recipe sites refuse requests that do not look like a browser.
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Sorted-recipe-import',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
    }).catch(() => {
      throw new PageError("That page couldn't be reached.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    // Some sites (taste.com.au, allrecipes) refuse anything that is not a person
    // in a browser. That is their call; the recipe can still be pasted in.
    if ([401, 402, 403, 429].includes(res.status))
      throw new PageError(
        'That site doesn\'t allow recipes to be read automatically. Copy the recipe and use "Paste a recipe" instead.',
      );
    if (res.status === 404) throw new PageError("That page doesn't exist any more.");
    if (!res.ok) throw new PageError(`That page answered ${res.status}.`);
    const type = res.headers.get('content-type') ?? '';
    if (type && !/html|xml|text\/plain/i.test(type))
      throw new PageError("That link isn't a web page.");
    const reader = res.body?.getReader();
    if (!reader) throw new PageError('That page was empty.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return { url: url.href, html: Buffer.concat(chunks).toString('utf8') };
  }
  throw new PageError('That link redirects too many times.');
}
