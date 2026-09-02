import { webStorage, type StoragePort } from './persistence';
import type {
  MealEntry,
  MealOption,
  MealPlannerAdapter,
  ShoppingAdapter,
  ShoppingItem,
} from '@todolist/kitchen-ui';

/**
 * Kitchen Board's data, entirely on the device.
 *
 * This is in memory for now so the app runs with no server, no database and no
 * account — which is also the shape the shipped version keeps, just persisted to
 * a JSON file. Field names deliberately mirror the server's columns so an
 * export could one day be imported the other way.
 */
const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => toDate(toMs(d) + n * DAY_MS);
const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

const COOK_SPAN_MAX = 7;
const uid = () => Math.random().toString(36).slice(2, 11);

interface Meal {
  id: string;
  name: string;
  recipeUrl: string | null;
  notes: string | null;
  ingredients: string | null;
  isFavourite: boolean;
}
interface PlannedDay {
  date: string;
  mealId: string;
  cookSpan: number;
}

export interface Store {
  version: 1;
  meals: Meal[];
  days: PlannedDay[];
  shopping: ShoppingItem[];
}

function seed(): Store {
  // A plausible week so the app has something to show on first run.
  const monday = (() => {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const meals: Meal[] = [
    {
      id: uid(),
      name: 'Slow-roast lamb shoulder',
      recipeUrl: 'https://www.recipetineats.com/slow-roasted-lamb-shoulder/',
      notes: 'Start it early — five hours at 160°C.',
      ingredients: 'lamb shoulder\nrosemary\ngarlic\npotatoes',
      isFavourite: true,
    },
    {
      id: uid(),
      name: 'Chicken curry',
      recipeUrl: null,
      notes: 'Mild paste — the kids.',
      ingredients: 'chicken thighs\nred curry paste\ncoconut milk\ncoriander',
      isFavourite: false,
    },
    {
      id: uid(),
      name: 'Pizza night',
      recipeUrl: null,
      notes: null,
      ingredients: 'pizza bases\nmozzarella\npassata',
      isFavourite: true,
    },
  ];
  return {
    version: 1,
    meals,
    days: [
      { date: monday, mealId: meals[0]!.id, cookSpan: 3 },
      { date: addDays(monday, 3), mealId: meals[1]!.id, cookSpan: 1 },
      { date: addDays(monday, 5), mealId: meals[2]!.id, cookSpan: 1 },
    ],
    shopping: [],
  };
}

let store: Store = seed();

// ─────────────────────────── persistence ───────────────────────────

let storage: StoragePort = webStorage;

/** Swap in the device's file storage once the native layer exists. */
export function setStorage(port: StoragePort) {
  storage = port;
}

/**
 * Writes are debounced: ticking half a dozen things off in a supermarket
 * shouldn't mean half a dozen writes. The trailing edge is what matters — the
 * last state always lands.
 */
let saveTimer: number | undefined;
function persist() {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void storage.save(JSON.stringify(store));
  }, 300);
}

/** Write now — for backgrounding the app, where a pending timer would be lost. */
export async function flush(): Promise<void> {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  await storage.save(JSON.stringify(store));
}

function parse(json: string): Store | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Store).version !== 1 ||
      !Array.isArray((parsed as Store).meals) ||
      !Array.isArray((parsed as Store).days) ||
      !Array.isArray((parsed as Store).shopping)
    ) {
      return null;
    }
    return parsed as Store;
  } catch {
    return null;
  }
}

/**
 * Load what's on the device, or seed a first run.
 *
 * A stored document always wins, even an empty one — someone who cleared their
 * meals shouldn't find the samples back the next morning. The seed is only for
 * a device that has never held anything.
 */
export async function initStore(): Promise<void> {
  const raw = await storage.load();
  const loaded = raw === null ? null : parse(raw);
  if (loaded) {
    store = loaded;
    return;
  }
  // Nothing stored, or bytes we can't read — keep the seed and write it, so the
  // next launch is an ordinary load rather than another first run.
  store = seed();
  await storage.save(JSON.stringify(store));
}

/**
 * Export is simply the persisted document — the same bytes that sit on the
 * device, so a backup and the live store can never drift apart.
 */
export function exportStore(): string {
  return JSON.stringify(store, null, 2);
}

/** Replaces everything. Rejects anything that is not a document we understand. */
export function importStore(json: string): void {
  const parsed = parse(json);
  if (!parsed) throw new Error('That file is not a Kitchen Board backup.');
  store = parsed;
  persist();
}

