/**
 * Units a recipe line can be written in, and how to add them up.
 *
 * Only units that convert exactly are merged: grams with kilograms, millilitres
 * with litres, spoons and cups with each other. Anything else ("2 bunches",
 * "1 tin") is only ever added to the same unit, because "1 tin + 200 g" has no
 * honest answer. Cups are the Australian 250 ml cup, and the tablespoon is 20 ml,
 * since this is an Australian household's kitchen (an American recipe's 15 ml
 * tablespoon is close enough for a shopping list).
 */

export type UnitFamily = 'mass' | 'volume' | 'count';

export interface UnitDef {
  /** The canonical spelling shown on a list. */
  name: string;
  family: UnitFamily | 'other';
  /** Grams or millilitres per one of this unit; absent for 'other'. */
  base?: number;
}

const U = (name: string, family: UnitDef['family'], base?: number): UnitDef => ({
  name,
  family,
  base,
});

const UNITS: Record<string, UnitDef> = {};
function add(def: UnitDef, ...spellings: string[]) {
  for (const s of [def.name, ...spellings]) UNITS[s.toLowerCase()] = def;
}

add(U('g', 'mass', 1), 'gram', 'grams', 'gm', 'gms', 'gr');
add(U('kg', 'mass', 1000), 'kilogram', 'kilograms', 'kilo', 'kilos', 'kgs');
add(U('oz', 'mass', 28.35), 'ounce', 'ounces');
add(U('lb', 'mass', 453.6), 'lbs', 'pound', 'pounds');
add(U('ml', 'volume', 1), 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'mls');
add(U('l', 'volume', 1000), 'litre', 'litres', 'liter', 'liters', 'lt');
add(U('tsp', 'volume', 5), 'teaspoon', 'teaspoons', 'tsps');
add(U('tbsp', 'volume', 20), 'tablespoon', 'tablespoons', 'tbs', 'tbsps', 'tbl', 'tblsp');
add(U('cup', 'volume', 250), 'cups', 'c');
add(U('pinch', 'other'), 'pinches');
add(U('dash', 'other'), 'dashes');
add(U('clove', 'other'), 'cloves');
add(U('bunch', 'other'), 'bunches');
add(U('handful', 'other'), 'handfuls');
add(U('slice', 'other'), 'slices');
add(U('tin', 'other'), 'tins', 'can', 'cans');
add(U('jar', 'other'), 'jars');
add(U('packet', 'other'), 'packets', 'pack', 'packs', 'pkt', 'pkts', 'sachet', 'sachets');
add(U('punnet', 'other'), 'punnets');
add(U('bag', 'other'), 'bags');
add(U('stalk', 'other'), 'stalks', 'stick', 'sticks');
add(U('sprig', 'other'), 'sprigs');
add(U('head', 'other'), 'heads');
add(U('fillet', 'other'), 'fillets');
add(U('sheet', 'other'), 'sheets');
add(U('cube', 'other'), 'cubes');

/**
 * The unit a word means, or null. The one-letter forms are the only
 * case-sensitive ones: an old recipe's "T" is a tablespoon and its "t" a
 * teaspoon, which a lowercase lookup would confuse.
 */
export function unitOf(word: string): UnitDef | null {
  if (word === 'T') return UNITS['tbsp']!;
  if (word === 't') return UNITS['tsp']!;
  return UNITS[word.toLowerCase().replace(/\.$/, '')] ?? null;
}

/**
 * A quantity in the smallest unit of its family, so two can be added: grams for
 * mass, millilitres for volume. 'count' and 'other' units are returned as they are.
 */
export function toBase(qty: number, unit: UnitDef | null): { amount: number; unitKey: string } {
  if (!unit) return { amount: qty, unitKey: '' };
  if (unit.family === 'mass' || unit.family === 'volume')
    return { amount: qty * (unit.base ?? 1), unitKey: unit.family };
  return { amount: qty, unitKey: unit.name };
}

/**
 * A base amount back in the unit a person would write on a list: 1500 g is
 * "1.5 kg"; 40 ml of spoon measures is "2 tbsp"; 750 ml is "750 ml".
 */
export function fromBase(amount: number, unitKey: string): { qty: number; unit: string } {
  if (unitKey === 'mass')
    return amount >= 1000 ? { qty: amount / 1000, unit: 'kg' } : { qty: amount, unit: 'g' };
  if (unitKey === 'volume') {
    if (amount >= 1000) return { qty: amount / 1000, unit: 'l' };
    if (amount < 15) return { qty: amount / 5, unit: 'tsp' };
    if (amount < 60) return { qty: amount / 20, unit: 'tbsp' };
    return { qty: amount, unit: 'ml' };
  }
  return { qty: amount, unit: unitKey };
}
