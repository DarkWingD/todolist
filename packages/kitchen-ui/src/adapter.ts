import type { RecipeDraft } from '@todolist/shared';
import type { MealEntry, MealOption, RecipeFields } from './components/MealDayCard';

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

export interface UpdateMealInput extends RecipeFields {
  id: string;
  name?: string;
  recipeUrl?: string | null;
  notes?: string | null;
  ingredients?: string | null;
}

export interface CreateMealInput extends RecipeFields {
  planId: string;
  name: string;
  recipeUrl?: string;
  notes?: string;
  ingredients?: string;
  isFavourite?: boolean;
}

/** What "send week to shopping list" did; the newer fields only when the host can say. */
export interface ShoppingResult {
  added: number;
  updated?: number;
  /** Left off because the pantry has them. */
  pantry?: string[];
  /** Perishables only one meal uses, in a pack it will not finish. */
  spare?: { key: string; label: string; pack: string; meal: string; date: string }[];
}

export interface PlanSettings {
  /** How many a cook feeds; null means the whole household. */
  servings: number | null;
  /** One per line; null means the defaults. */
  pantry: string | null;
  defaultPantry: string[];
  householdSize: number;
}

export interface WeekProposal {
  date: string;
  mealId: string;
  name: string;
  reasons: string[];
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
  sendToShoppingList(planId: string, from: string, to: string): Promise<ShoppingResult>;
  /** The recipe book. Each is optional: a host without it simply hides that control. */
  createMeal?: (input: CreateMealInput) => Promise<{ id: string }>;
  removeMeal?: (id: string) => Promise<void>;
  /** Read a recipe from a web page: a server can, a phone on its own cannot. */
  importRecipe?: (planId: string, url: string) => Promise<RecipeDraft & { recipeUrl: string }>;
  suggestWeek?: (
    planId: string,
    from: string,
    to: string,
    seed: number,
  ) => Promise<{ proposals: WeekProposal[]; catalogSize: number }>;
  getSettings?: (planId: string) => Promise<PlanSettings>;
  updateSettings?: (
    planId: string,
    v: { servings?: number | null; pantry?: string | null },
  ) => Promise<void>;
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