/**
 * Leftovers are derived, never stored: only the cook carries a span, and the
 * days after it are filled in by walking forward. A day with its own meal
 * always starts a new cook, which is what truncates one that overran.
 *
 * This mirrors the server's `range` exactly — the same rule has to hold in both
 * places or a plan would mean different things on the phone and on the web.
 */
function expand(from: string, to: string): MealEntry[] {
  const byDate = new Map(store.days.map((d) => [d.date, d]));
  const mealById = new Map(store.meals.map((m) => [m.id, m]));
  const lookback = addDays(from, -(COOK_SPAN_MAX - 1));
  const out: MealEntry[] = [];
  let cook: PlannedDay | null = null;
  let night = 0;
  for (let d = lookback; daysBetween(d, to) >= 0; d = addDays(d, 1)) {
    const row = byDate.get(d);
    if (row) {
      cook = row;
      night = 1;
    } else if (cook && night < cook.cookSpan) {
      night += 1;
    } else {
      cook = null;
      night = 0;
    }
    if (!cook || daysBetween(from, d) < 0) continue;
    const meal = mealById.get(cook.mealId);
    if (!meal) continue;
    out.push({
      date: d,
      mealId: meal.id,
      name: meal.name,
      recipeUrl: meal.recipeUrl,
      notes: meal.notes,
      ingredients: meal.ingredients,
      isFavourite: meal.isFavourite,
      cookSpan: cook.cookSpan,
      isLeftover: night > 1,
      cookDate: cook.date,
      night,
    });
  }
  return out;
}

/** Shorten any earlier cook whose leftovers would run into `date`. */
function truncateOverlapping(date: string) {
  const prev = store.days
    .filter((d) => d.date < date && daysBetween(d.date, date) < COOK_SPAN_MAX)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!prev) return;
  const gap = daysBetween(prev.date, date);
  if (prev.cookSpan > gap) prev.cookSpan = gap;
}

const rawMeals: MealPlannerAdapter = {
  // No accounts here, so there is exactly one plan and nothing to ensure.
  ensurePlan: async () => ({ id: 'local', memberCount: 1 }),
  getWeek: async (_planId, from, to) => expand(from, to),
  getMeals: async (): Promise<MealOption[]> =>
    [...store.meals]
      .sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite) || a.name.localeCompare(b.name))
      .map((m) => ({
        id: m.id,
        name: m.name,
        recipeUrl: m.recipeUrl,
        notes: m.notes,
        ingredients: m.ingredients,
        isFavourite: m.isFavourite,
      })),
  setDay: async (input) => {
    let mealId = input.mealId;
    if (!mealId) {
      const name = input.name!.trim();
      const existing = store.meals.find((m) => m.name.toLowerCase() === name.toLowerCase());
      if (existing) mealId = existing.id;
      else {
        mealId = uid();
        store.meals.push({
          id: mealId,
          name,
          recipeUrl: null,
          notes: null,
          ingredients: null,
          isFavourite: false,
        });
      }
    }
    truncateOverlapping(input.date);
    const row = store.days.find((d) => d.date === input.date);
    if (row) {
      row.mealId = mealId;
      row.cookSpan = input.cookSpan;
    } else {
      store.days.push({ date: input.date, mealId, cookSpan: input.cookSpan });
    }
  },
  clearDay: async (_planId, date) => {
    store.days = store.days.filter((d) => d.date !== date);
  },
  moveDay: async (_planId, from, to) => {
    const source = store.days.find((d) => d.date === from);
    if (!source) return;
    const target = store.days.find((d) => d.date === to);
    if (target) {
      // Swap, so a drag onto a filled day never silently destroys it.
      const { mealId, cookSpan } = source;
      source.mealId = target.mealId;
      source.cookSpan = target.cookSpan;
      target.mealId = mealId;
      target.cookSpan = cookSpan;
    } else {
      source.date = to;
    }
  },
  updateMeal: async (input) => {
    const meal = store.meals.find((m) => m.id === input.id);
    if (!meal) return;
    if (input.recipeUrl !== undefined) meal.recipeUrl = input.recipeUrl;
    if (input.notes !== undefined) meal.notes = input.notes;
    if (input.ingredients !== undefined) meal.ingredients = input.ingredients;
  },
  toggleFavourite: async (id, isFavourite) => {
    const meal = store.meals.find((m) => m.id === id);
    if (meal) meal.isFavourite = isFavourite;
  },
  sendToShoppingList: async (_planId, from, to) => {
    const seen = new Set<string>();
    let added = 0;
    for (const entry of expand(from, to)) {
      // A cook feeding several nights contributes its ingredients once.
      if (seen.has(entry.mealId)) continue;
      seen.add(entry.mealId);
      const openHeadings = store.shopping.filter((i) => !i.parentId && !i.completed);
      let heading = openHeadings.find(
        (i) => i.title.toLowerCase() === entry.name.trim().toLowerCase(),
      );
      if (!heading) {
        heading = { id: uid(), title: entry.name.trim(), completed: false, parentId: null };
        store.shopping.push(heading);
        added += 1;
      }
      // An existing heading is topped up rather than skipped, so ingredients
      // added after a first send still reach the list.
      const have = new Set(
        store.shopping
          .filter((i) => i.parentId === heading!.id && !i.completed)
          .map((i) => i.title.toLowerCase()),
      );
      for (const line of (entry.ingredients ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (have.has(line.toLowerCase())) continue;
        have.add(line.toLowerCase());
        store.shopping.push({ id: uid(), title: line, completed: false, parentId: heading.id });
        added += 1;
      }
    }
    return { added };
  },
  // No `invite`: nothing to share with when the data never leaves the phone.
};

