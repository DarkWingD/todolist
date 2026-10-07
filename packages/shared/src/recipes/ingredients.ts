import { aisleOf } from './aisles.js';
import { unitOf, type UnitDef } from './units.js';

/**
 * Reading a recipe's ingredient line: "2 brown onions, finely diced" is two of
 * "onion". No model involved: recipe lines follow a few shapes (amount, unit,
 * name, then a comma or brackets for everything else), and rules read those
 * shapes exactly, where a small language model guesses and gets amounts wrong.
 *
 * What comes out is used three ways: to scale a recipe for more people, to add
 * the week's ingredients up for the shopping list, and to notice two meals that
 * share something perishable.
 */

export interface Ingredient {
  /** The line as written, tidied of bullets. */
  raw: string;
  /** The amount, or null for "salt, to taste". A range keeps its top in `qtyMax`. */
  qty: number | null;
  qtyMax: number | null;
  unit: UnitDef | null;
  /** What it is, normalised so two recipes' lines can be matched: "onion". */
  key: string;
  /** What it is as the recipe wrote it, for showing on a list: "Brown onions". */
  label: string;
  /** Everything said about it: "finely diced", "400 g", "to serve". */
  note: string | null;
  /** "to serve", "optional", "for garnish": nice to have, not essential. */
  optional: boolean;
}

const FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};
const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  dozen: 12,
};

