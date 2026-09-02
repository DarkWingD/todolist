import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { formatShoppingText } from '@todolist/kitchen-ui';
import { webShare as share } from '../share';
import { exportStore, importStore, shoppingAdapter } from '../store/memory';
import {
  APPEARANCES,
  DENSITIES,
  TEXT_SCALE,
  THEMES,
  type Appearance,
  type Density,
  type Prefs,
  type Theme,
} from '../theme';

const THEME_LABEL: Record<Theme, string> = {
  tento: 'Tento',
  nudge: 'Nudge',
  momentum: 'Momentum',
};
// Each theme's own accent, so the swatch shows what you're picking rather than
// all three rendering in the currently active colour.
const THEME_ACCENT: Record<Theme, string> = {
  tento: '#5a5fcc',
  nudge: '#ff6b5e',
  momentum: '#7c3aed',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2
        className="mb-d2 mt-d4 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        {title}
      </h2>
      {children}
    </>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className="flex-1 rounded-md py-1.5 font-semibold capitalize"
          style={{
            fontSize: 'var(--fs-sm)',
            background: value === o ? 'var(--color-surface)' : 'transparent',
            color: value === o ? 'var(--color-text)' : 'var(--color-muted)',
          }}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

export function Settings({
  prefs,
  setPrefs,
}: {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function onExport() {
    const name = `kitchen-board-${new Date().toISOString().slice(0, 10)}.json`;
    await share.saveFile(name, 'application/json', exportStore());
    setNote({ ok: true, text: share.describe.file });
  }

  async function onShareList() {
    const text = formatShoppingText(await shoppingAdapter.getItems());
    await share.shareText('Shopping list', text);
    setNote({ ok: true, text: share.describe.text });
  }

  async function onImport(file: File) {
    try {
      importStore(await file.text());
      // Everything on screen came from the old store.
      await qc.invalidateQueries();
      setNote({ ok: true, text: 'Imported — your meals and list have been replaced.' });
    } catch (err) {
      setNote({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <div className="pb-4">
      <h1
        className="mb-d3 font-head"
        style={{
          fontSize: 'var(--fs-big)',
          fontWeight: 'var(--title-weight)',
          letterSpacing: 'var(--title-tracking)',
        }}
      >
        Settings
      </h1>

      <Section title="Theme">
        <div className="flex gap-d2">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPrefs({ theme: t })}
              aria-pressed={prefs.theme === t}
              className="flex flex-1 flex-col items-center gap-2 rounded-card bg-surface p-d3 shadow-card"
              style={{
                outline: prefs.theme === t ? '2px solid var(--color-accent)' : 'none',
                outlineOffset: 2,
              }}
            >
              <span
                className="block h-7 w-7 rounded-full"
                style={{ background: THEME_ACCENT[t] }}
              />
              <span className="font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
                {THEME_LABEL[t]}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Appearance">
        <Segmented
          options={APPEARANCES}
          value={prefs.appearance}
          onChange={(v: Appearance) => setPrefs({ appearance: v })}
        />
      </Section>

      <Section title="Density">
        <Segmented
          options={DENSITIES}
          value={prefs.density}
          onChange={(v: Density) => setPrefs({ density: v })}
        />
      </Section>

      <Section title="Text size">
        <div className="rounded-card bg-surface p-d3 shadow-card">
          <input
            type="range"
            min={TEXT_SCALE.min}
            max={TEXT_SCALE.max}
            step={TEXT_SCALE.step}
            value={prefs.textScale}
            aria-label="Text size"
            onChange={(e) => setPrefs({ textScale: Number(e.target.value) })}
            className="w-full"
            style={{ accentColor: 'var(--color-accent)' }}
          />
          <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      </Section>

      <Section title="Share">
        <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3 shadow-card">
          <p className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Send whoever's going to the shops what's still needed, grouped by meal so they know what
            each thing is for.
          </p>
          <button
            type="button"
            onClick={() => void onShareList()}
            className="rounded-full py-2.5 font-bold text-accent-contrast"
            style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
          >
            Send shopping list
          </button>
        </div>
      </Section>

      <Section title="Your data">
        <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3 shadow-card">
          <p className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Everything lives on this device — nothing is sent anywhere. Export keeps a copy you can
            move to another phone, or keep as a backup.
          </p>
          <div className="flex gap-d2">
            <button
              type="button"
              onClick={() => void onExport()}
              className="flex-1 rounded-full py-2.5 font-bold text-accent-contrast"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-full border border-border py-2.5 font-bold"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              Import
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = ''; // so the same file can be picked twice
            }}
          />
          {note && (
            <span
              style={{
                fontSize: 'var(--fs-sm)',
                color: note.ok ? 'var(--color-accent)' : 'var(--color-danger)',
              }}
            >
              {note.text}
            </span>
          )}
          <p className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Importing replaces everything currently here. Export first if you want to keep it.
          </p>
        </div>
      </Section>
    </div>
  );
}