const rawShopping: ShoppingAdapter = {
  getItems: async () => store.shopping.map((i) => ({ ...i })),
  addItem: async (title) => {
    const id = uid();
    store.shopping.push({ id, title, completed: false, parentId: null });
    return id;
  },
  toggleItem: async (id, completed) => {
    const item = store.shopping.find((i) => i.id === id);
    if (!item) return;
    item.completed = completed;
    // Ticking a meal ticks everything under it.
    if (!item.parentId)
      for (const child of store.shopping) if (child.parentId === id) child.completed = completed;
  },
  renameItem: async (id, title) => {
    const item = store.shopping.find((i) => i.id === id);
    if (item) item.title = title;
  },
  removeItem: async (id) => {
    store.shopping = store.shopping.filter((i) => i.id !== id && i.parentId !== id);
  },
  setParent: async (id, parentId) => {
    const item = store.shopping.find((i) => i.id === id);
    if (item) item.parentId = parentId;
  },
  clearCompleted: async () => {
    const everParent = new Set(store.shopping.map((i) => i.parentId).filter(Boolean));
    store.shopping = store.shopping.filter((i) => !i.completed);
    // Drop headings whose children have all gone.
    const stillParented = new Set(store.shopping.map((i) => i.parentId).filter(Boolean));
    store.shopping = store.shopping.filter(
      (i) => i.parentId || !everParent.has(i.id) || stillParented.has(i.id),
    );
  },
};

// ─────────────────────────── saving ───────────────────────────
/**
 * Every operation that changes the document is listed here, so a write can't be
 * added without deciding whether it persists. Reads pass through untouched.
 */
export const mealAdapter: MealPlannerAdapter = {
  ...rawMeals,
  setDay: async (i) => {
    await rawMeals.setDay(i);
    persist();
  },
  clearDay: async (p, d) => {
    await rawMeals.clearDay(p, d);
    persist();
  },
  moveDay: async (p, f, t) => {
    await rawMeals.moveDay(p, f, t);
    persist();
  },
  updateMeal: async (i) => {
    await rawMeals.updateMeal(i);
    persist();
  },
  toggleFavourite: async (id, fav) => {
    await rawMeals.toggleFavourite(id, fav);
    persist();
  },
  sendToShoppingList: async (p, f, t) => {
    const result = await rawMeals.sendToShoppingList(p, f, t);
    persist();
    return result;
  },
};

export const shoppingAdapter: ShoppingAdapter = {
  ...rawShopping,
  addItem: async (title) => {
    const id = await rawShopping.addItem(title);
    persist();
    return id;
  },
  toggleItem: async (id, done) => {
    await rawShopping.toggleItem(id, done);
    persist();
  },
  renameItem: async (id, title) => {
    await rawShopping.renameItem(id, title);
    persist();
  },
  removeItem: async (id) => {
    await rawShopping.removeItem(id);
    persist();
  },
  setParent: async (id, parentId) => {
    await rawShopping.setParent(id, parentId);
    persist();
  },
  clearCompleted: async () => {
    await rawShopping.clearCompleted();
    persist();
  },
};
