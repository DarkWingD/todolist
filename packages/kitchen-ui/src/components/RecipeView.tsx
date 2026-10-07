import { ingredientLines, scaleLine } from '@todolist/shared';
import { useEffect, useState } from 'react';
import type { MealOption } from './MealDayCard';
import { Sheet } from './Sheet';
import { ChipButton, FieldLabel, methodSteps, minutesText, PrimaryButton } from './ui';

/**
 * One recipe, to read: ingredients scaled for however many you are feeding,
 * the steps, how long it takes, and what to do with it next: cook it, plan it
 * for a night this week, edit it.
 */
export function RecipeView({
  open,
  meal,
  people,
  weekDays,
  onClose,
  onCook,
  onEdit,
  onPlan,
  onFavourite,
  onDelete,
}: {
  open: boolean;
  meal: MealOption;
  /** Who the plan cooks for; the scaler starts here when the recipe says how many it serves. */
  people: number | null;
  /** The visible week, for "plan it for…": [label, YYYY-MM-DD, already planned?]. */
  weekDays: { label: string; date: string; taken: boolean }[];
  onClose: () => void;
  onCook: (factor: number) => void;
  onEdit?: () => void;
  onPlan?: (date: string) => void;
  onFavourite?: (next: boolean) => void;
  onDelete?: () => void;
}) {
  const [target, setTarget] = useState<number | null>(
    meal.servings ? (people ?? meal.servings) : null,
  );
  const [planning, setPlanning] = useState(false);
  useEffect(
    () => setTarget(meal.servings ? (people ?? meal.servings) : null),
    [meal.id, meal.servings, people],
  );
  const factor = meal.servings && target ? target / meal.servings : 1;
  const lines = ingredientLines(meal.ingredients);
  const steps = methodSteps(meal.method);
  const times = [
    meal.prepMinutes ? `Prep ${minutesText(meal.prepMinutes)}` : null,
    meal.cookMinutes ? `Cook ${minutesText(meal.cookMinutes)}` : null,
  ].filter(Boolean);

  return (
    <Sheet open={open} onClose={onClose} title={meal.name} maxHeight="92%">
      <div className="flex flex-col gap-d3 p-d4">
        <div className="flex items-start gap-d2">
          <h2
            className="min-w-0 flex-1 font-head font-bold"
            style={{ fontSize: 'var(--fs-title)', lineHeight: 1.15 }}
          >
            {meal.name}
          </h2>
          {onFavourite && (
            <button
              type="button"
              onClick={() => onFavourite(!meal.isFavourite)}
              aria-pressed={meal.isFavourite}
              aria-label={meal.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className="flex-none text-accent"
              style={{ fontSize: 24 }}
            >
              {meal.isFavourite ? '★' : '☆'}
            </button>
          )}
        </div>

        {(times.length > 0 || (meal.tags ?? []).length > 0 || meal.recipeUrl) && (
          <div className="flex flex-wrap gap-d2">
            {times.map((t) => (
              <span
                key={t}
                className="rounded-full px-3 py-1 font-semibold text-muted"
                style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
              >
                ⏱ {t}
              </span>
            ))}
            {(meal.tags ?? []).map((t) => (
              <span
                key={t}
                className="rounded-full px-3 py-1 font-semibold"
                style={{
                  background: 'var(--color-accent-soft)',
                  color: 'var(--color-accent)',
                  fontSize: 'var(--fs-xs)',
                }}
              >
                {t}
              </span>
            ))}
            {meal.recipeUrl && (
              <a
                href={meal.recipeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full px-3 py-1 font-semibold text-muted underline"
                style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
              >
                🔗 Original recipe
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-d2">
          <PrimaryButton
            className="flex-1 py-3"
            disabled={lines.length === 0 && steps.length === 0}
            onClick={() => onCook(factor)}
          >
            🍳 Cook
          </PrimaryButton>
          {onPlan && (
            <button
              type="button"
              onClick={() => setPlanning((p) => !p)}
              aria-expanded={planning}
              className="rounded-full border border-border px-4 py-3 font-bold"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              📅 Plan it
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-border px-4 py-3 font-bold"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {planning && onPlan && (
          <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3 shadow-card">
            <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Which night this week?
            </span>
            <div className="flex flex-wrap gap-d2">
              {weekDays.map((d) => (
                <ChipButton
                  key={d.date}
                  onClick={() => {
                    onPlan(d.date);
                    setPlanning(false);
                  }}
                  title={d.taken ? 'Already planned: this replaces it' : undefined}
                >
                  {d.label}
                  {d.taken ? ' •' : ''}
                </ChipButton>
              ))}
            </div>
          </div>
        )}

        <section className="flex flex-col gap-d2">
          <div className="flex items-center gap-d2">
            <FieldLabel>Ingredients</FieldLabel>
            {meal.servings && target ? (
              <span
                className="ml-auto flex items-center gap-d2"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                <button
                  type="button"
                  aria-label="Fewer people"
                  disabled={target <= 1}
                  onClick={() => setTarget((t) => Math.max(1, (t ?? 1) - 1))}
                  className="grid h-7 w-7 place-items-center rounded-full border border-border disabled:opacity-40"
                >
                  −
                </button>
                <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {target} {target === 1 ? 'person' : 'people'}
                </span>
                <button
                  type="button"
                  aria-label="More people"
                  disabled={target >= 40}
                  onClick={() => setTarget((t) => (t ?? 1) + 1)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-border disabled:opacity-40"
                >
                  +
                </button>
              </span>
            ) : null}
          </div>
          {meal.servings && target && target !== meal.servings && (
            <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Scaled from {meal.servings} serves.
            </span>
          )}
          {lines.length === 0 ? (
            <p className="italic text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              No ingredients yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1" style={{ fontSize: 'var(--fs-base)' }}>
              {lines.map((l, i) => (
                <li key={i} className="flex gap-d2">
                  <span className="text-muted">•</span>
                  <span>{scaleLine(l, factor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {steps.length > 0 && (
          <section className="flex flex-col gap-d2">
            <FieldLabel>Method</FieldLabel>
            <ol className="flex flex-col gap-d2" style={{ fontSize: 'var(--fs-base)' }}>
              {steps.map((s, i) => (
                <li key={i} className="flex gap-d2">
                  <span className="flex-none font-bold text-accent" style={{ minWidth: 22 }}>
                    {i + 1}.
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {meal.notes && (
          <section className="flex flex-col gap-1">
            <FieldLabel>Notes</FieldLabel>
            <p style={{ fontSize: 'var(--fs-base)', whiteSpace: 'pre-wrap' }}>{meal.notes}</p>
          </section>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete ${meal.name}? Nights it is planned on are cleared.`))
                onDelete();
            }}
            className="self-start rounded-full border border-border px-4 py-2 font-bold"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)' }}
          >
            Delete recipe
          </button>
        )}
      </div>
    </Sheet>
  );
}
