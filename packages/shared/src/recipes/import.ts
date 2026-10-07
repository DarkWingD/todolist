import { tidyIngredient } from './ingredients.js';

/**
 * Turning a recipe page, or a pasted recipe, into a recipe.
 *
 * Most recipe sites publish the recipe itself as structured data for search
 * engines (schema.org "Recipe", in a JSON-LD script): its ingredients exactly as
 * printed, its steps, how many it serves and how long it takes. Reading that is
 * exact, where asking a model to read the page would be a guess. Sites without
 * it fall back to microdata, and failing that to "paste the recipe in".
 */

export interface RecipeDraft {
  name: string;
  ingredients: string[];
  method: string[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  eacute: 'é',
  egrave: 'è',
  times: '×',
  frasl: '/',
};

/** HTML entities and tags out of a string from a page. */
export function cleanText(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** ISO 8601 durations as minutes: "PT1H30M" → 90, "P0DT0H45M" → 45. */
export function isoMinutes(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m =
    /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
      v.trim(),
    );
  if (!m) return null;
  const mins =
    Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Number(m[4] ?? 0) / 60;
  return mins > 0 ? Math.round(mins) : null;
}

function firstNumber(v: unknown): number | null {
  const s = Array.isArray(v) ? v.map(String).join(' ') : v == null ? '' : String(v);
  const m = /(\d+)/.exec(s);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 && n < 100 ? n : null;
}

const isRecipe = (node: any): boolean => {
  const t = node?.['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
};

function findRecipe(node: any, depth = 0): any | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (isRecipe(node)) return node;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    const r = findRecipe(node[k], depth + 1);
    if (r) return r;
  }
  return null;
}

/** Steps from any of the shapes sites use: a string, strings, HowToStep, HowToSection. */
function steps(v: any): string[] {
  if (!v) return [];
  if (typeof v === 'string')
    return cleanText(v)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(steps);
  if (typeof v === 'object') {
    if (v['@type'] === 'HowToSection' || v.itemListElement) {
      const inner = steps(v.itemListElement);
      return v.name ? [`${cleanText(v.name)}:`, ...inner] : inner;
    }
    return steps(v.text ?? v.name ?? '');
  }
  return [];
}

// Keywords worth keeping as tags. Sites stuff "keywords" for search engines
// (author names, "1 of 5-a-day", the recipe's own name), so only these survive.
const USEFUL_TAGS = new Set(
  (
    'quick easy vegetarian vegan gluten-free dairy-free healthy kid-friendly family freezer freezer-friendly ' +
    'slow-cooker one-pot one-pan bbq budget low-carb spicy soup salad pasta curry stir-fry roast baking dessert ' +
    'breakfast lunch dinner mains sides snack seafood chicken beef pork lamb fish noodles rice pie burger tacos ' +
    'mexican italian indian thai chinese japanese korean vietnamese greek middle-eastern french spanish australian'
  ).split(' '),
);
const TAG_ALIASES: Record<string, string> = {
  'main course': 'mains',
  main: 'mains',
  'main dish': 'mains',
  'main meal': 'mains',
  mains: 'mains',
  'gluten free': 'gluten-free',
  'dairy free': 'dairy-free',
  'slow cooker': 'slow-cooker',
  'one pot': 'one-pot',
  'kid friendly': 'kid-friendly',
  kids: 'kid-friendly',
  'freezer friendly': 'freezer',
  'stir fry': 'stir-fry',
  'middle eastern': 'middle-eastern',
  side: 'sides',
  'side dish': 'sides',
  vego: 'vegetarian',
};

