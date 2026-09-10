import { useEffect, useRef, useState } from 'react';
import { trpc } from '../lib/trpc';

function relative(iso: string | Date): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/**
 * The body of a note list: one text area that saves itself.
 *
 * Saves a moment after you stop typing, and again when you leave. Server text
 * only replaces what's on screen while nothing is unsaved here, so someone
 * else's edit arriving mid-sentence can't eat your words — last write wins at
 * the row, never at the keystroke.
 */
export function NoteBody({
  listId,
  meId,
  focusSignal,
}: {
  listId: string;
  meId: string;
  focusSignal?: number;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.lists.note.useQuery({ listId });
  const [body, setBody] = useState('');
  const latest = useRef('');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [savedTick, setSavedTick] = useState(0);

  const save = trpc.lists.saveNote.useMutation({
    onSuccess: () => {
      utils.lists.note.invalidate({ listId });
      utils.lists.mine.invalidate();
      setSavedTick((n) => n + 1);
    },
  });
  // A stable handle for the unmount flush, which must not capture a stale mutate.
  const saveRef = useRef(save);
  saveRef.current = save;

  // Take the server's text whenever nothing here is waiting to be saved.
  useEffect(() => {
    if (data && !dirty.current) {
      setBody(data.body);
      latest.current = data.body;
    }
  }, [data]);

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    saveRef.current.mutate({ listId, body: latest.current });
  }

  // Leaving the screen with unsaved text still saves it.
  useEffect(() => {
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  function onChange(v: string) {
    setBody(v);
    latest.current = v;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  }

  // The floating + on a note has nothing to add, so it puts the cursor in the text.
  const lastFocus = useRef(focusSignal);
  useEffect(() => {
    if (focusSignal !== lastFocus.current) {
      lastFocus.current = focusSignal;
      const el = areaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [focusSignal]);

  // Grow with the text rather than scrolling inside a box.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`;
  }, [body]);

  let status: string;
  if (save.isPending) status = 'Saving…';
  else if (dirty.current) status = 'Unsaved changes';
  else if (data?.updatedAt) {
    const who = data.updatedById === meId ? 'you' : (data.updatedByName ?? 'someone');
    status = `Saved ${relative(data.updatedAt as unknown as string)} by ${who}`;
  } else status = 'Nothing written yet';
  // `savedTick` is read so the status re-renders after a save lands.
  void savedTick;

  return (
    <>
      <div className="mt-d3 rounded-card border border-border bg-surface shadow-card">
        <textarea
          ref={areaRef}
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onBlur={flush}
          disabled={isLoading}
          placeholder="Start typing…"
          aria-label="Note text"
          spellCheck
          className="block w-full resize-none bg-transparent px-4 py-4 outline-none"
          style={{
            fontSize: 'var(--fs-base)',
            lineHeight: 1.65,
            color: 'var(--color-text)',
            minHeight: 320,
          }}
        />
      </div>
      <div
        className="mt-2 flex items-center gap-2 text-muted"
        style={{ fontSize: 'var(--fs-xs)' }}
        aria-live="polite"
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background: save.isPending || dirty.current ? 'var(--color-muted)' : 'var(--color-ok)',
          }}
        />
        {status}
      </div>
    </>
  );
}
