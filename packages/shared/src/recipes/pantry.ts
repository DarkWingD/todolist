import { ingredientKey } from './ingredients.js';

/**
 * What most kitchens always have, so the shopping list does not tell you to buy
 * salt every week. Each household edits its own (one per line); these are only
 * where it starts. Skipped items are still shown, in a short "check you have"
 * line, because the jar does run out eventually.
 */
export const DEFAULT_PANTRY = [
  'salt',
  'black pepper',
  'water',
  'olive oil',
  'vegetable oil',
  'plain flour',
  'white sugar',
  'brown sugar',
  'soy sauce',
  'garlic powder',
  'dried oregano',
];

/** The pantry as a set of ingredient keys, from a household's own lines or the defaults. */
export function pantryKeys(lines: string | null | undefined): Set<string> {
  const source = lines == null ? DEFAULT_PANTRY : lines.split('\n');
  return new Set(source.map((s) => ingredientKey(s)).filter(Boolean));
}