function tagsOf(r: any, name: string): string[] {
  const raw: string[] = [];
  for (const k of ['recipeCategory', 'recipeCuisine', 'keywords']) {
    const v = r[k];
    if (typeof v === 'string') raw.push(...v.split(','));
    else if (Array.isArray(v)) raw.push(...v.map(String));
  }
  const out: string[] = [];
  const own = name.toLowerCase();
  for (const t0 of raw.map((s) => cleanText(s).toLowerCase().trim())) {
    const t = TAG_ALIASES[t0] ?? t0;
    if (!t || (own.includes(t) && t.split(' ').length > 1)) continue;
    if (!USEFUL_TAGS.has(t.replace(/\s+/g, '-'))) continue;
    const tag = t.replace(/\s+/g, '-');
    if (!out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 6);
}

function fromJsonLd(r: any): RecipeDraft {
  const ingredients = (
    Array.isArray(r.recipeIngredient)
      ? r.recipeIngredient
      : Array.isArray(r.ingredients)
        ? r.ingredients
        : []
  )
    .map((x: unknown) => tidyIngredient(cleanText(x)))
    .filter(Boolean);
  const total = isoMinutes(r.totalTime);
  const prep = isoMinutes(r.prepTime);
  const cook =
    isoMinutes(r.cookTime) ?? (total && prep ? Math.max(0, total - prep) || null : total);
  return {
    name: cleanText(r.name),
    ingredients,
    method: steps(r.recipeInstructions),
    servings: firstNumber(r.recipeYield),
    prepMinutes: prep,
    cookMinutes: cook,
    tags: tagsOf(r, cleanText(r.name)),
  };
}

/** The recipe on a page, or null when the page does not publish one. */
export function extractRecipe(html: string): RecipeDraft | null {
  const scripts = html.matchAll(
    /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const s of scripts) {
    const body = s[1]!
      .replace(/^\s*<!--|-->\s*$/g, '')
      .replace(/^\s*\/\/<!\[CDATA\[|\/\/\]\]>\s*$/g, '')
      .trim();
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      // Some sites leave stray control characters inside strings.
      try {
        data = JSON.parse(body.replace(/[\u0000-\u001f]+/g, ' '));
      } catch {
        continue;
      }
    }
    const r = findRecipe(data);
    if (r) {
      const draft = fromJsonLd(r);
      if (draft.ingredients.length || draft.method.length) return draft;
    }
  }
  // Microdata: itemprop="recipeIngredient" on each line.
  const items = [
    ...html.matchAll(
      /itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/(?:li|span|p|div)>/gi,
    ),
  ].map((m) => cleanText(m[1]));
  if (items.length) {
    const name = /itemprop=["']name["'][^>]*>([\s\S]*?)</i.exec(html)?.[1];
    const method = [
      ...html.matchAll(/itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\/(?:li|div|ol|p)>/gi),
    ].flatMap((m) => steps(m[1]));
    return {
      name: cleanText(name) || '',
      ingredients: items.filter(Boolean),
      method,
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
    };
  }
  return null;
}

const HEAD_ING = /^(ingredients?|you(?:'ll)? need|shopping list)\s*:?$/i;
const HEAD_METHOD =
  /^(method|instructions?|directions?|steps|preparation|how to (?:make|cook) it)\s*:?$/i;
const STARTS_WITH_AMOUNT =
  /^\s*(?:[-•*▢]\s*)?(?:\d|[½⅓⅔¼¾⅛]|a |an |one |two |three |four |pinch|handful)/i;

/**
 * A recipe someone pasted in as text, from a message or a cookbook photo's
 * OCR: headings when it has them ("Ingredients", "Method"), and when it has
 * not, lines that start with an amount are ingredients and the rest are steps.
 */
export function parseRecipeText(text: string): RecipeDraft {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  let name = '';
  const ingredients: string[] = [];
  const method: string[] = [];
  let servings: number | null = null;
  let mode: 'pre' | 'ing' | 'method' = 'pre';
  const hasHeadings = lines.some((l) => HEAD_ING.test(l)) || lines.some((l) => HEAD_METHOD.test(l));
  for (const line of lines) {
    const serves = /^(?:serves|servings|makes|yield)\s*:?\s*(\d+)/i.exec(line);
    if (serves) {
      servings = Number(serves[1]);
      continue;
    }
    if (HEAD_ING.test(line)) {
      mode = 'ing';
      continue;
    }
    if (HEAD_METHOD.test(line)) {
      mode = 'method';
      continue;
    }
    const clean = line.replace(/^\s*(?:[-•*▢]|\d+[.)])\s*/, '');
    if (hasHeadings) {
      if (mode === 'pre') {
        if (!name) name = clean;
      } else if (mode === 'ing') ingredients.push(clean);
      else method.push(clean);
    } else if (
      !name &&
      !STARTS_WITH_AMOUNT.test(line) &&
      line.length < 80 &&
      ingredients.length === 0
    ) {
      name = clean;
    } else if (STARTS_WITH_AMOUNT.test(line) && method.length === 0) ingredients.push(clean);
    else method.push(clean);
  }
  return { name, ingredients, method, servings, prepMinutes: null, cookMinutes: null, tags: [] };
}

/**
 * Timers in a step: "simmer for 20 minutes" is a 20-minute timer, "1–1½ hours"
 * starts at an hour (check it then), "half an hour" is 30 minutes.
 */
export function findTimers(step: string): { label: string; seconds: number }[] {
  const out: { label: string; seconds: number }[] = [];
  const re =
    /(\d+(?:\.\d+)?|half an?|an?|one)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*)?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi;
  for (const m of step.matchAll(re)) {
    const word = m[1]!.toLowerCase();
    const n = word.startsWith('half')
      ? 0.5
      : word === 'a' || word === 'an' || word === 'one'
        ? 1
        : Number(word);
    if (!Number.isFinite(n) || n <= 0) continue;
    const unit = m[3]!.toLowerCase();
    const mult = unit.startsWith('h') ? 3600 : unit.startsWith('m') ? 60 : 1;
    const seconds = Math.round(n * mult);
    if (seconds < 10 || seconds > 12 * 3600) continue;
    out.push({ label: m[0]!.trim(), seconds });
  }
  return out;
}
