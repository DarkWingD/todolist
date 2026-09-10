import type { MealEntry, MealOption } from './components/MealDayCard';

/**
 * The seam between the meal planner's UI and wherever its data lives.
 *
 * The web app fulfils this with tRPC against the shared server; the Android app
 * fulfils it against a JSON document on the phone. The screens never know which
 * — that is the whole point, and it is why every method is a plain promise
 * rather than a hook. The package wraps these in TanStack Query itself.
 */
export interface MealPlan {
  id: string;
  memberCount: number;
}

export interface SetDayInput {
  planId: string;
  date: string;
  /** Exactly one of these: pick an existing meal, or name a new one. */
  mealId?: string;
  name?: string;
  cookSpan: number;
}

export interface UpdateMealInput {
  id: string;
  recipeUrl?: string | null;
  notes?: string | null;
  ingredients?: string | null;
}

export interface MealPlannerAdapter {
  /** The plan to show, creating one if this is a first run. */
  ensurePlan(): Promise<MealPlan>;
  getWeek(planId: string, from: string, to: string): Promise<MealEntry[]>;
  getMeals(planId: string): Promise<MealOption[]>;
  setDay(input: SetDayInput): Promise<void>;
  clearDay(planId: string, date: string): Promise<void>;
  moveDay(planId: string, from: string, to: string): Promise<void>;
  updateMeal(input: UpdateMealInput): Promise<void>;
  toggleFavourite(id: string, isFavourite: boolean): Promise<void>;
  sendToShoppingList(planId: string, from: string, to: string): Promise<{ added: number }>;
  /**
   * Fill this week from the one before it, leaving planned days alone.
   * Returns what happened so the screen can say "5 copied, 2 already planned".
   */
  copyWeek?: (
    planId: string,
    from: string,
    to: string,
  ) => Promise<{ copied: number; skipped: number }>;
  /**
   * Absent on the phone, which has no server and so no one to share with. The
   * screen hides the Share control when this is undefined rather than offering
   * something that cannot work.
   */
  invite?: (planId: string, email: string) => Promise<void>;
}

/** One line on the shopping list. A heading is simply an item with children. */
export interface ShoppingItem {
  id: string;
  title: string;
  completed: boolean;
  parentId: string | null;
}

export interface ShoppingAdapter {
  /**
   * Which list this adapter is bound to.
   *
   * A household can have several shopping lists — the built-in one and any list
   * made with the 🛒 type — and they must not share a cache entry, or opening
   * the second shows the first's items and a tick lands on the wrong list.
   */
  key: string;
  getItems(): Promise<ShoppingItem[]>;
  /** Returns the new item's id, so the list can scroll to what you just added. */
  addItem(title: string): Promise<string>;
  toggleItem(id: string, completed: boolean): Promise<void>;
  renameItem(id: string, title: string): Promise<void>;
  removeItem(id: string): Promise<void>;
  /** Indent under a heading, or `null` to promote back to one. */
  setParent(id: string, parentId: string | null): Promise<void>;
  clearCompleted(): Promise<void>;
}
