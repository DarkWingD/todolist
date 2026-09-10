import { Sheet } from '@todolist/kitchen-ui';
import { useState } from 'react';
import { toLocalInput, fromLocalInput } from '../lib/datetime';
import { trpc } from '../lib/trpc';

interface Preset {
  medicine: string;
  amount: string | null;
  intervalHours: number | null;
}

// Common ones to start with; the child's own history takes over after the first.
const STARTERS: Preset[] = [
  { medicine: 'Ibuprofen', amount: null, intervalHours: 6 },
  { medicine: 'Paracetamol', amount: null, intervalHours: 4 },
  { medicine: 'Antihistamine', amount: null, intervalHours: 24 },
];

/**
 * Log a dose in two taps: pick the medicine, tap Save. Amount and spacing
 * come from the pack and are remembered per child; time defaults to now.
 */
export function DoseSheet({
  listId,
  childName,
  presets,
  onClose,
  onDone,
}: {
  listId: string;
  childName: string;
  presets: Preset[];
  onClose: () => void;
  onDone: () => void;
}) {
  const options = [
    ...presets,
    ...STARTERS.filter(
      (s) => !presets.some((p) => p.medicine.toLowerCase() === s.medicine.toLowerCase()),
    ),
  ];
  const first = options[0];
  const [medicine, setMedicine] = useState(first?.medicine ?? '');
  const [amount, setAmount] = useState(first?.amount ?? '');
  const [interval, setInterval_] = useState(
    first?.intervalHours ? String(first.intervalHours) : '',
  );
  const [when, setWhen] = useState(() => toLocalInput(new Date().toISOString()));
  const [note, setNote] = useState('');
  const [remind, setRemind] = useState(true);
  const [custom, setCustom] = useState(false);

  const log = trpc.doses.log.useMutation({ onSuccess: onDone });
  const pick = (p: Preset) => {
    setMedicine(p.medicine);
    setAmount(p.amount ?? '');
    setInterval_(p.intervalHours ? String(p.intervalHours) : '');
    setCustom(false);
  };

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };
  const label = 'mb-1.5 mt-3 block font-semibold text-muted';
  const labelStyle = { fontSize: 'var(--fs-sm)' };
  const hours = Number(interval);

  return (
    <Sheet open onClose={onClose} title={`Medicine for ${childName.split(' ')[0]}`} maxHeight="88%">
      <h3 className="font-head" style={{ fontSize: 'var(--fs-lg)' }}>
        Medicine for {childName.split(' ')[0]}
      </h3>
      <p className="mb-3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        Amount and spacing are whatever the pack says. The app only keeps count.
      </p>

      <div className="flex flex-wrap gap-2">
        {options.map((p) => (
          <button
            key={p.medicine}
            type="button"
            onClick={() => pick(p)}
            className="rounded-full px-3 py-1.5 font-semibold"
            style={{
              fontSize: 'var(--fs-sm)',
              background:
                !custom && medicine === p.medicine
                  ? 'var(--color-accent-soft)'
                  : 'var(--color-chip-bg)',
              color:
                !custom && medicine === p.medicine ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            {p.medicine}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCustom(true);
            setMedicine('');
            setAmount('');
            setInterval_('');
          }}
          className="rounded-full px-3 py-1.5 font-semibold"
          style={{
            fontSize: 'var(--fs-sm)',
            background: custom ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
            color: custom ? 'var(--color-accent)' : 'var(--color-muted)',
          }}
        >
          Something else
        </button>
      </div>
      {custom && (
        <input
          autoFocus
          value={medicine}
          onChange={(e) => setMedicine(e.target.value)}
          placeholder="Medicine"
          aria-label="Medicine"
          className={`${field} mt-3`}
          style={fieldStyle}
        />
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className={label} style={labelStyle}>
            Amount
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5 mL"
            className={field}
            style={fieldStyle}
          />
        </div>
        <div className="flex-1">
          <label className={label} style={labelStyle}>
            Hours between doses
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0.5}
            max={48}
            step={0.5}
            value={interval}
            onChange={(e) => setInterval_(e.target.value)}
            placeholder="from the pack"
            className={field}
            style={fieldStyle}
          />
        </div>
      </div>
      <label className={label} style={labelStyle}>
        Given at
      </label>
      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className={field}
        style={fieldStyle}
      />
      <label className={label} style={labelStyle}>
        Note
      </label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="temp 38.4, with food…"
        className={field}
        style={fieldStyle}
      />
      {hours > 0 && (
        <label className="mt-3 flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)' }}>
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          Remind me when the next one can be given
        </label>
      )}

      <button
        type="button"
        disabled={!medicine.trim() || log.isPending}
        onClick={() =>
          log.mutate({
            listId,
            medicine: medicine.trim(),
            amount: amount.trim() || null,
            intervalHours: hours > 0 ? hours : null,
            givenAt: fromLocalInput(when) ?? undefined,
            note: note.trim() || null,
            remind: remind && hours > 0,
          })
        }
        className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
        style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
      >
        {log.isPending ? 'Saving…' : 'Save dose'}
      </button>
    </Sheet>
  );
}
