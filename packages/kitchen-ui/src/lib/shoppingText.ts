import type { ShoppingItem } from '../adapter';

/**
 * The shopping list as plain text, for pasting into a message.
 *
 * Mirrors the screen's grouping so whoever receives it can tell which
 * ingredients belong to which meal — a flat list loses that, and "onions" reads
 * very differently depending on what it's for.
 *
 * Only what's still to buy: this is a list you hand someone on their way out,
 * not a record of the shop.
 */
export function formatShoppingText(items: ShoppingItem[]): string {
  const childrenOf = new Map<string, ShoppingItem[]>();
  for (const i of items) {
    if (!i.parentId) continue;
    const kids = childrenOf.get(i.parentId) ?? [];
    kids.push(i);
    childrenOf.set(i.parentId, kids);
  }

  const lines: string[] = [];
  for (const item of items.filter((i) => !i.parentId && !i.completed)) {
    const kids = childrenOf.get(item.id) ?? [];
    if (kids.length === 0) {
      // A plain item someone added by hand.
      lines.push(`- ${item.title}`);
      continue;
    }
    const outstanding = kids.filter((k) => !k.completed);
    // A meal whose ingredients are all bought would be a heading with nothing
    // under it, which reads as an instruction to buy the meal itself.
    if (outstanding.length === 0) continue;
    if (lines.length > 0) lines.push('');
    lines.push(`${item.title}:`);
    for (const k of outstanding) lines.push(`  - ${k.title}`);
    lines.push('');
  }

  const body = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return body ? `Shopping list\n\n${body}` : 'Shopping list\n\nNothing left to buy.';
}
