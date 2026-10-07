import { ingredientLines, parseIngredient } from '@todolist/shared';
import { useMemo, useState } from 'react';
import type { MealOption } from '../components/MealDayCard';
import {
  ChipButton,
  inputClass,
  inputStyle,
  methodSteps,
  minutesText,
  PrimaryButton,
} from '../components/ui';

/**
 * Every recipe the family has, to search and open. The search reads names,
 * tags and ingredients, so "what can I make with chicken" is just typing
 * "chicken"; several words narrow it ("chicken coriander").
 */
export function RecipeBook({
  meals,
  onOpen,
  onAdd,
}: {
  meals: MealOption[];
  onOpen: (m: MealOption) => void;
  /** Absent where recipes cannot be added. */
  onAdd?: () => void;
}) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [favs, setFavs] = useState(false);

  // What each recipe can be found by: its name, tags and ingredient keys.
  const index = useMemo(
    () =>
      new Map(
        meals.map((m) => [
          m.id,
          [
            m.name,
            ...(m.tags ?? []),
            ...ingredientLines(m.ingredients).map((l) => parseIngredient(l).key),
          ]
            .join(' ')
            .toLowerCase(),
        ]),
      ),
    [meals],
  );
  const allTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of meals) for (const t of m.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);
  }, [meals]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = meals.filter(
    (m) =>
      (!favs || m.isFavourite) &&
      (!tag || (m.tags ?? []).includes(tag)) &&
      words.every((w) => index.get(m.id)!.includes(w)),
  );

  return (
    <div className="flex flex-col gap-d3">
      <div className="flex gap-d2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes or ingredients…"
          aria-label="Search recipes"
          className={inputClass}
          style={inputStyle}
        />
        {onAdd && (
          <PrimaryButton className="flex-none" onClick={onAdd}>
            ＋ Add
          </PrimaryButton>
        )}
      </div>
      <div className="flex flex-wrap gap-d2">
        <ChipButton active={favs} onClick={() => setFavs((f) => !f)}>
          ★ Favourites
        </ChipButton>
        {allTags.map((t) => (
          <ChipButton key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {t}
          </ChipButton>
        ))}
      </div>

      {meals.length === 0 ? (
        <div className="rounded-card bg-surface p-d4 text-center shadow-card">
          <p className="font-bold" style={{ fontSize: 'var(--fs-base)' }}>
            No recipes yet
          </p>
          <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Add one by pasting a link from a recipe site, or typing it in. Meals you plan on the
            week appear here too.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Nothing matches{q ? ` "${q}"` : ''}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-d2 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => {
            const n = ingredientLines(m.ingredients).length;
            const steps = methodSteps(m.method).length;
            const time = minutesText((m.prepMinutes ?? 0) + (m.cookMinutes ?? 0));
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpen(m)}
                className="flex flex-col gap-1 rounded-card bg-surface p-d3 text-left shadow-card"
              >
                <span className="flex items-start gap-d2">
                  <span className="min-w-0 flex-1 font-bold" style={{ fontSize: 'var(--fs-base)' }}>
                    {m.name}
                  </span>
                  {m.isFavourite && <span className="text-accent">★</span>}
                </span>
                <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                  {[
                    n ? `${n} ingredients` : 'No ingredients yet',
                    steps ? `${steps} steps` : null,
                    time,
                    m.servings ? `serves ${m.servings}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {(m.tags ?? []).length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {(m.tags ?? []).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full px-2 py-0.5 font-semibold"
                        style={{
                          background: 'var(--color-accent-soft)',
                          color: 'var(--color-accent)',
                          fontSize: 'var(--fs-xs)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
