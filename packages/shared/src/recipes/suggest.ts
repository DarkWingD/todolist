import { ingredientLines, parseIngredient } from './ingredients.js';
import { perishableOf } from './perishables.js';

/**
 * "Suggest the week": fill the empty nights from meals the family already has,
 * favouring the ones that go together.
 *
 * Plain scoring, no model. Every candidate meal is scored for each empty night:
 * favourites up, things not had for a while up, things had in the last week
 * down, the same main as the night before down, and, the part Dan asked for,
 * up for each perishable it shares with a meal already in the week, but only if
 * the two nights are close enough for that bunch of coriander to survive.
 * Nights are filled one at a time, so the second pick can share with the first.
 *
 * A seed makes "shuffle" give a different, but repeatable, week.
 */

export interface CatalogMeal {
  id: string;
  name: string;
  ingredients: string | null;
  isFavourite: boolean;
  /** The last date it was planned, "YYYY-MM-DD", or null. */
  lastCooked: string | null;
}

export interface Proposal {
  date: string;
  mealId: string;
  name: string;
  /** Why this one, for the preview: "uses up the coriander from Tue". */
  reasons: string[];
}

const DAY_MS = 86_400_000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const daysApart = (a: string, b: string) => Math.round(Math.abs(ms(a) - ms(b)) / DAY_MS);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (d: string) => DAY[new Date(`${d}T00:00:00Z`).getUTCDay()]!;

const MAINS = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'salmon',
  'fish',
  'prawn',
  'tofu',
  'lentil',
  'chickpea',
  'egg',
  'sausage',
  'mince',
  'bean',
];

interface Prepared {
  meal: CatalogMeal;
  perishables: Map<string, string>; // key -> label
  main: string | null;
}

function prepare(meal: CatalogMeal): Prepared {
  const perishables = new Map<string, string>();
  let main: string | null = null;
  for (const line of ingredientLines(meal.ingredients)) {
    const ing = parseIngredient(line);
    if (perishableOf(ing.key)) perishables.set(ing.key, ing.key);
    if (!main) main = MAINS.find((m) => ing.key.includes(m)) ?? null;
  }
  if (!main) main = MAINS.find((m) => meal.name.toLowerCase().includes(m)) ?? null;
  return { meal, perishables, main };
}

/** A small, seedable random number generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function suggestWeek(opts: {
  catalog: CatalogMeal[];
  /** Nights already planned this week (cook dates and their meals). */
  planned: { date: string; mealId: string }[];
  /** The nights to fill, in order. */
  empty: string[];
  seed?: number;
}): Proposal[] {
  const random = rng(opts.seed ?? 1);
  const all = opts.catalog.map(prepare);
  const byId = new Map(all.map((p) => [p.meal.id, p]));
  const week: { date: string; p: Prepared }[] = opts.planned
    .map((x) => ({ date: x.date, p: byId.get(x.mealId)! }))
    .filter((x) => x.p);
  const used = new Set(week.map((x) => x.p.meal.id));
  const out: Proposal[] = [];

  for (const date of opts.empty) {
    let best: { p: Prepared; score: number; reasons: string[] } | null = null;
    for (const p of all) {
      if (used.has(p.meal.id)) continue;
      let score = 1;
      const reasons: string[] = [];
      if (p.meal.isFavourite) {
        score += 1.5;
        reasons.push('a favourite');
      }
      if (p.meal.lastCooked) {
        const since = daysApart(p.meal.lastCooked, date);
        if (since < 7) score -= 2;
        else if (since >= 21) {
          score += 1;
          reasons.push(`not had in ${Math.floor(since / 7)} weeks`);
        } else if (since >= 14) score += 0.5;
      } else score += 0.3;
      if (!p.meal.ingredients) score -= 0.4;

      // Shared perishables with nights already in the week, close enough to share.
      let shared = 0;
      const sharedWith: string[] = [];
      for (const other of week) {
        for (const [key, label] of p.perishables) {
          if (!other.p.perishables.has(key)) continue;
          if (daysApart(other.date, date) > perishableOf(key)!.days) continue;
          shared += 1;
          sharedWith.push(`${label} from ${dayName(other.date)}`);
        }
      }
      if (shared > 0) {
        score += Math.min(3, shared * 1.2);
        reasons.unshift(`uses up the ${sharedWith.slice(0, 2).join(' and the ')}`);
      }

      // Not the same main two nights running.
      const neighbour = week.find((w) => daysApart(w.date, date) === 1);
      if (p.main && neighbour && neighbour.p.main === p.main) score -= 1;

      score += random() * 0.6;
      if (!best || score > best.score) best = { p, score, reasons };
    }
    if (!best) break;
    used.add(best.p.meal.id);
    week.push({ date, p: best.p });
    out.push({ date, mealId: best.p.meal.id, name: best.p.meal.name, reasons: best.reasons });
  }
  return out;
}

/** Perishables this week's cooks share, for the "shared this week" line. */
export function sharedThisWeek(
  cooks: { date: string; mealName: string; ingredients: string | null }[],
) {
  const seen = new Map<string, { label: string; days: string[] }>();
  for (const c of cooks) {
    for (const line of ingredientLines(c.ingredients)) {
      const ing = parseIngredient(line);
      if (!perishableOf(ing.key)) continue;
      const s = seen.get(ing.key) ?? { label: ing.key, days: [] };
      const d = dayName(c.date);
      if (!s.days.includes(d)) s.days.push(d);
      seen.set(ing.key, s);
    }
  }
  return [...seen.entries()].map(([key, s]) => ({ key, ...s })).filter((s) => s.days.length > 1);
}
