import { formatShoppingText, type ShoppingItem } from '@todolist/kitchen-ui';
import { share } from './platform';

/**
 * Hand the shopping list to wherever the platform sends text.
 *
 * Shared by the Shopping tab and Settings so the two entry points can't drift
 * into formatting the same list differently.
 *
 * Returns what actually happened — shared, or copied to the clipboard — so the
 * caller can say something true rather than assuming a share sheet appeared.
 */
export async function shareShoppingList(items: ShoppingItem[]): Promise<string> {
  await share.shareText('Shopping list', formatShoppingText(items));
  return share.describe.text;
}
