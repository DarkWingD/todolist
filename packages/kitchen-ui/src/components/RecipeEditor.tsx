import { parseRecipeText, type RecipeDraft } from '@todolist/shared';
import { useState } from 'react';
import type { MealPlannerAdapter } from '../adapter';
import type { MealOption } from './MealDayCard';
import { Sheet } from './Sheet';
import { ChipButton, FieldLabel, inputClass, inputStyle, PrimaryButton } from './ui';

/**
 * Add or edit a recipe. Three ways to fill it in: type it, paste a link and
 * import it (the server reads the page's own recipe data), or paste the whole
 * recipe as text and let the headings sort it out. Imports only fill the
 * fields; nothing is saved until Save, so a page that read oddly is fixed first.
 */
export function RecipeEditor({
  open,
  planId,
  adapter,
  meal,
  onClose,
  onSaved,
}: {
  open: boolean;
  planId: string;
  adapter: MealPlannerAdapter;
  /** Editing this one; null to add a new recipe. */
  meal: MealOption | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(meal?.name ?? '');
  const [url, setUrl] = useState(meal?.recipeUrl ?? '');
  const [servings, setServings] = useState(meal?.servings ? String(meal.servings) : '');
  const [prep, setPrep] = useState(meal?.prepMinutes ? String(meal.prepMinutes) : '');
  const [cook, setCook] = useState(meal?.cookMinutes ? String(meal.cookMinutes) : '');
  const [tags, setTags] = useState((meal?.tags ?? []).join(', '));
  const [ingredients, setIngredients] = useState(meal?.ingredients ?? '');
  const [method, setMethod] = useState(meal?.method ?? '');
  const [notes, setNotes] = useState(meal?.notes ?? '');
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState<'import' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState<string | null>(null);

  function fill(d: RecipeDraft, source: string) {
    if (d.name && !name.trim()) setName(d.name);
    if (d.ingredients.length) setIngredients(d.ingredients.join('\n'));
    if (d.method.length) setMethod(d.method.join('\n'));
    if (d.servings) setServings(String(d.servings));
    if (d.prepMinutes) setPrep(String(d.prepMinutes));
    if (d.cookMinutes) setCook(String(d.cookMinutes));
    if (d.tags.length && !tags.trim()) setTags(d.tags.join(', '));
    setFilled(
      `Filled in from ${source}: ${d.ingredients.length} ingredients, ${d.method.length} steps. Check it over, then save.`,
    );
  }

  async function importLink() {
    if (!adapter.importRecipe || !url.trim()) return;
    setBusy('import');
    setError(null);
    setFilled(null);
    try {
      const d = await adapter.importRecipe(planId, url.trim());
      setUrl(d.recipeUrl);
      fill(d, 'the page');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const num = (s: string) => {
    const n = Number(s.trim());
    return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  async function save() {
    if (!name.trim()) {
      setError('Give the recipe a name.');
      return;
    }
    setBusy('save');
    setError(null);
    const fields = {
      recipeUrl: url.trim() || null,
      ingredients: ingredients.trim() || null,
      method: method.trim() || null,
      notes: notes.trim() || null,
      servings: num(servings),
      prepMinutes: num(prep),
      cookMinutes: num(cook),
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12),
    };
    try {
      if (meal) {
        await adapter.updateMeal({
          id: meal.id,
          name: name.trim() !== meal.name ? name.trim() : undefined,
          ...fields,
        });
        onSaved(meal.id);
      } else {
        const created = await adapter.createMeal!({
          planId,
          name: name.trim(),
          ...fields,
          recipeUrl: fields.recipeUrl ?? undefined,
          ingredients: fields.ingredients ?? undefined,
          notes: fields.notes ?? undefined,
        });
        onSaved(created.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={meal ? `Edit ${meal.name}` : 'Add a recipe'}
      maxHeight="92%"
    >
      <div className="flex flex-col gap-d3 p-d4">
        <h2 className="font-head font-bold" style={{ fontSize: 'var(--fs-lg)' }}>
          {meal ? `Edit ${meal.name}` : 'Add a recipe'}
        </h2>

        <label className="flex flex-col gap-1">
          <FieldLabel>Name</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chicken green curry"
            className={inputClass}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <FieldLabel>Recipe link</FieldLabel>
          <div className="flex gap-d2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… paste a recipe page"
              inputMode="url"
              autoComplete="off"
              className={inputClass}
              style={inputStyle}
            />
            {adapter.importRecipe && (
              <PrimaryButton
                className="flex-none"
                disabled={!url.trim() || busy !== null}
                onClick={importLink}
              >
                {busy === 'import' ? 'Reading…' : 'Import'}
              </PrimaryButton>
            )}
          </div>
        </label>

        <div className="flex flex-wrap gap-d2">
          <ChipButton active={pasting} onClick={() => setPasting((p) => !p)}>
            📋 Paste a recipe as text
          </ChipButton>
        </div>
        {pasting && (
          <div className="flex flex-col gap-d2">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              placeholder={
                'Paste the whole recipe here.\nIngredients\n2 onions\n…\nMethod\nFry the onions…'
              }
              className={inputClass}
              style={inputStyle}
            />
            <PrimaryButton
              disabled={!pasted.trim()}
              onClick={() => {
                fill(parseRecipeText(pasted), 'the text');
                setPasting(false);
                setPasted('');
              }}
            >
              Fill in from text
            </PrimaryButton>
          </div>
        )}

        {filled && (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-accent)' }} aria-live="polite">
            {filled}
          </p>
        )}

        <div className="grid grid-cols-3 gap-d2">
          <label className="flex flex-col gap-1">
            <FieldLabel>Serves</FieldLabel>
            <input
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              inputMode="numeric"
              placeholder="4"
              className={inputClass}
              style={inputStyle}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Prep min</FieldLabel>
            <input
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              inputMode="numeric"
              placeholder="15"
              className={inputClass}
              style={inputStyle}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Cook min</FieldLabel>
            <input
              value={cook}
              onChange={(e) => setCook(e.target.value)}
              inputMode="numeric"
              placeholder="30"
              className={inputClass}
              style={inputStyle}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <FieldLabel>Ingredients</FieldLabel>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={6}
            placeholder={
              'One per line, with amounts\n2 brown onions, diced\n500 g chicken thighs\n1 bunch coriander'
            }
            className={inputClass}
            style={inputStyle}
          />
          <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Amounts let the shopping list add things up and scale them. "Serves" lets it scale for
            your family.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <FieldLabel>Method</FieldLabel>
          <textarea
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            rows={6}
            placeholder={'One step per line\nFry the onions for 5 minutes.\nAdd the chicken…'}
            className={inputClass}
            style={inputStyle}
          />
          <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Cook mode shows one step at a time; times like "simmer for 20 minutes" become timer
            buttons.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <FieldLabel>Tags</FieldLabel>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="quick, kids like it, freezer"
            className={inputClass}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything worth remembering next time"
            className={inputClass}
            style={inputStyle}
          />
        </label>

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--fs-sm)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-d2 pb-d2">
          <PrimaryButton className="flex-1 py-3" disabled={busy !== null} onClick={save}>
            {busy === 'save' ? 'Saving…' : meal ? 'Save' : 'Add recipe'}
          </PrimaryButton>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-3 font-bold"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Sheet>
  );
}
