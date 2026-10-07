import { useEffect, useState } from 'react';
import type { PlanSettings } from '../adapter';
import { Sheet } from './Sheet';
import { FieldLabel, inputClass, inputStyle, PrimaryButton } from './ui';

/**
 * The two things the shopping list needs to know about this family: how many
 * a cook feeds (so a recipe for 4 is doubled for 8), and what the pantry always
 * has (so salt is not on the list every week).
 */
export function ShoppingSettings({
  open,
  settings,
  saving,
  onSave,
  onClose,
}: {
  open: boolean;
  settings: PlanSettings | undefined;
  saving: boolean;
  onSave: (v: { servings: number | null; pantry: string | null }) => void;
  onClose: () => void;
}) {
  const [servings, setServings] = useState<number | null>(null);
  const [pantry, setPantry] = useState('');
  useEffect(() => {
    if (!settings) return;
    setServings(settings.servings);
    setPantry(settings.pantry ?? settings.defaultPantry.join('\n'));
  }, [settings, open]);
  const people = servings ?? settings?.householdSize ?? 4;

  return (
    <Sheet open={open} onClose={onClose} title="Shopping settings">
      <div className="flex flex-col gap-d3 p-d4">
        <h2 className="font-head font-bold" style={{ fontSize: 'var(--fs-lg)' }}>
          ⚙ Shopping settings
        </h2>
        <div className="flex flex-col gap-1">
          <FieldLabel>We cook for</FieldLabel>
          <div className="flex items-center gap-d2">
            <button
              type="button"
              aria-label="Fewer"
              disabled={people <= 1}
              onClick={() => setServings(people - 1)}
              className="grid h-8 w-8 place-items-center rounded-full border border-border disabled:opacity-40"
            >
              −
            </button>
            <span
              className="font-bold"
              style={{
                fontSize: 'var(--fs-base)',
                minWidth: 70,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {people} {people === 1 ? 'person' : 'people'}
            </span>
            <button
              type="button"
              aria-label="More"
              disabled={people >= 40}
              onClick={() => setServings(people + 1)}
              className="grid h-8 w-8 place-items-center rounded-full border border-border disabled:opacity-40"
            >
              +
            </button>
            {servings !== null && settings && (
              <button
                type="button"
                onClick={() => setServings(null)}
                className="text-muted underline"
                style={{ fontSize: 'var(--fs-xs)' }}
              >
                Use household ({settings.householdSize})
              </button>
            )}
          </div>
          <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Recipes that say how many they serve are scaled to this on the shopping list, times the
            nights a cook feeds.
          </span>
        </div>
        <label className="flex flex-col gap-1">
          <FieldLabel>Always in the pantry</FieldLabel>
          <textarea
            value={pantry}
            onChange={(e) => setPantry(e.target.value)}
            rows={8}
            className={inputClass}
            style={inputStyle}
          />
          <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            One per line. These are left off the list (and named in a "check you have" line
            instead).
          </span>
        </label>
        <div className="flex gap-d2 pb-d2">
          <PrimaryButton
            className="flex-1 py-3"
            disabled={saving || !settings}
            onClick={() => onSave({ servings, pantry: pantry.trim() })}
          >
            {saving ? 'Saving…' : 'Save'}
          </PrimaryButton>
          {settings && (
            <button
              type="button"
              onClick={() => setPantry(settings.defaultPantry.join('\n'))}
              className="rounded-full border border-border px-4 py-3 font-bold"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              Default pantry
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
