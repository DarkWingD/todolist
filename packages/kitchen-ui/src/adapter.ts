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
   * Absent on the phone, which has no server and so no one to share with. The
   * screen hides the Share control when this is undefined rather than offering
   * something that cannot work.
   */
  invite?: (planId: string, email: string) => Promise<void>;
}
