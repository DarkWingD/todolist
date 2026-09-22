import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc';

// Five minutes, not thirty: the portrait view shows a clock, today's times, doses
// and dinner, so a stale half-hour reads as wrong rather than merely old.
const REFRESH_MS = 5 * 60 * 1000;
const W = 1872;
const H = 1404;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(' ', ' ');
const fmtRange = (a: string | null, b: string | null) => (a ? `${a}${b ? ` – ${b}` : ''}` : '');
/**
 * Portuguese weekdays, hardcoded and indexed by getDay() (0 = Sunday).
 *
 * NOT from toLocaleDateString('pt-BR'): that returns the "-feira" forms, which
 * are ~250px wider at headline size and would silently regrow the header if
 * someone swapped this for Intl. The short forms are also what people actually
 * say ("na terça"), and they give a child seven distinguishable word-shapes —
 * segunda/terça/quarta/quinta/sexta-feira are five near-identical silhouettes.
 */
const PT_DAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** A person's colour as a low-alpha wash, for tinting the row they own. */
const tint = (hex: string | null | undefined, a: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'transparent';
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const shortDay = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' });
const whenLabel = (key: string, dayStart: Date) => {
  const d = new Date(`${key}T00:00:00`);
  const days = Math.round((d.getTime() - dayStart.getTime()) / 86_400_000);
  if (days < 7) return 'this week';
  if (days < 14) return 'next week';
  return `in ${Math.floor(days / 7)} weeks`;
};

const css = `
.wall{width:${W}px;height:${H}px;background:#f7f7f4;color:#1c1a17;font-family:Nunito,system-ui,sans-serif;font-weight:600;display:grid;grid-template-columns:600px 1fr 540px;grid-template-rows:112px 1fr;overflow:hidden;transform-origin:top left}
.wall *{box-sizing:border-box}
.wall .top{grid-column:1/-1;display:flex;align-items:flex-end;justify-content:space-between;padding:30px 44px 18px;border-bottom:4px solid #1c1a17}
.wall .date{font-family:Quicksand,system-ui,sans-serif;font-size:58px;font-weight:700;letter-spacing:-.01em;line-height:1}
.wall .date small{font-size:28px;color:#7a7a7a;font-weight:600;margin-left:14px}
.wall .tr{text-align:right;font-size:24px;color:#4a463d;line-height:1.25}
.wall .col{padding:26px 40px 30px;display:flex;flex-direction:column;gap:22px;min-height:0;overflow:hidden}
.wall .col+.col{border-left:3px solid #b8b8b8}
.wall h2{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#4a463d;padding-bottom:8px;border-bottom:2px solid #b8b8b8;margin:0 0 14px;display:flex;justify-content:space-between}
.wall h2 .n{font-weight:800;color:#7a7a7a;letter-spacing:0;text-transform:none}
.wall .who{display:flex;flex-direction:column;gap:10px}
.wall .who .row{display:flex;align-items:center;gap:16px;font-size:26px}
.wall .av{width:52px;height:52px;border-radius:50%;border:3px solid #1c1a17;display:grid;place-items:center;font-size:26px;flex:none;background:#fff}
.wall .av.kid{border-style:dashed}
.wall .who .name{font-weight:900;width:150px;flex:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wall .who .where{color:#4a463d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wall .who .off .where{color:#7a7a7a;font-style:italic}
.wall .who .dose{display:block;font-size:20px;font-weight:900;color:#1c1a17;font-style:normal;margin-top:2px}
.wall .who .where{display:flex;flex-direction:column;min-width:0}
.wall .list{display:flex;flex-direction:column;gap:12px}
.wall .item{display:flex;align-items:baseline;gap:16px;font-size:26px;line-height:1.25}
.wall .item .t{width:118px;flex:none;font-weight:900;font-variant-numeric:tabular-nums}
.wall .item .t.dim{color:#7a7a7a;font-weight:700}
.wall .who2{color:#7a7a7a;font-size:21px}
.wall .dinner{border:3px solid #1c1a17;border-radius:18px;padding:16px 20px;display:flex;align-items:center;gap:18px}
.wall .dinner .k{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#7a7a7a}
.wall .dinner .v{font-size:30px;font-weight:900}
.wall .dinner .s{font-size:20px;color:#7a7a7a;margin-left:auto}
.wall .todo{display:flex;flex-direction:column;gap:10px}
.wall .todo .row{display:flex;align-items:center;gap:14px;font-size:25px}
.wall .box{width:30px;height:30px;border:3px solid #1c1a17;border-radius:7px;flex:none;position:relative;background:#fff}
.wall .box.done{background:#111}
.wall .box.done::after{content:'';position:absolute;left:9px;top:3px;width:8px;height:14px;border:solid #f7f7f4;border-width:0 4px 4px 0;transform:rotate(45deg)}
.wall .row.done{color:#7a7a7a;text-decoration:line-through}
.wall .row.overdue .tag{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#4a463d;border:2px solid #3a3a3a;border-radius:6px;padding:1px 6px;margin-left:auto}
.wall .week{display:flex;flex-direction:column;flex:1;min-height:0;border:3px solid #1c1a17;border-radius:18px;overflow:hidden}
.wall .day{display:grid;grid-template-columns:150px 1fr;gap:0 18px;padding:12px 18px;border-bottom:2px solid #b8b8b8;flex:1;min-height:0;align-content:start}
.wall .day:last-child{border-bottom:0}
.wall .day.today{background:#e2e2e2}
.wall .day.off{background:repeating-linear-gradient(135deg,transparent 0 10px,#e8e8e8 10px 13px)}
.wall .day.today.off{background:#e2e2e2}
.wall .day .h{font-family:Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;line-height:1.1;display:flex;flex-direction:column;gap:4px}
.wall .day .h b{font-size:36px}
.wall .day.today .h b{background:#111;color:#f7f7f4;border-radius:999px;padding:4px 12px;align-self:flex-start}
.wall .offtag{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#7a7a7a;margin-top:6px}
.wall .items{display:flex;flex-wrap:wrap;gap:8px 10px;align-content:flex-start}
.wall .ev{font-size:21px;line-height:1.15;padding:8px 12px;border-radius:9px;border:2px solid #1c1a17;font-weight:800;background:#fff;max-width:100%}
.wall .ev.kid{border-style:dashed}
.wall .ev .tm{color:#7a7a7a;font-weight:700;font-size:17px;margin-left:8px;white-space:nowrap}
.wall .ev.task{border:0;background:transparent;font-weight:700;color:#4a463d;display:inline-flex;gap:8px;align-items:center;padding:8px 4px}
.wall .ev.task::before{content:'';width:18px;height:18px;border:2px solid #3a3a3a;border-radius:5px;flex:none;background:#fff}
.wall .ev.school{border:2px solid #6b4ea8;background:#efeaff;color:#3a2a63}
.wall .empty{color:#b8b8b8;font-size:20px;padding:8px 0}
.wall .legend{display:flex;gap:22px;font-size:17px;color:#7a7a7a;align-items:center;flex-wrap:wrap}
.wall .sw{display:inline-block;width:26px;height:16px;border:2px solid #1c1a17;border-radius:4px;vertical-align:middle;margin-right:6px;background:#fff}
.wall .sw.dash{border-style:dashed}
.wall .sw.hatch{background:repeating-linear-gradient(135deg,transparent 0 5px,#e2e2e2 5px 7px);border-color:#b8b8b8}
.wall .up{display:flex;flex-direction:column;gap:12px}
.wall .up .row{display:grid;grid-template-columns:118px 1fr;gap:14px;font-size:23px;line-height:1.25;align-items:baseline}
.wall .up .d{font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
.wall .up .d small{display:block;font-size:14px;color:#7a7a7a;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.wall .up .w{color:#4a463d}
.wall .up .w b{color:#1c1a17;font-weight:900}
.wall .kidhead{display:flex;align-items:center;gap:12px;font-size:24px;font-weight:900;margin-top:4px}
.wall .kidhead .av{width:40px;height:40px;font-size:20px;border-style:dashed}
.wall .chores{display:flex;flex-direction:column;gap:9px;margin-top:10px}
.wall .chores .row{display:flex;align-items:center;gap:14px;font-size:24px}
.wall .foot{margin-top:auto;font-size:16px;color:#7a7a7a;display:flex;justify-content:space-between}
.wall .err{grid-column:1/-1;display:grid;place-items:center;font-size:40px;color:#4a463d;text-align:center;padding:80px}
`;

// Portrait, kid-facing week-only view (?view=week). Fluid to the viewport so it
// fills whatever tall screen it's mounted on; big emoji lead each activity.
/**
 * Portrait kitchen display (?view=week). Answers two questions, in this order:
 * WHERE IS EVERYONE, and WHAT IS ON TODAY. The rest of the week is a footnote.
 *
 * Rules this layout is built on, learned from two reviews of the version before it:
 *  - Today owns ~60% of the page. It is a zone, not a tinted row in a list.
 *  - People are the subject, so they are rows of their own — an adult with no work
 *    week still appears, saying so, rather than silently vanishing.
 *  - Nothing ships below ~2.2vh or below 4.5:1 contrast. Anything that cannot earn
 *    that size is cut, not shrunk — this is read from 2-3m, in a bright kitchen.
 *  - Structure is carried by black rules and dashed/hatched borders (inherited from
 *    the landscape board), not pale tints, which collapse under glare.
 *  - Colour encodes WHO, never what kind of thing it is.
 *  - An emoji is either the content (9vh, today) or punctuation (3vh, week strip).
 *  - Quicksand only ships at <=700: it is loaded at 500/600/700, so 800 would be
 *    faux-bolded. Nunito carries every heavier weight.
 */
const portraitCss = `
/* Unit derived from the NARROW axis too: sizing purely in vh let type grow with
   height while the columns it had to fit were governed by width. */
.wallp{--u:min(1vh,1.5vw);background:#f4f1e8;height:100dvh;box-sizing:border-box;padding:calc(2.4*var(--u));font-family:Nunito,system-ui,sans-serif;color:#1c1a17;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:calc(1.2*var(--u))}
/* FOUR type steps, not eleven. Eleven sizes spanning 1.4x are one size at 3m. */
.wallp .s1{font-size:calc(5.2*var(--u))}
.wallp .s2{font-size:calc(3.4*var(--u))}
.wallp .s3{font-size:calc(2.5*var(--u))}
.wallp .s4{font-size:calc(2*var(--u))}
.wallp .perr{grid-row:1/-1;display:grid;place-items:center;font-size:calc(3.4*var(--u));font-weight:700;text-align:center;padding:6vw;line-height:1.5;color:#4a463d}
/* Labels differ by COLOUR, not size: a zone head is ink, a field label is grey. */
.wallp .lab{font-size:calc(2*var(--u));font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6e6858}
.wallp .lab.zone{color:#1c1a17}
/* Tightened to the landscape board's pitch and darkened: at 1.19:1 the old hatch
   was a blank rectangle at 3m, so "day off" carried no information at all. */
.wallp .hatch{background:repeating-linear-gradient(135deg,transparent 0 calc(.5*var(--u)),#d9d5c9 calc(.5*var(--u)) calc(.7*var(--u)))}

/* ── header ── */
.wallp .ph{display:flex;align-items:flex-start;justify-content:space-between;gap:calc(2.4*var(--u));padding-bottom:calc(1*var(--u));border-bottom:calc(.35*var(--u)) solid #1c1a17}
.wallp .ph .d{display:flex;flex-direction:column;min-width:0;line-height:1.05}
/* The date as a tear-off numeral: it anchors the page, balances the headline and
   fills the right half, which was previously ~900px of nothing. */
.wallp .ph .num{display:flex;flex-direction:column;align-items:flex-end;line-height:.82;flex:none}
.wallp .ph .num b{font-family:Quicksand,system-ui,sans-serif;font-size:calc(11*var(--u));font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.04em}
/* Nunito 800, not Quicksand 700: measured, the old headline's stems were 31%
   THINNER than the 800-weight subhead beneath it. Quicksand ships no 800. */
.wallp .ph .d b{font-size:calc(5.2*var(--u));font-weight:800;letter-spacing:-.025em;white-space:nowrap}
.wallp .ph .d .mo{font-size:calc(2.5*var(--u));font-weight:600;color:#4a463d;white-space:nowrap}
/* One step down the scale and one weight down, but FULL ink: size and weight
   carry the rank, colour carries identity. A greyed word would read as a
   footnote about the English rather than a word in its own right. Lowercase is
   correct Portuguese, and doubles as the cheapest signal that these are two
   different systems — so no separator, italic, flag or accent colour is needed. */
.wallp .ph .d .pt{font-size:calc(3.4*var(--u));font-weight:700;color:#1c1a17;letter-spacing:-.01em;line-height:1.02;margin-top:calc(.2*var(--u));white-space:nowrap}
.wallp .ph .clock{font-size:calc(2.5*var(--u));font-weight:600;color:#4a463d;font-variant-numeric:tabular-nums;white-space:nowrap}

/* ── who is where ── */
.wallp .who{display:flex;flex-direction:column;gap:calc(.8*var(--u))}
.wallp .who .r{position:relative;display:grid;grid-template-columns:calc(6.4*var(--u)) 1fr auto;gap:calc(1.6*var(--u));align-items:center;padding:calc(.8*var(--u)) calc(1.2*var(--u));border-radius:calc(1.2*var(--u))}
/* A tint with enough area to read at 3m, plus a rail in the same hue: colour now
   says WHO as a field rather than as a 18px flag noticed by nobody. */
.wallp .who .r::before{content:'';position:absolute;left:0;top:0;bottom:0;width:calc(.8*var(--u));background:var(--p,transparent);border-radius:calc(1.2*var(--u)) 0 0 calc(1.2*var(--u))}
.wallp .who .av{width:calc(6.4*var(--u));height:calc(6.4*var(--u));border-radius:50%;border:calc(.35*var(--u)) solid #1c1a17;display:grid;place-items:center;font-size:calc(3.4*var(--u));background:#fffdf7}
.wallp .who .av.kid{border-style:dashed}
.wallp .who .tx{min-width:0;display:flex;flex-direction:column;line-height:1.14}
.wallp .who .pl{font-size:calc(3.4*var(--u));font-weight:800;color:#1c1a17;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wallp .who .nm{font-size:calc(2.5*var(--u));font-weight:600;color:#4a463d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Hours right-align to a second spine, so the page has two vertical edges
   instead of one column of ink down the left third of the sheet. */
.wallp .who .hrs{font-size:calc(2.5*var(--u));font-weight:600;color:#4a463d;font-variant-numeric:tabular-nums;white-space:nowrap}
.wallp .who .dose{font-size:calc(2.5*var(--u));font-weight:800;color:#1c1a17}
.wallp .who .r.unset .pl{color:#6e6858;font-style:italic;font-weight:600}

/* ── today ── */
.wallp .tod{min-height:0;display:flex;flex-direction:column;gap:calc(.8*var(--u));padding-top:calc(1.2*var(--u));border-top:calc(.15*var(--u)) solid #8a8579;overflow:hidden}
.wallp .tod .it{display:grid;grid-template-columns:calc(8*var(--u)) 1fr auto;gap:calc(1.2*var(--u));align-items:center;min-width:0}
/* The glyph slot ALWAYS exists, empty or not: rendering it conditionally put a
   193px step between two titles in the same list. */
.wallp .tod .gl{width:calc(6.4*var(--u));height:calc(6.4*var(--u));border-radius:50%;display:grid;place-items:center;font-size:calc(3.4*var(--u));justify-self:center}
/* An emoji here is framed in the page's own circle, so it stops being the
   loudest, most chromatic object on the sheet and joins the vocabulary. */
.wallp .tod .gl.has{border:calc(.35*var(--u)) solid #1c1a17;background:#fffdf7}
.wallp .tod .tx{min-width:0;display:flex;flex-direction:column;line-height:1.12}
.wallp .tod .tx b{font-size:calc(3.4*var(--u));font-weight:800;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wallp .tod .tx .m{font-size:calc(2.5*var(--u));font-weight:600;color:#4a463d;font-variant-numeric:tabular-nums}
.wallp .tod .it.done{opacity:.4}
.wallp .tod .more{font-size:calc(2*var(--u));font-weight:800;color:#6e6858}
.wallp .tod .next{display:flex;flex-direction:column;gap:calc(.8*var(--u));margin-top:calc(.4*var(--u))}
.wallp .bar{display:flex;align-items:baseline;gap:calc(1.2*var(--u));border-top:calc(.15*var(--u)) solid #8a8579;padding-top:calc(1.2*var(--u));margin-top:auto}
.wallp .bar .v{font-size:calc(3.4*var(--u));font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wallp .bar .v.none{font-weight:600;color:#4a463d}
.wallp .bar .s{margin-left:auto;font-size:calc(2*var(--u));font-weight:600;color:#6e6858;white-space:nowrap}

/* ── rest of the week ── */
.wallp .rest{border-top:calc(.35*var(--u)) solid #1c1a17;padding-top:calc(1.2*var(--u));display:flex;flex-direction:column;min-height:0}
.wallp .rest .rows{display:flex;flex-direction:column;margin-top:calc(.8*var(--u))}
.wallp .rest .rw{display:grid;grid-template-columns:calc(1.2*var(--u)) calc(10*var(--u)) 1fr auto;gap:calc(1.2*var(--u));align-items:center;flex:0 0 auto;min-height:calc(6*var(--u));padding:calc(.4*var(--u)) 0}
/* Presence: a track always renders, so the colour reads as a column with a
   visible BREAK on the day the routine changes. An absent bar cannot be seen. */
.wallp .rest .pres{display:flex;flex-direction:column;gap:calc(.2*var(--u));height:calc(4.6*var(--u));background:#e2ddd0;overflow:hidden}
.wallp .rest .pres i{flex:1;display:block}
.wallp .rest .dt{display:flex;align-items:baseline;gap:calc(.8*var(--u));white-space:nowrap}
.wallp .rest .dt span{font-size:calc(2*var(--u));font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#6e6858}
.wallp .rest .dt b{font-family:Quicksand,system-ui,sans-serif;font-size:calc(3.4*var(--u));font-weight:700;font-variant-numeric:tabular-nums}
.wallp .rest .ch{display:flex;align-items:center;gap:calc(1.6*var(--u));min-width:0;overflow:hidden}
.wallp .rest .c{display:inline-flex;align-items:center;gap:calc(.8*var(--u));font-size:calc(2.5*var(--u));font-weight:600;min-width:0}
.wallp .rest .c.soon{font-weight:800}
/* Reserved, centred slot: without a width the glyphs landed at a different x on
   every row (and a trailing ♻️ sat in a different place again). */
.wallp .rest .c em{font-size:calc(2.7*var(--u));font-style:normal;line-height:1;flex:none;width:calc(3*var(--u));text-align:center}
.wallp .rest .c .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wallp .rest .more{font-size:calc(2*var(--u));font-weight:800;color:#6e6858;flex:none}
.wallp .rest .none{font-size:calc(2*var(--u));font-weight:600;color:#6e6858}
/* The sheet is bracketed at BOTH ends: it opened with a 7px rule and closed with
   nothing, so the page read as sliding off the bottom of the screen. */
.wallp .foot{border-top:calc(.35*var(--u)) solid #1c1a17;margin-top:calc(1.2*var(--u))}
.wallp.quiet .rest .rw{flex:0 0 auto}
`;

/**
 * The wall display: a fixed 1872×1404 page in black, white and greys, scaled
 * to whatever window shows it, refreshed every half hour. Reached by
 * /wall?token=… with no sign-in; the token is the household's.
 */
export function WallScreen({ token, view }: { token: string; view?: string }) {
  const [tick, setTick] = useState(0);
  const dayStart = startOfToday();
  const { data, error, isLoading } = trpc.wall.snapshot.useQuery(
    // No weekStartsOn: the display has no preference of its own, so the
    // household's own setting decides.
    // dayKey travels with dayStart so the server names the day in THIS display's
    // timezone; without it a UTC server calls an Australian Tuesday "Monday".
    {
      token,
      dayStart: dayStart.toISOString(),
      dayKey: `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`,
    },
    { refetchInterval: REFRESH_MS, refetchOnWindowFocus: false },
  );
  // Re-render at midnight so "today" moves without a reload.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const today = new Date();
  const dateLine = today.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const weekLabel = (() => {
    if (!data) return '';
    const a = data.week[0]!.date;
    const b = data.week[6]!.date;
    const f = (k: string) =>
      new Date(`${k}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `${f(a)} – ${f(b)}`;
  })();

  // Portrait kitchen display: who is where, then what is on today, then whatever
  // breaks the routine for the rest of the week. See portraitCss for the rules.
  if (view === 'week') {
    const clock = today.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    // A glyph is only worth the big slot when someone actually chose it: a 140px
    // pushpin or clipboard fallback is a large picture of nothing.
    type Tile = { key: string; glyph?: string; title: string; meta?: string; done?: boolean };
    const todayTiles: Tile[] = data
      ? [
          ...data.today.birthdays.map((b) => ({
            key: `b${b.id}`,
            glyph: '🎂',
            title: b.name,
            meta: b.age ? `turns ${b.age}` : 'birthday',
          })),
          ...data.today.events.map((e) => ({
            key: `e${e.id}`,
            ...(e.emoji ? { glyph: e.emoji } : {}),
            title: e.title,
            meta: [e.time ? fmtTime(e.time) : 'All day', e.who].filter(Boolean).join(' · '),
          })),
          ...data.today.due.map((t) => ({
            key: `t${t.id}`,
            title: t.title,
            ...(t.overdue && !t.done ? { meta: 'overdue' } : {}),
            done: t.done,
          })),
        ]
      : [];
    const SHOWN = 4;
    // Only days still to come; today is the whole top of the screen already.
    const ahead = data ? data.week.slice(data.week.findIndex((d) => d.isToday) + 1) : [];
    // When today is quiet, the screen shows what's next instead of a large
    // sentence saying nothing. An empty state should cost less space, not more.
    const nextUp = ahead.find((d) => d.events.length > 0 || d.birthdays.length > 0);

    return (
      <div className={'wallp' + (todayTiles.length === 0 ? ' quiet' : '')}>
        <style>{portraitCss}</style>
        {error ? (
          <div className="perr">
            This link no longer works. Get a new one from Family → Wall display.
          </div>
        ) : isLoading || !data ? (
          <div className="perr">Loading…</div>
        ) : (
          <>
            <div className="ph">
              <span className="d">
                <b>{today.toLocaleDateString([], { weekday: 'long' })}</b>
                <span className="pt" lang="pt">{PT_DAYS[today.getDay()]}</span>
                <span className="mo">{today.toLocaleDateString([], { month: 'long' })}</span>
              </span>
              <span className="num">
                <b>{today.getDate()}</b>
                <span className="clock">{clock}</span>
              </span>
            </div>

            <div className="who">
              {data.grownUps.map((a) => (
                <div
                  key={a.id}
                  className={'r' + (!a.hasSchedule ? ' unset' : a.off ? ' hatch' : '')}
                  style={
                    {
                      '--p': a.avatarColor,
                      background: a.off || !a.hasSchedule ? undefined : tint(a.avatarColor, 0.09),
                    } as CSSProperties
                  }
                >
                  <span className="av" style={{ background: a.avatarColor }}>
                    {a.avatarEmoji}
                  </span>
                  <span className="tx">
                    <span className="pl">
                      {!a.hasSchedule ? 'Work week not set' : a.off ? 'Home today' : a.place}
                    </span>
                    <span className="nm">{a.name.split(' ')[0]}</span>
                  </span>
                  <span className="hrs">
                    {a.hasSchedule && !a.off && a.startTime ? fmtRange(a.startTime, a.endTime) : ''}
                  </span>
                </div>
              ))}
              {data.kids.map((k) => (
                <div
                  key={k.id}
                  className={'r' + (k.place ? '' : ' hatch')}
                  style={
                    {
                      '--p': k.color ?? 'transparent',
                      background: k.place ? tint(k.color, 0.09) : undefined,
                    } as CSSProperties
                  }
                >
                  <span className="av kid" style={{ background: k.color ?? '#fff' }}>
                    {k.emojiIcon}
                  </span>
                  <span className="tx">
                    <span className="pl">{k.place ?? (k.offReason || 'Home today')}</span>
                    <span className="nm">{k.name.split(' ')[0]}</span>
                    {k.doses.map((d) => (
                      <span className="dose" key={d.givenAt}>
                        💊 {d.medicine} {fmtTime(d.givenAt)}
                        {d.nextFrom ? ` · next from ${fmtTime(d.nextFrom)}` : ''}
                      </span>
                    ))}
                  </span>
                  <span className="hrs">
                    {k.place && k.startTime ? fmtRange(k.startTime, k.endTime) : ''}
                  </span>
                </div>
              ))}
            </div>

            <div className="tod">
              {todayTiles.slice(0, SHOWN).map((t) => (
                <div key={t.key} className={'it' + (t.done ? ' done' : '')}>
                  <span className={'gl' + (t.glyph ? ' has' : '')}>{t.glyph ?? ''}</span>
                  <span className="tx">
                    <b>{t.title}</b>
                    {t.meta ? <span className="m">{t.meta}</span> : null}
                  </span>
                </div>
              ))}
              {todayTiles.length > SHOWN ? (
                <span className="more">+{todayTiles.length - SHOWN} more today</span>
              ) : null}
              {todayTiles.length === 0 && nextUp ? (
                <div className="next">
                  <span className="lab">
                    {/* "Tomorrow" beats naming the weekday: at 9pm on Tuesday nobody
                        wants to work out that Wednesday is the next day. */}
                    {nextUp === ahead[0]
                      ? `Tomorrow (${new Date(`${nextUp.date}T00:00:00`).toLocaleDateString([], { weekday: 'long' })})`
                      : `Next · ${new Date(`${nextUp.date}T00:00:00`).toLocaleDateString([], { weekday: 'long' })}`}
                  </span>
                  {[...nextUp.birthdays.map((b) => ({ k: b.id, g: '🎂', t: b.name, m: 'birthday' })),
                    ...nextUp.events.map((e) => ({
                      k: e.id,
                      g: e.emoji || '',
                      t: e.title,
                      m: e.time ? fmtTime(e.time) : 'All day',
                    })),
                    ...nextUp.tasks.map((t) => ({ k: t.id, g: '', t: t.title, m: '' }))]
                    .slice(0, 3)
                    .map((n) => (
                      <div key={n.k} className="it">
                        <span className={'gl' + (n.g ? ' has' : '')}>{n.g}</span>
                        <span className="tx">
                          <b>{n.t}</b>
                          <span className="m">{n.m}</span>
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
              {/* Always rendered: "what's for dinner" is the question this room asks,
                  and "not planned" is the most actionable answer it can give. */}
              <div className="bar">
                <span className="lab">Dinner</span>
                {data.today.dinner ? (
                  <>
                    <span className="v">{data.today.dinner.name}</span>
                    <span className="s">
                      {data.today.dinner.leftover
                        ? `Leftovers · night ${data.today.dinner.night}`
                        : 'Cooking tonight'}
                    </span>
                  </>
                ) : (
                  <span className="v none">Not planned yet</span>
                )}
              </div>
            </div>

            {ahead.length > 0 && (
              <div className="rest">
                <span className="lab zone">Rest of the week</span>
                <div className="rows">
                  {ahead.map((d, i) => {
                    const dt = new Date(`${d.date}T00:00:00`);
                    const weekend = dt.getDay() === 0 || dt.getDay() === 6;
                    const chips = [
                      ...d.birthdays.map((b) => ({ k: `b${b.id}`, e: '🎂', t: b.name })),
                      ...d.events.map((e) => ({ k: `e${e.id}`, e: e.emoji || '', t: e.title })),
                      // A parent not working at the weekend is the calendar, not news.
                      ...(weekend ? [] : d.off.map((o) => ({ k: `o${o.id}`, e: o.avatarEmoji, t: `${o.name} off` }))),
                      ...d.tasks.map((t) => ({ k: `t${t.id}`, e: '', t: t.title })),
                    ];
                    return (
                      <div key={d.date} className="rw">
                        <span className="pres">
                          {d.school.map((s) => (
                            <i
                              key={s.id}
                              style={{
                                background:
                                  data.kids.find((k) => s.id.startsWith(k.id))?.color ?? '#111',
                              }}
                            />
                          ))}
                        </span>
                        <span className="dt">
                          <span>{dt.toLocaleDateString([], { weekday: 'short' })}</span>
                          <b>{dt.getDate()}</b>
                        </span>
                        <span className="ch">
                          {chips.slice(0, 2).map((c) => (
                            // Weight, not a border, carries "soon" — and only for the
                            // next couple of days, so Saturday can't outshout tomorrow.
                            <span key={c.k} className={'c' + (i < 2 ? ' soon' : '')}>
                              <em>{c.e}</em>
                              <span className="t">{c.t}</span>
                            </span>
                          ))}
                          {chips.length > 2 ? (
                            <span className="more">+{chips.length - 2}</span>
                          ) : null}
                          {chips.length === 0 ? <span className="none">—</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="foot" />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    // Centred rather than pinned to the corner: a kitchen tablet is rarely 4:3,
    // and the board sat top-left with all the black gathered on one side.
    <div
      style={{
        background: '#111',
        minHeight: '100dvh',
        overflow: 'hidden',
        display: 'grid',
        placeContent: 'center',
      }}
    >
      <style>{css}</style>
      <div
        className="wall"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        {error ? (
          // Nobody is sitting at the fridge to read "UNAUTHORIZED", and there
          // is no sign-in here to act on it either — say what to do instead.
          <div className="err">
            This link no longer works. Get a new one from Family → Wall display.
          </div>
        ) : isLoading || !data ? (
          <div className="err">Loading…</div>
        ) : (
          <>
            <div className="top">
              <div className="date">
                {dateLine}
                <small>{data.household}</small>
              </div>
              <div className="tr">
                {data.today.dinner ? (
                  <>
                    <b>Dinner:</b> {data.today.dinner.name}
                    {data.today.dinner.leftover ? ' (leftovers)' : ''}
                  </>
                ) : (
                  'No dinner planned yet'
                )}
                <br />
                {data.today.events.length} on today · {data.today.due.filter((d) => !d.done).length}{' '}
                to do
              </div>
            </div>

            <div className="col">
              <div>
                <h2>Where everyone is</h2>
                <div className="who">
                  {/* Unscheduled adults are surfaced on the portrait view, not here:
                      this board's "Day off" wording would misreport them. */}
                  {data.grownUps
                    .filter((a) => a.hasSchedule)
                    .map((a) => (
                    <div key={a.id} className={`row${a.off ? ' off' : ''}`}>
                      <span className="av">{a.avatarEmoji}</span>
                      <span className="name">{a.name.split(' ')[0]}</span>
                      <span className="where">
                        {a.off
                          ? 'Day off'
                          : `${a.place}${a.startTime ? ` · ${fmtRange(a.startTime, a.endTime)}` : ''}`}
                      </span>
                    </div>
                  ))}
                  {data.kids.map((k) => (
                    <div key={k.id} className={`row${k.offReason || !k.place ? ' off' : ''}`}>
                      <span className="av kid">{k.emojiIcon}</span>
                      <span className="name">{k.name.split(' ')[0]}</span>
                      <span className="where">
                        {k.offReason
                          ? k.offReason
                          : k.place
                            ? `${k.place}${k.startTime ? ` · ${fmtRange(k.startTime, k.endTime)}` : ''}`
                            : 'Nothing on today'}
                        {k.doses.map((d) => (
                          <span key={d.medicine} className="dose">
                            💊 {d.medicine} {fmtTime(d.givenAt)}
                            {d.nextFrom
                              ? new Date(d.nextFrom) <= new Date()
                                ? ' · next OK now'
                                : ` · next from ${fmtTime(d.nextFrom)}`
                              : ''}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                  {data.grownUps.length === 0 && data.kids.length === 0 && (
                    <div className="empty">Set work weeks and kids' weeks under Family.</div>
                  )}
                </div>
              </div>
              <div>
                <h2>On today</h2>
                <div className="list">
                  {data.today.birthdays.map((b) => (
                    <div key={b.id} className="item">
                      <span className="t dim">All day</span>
                      <span>
                        🎂 {b.name}
                        {b.age ? ` turns ${b.age}` : ''}
                      </span>
                    </div>
                  ))}
                  {data.today.events.map((e) => (
                    <div key={e.id} className="item">
                      <span className={`t${e.time ? '' : ' dim'}`}>
                        {e.time ? fmtTime(e.time) : 'All day'}
                      </span>
                      <span>
                        {e.emoji ? `${e.emoji} ` : ''}
                        {e.title}
                        {e.who ? <span className="who2"> · {e.who}</span> : null}
                      </span>
                    </div>
                  ))}
                  {data.today.events.length === 0 && data.today.birthdays.length === 0 && (
                    <div className="empty">Nothing on. Enjoy it.</div>
                  )}
                </div>
              </div>
              {data.today.dinner && (
                <div className="dinner">
                  <span className="k">Dinner</span>
                  <span className="v">{data.today.dinner.name}</span>
                  <span className="s">
                    {data.today.dinner.leftover
                      ? `Leftovers, night ${data.today.dinner.night}`
                      : 'Cooking tonight'}
                  </span>
                </div>
              )}
              <div>
                <h2>
                  Due today{' '}
                  <span className="n">{data.today.due.filter((d) => !d.done).length}</span>
                </h2>
                <div className="todo">
                  {data.today.due.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      className={`row${t.done ? ' done' : ''}${t.overdue ? ' overdue' : ''}`}
                    >
                      <span className={`box${t.done ? ' done' : ''}`} />
                      {t.title}
                      {t.overdue && !t.done && <span className="tag">overdue</span>}
                    </div>
                  ))}
                  {data.today.due.length === 0 && <div className="empty">All clear.</div>}
                </div>
              </div>
            </div>

            <div className="col">
              <h2>
                This week <span className="n">{weekLabel}</span>
              </h2>
              <div className="week">
                {data.week.map((d) => (
                  <div
                    key={d.date}
                    className={`day${d.isToday ? ' today' : ''}${d.off.length ? ' off' : ''}`}
                  >
                    <div className="h">
                      <span>
                        {new Date(`${d.date}T00:00:00`).toLocaleDateString([], {
                          weekday: 'short',
                        })}
                      </span>
                      <b>{new Date(`${d.date}T00:00:00`).getDate()}</b>
                      {d.off.map((a) => (
                        <span key={a.id} className="offtag">
                          {a.avatarEmoji} {a.name} off
                        </span>
                      ))}
                    </div>
                    <div className="items">
                      {d.school.map((s) => (
                        <span key={s.id} className="ev school">
                          {s.emoji} {s.name} · {s.place}
                        </span>
                      ))}
                      {d.birthdays.map((b) => (
                        <span key={b.id} className="ev">
                          🎂 {b.name}
                        </span>
                      ))}
                      {d.events.map((e) => (
                        <span key={e.id} className={`ev${e.forKid ? ' kid' : ''}`}>
                          {e.emoji ? `${e.emoji} ` : ''}
                          {e.title}
                          {(e.time || e.who) && (
                            <span className="tm">
                              {[e.time ? fmtTime(e.time) : null, e.who].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      ))}
                      {d.tasks.map((t) => (
                        <span key={t.id} className="ev task">
                          {t.title}
                        </span>
                      ))}
                      {d.events.length === 0 &&
                        d.tasks.length === 0 &&
                        d.birthdays.length === 0 &&
                        d.school.length === 0 && <span className="empty">—</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="legend">
                <span>
                  <span className="sw" />
                  Event
                </span>
                <span>
                  <span className="sw dash" />
                  Kids' event
                </span>
                <span>
                  <span className="sw hatch" />
                  Grown-up's day off
                </span>
                <span>☐ Task due</span>
              </div>
            </div>

            <div className="col">
              <div>
                <h2>
                  Coming up for the kids <span className="n">3 weeks</span>
                </h2>
                <div className="up">
                  {data.kidsAhead.map((e) => (
                    <div key={e.id} className="row">
                      <span className="d">
                        {shortDay(e.date)}
                        <small>{whenLabel(e.date, dayStart)}</small>
                      </span>
                      <span className="w">
                        <b>{e.title}</b>
                        {e.who ? ` · ${e.who}` : ''}
                        {e.time ? ` · ${fmtTime(e.time)}` : ''}
                        {e.endDate && e.endDate !== e.date ? ` · until ${shortDay(e.endDate)}` : ''}
                      </span>
                    </div>
                  ))}
                  {data.kidsAhead.length === 0 && <div className="empty">Nothing booked in.</div>}
                </div>
              </div>
              {data.kidJobs.map((k) => (
                <div key={k.id}>
                  <div className="kidhead">
                    <span className="av kid">{k.avatarEmoji}</span>
                    {k.name.split(' ')[0]}'s jobs
                  </div>
                  <div className="chores">
                    {k.jobs.map((j) => (
                      <div key={j.id} className="row">
                        <span className="box" />
                        {j.title}
                      </div>
                    ))}
                    {k.jobs.length === 0 && <div className="empty">Nothing to do. Lucky.</div>}
                  </div>
                </div>
              ))}
              <div className="foot">
                <span>
                  Updated{' '}
                  {new Date(data.generatedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span>Refreshes every {Math.round(REFRESH_MS / 60000)} min</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