// One number: "1", "1.5", "1/2", "1 1/2", "1½", "½".
const FRAC_CHARS = Object.keys(FRACTIONS).join('');
// Longest forms first, or "1/2" would match as "1" and leave "/2" behind.
const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*[${FRAC_CHARS}])?|[${FRAC_CHARS}])`;
const LEADING_QTY = new RegExp(`^(${NUM})(?:\\s*(?:-|–|—|to)\\s*(${NUM}))?`, 'i');

/** "1 1/2" → 1.5, "1½" → 1.5, "3/4" → 0.75, "1,5" → 1.5. */
export function parseNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  let total = 0;
  let matched = false;
  const frac = [...t].find((c) => c in FRACTIONS);
  let rest = t;
  if (frac) {
    total += FRACTIONS[frac]!;
    rest = t.replace(frac, '').trim();
    matched = true;
  }
  for (const part of rest.split(/\s+/).filter(Boolean)) {
    if (/^\d+\/\d+$/.test(part)) {
      const [a, b] = part.split('/').map(Number);
      if (!b) return null;
      total += a! / b;
      matched = true;
    } else if (/^\d+(?:[.,]\d+)?$/.test(part)) {
      total += Number(part.replace(',', '.'));
      matched = true;
    } else return null;
  }
  return matched ? total : null;
}

// Words that describe how an ingredient is prepared or which kind it is, not
// what to buy. Stripped from the matching key only; the label keeps them.
const DESCRIPTORS = new Set(
  (
    'fresh freshly dried large small medium big extra ripe finely roughly coarsely thinly thickly ' +
    'chopped diced sliced minced grated crushed peeled halved quartered shredded torn trimmed cubed ' +
    'boneless skinless skin-on bone-in lean free-range organic raw cooked cold warm hot softened melted ' +
    'beaten whole ground plain unsalted salted good quality quality-good handful heaped level ' +
    'brown white red green yellow baby young firm packed loosely tightly approximately about approx ' +
    'store-bought homemade frozen thawed drained rinsed and or slice slices steamed piece pieces knob ' +
    'thumb thumb-sized of fried crispy asian japanese'
  ).split(/\s+/),
);
// Kept even though they look like descriptors, because they change what you buy.
const KEEP_PAIRS = [
  'brown sugar',
  'white sugar',
  'red wine',
  'white wine',
  'red onion',
  'spring onion',
  'green beans',
  'red lentils',
  'brown rice',
  'white rice',
  'ground beef',
  'ground pork',
  'ground cumin',
  'ground coriander',
  'ground cinnamon',
  'ground ginger',
  'sour cream',
  'cream cheese',
  'red curry paste',
  'green curry paste',
  'baby spinach',
  'red capsicum',
  'green capsicum',
  'yellow capsicum',
  'white vinegar',
  'red wine vinegar',
  'white wine vinegar',
  'frozen peas',
  'dried oregano',
  'dried thyme',
  'plain flour',
  'self-raising flour',
  'smoked paprika',
  'sweet paprika',
  'black pepper',
  'white pepper',
];
// Spellings of the same thing, so "cilantro" and "coriander" meet on one line.
const ALIASES: Record<string, string> = {
  cilantro: 'coriander',
  'coriander leaf': 'coriander',
  'fresh coriander': 'coriander',
  scallion: 'spring onion',
  'green onion': 'spring onion',
  shallot: 'eschalot',
  'bell pepper': 'capsicum',
  'red bell pepper': 'red capsicum',
  'green bell pepper': 'green capsicum',
  'ground beef': 'beef mince',
  'minced beef': 'beef mince',
  mince: 'beef mince',
  'ground pork': 'pork mince',
  'ground chicken': 'chicken mince',
  zucchini: 'zucchini',
  courgette: 'zucchini',
  eggplant: 'eggplant',
  aubergine: 'eggplant',
  'heavy cream': 'thickened cream',
  'double cream': 'thickened cream',
  'whipping cream': 'thickened cream',
  'all-purpose flour': 'plain flour',
  'all purpose flour': 'plain flour',
  'chicken thigh': 'chicken thigh',
  'chicken thigh fillet': 'chicken thigh',
  'chicken breast fillet': 'chicken breast',
  'tomato passata': 'passata',
  'crushed tomato': 'tinned tomato',
  'chopped tomato': 'tinned tomato',
  'diced tomato': 'tinned tomato',
  'canned tomato': 'tinned tomato',
  'tomato puree': 'passata',
  'extra virgin olive oil': 'olive oil',
  evoo: 'olive oil',
  'olive oil spray': 'olive oil',
  'garlic clove': 'garlic',
  'clove garlic': 'garlic',
  'garlic cloves': 'garlic',
  'kosher salt': 'salt',
  'sea salt': 'salt',
  'salt flakes': 'salt',
  'table salt': 'salt',
  'cracked black pepper': 'black pepper',
  pepper: 'black pepper',
  'ground black pepper': 'black pepper',
  'black peppercorn': 'black pepper',
  'coconut cream': 'coconut cream',
  'lime juice': 'lime',
  'lemon juice': 'lemon',
  'lemon zest': 'lemon',
  'lime zest': 'lime',
  'juice of lemon': 'lemon',
  'juice of lime': 'lime',
  'parsley leaf': 'parsley',
  'flat-leaf parsley': 'parsley',
  'flat leaf parsley': 'parsley',
  'italian parsley': 'parsley',
  'curly parsley': 'parsley',
  'basil leaf': 'basil',
  'mint leaf': 'mint',
  'thai basil': 'thai basil',
  'baby spinach leaf': 'baby spinach',
  'english spinach': 'spinach',
  'stock cube': 'stock',
  'chicken stock': 'chicken stock',
  'beef stock': 'beef stock',
  'vegetable stock': 'vegetable stock',
  'parmigiano reggiano': 'parmesan',
  'parmesan cheese': 'parmesan',
  'cheddar cheese': 'cheddar',
  'mozzarella cheese': 'mozzarella',
  'feta cheese': 'feta',
  broth: 'stock',
  'chicken broth': 'chicken stock',
  'beef broth': 'beef stock',
  'vegetable broth': 'vegetable stock',
  'bone broth': 'stock',
  'naan bread': 'naan',
};
// Plural words that are not plurals of anything, or plural the irregular way.
const SINGULAR: Record<string, string> = {
  tomatoes: 'tomato',
  potatoes: 'potato',
  leaves: 'leaf',
  loaves: 'loaf',
  knives: 'knife',
  chillies: 'chilli',
  chilies: 'chilli',
  berries: 'berry',
  cherries: 'cherry',
  anchovies: 'anchovy',
  radishes: 'radish',
  peaches: 'peach',
  sandwiches: 'sandwich',
  mangoes: 'mango',
  avocadoes: 'avocado',
  cloves: 'clove',
  breasts: 'breast',
  thighs: 'thigh',
  fillets: 'fillet',
  noodles: 'noodle',
};
const NOT_PLURAL = new Set(
  'asparagus hummus couscous molasses swiss oats greens grits brussels hummus citrus octopus bass cress swiss chips nachos'.split(
    ' ',
  ),
);

function singular(word: string): string {
  if (SINGULAR[word]) return SINGULAR[word]!;
  if (NOT_PLURAL.has(word) || word.length < 4) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (/(ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (/ies$/.test(word)) return `${word.slice(0, -3)}y`;
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

const OPTIONAL_RE =
  /\b(to serve|for serving|to garnish|for garnish|garnish|optional|if desired|to taste|for decoration)\b/i;

/** The words that identify what to buy, normalised for matching. */
export function ingredientKey(name: string): string {
  let t = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  // "chicken or vegetable broth" is chicken broth: the first choice, keeping
  // the noun the two share. "Thai basil or coriander" is Thai basil.
  const or = t.split(' or ');
  if (or.length > 1) {
    const [a, b] = [or[0]!.trim().split(' '), or[1]!.trim().split(' ')];
    t = a.length === 1 && b.length > 1 ? `${a[0]} ${b[b.length - 1]}` : a.join(' ');
  }
  // "can chopped tomatoes", "tin of chickpeas": the container makes it tinned.
  const tinned = /^(?:cans?|tins?|jars?)\s+(?:of\s+)?/.exec(t);
  if (tinned) {
    const inner = ingredientKey(t.slice(tinned[0].length));
    return inner.startsWith('tinned ') ? inner : `tinned ${inner}`;
  }
  // The phrase as written first: "diced tomato" is a tin, and stripping
  // "diced" before looking would turn it into a fresh tomato.
  const asWritten = t.split(' ');
  asWritten[asWritten.length - 1] = singular(asWritten[asWritten.length - 1]!);
  const whole = asWritten.join(' ');
  if (ALIASES[whole]) return ALIASES[whole]!;
  // Pairs that look like a descriptor plus a noun but are a different product.
  const keep = KEEP_PAIRS.find(
    (p) =>
      whole === p ||
      whole.endsWith(` ${p}`) ||
      whole.startsWith(`${p} `) ||
      whole.includes(` ${p} `),
  );
  const words = whole.split(' ');
  let kept = keep
    ? keep.split(' ')
    : words.filter((w, i) => !DESCRIPTORS.has(w) || (i === words.length - 1 && words.length === 1));
  if (kept.length === 0) kept = words.slice(-1);
  kept = kept.map((w, i) => (i === kept.length - 1 ? singular(w) : w));
  t = kept.join(' ');
  // Try the whole phrase, then its last two words, then its last word.
  for (const cand of [t, kept.slice(-2).join(' '), kept.slice(-1).join(' ')])
    if (ALIASES[cand]) return ALIASES[cand]!;
  return t;
}

/**
 * An ingredient line as a person would write it. Recipe sites build these from
 * parts, and the joins show: "2 garlic cloves (, minced)", "((Note 1))", a
 * trailing "*" pointing at a footnote, and "400 g/14oz" for two audiences. An
 * Australian kitchen measures in metric, so the imperial half goes.
 */
export function tidyIngredient(line: string): string {
  return (
    line
      // One bracket pair each: "(Note 4)" may sit inside another bracket.
      .replace(/\(\s*(?:see\s+)?notes?\s*\d*\s*\)/gi, '')
      .replace(/\s*\(\s*,\s*([^()]*)\)/g, ', $1')
      .replace(/\(\(/g, '(')
      .replace(/\)\)/g, ')')
      .replace(/\(\s*\)/g, '')
      .replace(
        /(\d\s*(?:g|kg|ml|l|cm))\s*\/\s*[\d.½¼¾⅓⅔]+\s*(?:oz|lb|lbs|fl\.?\s?oz|cups?|pints?|inch|in|")(?![a-z])/gi,
        '$1',
      )
      .replace(/\s*\*+\s*$/g, '')
      .replace(/\s+,/g, ',')
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s,]+$/g, '')
      .trim()
  );
}

/** Bullets, checkboxes and numbering that recipe sites put in front of a line. */
function stripBullet(s: string): string {
  return s.replace(/^\s*(?:[-•*·▢☐□◦‣⁃]|\d+[.)](?=\s))\s*/, '').trim();
}

/** Read one ingredient line. Never throws; a line it cannot read is all `label`. */
export function parseIngredient(line: string): Ingredient {
  // Tidied first, so a recipe saved before the import learned to clean up
  // ("2 garlic cloves (, minced)") still reads cleanly everywhere.
  const raw = tidyIngredient(stripBullet(line).replace(/\s+/g, ' '));
  let rest = raw;
  let qty: number | null = null;
  let qtyMax: number | null = null;
  let unit: UnitDef | null = null;
  const notes: string[] = [];

  // A leading word number only counts in front of a unit or "of": "a pinch",
  // "two cups"; "a lovely piece of salmon" is not one of anything.
  const wordNum =
    /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|dozen)\s+(\S+)/i.exec(
      rest,
    );
  const m = LEADING_QTY.exec(rest);
  if (m) {
    qty = parseNumber(m[1]!);
    qtyMax = m[2] ? parseNumber(m[2]) : null;
    rest = rest.slice(m[0].length).trim();
  } else if (
    wordNum &&
    (unitOf(wordNum[2]!) || /^of$/i.test(wordNum[2]!) || /^(dozen)$/i.test(wordNum[1]!))
  ) {
    qty = WORD_NUMBERS[wordNum[1]!.toLowerCase()] ?? null;
    rest = rest.slice(wordNum[1]!.length).trim();
  }

  // "500g" written against the number, or "2 x 400 g tins": the pack size is a note.
  const attached = /^([a-zA-Z]+)\b/.exec(rest);
  if (qty !== null) {
    const times = /^(?:x|×)\s*(\d+(?:[.,]\d+)?\s*[a-zA-Z]+)\s*/i.exec(rest);
    if (times) {
      notes.push(times[1]!.replace(/\s+/g, ' '));
      rest = rest.slice(times[0].length).trim();
    }
    const word = /^([a-zA-Z.]+)\b\.?/.exec(rest);
    const u = word ? unitOf(word[1]!) : null;
    if (u) {
      unit = u;
      rest = rest.slice(word![0].length).trim();
    } else if (attached && unitOf(attached[1]!)) {
      unit = unitOf(attached[1]!);
      rest = rest.slice(attached[0].length).trim();
    }
    rest = rest.replace(/^of\s+/i, '');
  }

  // Everything in brackets, or after the first comma, is said about it.
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return ' ';
  });
  const comma = rest.indexOf(',');
  if (comma >= 0) {
    const after = rest.slice(comma + 1).trim();
    if (after) notes.push(after);
    rest = rest.slice(0, comma);
  }
  // "salt to taste", "coriander to serve" without a comma.
  const opt = OPTIONAL_RE.exec(rest);
  if (opt) {
    notes.push(rest.slice(opt.index).trim());
    rest = rest.slice(0, opt.index);
  }
  const label = rest
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^of\s+/i, '');
  const note = notes.join(', ') || null;
  let key = ingredientKey(label || raw);
  // Bought in a tin or a jar, it is not the fresh one: "2 tins tomatoes" is tinned.
  if (unit && (unit.name === 'tin' || unit.name === 'jar') && aisleOf(key) === 'produce')
    key = `tinned ${key}`;
  return {
    raw,
    qty,
    qtyMax,
    unit,
    key,
    label: label ? label[0]!.toUpperCase() + label.slice(1) : raw,
    note,
    optional: OPTIONAL_RE.test(raw),
  };
}

/** The lines of an ingredients box, skipping blanks and section headings ("For the sauce:"). */
export function ingredientLines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !/:$/.test(s));
}

const NICE: [number, string][] = [
  [0.125, '⅛'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

/**
 * An amount as a cook writes it: ½, 1¼, 2⅓; whole numbers past ten; grams and
 * millilitres to the nearest 5 (nobody weighs 437 g of chicken).
 */
export function formatQty(n: number, unit?: string | null): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if ((unit === 'g' || unit === 'ml') && n >= 20) return String(Math.round(n / 5) * 5);
  // Kilos and litres read as decimals on a label: 1.5 kg, not 1½ kg.
  if (unit === 'kg' || unit === 'l') return String(Math.round(n * 10) / 10);
  if (n >= 10) return String(Math.round(n));
  const whole = Math.floor(n);
  const frac = n - whole;
  // Under one, always the nearest kitchen fraction: a scaled-down pinch of salt
  // is still "⅛ tsp", never nothing.
  if (whole === 0)
    return NICE.reduce((best, cur) =>
      Math.abs(cur[0] - n) < Math.abs(best[0] - n) ? cur : best,
    )[1];
  if (frac < 0.06) return String(whole);
  if (frac > 0.94) return String(whole + 1);
  const near = NICE.find(([v]) => Math.abs(v - frac) < 0.05);
  if (!near) return n.toFixed(1).replace(/\.0$/, '');
  return `${whole}${near[1]}`;
}

/**
 * The same line for `factor` times as many people: "2 onions" ×1.5 is "3 onions".
 * Only the amount at the start changes; a line without one is left alone.
 */
export function scaleLine(line: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.01) return line;
  const raw = stripBullet(line);
  const m = LEADING_QTY.exec(raw);
  if (!m) return raw;
  const a = parseNumber(m[1]!);
  const b = m[2] ? parseNumber(m[2]) : null;
  if (a === null) return raw;
  const unit = /^\s*([a-zA-Z]+)/.exec(raw.slice(m[0].length))?.[1];
  const u = unit && unitOf(unit) ? unitOf(unit)!.name : null;
  const scaled =
    b !== null
      ? `${formatQty(a * factor, u)}–${formatQty(b * factor, u)}`
      : formatQty(a * factor, u);
  // A measurement in brackets scales with the line: "1 cup (250ml) stock" ×2
  // is "2 cups (500ml) stock", not "(250ml)" beside double the cups.
  const rest = raw
    .slice(m[0].length)
    .replace(
      /\((\s*)(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\s*\)/i,
      (_, sp: string, num: string, un: string) => {
        const v = Number(num.replace(',', '.')) * factor;
        return `(${sp}${formatQty(v, un.toLowerCase())}${un})`;
      },
    );
  return `${scaled}${rest}`;
}
