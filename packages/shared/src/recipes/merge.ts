import { AISLES, aisleOf } from './aisles.js';
import { formatQty, ingredientLines, parseIngredient } from './ingredients.js';
import { perishableOf } from './perishables.js';
import { fromBase, toBase, type UnitDef } from './units.js';

/**
 * A week of cooks into one shopping list: every line read, the same thing added
 * up across meals ("2 onions" + "1 onion" is 3), scaled to how many it feeds,
 * what's in the pantry left off, and the rest grouped by aisle.
 */

export interface CookForList {
  mealName: string;
  /** The cook's date, "YYYY-MM-DD"; leftover nights are not separate cooks. */
  date: string;
  /** The meal's ingredients box. */
  ingredients: string | null;
  /** How much to scale the recipe by; 1 when it is written for this cook already. */
  factor: number;
}

export interface ListItem {
  key: string;
  aisle: string;
  /** The line for the shopping list: "Coriander — 1 bunch (Tue + Thu)". */
  title: string;
  label: string;
  amount: string | null;
  meals: string[];
  dates: string[];
  optional: boolean;
}

export interface MergedList {
  aisles: { id: string; label: string; emoji: string; items: ListItem[] }[];
  /** What was left off because the pantry has it, for a "check you have" line. */
  pantry: string[];
  /** Perishables only one meal uses, sold in a pack it will not finish. */
  spare: { key: string; label: string; pack: string; meal: string; date: string }[];
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekdayOf = (date: string): string => DAY[new Date(`${date}T00:00:00Z`).getUTCDay()]!;

interface Acc {
  key: string;
  label: string;
  amounts: Map<string, number>;
  /** The units each family was written in: one unit means the list keeps it ("1½ cups", not "375 ml"). */
  units: Map<string, Set<UnitDef>>;
  unquantified: boolean;
  meals: string[];
  dates: string[];
  optional: boolean;
}

/** "3", "1.5 kg", "2 tbsp", "2 tins + 400 g": what to buy, in the units the recipes used. */
function amountText(a: Acc): string | null {
  const parts: string[] = [];
  for (const [unitKey, raw] of a.amounts) {
    // Counted things are bought whole: half a lime is a lime, ⅓ tin is a tin.
    const total =
      unitKey === 'mass' || unitKey === 'volume' ? raw : Math.max(1, Math.ceil(raw - 0.05));
    const written = a.units.get(unitKey);
    const only = written && written.size === 1 ? [...written][0]! : null;
    const { qty, unit } = only?.base
      ? { qty: total / only.base, unit: only.name }
      : fromBase(total, unitKey);
    const n = formatQty(qty, unit);
    if (!n) continue;
    parts.push(unit ? `${n} ${unit === 'cup' && qty > 1 ? 'cups' : unit}` : n);
  }
  return parts.length ? parts.join(' + ') : null;
}

export function mergeForShopping(cooks: CookForList[], pantry: Set<string>): MergedList {
  const acc = new Map<string, Acc>();
  const pantryHits = new Map<string, string>();
  for (const cook of cooks) {
    for (const line of ingredientLines(cook.ingredients)) {
      const ing = parseIngredient(line);
      if (!ing.key) continue;
      if (pantry.has(ing.key)) {
        if (!pantryHits.has(ing.key)) pantryHits.set(ing.key, ing.label);
        continue;
      }
      let a = acc.get(ing.key);
      if (!a) {
        // The list says what to buy, not how the recipe described it:
        // "Onion", not "Onion thinly sliced" or "Juice of ½ lime".
        a = {
          key: ing.key,
          label: ing.key[0]!.toUpperCase() + ing.key.slice(1),
          amounts: new Map(),
          units: new Map(),
          unquantified: false,
          meals: [],
          dates: [],
          optional: true,
        };
        acc.set(ing.key, a);
      }
      if (ing.qty !== null) {
        const { amount, unitKey } = toBase(ing.qty * cook.factor, ing.unit);
        a.amounts.set(unitKey, (a.amounts.get(unitKey) ?? 0) + amount);
        if (ing.unit) a.units.set(unitKey, (a.units.get(unitKey) ?? new Set()).add(ing.unit));
      } else a.unquantified = true;
      if (!a.meals.includes(cook.mealName)) a.meals.push(cook.mealName);
      if (!a.dates.includes(cook.date)) a.dates.push(cook.date);
      a.optional &&= ing.optional;
    }
  }

  const items: ListItem[] = [];
  const spare: MergedList['spare'] = [];
  for (const a of acc.values()) {
    a.dates.sort();
    const per = perishableOf(a.key);
    let amount = amountText(a);
    // Herbs and leaves are bought by the bunch or bag, whatever the recipe said:
    // "¼ cup coriander leaves" means "a bunch of coriander" at the shop.
    if (per && ['bunch', 'bag', 'punnet', 'head', 'stalk'].includes(per.pack)) {
      amount = `${Math.max(1, Math.ceil((a.amounts.get(per.pack) ?? 0) - 0.05))} ${per.pack}${(a.amounts.get(per.pack) ?? 0) > 1.05 ? (per.pack === 'bunch' ? 'es' : 's') : ''}`;
    }
    const days = a.dates.map(weekdayOf);
    const forWhat =
      a.meals.length === 1
        ? a.meals[0]!
        : a.dates.length > 1
          ? days.join(' + ')
          : `${a.meals.length} meals`;
    const title = `${a.label}${amount ? ` — ${amount}` : ''} (${forWhat})${a.optional ? ' · optional' : ''}`;
    items.push({
      key: a.key,
      aisle: aisleOf(a.key),
      title,
      label: a.label,
      amount,
      meals: a.meals,
      dates: a.dates,
      optional: a.optional,
    });
    // Spare means a bunch of herbs or a bag of leaves going limp: what goes off,
    // bought in a size one meal will not finish. Tins and cartons keep.
    if (per && ['bunch', 'bag', 'punnet', 'head'].includes(per.pack) && a.meals.length === 1) {
      spare.push({
        key: a.key,
        label: a.label,
        pack: per.pack,
        meal: a.meals[0]!,
        date: a.dates[0]!,
      });
    }
  }

  const aisles = AISLES.map((s) => ({
    ...s,
    items: items.filter((i) => i.aisle === s.id).sort((x, y) => x.label.localeCompare(y.label)),
  })).filter((s) => s.items.length > 0);
  return { aisles, pantry: [...pantryHits.values()].sort(), spare };
}
